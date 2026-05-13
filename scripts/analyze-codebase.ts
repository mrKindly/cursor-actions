// =============================================================================
// 🚀 WORKSHOP DEMO: AI-Powered Codebase Analyzer & Jira Auto-Filer
// =============================================================================
//
// WHAT THIS SCRIPT DOES (the big picture):
//   Runs two quality-assurance phases automatically — ideal for nightly CI:
//
//   PHASE 1 — Test Failure → Bug Ticket
//     Runs Jest, finds failing test suites, and for each failure calls the Cursor agent
//     to produce a structured Jira Bug ticket with root cause, reproduction
//     steps, impact, and a suggested fix.
//
//   PHASE 2 — Source Code → Improvement Task
//     Reviews every TypeScript source file (or just the git-diff subset),
//     asks the Cursor agent to find concrete code quality issues, and files each one
//     as a structured Jira Task ticket with category, effort estimate,
//     current code snippet, and suggested fix.
//
// CONCURRENCY:
//   Both phases use a custom concurrency limiter so multiple files are
//   analyzed in parallel without hitting Cursor agent rate limits.
//
// CLI FLAGS:
//   --dry-run    Print what would be filed without creating Jira tickets
//   --diff-only  Restrict Phase 2 to files changed vs origin/main
//
// 🎯 Workshop talking point:
//   This script demonstrates two complementary AI automation patterns:
//   "reactive" (failing tests → bug reports) and "proactive" (static analysis
//   → improvement backlog). Together they keep the Jira board automatically
//   populated with actionable, high-context tickets.
// =============================================================================

import { Agent, CursorAgentError } from '@cursor/sdk';
import { Version3Client } from 'jira.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

dotenv.config();

const execAsync = promisify(exec);

// =============================================================================
// ⚙️  Configuration
// =============================================================================
//
// Key knobs:
//   CURSOR_MODEL      — Cursor model id for both phases (override via env)
//   CONCURRENCY_LIMIT — max parallel agent prompts (default 4)
//   MAX_FILE_LINES    — cap on lines sent per file (controls prompt size / cost)
//   DRY_RUN           — preview mode: logs tickets but doesn't create them
//   DIFF_ONLY         — Phase 2 only: restrict to git-changed files
// =============================================================================

const CURSOR_MODEL = process.env.CURSOR_MODEL ?? 'composer-2';
const CONCURRENCY_LIMIT = Number(process.env.CONCURRENCY_LIMIT ?? 4);
const MAX_FILE_LINES = Number(process.env.MAX_FILE_LINES ?? 200);
const DRY_RUN = process.argv.includes('--dry-run') || process.env.npm_config_dry_run === 'true' || process.env.DRY_RUN === 'true';
const DIFF_ONLY = process.argv.includes('--diff-only') || process.env.npm_config_diff_only === 'true' || process.env.DIFF_ONLY === 'true';

const {
    CURSOR_API_KEY,
    JIRA_HOST,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    JIRA_PROJECT_KEY,
} = process.env;

/** Prepended to every prompt so the agent returns chat-only JSON/code (scripts apply writes). */
const CURSOR_OUTPUT_ONLY_PREFIX =
    'Reply with only the requested JSON or code in your message. Do not edit files or run shell commands; the calling script applies outputs.\n\n';

async function runCursorPrompt(apiKey: string, modelId: string, message: string): Promise<string> {
    const fullMessage = CURSOR_OUTPUT_ONLY_PREFIX + message;
    try {
        const runResult = await Agent.prompt(fullMessage, {
            apiKey,
            model: { id: modelId },
            local: { cwd: process.cwd(), settingSources: [] },
        });
        if (runResult.status !== 'finished') {
            throw new Error(`Cursor agent run ended with status "${runResult.status}"`);
        }
        return runResult.result ?? '';
    } catch (err) {
        if (err instanceof CursorAgentError) {
            throw new Error(`Cursor SDK failed to start the agent: ${err.message}`, { cause: err });
        }
        throw err;
    }
}

// Skip boilerplate / generated files that aren't worth reviewing
const SKIP_PATTERNS = [
    /\.test\.(ts|tsx)$/,
    /\.spec\.(ts|tsx)$/,
    /\.d\.ts$/,
    /index\.tsx?$/,
    /(layout|loading|error|not-found)\.tsx?$/,
];

