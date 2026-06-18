---
name: explain-codebase
description: Explain how a specific area / file / feature / topic actually works — grounded line-by-line in the real code, with file:line citations. Use when asked to explain, trace, or understand a part of the code (e.g. "explain the model router", "how does the agentic pipeline work", "trace what CreateProject does"). Read-only; documentarian, not critic.
argument-hint: <area / file / feature / topic to explain>
allowed-tools: Read, Glob, Grep, Bash, Skill, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__list_dir, mcp__serena__find_file
---

# Explain the codebase (a specific area)

Explain how a part of the codebase **actually works** — grounded in the real code, never assumptions.
**Obey the source-of-truth authority hierarchy in `CLAUDE.md`** (code → SQL → telemetry → docs → AI output;
the higher rung wins). You are a **documentarian, not a critic**: describe what exists *today*. Do NOT propose
fixes, critique quality, hunt bugs, or do root-cause analysis **unless explicitly asked** — that's the
architects' / `rca-investigator`'s job.

`$ARGUMENTS` = the area / file / feature / topic to explain.

## Method
1. **Read the named inputs FULLY first.** If the request references files/symbols, Read them completely — no
   skim, no partial reads — before any search.
2. **Locate (cheap, broad).** Grep keywords + Glob patterns + Serena `find_symbol`/`search_for_pattern` to find
   the entry point(s) and the boundary of the area. Find WHERE before HOW; prefer targeted reads over broad scans.
3. **Trace the real execution path, line-by-line.** Follow the actual call chain — entry → validation → business
   logic → data/store → response — through imports, middleware, handlers, interceptors. **Read each file
   thoroughly before stating what it does.** Track data transformations, state changes, side effects, error handling.
4. **Cite everything as `file:line`** (or `file:start-end`). Every claim is anchored to code you actually read.
   **No claim without a citation.**
5. **Runtime questions → go up the rungs.** For "what does it actually do at runtime / with real data," consult
   the DB (`query-postgres`) or telemetry (`query-telemetry`) rather than inferring — and cite those.
6. **Docs are leads, not facts.** If a doc/rule says X but the code does Y, the **code wins** — explain the code
   and flag the drift.
7. **Flag gaps honestly.** Unresolved symbol, unclear path, dead code → say **"unverified"** — never fill it with
   a plausible guess.

## Output
Summary (what it is, 2–3 lines) → **annotated execution flow** (each step with `file:line`) → key files/roles
table → data / state / side-effects → dependencies & integrations (incl. tenancy + data-residency touchpoints
if relevant) → open questions / unverified. Concise, citation-first.

> **Pre-scaffold note:** until `apps/api` / `apps/web` exist, "the code" is mostly the governance layer
> (`.claude/`, docs, config). Explain that the same way — grounded line-by-line in the actual files.
