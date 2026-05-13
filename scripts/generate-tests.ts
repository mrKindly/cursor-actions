// =============================================================================
// 🚀 WORKSHOP DEMO: AI-Powered Automatic Test Generator
// =============================================================================
//
// WHAT THIS SCRIPT DOES (the big picture):
//   Given a GitHub Pull Request number, this script automatically generates
//   Jest unit tests for every changed TypeScript file in the PR.
//   It enriches the prompt with real Jira ticket context (WHY the code changed)
//   and with any EXISTING tests already in the repo (style matching).
//   Generated tests are written directly to disk — ready to commit.
//
// PIPELINE (5 steps):
//   Step 1  Fetch the PR metadata from GitHub (title, branch, body)
//   Step 2  Extract the Jira ticket ID from the PR title (e.g. PROJ-123)
//   Step 3  Fetch ticket details from Jira (summary + description)
//   Step 4  List all changed files in the PR, filter to testable ones
//   Step 5  For each file:
//             a) Check for an existing test file (style guide)
//             b) Call the Cursor agent with full context
//             c) Write the generated test to disk
//
// 🎯 Workshop talking point:
//   This script shows the "AI as junior team member" pattern: it reads the
//   PR diff, understands intent from the Jira ticket, matches the team's
//   existing conventions, and produces production-quality tests automatically.
// =============================================================================

import { Agent, CursorAgentError } from '@cursor/sdk';
import { Octokit } from 'octokit';
import { Version2Client } from 'jira.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// =============================================================================
// ⚙️  Configuration — environment variables
// =============================================================================
//
// All secrets come from .env (never hard-coded):
//   CURSOR_API_KEY — Cursor Cloud / agent API access
//   GITHUB_TOKEN      — read-only PAT for the target repo
//   GITHUB_REPO       — "owner/repo" format, e.g. "acme-corp/backend-api"
//   JIRA_HOST/EMAIL/API_TOKEN — Jira Cloud credentials
// =============================================================================

const CURSOR_OUTPUT_ONLY_PREFIX =
    'Reply with only the requested JSON or code in your message. Do not edit files or run shell commands; the calling script applies outputs.\n\n';

const CURSOR_API_KEY = process.env.CURSOR_API_KEY;
const CURSOR_MODEL = process.env.CURSOR_MODEL ?? 'composer-2';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const [owner, repo] = (process.env.GITHUB_REPO || '').split('/');

const JIRA_HOST = process.env.JIRA_HOST;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

// =============================================================================
// 🚫 Skip Patterns — files not worth generating tests for
// =============================================================================
//
// We skip: existing test files, type declarations, DB migrations,
// config files, Next.js boilerplate, re-export index files.
//
// 🎯 Workshop talking point:
//   Knowing WHAT NOT to generate is as important as knowing what to generate.
//   Generating tests for config or type files creates noise and wastes budget.
// =============================================================================

// Files to skip — no point generating tests for these
const SKIP_PATTERNS = [
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /\.d\.ts$/,
    /migration/i,
    /schema\.ts$/,
    /next\.config/,
    /tailwind\.config/,
    /jest\.config/,
    /index\.tsx?$/,              // Skip index files (usually re-exports)
    /(layout|loading|error|not-found)\.tsx?$/, // Skip Next.js boilerplate
    /\/types\//,                 // Skip type definition directories
    /\/constants\//,             // Optionally skip pure constants
];

// =============================================================================
// 📁 Test Location Resolution
// =============================================================================
//
// When looking for an existing test file, we check multiple candidate paths
// in priority order — co-located __tests__ folder first, then sibling file,
// then global src/__tests__ folder.
//
// Ensures we don't create a duplicate when one already exists.
// =============================================================================

// Where to look for existing tests, in priority order
const TEST_LOCATION_CANDIDATES = (filePath: string): string[] => {
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    return [
        `${dir}/__tests__/${base}.test.ts`,
        `${dir}/__tests__/${base}.test.tsx`,
        `${dir}/${base}.test.ts`,
        `${dir}/${base}.test.tsx`,
        `src/__tests__/${base}.test.ts`,
        `src/__tests__/${base}.test.tsx`,
    ];
};

// =============================================================================
// 🔎 getExistingTestContent — Style Guide Extraction
// =============================================================================
//
// Before generating a NEW test we check if one already exists ON THE PR BRANCH.
//
// Why does this matter?
//   • If a test exists → instruct the agent to EXTEND it (keep passing tests!)
//   • The existing file acts as a style guide: import patterns, mock setup,
//     describe/it naming, helper utilities — the agent should match them exactly.
//
// We fetch via the GitHub API so this works in CI without a full checkout.
//
// 🎯 Workshop talking point:
//   Giving the model a concrete example of the team's coding style produces
//   far better results than written instructions alone. Show, don't tell.
// =============================================================================

