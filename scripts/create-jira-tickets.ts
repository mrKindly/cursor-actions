// =============================================================================
// 🎫 create-jira-ticket.ts — AI-Powered Jira Ticket Creator
// =============================================================================
//
// FLOW:
//   ① Ask user for a short feature/task description (stdin)
//   ② Call Cursor agent to generate a detailed description + acceptance criteria
//   ③ Print the result and ask for approval
//   ④ If approved → create the Jira ticket via Jira REST API
//
// Run:  npx tsx scripts/create-jira-ticket.ts
// =============================================================================

import { Agent, CursorAgentError } from '@cursor/sdk';
import { Version3Client }           from 'jira.js';
import * as dotenv                  from 'dotenv';
import * as readline                from 'readline';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────

const {
    CURSOR_API_KEY,
    CURSOR_MODEL,
    JIRA_HOST,
    JIRA_EMAIL,
    JIRA_API_TOKEN,
    JIRA_PROJECT_KEY,
} = process.env;

const MODEL = CURSOR_MODEL ?? 'composer-2';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Prompt the user for a line of input and return the trimmed answer. */
function ask(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

/** Call the Cursor agent and return the raw text reply. */
async function callAgent(prompt: string): Promise<string> {
    if (!CURSOR_API_KEY) throw new Error('CURSOR_API_KEY is not set in .env');

    try {
        const result = await Agent.prompt(
            'Reply with only the requested content. Do not edit files or run commands.\n\n' + prompt,
            {
                apiKey: CURSOR_API_KEY,
                model: { id: MODEL },
                local: { cwd: process.cwd(), settingSources: [] },
            },
        );
        if (result.status !== 'finished') {
            throw new Error(`Agent ended with status "${result.status}"`);
        }
        return result.result ?? '';
    } catch (err) {
        if (err instanceof CursorAgentError) {
            throw new Error(`Cursor SDK error: ${err.message}`, { cause: err });
        }
        throw err;
    }
}

/** Parse the agent reply into { summary, description, acceptanceCriteria }. */
function parseAgentReply(raw: string): { summary: string; description: string; acceptanceCriteria: string } {
    // Strip optional markdown fences
    const text = raw.replace(/^```[\w]*\n?/gm, '').replace(/^```$/gm, '').trim();

    const summaryMatch      = text.match(/##\s*Summary\s*\n([\s\S]*?)(?=\n##|$)/i);
    const descMatch         = text.match(/##\s*Description\s*\n([\s\S]*?)(?=\n##|$)/i);
    const acMatch           = text.match(/##\s*Acceptance Criteria\s*\n([\s\S]*?)(?=\n##|$)/i);

    return {
        summary:             (summaryMatch?.[1] ?? '').trim(),
        description:         (descMatch?.[1] ?? '').trim(),
        acceptanceCriteria:  (acMatch?.[1] ?? '').trim(),
    };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log('\n🎫  Jira Ticket Creator\n');

    // ── ① Ask for input ───────────────────────────────────────────────────────
    const userInput = await ask('Describe your task or feature (one sentence is fine):\n> ');
    if (!userInput) {
        console.error('No input provided. Exiting.');
        process.exit(1);
    }

    // ── ② Generate content via Cursor agent ──────────────────────────────────
    console.log('\n⏳  Generating ticket content with AI...\n');

    const prompt =
        `You are a senior product engineer writing a Jira ticket.\n\n` +
        `User input: "${userInput}"\n\n` +
        `Produce a well-structured ticket using EXACTLY this format:\n\n` +
        `## Summary\n` +
        `<one-line ticket title>\n\n` +
        `## Description\n` +
        `<3-6 sentences explaining the problem, context and expected outcome>\n\n` +
        `## Acceptance Criteria\n` +
        `- [ ] <criterion 1>\n` +
        `- [ ] <criterion 2>\n` +
        `- [ ] <criterion 3>\n` +
        `(add more as needed)\n\n` +
        `Be concrete and technical. Do not add any other sections.`;

    const raw = await callAgent(prompt);
    const ticket = parseAgentReply(raw);

    if (!ticket.summary) {
        // Fallback: print the raw reply so the user can see what happened
        console.log('--- Agent reply (could not parse structured output) ---');
        console.log(raw);
        console.error('\nCould not parse ticket content. Exiting.');
        process.exit(1);
    }

    // ── ③ Show draft and ask for approval ─────────────────────────────────────
    console.log('─'.repeat(60));
    console.log(`📋  DRAFT TICKET\n`);
    console.log(`Summary:\n  ${ticket.summary}\n`);
    console.log(`Description:\n${ticket.description}\n`);
    console.log(`Acceptance Criteria:\n${ticket.acceptanceCriteria}`);
    console.log('─'.repeat(60));

    const approval = await ask('\nCreate this ticket in Jira? [y/N] ');
    if (!['y', 'yes'].includes(approval.toLowerCase())) {
        console.log('\nAborted. No ticket was created.');
        return;
    }

    // ── ④ Create Jira ticket ──────────────────────────────────────────────────
    if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
        console.error(
            '\n❌  Jira credentials not configured.\n' +
            '    Set JIRA_HOST, JIRA_EMAIL, JIRA_API_TOKEN and JIRA_PROJECT_KEY in .env'
        );
        process.exit(1);
    }

    const jira = new Version3Client({
        host: JIRA_HOST.startsWith('http') ? JIRA_HOST : `https://${JIRA_HOST}`,
        authentication: { basic: { email: JIRA_EMAIL, apiToken: JIRA_API_TOKEN } },
    });

    console.log('\n🚀  Creating Jira ticket...');

    const fullDescription = `${ticket.description}\n\n**Acceptance Criteria**\n${ticket.acceptanceCriteria}`;

    const created = await jira.issues.createIssue({
        fields: {
            project:     { key: JIRA_PROJECT_KEY },
            issuetype:   { name: 'Story' },
            summary:     ticket.summary,
            description: {
                type:    'doc',
                version: 1,
                content: [
                    {
                        type:    'paragraph',
                        content: [{ type: 'text', text: fullDescription }],
                    },
                ],
            },
        },
    });

    console.log(`\n✅  Ticket created: ${JIRA_HOST.replace(/^https?:\/\//, 'https://')}/browse/${created.key}`);
}

main().catch((err) => {
    console.error('\n❌ Fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
