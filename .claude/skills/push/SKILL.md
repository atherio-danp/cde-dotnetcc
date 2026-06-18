---
name: push
description: Stage, commit, and (optionally) push the current changes on the CURRENT branch, following project governance. Use ONLY when Dan explicitly asks to commit and/or push.
argument-hint: [commit message hint]
disable-model-invocation: true
allowed-tools: Read, Bash
---

# Commit / push (governed, branch-agnostic)

Per `CLAUDE.md`, git mutations happen **only when Dan explicitly asks, per action** — `git add` / `commit` /
`push` each trigger a confirmation prompt (the `protect-commands` hook). Approval for one step never implies another.

**No SDLC assumptions.** Work happens on whatever branch Dan is on. "Push" means **push the current branch to
its remote** — do NOT create branches, switch branches, open PRs, or assume any branching model or process.

## Procedure
1. **Inspect** — `git status`, `git diff`, `git log -5 --oneline` (match the existing commit style), and note the
   current branch (`git rev-parse --abbrev-ref HEAD`).
2. **Secrets check** — never stage `.env`, secrets, or credentials; confirm none are in the diff.
3. **Stage** what Dan asked for — prefer specific paths over `git add -A` unless told otherwise.
4. **Commit** — a clear subject + a body explaining the *why*; match the repo's format. End the message with:
   `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
   Never use `--no-verify` or skip hooks; never force-push or rewrite shared history.
5. **Push** — only if Dan explicitly asked: push the **current branch** to its tracked remote (`git push`). If it
   has no upstream, set it for the current branch (`git push -u origin <current-branch>`) — never switch to or
   create a different branch.

Report exactly what you staged, the commit SHA, the branch, and whether you pushed.