async function getExistingTestContent(
    octokit: Octokit,
    filePath: string,
    branch: string
): Promise<{ content: string; testPath: string } | null> {
    const candidates = TEST_LOCATION_CANDIDATES(filePath);

    for (const testPath of candidates) {
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: testPath,
                ref: branch,
            });

            if ('content' in data) {
                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                return { content, testPath };
            }
        } catch {
            // File doesn't exist at this path, try next candidate
        }
    }

    return null;
}

// =============================================================================
// 🤖 generateTestForFile — The Core Cursor Agent Call
// =============================================================================
//
// Assembles a rich, layered prompt and calls the Cursor agent to write the tests.
//
// PROMPT STRUCTURE (rich context = better tests):
//   1. Jira ticket  — WHY this change was made (intent / acceptance criteria)
//   2. PR info      — title + body (additional human context)
//   3. File path    — what file is being tested
//   4. Code diff    — what specifically changed (focused, not the whole file)
//   5. Existing test (if found) — style guide for the agent to match exactly
//
// Key behaviors:
//   • "SKIP_FILE" escape hatch — the model returns this literal string for
//     files with no meaningful logic (type files, re-exports, JSX shells).
//   • max_tokens guard — SDK runs do not expose stop_reason; we require a
//     non-empty finished result and surface non-finished statuses as errors.
//   • Strip-fence fallback — removes ```typescript``` wrappers if model
//     wrapped the output despite instructions.
//
// 🎯 Workshop talking point:
//   Structured prompts with layered context (WHY + WHAT + HOW) dramatically
//   outperform naive "write tests for this file" prompts. Each layer reduces
//   hallucination and increases relevance.
// =============================================================================

