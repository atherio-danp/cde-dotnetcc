# Kommand patterns ({{ProductName}}) — beyond the templates

Companion to `SKILL.md` + `templates.md`. Read alongside `.claude/rules/backend/cqrs-kommand.md` and
`result-and-errors.md`. (Distilled and corrected to apply Kommand consistently from day one.)

## Command vs Query vs Notification vs Service
| Intent | Use |
|---|---|
| Mutate state, return new state/id | `ICommand<Result<T>>` |
| Mutate state, nothing to return | `ICommand<Result>` (or `Result<Unit>`) |
| Read state (never mutates) | `IQuery<Result<T>>` |
| One-to-many side effect after a state change | `INotification` (handlers run **after** commit) |
| Background / multi-system orchestration | a **service class**, NOT Kommand. Any message bus is a library → Dan's decision; name its messages `…Job`/`…Message`, **never** `…Command`. |

## Transactions — interceptor depends on a thin `IUnitOfWork`
- A **command interceptor (Application)** wraps EVERY command by calling `_unitOfWork.ExecuteInTransactionAsync(() => next(), ct)`.
  The **thin `IUnitOfWork`** (transaction verbs only) is **implemented by the `DbContext`**, which owns the *how*
  (`CreateExecutionStrategy()` + retry → open transaction → run handler → `SaveChanges` → commit). The interceptor
  itself stays provider-agnostic (swap the `DbContext` and it doesn't change). **Queries skip it.**
- **Commit only on a successful `Result`** — a failed `Result` (logical failure, no throw) rolls back, as does any throw.
- Handlers therefore **never** call `SaveChanges` or open transactions — they mutate tracked entities via
  repositories and return `Result<T>`. (Rare intermediate flush → `IUnitOfWork.SaveChangesAsync()`.)
- **Shape (verified against Kommand `1.0.0-alpha.1`):** `TransactionInterceptor<TCommand, TResponse> :
  IInterceptor<TCommand, TResponse> where TCommand : ICommand<TResponse>` (in `{{ProjectName}}.Application`;
  `using Kommand;` for `IInterceptor`/`RequestHandlerDelegate`). Implement **`HandleAsync(TCommand request,
  RequestHandlerDelegate<TResponse> next, CancellationToken ct)`** (not `InterceptAsync`; `next` is parameterless)
  and call `_unitOfWork.ExecuteInTransactionAsync(() => next(), ct)`.
- **Queries skip it** *via the generic constraint* — `IInterceptor<TCommand,TResponse>` with `where TCommand :
  ICommand<TResponse>` can't close over a query type, so MS DI omits it for queries (confirm this DI behaviour
  when implemented).
- **Ordering:** register the validation interceptor **before** `AddInterceptor(typeof(TransactionInterceptor<,>))`.
  The first-registered interceptor is outermost, so validation runs **before** a transaction opens (don't open a
  transaction for invalid input).

## Validation → Result, not exceptions
- Business validation lives in a Kommand `IValidator<T>` (scope 2), returning `ValidationResult.Failure(...)`
  with the stable error/i18n code in `ValidationError.ErrorCode`. Failures must reach the client as
  `Error.Validation(failures)` → ValidationProblemDetails.
- **DECIDED (option b):** Kommand's built-in `WithValidation()` interceptor **throws `ValidationException`**
  (verified against the source). We **skip `WithValidation()` and register our own validation interceptor** that
  returns a failed `Result<T>` instead of throwing — keeping "no throw for expected failures" intact. See
  `.claude/rules/backend/cqrs-kommand.md`.
- Domain invariant violations **throw**; the handler catches a narrow `DomainException` and folds into
  `Result.Failure`.

## Notifications
- Publish **after** the command's transaction commits (never inside it). Handlers are independent and
  resilient; a failing notification handler must not roll back the committed command.

## Don'ts (drift to avoid)
- No `Commands/` + separate `Handlers/` folders, and no single-file vertical slices in the Application layer
  — **one public type per file**, handler beside its command/query.
- **No primary constructors** (Kommand's own rule samples used them — we don't).
- No **unused** `using` (IDE0005 fails the build) — but a file may legitimately need **both** `using Kommand;`
  (validators/interceptors/`Unit`) **and** `using Kommand.Abstractions;` (command/handler/mediator types). Import
  what's used; don't add an unused one.
- Never confuse a Kommand command with a background-bus message.
