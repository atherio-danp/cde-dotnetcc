---
name: security-backend
description: Audit the .NET backend (apps/api) for security issues against OWASP Top 10 mapped to .NET/Minimal API/EF Core (Npgsql), plus tenant isolation, secret handling, and EU data residency. Use when reviewing backend changes for security, or running a backend security audit. Preloaded by the security-auditor-backend agent.
allowed-tools: Read, Glob, Grep, Bash, Skill, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern
---

# Backend security audit ({{ProductName}} .NET API)

The procedure for a backend security review. The full, cited check catalog is in
[`reference/owasp-dotnet-checks.md`](reference/owasp-dotnet-checks.md) (OWASP A01–A10 mapped to our stack +
.NET caveats + a top-15 shortlist). This is **backend-specific** — the frontend has its own auditor.

## Procedure
1. **Load the catalog** — read `reference/owasp-dotnet-checks.md`. It's the authority; don't re-derive checks.
2. **Scope** — identify what changed / what to audit (a diff, a feature, or the whole `apps/api`). Ground in the
   actual code via Glob/Serena; the tenancy rule (`.claude/rules/backend/tenancy.md`) auto-loads here.
3. **Scan by category** — walk A01→A10, flagging concrete violations with `grep`/Serena evidence. Prioritize the
   **top-15 shortlist** (blast-radius × likelihood) first.
4. **Complement, don't duplicate** — items tagged `[OVERLAP]` are already covered by our rules (tenancy /
   persistence / result-and-errors / logging). For those, **verify the rule actually holds at the security
   boundary** (e.g. a cross-tenant read, an overposting privilege escalation, an error-detail disclosure, a
   secret/PII egress) rather than re-flagging the style concern.
5. **Classify** — Critical (auth bypass / cross-tenant read / SQLi / RCE / secret exposure) · High · Medium.
   Tenant-isolation and EU-residency failures are **always Critical** — they're the product's reason to exist.
6. **Report** — per finding: file + symbol (+ line as a lead), severity, the OWASP category, the concrete
   violation, the **fix**, and a **reference URL** from the catalog. Be specific and verifiable (findings get
   adversarially checked).

## Stack-specific hot spots (where to look first)
- **Tenancy:** every EF query / `FromSql` / raw SQL carries a `tenant_id` predicate; global filter present;
  `IgnoreQueryFilters()` audited; RLS as backstop. Writes set `tenant_id` in the domain factory.
- **Authz:** every Minimal API route `RequireAuthorization()` / deny-by-default fallback; IDOR on id lookups.
- **Injection:** `FromSqlInterpolated` not `FromSqlRaw`+string; EF 10 raw-SQL analyzer on.
- **Overposting:** bind to DTOs, never entities.
- **Errors:** ProblemDetails only; no stack traces; `EnableSensitiveDataLogging`/`EnableDetailedErrors` Dev-only.
- **Egress (SSRF + residency):** `IHttpClientFactory`, allowlisted EU-region outbound to model providers/pipeline.
- **Secrets/PII:** none in `appsettings`/source/logs/OTel; JWT fully validated (CA5404); cookie flags set.
- **Deps:** NuGetAudit incl. transitive; any new package is a Dan-approval decision (no-library rule).
