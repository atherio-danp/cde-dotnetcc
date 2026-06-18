# {{ProductName}} — C# / .NET Coding Standards

> The single source of truth for how we write C# in this repo (the `apps/api` .NET
> backend). Most of this is machine-enforced; the parts that can't be are called out
> explicitly as **convention (not enforced)** and are upheld by review.

**Baseline:** .NET 10 / C# 14. Strict from day one — greenfield, so there's no legacy
debt and this is the cheapest time to adopt it.

## Where the rules live

| File | Enforces |
|---|---|
| `apps/api/Directory.Build.props` | Compiler + analysis settings applied to every .NET project (nullable, implicit usings, `AnalysisMode=All`, warnings-as-errors), and the shared analyzer package references. |
| `apps/api/Directory.Packages.props` | Central Package Management — every NuGet version pinned once. |
| `apps/api/.editorconfig` | Formatting, language-style preferences, naming rules, per-rule analyzer severities. Layers on top of the repo-root `.editorconfig`. |
| Repo-root `.editorconfig` | Shared cross-stack formatting (charset, final newline, indent); `root = true`. |
| `.gitattributes` | LF line endings in the repo; `.cs` checks out CRLF for .NET tooling. |
| This document | The *why*, plus the conventions that no analyzer can enforce. |

For **where these files live and why** (the nested-monorepo placement, how `apps/api`
governance layers under the root, and how test code overrides the baseline), see
[build-configuration.md](build-configuration.md).

## Severity model

`TreatWarningsAsErrors=true` is on, so the severity attached to each rule is what
matters:

- **`warning`** → fails the build. Used for correctness and consistency rules.
- **`suggestion` / `silent`** → IDE hint only, never blocks. Used for purely
  aesthetic preferences.

Style **and formatting violations are hard build errors**, by deliberate choice.
`dotnet format` autofixes the entire formatting class in one command. If
formatting-as-error ever gets in the way, flip `IDE0055` to `suggestion` in
`apps/api/.editorconfig` — that's the one dial to reach for first.

## Analyzers

Three sets run together, all at full strength:

- **Built-in .NET analyzers** (`AnalysisMode=All`)
- **Meziantou.Analyzer** — performance + correctness
- **SonarAnalyzer.CSharp** — code smells + bug patterns

Tuning philosophy is **maximal, tune reactively**: nothing is pre-disabled. When a
rule produces a *genuine* false positive, add an override at the bottom of
`apps/api/.editorconfig` with a one-line justification in this format:

```ini
# <RULE_ID>: <why it's wrong here> — <date/initials>
dotnet_diagnostic.<RULE_ID>.severity = suggestion
```

The one standing exception (a decision, not a reactive suppression): the
"seal your classes" rules `CA1852` and `MA0053` are dropped to `suggestion`,
because deliberate inheritance exists in the domain model.

---

## Architecture & type conventions

These encode our domain-modelling stance. Some are not machine-enforceable.

### Domain models are rich and mutable — not records

Entities and aggregates (e.g. `Project`, `Document`, `Tenant`) are **plain mutable
classes** with:

- **Identity-based equality** (not value equality).
- **Encapsulated state** behind behavioural methods.
- **Invariants enforced inside those methods** during state transitions — including
  the **tenancy invariant**: a persisted entity always carries its `tenant_id` and
  never crosses tenant boundaries.

Records are wrong for entities: their value-equality and immutability bias fights
all three. **Convention (not enforced):** do not model entities or aggregates as
records.

### Where records *are* allowed

- **Value objects** — immutable, value-equality types (e.g. `Money`, `TokenCount`,
  `ModelId`, `TenantId`). Records (or `readonly record struct`) are the right tool here.
- **Parse / wire DTOs** — types we deserialize provider responses or request bodies
  into. Records fit the "store raw, treat fields as optional" tolerance principle.

Records appear at the *edges* (values and the parse layer), never as the entities
in between.

### No primary constructors

**Convention (not enforced — no analyzer cleanly bans them.)** Primary constructors
capture parameters as hidden, mutable fields, which interacts badly with rich
entities that need to assign `readonly` fields and enforce invariants. Use explicit
constructors everywhere, including for DI'd services. The editorconfig disables the
*nudge* toward primary constructors (`csharp_style_prefer_primary_constructors =
false:silent`), but writing one won't fail the build — review catches it.

### Dependency injection

Constructor injection only; no service locator. Services get explicit constructors
that assign `readonly` fields.

---

## Language & style (enforced via `.editorconfig`)

### Namespaces
- **File-scoped**, one per file (`namespace Foo;`).
- Namespace **must match folder structure**.

### `var`
- Use `var` for **built-in types** and **when the type is apparent** from the
  right-hand side (`new T()`, casts, literals).
- **Explicit type everywhere else.**
- Target-typed `new` is the apparent-type counterpart and is preferred where the
  type is already stated.

### Braces
- Required around `if`/`for`/`while`/etc. bodies, **except** when the entire
  statement is a true single line (`if (x) return;`).

### Expression-bodied members
- **Allowed anywhere** the body is a single expression. This is *permission*, at
  `suggestion` level — block bodies are equally fine; neither fails the build.

### Members
- `int`/`string`/etc., never `Int32`/`String`.
- No `this.` qualification.
- Prefer `readonly` fields, auto-properties, modern null/pattern idioms
  (`??`, `?.`, pattern matching over cast/`as`, switch expressions).
- Accessibility modifiers required on all non-interface members.
- Unused assignments must be explicit discards (`_ = ...`).

---

## Naming (enforced via `.editorconfig`, all at `warning`)

| Symbol | Convention | Example |
|---|---|---|
| Interface | `I` + PascalCase | `IModelRouter` |
| Type parameter | `T` + PascalCase | `TResult` |
| Class / struct / enum / delegate | PascalCase | `ResponsePipeline` |
| Method / property / event | PascalCase | `RunAsync` |
| Constant | PascalCase | `MaxRetries` |
| Private / internal field | `_camelCase` | `_modelRouter` |
| Public / protected field | PascalCase | (rare — prefer properties) |
| Parameter / local | camelCase | `projectId` |
| Local function | PascalCase | `ParseLine` |

### Async suffix
Methods returning `Task`/`ValueTask` **end in `Async`**.

**Enforcement gap (review covers it):** the editorconfig naming rule can only match
on the `async` *modifier*, not the return type. A method that returns a `Task`
*without* the `async` keyword (returning the task directly) is **not** caught by the
analyzer — name it correctly by hand.

---

## Async discipline (convention — review-enforced)

- Never `.Result` or `.Wait()` — no sync-over-async blocking.
- No `async void` except event handlers.
- Thread a `CancellationToken` through every async call chain — especially your
  agentic pipeline stages and all model/SSE calls, which must be cancellable.

---

## Formatting

Allman braces (.NET default), 4-space indent, **CRLF for `.cs`** (the repo default is
LF; `.cs` overrides to CRLF for Visual Studio / .NET tooling), UTF-8, final newline, no
trailing whitespace. All machine-enforced; `dotnet format` fixes violations.

---

## Changing a standard

These files *are* the standard — edit them, don't work around them. A reactive
analyzer suppression needs the justification comment described above. A change to a
genuine convention (anything marked **convention** here) should be updated in this
document in the same change so the two never drift.