// =============================================================================
// 🗂️  Types — structured outputs the Cursor agent must return as JSON
// =============================================================================
//
// BugReport and ImprovementTask define the exact schema we ask the agent (via
// Agent.prompt) to emit in its reply. Strongly-typed schemas in the prompt
// reduce hallucination and make the Jira ticket creation code simple and safe.
//
// 🎯 Workshop talking point:
//   Designing a structured JSON output schema is one of the most effective
//   techniques for reliable LLM integration. It replaces fragile text
//   parsing with deterministic JSON.parse().
// =============================================================================

interface BugReport {
    summary: string;
    priority: 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
    priority_rationale: string;       // one sentence explaining why this priority was chosen
    affected_area: string;            // e.g. "Authentication", "Checkout", "API layer"
    root_cause: string;               // concise technical explanation of what is broken
    reproduction_steps: string[];     // ordered list — exact steps to reproduce
    expected_behavior: string;        // what should happen
    actual_behavior: string;          // what actually happens
    impact: string;                   // who is affected and how severely
    suggested_fix: string;            // code snippet or pseudocode
}

interface ImprovementTask {
    summary: string;
    priority: 'High' | 'Medium' | 'Low';
    priority_rationale: string;       // one sentence explaining the priority score
    category: 'security' | 'performance' | 'reliability' | 'maintainability' | 'type-safety' | 'accessibility';
    problem: string;                  // what is wrong and where exactly (include line refs if possible)
    why_it_matters: string;           // concrete consequence of leaving this unfixed
    effort_estimate: 'XS (<1h)' | 'S (1-2h)' | 'M (half day)' | 'L (1-2 days)' | 'XL (>2 days)';
    current_code: string;             // the problematic snippet as-is
    suggested_fix: string;            // the improved version
}

interface RunSummary {
    filesAnalyzed: number;
    bugsCreated: number;
    bugsDeduplicated: number;
    tasksCreated: number;
    tasksDeduplicated: number;
    apiCallsMade: number;
    errors: string[];
}

// =============================================================================
// ⚡ Concurrency Limiter
// =============================================================================
//
// A lightweight semaphore — limits how many Cursor agent prompts run simultaneously.
// Without this, analyzing 50 files would fire 50 parallel prompts and
// likely hit rate limits or exhaust memory.
//
// Usage: wrap any async fn with limit(() => fn())
//
// How it works:
//   • Maintain an `active` counter and a `queue` of pending tasks.
//   • When active < concurrency limit → run immediately (active++).
//   • Otherwise → push to queue.
//   • On each completion → decrement active, dequeue next task if any.
//
// 🎯 Workshop talking point:
//   Custom concurrency limiters are a common pattern in LLM pipelines.
//   Libraries like p-limit do the same thing but this implementation shows
//   exactly how it works under the hood.
// =============================================================================

function createLimiter(concurrency: number) {
    let active = 0;
    const queue: Array<() => void> = [];

    return function limit<T>(fn: () => Promise<T>): Promise<T> {
        return new Promise((resolve, reject) => {
            const run = () => {
                active++;
                fn()
                    .then(resolve)
                    .catch(reject)
                    .finally(() => {
                        active--;
                        if (queue.length > 0) queue.shift()!();
                    });
            };
            if (active < concurrency) run();
            else queue.push(run);
        });
    };
}

// =============================================================================
// 🎨 ADF Helpers — Atlassian Document Format
// =============================================================================
//
// Jira Cloud's REST API v3 requires ticket descriptions in ADF (Atlassian
// Document Format) — a JSON-based rich text format — NOT plain Markdown.
//
// These small helpers build ADF nodes (paragraphs, headings, code blocks,
// lists, panels, etc.) that compose into beautifully formatted Jira tickets.
//
// 🎯 Workshop talking point:
//   Rich, well-formatted Jira tickets are far more actionable than plain text.
//   ADF lets us produce tickets that look hand-crafted, complete with
//   highlighted panels, ordered reproduction steps, and syntax-highlighted
//   code snippets — all assembled from structured fields the Cursor agent returns.
// =============================================================================

type AdfNode = Record<string, unknown>;

function adfText(text: string, bold = false): AdfNode {
    const node: AdfNode = { type: 'text', text };
    if (bold) node.marks = [{ type: 'strong' }];
    return node;
}

function adfParagraph(...children: AdfNode[]): AdfNode {
    return { type: 'paragraph', content: children };
}

function adfHeading(level: 2 | 3, text: string): AdfNode {
    return { type: 'heading', attrs: { level }, content: [adfText(text)] };
}

function adfCodeBlock(code: string, language = 'typescript'): AdfNode {
    return { type: 'codeBlock', attrs: { language }, content: [{ type: 'text', text: code }] };
}

function adfBulletList(items: string[]): AdfNode {
    return {
        type: 'bulletList',
        content: items.map((item) => ({
            type: 'listItem',
            content: [adfParagraph(adfText(item))],
        })),
    };
}

