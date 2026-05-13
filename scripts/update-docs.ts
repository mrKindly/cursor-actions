// // =============================================================================
// // 🚀 WORKSHOP DEMO: AI-Powered Automatic Documentation Updater
// // =============================================================================
// //
// // WHAT THIS SCRIPT DOES (the big picture):
// //   Every time code is committed / pushed, this script checks whether the
// //   changes are "documentation-critical" (new endpoints, env vars, etc.).
// //   If they are, it calls the Cursor agent to intelligently update README.md and
// //   Swagger JSDoc blocks — and optionally enriches the prompt with real
// //   Jira ticket context pulled directly from the API.
// //
// // PIPELINE (6 steps):
// //   ① Collect the git diff vs. the target branch
// //   ② Code-level pre-screen  (regex, no LLM cost)
// //   ③ Load doc context       (README + Swagger files)
// //        ↳ Optionally fetch Jira ticket details
// //   ④ Triage pass            (cheap model — fast YES/NO)
// //   ⑤ Rewrite pass           (full-quality model update)
// //   ⑥ Write updated files to disk
// // =============================================================================

// import { Agent, CursorAgentError } from '@cursor/sdk';
// import { Version3Client } from 'jira.js';
// import * as dotenv from 'dotenv';
// import * as fs from 'fs';
// import * as path from 'path';
// import { exec } from 'child_process';
// import { promisify } from 'util';

// dotenv.config();

// const execAsync = promisify(exec);

// // =============================================================================
// // ⚙️  STEP 0 — Configuration
// // =============================================================================
// //
// // Two-model strategy (both are Cursor agent model IDs):
// //   • CURSOR_TRIAGE_MODEL — fast YES/NO gate (default composer-2)
// //   • CURSOR_MODEL        — full rewrite pass (default composer-2)
// //
// // Cost-control knobs:
// //   • MAX_DIFF_CHARS   — caps how many diff characters we feed to the agent (~3 k tokens)
// //   • MAX_README_CHARS — caps how much README text is embedded in the prompt
// // =============================================================================

// const CURSOR_TRIAGE_MODEL = process.env.CURSOR_TRIAGE_MODEL ?? 'composer-2';
// const CURSOR_MODEL = process.env.CURSOR_MODEL ?? 'composer-2';
// const MAX_DIFF_CHARS = 12_000; // ~3 k tokens — trim beyond this
// const MAX_README_CHARS = 8_000;

// const {
//     CURSOR_API_KEY,
//     JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY,
// } = process.env;

// /** Prepended so the agent returns chat-only outputs (this script writes files). */
// const CURSOR_OUTPUT_ONLY_PREFIX =
//     'Reply with only the requested JSON or code in your message. Do not edit files or run shell commands; the calling script applies outputs.\n\n';

// async function runCursorPrompt(apiKey: string, modelId: string, message: string): Promise<string> {
//     const fullMessage = CURSOR_OUTPUT_ONLY_PREFIX + message;
//     try {
//         const runResult = await Agent.prompt(fullMessage, {
//             apiKey,
//             model: { id: modelId },
//             local: { cwd: process.cwd(), settingSources: [] },
//         });
//         if (runResult.status !== 'finished') {
//             throw new Error(`Cursor agent run ended with status "${runResult.status}"`);
//         }
//         if (runResult.durationMs != null) {
//             console.log(`   Run duration — ${runResult.durationMs}ms`);
//         }
//         return runResult.result ?? '';
//     } catch (err) {
//         if (err instanceof CursorAgentError) {
//             throw new Error(`Cursor SDK failed to start the agent: ${err.message}`, { cause: err });
//         }
//         throw err;
//     }
// }

// // =============================================================================
// // 🗂️  Types
// // =============================================================================

// interface FileUpdate { filePath: string; fileContent: string; }

// interface SwaggerFile { path: string; content: string; }

