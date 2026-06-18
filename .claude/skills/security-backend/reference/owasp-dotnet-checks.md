# Backend security checks — OWASP Top 10 (2021) mapped to .NET 10 / Minimal API / EF Core (Npgsql)

The auditor's knowledge base. Each check = **rule** (what to flag) · **why** · **ref**. Items tagged
**[OVERLAP: x]** mean an existing {{ProductName}} rule already covers the *style* concern — here, verify it holds at the
**security boundary** (don't re-flag the same thing). Stack assumptions: Minimal APIs, EF Core 10 on Npgsql,
JWT and/or cookie auth, multi-tenant (`tenant_id`), EU data residency.

## A01 — Broken Access Control · https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **Every Minimal API route is authorized** — flag any `MapGet/Post/Put/Delete` without `.RequireAuthorization()`/`[Authorize]` and not deliberately `.AllowAnonymous()`. Prefer a **fallback authorization policy** (deny-by-default). · A missing check on one route exposes resources; routes are opt-in to auth. · https://learn.microsoft.com/aspnet/core/fundamentals/minimal-apis/security?view=aspnetcore-10.0
- **Deny-by-default** via framework filters/middleware, not ad-hoc per-handler `if` checks. · Per-endpoint checks are forgotten. · https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- **Object-level authz (IDOR)** — flag handlers that load an entity by client-supplied id and return it without verifying caller ownership/access. · Predictable ids → horizontal escalation. · Authorization Cheat Sheet
- **Multi-tenant isolation — every query filtered by `tenant_id`** — flag any EF query / `FromSql` / raw SQL reading-or-writing tenant data without a tenant predicate; expect the global query filter **and** a per-query assertion. · One unscoped query crosses tenants — worst-case breach. **[OVERLAP: tenancy]** · https://owasp.org/Top10/A01_2021-Broken_Access_Control/
- **Mass assignment / overposting** — flag binding request bodies directly onto EF entities; require a request **DTO** exposing only client-editable fields. · Extra JSON can set `TenantId`/`IsAdmin`. **[OVERLAP: persistence]** · https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html
- **Server-side enforcement only** — flag access decisions relying on hidden fields, client flags, or `NEXT_PUBLIC_*`. · Client checks are trivially bypassed.
- **Cookie-auth APIs return 401/403, not login redirects.** · APIs must signal auth failure programmatically. · https://learn.microsoft.com/aspnet/core/security/authentication/api-endpoint-auth?view=aspnetcore-10.0

## A02 — Cryptographic Failures · https://owasp.org/Top10/A02_2021-Cryptographic_Failures/
- **No secrets in source/config** — flag connection strings / API keys / signing keys in `appsettings*.json` or code; require User Secrets (dev) / a vault (prod). · Config is source-controlled. · https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- **HTTPS + HSTS in prod** (`UseHttpsRedirection`, `UseHsts`, TLS 1.2+). · Protects data in transit; blocks downgrade. · https://learn.microsoft.com/aspnet/core/security/enforcing-ssl?view=aspnetcore-10.0
- **Strong password hashing** (PBKDF2/bcrypt/Argon2 + salt; prefer Identity's hasher). · Fast/unsalted hashes fall to cracking.
- **No sensitive data in logs** — PII, tokens, passwords, full bodies. **[OVERLAP: logging]** · https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- **DataProtection keys persisted + encrypted-at-rest in prod (EU region)** — flag in-memory keys (lost on restart → cookies/CSRF break). · https://learn.microsoft.com/aspnet/core/security/data-protection/configuration/default-settings?view=aspnetcore-10.0

## A03 — Injection · https://owasp.org/Top10/A03_2021-Injection/
- **Parameterized SQL only** — flag `FromSqlRaw`/`ExecuteSqlRaw` with concatenated/`$"…"`-interpolated user input; require `FromSql`/`FromSqlInterpolated`/`ExecuteSqlInterpolated` (params → `DbParameter`). Keep EF Core 10's raw-SQL-concat analyzer ON. · The classic EF SQLi hole. · https://learn.microsoft.com/ef/core/querying/sql-queries#passing-parameters
- **Allowlist non-parameterizable fragments** (table/column/`ORDER BY`) — flag direct interpolation; map through a hardcoded allowlist. · Identifiers can't bind as params. · SQL Injection Prevention Cheat Sheet
- **Least-privilege DB role** — flag connecting as a superuser/owner; require a scoped Npgsql role (no DDL/DBA). · Limits injection blast radius.
- **Log injection** — flag untrusted values logged without CR/LF neutralization. **[OVERLAP: logging]**
- **OS-command building** — flag `Process.Start` with shell-concatenated input; require `ArgumentList` + allowlist.

## A04 — Insecure Design · https://owasp.org/Top10/A04_2021-Insecure_Design/
- **Rate limiting present** (`AddRateLimiter`/`UseRateLimiter`) on auth, password-reset, and expensive pipeline/model endpoints. · Throttles brute-force, credential-stuffing, cost/DoS abuse of model calls. · https://learn.microsoft.com/aspnet/core/performance/rate-limit?view=aspnetcore-10.0
- **Anti-enumeration** — login/register/reset responses don't reveal account existence; account lockout present.
- **Request size limits** (reject oversized bodies with 413). · Resource-exhaustion DoS.
- **Server-side workflow-state validation** for multi-step flows. · Stops skipped-step abuse.

## A05 — Security Misconfiguration · https://owasp.org/Top10/A05_2021-Security_Misconfiguration/
- **No verbose errors in prod** — flag `UseDeveloperExceptionPage`/`EnableDetailedErrors` reachable outside Development; require `UseExceptionHandler` + `AddProblemDetails` returning a generic payload. · Stack traces leak internals. **[OVERLAP: result-and-errors]** · https://learn.microsoft.com/aspnet/core/fundamentals/error-handling-api?view=aspnetcore-10.0#problem-details
- **Security headers** — `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` (sensitive), `CSP: frame-ancestors 'none'`; strip `Server`/`X-Powered-By`. · MIME-sniffing, clickjacking, fingerprinting. · REST Security Cheat Sheet
- **CORS not wildcard-with-credentials** — flag `AllowAnyOrigin()` (esp. with `AllowCredentials()`); require explicit `WithOrigins(...)`. · Enables cross-site credential theft. · https://learn.microsoft.com/aspnet/core/security/cors?view=aspnetcore-10.0#set-the-allowed-origins
- **Constrain verbs / content types** (405 / 415). · Blocks verb tampering, MIME confusion.

## A06 — Vulnerable & Outdated Components · https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/
- **NuGetAudit on incl. transitive; CI fails on advisories** — run `dotnet list package --vulnerable` (+`--deprecated`). · Surfaces CVEs before exploitation. · https://learn.microsoft.com/nuget/concepts/auditing-packages
- **Fix or justify** every advisory; CPM transitive pinning in `Directory.Packages.props`; suppressions need written justification. **[OVERLAP: no-library/build-config]**

## A07 — Identification & Authentication Failures · https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/
- **JWT fully validated** — flag config disabling signature/issuer/audience/lifetime validation; require all true. Enable analyzer **CA5404**. · Forged/expired/wrong-audience tokens get through. · https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0 · https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca5404
- **Reject `alg:none`**, verify `iss`/`aud`/`exp`/`nbf`.
- **Cookie flags** (cookie auth) — `HttpOnly`, `Secure`, `SameSite`. · XSS theft / MITM / CSRF.
- **Sensible session/token lifetime**; short timeouts; absolute expiry where warranted.
- **No weak token/id generation** — use a CSPRNG.

## A08 — Software & Data Integrity Failures · https://owasp.org/Top10/A08_2021-Software_and_Data_Integrity_Failures/
- **No `BinaryFormatter`/unsafe deserialization** — use `System.Text.Json` for untrusted input. · RCE risk.
- **Safe `System.Text.Json`** — flag polymorphic deserialization on attacker-controlled type discriminators / over-broad targets (ties to overposting). · Type-confusion.
- **Supply-chain integrity** — CPM pinned versions, nuget.org as audit source. · Dependency-confusion.

## A09 — Security Logging & Monitoring Failures · https://owasp.org/Top10/A09_2021-Security_Logging_and_Monitoring_Failures/
- **Security events logged** — auth success/failure, access-control failures, validation failures, admin actions, token-validation failures (when/where/who/what). · Breaches go undetected otherwise. · Logging Cheat Sheet
- **No secrets/PII in logs or OTel spans** — passwords, tokens, keys, connection strings, PII. **[OVERLAP: logging/otel]**
- **`EnableSensitiveDataLogging` OFF outside Development.** · Logs parameter values → PII/passwords leak. · https://learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew#security-related-improvements
- **Tamper-evident logs** — append-only/read-only sink. · Detect attackers erasing tracks.

## A10 — SSRF · https://owasp.org/Top10/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/
- **Allowlist outbound URLs** — flag outbound HTTP (model providers, pipeline callbacks, webhooks) built from user input without an approved scheme+host allowlist; block internal/link-local/metadata IPs. · Reaches internal services / metadata. · .NET Security Cheat Sheet
- **Don't blindly follow redirects or forward raw responses** for user-influenced requests.
- **Use `IHttpClientFactory`** for all egress (typed/named clients) — flag `new HttpClient()`/static. Centralizes timeouts + SSRF guards + **EU-region egress**. · https://learn.microsoft.com/dotnet/core/extensions/httpclient-factory#consumption-patterns

## .NET-specific caveats (cross-cutting)
- `EnableSensitiveDataLogging`/`EnableDetailedErrors` gated to Development only.
- `FromSqlRaw`/`ExecuteSqlRaw` never take interpolated/concatenated user strings (use `FromSqlInterpolated`).
- Bind to **DTOs not entities**; non-bindable props `[BindNever]`/private-set (overposting on `TenantId`/role).
- DataProtection keys persisted + encrypted-at-rest in prod (EU).
- **Anti-forgery (CSRF)** for any cookie-authenticated state-changing endpoint (pure bearer-JWT is not CSRF-susceptible).
- `IHttpClientFactory` for all provider/pipeline egress.
- JWT validation flags all true; CA5404 enabled.
- **ProblemDetails (RFC 9457) is the only error surface** — no exception detail to clients.

## Top 15 highest-value backend checks (blast-radius × likelihood)
1. Multi-tenant isolation — every query scoped to `tenant_id` (A01).
2. Every Minimal API endpoint authorized; deny-by-default fallback policy (A01).
3. No `FromSqlRaw`/`ExecuteSqlRaw` with interpolated/concatenated input (A03).
4. Bind to DTOs not entities — overposting on `TenantId`/`IsAdmin` (A01).
5. Object-level authz (IDOR) on every id-based lookup (A01).
6. JWT validation: signature+issuer+audience+lifetime on; CA5404 (A07).
7. `EnableSensitiveDataLogging` OFF in prod (A09).
8. No verbose errors; `UseExceptionHandler` + ProblemDetails, no stack traces (A05).
9. No secrets in `appsettings`/source; vault + User Secrets (A02).
10. CORS not `AllowAnyOrigin` (never with credentials) (A05).
11. HTTPS + HSTS in prod (A02).
12. SSRF allowlist on outbound model-provider/pipeline URLs; block internal IPs (A10).
13. Rate limiting on auth + expensive/model endpoints (A04).
14. NuGetAudit (incl. transitive) fails CI; `dotnet list package --vulnerable` (A06).
15. No secrets/PII/tokens in logs or OTel; security events logged (A09).