function adfOrderedList(items: string[]): AdfNode {
    return {
        type: 'orderedList',
        content: items.map((item) => ({
            type: 'listItem',
            content: [adfParagraph(adfText(item))],
        })),
    };
}

function adfPanel(panelType: 'info' | 'warning' | 'note', ...children: AdfNode[]): AdfNode {
    return { type: 'panel', attrs: { panelType }, content: children };
}

function adfHRule(): AdfNode {
    return { type: 'rule' };
}

/** Build a rich ADF document for a Bug ticket */
function bugToAdf(bug: BugReport, filePath: string): any {
    return {
        version: 1,
        type: 'doc',
        content: [
            adfPanel(
                'info',
                adfParagraph(
                    adfText('📁 File: ', true),
                    adfText(filePath),
                    adfText('   |   🏷 Area: ', true),
                    adfText(bug.affected_area),
                ),
                adfParagraph(adfText('⚖️ Priority rationale: ', true), adfText(bug.priority_rationale)),
            ),

            adfHRule(),
            adfHeading(2, '🔍 Root Cause'),
            adfParagraph(adfText(bug.root_cause)),

            adfHeading(2, '🔄 Steps to Reproduce'),
            adfOrderedList(bug.reproduction_steps),

            adfHeading(2, '✅ Expected Behaviour'),
            adfParagraph(adfText(bug.expected_behavior)),

            adfHeading(2, '❌ Actual Behaviour'),
            adfParagraph(adfText(bug.actual_behavior)),

            adfHeading(2, '💥 Impact'),
            adfParagraph(adfText(bug.impact)),

            adfHeading(2, '🛠 Suggested Fix'),
            adfCodeBlock(bug.suggested_fix),
        ],
    };
}

/** Build a rich ADF document for an Improvement task */
function taskToAdf(task: ImprovementTask, filePath: string): any {
    return {
        version: 1,
        type: 'doc',
        content: [
            adfPanel(
                'note',
                adfParagraph(
                    adfText('📁 File: ', true),
                    adfText(filePath),
                    adfText('   |   🏷 Category: ', true),
                    adfText(task.category),
                    adfText('   |   ⏱ Effort: ', true),
                    adfText(task.effort_estimate),
                ),
                adfParagraph(adfText('⚖️ Priority rationale: ', true), adfText(task.priority_rationale)),
            ),

            adfHRule(),
            adfHeading(2, '🔍 Problem'),
            adfParagraph(adfText(task.problem)),

            adfHeading(2, '💡 Why It Matters'),
            adfParagraph(adfText(task.why_it_matters)),

            adfHeading(2, '📄 Current Code'),
            adfCodeBlock(task.current_code),

            adfHeading(2, '🛠 Suggested Fix'),
            adfCodeBlock(task.suggested_fix),
        ],
    };
}

// =============================================================================
// 🔁 Jira Helpers — Deduplication + Ticket Creation
// =============================================================================
//
// ticketExists() — JQL search before creating any ticket.
//   Searches for open tickets with a similar summary (first 50 chars).
//   If one exists → skip creation, increment deduplicated counter.
//   This prevents the same bug/task from being filed on every CI run.
//
// createBugIssue() / createTaskIssue():
//   1. Truncate summary to Jira's 250-char limit.
//   2. Check DRY_RUN flag — if set, just log and return.
//   3. Call ticketExists() — if duplicate, skip.
//   4. Call jira.issues.createIssue() with full ADF description.
//   5. Apply labels: 'ai-generated', 'ci-automated', plus category/area.
//
// 🎯 Workshop talking point:
//   Deduplication is critical for production automation. Without it, a
//   single flaky test would create dozens of identical Bug tickets across
//   nightly runs. The JQL ~ operator does fuzzy title matching.
// =============================================================================

async function ticketExists(jira: Version3Client, summary: string): Promise<boolean> {
    try {
        const result = await jira.issueSearch.searchForIssuesUsingJql({
            jql: `project = "${JIRA_PROJECT_KEY}" AND summary ~ "${summary.slice(0, 50).replace(/"/g, '\\"')}" AND statusCategory != Done`,
            maxResults: 1,
            fields: ['summary'],
        });
        return (result.total ?? 0) > 0;
    } catch {
        // If the search fails, err on the side of not blocking ticket creation
        return false;
    }
}

