---
paths:
  - "apps/api/**/{{ProjectName}}.Application/**/*.cs"
---

# CQRS with Kommand — consistent from day one

Kommand is Dan's CQRS library (`Kommand.Abstractions`). We enforce these conventions from the
start. Authoritative:
`docs/projectStandards/backend-architecture.md` §5. There is also a `cqrs-kommand` skill with
templates — use it when authoring a command/query.

## Capability surface (exact names)
- **Commands:** `ICommand<TResult>` + `ICommandHandler<TCommand, TResult>` with
  `Task<TResult> HandleAsync(TCommand, CancellationToken)`. Void commands use `ICommand<Unit>` → `Unit.Value`.
- **Queries:** `IQuery<TResult>` + `IQueryHandler<TQuery, TResult>.HandleAsync`.
- **Dispatcher:** `IMediator` — `SendAsync` (command), `QueryAsync` (query), `PublishAsync` (notification).
  Inject `IMediator` only into endpoints; never call handlers directly.
- **Validation:** `IValidator<T>.ValidateAsync → ValidationResult` (collect-all errors). Registered via
  `AddKommand(c => { c.RegisterHandlersFromAssembly(...); c.WithValidation(); })`. Everything **Scoped**.
- **Interceptors** (pipeline behaviours): `ICommandInterceptor<TCommand, TResponse>.InterceptAsync(request, next, ct)`.

## Conventions (enforced)
- **Command vs Query:** commands mutate (return new state/id or `Unit`); queries read and **never mutate**.
- **Naming:** `{Verb}{Noun}Command` / `Get{Noun}Query` / `{Event}Notification`, each with a matching
  `{Name}Handler` and optional `{Name}Validator` (class name matches file name exactly).
- **Commands/queries are records.** Domain entities they touch stay rich mutable classes.
- **One public type per file** in the Application layer. Handler sits **beside** its command/query in
  `Commands/` or `Queries/` — **no** separate `Handlers/` folder, **no** single-file slices.
- **Validators co-located** in `Commands/`/`Queries/`; response/DTO records in `DTOs/`, never inlined.
- **Canonical import:** `using Kommand.Abstractions;` (add `using Kommand;` only for `Unit`/`ValidationResult`).
- **No primary constructors** — explicit constructors with `ArgumentNullException` guards (we ban primary
  ctors even where Kommand *rule samples* use them).

## Handlers return `Result<T>`, not exceptions
- Command/query `TResult` is a **`Result<T>`** (or `Result`). Handlers return success payloads or
  `Error.*` failures (see `result-and-errors`); they do **not** throw for *expected* failures.
- **Validation = three scopes** (see `api-design` + `domain-model`): contract (API), **business
  (`IValidator<T>` here)**, invariant (domain throws → handler catches → `Result.Failure`).
  Business-validation failures surface as a **failed `Result`** (`Error.Validation(failures)`) — prefer a
  validation interceptor that returns the failed `Result<T>` over Kommand's throwing default.
  *(Verify against Kommand's `WithValidation` behaviour at implementation time; if it only throws, catch at
  the boundary and map to ProblemDetails — but keep failures expressed as `Result` wherever possible.)*

## Persistence & transactions
- Handlers **don't** open transactions or call `SaveChanges` — a command interceptor (Application, depends on a
  thin `IUnitOfWork`) wraps **every** command via `ExecuteInTransactionAsync(() => next())` and **commits only on
  a successful `Result`** (the `DbContext` implements `IUnitOfWork` and owns the execution strategy; see
  `persistence`). Handlers inject the repositories they need and orchestrate.

## Background work is NOT a Kommand command
- Multi-system / background orchestration uses a **service class**, not a Kommand command. If a background
  message bus is ever added (a library — needs Dan's approval), name its messages `…Job`/`…Message`,
  **never** `…Command` (a Kommand/bus `…Command` naming collision is a major source of confusion).

@../../../docs/projectStandards/backend-architecture.md
