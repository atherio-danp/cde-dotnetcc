# {{ProductName}}

> **TEMPLATE — fill in `{{ProductName}}` and this intro for your product.** This repo is a
> reusable Claude Code + .NET harness: Next.js (App Router) frontend + .NET 10 Web API backend,
> with an optional agentic pipeline on the Microsoft Agent Framework (MAF). Vision and full spec:
> `docs/product-overview.md` (also a template — fill it in).

> **Status: harness / governance only — no product code yet.** This repo holds the project
> standards and the Claude Code setup (rules, skills, agents, workflows, hooks). The `apps/web`
> (Next.js) and `apps/api` (.NET) trees are **not yet scaffolded** — governance files at
> `apps/api/` sit ready for when they are. After copying the harness into a new repo, find/replace
> `{{ProjectName}}` (namespaces / solution name) and `{{ProductName}}` (product identity) before
> building, and fill in the product docs.

## Ways of working

How we collaborate. These govern every action — follow them by default, every session.

**Decisions are Dan's.**
- **Never assume or decide on Dan's behalf.** When a decision is needed or anything is
  ambiguous, STOP and ask — present concrete options with a recommendation, don't pick silently.
- Don't proceed past a fork in scope or approach without explicit confirmation.
- When Dan pushes back, treat it as signal — re-examine, don't get defensive.
- **Lead with the product vision, not the tech.** When planning or grilling an idea, the
  "why / who / moat" comes first; the stack is the substrate, not the headline.

**Git & irreversible actions — ask first, every time.**
- **Never `git commit`, `push`, `amend`, switch branches, or open a PR unless Dan explicitly
  asks** — per action. Approval for one (e.g. "commit") never implies another (e.g. "push").
- Never force-push or rewrite shared history.
- Never delete or overwrite a file you didn't create without flagging it first.

**Stay in scope.**
- Do only what was asked. No "while I'm here" edits, no unrequested refactors.
- Don't over-engineer: no speculative abstractions or defensive code for cases that can't happen.
- Match existing patterns.
- **No third-party library without Dan's explicit, per-library approval.** Never introduce, assume,
  or default to a NuGet/npm package — prefer the BCL/framework or a minimal hand-rolled solution.
  Library adoption is Dan's call, never an agent's or a skill's; approval for one package never
  implies another. When something seems to need a library, STOP and propose it (with a no-library
  alternative) rather than adding it.