// // =============================================================================
// // 🔍 STEP 1 — Criticality Pre-Screen  (zero LLM cost)
// // =============================================================================
// //
// // Before spending agent quota, we run a fast regex scan over the raw diff.
// // If NONE of the patterns below match, we bail out immediately — no agent call,
// // no Jira call, no cost at all.
// //
// // The patterns cover the most common doc-breaking changes:
// //   • New / renamed environment variables (process.env.*, FOO=...)
// //   • Route / endpoint declarations      (router.get(), path: '/...')
// //   • Next.js App Router HTTP handlers   (export async function GET/POST/...)
// //   • OpenAPI / Swagger comment blocks   (@swagger, openapi:)
// //   • Response schema changes            (schema:, response:, requestBody:)
// //   • README-relevant setup changes      (npm install, docker, .env)
// //   • Breaking: removed/renamed exports  (- export function Foo)
// //
// // 🎯 Workshop talking point:
// //   Regex pre-screens are a simple yet powerful cost-saving gate.
// //   Only a fraction of commits touch "critical" surfaces — this filter
// //   eliminates agent calls for the vast majority of everyday commits.
// // =============================================================================

// const CRITICAL_PATTERNS: RegExp[] = [
//     // New or renamed environment variables
//     /process\.env\.\w+/,
//     /[A-Z_]{3,}=\s*["']?/,
//     // Route / endpoint changes
//     /^\+.*(?:app|router)\.(get|post|put|patch|delete|head|options)\s*\(/im,
//     /^\+.*path\s*:\s*['"`]\/[^'"`\s]+/im,
//     // HTTP method handler exports (Next.js App Router)
//     /^\+\s*export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|HEAD)\s*\(/m,
//     // OpenAPI / Swagger comment blocks
//     /^\+.*@swagger/m,
//     /^\+.*openapi:/m,
//     // Response schema changes
//     /^\+.*(?:schema|response|request[Bb]ody)\s*:/im,
//     // README-visible setup steps
//     /^\+.*(?:npm install|yarn add|pnpm add|docker|\.env)/im,
//     // Breaking: renamed / removed exports
//     /^-\s*export\s+(?:default\s+)?(?:function|class|const)\s+\w+/m,
// ];

// function isCriticalDiff(diff: string): boolean {
//     return CRITICAL_PATTERNS.some((re) => re.test(diff));
// }

// // =============================================================================
// // 📄 STEP 2 — Parse Changed File Paths from Diff
// // =============================================================================
// //
// // We extract the list of files changed in the diff so we can load only the
// // relevant Swagger/API files (targeted context → smaller prompt → lower cost).
// //
// // Git unified diff format:
// //   --- a/src/app/api/convert/route.ts   ← old path
// //   +++ b/src/app/api/convert/route.ts   ← new path
// //
// // We strip the "a/" / "b/" prefix to get the real relative file paths.
// // =============================================================================

// function changedFilesFromDiff(diff: string): Set<string> {
//     const paths = new Set<string>();
//     // Match "--- a/src/..." and "+++ b/src/..." lines
//     for (const match of diff.matchAll(/^[+-]{3} [ab]\/(.+)$/gm)) {
//         paths.add(match[1]);
//     }
//     return paths;
// }

// // =============================================================================
// // 🗄️  File Collection Helpers
// // =============================================================================
// //
// // collectSourceFiles() walks the given directory recursively and returns all
// // TypeScript/TSX source files, skipping:
// //   • *.test.ts / *.spec.ts  — unit tests (not docs-relevant)
// //   • *.d.ts                 — type declaration files
// //   • node_modules / .git    — third-party / VCS internals
// // =============================================================================

// const SKIP_PATTERNS = [
//     /\.test\.(ts|tsx)$/,
//     /\.spec\.(ts|tsx)$/,
//     /\.d\.ts$/,
//     /node_modules/,
//     /\.git/,
// ];

// function collectSourceFiles(dir: string): string[] {
//     const files: string[] = [];
//     if (!fs.existsSync(dir)) return files;

//     for (const entry of fs.readdirSync(dir)) {
//         const full = path.join(dir, entry);
//         const stat = fs.statSync(full);
//         if (stat.isDirectory()) {
//             if (['node_modules', '__tests__', '.git'].includes(entry)) continue;
//             collectSourceFiles(full).forEach((f) => files.push(f));
//         } else if (/\.tsx?$/.test(entry) && !SKIP_PATTERNS.some((p) => p.test(entry))) {
//             files.push(full);
//         }
//     }
//     return files;
// }

