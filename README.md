# cde-dotnetcc: a Claude Code harness for .NET

A **reusable, opinionated Claude Code setup** for greenfield **.NET 10 + Next.js** products.
Copy it into a new repo, do a small find/replace, and you start day one with a coding agent that
already knows your architecture, follows your standards, and is **physically prevented** from doing
the things you never want it to do, instead of rediscovering all of that per project.

> **This repo is the harness itself** (governance + Claude Code config). There is **no product code
> yet**: `apps/api` (.NET) and `apps/web` (Next.js) are scaffolded *after* you copy it. Everything
> here is the operating system your future codebase runs inside.

---

## 1. Why this exists

Every new project re-litigates the same things: how do we layer the backend, where does validation
go, how do errors map to HTTP, what does the agent need permission for, how do we stop it committing
to `main` or editing C# without symbol awareness. This harness answers all of that **once**, as
config, so the answer travels with you.

Three beliefs shape it:

- **Standards are only real if they're encoded.** A convention in someone's head drifts. A convention
  in a rule, a skill, an analyzer, or a hook does not.
- **Influence and enforcement are different tools: use the right one.** Telling the agent what to do
  (CLAUDE.md, rules, skills) is *influence*: it usually complies. Making an action impossible (hooks,
  `permissions.deny`, a build that fails) is *enforcement*: it always holds. The dangerous mistakes go
  behind enforcement; everything else is influence.
- **Decisions are the owner's; evidence beats assertion.** The agent proposes, you decide. It cites
  code/SQL/telemetry rather than claiming. These are baked into `CLAUDE.md` and the reviewer agents.

If you internalize one thing from this README, make it the **influence ↔ enforcement** distinction:
it's the spine everything below hangs on.

---

## 2. The mental model: influence vs. enforcement

| Primitive | Role | Influence or enforcement? | Lives in |
|---|---|---|---|
| **`CLAUDE.md`** | Always-loaded project law (ways of working, tooling rules, design non-negotiables) | Influence (strong) | repo root |
| **Rules** (`.claude/rules/`) | Standards that auto-load *only when you touch matching files* | Influence (scoped) | path-scoped markdown |
| **Skills** (`.claude/skills/`) | On-demand procedures ("how to add an endpoint", "how to query telemetry") | Influence (just-in-time) | loaded when invoked |
| **Agents** (`.claude/agents/`) | Specialized sub-personas with their own context + locked-down tools | Influence (isolated) | spawned on demand |
| **Workflows** (`.claude/workflows/`) | Deterministic multi-agent orchestration scripts | Influence (scripted) | JS, run in background |
| **Hooks** (`.claude/hooks/`) | Code that runs on every matching tool call and can **deny/ask** | **Enforcement** | PowerShell, `settings.json` |
| **`permissions.deny`** | Hard tool/path blocks; beats every allow and every mode | **Enforcement** | `settings.json` |
| **Strict build** | Analyzers + style/naming + warnings-as-errors; violations **fail compilation** | **Enforcement** | `Directory.Build.props` · `Directory.Packages.props` · `.editorconfig` |

Rules of thumb the harness follows:
- *Want the agent to prefer X?* → a rule or skill.
- *Must the agent never do Y?* → a hook or `permissions.deny`.
- *Must the code never look like Z?* → an analyzer at `warning` (fails the build).

---

## 3. Using this harness (bootstrap)

### Prerequisites in your environment
- **.NET 10 SDK** and **Node 22 LTS** (for `apps/api` / `apps/web` once scaffolded).
- **PowerShell 7+ (`pwsh`)** on PATH: the three hooks are PowerShell scripts (works on Windows/macOS/Linux).
- **Serena MCP**: provides symbolic C# navigation/editing. Declared in `.mcp.json` (stdio, run via
  `uvx`/your Serena launcher); enabled through `enabledMcpjsonServers` in `.claude/settings.json`.
