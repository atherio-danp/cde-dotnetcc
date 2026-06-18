---
paths:
  - "apps/api/**/*.cs"
---

# Failure handling — `Result<T>` + always ProblemDetails

Authoritative: `docs/projectStandards/backend-architecture.md` §4.2–§4.3. We hand-roll a **minimal**
railway-oriented `Result<T>` in `{{ProjectName}}.Shared` — **not** a functional-programming library (and no
library like CSharpFunctionalExtensions without Dan's approval).

## The types (in `{{ProjectName}}.Shared`, no ASP.NET Core reference)
- **`Result` / `Result<T>`** are `readonly struct`s holding either a value or an **`Error`**. Reading
  `.Value` on a failure **throws** (loud bug, not a silent null).
- **`Error`** is a `record`: `Code` (stable string), `Message` (human), `Type` (`ErrorType` enum:
  `Failure, Validation, NotFound, Conflict, Unauthorized, Forbidden`). `Type` drives the HTTP status.
  Validation carries a `Failures` dictionary (field → messages[]) — **one** `Error`, not a `List<Error>`.
- **v1 method surface (only this until a call site needs more):** `Map` (transform value), **`Then`**
  (chain a fallible step — the monadic bind), `Match` (collapse to value/response). Sync **and** async
  (`Task<Result<T>>`) overloads with `ConfigureAwait(false)`. Implicit conversions `T → Result<T>` and
  `Error → Result<T>`. Factory statics. **Deferred:** `Tap`/`OnSuccess`/`OnFailure`, `Ensure`, `MapError`, `Combine`.

## Who throws vs who returns `Result`
- **Domain** invariants **throw** (last line of defence).
- **Application handlers** catch a **narrow `DomainException`** (never bare `Exception`) and fold it into a
  `Result.Failure`; they return `Result<T>` for all expected failures (incl. business-validation failures).
- Truly unexpected exceptions bubble to the global handler.

## API boundary — always ProblemDetails
- A single `ToHttpResult`/`ToProblem` mapper (in `{{ProjectName}}.Api`) turns `Result<T>` into RFC 9457
  ProblemDetails via .NET 10 `TypedResults.Problem` / `ValidationProblem`; `Error.Type` → status code.
- `AddProblemDetails()` + a global exception handler ensure unhandled exceptions also render as ProblemDetails.
- The exception→`Result` helper lives in Application; the `Result`→ProblemDetails helper lives in Api.
  `{{ProjectName}}.Shared` must not reference ASP.NET Core.

@../../../docs/projectStandards/backend-architecture.md