// // =============================================================================
// // 🌿 Git Helpers
// // =============================================================================
// //
// // getDiff() — tries three strategies in order, returning the first non-empty result:
// //   1. git diff <branch>...HEAD          — three-dot diff against local ref
// //   2. git diff origin/<branch>...HEAD   — three-dot diff against remote ref
// //   3. git diff HEAD                     — fallback: staged + uncommitted changes
// //
// // getJiraKeys() — extracts PROJ-123 style ticket IDs from commit messages.
// //   Falls back to scanning the current branch name if no keys appear in commits.
// //
// // fetchJiraContext() — calls the Jira REST API for each key and returns a
// //   formatted string with the ticket summary + first 800 chars of description.
// //   This context is later injected into the agent prompts as enrichment.
// //
// // 🎯 Workshop talking point:
// //   Combining Jira ticket intent with the raw code diff gives the agent much
// //   richer context — it knows *why* the code changed, not just *what* changed.
// // =============================================================================

// async function getDiff(baseBranch: string): Promise<string> {
//     const attempts = [
//         () => execAsync(`git diff ${baseBranch}...HEAD`),
//         () => execAsync(`git diff origin/${baseBranch}...HEAD`),
//         () => execAsync(`git diff HEAD`),
//     ];
//     for (const attempt of attempts) {
//         try {
//             const { stdout } = await attempt();
//             if (stdout.trim()) return stdout;
//         } catch { /* try next */ }
//     }
//     return '';
// }

// async function getJiraKeys(baseBranch: string): Promise<string[]> {
//     let logs = '';
//     for (const cmd of [
//         `git log ${baseBranch}...HEAD --pretty=%B`,
//         `git log origin/${baseBranch}...HEAD --pretty=%B`,
//     ]) {
//         try { ({ stdout: logs } = await execAsync(cmd)); break; } catch { /* next */ }
//     }
//     const keys = Array.from(new Set((logs.match(/[A-Z]+-[0-9]+/g) ?? [])));
//     if (!keys.length && JIRA_PROJECT_KEY) {
//         try {
//             const { stdout } = await execAsync('git branch --show-current');
//             const m = stdout.trim().match(/[A-Z]+-[0-9]+/i);
//             if (m) keys.push(m[0].toUpperCase());
//         } catch { /* ignore */ }
//     }
//     return keys;
// }

// async function fetchJiraContext(jira: Version3Client, keys: string[]): Promise<string | null> {
//     if (!keys.length) {
//         console.log('   No Jira keys found in commits or branch name — skipping Jira context.');
//         return null;
//     }
//     const parts: string[] = [];
//     for (const key of keys) {
//         try {
//             const issue = await jira.issues.getIssue({ issueIdOrKey: key });
//             const desc = typeof issue.fields.description === 'string'
//                 ? issue.fields.description
//                 : JSON.stringify(issue.fields.description ?? '');
//             parts.push(
//                 `Ticket: ${key}\nSummary: ${issue.fields.summary}\n` +
//                 `Description: ${desc.substring(0, 800)}…`
//             );
//         } catch (e: unknown) {
//             console.warn(`   ⚠ Could not fetch Jira ${key}: ${e instanceof Error ? e.message : String(e)}`);
//         }
//     }
//     if (!parts.length) {
//         console.log('   All Jira fetches failed — proceeding without Jira context.');
//         return null;
//     }
//     return parts.join('\n\n');
// }

// // =============================================================================
// // 🤖 STEP 4 — LLM TRIAGE PASS  (cheap YES/NO gate)
// // =============================================================================
// //
// // Pass 1 — a minimal Cursor agent call whose only job is to answer YES or NO:
// // "does any of this warrant a doc update?"
// //
// // Why a separate triage pass?
// //   • Use a smaller/faster model id when you configure CURSOR_TRIAGE_MODEL separately
// //   • Most "critical" diffs (by regex) still don't need doc updates
// //
// // Prompt includes:
// //   • Clear YES/NO criteria (same as the CRITICAL_PATTERNS above, but in prose)
// //   • Optional Jira context (enriches the decision)
// //   • The git diff (possibly truncated)
// //
// // 🎯 Workshop talking point:
// //   Multi-model pipelines are a key cost-control pattern. Route easy tasks
// //   to cheap models ("judges") and expensive tasks to powerful models.
// // =============================================================================

// /**
//  * Pass 1 — cheap triage.
//  * Returns true if the rewrite pass should run.
//  */
// async function triageNeedsUpdate(
//     apiKey: string,
//     triageModelId: string,
//     diff: string,
//     jiraContext: string | null,
// ): Promise<boolean> {
//     console.log(`   Running triage pass (${triageModelId})...`);

