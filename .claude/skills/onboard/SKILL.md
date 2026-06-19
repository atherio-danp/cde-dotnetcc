---
name: onboard
description: Produce a structured "get up to speed on this whole project" orientation — vision, architecture, where things live, conventions, how to do common tasks, current state — grounded in the real code/config with pointers. Optionally writes/updates docs/ONBOARDING.md. Use when asked to onboard, give a project overview, or "how does this project work / where do I start". Read-only except the optional doc write.
argument-hint: [--write to also produce docs/ONBOARDING.md]
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, Skill, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file
---

> **Serena MCP is mandatory for code (read-only here).** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use Serena for ALL code reading / searching / navigation — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads.

# Onboard to the project

Produce a coherent orientation to the WHOLE project, grounded in the real files. **Obey the source-of-truth
authority hierarchy in `CLAUDE.md`** (code → SQL → telemetry → docs → AI output) — verify against the code,
treat docs as leads. **Documentarian, not critic** (describe what exists; don't critique/fix unless asked).

## Method
1. **Reconnaissance via Glob/Grep — NOT Read-everything.** Detect manifests (`*.csproj`, `package.json`, …),
   framework/config, entry points, the top 2 levels of the tree (exclude `node_modules`/`bin`/`obj`/`.next`/`.git`),
   tooling (lint/format/CI/Docker), test layout, and the `.claude/` governance (rules, skills, agents, hooks, workflows).
2. **Vision first.** Lead with the product context (`docs/product-overview.md` + the injected product-context):
   the why / who / moat — per "lead with the product vision, not the tech".
3. **Architecture map.** Stack, layout (monorepo `apps/web` + `apps/api`), layers + dependency direction, API
   style, key directories' purpose, and **one traced request lifecycle** (reuse `explain-codebase` on a
   representative path).
4. **Conventions from the code itself** — naming, error handling (`Result<T>` / ProblemDetails), async discipline,
   tenancy. Verify against the rules but confirm in code: *if config says X but the code does Y, trust the code.*
5. **Rank, don't dump.** Surface the most-referenced / central files and the authoritative rules/skills — not an
   exhaustive listing.
6. **Common tasks — verified, not assumed.** The real build/test/run commands (from docs/config), and the operating
   model: write a plan (`implementation-plan-format.md`) → `/run-impl-loop`; add an endpoint (`add-endpoint` skill),
   a domain entity (`add-domain-entity`), a command/query (`cqrs-kommand`), tests (`write-tests`).
7. **"Where to look" map.** Table: goal → location (incl. the rules/skills/agents that govern that area).
8. **Flag unknowns / drift** explicitly — never guess; if doc↔code drift is obvious, note it (and suggest `/docs-standards-sync`).
9. **Optional artifact (`--write`):** write/refresh `docs/ONBOARDING.md`. If it (or `CLAUDE.md`) already exists,
   **read it first, enhance, preserve existing instructions, and call out exactly what changed** — never
   blind-overwrite. Keep it tight.

## Output
A skimmable orientation in that order (vision → architecture → conventions → key files → common tasks →
where-to-look → open questions), citing real files. Optionally the `docs/ONBOARDING.md` artifact.

> **Pre-scaffold note:** until product code exists, onboarding centers on the **vision + the governance layer**
> (the rules/skills/agents/workflows/hooks + the operating model). Onboard to *that*, grounded in the actual files.