**Be honest and verify.**
- Evidence over assertion: show the command/test output; never claim success without verifying.
- No "probably" / "should work" — verify it, or label it explicitly as unverified.
- Use first-party/authoritative sources, quote them, and flag uncertainty.
- Report failures plainly: failed tests, skipped steps, dead ends.
- **Source-of-truth authority hierarchy — when sources conflict, the higher rung wins, ALWAYS:**
  1. **Code** — the running source is ground truth. Read it line-by-line; cite `file:line`. Never assert behaviour you haven't read.
  2. **Database / SQL data** — actual rows + schema over what code or docs *say* they are (query it; don't speculate on data state).
  3. **Telemetry** — observed runtime behaviour over described behaviour.
  4. **Documentation** (docs/, CLAUDE.md, rules, skills, memories) — a *lead to verify*, never an authority; may be stale. If docs and code disagree, the **code wins** — note the drift.
  5. **AI output** (other agents' or your own earlier output) — lowest; re-derive from a higher rung before trusting it.
- Make no claim you can't cite to a rung 1–3 source. If you can't verify, say "unverified" / "I don't know" — never fabricate.

**Safety.**
- Never read into context, or commit, secrets / `.env` / credentials.
- Never disable or skip tests, linters, or analyzers to make something pass — fix the root cause.
- No destructive shell (`rm -rf`, `git reset --hard`, …) without explicit confirmation.

**Workflow.**
- For non-trivial or multi-file changes, plan first and get the plan approved before coding. Write the plan
  to `docs/plans/<topic>.md` in the house format (`docs/projectStandards/implementation-plan-format.md`):
  locked decisions, an ordered checklist ending in a Validate gate, full code samples, an exact named-test
  list, OPEN QUESTIONS, and status banners with exact build/test counts.
- To build an approved plan, run `/run-impl-loop <plan>` — the main agent drives analyze → implement →
  validate → test → architect-review → triage → fix → summary, delegating the mechanical stages to the
  `impl-build` and `architect-review` workflows (see the `run-impl-loop` skill).
- Keep changes small and reviewable.

## Tooling — MCP servers & docs (non-negotiable)

Hard rules, not suggestions. They override default tool habits.

**Serena MCP — for all C# (`.cs`) work.** Use Serena for navigating, reading, searching,
editing, **and creating** `.cs` files — never the native Read/Grep/Edit/Write on them. A
`PreToolUse` hook (`.claude/hooks/enforce-serena.ps1`) **blocks native Edit/Write/MultiEdit
on `.cs`**, so C# edits/creates must go through Serena. The **TypeScript/React frontend
(`apps/web`) is intentionally left to the native tools** — Serena's C# Roslyn LSP is the
proven path here; flip the hook's `$blocked` list if you later want Serena to own the
frontend too. Use the right Serena tool for the job:
- **Read & navigate** (prefer symbols over whole files): `get_symbols_overview`,
  `find_symbol`, `find_referencing_symbols`, `search_for_pattern`, `list_dir`, `find_file`.
- **Edit:** `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol` for `.cs`
  symbols; `replace_regex` for fine-grained or non-symbol edits.
- **Create or overwrite a file:** `create_text_file`.
- **Durable project notes:** `write_memory` / `read_memory` / `list_memories`.
- Configured in `.mcp.json` (stdio, `--context claude-code`, `--project-from-cwd`). Run
  Serena's onboarding once on first connect.

**Microsoft Learn MCP — for any Microsoft technology, every time.** Whenever you need
information about .NET 10 / C# 14, MSBuild/analyzers, ASP.NET Core, the **Microsoft Agent
Framework (MAF)**, `Microsoft.Extensions.AI`, or any Microsoft platform/API, query the
Microsoft Learn MCP (`microsoft_docs_search` → `microsoft_docs_fetch`,
`microsoft_code_sample_search`) and quote it. This stack post-dates the training cutoff —
do not rely on memory for it. (Enabled as a plugin in `.claude/settings.json`.)

**Frontend (Next.js / React) — prefer first-party docs.** Next.js App Router and React
move fast and post-date the cutoff. For routing, server components, SSE/streaming, and
data-fetching idioms, prefer `nextjs.org` / `react.dev` over memory; flag uncertainty.

**Claude / Anthropic API work — use the `claude-api` skill.** For model ids, pricing,
streaming, tool use, MCP, or anything Anthropic-SDK, consult the skill rather than memory.

## Where things live

```
{{ProjectName}}/
├─ apps/
│  ├─ web/        Next.js App Router — UI + thin BFF (proxies API, relays SSE)   [not scaffolded]
│  └─ api/        .NET 10 Web API — domain, pipeline, model router, governance    [not scaffolded]
│     ├─ Directory.Build.props      strict analyzer baseline for every .NET project
│     ├─ Directory.Packages.props   Central Package Management (versions pinned once)
│     ├─ .editorconfig              the C# standard (layers under the repo-root one)
│     ├─ src/  tests/               (created at scaffold time)
├─ docs/
│  ├─ product-overview.md           the vision / domain model / roadmap / tech stack (template)
│  └─ projectStandards/             coding-standards · build-configuration · frontend-standards · backend-architecture
├─ .editorconfig                    root=true; shared cross-stack formatting only
├─ .gitattributes  .gitignore       LF normalization · ignores
└─ .claude/                         settings.json · hooks/ · rules/ (auto-load by path)
```

- C# coding standard (auto-loads when editing `.cs`): `docs/projectStandards/coding-standards.md`
- Build config & monorepo-layout rationale: `docs/projectStandards/build-configuration.md`
- Frontend (TS/React) standard: `docs/projectStandards/frontend-standards.md`
- **Backend architecture decisions** (layering · feature folders · CQRS/Kommand · EF Core + Npgsql
  persistence · `Result<T>` · validation scopes): `docs/projectStandards/backend-architecture.md`.
  Enforceable distillations auto-load from `.claude/rules/backend/` (+ the `cqrs-kommand` skill).
- Product vision, domain model, roadmap, tech stack: `docs/product-overview.md`

## Design non-negotiables (backend)

Full detail in `coding-standards.md` (auto-loads when editing C#); these apply at design time too:
- **Rich mutable DDD entities — never records** (records only for value objects / parse DTOs).
- **No primary constructors.**
- **Async discipline:** no `.Result`/`.Wait()`, no `async void`, `CancellationToken` throughout.
- **Tenancy is a first-class invariant:** `tenant_id` everywhere (harness default — drop for a
  single-tenant product); enforce any data-residency constraint your product requires.

## Build

- **Strict .NET build:** warnings = errors, `AnalysisMode=All` + Meziantou + SonarAnalyzer;
  `dotnet format` autofixes formatting. **Caveat — `dotnet build` and `dotnet format` do NOT enforce all
  Roslyn IDE analyzers: notably IDE naming rules like `IDE1006` (the `Async`-suffix rule). A `.cs` file can
  build `0/0` yet still violate them.** The reliable catcher is the Roslyn LSP via Serena: after any `.cs`
  change run **`mcp__serena__get_diagnostics_for_file`** (`min_severity: 2`) on the touched files. **The
  complete `.cs` verification gate = `dotnet build` (warnings-as-errors) + Serena `get_diagnostics_for_file`**
  (details + rationale in `docs/projectStandards/coding-standards.md`).
- **Frontend:** ESLint + Prettier + strict `tsconfig` own TS/React quality (configured at
  scaffold time — see `frontend-standards.md`).
