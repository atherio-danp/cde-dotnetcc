---
paths:
  - "apps/api/**/{{ProjectName}}.Application/**/*.cs"
---

# CQRS with Kommand — consistent from day one

Kommand is Dan's CQRS library — NuGet package **`Kommand`** (`1.0.0-alpha.1`; targets net8.0, fwd-compatible to
net10.0). We enforce these conventions from the start. Authoritative:
`docs/projectStandards/backend-architecture.md` §5. There is also a `cqrs-kommand` skill with
templates — use it when authoring a command/query. **Surface below verified against the `1.0.0-alpha.1` source
(2026-06-19).**

> **Namespaces (they differ — get the `using`s right):** `Kommand.Abstractions` →
> `IRequest`/`ICommand`/`ICommandHandler`/`IQuery`/`IQueryHandler`/`IMediator`/`INotification`/`INotificationHandler`.
> `Kommand` → `Unit`, `IValidator`, `ValidationResult`, `ValidationError`, `ValidationException`, the interceptor
> types + `RequestHandlerDelegate`. `KommandConfiguration` → `Kommand.Registration`. `AddKommand` → extension in
> `Microsoft.Extensions.DependencyInjection`.

## Capability surface (exact names)
- **Commands:** `ICommand<TResult>` + `ICommandHandler<TCommand, TResult>` with
  `Task<TResult> HandleAsync(TCommand, CancellationToken)`. A **non-generic `ICommand : ICommand<Unit>`** also
  exists (handler is still `ICommandHandler<TCommand, Unit>` → `Unit.Value`; `IMediator.SendAsync(ICommand)`
  matches it). **Our convention: always return `Result<…>`** (`ICommand<Result<T>>` / `ICommand<Result>`),
  so we don't use the bare non-generic form — but it is part of the API.
- **Queries:** `IQuery<TResult>` + `IQueryHandler<TQuery, TResult>.HandleAsync`.
- **Dispatcher:** `IMediator` — `SendAsync` (command), `QueryAsync` (query), `PublishAsync` (notification).
  Inject `IMediator` only into endpoints; never call handlers directly.
- **Validation:** `IValidator<T>.ValidateAsync(instance, ct) → ValidationResult` (`Success()` /
  `Failure(params ValidationError[])`; collect-all errors). `ValidationError(string PropertyName, string
  ErrorMessage, string? ErrorCode = null)` — **use `ErrorCode`** to carry a stable error/i18n code. Registered via
  `AddKommand(c => { c.RegisterHandlersFromAssembly(asm); c.WithValidation(); })`. Mediator/handlers/validators/
  user-interceptors are **Scoped**; the built-in OTel interceptors are **Singleton**.
- **Interceptors** (pipeline behaviours): the contract is **`IInterceptor<TRequest, TResponse>`** with
  **`Task<TResponse> HandleAsync(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)`**
  — it is **`HandleAsync`, not `InterceptAsync`**, and `next` is the **parameterless** delegate
  `RequestHandlerDelegate<TResponse>()`. `ICommandInterceptor<TCommand, TResponse>` /
  `IQueryInterceptor<TQuery, TResponse>` are **constraint-only markers** (no extra members) — implement one to
  bind your interceptor to commands/queries only. **First-registered interceptor is OUTERMOST**; `AddKommand`
  auto-registers built-in OTel interceptors first. `[RequiresUnreferencedCode]` on `AddKommand`/
  `RegisterHandlersFromAssembly` — don't enable trimming/AOT on `{{ProjectName}}.Api`.

## Conventions (enforced)
- **Command vs Query:** commands mutate (return new state/id or `Unit`); queries read and **never mutate**.
- **Naming:** `{Verb}{Noun}Command` / `Get{Noun}Query` / `{Event}Notification`, each with a matching
  `{Name}Handler` and optional `{Name}Validator` (class name matches file name exactly).
- **Commands/queries are records.** Domain entities they touch stay rich mutable classes.
- **One public type per file** in the Application layer. Handler sits **beside** its command/query in
  `Commands/` or `Queries/` — **no** separate `Handlers/` folder, **no** single-file slices.
- **Validators co-located** in `Commands/`/`Queries/`; response/DTO records in `DTOs/`, never inlined.
- **Imports:** import exactly what the file uses — commonly `using Kommand.Abstractions;` (request/handler/
  mediator types) **and** `using Kommand;` (validators, interceptors, `Unit`, `RequestHandlerDelegate`). A
  validator or interceptor file needs `using Kommand;`; a command/handler file usually needs both. Never leave an
  unused `using` (IDE0005 fails the build).
- **No primary constructors** — explicit constructors with `ArgumentNullException` guards (we ban primary
  ctors even where Kommand *rule samples* use them).

## Handlers return `Result<T>`, not exceptions
- Command/query `TResult` is a **`Result<T>`** (or `Result`). Handlers return success payloads or
  `Error.*` failures (see `result-and-errors`); they do **not** throw for *expected* failures.
- **Validation = three scopes** (see `api-design` + `domain-model`): contract (API), **business
  (`IValidator<T>` here)**, invariant (domain throws → handler catches → `Result.Failure`).
  Business-validation failures must reach the client as a `Result.Failure(Error.Validation(...))` →
  ValidationProblemDetails.
  > **DECIDED (option b).** Kommand's built-in `WithValidation()` interceptor **throws `ValidationException`**
  > (verified against the `1.0.0-alpha.1` source — it does *not* return a `Result`). To keep "no throw for
  > expected failures" intact, we **skip `WithValidation()` and register our own validation interceptor**
  > (`IInterceptor<TRequest, TResponse>`) that runs the registered `IValidator<T>`s and returns a failed
  > `Result<T>` (`Error.Validation(failures)`, mapping each `ValidationError.PropertyName` + `ErrorCode`)
  > instead of throwing. Built when the first validator appears (none yet).

## Persistence & transactions
- Handlers **don't** open transactions or call `SaveChanges` — a command interceptor (Application, depends on a
  thin `IUnitOfWork`) wraps **every** command via `ExecuteInTransactionAsync(() => next())` and **commits only on
  a successful `Result`** (the `DbContext` implements `IUnitOfWork` and owns the execution strategy; see
  `persistence`). Handlers inject the repositories they need and orchestrate.
  - **Shape:** `TransactionInterceptor<TCommand, TResponse> : IInterceptor<TCommand, TResponse> where TCommand :
    ICommand<TResponse>` (the constraint makes it **command-only — queries are skipped** because the open generic
    can't close over a query type), method `HandleAsync(cmd, next, ct)`. Register it **after** the validation
    interceptor so validation (outermost) runs before a transaction opens. *(Confirm when implemented that MS DI
    skips the constraint-mismatched open generic for queries — the intended mechanism.)*

## Background work is NOT a Kommand command
- Multi-system / background orchestration uses a **service class**, not a Kommand command. If a background
  message bus is ever added (a library — needs Dan's approval), name its messages `…Job`/`…Message`,
  **never** `…Command` (a Kommand/bus `…Command` naming collision is a major source of confusion).

@../../../docs/projectStandards/backend-architecture.md
