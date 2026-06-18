# {{ProductName}} — Backend Architecture: Proposed Standards

> **Status: PRE-SCAFFOLD (governance written).** No `apps/api` project code is scaffolded yet, but the
> decisions below have since been **ratified into enforceable rules + skills** under `.claude/` (e.g.
> `.claude/rules/backend/*`, `.claude/skills/*`). This document is the rationale behind them.
> Sections once marked **OPEN DECISION** are resolved in §11; any remaining open items are flagged there.

This document records our backend standards, informed by web/Microsoft-Learn research on Minimal-API
feature organization, EF-Core-on-Npgsql, and the Unit-of-Work pattern. The conventions here cover
*domain modelling, layering, EF Core persistence patterns, and Kommand CQRS*. We use Minimal APIs
(not MVC controllers) and run EF Core on **PostgreSQL/Npgsql** (not SQL Server).

> ## ⛔ Governance: no library without Dan's approval
> **Never introduce, assume, or default to a third-party library/NuGet package without Dan's
> explicit, per-library approval.** Prefer the BCL or a minimal hand-rolled solution. This
> overrides any "best practice" that reaches for a package. Already rejected: **FluentValidation**.
> Approval-pending if ever proposed (each has a hand-rolled alternative noted in-doc): Scrutor
> (DI assembly-scan), EFCore.NamingConventions (snake_case), NodaTime, Polly. Built into the
> framework and therefore fine: `Guid.CreateVersion7()`, the Npgsql provider's
> `NpgsqlRetryingExecutionStrategy`.

---

## 0. TL;DR — proposed shape