- **Microsoft Learn MCP**: ships as the **marketplace plugin** `microsoft-docs@microsoft-docs-marketplace`,
  enabled via `enabledPlugins` in `.claude/settings.json` (it is **not** in `.mcp.json`; plugins and
  `.mcp.json` servers are wired differently). Install the plugin once in your Claude Code environment;
  after that every repo copied from this harness gets it automatically.

### Steps
1. **Copy** this repo's contents into your new project repo (keep `.claude/`, `docs/`, the root
   `Directory.*.props`, `.editorconfig`, `.gitignore`, `.gitattributes`, `.mcp.json`, `CLAUDE.md`).
2. **Find/replace the two template tokens** across the whole tree:
   - `{{ProjectName}}` → your .NET solution/namespace root (e.g. `Contoso` → `Contoso.Domain`, `Contoso.Api`, `Contoso.sln`).
   - `{{ProductName}}` → your product's display name.
   These appear in docs, rule path-globs, skill templates, and agent prompts by design.
3. **Fill in the product docs**: `docs/product-overview.md` and `.claude/hooks/context/product-context.md`
   are TODO skeletons. The latter is injected into **every** session (see §4), so the agent always leads
   with *your* vision, not the tech.
4. **Decide the optional defaults** (see §8): multi-tenancy, the AI stack, data-residency posture.
5. **Scaffold the apps.** Create `apps/api` (the .NET solution, referencing the committed `Directory.*.props`
   + `.editorconfig`) and `apps/web` (Next.js). The governance is already waiting for them.
6. **Rewrite this README** for your product, or keep it as the harness reference.

---

## 4. What this harness actually enforces (the hard gates)

These are the *enforcement* layer: they hold regardless of what the agent "decides".