async function createBugIssue(
    jira: Version3Client,
    bug: BugReport,
    filePath: string,
    summary_: RunSummary,
): Promise<string | null> {
    const truncatedSummary = bug.summary.slice(0, 250);

    if (DRY_RUN) {
        console.log(`   [DRY RUN] Bug: ${truncatedSummary}`);
        console.log(`            Priority: ${bug.priority} | Area: ${bug.affected_area}`);
        return null;
    }

    const isDuplicate = await ticketExists(jira, truncatedSummary);
    if (isDuplicate) {
        console.log(`   ⏭ Duplicate Bug skipped: ${truncatedSummary.slice(0, 60)}...`);
        summary_.bugsDeduplicated++;
        return null;
    }

    try {
        const issue = await jira.issues.createIssue({
            fields: {
                project: { key: JIRA_PROJECT_KEY },
                summary: truncatedSummary,
                description: bugToAdf(bug, filePath),
                issuetype: { name: 'Bug' },
                priority: { name: bug.priority },
                labels: ['ai-generated', 'ci-automated', bug.affected_area.toLowerCase().replace(/\s+/g, '-')],
            },
        });
        return issue.key ?? null;
    } catch (err: any) {
        const msg = `Failed to create Bug: ${err.response?.data?.errors ?? err.message}`;
        summary_.errors.push(msg);
        console.error(`   ❌ ${msg}`);
        return null;
    }
}

async function createTaskIssue(
    jira: Version3Client,
    task: ImprovementTask,
    filePath: string,
    summary_: RunSummary,
): Promise<string | null> {
    const truncatedSummary = task.summary.slice(0, 250);

    if (DRY_RUN) {
        console.log(`   [DRY RUN] Task: ${truncatedSummary}`);
        console.log(`            Priority: ${task.priority} | Category: ${task.category} | Effort: ${task.effort_estimate}`);
        return null;
    }

    const isDuplicate = await ticketExists(jira, truncatedSummary);
    if (isDuplicate) {
        console.log(`   ⏭ Duplicate Task skipped: ${truncatedSummary.slice(0, 60)}...`);
        summary_.tasksDeduplicated++;
        return null;
    }

    try {
        const issue = await jira.issues.createIssue({
            fields: {
                project: { key: JIRA_PROJECT_KEY },
                summary: truncatedSummary,
                description: taskToAdf(task, filePath),
                issuetype: { name: 'Task' },
                priority: { name: task.priority },
                labels: ['ai-generated', 'ci-automated', task.category],
            },
        });
        return issue.key ?? null;
    } catch (err: any) {
        const msg = `Failed to create Task: ${err.response?.data?.errors ?? err.message}`;
        summary_.errors.push(msg);
        console.error(`  ❌ ${msg}`);
        return null;
    }
}

// =============================================================================
// 🐛 PHASE 1 — runJestAndFindBugs()
// =============================================================================
//
// Flow:
//   1. Run Jest with --json --outputFile to capture structured results.
//      (avoids fragile stdout JSON parsing — Jest always exits non-zero on failure)
//   2. Parse jest-results.json, then delete it.
//   3. Filter to FAILED suites only.
//   4. For each failed suite (in parallel, rate-limited):
//        a. Read the test file source
//        b. Try to locate and read the corresponding source file under test
//           (extra context for root-cause analysis)
//        c. Build a failure summary string from all failed assertion messages
//        d. Call the Cursor agent with a structured Bug-ticket prompt + priority rubric
//        e. Parse the returned JSON array of BugReport objects
//        f. File each bug as a Jira ticket (with deduplication)
//
// Prompt design highlights:
//   • Priority rubric table forces the model to apply consistent scoring
//   • Reproduction steps guideline ensures steps are concrete and runnable
//   • Large static context (full test file) is embedded in the prompt body.
//
// 🎯 Workshop talking point:
//   Embedding a priority rubric in the prompt is a form of "chain-of-thought prompting"
//   — the agent must reason through which criterion applies before assigning
//   a priority. This produces far more consistent and defensible priorities
//   than asking "is this High or Low?".
// =============================================================================

