---
name: cqrs-kommand
description: Author a CQRS command or query in the {{ProductName}} backend using the Kommand library, the three-scope validation model, and the Result<T> failure pattern. Use whenever creating or modifying a command/query/handler/validator in apps/api/{{ProjectName}}.Application, or wiring its endpoint in {{ProjectName}}.Api.
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# Authoring a Kommand command or query ({{ProductName}})

Use this when adding a use case to the backend. The authoritative rules are
`.claude/rules/backend/cqrs-kommand.md`, `result-and-errors.md`, `api-design.md`, and
`docs/projectStandards/backend-architecture.md`. Concrete code templates are in
[`reference/templates.md`](reference/templates.md); deeper patterns (interceptor-owned transactions,
validation→`Result`, notifications-after-commit, command-vs-query-vs-service) in
[`reference/patterns.md`](reference/patterns.md).

## Step 1 — classify the intent
| Intent | Use |
|---|---|
| Mutate state, return new state/id | `ICommand<Result<TResponse>>` |
| Mutate state, nothing to return | `ICommand<Result>` (or `ICommand<Result<Unit>>`) |
| Read state | `IQuery<Result<TResponse>>` — **never mutates** |
| Background / multi-system orchestration | a **service class**, NOT Kommand (and any message bus is a library → Dan's call) |

## Step 2 — place the files (feature slice, one type per file)
```
{{ProjectName}}.Application/<Feature>/
├── Commands/  {Verb}{Noun}Command.cs · {Verb}{Noun}CommandHandler.cs · {Verb}{Noun}CommandValidator.cs
├── Queries/   Get{Noun}Query.cs · Get{Noun}QueryHandler.cs
└── DTOs/      {Noun}Response.cs
```
The endpoint is a **single file** in `{{ProjectName}}.Api/Features/<Feature>/<UseCase>.cs` (endpoint + request +
response together). The Application feature folder **mirrors** the API feature.

## Step 3 — write the pieces (see templates)
- **Command/query** = a `record` implementing the Kommand interface, returning **`Result<...>`**.
- **Handler** = explicit constructor (no primary ctor) with `ArgumentNullException` guards; `HandleAsync`;
  injects the repositories it needs; **does not** open transactions or call `SaveChanges` (the interceptor
  does); returns success payloads or `Error.*`; catches a **narrow `DomainException`** → `Result.Failure`.
- **Validator** (business scope) = `IValidator<TCommand>` (in namespace `Kommand`) returning `ValidationResult`
  (`Success()`/`Failure(...)`); put the stable error/i18n code in `ValidationError.ErrorCode`. *Note:* Kommand's
  built-in `WithValidation()` interceptor **throws `ValidationException`** on failure — we skip it and register our
  own interceptor that returns a failed `Result` (`Error.Validation(...)`); see
  `.claude/rules/backend/cqrs-kommand.md`.
- **Endpoint** = `IEndpoint`; contract-validate (shape + JWT-inferable authz, **no DB**); dispatch via
  `IMediator.SendAsync`/`QueryAsync`; map the `Result<T>` with `ToHttpResult` (always ProblemDetails on failure).

## Step 4 — check the conventions
- Imports: `using Kommand.Abstractions;` for command/handler/query/mediator types **and** `using Kommand;` for
  validators/interceptors/`Unit` (a validator file needs `Kommand`, not `Kommand.Abstractions`). No unused `using`
  (IDE0005 fails the build). Records for commands/queries/DTOs; rich classes for entities.
- Handler returns `Result<T>`; railway helpers are `Map` / `Then` / `Match`.
- No `Handlers/` folder, no single-file Application slices, no inlined response records, no primary ctors.
- Validation lives in exactly one scope each: contract (API), business (`IValidator<T>`), invariant (domain throws).
