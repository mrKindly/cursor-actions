import { Agent, CursorAgentError } from '@cursor/sdk';
import * as dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.CURSOR_API_KEY?.trim();
if (!apiKey) {
    console.error('Set CURSOR_API_KEY in the environment or .env');
    process.exit(1);
}

const modelId = process.env.CURSOR_MODEL ?? 'composer-2';

const questions = [
    'In one sentence, what is TypeScript?',
    'List three useful Node.js built-in modules and what each is for.',
];

async function ask(question: string): Promise<string> {
    const run = await Agent.prompt(question, {
        apiKey,
        model: { id: modelId },
        local: { cwd: process.cwd(), settingSources: [] },
    });
    if (run.status !== 'finished') {
        throw new Error(`Agent run ended with status "${run.status}" (run id: ${run.id})`);
    }
    return run.result ?? '';
}

async function main() {
    for (const q of questions) {
        console.log('\n---');
        console.log('Q:', q);
        try {
            const answer = await ask(q);
            console.log('A:', answer.trim() || '(empty reply)');
        } catch (err) {
            if (err instanceof CursorAgentError) {
                console.error('SDK failed to start:', err.message, `(retryable: ${err.isRetryable})`);
                process.exit(1);
            }
            throw err;
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
