---
name: efcore-query-performance
description: Optimize EF Core (Npgsql/PostgreSQL) queries in the .NET API — fix N+1, choose tracking modes, use compiled queries, split queries, and avoid translation traps. Use when a query is slow, emits excessive SQL, or causes high DB load. Complements the efcore-patterns scaffolding skill.
allowed-tools: Read, Glob, Grep, Bash, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol, mcp__serena__replace_content, mcp__serena__rename_symbol, mcp__serena__safe_delete_symbol
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# EF Core query performance — on Npgsql/PostgreSQL

For our stack: **EF Core with the Npgsql provider** (NOT SQL Server). C# (`.cs`) edits via **Serena**. Source of
truth: `.claude/rules/backend/persistence.md` + `docs/projectStandards/backend-architecture.md` §7. This is the
*performance* companion to the `efcore-patterns` scaffolding skill.

## 1. See the SQL first
`optionsBuilder.UseNpgsql(cs).LogTo(Console.WriteLine, LogLevel.Information).EnableSensitiveDataLogging().EnableDetailedErrors();`
(dev only) — or set `Microsoft.EntityFrameworkCore.Database.Command: Information` in `appsettings.Development.json`.

## 2. Fix N+1 (the #1 killer)
- **Eager load:** `.Include(o => o.Items)` instead of lazy-loading in a loop.
- **Split query** when multiple Includes or large child collections would cartesian-explode:
  `.Include(...).AsSplitQuery()`. (Single query when 1 Include or you need read-consistency in one round-trip.)
  On Postgres there's no MARS, so split results are buffered — measure before defaulting to split.
- **Best — project to a DTO:** `.Select(o => new ProjectSummary { ... })` fetches only the columns you need.
  Query/read side should bypass repositories and project to DTOs (per our CQRS read-side rule).

## 3. `AsNoTracking()` on every read-only query
Per-query, or globally `optionsBuilder.UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)`. Use
`AsNoTrackingWithIdentityResolution()` when the graph references the same row multiple times (de-dupes).

## 4. Compiled queries for hot paths
`private static readonly Func<{{ProjectName}}DbContext, Guid, Task<Project?>> GetProjectById =
EF.CompileAsyncQuery((db, id) => db.Projects.Include(s => s.Items).FirstOrDefault(s => s.Id == id));`

## 5. Translation traps (table)
| Trap | Fix |
|---|---|
| `.ToList()` then `.Where()` | filter in the DB first |
| `.Count() > 0` for existence | `.Any()` |
| `.Select()` after `.Include()` (Include ignored) | use `Select` only, project what you need |
| `string.Contains()` may client-eval | `EF.Functions.Like(...)`, or **`EF.Functions.ILike(...)`** for case-insensitive (Postgres-native — a Npgsql win over SQL Server) |
| `.ToList()` inside a `.Select()` | restructure to avoid nested per-row queries |

## 6. Raw / bulk
- Complex queries LINQ can't express: `FromSqlInterpolated($"... {param}")` (parameterized — **never**
  `FromSqlRaw` with string interpolation: injection). Chain `.AsNoTracking()`.
- Bulk writes: EF Core **`ExecuteUpdateAsync`/`ExecuteDeleteAsync`** (set-based, no change tracking).
- Idempotent inserts: prefer Postgres `INSERT … ON CONFLICT` over load-check-save (per the persistence rule).

## Pitfalls / ours
- Remove `Microsoft.EntityFrameworkCore.Proxies` (lazy loading) — it breeds N+1.
- Tenancy: our **named query filters** (`TenantFilter` + `SoftDeleteFilter`) apply automatically;
  `IgnoreQueryFilters()` is privileged/audited — never a casual perf shortcut.
- DbContext is scoped/per-request; never share across parallel tasks.
- Postgres folds unquoted identifiers to lowercase — EF quotes them; keep our snake_case convention.
- **No new NuGet package** for "performance" (e.g. a bulk-ext library) without Dan's approval.