//     const jiraSection = jiraContext
//         ? `Jira context:\n${jiraContext}\n\n`
//         : '';

//     const body =
//         `You are a senior engineer deciding whether API or README documentation needs updating.\n\n` +
//         `Return ONLY the single word YES or NO. YES means at least one of these is true:\n` +
//         `- A public API endpoint was added, removed, or its request/response changed\n` +
//         `- An environment variable was added or renamed\n` +
//         `- Setup / installation steps changed\n` +
//         `- A Swagger/OpenAPI comment block changed\n\n` +
//         jiraSection +
//         `Git diff (may be truncated):\n\`\`\`diff\n${diff}\n\`\`\``;

//     let reply: string;
//     try {
//         reply = await runCursorPrompt(apiKey, triageModelId, body);
//     } catch (e: unknown) {
//         console.warn(`   ⚠ Triage agent failed: ${e instanceof Error ? e.message : String(e)}. Treating as NO.`);
//         return false;
//     }

//     const answer = reply.trim().toUpperCase();
//     console.log(`   Triage verdict: ${answer}`);
//     return answer.startsWith('YES');
// }

// // =============================================================================
// // ✍️  STEP 5 — LLM REWRITE PASS  (full-quality update)
// // =============================================================================
// //
// // Pass 2 — the Cursor agent writes the updated documentation. It only runs after
// // both the regex pre-screen AND the triage pass give the green light.
// //
// // README + Swagger snapshots are embedded in one prompt string (no separate
// // provider-side prompt cache via this SDK path).
// //
// // Output format:
// //   The agent must return a bare JSON array (no markdown fences):
// //   [ { "filePath": "...", "fileContent": "..." }, ... ]
// //   Return [] if nothing needs updating.
// // =============================================================================

// /**
//  * Pass 2 — full rewrite with README + Swagger context in the prompt body.
//  */
// async function generateUpdates(
//     apiKey: string,
//     rewriteModelId: string,
//     diff: string,
//     jiraContext: string | null,
//     readmeText: string,
//     swaggerFiles: SwaggerFile[],
// ): Promise<FileUpdate[]> {
//     console.log(`   Running rewrite pass (${rewriteModelId})...`);

//     const jiraSection = jiraContext
//         ? `## Jira Context\n${jiraContext}\n\n`
//         : '';

//     const readmeSection = `## Current README.md\n\`\`\`md\n${readmeText}\n\`\`\`\n\n`;
//     const swaggerSection = `## Swagger API Files\n${JSON.stringify(swaggerFiles, null, 2)}\n\n`;

//     const instructions =
//         `You are a principal engineer. Update documentation for critical changes only.\n\n` +
//         `**Only update docs when:**\n` +
//         `- A public REST endpoint was added, removed, or its contract changed\n` +
//         `- An environment variable was added or renamed\n` +
//         `- Setup or installation steps changed\n` +
//         `- A Swagger JSDoc block needs to reflect the new request/response shape\n\n` +
//         `**Never update docs for:** internal refactors, test changes, logging tweaks, ` +
//         `performance optimisations that don't change the public contract.\n\n` +
//         `When updating a Swagger file, change ONLY the JSDoc comment blocks. ` +
//         `Leave all TypeScript code exactly as-is.\n\n` +
//         `Return a bare JSON array (no markdown fences):\n` +
//         `[\n  { "filePath": "relative/path", "fileContent": "complete new file content" }\n]\n` +
//         `Return [] if no update is warranted.\n\n`;

//     const messageBody =
//         instructions +
//         jiraSection +
//         `## Git Diff\n\`\`\`diff\n${diff}\n\`\`\`\n\n` +
//         readmeSection +
//         swaggerSection;

//     let rawReply: string;
//     try {
//         rawReply = await runCursorPrompt(apiKey, rewriteModelId, messageBody);
//     } catch (e: unknown) {
//         console.warn(`   ⚠ Rewrite agent failed: ${e instanceof Error ? e.message : String(e)}`);
//         return [];
//     }

//     const codeMatch = rawReply.match(/```(?:json)?\r?\n([\s\S]*?)```/);
//     const cleanJson = (codeMatch ? codeMatch[1] : rawReply).trim();

