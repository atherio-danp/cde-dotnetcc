---
paths:
  - "apps/api/**/{{ProjectName}}.Infrastructure.Persistence/**/*.cs"
---

# Persistence — EF Core 10 on PostgreSQL (Npgsql)

We use **EF Core as the ORM with the `Npgsql.EntityFrameworkCore.PostgreSQL` provider** — yes EF Core,
just not SQL Server. Standard EF Core *patterns* transfer; only SQL-Server *engine* specifics change.
Authoritative: `docs/projectStandards/backend-architecture.md` §7–§8 (with Microsoft Learn / Npgsql citations).

## Patterns to follow (EF-Core-level)
- **Repository per aggregate root**, write side only: interface in Application, impl here. Reads/queries
  **bypass repositories** and project straight to DTOs (CQRS). No generic repository-per-table.
- **`AsNoTracking()` on every read-only query** (apply consistently). Explicit `Include()` / DTO projection
  to avoid N+1; `AsSplitQuery()` only where a multi-collection `Include` is proven to cartesian-explode.
- **`IEntityTypeConfiguration<T>` per entity**, Fluent API over annotations.
- **Audit-field stamping** in a `SaveChangesAsync` override, driven by an **`IAuditable` marker interface**
  (not a hard-coded type list).

## Transactions — a thin `IUnitOfWork`, implemented by the DbContext
- A **thin `IUnitOfWork`** (declared in Application) carries the **transaction verbs only** —
  `ExecuteInTransactionAsync<T>(Func<Task<T>>, ct)` + `SaveChangesAsync(ct)`. **No repository properties** (avoid a
  god-object UoW). The **`DbContext` here implements it** and owns the *how*:
  `CreateExecutionStrategy()` + retry, begin/commit, `SaveChanges`. `ExecuteInTransactionAsync` wraps the unit as
  a delegate because a retrying execution strategy forbids a manually-managed transaction. **Swap provider (e.g.
  SQL Server) ⇒ a new `DbContext` implementation of the same `IUnitOfWork`; nothing in Application changes.**
- The **Kommand transaction interceptor lives in Application** (Kommand interceptors bind to command handlers,
  never to the DbContext), depends ONLY on `IUnitOfWork`, calls `ExecuteInTransactionAsync(() => next())`, and
  **commits only on a successful `Result`** (rollback on a failed `Result` or a throw). **Queries skip it.**
- Repositories do change-tracking writes (`Add`/`Update`/`Remove`) — **never** call `SaveChanges`. Handlers never
  call `SaveChanges` either; a rare intermediate flush uses `IUnitOfWork.SaveChangesAsync()` — never a `DbContext`
  abstraction in Application.

## SQL Server → PostgreSQL specifics (these differ)
- **Provider:** `UseNpgsql(...)` with `EnableRetryOnFailure()` (the built-in `NpgsqlRetryingExecutionStrategy` —
  not a library).
- **Keys:** ids are **factory-minted UUIDv7** (`Guid.CreateVersion7()` in the domain) — no `NEWSEQUENTIALID()`,
  no DB-generated keys, no `Guid.Empty`-until-save.
- **Concurrency:** `xmin` system column via `.IsRowVersion()` on a `uint` (not SQL Server `rowversion`/`byte[]`).
- **Timestamps:** map to `timestamptz`; **all `DateTime` must be `Kind=Utc`** (never write Local/Unspecified).
  Do **not** enable the Npgsql legacy-timestamp switch. Drop `HasColumnType("datetimeoffset")`.
- **Duplicates:** `PostgresException` SQLSTATE `23505`; prefer `INSERT … ON CONFLICT` over catch-and-retry.
- **Naming:** `snake_case` tables/columns (hand-rolled EF convention; `EFCore.NamingConventions` lib needs approval).
- **No** SQL-Server index-maintenance service — Postgres autovacuum handles it (`REINDEX CONCURRENTLY` only if ever needed).
- **Migrations:** standard `dotnet ef` workflow; review the generated Postgres DDL.

## Tenancy — named filters + RLS, fail closed
- EF Core 10 **named query filters** — `TenantFilter` separate from `SoftDeleteFilter`.
- **Fail closed:** no tenant context ⇒ no rows / explicit exception, never "all rows".
- `IgnoreQueryFilters()` is a **privileged, audited** operation behind an explicit system-context type —
  never an ad-hoc per-repo bypass (a per-repo `…Unfiltered` habit is rejected).
- **PostgreSQL Row-Level Security** as the in-database backstop (`SET LOCAL app.tenant_id` per connection via
  an Npgsql interceptor; no library). Enforce `tenant_id` on writes in aggregate methods too.

## Npgsql wins worth using
- `jsonb` (EF 10 JSON complex types) for raw provider/pipeline/governance payloads; `citext`/ICU collation for
  case-insensitive identifiers; array & range types where they remove a junction table.

@../../../docs/projectStandards/backend-architecture.md