### Three hooks (`.claude/hooks/`, wired in `settings.json`)
- **`enforce-serena.ps1`**: `PreToolUse` on `Edit|Write|MultiEdit`. **Denies native edits to `.cs` files**
  and redirects the agent to the Serena MCP tools (symbol-aware navigation/editing via the C# Roslyn LSP).
  Everything else, including the TypeScript/React frontend, is left to native tools by design. *Fails open*
  (a hook bug never blocks you). To make Serena also own the frontend, add `.ts`/`.tsx` to the `$blocked` list.
- **`protect-commands.ps1`**: `PreToolUse` on `Bash|PowerShell`. The permission posture broadly **allows**
  safe work (builds, tests, reads, `git status`) so it runs silently; this hook is the gate that escalates
  destructive commands:
  - **DENY** (catastrophic): `rm -rf /` or `~`.
  - **ASK** (recoverable but destructive, forces a prompt): any file deletion (`rm`/`rmdir`/`Remove-Item`/`del`/`rd`/`erase`),
    `git push --force`, `git reset --hard`, `git clean -f`, **`git add`/`commit`/`push`** (git is confirm-per-action
    by governance), `dotnet ef database drop` / `migrations remove`, SQL `DROP`/`TRUNCATE`, and unqualified
    `DELETE`/`UPDATE` (no `WHERE`). *Fails open.*
- **`session-start-context.ps1`**: `SessionStart`. Injects `context/product-context.md` so every session
  starts grounded in the product vision. *Fails open.*

> The base permission mode is plain **default** (not `bypassPermissions`) on purpose: that's what lets a
> hook `ask`/`deny` reliably override the broad `allow` list.

### `permissions.deny` (`settings.json`)
Hard-blocks reading secrets: `.env`, `.env.*`, and `**/secrets/**`. `deny` beats every `allow` and every mode.

### The strict build: code quality enforced by compilation
This is as much an enforcement layer as the hooks: the build files + analyzers turn the coding standard into a
gate the agent (and you) **cannot merge past**. Applied to **every** .NET project under `apps/api`,
greenfield-strict from day one. Four pieces, each with a distinct job:

- **`Directory.Build.props`**: the compiler + analysis baseline, imported automatically into every project so
  the standard lives in exactly one place. Sets `Nullable=enable`, `AnalysisLevel=latest`, **`AnalysisMode=All`**
  (every built-in rule on), `EnforceCodeStyleInBuild=true` (style/`IDE*` rules run *at build*, not just in the
  IDE), and, the teeth, **`TreatWarningsAsErrors=true`** + `CodeAnalysisTreatWarningsAsErrors=true`. It also
  references the third-party analyzer packages.
- **`Directory.Packages.props`** (Central Package Management): every NuGet version (analyzers + test
  packages) pinned **once**; projects reference by name only. Stops version drift across the solution.
- **`.editorconfig`** (two layers): the **per-rule severity dial** and the formatting/naming law. The root file
  (`root=true`) holds shared cross-stack formatting; `apps/api/.editorconfig` layers the C# standard on top.
  Severity is what matters under warnings-as-errors: a rule at **`warning` fails the build**; `suggestion`/`silent`
  are IDE-only hints. This is where you'd tune an individual rule (with a justification comment).
- **Three analyzer sets, all at full strength**: **built-in .NET analyzers** (`AnalysisMode=All`),
  **Meziantou.Analyzer** (performance + correctness), and **SonarAnalyzer.CSharp** (code smells + bug patterns).
  Together they catch far more than the compiler alone.

Consequences worth stating plainly:
- **Style, naming, and formatting violations are hard build errors**, by deliberate choice, not just bugs.
  `dotnet format` autofixes the entire formatting class in one command.
- Tuning is **maximal + reactive**: nothing is pre-disabled; you downgrade a *genuine* false positive only with a
  one-line justification comment in `.editorconfig`. The single standing exception is the "seal your classes"
  rules (`CA1852`, `MA0053`) → `suggestion`, because the domain model uses deliberate inheritance.

**Net effect:** the agent can't silently edit C# blind, can't delete files or touch git/the DB destructively
without you, can't read your secrets, and can't land code that violates the standard, none of which depends
on the agent "remembering" to behave.

---

## 5. What's in the box

### `CLAUDE.md`: the always-on law
Loaded into every session. Holds **Ways of working** (decisions are the owner's; ask-first on git/irreversible
actions; stay in scope; **no third-party library without explicit per-library approval**; evidence over
assertion with a strict source-of-truth hierarchy: code > SQL > telemetry > docs > AI output), the
**non-negotiable tooling rules** (Serena for C#, Microsoft Learn MCP for any MS tech, first-party docs for
Next.js), the **design non-negotiables**, and the **build** posture. Keep it short: detail lives in rules.

### Rules (`.claude/rules/`): scoped standards, auto-loaded by path
The distilled, enforceable standards. Backend rules are **path-scoped**: each loads only when you touch its
layer, so context stays lean. **Tenancy auto-loads across all of `apps/api`** because it's a cross-cutting invariant.

- **Backend (7):** `clean-architecture`, `domain-model`, `api-design`, `cqrs-kommand`, `persistence`,
  `result-and-errors`, `tenancy`.
- **Cross-stack (3):** `csharp-conventions`, `build-config`, `frontend-conventions`.

The full *rationale* behind these lives in `docs/projectStandards/` (see §9); the rules are the terse,
in-context law derived from it.

### Skills (`.claude/skills/`): on-demand procedures
Skills are step-by-step procedures that load only when invoked, so they cost nothing until needed. Rather than
list all ~20, here are the categories and what each is *for*:

| Category | Skills | Use when… |
|---|---|---|
| **Scaffold & author** (derived from the rules) | `add-endpoint`, `add-domain-entity`, `cqrs-kommand`, `result-pattern`, `validation-scopes`, `efcore-patterns` | You're writing a feature: a Minimal API endpoint, a domain entity, a command/query, a `Result<T>` flow, a validator, or EF Core persistence. They encode the *canonical shape* so new code matches the standard. |
| **Performance & quality** | `dotnet-performance-review`, `efcore-query-performance`, `microbenchmarking` | You're auditing hot paths, fixing slow/N+1 queries, or proving a perf change with BenchmarkDotNet. |
| **Diagnostics & ops** | `explain-codebase`, `query-postgres`, `query-telemetry`, `otel-instrumentation` | You need to understand existing code (grounded line-by-line), inspect real data/telemetry during an investigation, or add observability. |
| **AI & integration** | `dotnet-ai-stack`, `mcp-csharp` | You're wiring LLM calls / an agentic pipeline (`IChatClient` + MAF + pgvector) or building an MCP server in C#. |
| **Security & testing** | `security-backend`, `write-tests` | You're running an OWASP-mapped backend audit or writing the tests for a plan. |
| **Operating model & meta** | `run-impl-loop`, `onboard`, `push` | You're driving the plan→build→review loop (§7), getting oriented in a fresh checkout, or pushing the current branch. |

(Built-in Claude Code skills like `code-review`, `claude-api`, `deep-research`, and the `microsoft-docs:*`
plugin skills are also available; the harness adds the .NET-specific ones above on top.)

### Agents (`.claude/agents/`): specialized sub-personas
Each runs in its own context with a restricted toolset, so heavy or adversarial work doesn't pollute the main
thread. Three groups:
- **Read-only reviewers**: `architect-backend`, `architect-frontend`, `architect-fullstack`,
  `security-auditor-backend`. They load the rules and hunt for rule violations + real bugs; **they never edit**.
- **Read-only diagnosis**: `rca-investigator` (root-cause via code + SQL + telemetry).
- **Build-loop workers**: `implementer` (edits via Serena, builds), `validator` (structured pass/fail verdict),
  `testing-expert` (writes the plan's exact tests), `findings-verifier` (adversarially confirms a finding line-by-line).

### Workflows (`.claude/workflows/`): deterministic orchestration
JS scripts that fan out many agents with scripted control flow (loops, parallelism), running in the background:
- **`impl-build`**: implement → validate → fix (loop until clean) → write tests.
- **`architect-review`**: run the relevant reviewers in parallel, then adversarially verify each finding.
- **`docs-standards-sync`**: one agent per standards doc checks it against the real code/config and reports
  drift. **Propose-only**, never edits.

---

## 6. MCP servers & docs (non-negotiable tooling)
- **Serena** (`.mcp.json`): symbolic C# tooling. The `enforce-serena` hook makes it the **only** way to edit
  `.cs`, so the agent always works with symbol awareness instead of blind text edits.
- **Microsoft Learn** (marketplace plugin): the .NET 10 / C# 14 / ASP.NET Core / MAF / EF Core stack post-dates
  the model's training cutoff, so `CLAUDE.md` *requires* querying Microsoft Learn (not memory) for any Microsoft
  tech, and quoting it. Pre-allowed in `permissions` so it never prompts.
- **Next.js / React**: fast-moving and post-cutoff too; the rule is to prefer first-party `nextjs.org`/`react.dev`.

---

## 7. The operating model: how work actually gets done

For non-trivial or multi-file changes, the harness uses a **plan-then-orchestrated-loop**:

1. **Plan first.** Write a plan to `docs/plans/<topic>.md` in the house format
   (`docs/projectStandards/implementation-plan-format.md`): locked decisions, an ordered checklist ending in a
   Validate gate, full code samples, an exact named-test list, and OPEN QUESTIONS. Get it approved.
2. **Run it** with the `run-impl-loop` skill. The **main agent keeps the judgment steps** (analyze the plan,
   evaluate results, triage findings line-by-line, summarize) and delegates the **mechanical stages** to the
   `impl-build` and `architect-review` workflows.

This split is deliberate: the cheap, parallelizable work is scripted; the calls that need taste stay with the
agent you're talking to. Plans are **build-from-this contracts**, not sketches: that's what makes the loop reliable.

---

## 8. Configuring & customizing: the dials

Everything here is meant to be tuned per project. The common dials:

- **Multi-tenancy (default: ON).** `tenant_id` everywhere, fail-closed query filters, RLS. Encoded in the
  `tenancy` rule (auto-loads across `apps/api`), the security checks, and the examples. **Single-tenant project?**
  Delete `tenancy.md`, drop the tenancy line in `CLAUDE.md`, and ignore the `tenant_id` examples.
- **The AI stack (default: present, vendor-neutral).** The harness keeps the .NET AI approach (MEAI `IChatClient`
  seam, Microsoft Agent Framework, pgvector, MCP) but names **no specific vendor**: pick your LLM provider, OIDC
  provider, host, and object storage at scaffold time. Not building anything AI? The `dotnet-ai-stack`/`mcp-csharp`
  skills simply never load.
- **Data residency (default: example constraint).** Referenced as an *optional* concern ("if your product requires
  it") in the security/frontend checks, not a hard law. Make it a real requirement or drop it.
- **Analyzer strictness.** Tune individual rules in `apps/api/.editorconfig` with a justification comment. The one
  dial to reach for first if formatting-as-error gets in the way: flip `IDE0055` to `suggestion`.
- **Serena's scope.** Add `.ts`/`.tsx` to the `enforce-serena` `$blocked` list to route the frontend through
  Serena too.
- **Permission posture.** Broad `allow` + a destructive-command `ask`/`deny` hook + secret `deny` lives in
  `settings.json`. Tighten or loosen the allow list there; per-user local overrides go in `settings.local.json`
  (gitignored).
- **Adding governance.** New always-true fact → `CLAUDE.md`. New scoped standard → a path-scoped rule. New
  repeatable procedure → a skill. New must-never action → a hook or `permissions.deny`.

---

## 9. Where things live

```
<your-repo>/
├─ apps/
│  ├─ web/        Next.js App Router: UI + thin BFF (relays SSE)         [you scaffold]
│  └─ api/        .NET 10 Web API: domain, pipeline, governance          [you scaffold]
│     ├─ Directory.Build.props      strict analyzer baseline (committed here at root for now)
│     ├─ Directory.Packages.props   Central Package Management
│     └─ .editorconfig              the C# standard (layers under the root one)
├─ docs/
│  ├─ product-overview.md           your vision / domain / roadmap          (TEMPLATE: fill in)
│  ├─ plans/                        approved implementation plans
│  └─ projectStandards/             the rationale behind the rules:
│     ├─ coding-standards.md          C# style + type conventions
│     ├─ backend-architecture.md      layering · CQRS/Kommand · EF Core/Npgsql · Result<T> · validation · tenancy
│     ├─ build-configuration.md       monorepo layout + why the build files sit where they do
│     ├─ frontend-standards.md        TS/React/Next.js standard
│     └─ implementation-plan-format.md the house plan format
├─ .claude/
│  ├─ settings.json                 permissions · hooks · enabled plugins/MCP  (committed)
│  ├─ settings.local.json           per-user overrides                          (gitignored)
│  ├─ hooks/                        enforce-serena · protect-commands · session-start-context (+ context/)
│  ├─ rules/                        path-scoped standards (backend/ + cross-stack)
│  ├─ skills/                       on-demand procedures (see §5)
│  ├─ agents/                       reviewers · diagnosis · build-loop workers
│  └─ workflows/                    impl-build · architect-review · docs-standards-sync
├─ .mcp.json                        Serena (stdio MCP server)
├─ .editorconfig                    root=true; shared cross-stack formatting
├─ CLAUDE.md                        always-on project law
└─ .gitignore · .gitattributes      ignores · LF normalization (.cs → CRLF)
```

> **`{{ProjectName}}` / `{{ProductName}}` are template tokens**: a fresh copy won't compile or scope rules
> correctly until you find/replace them (§3, step 2).

---

## 10. The non-negotiables, in one breath
Rich mutable DDD entities (never records for entities) · no primary constructors · async discipline
(`CancellationToken` everywhere, no `.Result`/`.Wait()`) · tenancy as a first-class invariant (when enabled) ·
`Result<T>` for expected failures + RFC 9457 ProblemDetails at the edge · three validation scopes · no library
without explicit approval · Serena for all C# · Microsoft Learn for all MS tech · decisions are the owner's.
