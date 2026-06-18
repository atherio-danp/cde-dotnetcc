---
name: validation-scopes
description: Place validation in the correct one of our three scopes in the .NET API — API contract (no DB), Application business via Kommand IValidator, or Domain invariants that throw. Use when adding any validation/guard, or deciding where a check belongs.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, Skill, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__replace_regex
---

# Validation — the three scopes

Validation is **three distinct concerns**; put each check in the right one. Source of truth (the *facts* —
read them): `.claude/rules/backend/api-design.md` (§4.1), `cqrs-kommand.md`, `domain-model.md`, and
`docs/projectStandards/backend-architecture.md` §4.1. **We do NOT use FluentValidation or any validation
library.** C# (`.cs`) edits via **Serena**.

| Scope | Where | Validates | On failure |
|---|---|---|---|
| **Contract** | API endpoint, *before* dispatch | request shape, required fields, types, and access control inferable from the **JWT/cookie** | reject → **ProblemDetails**; never reaches a handler. **No DB calls.** |
| **Business** | Application — a Kommand **`IValidator<T>`** on the command/query | rules needing data/understanding ("is this buyer ≥18 for alcohol?") | a **failed `Result`** (`Error.Validation(failures)`) → `ValidationProblemDetails` |
| **Invariant** | Domain entity factories/methods | an object can never be **created or mutated** into an invalid state | **throw**; the handler catches and folds into `Result.Failure` |

## Procedure — placing a check
1. **Is it pure shape / required-field / JWT-derivable authz, with no DB?** → **Contract** (API). Hand-roll the
   check in the endpoint (or a small reusable guard); short-circuit to ProblemDetails before dispatching.
2. **Does it need data or business understanding?** → **Business**. Add a `IValidator<T>` beside the
   command/query (co-located in `Commands/`/`Queries/`, named `…Validator`). Surface failures as a failed
   `Result` — prefer a validation interceptor that returns the failed `Result<T>` over Kommand's throwing
   default (see `cqrs-kommand` `reference/patterns.md`).
3. **Is it an invariant that must hold for the object to exist or change?** → **Invariant**. Enforce it inside
   the domain factory/method and **throw** (use the `add-domain-entity` skill). Never rely on outer layers to
   keep the domain valid — it's the last line of defence.

## Don'ts
- Don't repeat the same rule across scopes (e.g. re-checking a business rule in the handler that the
  `IValidator` already guarantees) — each rule lives in exactly one scope.
- Don't do DB work in contract validation; don't put business logic in the endpoint.
- Failures become `Result`/ProblemDetails (see the `result-pattern` skill), not ad-hoc exceptions at the boundary.
