---
name: run-impl-loop
description: Drive the full implementation loop for an approved plan — analyze, implement, validate, test, architect-review, triage, fix, summarize. Use when Dan says to build / run an approved implementation plan from docs/plans.
argument-hint: <path-to-approved-plan.md> [scope: backend|frontend|fullstack]
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash, mcp__serena__find_symbol, mcp__serena__get_symbols_overview, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, Workflow, Task, Agent
---

# Run the implementation loop

**YOU (the main agent) drive this loop and OWN the judgment steps**; the mechanical fan-out runs in saved
workflows. This is the hybrid operating model: the main agent keeps the judgment steps (1, 5, 7, 9) and
calls saved workflows for the mechanical stages (steps 2–4, 6, 8). Plan format:
`docs/projectStandards/implementation-plan-format.md`.

`$ARGUMENTS` = the path to an **approved** plan in `docs/plans/`, optionally a scope hint. Do the steps in
order. **Do not skip or delegate the judgment steps (1, 5, 7, 9) — they are yours, not a subagent's.**

## 1. Analyze (you)
- Read the plan FULLY.
- Cross-check that **every symbol it references actually exists** with the stated signature (Serena
  `find_symbol` / `search_for_pattern` for `.cs`). List every inconsistency.
- If there are inconsistencies or unresolved OPEN QUESTIONS, **STOP** — fix the plan or surface the gaps to
  Dan before building. Never implement against a broken plan.
- Determine the **scope** (backend / frontend / fullstack) from the files the plan touches.

## 2–4. Implement → validate → test (workflow)
Run the **`impl-build`** workflow:
`Workflow({ name: 'impl-build', args: { planPath: '<plan>', focus: 'the entire plan' } })`
It spawns the implementer, loops implement→validate until the validator passes (or the fix budget is
exhausted — if `exhaustedFixBudget`, STOP and report to Dan), then the testing-expert writes the plan's
exact test list.

- **If it returns `blocked: true`** — the implementer hit a **material divergence** (the plan's assumptions
  no longer hold: a locked decision invalidated, the approach broken, a new dependency needed). **STOP**:
  surface the `blocker` + `recommendedOptions` to Dan, get a decision, **update the plan**, then re-run. Never
  let a subagent improvise a large unplanned change — that decision is Dan's.

## 5. Evaluate tests + review deviations (you)
- Read the **`deviations`** list — everything the implementer did off-plan to reconcile with the real code
  (the plan goes stale; small adaptations are expected). Sanity-check each is sound and in the plan's spirit;
  if one is actually wrong or oversteps, treat it as a finding to fix.
- Read the `tests` result; if a test surfaced a real defect, re-run `impl-build` with `focus` = that defect.
- Confirm **exact** pass/fail/skip counts.

## 6. Architect review (workflow)
Run the **`architect-review`** workflow with the scope from step 1:
`Workflow({ name: 'architect-review', args: { scope: [...], changedPaths: '<changed files>', planPath: '<plan>' } })`
It runs the relevant reviewers in parallel (rule-adherence + bug hunt) and adversarially verifies each finding.
**Include `'security'` in scope for any backend change** — it runs the backend security auditor (OWASP Top 10,
tenant isolation, secret handling, EU data residency).

## 7. Triage (you)
Take the returned findings and analyze them **ONE BY ONE, reading the actual code line by line**. Keep only
the ones that genuinely add up; discard noise (even some marked `real` — the verdicts are a pre-filter, the
decision is yours). Produce the precise list of findings to fix.

## 8. Fix (workflow)
If any findings add up, run `impl-build` again with `focus` = a precise description of those findings
(implement→validate→test loop). Repeat 7–8 if the fixes warrant another review.

## 9. Summary (you)
Present Dan a concise summary: what was implemented, **what was done off-plan and why** (the deviations —
call these out clearly, never bury them), validation status, **exact** test counts, findings triaged (kept
vs discarded, one-line reasons), and what was fixed. **Do not commit or push** — git is ask-gated and happens
only on Dan's explicit word.
