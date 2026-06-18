---
paths:
  - "apps/api/**/{{ProjectName}}.Domain/**/*.cs"
---

# Domain model — rich, mutable, base-class-free

Authoritative: `docs/projectStandards/backend-architecture.md` §3 and
`docs/projectStandards/coding-standards.md`. The domain is **persistence-ignorant** — no EF Core
types, no `virtual` navigation collections, no DB concerns leak in.

## Entities are rich mutable classes
- **Private parameterless constructor** + a `public static Create(...)` (or named) **factory** with
  guard clauses. Never expose a public constructor that can build an invalid object.
- **All setters private.** State changes only through behaviour methods.
- **Invariants enforced inside methods** on every create/mutate. A violation **throws** (an
  `ArgumentException`/domain exception) — the domain is the *last line of defence* (validation scope 3).
  The calling handler catches and folds into a `Result<T>` (see `result-and-errors`).
- **Identity-based equality** (entities), not value equality. Declare `Id`/`TenantId`/equality on the
  entity itself — **no base `Entity`/`AggregateRoot` class, no domain-event infrastructure** (decided:
  ceremony not justified).

## Identity
- The factory **mints the id itself** via `Guid.CreateVersion7()` (BCL, sequential UUIDv7). `Id` is set
  at construction — never `Guid.Empty` until save, never `Guid.NewGuid()`.

## Tenancy is a first-class invariant
- Every persisted entity carries a non-null `TenantId` and never crosses tenant boundaries. The factory
  validates `tenantId` is present; behaviour methods preserve it.

## Records vs classes
- **Entities/aggregates → mutable classes** (never records).
- **Value objects → records** (or `readonly record struct`): immutable, value-equality (e.g. `Money`,
  `TokenCount`, `ModelId`, `TenantId`).

@../../../docs/projectStandards/backend-architecture.md