async function generateTestForFile(
    params: {
        filePath: string;
        fileDiff: string;
        existingTest: { content: string; testPath: string } | null;
        jiraId: string;
        jiraSummary: string;
        jiraDescription: unknown;
        prTitle: string;
        prBody: string | null;
    }
): Promise<string> {
    const { filePath, fileDiff, existingTest, jiraId, jiraSummary, jiraDescription, prTitle, prBody } = params;

    // Build the existing-test section:
    // If found → "extend this, match its style exactly"
    // If not found → "create new following Jest + Next.js best practices"
    const existingTestSection = existingTest
        ? `
### Existing Test File (${existingTest.testPath}):
Study this carefully — match its style, imports, mock patterns, describe/it naming conventions, and helper utilities exactly.

${existingTest.content}
`
        : `
### Existing Test File:
No existing test file found. Create a new test file following Jest and Next.js best practices.
`;

    const prompt = `
You are an expert software engineer specializing in Jest and Next.js.

Generate a Jest unit test for the following changed file in a Pull Request.

### Context from Jira:
Ticket: ${jiraId}
Summary: ${jiraSummary}
Description: ${JSON.stringify(jiraDescription)}

### Pull Request Info:
Title: ${prTitle}
Body: ${prBody || 'No description'}

### File Being Tested:
${filePath}

### Code Changes (Diff):
\`\`\`diff
${fileDiff}
\`\`\`

${existingTestSection}

### Instructions:
1. Examine the file and its diff to determine if there is meaningful logic to test. If the file is purely type definitions, re-exports, basic configuration, or a trivial component without behavior (e.g., just rendering a basic div/layout), return ONLY the exact text "SKIP_FILE".
2. If the file has testable logic, ${existingTest
        ? 'extend or update the existing test file to cover the new changes. Keep all passing existing tests intact.'
        : 'write a comprehensive new test file covering the main functionality introduced or changed.'}
3. Use modern Jest practices. If the code involves React components, use \`@testing-library/react\`.
4. Focus your tests on business logic, edge cases, and side effects. Avoid trivial "it renders without crashing" tests unless there are specific rendering conditions or dynamic props to evaluate. Focus only on what changed in the diff — do not invent tests for unrelated functionality.
5. Output ONLY the raw TypeScript code. Do NOT wrap it in markdown code blocks or backticks.
`;

    const fullPrompt = CURSOR_OUTPUT_ONLY_PREFIX + prompt;

    let runResult;
    try {
        runResult = await Agent.prompt(fullPrompt, {
            apiKey: CURSOR_API_KEY!,
            model: { id: CURSOR_MODEL },
            local: { cwd: process.cwd(), settingSources: [] },
        });
    } catch (err) {
        if (err instanceof CursorAgentError) {
            throw new Error(`Cursor SDK failed to start the agent: ${err.message}`, { cause: err });
        }
        throw err;
    }

    if (runResult.status !== 'finished') {
        throw new Error(
            `Cursor agent run ended with status "${runResult.status}" for ${filePath}`,
        );
    }

    if (runResult.durationMs != null) {
        console.log(`   Run duration — ${runResult.durationMs}ms (model: ${CURSOR_MODEL})`);
    }

    const responseText = runResult.result ?? '';
    if (!responseText.trim()) {
        throw new Error(`Empty response from Cursor agent for ${filePath}`);
    }

    // Strip markdown fences if the model included them despite instructions
    const codeMatch = responseText.match(/```(?:typescript)?\r?\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : responseText.trim();
}

// =============================================================================
// 📂 resolveTestOutputPath — Where to Write the Generated Test
// =============================================================================
//
// If an existing test was found → write back to the SAME path (update in place).
// If no test exists → mirror the source directory structure:
//
//   src/services/user.ts
//       ↓
//   src/services/__tests__/user.test.ts
// =============================================================================

function resolveTestOutputPath(filePath: string, existingTestPath?: string): string {
    if (existingTestPath) {
        return existingTestPath;
    }
    // Mirror source structure: src/services/user.ts → src/services/__tests__/user.test.ts
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, path.extname(filePath));
    return path.join(dir, '__tests__', `${base}.test.ts`);
}

// =============================================================================
// 🎬 main() — Orchestrator
// =============================================================================
//
// Full decision flow:
//
//   START
//     │
//     ▼
//   [Validate env vars]     ── any missing? ── EXIT(1)
//     │
//     ▼
//   Step 1: octokit.pulls.get(prNumber)
//           → pr.head.ref (branch name for test lookup)
//     │
//     ▼
//   Step 2: Extract Jira ID from PR title  ── not found? ── EXIT(1)
//     │
//     ▼
//   Step 3: jira.issues.getIssue(jiraId)  → summary + description
//     │
//     ▼
//   Step 4: octokit.pulls.listFiles(prNumber)
//           → filter: only src/**/*.ts(x), non-skipped, non-deleted
//     │
//     ▼
//   Step 5: For each testable file (sequential):
//     ├── getExistingTestContent()   → style guide (or null)
//     ├── generateTestForFile()      → Cursor Agent.prompt API call
//     │     ├── "SKIP_FILE"?         → log skip, continue
//     │     └── test code?
//     │           → resolveTestOutputPath()
//     │           → mkdirSync + writeFileSync
//     └── collect {filePath, testPath, success}
//     │
//     ▼
//   Print summary — exit(1) if any failures (CI signal)
// =============================================================================

async function main() {
    const prNumber = parseInt(process.argv[2]);

    if (!prNumber) {
        console.error('Please provide a PR number: npx tsx auto-tests.ts <pr_number>');
        process.exit(1);
    }

    if (!CURSOR_API_KEY || !GITHUB_TOKEN || !owner || !repo || !JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN) {
        console.error('Missing environment variables. Check .env.example');
        process.exit(1);
    }

    // ── Initialize API clients ────────────────────────────────────────────────
    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const jira = new Version2Client({
        host: JIRA_HOST.startsWith('http') ? JIRA_HOST : `https://${JIRA_HOST}`,
        authentication: {
            basic: {
                email: JIRA_EMAIL,
                apiToken: JIRA_API_TOKEN,
            },
        },
    });

    // ── Step 1: Fetch PR metadata ─────────────────────────────────────────────
    // We need the branch name to look up existing tests on the PR branch.
    console.log(`\nStep 1: Fetching PR #${prNumber} from ${owner}/${repo}...`);
    const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    const branch = pr.head.ref;

    // ── Step 2: Extract Jira ticket ID from PR title ──────────────────────────
    // Convention: PR titles must contain a key like "PROJ-123".
    // The regex matches uppercase project key + numeric ID.
    console.log(`Step 2: Extracting Jira ticket from PR title: "${pr.title}"`);
    const jiraMatch = pr.title.match(/[A-Z]+-[0-9]+/);
    if (!jiraMatch) {
        console.error('No Jira ticket found in PR title.');
        process.exit(1);
    }
    const jiraId = jiraMatch[0];
    console.log(`Found Jira ID: ${jiraId}`);

    // ── Step 3: Fetch Jira ticket details ────────────────────────────────────
    // Summary and description give the agent the business intent behind the change.
    // This prevents writing tests that check implementation details rather than
    // the intended behaviour described in the ticket.
    console.log(`Step 3: Fetching Jira issue details for ${jiraId}...`);
    const issue = await jira.issues.getIssue({ issueIdOrKey: jiraId });
    const jiraSummary = issue.fields.summary;
    const jiraDescription = issue.fields.description || 'No description provided.';

    // ── Step 4: Get changed files, filter to testable surface ─────────────────
    // listFiles returns up to 100 files. We filter to:
    //   • Not removed (deleted files don't need new tests)
    //   • In src/ directory (our testable surface)
    //   • TypeScript / TSX extension
    //   • Not matching any SKIP_PATTERNS
    console.log(`Step 4: Fetching changed files for PR #${prNumber}...`);
    const { data: changedFiles } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
    });

    // Filter out files we don't want to test
    const filesToProcess = changedFiles.filter((f) => {
        if (f.status === 'removed') return false;

        // Only process files in src/ directory that are .ts or .tsx
        if (!f.filename.startsWith('src/') || !/\.(ts|tsx)$/.test(f.filename)) return false;

        return !SKIP_PATTERNS.some((pattern) => pattern.test(f.filename));
    });

    console.log(`\nFound ${changedFiles.length} changed files, processing ${filesToProcess.length} testable files:\n`);
    filesToProcess.forEach((f) => console.log(`  • ${f.filename}`));

    const results: { filePath: string; testPath: string; success: boolean }[] = [];

    // ── Step 5: Generate tests — sequential (avoids GitHub rate limits) ───────
    for (const [index, file] of filesToProcess.entries()) {
        console.log(`\nStep 5.${index + 1}: Processing ${file.filename}...`);

        // 5a: Look for existing test on the PR branch (style guide)
        const existingTest = await getExistingTestContent(octokit, file.filename, branch);

        if (existingTest) {
            console.log(`   Found existing test: ${existingTest.testPath}`);
        } else {
            console.log(`   No existing test found — will create new`);
        }

        try {
            // 5b: Call the Cursor agent with all available context
            const testCode = await generateTestForFile({
                filePath: file.filename,
                fileDiff: file.patch || 'No diff available',
                existingTest,
                jiraId,
                jiraSummary,
                jiraDescription,
                prTitle: pr.title,
                prBody: pr.body,
            });

            // 5c: Respect the model's SKIP_FILE signal
            if (testCode.trim() === 'SKIP_FILE') {
                console.log(`   ⏭️ Skipped: AI determined file lacks meaningful testable logic.`);
                results.push({ filePath: file.filename, testPath: 'Skipped (No logic)', success: true });
                continue;
            }

            // 5d: Write generated test to disk
            // mkdirSync with recursive:true creates __tests__/ if needed
            const testOutputPath = resolveTestOutputPath(file.filename, existingTest?.testPath);
            const fullOutputPath = path.join(process.cwd(), testOutputPath);

            fs.mkdirSync(path.dirname(fullOutputPath), { recursive: true });
            fs.writeFileSync(fullOutputPath, `/**\n * @jest-environment node\n */\n\n${testCode}`);

            console.log(`   ✅ Saved to: ${testOutputPath}`);
            results.push({ filePath: file.filename, testPath: testOutputPath, success: true });
        } catch (err) {
            console.error(`   ❌ Failed: ${(err as Error).message}`);
            results.push({ filePath: file.filename, testPath: '', success: false });
        }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log('\n─────────────────────────────────────────');
    console.log('Summary:');
    results.forEach(({ filePath, testPath, success }) => {
        console.log(`  ${success ? '✅' : '❌'} ${filePath}${success ? ` → ${testPath}` : ' (failed)'}`);
    });

    // Non-zero exit so CI pipelines can detect failures
    const failed = results.filter((r) => !r.success).length;
    if (failed > 0) {
        console.error(`\n${failed} file(s) failed to generate tests.`);
        process.exit(1);
    }
}

// =============================================================================
// 🔌 Entry Point
// =============================================================================
//
// Usage:
//   npx ts-node scripts/generate-tests.ts <pr_number>
//   npm run generate-tests -- 42
//
// Typically triggered from a GitHub Actions workflow on pull_request events.
// See examples/generate-tests.yml for the full CI workflow definition.
// =============================================================================

main().catch((err) => {
    console.error('An error occurred:', err);
    process.exit(1);
});
