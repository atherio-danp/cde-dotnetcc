---
name: add-domain-entity
description: Add a domain entity, aggregate, or value object to the .NET API — rich mutable class with private ctor + static factory (UUIDv7), invariants that throw, tenant_id, identity equality; records for value objects. Use when modeling new domain state under apps/api/{{ProjectName}}.Domain.
argument-hint: <Feature>/<TypeName>
allowed-tools: Read, Glob, Grep, Bash, Skill, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__replace_regex
---

# Add a domain entity / value object

The procedure for our rich, base-class-free DDD model. Source of truth (the *facts* — read them):
`.claude/rules/backend/domain-model.md` and `docs/projectStandards/coding-standards.md`. The domain is
**persistence-ignorant** (no EF types/navigations). C# (`.cs`) edits via **Serena**.

## Entity / aggregate
1. Place in `{{ProjectName}}.Domain/<Feature>`.
2. **Rich mutable class** (NEVER a record). Shape:
   - a **private parameterless constructor** (EF materialization);
   - a `public static Create(...)` (or named) **factory** with guard clauses that throws on invalid input and
     **mints the id via `Guid.CreateVersion7()`** (never `Guid.NewGuid()` / `Guid.Empty`-until-save);
   - **all setters private** — state changes only through behaviour methods;
   - **invariants enforced inside every behaviour method** (throw on violation — the domain is the last line of
     defence);
   - a non-null **`TenantId`** preserved across mutations (the tenancy invariant);
   - **identity-based equality** declared on the type itself (no base `Entity`/`AggregateRoot`, no domain events).
3. **No primary constructors.**

## Value object
- A **record** (or `readonly record struct`) — immutable, value equality (e.g. `Money`, `ModelId`, `TenantId`).

## After
- EF mapping (config) and repository → the **`efcore-patterns`** skill. Build (`dotnet build`, warnings = errors).
- Tests (factory guards, invariant throws, behaviour) → the **`write-tests`** skill, per the plan's exact test list.