| Concern | Proposal |
|---|---|
| **API style** | Minimal APIs, **feature folders** at the API layer, `IEndpoint` self-registration + `MapGroup` route groups. Thin layer: validate → dispatch Kommand command/query → map result. |
| **Layers (projects)** | `{{ProjectName}}.Domain` ← `{{ProjectName}}.Application` ← `{{ProjectName}}.Infrastructure` / `{{ProjectName}}.Infrastructure.Persistence` ← `{{ProjectName}}.Api`, plus `{{ProjectName}}.Shared`. Within every project: **group by feature, not by technical convention.** |
| **Domain** | Rich mutable DDD classes; private ctor + static factory; private setters; invariants in methods that **throw** on violation; `tenant_id` first-class. **Base-class-free, no domain events** (decided — ceremony not justified). |
| **Application** | Use cases as **Kommand** commands/queries + handlers + validators, feature-sliced. **Interfaces only for cross-layer contracts**; concrete types for services that live in & are consumed within Application. |
| **Errors & validation** | Handlers return our own minimal **`Result<T>`** (in `{{ProjectName}}.Shared`, railway-oriented). Validation has **three distinct scopes** (API contract / Application business via Kommand `IValidator<T>` / Domain invariants that throw). **Every API failure → RFC 9457 ProblemDetails, always.** |
| **CQRS** | **Kommand** (Dan's library). Strict, consistent conventions from day one. Commands mutate, queries read, validators via `IValidator<T>`, mediator = `IMediator` (`SendAsync`/`QueryAsync`/`PublishAsync`). |
| **Infrastructure** | Two projects, one conceptual layer: `Infrastructure.Persistence` (EF Core DbContext, repos, UoW) + `Infrastructure` (everything else external). |
| **Persistence** | **EF Core 10 + Npgsql (PostgreSQL)** — yes EF Core, just not SQL Server. Repository (per aggregate root, write side) + a **thin `IUnitOfWork`** (transaction verbs only) **implemented by the `DbContext`**. The EF patterns are provider-agnostic; only SQL-Server-*engine* specifics diverge (keys, retry strategy, error codes, timestamps). |
| **Transactions** | A **Kommand interceptor** (Application) wraps every command, calling `IUnitOfWork.ExecuteInTransactionAsync(() => next())` and **committing only on a successful `Result`** (rollback on failure/throw); queries skip it. The `DbContext` *implements* `IUnitOfWork` and owns the *how* (execution strategy / retry / begin-commit) — swap provider ⇒ new `DbContext`, the interceptor/validators/handlers don't change. |

---

## 1. Solution & project layout

The production dependency graph, as the template:

```
Domain  ←  Application  ←  Infrastructure.*  ←  Api
                ↑__________________________________|
Shared (referenced by all)
```

**Proposed for {{ProductName}}** (`apps/api/`):

```
apps/api/
├─ Directory.Build.props        (already committed — strict analyzer baseline)
├─ Directory.Packages.props     (already committed — pins analyzers + test packages; runtime/EF Core packages added at scaffold time)
├─ .editorconfig                (already committed — the C# standard)
├─ {{ProjectName}}.sln                  (created at scaffold)
├─ src/
│  ├─ {{ProjectName}}.Domain/                    no project refs — pure domain
│  ├─ {{ProjectName}}.Application/               → Domain (+ Shared)
│  ├─ {{ProjectName}}.Infrastructure/            → Application, Domain (external services)
│  ├─ {{ProjectName}}.Infrastructure.Persistence/→ Application, Domain (Postgres, repos, UoW)
│  ├─ {{ProjectName}}.Api/                       → all (composition root, Minimal API)
│  └─ {{ProjectName}}.Shared/                    no project refs — exceptions/primitives, referenced by all
└─ tests/
   ├─ {{ProjectName}}.Tests.Unit/
   └─ {{ProjectName}}.Tests.Integration/        (+ tests/Directory.Build.props at scaffold time)
```

**Hard rules:**
- Domain has **zero** project references. Application references Domain only. Infrastructure
  references Application + Domain. Api is the composition root.
- **Group by feature slice inside every project** — `Projects/`, `Documents/`, `Tenancy/` —
  never `Services/`, `Endpoints/`, `Controllers/`.
- One DI registration extension per infrastructure project (`AddPersistence`, `AddInfrastructure`),
  composed in `Program.cs`.

**Smells we will NOT introduce:**
- `Application → Infrastructure.Email` project reference — a dependency-inversion leak. Application
  depends on abstractions only.
- Api grouped by technical convention (`Controllers/`, `Filters/`, `Middleware/`) — contradicts the
  feature-slice rule.

---

## 2. Feature folders at the Minimal-API layer

Dan's principle: a feature folder holds *everything for that feature at the API layer* — endpoint(s),
request, response, feature-specific validation — instead of a technical `Endpoints/` folder.

**This is the *organizational* idea of Vertical Slice Architecture (VSA) applied only at the API
boundary** — not full VSA (we keep a layered + CQRS core; data access stays in Infrastructure). This
hybrid is a documented, recognized middle ground (Milan Jovanović, *Pragmatic Clean Architecture*),
not a compromise hack. Jimmy Bogard's governing VSA rule — *"minimize coupling between slices,
maximize coupling within a slice"* — applies to the endpoint folder.

**Proposed layout:**

```
{{ProjectName}}.Api/
├─ Features/
│  ├─ Projects/
│  │  ├─ CreateProject/
│  │  │  ├─ CreateProjectEndpoint.cs   : IEndpoint   (MapPost → dispatch Kommand command)
│  │  │  ├─ CreateProjectRequest.cs    (record)
│  │  │  └─ CreateProjectResponse.cs   (record)
│  │  └─ GetProject/ …
│  └─ Documents/ …
├─ Endpoints/IEndpoint.cs              (interface + AddEndpoints/MapEndpoints extensions)
└─ Program.cs                          (AddEndpoints(assembly); MapEndpoints(versionedGroup))
```

**Endpoint self-registration** (community-standard, Milan Jovanović) — endpoints implement a tiny
`IEndpoint` interface; a reflection scan registers them so `Program.cs` doesn't enumerate routes:

```csharp
public interface IEndpoint
{
    void MapEndpoint(IEndpointRouteBuilder app);
}
// AddEndpoints(assembly): scan IEndpoint impls → TryAddEnumerable transient
// MapEndpoints(group):    resolve all IEndpoint, call MapEndpoint under a MapGroup
```

`MapGroup()` / `RouteGroupBuilder` (first-party, MS Learn) gives each feature a shared route prefix +
auth + filters in one place. A feature endpoint is thin:

```csharp
public sealed class CreateProjectEndpoint : IEndpoint
{
    public void MapEndpoint(IEndpointRouteBuilder app) =>
        app.MapPost("projects", async (CreateProjectRequest req, IMediator mediator, CancellationToken ct) =>
        {
            var result = await mediator.SendAsync(req.ToCommand(), ct);
            return Results.Ok(result);
        }).WithTags("Projects");
}
```

**Validation placement is an OPEN DECISION (§11-B)** — because Kommand has its *own* validation
(`IValidator<T>`), validating the **command** in the Application layer may be sufficient, making
API-layer FluentValidation redundant. The minimal-API research assumed FluentValidation; Kommand
changes that calculus.

**OPEN DECISIONS here:** single-file slice vs split files (§11-F); whether feature folders mirror into
the Application project (§11-F).

---

## 3. Domain layer — rich DDD

Our domain modelling follows a strong, portable pattern: private parameterless ctor, `public static
Create(...)` factory with guard clauses, **all setters private**, invariants enforced inside behaviour
methods (defence-in-depth, even duplicating the Application validator), `#region` member ordering.

**Aligns with {{ProductName}}'s existing standard** (`coding-standards.md`): rich mutable classes, identity
equality, encapsulated state, no records for entities, `tenant_id` always present.

**Pitfalls we avoid (so we decide deliberately):**
- A `TenantEntity` base class that **zero entities extend** — dead code that contradicts the "no base
  classes" rule. We do not re-declare `Id`/`TenantId`/audit fields ad hoc across entities.
- **No aggregate-root type, no identity-equality base, no domain-event infrastructure** — kept out deliberately.
- Value objects must be **records**, not mutable public get/set classes — {{ProductName}}'s "value objects →
  records" rule.
- EF Core persistence concerns must not leak into the domain (`virtual ICollection<>` navigation properties,
  `Id == Guid.Empty` until DB assigns it via `NEWSEQUENTIALID()`). {{ProductName}} keeps the domain free of
  persistence artifacts and **generates ids in-domain** (UUIDv7 recommended — §11-G).

**DECIDED (round 1): base-class-free, no domain events.** Each entity declares its own `Id`/`TenantId`/
equality; no base `Entity`/`AggregateRoot`, no `DomainEvents` collection — Dan considers them ceremony not
justified by the complexity. Richness comes from behaviour + invariants, not a type hierarchy. Invariant
violations **throw** — the domain is the last line of defence (see *Validation — three scopes* below); a
calling handler catches and folds the failure into a `Result<T>`. The static factory mints the id itself
via `Guid.CreateVersion7()` (BCL, not a library), so `Id` is set at construction and the domain stays
persistence-ignorant. (If an outbox is ever needed later, revisit — domain events are the main thing it
would have bought us.)

---

## 4. Application layer

Feature-sliced (e.g. `Auth/`, `Onboarding/` …). Each feature holds its
commands, queries, handlers, validators, DTOs, and the **cross-layer interfaces** it owns (e.g.
`Projects/IProjectRepository.cs`).

**Dan's interface rule:**
> Interfaces only for **cross-layer** communication. A service that lives in *and* is consumed
> *within* the Application layer uses its **concrete type** — no interface.

We avoid "interface everything" (e.g. a `CurrentUserResolver` or in-layer services needlessly behind
interfaces). {{ProductName}} enforces concrete-for-in-layer from the start. Interfaces appear only when the
implementation lives in a different project (repositories, external-service abstractions implemented in
Infrastructure).

**`Common/`** holds genuinely cross-feature pieces (the UoW abstraction, current-user/tenant context).

### 4.1 Validation — three distinct scopes (DECIDED)
Validation is **not** one concern — it lives at three layers with different jobs. We do **not** use
FluentValidation (or any validation library); each scope is hand-rolled or uses Kommand's built-in validator.

| Scope | Where | Validates | Rule |
|---|---|---|---|
| **Contract** | API endpoint (before dispatch) | Request shape, required fields, types, and access control inferable from the **JWT/cookie**. | **No DB calls.** Pure contract + authz. Reject → ProblemDetails, never reaches a handler. |
| **Business** | Application — Kommand **`IValidator<T>`** on the command/query | Rules needing data/understanding ("is this buyer ≥18 for alcohol?"). | This is the *only* place Kommand's `IValidator<T>` is used. May read the DB. Failure → a failed `Result<T>`. |
| **Invariant** | Domain entity methods/factories | An object can never be **created or mutated** into an invalid state. | The last line of defence. Violations **throw**. The caller (handler) catches and folds into `Result<T>` if there's no acceptable alternative path. |

### 4.2 Failure model — our own minimal `Result<T>` (DESIGNED)
Command/query handlers **return `Result<T>`** (or `Result`) for *expected* failures rather than throwing.
A small, hand-rolled, railway-oriented type lives in **`{{ProjectName}}.Shared`** (no FP library). Research-backed
design (refs: Wlaschin ROP, CSharpFunctionalExtensions, Ardalis.Result, Milan Jovanović):

- **`Result` / `Result<T>`** as `readonly struct`s (allocation-free on the hot success path), each holding
  either a value or an **`Error`**. Reading `.Value` on a failure **throws** (a loud bug, not a silent null);
  the railway methods never touch `.Value` on the failure branch.
- **`Error`** = a `record` value object: `Code` (stable string), `Message` (human), `Type` (`ErrorType` enum:
  `Failure, Validation, NotFound, Conflict, Unauthorized, Forbidden`). `Type` drives the HTTP status; the
  `Validation` case carries a `Failures` dictionary (field → messages) for `ValidationProblemDetails`.
- **v1 method surface (minimum):** `Map` (transform value), `Then` (chain a fallible step — the monadic
  `bind`), `Match` (collapse to a value/response) — sync **and** async (`Task<Result<T>>`) overloads,
  `ConfigureAwait(false)` throughout —
  plus implicit conversions `T → Result<T>` and `Error → Result<T>`, and factory statics. **Deferred until a
  call site needs them:** `Tap`/`OnSuccess`/`OnFailure`, `Ensure`, `MapError`, `Combine`.
- **Boundaries:** the *exception→Result* catch (narrow `DomainException`, never bare `Exception`) lives in the
  application handler; the *Result→ProblemDetails* `ToHttpResult`/`ToProblem` mapper lives in the **API** layer
  via .NET 10 `TypedResults.Problem`/`ValidationProblem`. **`{{ProjectName}}.Shared` must NOT reference ASP.NET Core.**

### 4.3 API failures always return ProblemDetails (DECIDED)
**Every** failure surfaced by an API endpoint returns an **RFC 9457 `ProblemDetails`** response — contract
-validation failures, business-validation failures (`Result` failure), caught domain exceptions, and
unhandled exceptions alike. One `Result<T> → IResult` boundary mapper + a global exception handler
guarantee no endpoint ever returns a bare status code or a raw exception. (`Error` codes/categories in the
`Result` type map to HTTP status + ProblemDetails fields.)

---

## 5. Kommand (CQRS) — consistent conventions from day one

Kommand is Dan's library (`Kommand.Abstractions`). We adopt it with **consistent** conventions from day
one. Capability surface (verified from `KOMMAND_GUIDE.md` + real code):

- **Commands:** `ICommand<TResult>` (+ handler `ICommandHandler<TCommand,TResult>.HandleAsync`). Void
  commands use `ICommand<Unit>` → `Unit.Value`. *No non-generic `ICommand`.*
- **Queries:** `IQuery<TResult>` + `IQueryHandler<TQuery,TResult>.HandleAsync`.
- **Dispatcher:** `IMediator` with **kind-specific methods** — `SendAsync` (command), `QueryAsync`
  (query), `PublishAsync` (notification).
- **Validation (built-in, NOT FluentValidation):** `IValidator<T>.ValidateAsync → ValidationResult`
  (`Success()` / `Failure(errors)`); collect-all-errors; auto-discovered; supports constructor DI; runs
  only when `config.WithValidation()` is set; pipeline throws `ValidationException` on failure.
- **Notifications:** `INotification` + `INotificationHandler<T>` (multiple handlers, sequential, resilient).
- **Interceptors (pipeline behaviours):** `IInterceptor<TRequest,TResponse>` /
  `ICommandInterceptor<TCommand,TResponse>` with `InterceptAsync(request, next, ct)`; reverse
  registration order; this is where validation, tracing, **and transactions** plug in.
- **Result model:** **exception-based by default** (handlers return payload, throw on failure; global
  handler → Problem Details). A `Result<T>` pattern is shown as *optional*.
- **Registration:** `AddKommand(c => { c.RegisterHandlersFromAssembly(...); c.WithValidation(); })`;
  everything **Scoped**.

**Kommand inconsistencies we must avoid** (each is a concrete rule for {{ProductName}}):
1. Mixed file organization in one feature — `Commands/`+`Handlers/` split folders *and* one-file-per-use-case
   slices simultaneously. **Pick one.**
2. **Kommand commands confused with background-bus messages** — both named `…Command`, some "handlers"
   are plain classes with `Handle()` not `HandleAsync()`, implementing no Kommand interface. **Biggest
   source of confusion.** If {{ProductName}} adds a background bus, name those `…Job`/`…Message`, never `…Command`.
3. **Failure model drift** — some handlers throw, others return a `Result`-style `Response.Failure(...)`
   as a 200. Inconsistent. **Decide one model (§11-C) and enforce it.**
4. Validation duplicated in validators *and* re-checked in handlers.
5. Double namespace imports (`using Kommand;` + `using Kommand.Abstractions;` in the same file).
6. Code samples that use **primary constructors** — which {{ProductName}} **bans**. Templates
   must be rewritten with explicit constructors + null-guards.

**Proposed Kommand conventions:** `{Verb}{Noun}Command : ICommand<T>` / `Get{Noun}Query : IQuery<T>`;
commands/queries are **records**; one public type per file; handler beside its command (no separate
`Handlers/` folder); validators co-located, `…Validator` name; canonical single import; validation only
in `IValidator<T>`; `IMediator` only in endpoints. These are now the `cqrs-kommand` rule + skill
(`.claude/rules/backend/cqrs-kommand.md`, `.claude/skills/cqrs-kommand/`).

---

## 6. Infrastructure split

Two projects, one conceptual layer (as Dan specified):
- **`Infrastructure.Persistence`** — PostgreSQL: connection/data-source, repositories, **Unit of Work**,
  migrations (raw-SQL runner, not EF migrations). The whole project is a greenfield build.
- **`Infrastructure`** — every other external concern (model routing / provider connectors, object
  storage, identity/OIDC, email, telemetry). {{ProductName}} starts with one `Infrastructure` and splits
  later only if a concern earns its own project.

Each exposes one `AddX` DI extension; a per-repository hand-maintained registration list (~40 lines)
should be replaced by **assembly scanning**.

---

## 7. Persistence — EF Core 10 on PostgreSQL (Npgsql)

> **Premise corrected (2026-06-17):** {{ProductName}} uses **EF Core as the ORM, with the
> `Npgsql.EntityFrameworkCore.PostgreSQL` provider** — *yes EF Core, just not SQL Server*. Runtime packages
> (including the Npgsql EF Core provider) are **not yet pinned** in `Directory.Packages.props` — they're
> deliberately added at scaffold time with versions verified then (the provider currently appears only in that
> file's commented "expected set"). An earlier draft wrongly assumed "no EF Core / raw SQL" — discarded.

**Consequence: standard EF Core persistence patterns apply directly.** Data-access and transaction patterns
are EF-Core-level, not SQL-Server-level, so they carry over to Npgsql unchanged. Only the SQL-Server *engine*
specifics diverge (verified against Microsoft Learn + the Npgsql docs).

### 7.1 What applies directly (EF-Core-level — adopt these)

Each is provider-agnostic:
- **`IUnitOfWork` wrapping `DbContext.SaveChangesAsync`** (change-tracking based). *"Only
  `IUnitOfWork.SaveChangesAsync()` persists changes"*; repos never call `SaveChanges`.
- **The 3-layer transaction architecture:** handler injects `IUnitOfWork`, decides the boundary, calls
  `SaveChangesAsync` → UoW aggregates repos + manages transactions → repos do change-tracking writes only.
- **`ExecuteInTransactionAsync(Func<…>)`** for multi-`SaveChanges` units; implicit single transaction
  around one `SaveChanges` for simple commands. This `CreateExecutionStrategy().ExecuteAsync(...)` pattern
  is **required for *any* retrying execution strategy** (MS Learn), not a SQL-Server quirk.
- **Async reads / sync writes** repository idiom (`void Add/Update/Remove` = change-tracking only).
- **`AsNoTracking()`** on read-only paths (no change-tracker snapshot ⇒ ~40% less allocation; MS bench).
  *Apply it **consistently**.*
- **Explicit `Include()` / projection to DTOs** to avoid N+1; `AsSplitQuery()` only where a multi-collection
  `Include` is proven to cartesian-explode (Postgres buffers split-query results — no MARS).
- **`IEntityTypeConfiguration<T>` per entity**, Fluent API over annotations.
- **Global query filters** for tenancy + soft delete (mechanism transfers; *application* hardened — §7.3).
- **Audit-field stamping** in a `SaveChangesAsync` override via `ChangeTracker.Entries()` — but driven by a
  **marker interface (`IAuditable`)**, not a hard-coded `is X or Y` type list.

### 7.2 What diverges (SQL Server → PostgreSQL, under EF Core)

| Concern | SQL Server | {{ProductName}} (Npgsql) — with citation |
|---|---|---|
| Provider | `UseSqlServer(...)` | `UseNpgsql(...)`; `Npgsql.EntityFrameworkCore.PostgreSQL` (MS Learn NuGet pkgs) |
| Retry strategy | `SqlServerRetryingExecutionStrategy` via `EnableRetryOnFailure` | **`NpgsqlRetryingExecutionStrategy`** via same `EnableRetryOnFailure` (keys on `NpgsqlException.IsTransient`; 3rd arg `errorCodesToAdd` is SQLSTATE strings). `ExecuteInTransactionAsync` unchanged. (Npgsql docs) |
| PK generation | `NEWSEQUENTIALID()` default; `Id == Guid.Empty` until save | **Client-side UUIDv7** — Npgsql provider v9+ default for `Guid` keys (`Guid.CreateVersion7()`); `Id` populated *before* save; best B-tree locality; safe under retries. Drop `NEWSEQUENTIALID()` + the empty-until-save rule. (Npgsql value-generation docs) |
| Dup detection | `SqlException` 2601/2627 | **`PostgresException` SQLSTATE `23505`**; prefer **`INSERT … ON CONFLICT`** over the catch-and-retry loop. |
| Concurrency token | `rowversion` / `byte[]` | **`xmin` / `uint`** via `.IsRowVersion()` (free Postgres system column; same `DbUpdateConcurrencyException` flow). (Npgsql concurrency docs) |
| Timestamps | `DateTimeOffset` + `HasColumnType("datetimeoffset")` | **`timestamptz`** (Npgsql default for `DateTime`/`DateTimeOffset`). **Hard rule: all `DateTime` must be `Kind=Utc`** (cannot write Local/Unspecified to `timestamptz`). Drop the `HasColumnType` strings; do **not** enable the legacy-timestamp switch. (Npgsql 6.0 release notes) |
| Naming | SQL Server PascalCase | Adopt **`snake_case`** (hand-rolled EF convention; the `EFCore.NamingConventions` library needs approval) — Postgres folds unquoted identifiers to lowercase. |
| Index maintenance | `IndexMaintenanceService` (`ALTER INDEX … REORGANIZE`, `sys.dm_*`) | **Drop entirely** — Postgres autovacuum maintains B-trees; optional `REINDEX CONCURRENTLY` only if ever needed (YAGNI at launch). |
| Migrations | EF migrations (SQL Server DDL) | EF migrations unchanged workflow; Postgres DDL differs (and is **transactional** — clean rollback). Model PG enums/extensions via `HasPostgresEnum`/`HasPostgresExtension`. |

### 7.3 Tenancy — harden the EF mechanism (tenancy-first product)
Keep EF global query filters, but avoid the common risks: filters that **fail *open*** (no tenant ⇒ *all*
rows) and repos that liberally call `IgnoreQueryFilters()`/`…Unfiltered()`. {{ProductName}}:
- **EF 10 *named* query filters** — separate `TenantFilter` from `SoftDeleteFilter` so one can be disabled
  without dropping the other (new in EF Core 10).
- **Fail *closed*** — no tenant context ⇒ no rows / explicit exception, never "all rows".
- Treat `IgnoreQueryFilters()` as a **privileged, audited** operation behind an explicit system-context type.
- Enforce `tenant_id` on **writes** in aggregate methods (filters only constrain reads) + non-null indexed column.
- **Evaluate PostgreSQL Row-Level Security (RLS)** as an in-database backstop — a strong fit if your product
  requires a sovereignty/EU-residency story. **OPEN DECISION §11-G.**

### 7.4 Npgsql wins worth adopting (no SQL-Server equivalent)
- **`jsonb`** (EF 10 JSON complex types) — ideal for raw model/provider payloads, pipeline-stage metadata,
  governance event bodies (matches the "store raw, fields optional" parse-DTO principle), and it's indexable.
- **`citext`** / non-deterministic ICU collation — removes hand-rolled `ToLowerInvariant()`
  email/domain normalization (note: ICU collations need `EF.Functions.ILike`, not `LIKE`).
- **Array types** (`text[]`, `uuid[]`) for scope/tag lists without a junction table; **range types** for
  effective-dated governance policies.

---

## 8. Unit of Work

**"DbContext *is* a Unit of Work" — and we still wrap it, deliberately.** Microsoft states EF's `DbContext`
implements both UoW and Repository (`SaveChanges` *is* the unit-of-work commit). Microsoft's own DDD/CQRS
reference design nonetheless keeps a custom `IUnitOfWork` + repositories, for three reasons that all apply
to {{ProductName}}:
- **Decoupling** — the repository/UoW *interfaces* live in Application/Domain; the EF implementation lives in
  Infrastructure, so the domain stays persistence-ignorant.
- **Aggregate boundaries** — one repository **per aggregate root** (never per table), the single write
  channel that enforces invariants. The **read/query side bypasses repositories** and projects straight to
  DTOs (CQRS).
- **Testability** — handlers test against the repository interface, not a mocked `DbContext`.

The counter-argument (Jimmy Bogard, quoted *by* Microsoft: with CQRS you often don't need repositories) is
real — so we keep repositories **only on the write side**, per aggregate, and never a generic
repository-per-table.

### The design
- **A thin `IUnitOfWork` carries the transaction verbs only** — `ExecuteInTransactionAsync<T>(Func<Task<T>>, ct)`
  + `SaveChangesAsync(ct)`; **no repository properties** (avoiding the god-object anti-pattern). Declared in
  **Application**, **implemented by the `DbContext`** in Infrastructure.Persistence.
- **The `DbContext` owns the *how*** — `CreateExecutionStrategy()` + retry, `BeginTransaction`/`Commit`,
  `SaveChanges`. `ExecuteInTransactionAsync` wraps the whole unit as a *delegate* because a retrying execution
  strategy forbids a manually-managed transaction. **Swap provider (e.g. SQL Server) ⇒ a new `DbContext`
  implementation of the same `IUnitOfWork`; the interceptor / validators / handlers don't change.**
- **Transaction boundary = a Kommand interceptor (Application), wrapping command handlers** (Kommand interceptors
  bind to command/query handlers — they live in the Application pipeline, never in Infrastructure). It depends
  ONLY on `IUnitOfWork` and calls `_unitOfWork.ExecuteInTransactionAsync(() => next(), ct)`. **It commits only on
  a successful `Result`** (rolls back on a failed `Result` or a throw). **Queries skip it.** The **validation
  interceptor runs first** (don't open a transaction for invalid input).
- Handlers never call `SaveChanges`; the rare intermediate flush uses `IUnitOfWork.SaveChangesAsync()` — never a
  `DbContext` abstraction injected into Application (with factory-minted UUIDv7 ids, an early flush is rarely needed).

### Fixes applied regardless of database (common design smells)
- **Avoid the 37-property / 37-ctor-arg god `IUnitOfWork`.** {{ProductName}} keeps a **thin** `IUnitOfWork` — the
  transaction verbs only (`ExecuteInTransactionAsync`, `SaveChangesAsync`), **no repository properties**.
  Handlers **inject the specific repositories they need** (all share the scoped `DbContext`, so one `SaveChanges`
  commits atomically). The minimal interface is the seam that keeps the interceptor and the whole Application
  layer provider-agnostic — *not* the anti-pattern we avoid (that was the repository bag, not the pattern).
- **No dead `[Obsolete]` Begin/Commit/Rollback** transaction API — greenfield has no callers; only
  `ExecuteInTransactionAsync` survives.
- **Convention-based repository DI registration** (a small hand-rolled reflection loop) instead of
  ~40 hand-written lines. The `Scrutor` library would do this too but needs Dan's approval — default to hand-rolled.
- **Audit stamping via `IAuditable` marker**, not a hard-coded type list.
- **`ON CONFLICT` upserts** instead of a provider-specific catch-and-retry `SaveChangesSkippingDuplicates`.

---

## 9. What we deliberately do NOT adopt

A concentrated list of anti-patterns we reject:
1. **SQL-Server *engine* specifics only** — `NEWSEQUENTIALID()`, `rowversion`, error codes 2601/2627,
   `datetimeoffset` column type, an `IndexMaintenanceService`. The EF Core *patterns* **do** apply (§7.1);
   only these engine bits swap to Npgsql equivalents (§7.2).
2. **MVC controllers** + convention folders (`Controllers/`, `Filters/`) — replaced by Minimal-API
   feature folders.
3. **"Interface everything"** in Application — replaced by concrete-for-in-layer.
4. **Mixed Kommand file conventions** + Kommand/background-bus `…Command` naming collision.
5. **Primary constructors** and **`UPPER_CASE` constants** — {{ProductName}}'s standard bans/inverts both.
6. **37-property god UoW**, dead obsolete transaction API, implicit tenant query filters with bypass methods.
7. **Application → Infrastructure project reference** (DI leak).

---

## 10. What we adopt (keep)

- Rich-DDD domain modelling (private ctor + static factory + private setters + invariant methods).
- Layer dependency direction; feature-slice organization within layers.
- Cross-layer interfaces declared in Application feature folders.
- Kommand command/handler shape (consistent conventions).
- One `AddX` DI extension per infrastructure project, composed in `Program.cs`.
- A minimal shared kernel (`{{ProjectName}}.Shared`-style: exception vocabulary mapped to HTTP by API middleware).
- Repository + UoW *intent*; handler/interceptor-owned transaction boundaries; `CancellationToken` everywhere.

---

## 11. OPEN DECISIONS (need Dan)

### Resolved (round 1)
- **C — Failure model:** our own minimal **`Result<T>`** in `{{ProjectName}}.Shared` (railway-oriented, hand-rolled,
  the minimum we need — not a library). **Every API failure → RFC 9457 ProblemDetails, always.** (§4.2, §4.3)
- **B — Validation:** **three distinct scopes** — API contract (no DB), Application business via Kommand
  `IValidator<T>`, Domain invariants that throw. **No FluentValidation / no validation library.** (§4.1)
- **D — Transaction boundary:** a **Kommand interceptor wraps *all* commands** (no opt-out marker) in the
  execution strategy; queries skip it. (§8)
- **E — Domain base types:** **base-class-free, no domain events** — entities own their `Id`/`TenantId`/
  equality; factory mints id via `Guid.CreateVersion7()`. (§3)

### Resolved (round 2)
- **A — Thin `IUnitOfWork` (CORRECTED).** A minimal `IUnitOfWork` in Application carries the **transaction verbs
  only** (`ExecuteInTransactionAsync<T>(Func<Task<T>>, ct)` + `SaveChangesAsync`) — *no* repository properties
  (not the god object). The **`DbContext` implements it** in Infrastructure and owns the execution
  strategy/retry/begin-commit. The **Kommand transaction interceptor (Application) depends only on `IUnitOfWork`**,
  wraps each command via `ExecuteInTransactionAsync(() => next())`, and **commits only on a successful `Result`**
  (rollback on failure/throw). Provider swap ⇒ new `DbContext` impl; interceptor/handlers unchanged. Rare
  intermediate flush → `IUnitOfWork.SaveChangesAsync()`, never a DbContext abstraction in Application.
  *(Supersedes the earlier "no dedicated IUnitOfWork" framing — that was an over-correction from the god object.)*
- **F — Single file per use case** (endpoint + request + response together, REPR style); **feature folders
  mirrored into the Application project** so a feature reads end-to-end.
- **G — EF named query filters + PostgreSQL RLS** backstop (`SET LOCAL app.tenant_id` per connection via an
  Npgsql interceptor; no library — verify RLS wiring against PG docs at build time).
- **H — Factory-minted UUIDv7** via `Guid.CreateVersion7()` (BCL) — `Id` set at construction, domain stays
  persistence-ignorant.

### Resolved (round 3 — `Result<T>` shape)
- **`readonly struct`** for `Result`/`Result<T>` (allocation-free success path).
- The chain operator is named **`Then`** (not `Bind`) — reads better for non-FP readers.
- Validation = **one `Error` with a `Failures` dictionary** (`Result<T>` stays single-error; maps to `ValidationProblemDetails`).

### Still open
| # | Decision | Recommendation |
|---|---|---|
| **I** | **Background bus / outbox now or later?** (any bus is a library — needs approval) | **Defer** — no bus until a use case needs it (and any bus is a library decision for Dan). |

### Non-blocking defaults (decide-or-accept — I'll use these unless you object)
- **Naming convention:** `snake_case` tables/columns (Postgres folds unquoted identifiers). Achievable hand-rolled via a custom EF Core convention / `ConfigureConventions`; the `EFCore.NamingConventions` library would need Dan's approval.
- **Time:** UTC `DateTime` (`Kind=Utc`) / `timestamptz` everywhere; consider NodaTime later if local-time domains appear.
- **Enums:** stored via int/string value converter (portable) — native PG enums only for stable, hot columns.
- **Case-insensitive text:** `citext` (or ICU non-deterministic collation) for emails/identifiers.
- **PG version:** stay version-flexible (client-side UUIDv7 needs no PG-18 feature); revisit if `uuidv7()`/RLS push us to pin PG 18.
- **DbContext pooling:** skip initially (interacts awkwardly with per-request tenant filters); revisit under load.

---

## Key sources

- Kommand — `KOMMAND_GUIDE.md`.
- Jimmy Bogard — *Vertical Slice Architecture*; Milan Jovanović — *Vertical Slice Architecture* &
  *Automatically Register Minimal APIs*; MS Learn — *Routing / Route groups*, *Filters in Minimal APIs*.
- Fowler — *Unit of Work* (PoEAA); MS Learn — *DDD/CQRS infrastructure persistence*; Npgsql — *Basic Usage*
  & *Transaction management*; PostgreSQL — *Transaction Isolation*, *UPSERT*; Particular — *TransactionScope
  & async/await*; code-corner.dev — *Transaction management with mediator pipelines*.
