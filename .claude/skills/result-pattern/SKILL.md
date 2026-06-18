---
name: result-pattern
description: Implement or use our Result<T> failure model in the .NET API — return Result from handlers, build Error values, compose with Map/Then/Match, catch domain exceptions into Result, and map Result→RFC 9457 ProblemDetails. Use when adding an operation that can fail or wiring an endpoint's error contract.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Skill, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__replace_regex
---

# Use the `Result<T>` failure model

The procedure for our hand-rolled, railway-oriented failure model. Source of truth (the *facts* — read it):
`.claude/rules/backend/result-and-errors.md` and `docs/projectStandards/backend-architecture.md` §4.2–§4.3.
C# (`.cs`) edits via **Serena**. **No FP library** (e.g. CSharpFunctionalExtensions) without Dan's approval.

## The types (in `{{ProjectName}}.Shared` — must NOT reference ASP.NET Core)
- **`Result` / `Result<T>`** — `readonly struct`s holding either a value or an **`Error`**. Reading `.Value`
  on a failure **throws** (loud bug, not a silent null).
- **`Error`** — a `record`: `Code` (stable string), `Message` (human), `Type` (`ErrorType`: `Failure,
  Validation, NotFound, Conflict, Unauthorized, Forbidden`). `Type` drives the HTTP status; the `Validation`
  case carries a `Failures` dictionary (field → messages[]). **One `Error`, not a `List<Error>`.**
- **v1 surface only:** `Map` (transform value), **`Then`** (chain a fallible step), `Match` (collapse) — sync
  **and** async (`Task<Result<T>>`) overloads with `ConfigureAwait(false)`; implicit `T → Result<T>` and
  `Error → Result<T>`; factory statics. Deferred until a call site needs them: `Tap`/`Ensure`/`MapError`/`Combine`.

## Using it
1. **Handlers return `Result<T>`** (or `Result`) for *expected* failures — `return dto;` (implicit) on success,
   `return Error.NotFound("project.not_found", "…");` (implicit) on failure. **Do not throw** for expected failures.
2. **Catch domain exceptions** — domain invariants throw; in the handler catch a **narrow `DomainException`**
   (never bare `Exception`) and fold into `Result.Failure`. Unexpected exceptions bubble to the global handler.
3. **Compose** with `Then`/`Map` to chain fallible steps without nesting; `Match` to collapse to a value/response.

## Boundaries (who lives where)
- The **exception→Result** catch lives in the **Application** handler.
- The **Result→ProblemDetails** mapper (`ToHttpResult`/`ToProblem`) lives in the **API** layer, using .NET 10
  `TypedResults.Problem` / `ValidationProblem`; `Error.Type` selects the status code. **Every API failure →
  ProblemDetails, always** (+ `AddProblemDetails()` so unhandled exceptions render the same way).
- Validation failures (the Kommand `IValidator` scope — see the `validation-scopes` skill) surface as
  `Error.Validation(failures)` → `ValidationProblemDetails`.
