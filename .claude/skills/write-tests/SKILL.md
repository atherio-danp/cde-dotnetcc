---
name: write-tests
description: Write and run tests for the .NET API following a plan's exact test list and our testing conventions — unit (domain/handlers) and integration (endpoint→DB), exact pass/fail/skip counts, never weakening a test. Use when adding or changing tests under apps/api/tests. Preloaded by the testing-expert agent.
argument-hint: <feature or plan path>
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Skill, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol, mcp__serena__replace_content, mcp__serena__rename_symbol, mcp__serena__safe_delete_symbol
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# Write tests ({{ProductName}} .NET API)

The procedure for authoring tests. C# (`.cs`) test files go through **Serena**.

> **⚠ Test stack is pending Dan's approval.** Test libraries (xUnit / NUnit / TUnit, NSubstitute / Moq,
> FluentAssertions, **Testcontainers for PostgreSQL**, Vitest / Playwright) are **library decisions for Dan** —
> do **not** adopt one silently. Until a stack is approved, follow the stack the **plan** specifies; if the plan
> names an unapproved library, STOP and flag it.

## Scopes
- **Unit** — domain (factory guard clauses + invariant throws + behaviour methods), Kommand handlers (with
  collaborators substituted), the `Result<T>`/`Error` mapping. Fast, no real I/O.
- **Integration** — endpoint → handler → **real PostgreSQL** (via Testcontainers once approved), asserting the
  HTTP contract (status + **ProblemDetails** on failure) and persistence. Honor the tenancy invariant in fixtures.

## Procedure
1. **Implement the plan's "Exact test list" verbatim** — each named test asserts exactly what the plan says it
   guards (one focused assertion per test). **Mirror the feature folder** structure under `apps/api/tests`.
2. Write the `.cs` test files via Serena.
3. **Run the suite** and report **EXACT** counts — e.g. `passed 42 / failed 0 / skipped 1`, never "tests pass".
4. **Never** weaken, skip, disable, or delete a test (or disable an analyzer) to get green. A failing test that
   reveals a **real defect** is a finding — report it; do not paper over it.
5. Note any **"Known coverage gap"** the harness cannot verify.

## Conventions
- Test names describe the scenario (the `[tests/**.cs]` editorconfig drops the `Async` suffix requirement).
- No coverage-percentage / CRAP gate unless the plan asks for one.
- Tests assert against **our** contracts: `Result<T>`/ProblemDetails, tenancy, async discipline.
