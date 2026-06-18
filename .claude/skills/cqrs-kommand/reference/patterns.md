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
- The **validation interceptor runs BEFORE** the transaction interceptor (don't open a transaction for invalid input).

## Validation → Result, not exceptions
- Business validation lives in a Kommand `IValidator<T>` (scope 2). Surface failures as a **failed `Result`**
  (`Error.Validation(failures)`) — prefer a validation interceptor that returns the failed `Result<T>` over
  Kommand's throwing default. *(Verify against Kommand's actual `WithValidation`; if it only throws, catch at
  the boundary and map to ProblemDetails — but keep failures expressed as `Result` where possible.)*
- Domain invariant violations **throw**; the handler catches a narrow `DomainException` and folds into
  `Result.Failure`.

## Notifications
- Publish **after** the command's transaction commits (never inside it). Handlers are independent and
  resilient; a failing notification handler must not roll back the committed command.

## Don'ts (drift to avoid)
- No `Commands/` + separate `Handlers/` folders, and no single-file vertical slices in the Application layer
  — **one public type per file**, handler beside its command/query.
- **No primary constructors** (Kommand's own rule samples used them — we don't).
- No double `using Kommand;` + `using Kommand.Abstractions;` — canonical is `using Kommand.Abstractions;`.
- Never confuse a Kommand command with a background-bus message.
