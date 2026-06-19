---
name: add-endpoint
description: Add a Minimal API endpoint (a feature/use case) to the .NET API — feature folder, IEndpoint self-registration, contract validation, Kommand dispatch, Result→ProblemDetails. Use when adding or changing an HTTP endpoint under apps/api/{{ProjectName}}.Api.
argument-hint: <Feature>/<UseCase> (e.g. Projects/CreateProject)
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Skill, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol, mcp__serena__replace_content, mcp__serena__rename_symbol, mcp__serena__safe_delete_symbol
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# Add a Minimal API endpoint

The procedure for our thin, feature-sliced API layer. Source of truth (the *facts* — read them):
`.claude/rules/backend/api-design.md`, `result-and-errors.md`, `cqrs-kommand.md`. C# (`.cs`) edits go through
**Serena** (native Edit/Write on `.cs` is blocked).

## Steps
1. **Feature folder, single file.** Create `{{ProjectName}}.Api/Features/<Feature>/<UseCase>.cs` holding the **endpoint +
   request record + response record together** (REPR style — one file per use case).
2. **Implement `IEndpoint`** — `void MapEndpoint(IEndpointRouteBuilder app)` mapping the verb under a
   `MapGroup` for the feature (`.WithTags("<Feature>")`). The endpoint **auto-registers** via the reflection scan
   (`AddEndpoints`/`MapEndpoints` in `Program.cs`) — **do not edit `Program.cs`** to add a route.
3. **Contract validation only** — bind the request; validate shape/required fields and authz inferable from
   `HttpContext.User` (JWT/cookie). **No database calls here.** (Business validation → the Kommand `IValidator`;
   invariants → the domain.)
4. **Dispatch Kommand** — build the command/query and `await mediator.SendAsync(...)` (command) or
   `QueryAsync(...)` (query). Inject `IMediator` only. The command/query + handler live in the **Application**
   layer — author them with the **`cqrs-kommand`** skill (and mirror the feature folder there).
5. **Map the result** — the handler returns `Result<T>`; convert with the `ToHttpResult`/`ToProblem` extension
   (`TypedResults`). **Every failure → RFC 9457 ProblemDetails.** Success uses the right typed result
   (`TypedResults.Created(...)`/`Ok(...)`).
6. **Build** — `dotnet build` (warnings = errors); fix before returning.

## Conventions (restated)
- No business logic, persistence, or model routing in the endpoint — it binds, validates the contract, dispatches.
- Records for request/response/command/query; rich classes for entities.
- No new library (e.g. FastEndpoints/FluentValidation) — hand-rolled Minimal API only, per the no-library rule.
- Tests for the endpoint go through the **`write-tests`** skill, per the plan's exact test list.