//     try {
//         return JSON.parse(cleanJson) as FileUpdate[];
//     } catch (e: unknown) {
//         console.warn('   ⚠ Agent returned invalid JSON; skipping update.', e instanceof Error ? e.message : String(e));
//         console.warn('   Snippet:', cleanJson.substring(0, 200));
//         return [];
//     }
// }

// // =============================================================================
// // 🎬 MAIN ORCHESTRATOR — checkAndApplyDocUpdates()
// // =============================================================================
// //
// // This function ties all the steps together. Here is the full decision tree:
// //
// //   START
// //     │
// //     ▼
// //   [Check env] ── CURSOR_API_KEY missing? ── EXIT(1)
// //     │
// //     ▼ (optional)
// //   [Init Jira client] ── credentials present? ── jiraClient = Version3Client
// //     │
// //     ▼
// //   ① getDiff(baseBranch)         ── empty diff? ── DONE (nothing to do)
// //     │
// //     ▼
// //   ② isCriticalDiff(diff)        ── no signals? ── DONE (skip agent passes entirely)
// //     │
// //     ▼
// //   ③ Load context
// //     ├── changedFilesFromDiff()  → targeted Swagger/API file list
// //     ├── Read README.md
// //     └── fetchJiraContext()      (optional — if Jira is configured)
// //     │
// //     ▼
// //   ④ triageNeedsUpdate() [triage model] ── verdict NO? ── DONE (no update needed)
// //     │
// //     ▼
// //   ⑤ generateUpdates() [rewrite model]  ── returns [] ? ── DONE (no files to write)
// //     │
// //     ▼
// //   ⑥ Write each FileUpdate to disk
// //     │
// //     ▼
// //   ✅ Documentation updated successfully
// // =============================================================================

// export async function checkAndApplyDocUpdates(): Promise<void> {
//     console.log('Documentation Updater');

//     // ── Guard: Cursor API key is the only hard requirement ────────────────
//     if (!CURSOR_API_KEY) {
//         console.error('Missing CURSOR_API_KEY. Exiting.');
//         process.exit(1);
//     }

//     // ── Optional: Jira client (gracefully degraded if not configured) ─────────
//     // The script works perfectly without Jira — it just loses ticket context.
//     let jiraClient: Version3Client | null = null;
//     if (JIRA_HOST && JIRA_EMAIL && JIRA_API_TOKEN) {
//         jiraClient = new Version3Client({
//             host: JIRA_HOST.startsWith('http') ? JIRA_HOST : `https://${JIRA_HOST}`,
//             authentication: { basic: { email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN } },
//         });
//     } else {
//         console.warn('   Jira credentials not configured — skipping Jira context.');
//     }

//     // ── ① Collect the git diff ────────────────────────────────────────────────
//     // Default base branch is "develop"; override via CLI: `npx ts-node update-docs.ts main`
//     const baseBranch = process.argv[2] ?? 'develop';
//     console.log(`\nStep 1: Collecting diff against "${baseBranch}"...`);

//     const rawDiff = await getDiff(baseBranch);
//     if (!rawDiff.trim()) {
//         console.log('   No diff found. Nothing to do.');
//         return;
//     }

//     // Truncate diff to keep costs predictable
//     let diff = rawDiff;
//     if (diff.length > MAX_DIFF_CHARS) {
//         diff = diff.substring(0, MAX_DIFF_CHARS) +
//             `\n\n[… diff truncated at ${MAX_DIFF_CHARS} chars; ` +
//             `${(rawDiff.length - MAX_DIFF_CHARS).toLocaleString()} chars omitted …]`;
//         console.log(`   Diff truncated from ${rawDiff.length.toLocaleString()} to ${MAX_DIFF_CHARS.toLocaleString()} chars.`);
//     }

//     // ── ② Code-level pre-screen — FREE, instant ───────────────────────────────
//     // No LLM call; just regex. If no critical signals → exit with zero cost.
//     console.log('\nStep 2: Code-level criticality pre-screen...');
//     if (!isCriticalDiff(diff)) {
//         console.log('   No critical signals detected in diff. Skipping agent passes. ✓');
//         return;
//     }
//     console.log('   Critical signals found — proceeding to agent triage.');

//     // ── ③ Load targeted documentation context ────────────────────────────────
//     // We only load API files that (a) actually changed in this diff OR
//     // (b) already contain @swagger annotations. This keeps the prompt lean.
//     console.log('\nStep 3: Loading targeted documentation context...');

