---
paths:
  - "apps/api/**/*.cs"
---

# Backend architecture & layering

Authoritative source: `docs/projectStandards/backend-architecture.md` (read it for the full
rationale, research, and decisions). This rule is the enforceable distillation — it applies
to all C# under `apps/api`.

## Layers are projects; dependencies point inward
```
{{ProjectName}}.Domain ← {{ProjectName}}.Application ← {{ProjectName}}.Infrastructure / {{ProjectName}}.Infrastructure.Persistence ← {{ProjectName}}.Api
{{ProjectName}}.Shared  (no project refs; referenced by all)
```
- **Domain** has **zero** project references — pure domain, no EF/ASP.NET/persistence types.
- **Application** references Domain (+ Shared) only. It defines the **cross-layer interfaces**
  (repositories, external-service abstractions) that Infrastructure implements.
- **Infrastructure / Infrastructure.Persistence** reference Application + Domain. Two projects,
  **one conceptual layer**: `.Persistence` = EF Core/Npgsql (DbContext, configs, repos);
  `.Infrastructure` = every other external concern (providers, storage, identity, email, telemetry).
- **Api** is the composition root, references everything, owns `Program.cs` + DI wiring.
- **Never** let Application reference an Infrastructure project (an `Application→Infrastructure.Email`
  leak is the anti-pattern). Application depends on abstractions only.

## Group by feature, never by technical convention
Inside **every** project, organize by feature slice — `Projects/`, `Documents/`, `Tenancy/` —
**not** `Services/`, `Endpoints/`, `Controllers/`, `Handlers/`. Feature folders **mirror across
projects** (a feature reads end-to-end: `Api/Features/Projects` ↔ `Application/Projects`).

## Interfaces only for cross-layer communication
- A service that lives in **and** is consumed **within** the same layer uses its **concrete type** —
  **no interface**. (Do not "interface everything" — we reject that habit.)
- Interfaces exist **only** when the implementation lives in a different project: repository
  contracts (impl in `.Persistence`), external-service abstractions (impl in `.Infrastructure`).
- Constructor injection only; no service locator. Explicit constructors (no primary constructors).

## DI composition
- One `AddX` extension per infrastructure project (`AddPersistence`, `AddInfrastructure`), composed
  in `Program.cs`. Register repositories by a **hand-rolled assembly-scan loop** (not 40 hand-written
  lines; the `Scrutor` library would need Dan's approval).

@../../../docs/projectStandards/backend-architecture.md
