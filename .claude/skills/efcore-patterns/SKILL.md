---
name: efcore-patterns
description: Add or change EF Core (Npgsql/PostgreSQL) persistence in the .NET backend — entities, EF configurations, repositories, queries, migrations. Use when adding a table/entity, a query, a repository, or a migration under apps/api.
argument-hint: <entity or feature name>
allowed-tools: Read, Glob, Grep, Bash, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol, mcp__serena__replace_content, mcp__serena__rename_symbol, mcp__serena__safe_delete_symbol
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# EF Core on PostgreSQL (Npgsql) — persistence patterns

Source of truth (read it; do not duplicate): `.claude/rules/backend/persistence.md` and
`docs/projectStandards/backend-architecture.md` §7–§8. We use **EF Core with the Npgsql provider** — yes
EF Core, just not SQL Server.

## Steps
1. **Classify** — entity + EF config / repository (write side, per aggregate root) / query (read side,
   project to DTO) / migration.
2. **Locate the feature slice** — entity in `{{ProjectName}}.Domain/<Feature>`; EF config + repo in
   `{{ProjectName}}.Infrastructure.Persistence/<Feature>`; repo interface in `{{ProjectName}}.Application/<Feature>`.
3. **Generate** (C# via Serena `create_text_file` / symbol edits — native `.cs` edits are blocked):
   - **Entity** — rich mutable class; private ctor + static factory minting `Guid.CreateVersion7()`; private
     setters; invariants throw; `tenant_id`. Domain stays EF-free (no persistence leakage).
   - **EF config** — `IEntityTypeConfiguration<T>`, Fluent API; `timestamptz` for timestamps (all `DateTime`
     `Kind=Utc`); `xmin`/`uint` concurrency via `.IsRowVersion()`; **EF 10 named query filters**
     (`TenantFilter` + `SoftDeleteFilter`, fail-closed); snake_case naming (hand-rolled convention).
   - **Repository** (write side, per aggregate) — interface in Application, impl here; change-tracking
     writes, **no `SaveChanges` in the repo** (the command interceptor commits). Reads bypass repos and
     project to DTOs with `AsNoTracking` + explicit `Include` (avoid N+1).
4. **Migration** — `dotnet ef migrations add <Name>`; **review the generated Postgres DDL**; never edit an
   applied migration.
5. **Validate** — `dotnet build` zero warnings; tests via the testing-expert per the plan.

## Hard rules (non-negotiable — restated)
- **Thin `IUnitOfWork`, implemented by the `DbContext`** — it carries the transaction verbs only
  (`ExecuteInTransactionAsync<T>(Func<Task<T>>, ct)` + `SaveChangesAsync`), no repository properties (not a god
  object). The `DbContext` owns the execution strategy / retry / begin-commit. The Kommand interceptor
  (Application) calls `ExecuteInTransactionAsync(() => next())` and **commits only on a successful `Result`**;
  handlers orchestrate, repos/handlers never call `SaveChanges`.
- **UUIDv7 minted in the domain factory** — never `NEWSEQUENTIALID()`, `Guid.NewGuid()`, or DB-generated keys.
- **Tenancy** — named query filters + PostgreSQL RLS backstop; `IgnoreQueryFilters()` is privileged/audited;
  enforce `tenant_id` on writes.
- **`ON CONFLICT`** for idempotent upserts; `PostgresException` SQLSTATE `23505` for dup detection.
- **No new NuGet package** without Dan's approval (the Npgsql provider is already pinned).