async function runJestAndFindBugs(
    apiKey: string,
    modelId: string,
    jira: Version3Client,
    summary_: RunSummary,
): Promise<void> {
    console.log('\nStep 1: Running unit tests...');

    const resultsFile = path.join(process.cwd(), 'jest-results.json');

    try {
        // Write results to a file — avoids fragile stdout JSON parsing
        await execAsync(`npx jest --json --outputFile=${resultsFile} --forceExit`);
    } catch {
        // Jest exits non-zero on test failure; that's expected
    }

    if (!fs.existsSync(resultsFile)) {
        console.log('   Jest did not produce a results file. Skipping bug phase.');
        return;
    }

    let results: any;
    try {
        results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
    } catch (e) {
        console.error('Could not parse jest-results.json:', e);
        return;
    } finally {
        fs.unlinkSync(resultsFile);
    }

    const failedSuites = (results.testResults ?? []).filter(
        (tr: any) => tr.status === 'failed',
    );

    if (failedSuites.length === 0) {
        console.log('   ✅ All tests passed. No bugs to file.');
        return;
    }

    console.log(`   Found ${failedSuites.length} failed suite(s). Batching analysis...`);

    const limit = createLimiter(CONCURRENCY_LIMIT);

    // Process all failed suites in parallel (up to CONCURRENCY_LIMIT at once)
    await Promise.all(
        failedSuites.map((suite: any) =>
            limit(async () => {
                const failures = suite.assertionResults.filter((a: any) => a.status === 'failed');
                if (failures.length === 0) return;

                const relPath = path.relative(process.cwd(), suite.name);
                console.log(`\n   Processing suite: ${relPath} (${failures.length} failure(s))`);

                let testContent = '(unreadable)';
                try {
                    testContent = fs.readFileSync(suite.name, 'utf-8');
                } catch { /* non-fatal */ }

                // Attempt to find the source file being tested for extra context
                // Convention: __tests__/foo.test.ts → foo.ts (strip __tests__ dir + .test suffix)
                const sourceGuess = suite.name
                    .replace(/\/__tests__\//, '/')
                    .replace(/\.test\.(ts|tsx)$/, '.$1')
                    .replace(/\.spec\.(ts|tsx)$/, '.$1');
                let sourceContent = '';
                try {
                    if (fs.existsSync(sourceGuess)) {
                        const raw = fs.readFileSync(sourceGuess, 'utf-8');
                        sourceContent = raw.split('\n').slice(0, MAX_FILE_LINES).join('\n');
                    }
                } catch { /* non-fatal */ }

                const failureSummary = failures
                    .map((f: any, i: number) =>
                        `### Failure ${i + 1}: "${f.title}"\n\`\`\`\n${f.failureMessages.join('\n')}\n\`\`\``,
                    )
                    .join('\n\n');

                // ── Prompt: Bug analysis with priority rubric ─────────────────
                //
                // The priority rubric table is the key prompt engineering
                // technique here — it acts as an in-context grading rubric.
                // We instruct the agent to map the failure to a specific criterion before
                // assigning a priority, which yields consistent, defensible scoring.
                const prompt = `You are a senior engineer writing actionable Jira Bug tickets from CI test failures.

## Context
- Test file: ${relPath}
- Source file under test: ${sourceGuess}
- Failures: ${failures.length}

## Test file
\`\`\`typescript
${testContent}
\`\`\`
${sourceContent ? `\n## Source file under test\n\`\`\`typescript\n${sourceContent}\n\`\`\`` : ''}

## Failures
${failureSummary}

---

## Your task
For each failure produce one Bug ticket entry. Return ONLY a valid JSON array — no markdown fences, no preamble.

## Priority scoring rubric (apply strictly)
Use these criteria to assign priority. Quote the matching criterion in "priority_rationale".

| Priority | Triggers |
|----------|----------|
| Highest  | Data loss or corruption • Security / auth bypass • Payment or billing logic wrong • Production crash for all users • PII exposure |
| High     | Incorrect business logic in a critical path (checkout, login, API contract) • Affects majority of users • Wrong calculation with financial impact |
| Medium   | Non-critical path failure • Affects a subset of users • Workaround exists • UI state bug |
| Low      | Rare edge case • Cosmetic / display glitch • Only affects development/test env |
| Lowest   | Flaky test with unclear cause • Negligible user impact |

## Reproduction steps guidelines
- Write steps a developer can follow without reading the code.
- Start from the simplest possible trigger (e.g. "Call endpoint POST /api/convert with amount=100&from=USD&to=EUR").
- Include concrete inputs and exact expected vs actual values where the error output provides them.

## JSON schema (return an array of these)
{
  "summary": "Concise, specific title — include function/component name and what is wrong. Max 200 chars.",
  "priority": "Highest|High|Medium|Low|Lowest",
  "priority_rationale": "One sentence citing the specific rubric criterion that drove this score.",
  "affected_area": "Short domain label, e.g. Currency Conversion, Authentication, Checkout, API Layer.",
  "root_cause": "Precise technical explanation of the defect — reference specific line logic or variable names from the code above.",
  "reproduction_steps": ["Step 1", "Step 2", "..."],
  "expected_behavior": "What should happen according to the test assertion.",
  "actual_behavior": "What actually happens — include the actual value from the error output.",
  "impact": "Who is affected, how severely, and what is the user-visible consequence.",
  "suggested_fix": "The corrected code snippet — prefer a diff-style or before/after block."
}`;

                summary_.apiCallsMade++;
                let bugs: BugReport[];

                try {
                    const promptBody =
                        `Test file context for ${relPath}:\n${testContent}\n\n` + prompt;
                    const raw = await runCursorPrompt(apiKey, modelId, promptBody);
                    const codeMatch = raw.match(/```(?:json)?\r?\n([\s\S]*?)```/);
                    const cleanJson = codeMatch ? codeMatch[1].trim() : raw.trim();
                    bugs = JSON.parse(cleanJson);
                } catch (e) {
                    console.error(`   ❌ Cursor agent call failed for ${relPath}:`, e);
                    summary_.errors.push(`Cursor agent call failed for ${relPath}`);
                    return;
                }

                for (const bug of bugs) {
                    const key = await createBugIssue(jira, bug, relPath, summary_);
                    if (key) {
                        console.log(`   ✅ Bug ${key} [${bug.priority}]: ${bug.summary.slice(0, 60)}...`);
                        summary_.bugsCreated++;
                    }
                }
            }),
        ),
    );
}

// =============================================================================
// 🔬 PHASE 2 — analyzeCodebaseImprovements()
// =============================================================================
//
// Flow:
//   1. Collect files to analyze:
//        • Default: all .ts/.tsx in src/ (skipping boilerplate)
//        • --diff-only: only files changed vs origin/main
//   2. For each file (in parallel, rate-limited):
//        a. Skip trivially short files (< 10 lines — no logic to review)
//        b. Truncate to MAX_FILE_LINES (cost control)
//        c. Call the Cursor agent with an improvement-analysis prompt + rubric
//        d. Parse the returned JSON array of ImprovementTask objects
//        e. File each task as a Jira Task ticket (with deduplication)
//
// Prompt design highlights:
//   • Priority rubric (High/Medium/Low) with specific technical triggers
//   • Category definitions pin the model to one of 6 well-defined buckets
//   • Effort definitions give the model concrete sizing anchors
//   • File content is embedded in the prompt (no server-side prompt cache).
//
// 🎯 Workshop talking point:
//   Using rubric tables in the prompt is one of the most impactful prompt
//   engineering techniques. It forces the model to reason about WHY a finding
//   has a given priority — like a code review checklist the agent completes in its JSON reply.
// =============================================================================

function collectSourceFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);

        if (stat.isDirectory()) {
            if (entry === 'node_modules' || entry === '__tests__' || entry === '.git') continue;
            collectSourceFiles(full).forEach((f) => files.push(f));
        } else if (/\.(ts|tsx)$/.test(entry) && !SKIP_PATTERNS.some((p) => p.test(entry))) {
            files.push(full);
        }
    }

    return files;
}

// getChangedFiles() — used when --diff-only flag is set.
// Returns absolute paths of .ts/.tsx files changed vs origin/main,
// or null if git is unavailable (triggers fallback to full scan).
async function getChangedFiles(): Promise<string[] | null> {
    try {
        const { stdout } = await execAsync('git diff --name-only origin/main HEAD');
        return stdout
            .trim()
            .split('\n')
            .filter((f) => /\.(ts|tsx)$/.test(f) && !SKIP_PATTERNS.some((p) => p.test(f)))
            .map((f) => path.join(process.cwd(), f))
            .filter((f) => fs.existsSync(f));
    } catch {
        return null; // Not in a git repo or no origin/main — fall back to full scan
    }
}

// truncateFile() — hard cap on lines included in each agent prompt.
// Returns the content and a flag so the prompt can note truncation.
function truncateFile(content: string, maxLines: number): { content: string; truncated: boolean } {
    const lines = content.split('\n');
    if (lines.length <= maxLines) return { content, truncated: false };
    return {
        content: lines.slice(0, maxLines).join('\n') + `\n\n// … ${lines.length - maxLines} more lines (truncated)`,
        truncated: true,
    };
}

async function analyzeCodebaseImprovements(
    apiKey: string,
    modelId: string,
    jira: Version3Client,
    summary_: RunSummary,
): Promise<void> {
    console.log('\nStep 2: Analyzing source files...');

    const srcDir = path.join(process.cwd(), 'src');
    let filesToAnalyze: string[];

    // Respect the --diff-only flag: limit scope to git-changed files
    if (DIFF_ONLY) {
        console.log('   --diff-only: restricting to files changed vs origin/main');
        const changed = await getChangedFiles();
        if (changed === null) {
            console.warn('   Could not get git diff. Falling back to full scan.');
            filesToAnalyze = collectSourceFiles(srcDir);
        } else {
            filesToAnalyze = changed.filter((f) => f.startsWith(srcDir));
            console.log(`   ${filesToAnalyze.length} changed file(s) in src/`);
        }
    } else {
        filesToAnalyze = collectSourceFiles(srcDir);
    }

    if (filesToAnalyze.length === 0) {
        console.log('   No source files to analyze.');
        return;
    }

    console.log(`   Analyzing ${filesToAnalyze.length} file(s) with concurrency=${CONCURRENCY_LIMIT}...`);
    summary_.filesAnalyzed = filesToAnalyze.length;

    const limit = createLimiter(CONCURRENCY_LIMIT);

    // Analyze all files in parallel (up to CONCURRENCY_LIMIT at once)
    await Promise.all(
        filesToAnalyze.map((filePath) =>
            limit(async () => {
                const relPath = path.relative(process.cwd(), filePath);
                const rawContent = fs.readFileSync(filePath, 'utf-8');

                if (rawContent.split('\n').length < 10) return; // trivially short

                const { content: fileContent, truncated } = truncateFile(rawContent, MAX_FILE_LINES);

                console.log(`   Analyzing ${relPath}${truncated ? ' (truncated)' : ''}...`);

                // ── Prompt: Improvement analysis with category + effort rubrics ──
                //
                // Three rubric tables (priority, category, effort) steer the Cursor agent
                // toward consistent, self-explanatory findings instead of
                // vague "this could be better" comments.
                const prompt = `You are a principal engineer conducting a structured code review for a production TypeScript codebase.

## File under review
Path: ${relPath}${truncated ? ` (first ${MAX_FILE_LINES} lines shown — file is longer)` : ''}

---

## Your task
Identify concrete, impactful issues only. Skip minor style preferences (naming, formatting) unless they cause real confusion or bugs.
For each issue, produce one Improvement task entry.
Return ONLY a valid JSON array — no markdown fences, no preamble. Return [] if no meaningful issues exist.

---

## Priority scoring rubric (apply strictly — quote the matching criterion in "priority_rationale")

| Priority | Triggers |
|----------|----------|
| High     | Security vulnerability (injection, XSS, exposed secret, improper auth) • Correctness bug not caught by tests (wrong calculation, off-by-one) • Memory/resource leak • Race condition or concurrency hazard • Missing error handling on a critical I/O path (DB, external API, payment) • N+1 query or O(n²) loop on an unbounded data set |
| Medium   | Unhandled promise rejection on a non-critical path • Overly broad try/catch swallowing errors silently • Missing input validation allowing bad state • Inefficient data structure with measurable impact • Poor type safety enabling runtime crashes (any-casting, non-null assertions on user data) • Duplicated logic that will diverge and cause bugs |
| Low      | Non-critical missing guard clause • Minor inefficiency with negligible impact • Type annotation gap on an internal-only function • Readability issue that slows onboarding |

## Category definitions
- security      — auth, input validation, secrets, XSS, injection
- performance   — algorithmic complexity, unnecessary re-renders, network waterfalls, DB queries
- reliability   — error handling, retries, graceful degradation, resource cleanup
- maintainability — duplication, coupling, unclear abstractions, dead code
- type-safety   — unsafe casts, missing generics, implicit any, non-null assertions
- accessibility — missing ARIA, keyboard navigation, colour contrast

## Effort definitions
- XS (<1h)        — single line or trivial guard clause
- S (1-2h)        — one function rewrite or adding error handling
- M (half day)    — refactor a module or add validation layer
- L (1-2 days)    — architectural change, multiple files
- XL (>2 days)    — cross-cutting concern, major refactor

## JSON schema (return an array of these)
{
  "summary": "Specific, actionable title — name the function/component and the issue. Max 200 chars.",
  "priority": "High|Medium|Low",
  "priority_rationale": "One sentence citing the rubric criterion that drove this score.",
  "category": "security|performance|reliability|maintainability|type-safety|accessibility",
  "problem": "Precise description of what is wrong and where — include approximate line numbers or function names.",
  "why_it_matters": "The concrete consequence of leaving this unfixed (e.g. 'A malformed input will cause a NaN to be stored in the DB').",
  "effort_estimate": "XS (<1h)|S (1-2h)|M (half day)|L (1-2 days)|XL (>2 days)",
  "current_code": "The problematic snippet extracted verbatim from the file.",
  "suggested_fix": "The corrected version of the same snippet."
}`;

                summary_.apiCallsMade++;
                let tasks: ImprovementTask[];

                try {
                    const promptBody =
                        `File content:\n\`\`\`typescript\n${fileContent}\n\`\`\`\n\n` + prompt;
                    const raw = await runCursorPrompt(apiKey, modelId, promptBody);
                    const codeMatch = raw.match(/```(?:json)?\r?\n([\s\S]*?)```/);
                    const cleanJson = codeMatch ? codeMatch[1].trim() : raw.trim();
                    tasks = JSON.parse(cleanJson);
                } catch (e: unknown) {
                    const msg = `Cursor agent call failed for ${relPath}: ${e instanceof Error ? e.message : String(e)}`;
                    console.error(`   ❌ ${msg}`);
                    summary_.errors.push(msg);
                    return;
                }

                if (!Array.isArray(tasks) || tasks.length === 0) {
                    console.log(`   ✓ No actionable improvements found.`);
                    return;
                }

                console.log(`   Found ${tasks.length} improvement(s).`);

                for (const task of tasks) {
                    const key = await createTaskIssue(jira, task, relPath, summary_);
                    if (key) {
                        console.log(`   ✅ Task ${key} [${task.priority}/${task.category}/${task.effort_estimate}]: ${task.summary.slice(0, 55)}...`);
                        summary_.tasksCreated++;
                    }
                }
            }),
        ),
    );
}

// =============================================================================
// 📊 Run Summary
// =============================================================================
//
// Printed at the end of every run. Shows totals for:
//   • Files analyzed, Bugs/Tasks created vs deduplicated
//   • Total Cursor agent prompts (useful for operational visibility)
//   • Any errors that occurred during the run
//   • A DRY RUN reminder if applicable
// =============================================================================

function printSummary(summary_: RunSummary): void {
    console.log('\n─────────────────────────────────────────');
    console.log('Summary:');
    console.log(`  Files analyzed     : ${summary_.filesAnalyzed}`);
    console.log(`  Bugs created       : ${summary_.bugsCreated}`);
    console.log(`  Bugs deduplicated  : ${summary_.bugsDeduplicated}`);
    console.log(`  Tasks created      : ${summary_.tasksCreated}`);
    console.log(`  Tasks deduplicated : ${summary_.tasksDeduplicated}`);
    console.log(`  Agent prompts made : ${summary_.apiCallsMade}`);

    if (summary_.errors.length > 0) {
        console.log(`  Errors (${summary_.errors.length}):`);
        summary_.errors.forEach((e) => console.log(`    • ${e}`));
    }

    if (DRY_RUN) {
        console.log('  ⚠️  DRY RUN — no Jira tickets were created.');
    }
}

// =============================================================================
// 🎬 main() — Entry Point & Orchestrator
// =============================================================================
//
// Validates CURSOR_API_KEY + Jira credentials, initializes the Jira client + RunSummary,
// then runs Phase 1 → Phase 2 via the Cursor SDK local agent (`Agent.prompt`).
//
// Usage:
//   npx ts-node scripts/analyze-codebase.ts [--dry-run] [--diff-only]
//   npm run analyze                        (full scan)
//   npm run analyze -- --dry-run           (preview, no Jira tickets)
//   npm run analyze -- --diff-only         (only changed files)
// =============================================================================

async function main(): Promise<void> {
    if (!CURSOR_API_KEY || !JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
        console.error(
            'Missing required env vars: CURSOR_API_KEY, JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY',
        );
        process.exit(1);
    }

    if (DRY_RUN) console.log('⚠️  Running in DRY RUN mode — no Jira tickets will be created.');
    if (DIFF_ONLY) console.log('📂 Running in DIFF-ONLY mode — analyzing changed files only.');

    // ── Initialize Jira client ────────────────────────────────────────────────
    const jira = new Version3Client({
        host: JIRA_HOST.startsWith('http') ? JIRA_HOST : `https://${JIRA_HOST}`,
        authentication: {
            basic: { email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN },
        },
    });

    // ── Shared run statistics ─────────────────────────────────────────────────
    const summary_: RunSummary = {
        filesAnalyzed: 0,
        bugsCreated: 0,
        bugsDeduplicated: 0,
        tasksCreated: 0,
        tasksDeduplicated: 0,
        apiCallsMade: 0,
        errors: [],
    };

    // ── Run both phases sequentially ──────────────────────────────────────────
    await runJestAndFindBugs(CURSOR_API_KEY, CURSOR_MODEL, jira, summary_);
    await analyzeCodebaseImprovements(CURSOR_API_KEY, CURSOR_MODEL, jira, summary_);

    printSummary(summary_);
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});