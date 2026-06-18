---
paths:
  - "apps/api/**"
---

# Tenancy & data residency — first-class invariants

Tenancy is non-negotiable and auto-loads for **everything** under `apps/api`; data residency (e.g. EU residency)
applies as a first-class constraint if your product requires it. They complement (don't duplicate)
`domain-model.md`, `persistence.md`, and `api-design.md`. Full rationale: `docs/product-overview.md` §16,
`docs/projectStandards/backend-architecture.md` §7.3.

## Tenancy — `tenant_id` everywhere, never cross-tenant
- **Every persisted entity carries a non-null `tenant_id`.** A Tenant/Organization is the **top-level isolation
  boundary**; nothing crosses it.
- **Every read and write is scoped to the current tenant.** EF Core **named query filters** (`TenantFilter`)
  apply automatically; **fail closed** — no tenant context ⇒ **no rows / explicit error**, never "all rows".
- **`IgnoreQueryFilters()` is a privileged, audited bypass** behind an explicit system-context type — never a
  casual per-repo escape hatch. Treat every use as a security-reviewed exception.
- **Enforce `tenant_id` on writes** inside aggregate factory/behaviour methods (filters only constrain reads);
  the domain factory sets it and never lets it change.
- **PostgreSQL Row-Level Security (RLS)** is the in-database backstop — `tenant_id` predicates as `CREATE POLICY`
  enforced regardless of the ORM. The app filter is for ergonomics; RLS is the hard guarantee.
- **Object-level authz (IDOR):** loading an entity by a client-supplied id must verify the caller's tenant (and
  permission) owns it — a tenant-scoped query is necessary but confirm ownership, never trust the id alone.
- **Never bind request bodies onto entities** (overposting can set `tenant_id`/role) — bind to DTOs.
- Documents, projects, outputs, audit events — all **tenant-scoped**; there is no cross-company sharing/marketplace.

## Data residency — a first-class constraint (e.g. EU residency, if your product requires it)
- **If your product requires it, keep all data in-region** — storage (object storage on your host), database
  (PostgreSQL on your host), identity (your OIDC provider), and **model calls** (your LLM provider as the
  in-region default; any out-of-region fallback is a governed, region-checked policy decision, not a hard-coded call).
- **No out-of-region egress** — including the Next.js BFF (no out-of-region edge regions, no out-of-region analytics/telemetry).
- **Document where data goes for every external call.** The Model Router resolves model policy + data-region
  before any provider call; outbound URLs are allowlisted (SSRF) and region-checked.
- **Secrets/PII never leave the boundary and never enter logs/telemetry** (see the security auditor + OTel rules).

When in doubt about whether something is tenant-safe or region-resident, **stop and flag it** — these invariants
matter, not a checkbox.
