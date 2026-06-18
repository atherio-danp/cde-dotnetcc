---
paths:
  - "apps/api/**/{{ProjectName}}.Api/**/*.cs"
---

# API design — Minimal APIs, feature folders

Authoritative: `docs/projectStandards/backend-architecture.md` §2, §4.1, §4.3. The API layer is
**thin**: bind → contract-validate → dispatch a Kommand command/query → map `Result<T>` to HTTP.
No business logic, no persistence, no model routing here.

## Feature folders + self-registration
- Organize under `Features/<Feature>/<UseCase>/` — **not** an `Endpoints/` or `Controllers/` folder.
- **One file per use case** (REPR style): the endpoint + its request + response records live together
  in `CreateProject.cs`. (This is the API layer's convention; the Application layer keeps one-type-per-file.)
- Endpoints implement `IEndpoint` (`void MapEndpoint(IEndpointRouteBuilder app)`) and are
  **auto-registered** by a reflection scan (`AddEndpoints(assembly)` / `MapEndpoints(group)`); `Program.cs`
  never enumerates routes. Group with `MapGroup()` / `RouteGroupBuilder` (route prefix + auth + filters).
- Hand-rolled — **no** FastEndpoints/Carter (libraries; would need approval and overlap Kommand).

## Validation scope here = CONTRACT only
- Validate request **shape/required fields/types** and **access control inferable from the JWT/cookie**.
- **No database calls** at this layer. Business validation belongs in the Application `IValidator<T>`
  (scope 2); invariants belong in the Domain (scope 3). See `result-and-errors` + `cqrs-kommand`.

## Every failure returns RFC 9457 ProblemDetails — always
- Map `Result<T>` to HTTP via a single `ToHttpResult`/`ToProblem` extension using .NET 10 `TypedResults`
  (`TypedResults.Problem` / `ValidationProblem`). `Error.Type` selects the status code.
- Register `AddProblemDetails()` + a global exception handler so **unhandled** exceptions also render as
  ProblemDetails. No endpoint ever returns a bare status code or a raw exception.

@../../../docs/projectStandards/backend-architecture.md