//     const changedPaths = changedFilesFromDiff(rawDiff);
//     const allApiFiles = collectSourceFiles(path.join(process.cwd(), 'src/app/api'));

//     const swaggerFiles: SwaggerFile[] = allApiFiles
//         .filter((f) => {
//             const rel = path.relative(process.cwd(), f);
//             // Include only if (a) the file itself changed OR (b) it contains @swagger
//             // — but if the file changed we always include it regardless of @swagger
//             const changed = changedPaths.has(rel);
//             const hasSwagger = fs.readFileSync(f, 'utf-8').includes('@swagger');
//             return changed || hasSwagger;
//         })
//         .map((f) => ({
//             path: path.relative(process.cwd(), f),
//             content: fs.readFileSync(f, 'utf-8'),
//         }));

//     console.log(`   Loaded ${swaggerFiles.length} swagger/changed API file(s).`);

//     // README (truncated to keep the prompt body bounded)
//     let readmeText = '';
//     const readmePath = path.join(process.cwd(), 'README.md');
//     try {
//         if (fs.existsSync(readmePath)) {
//             const raw = fs.readFileSync(readmePath, 'utf-8');
//             readmeText = raw.length > MAX_README_CHARS
//                 ? raw.substring(0, MAX_README_CHARS) + '\n\n[… README truncated …]'
//                 : raw;
//         }
//     } catch { /* no README is fine */ }

//     // ── ③b Fetch Jira ticket context (optional enrichment) ───────────────────
//     // Extracts PROJ-123 keys from git log messages and the current branch name,
//     // then fetches the Jira issue summary + description for each key.
//     let jiraContext: string | null = null;
//     if (jiraClient) {
//         const jiraKeys = await getJiraKeys(baseBranch);
//         if (jiraKeys.length) {
//             console.log(`   Jira keys found: ${jiraKeys.join(', ')}`);
//             jiraContext = await fetchJiraContext(jiraClient, jiraKeys);
//         } else {
//             console.log('   No Jira keys found — proceeding with codebase context only.');
//         }
//     } else {
//         console.log('   Jira not configured — proceeding with codebase context only.');
//     }

//     // ── ④ Triage pass — cheap model gate ─────────────────────────────────────
//     // A 64-token YES/NO question. Eliminates false positives from the regex
//     // pre-screen before the heavier rewrite call.
//     console.log('\nStep 4: Triage pass...');
//     const needsUpdate = await triageNeedsUpdate(CURSOR_API_KEY, CURSOR_TRIAGE_MODEL, diff, jiraContext);
//     if (!needsUpdate) {
//         console.log('   Triage: no documentation update needed. Done. ✓');
//         return;
//     }

//     // ── ⑤ Rewrite pass — full-quality documentation update ───────────────────
//     // The expensive call — only reached if both the regex screen AND triage say YES.
//     // Returns an array of { filePath, fileContent } objects ready to write to disk.
//     console.log('\nStep 5: Rewrite pass...');
//     const updates = await generateUpdates(CURSOR_API_KEY, CURSOR_MODEL, diff, jiraContext, readmeText, swaggerFiles);

//     if (updates.length === 0) {
//         console.log('   No files to update. Done. ✓');
//         return;
//     }

//     // ── ⑥ Write updated files to disk ────────────────────────────────────────
//     // Each FileUpdate contains the full new content for the file.
//     // We overwrite atomically via writeFileSync (sync is fine in a CI script).
//     console.log(`\nStep 6: Writing ${updates.length} file(s)...`);
//     for (const update of updates) {
//         const absolutePath = path.join(process.cwd(), update.filePath);
//         console.log(`   📝 ${update.filePath}`);
//         fs.writeFileSync(absolutePath, update.fileContent, 'utf-8');
//     }

//     console.log('\n✅ Documentation updated successfully.');
// }

// // =============================================================================
// // 🔌 Entry Point
// // =============================================================================
// //
// // Run directly:   npx ts-node scripts/update-docs.ts [baseBranch]
// // Via npm script: npm run update-docs [-- baseBranch]
// // Pre-commit hook: Git uses core.hooksPath (.githooks); see .githooks/pre-commit
// // =============================================================================

// checkAndApplyDocUpdates().catch((e) => {
//     console.error('Fatal error in update-docs.ts:', e);
//     process.exit(1);
// });
