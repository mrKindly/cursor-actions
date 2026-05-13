# 🚀 Cursor SDK Demo — Live Walkthrough

**What we're building:** A new loyalty discount API endpoint for the WanderSync travel app  
**What we're showing:** How AI automates the entire dev workflow — from ticket to merged PR

---

## Step 1 — Verify the SDK works

> Run `simple-example.ts` — call an AI agent directly from the terminal and see it respond.

**Script:** `scripts/simple-example.ts`  
**Run:** `npx tsx scripts/simple-example.ts`

---

## Step 2 — Create a Jira ticket

> Create ticket **WS-42**: *"Add POST /api/trips/discount endpoint for loyalty member pricing"*  
> With acceptance criteria that include: auto-generated docs, tests, and code review.

---

## Step 3 — Implement the feature

> Create branch `feature/WS-42-discount-endpoint`  
> Write `src/app/api/trips/discount/route.ts` with Swagger JSDoc and feature flag guard  
> Stage and commit the new file

---

## Step 4 — Watch the pre-commit hook auto-update docs 🪝

> The moment we `git commit`, the pre-commit hook fires `update-docs.ts`  
> AI detects the new endpoint + env var → updates **README.md** + **Swagger spec** automatically  
> Changes are auto-staged and included in the commit — zero manual work

**Script:** `scripts/update-docs.ts`  
**Trigger:** `git commit` → `.githooks/pre-commit`  
**Pipeline:** regex pre-screen → Jira context fetch → triage pass → rewrite pass → write files

---

## Step 5 — Run codebase analysis & auto-file Jira tasks 🔍

> Run `analyze-codebase.ts` against our new files  
> AI reviews the code and files structured **Jira Task tickets** with: problem description, suggested fix, effort estimate, and ADF-formatted description  
> First run it in `--dry-run` mode, then for real

**Script:** `scripts/analyze-codebase.ts`  
**Run:** `npm run analyze -- --dry-run --diff-only`  
**What Jira gets:** Auto-filed Task tickets labeled `ai-generated`, `ci-automated`

---

## Step 6 — Open the Pull Request

> Push branch and create PR titled: **"WS-42: Add POST /api/trips/discount endpoint for loyalty pricing"**  
> PR title must contain the Jira ID — scripts use it to fetch ticket context automatically

```bash
git push origin feature/WS-42-discount-endpoint
gh pr create --title "WS-42: ..." --base develop
```

---

## Step 7 — GitHub Actions runs AI code review + test generation 🤖

### 7a — Automated Code Review (`code-review.yaml`)

> `cursor-agent` CLI reads the PR diff and posts **inline review comments** directly on the PR  
> Up to 10 comments anchored to exact changed lines — 🚨 Critical, 🔒 Security, ⚠️ Logic, ✅ Resolved

**Trigger:** PR opened → GitHub Actions  
**Result:** Inline comments appear on the PR within ~60 seconds

---

### 7b — Automatic Test Generation (`generate-tests.ts`)

> AI reads: Jira ticket WS-42 (intent) + PR diff (what changed) + existing tests (style guide)  
> Generates a complete Jest test suite covering all acceptance criteria  
> Writes tests to disk → commit → tests pass → PR is green ✅

**Script:** `scripts/generate-tests.ts`  
**Run:** `npm run generate-tests -- <pr_number>`  
**Result:** `src/app/api/trips/discount/__tests__/route.test.ts` — ready to commit

---

## 🎯 The Big Picture

```
Developer writes code
        ↓
  git commit ──────────────────────→ AI updates docs (pre-commit hook)
        ↓
  git push + PR open ──────────────→ AI reviews code (GitHub Actions)
                      └───────────→ AI generates tests (GitHub Actions)
                      └───────────→ AI files Jira tasks (analyze script)
        ↓
   Tests pass ✅  Docs updated ✅  Review done ✅  Board populated ✅
        ↓
      Merge
```

> **Each script = thin orchestrator.** It assembles rich context and calls `Agent.prompt()` with a structured output schema.  
> The agent does the thinking. The script does the wiring.
