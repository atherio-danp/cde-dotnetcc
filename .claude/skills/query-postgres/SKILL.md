---
name: query-postgres
description: Run read-only SQL against the {{ProductName}} PostgreSQL database to investigate or verify data during diagnosis. Use when asked to query the database directly or check actual data behind an issue. Preloaded by the rca-investigator agent.
argument-hint: <environment> <sql-query>
allowed-tools: Read, Bash
---

# Query PostgreSQL ({{ProductName}})

Run a **read-only** SQL query against your PostgreSQL connection to get *actual data* during an
investigation. Wraps `psql` for read-only queries against Postgres.

> **⚠ Connection details are PLACEHOLDERS.** No database is provisioned yet. Fill these in once the
> Postgres instance exists; until then, treat this skill as the agreed *shape* and ask Dan for connection specifics.
> Secrets (host/user/password) come from env / a vault — **never** hardcode or commit them.

## Environment configuration (PLACEHOLDER — fill at provisioning)
| Environment | Host | Database | Auth |
|---|---|---|---|
| **prod** | `<PG_HOST_PROD>` | `<DB_PROD>` | `<user via env/vault — read-only role>` |
| **test** | `<PG_HOST_TEST>` | `<DB_TEST>` | `<user via env/vault>` |
| **local** | `localhost` | `<db>` | local dev creds |

Default environment if unspecified: **prod** (read-only).

## Connection command (PLACEHOLDER)
```bash
# Prefer a connection URI from an env var; use a READ-ONLY role for investigation.
psql "$PG_URL_<ENV>" -v ON_ERROR_STOP=1 -P pager=off -c "<SQL_QUERY>"
# e.g. PG_URL_PROD="postgresql://<readonly_user>@<host>:5432/<db>?sslmode=require"
```

## Discipline
- **Read-only only** — `SELECT`/`EXPLAIN`. Anything destructive (`DROP`/`TRUNCATE`/unqualified `DELETE`/`UPDATE`)
  is blocked/prompted by the `protect-commands` hook and is **never** part of an investigation.
- **All times UTC.** Use `timestamptz`; display `AT TIME ZONE 'UTC'`.
- **Discover tenants dynamically** — never hardcode tenant ids/names. *(Tenant-discovery query depends on the
  final schema — PLACEHOLDER, e.g. `SELECT id, name FROM tenants ORDER BY name;`.)*
- **Never select or print secrets/PII** beyond what the investigation needs; respect EU residency.
- Parameterize where the harness allows; never build SQL by string-concatenating untrusted input.

## Steps
1. Pick the environment (`$0`, default `prod`).
2. Run the query via `psql` with the read-only connection.
3. Present results cleanly; cite them as evidence in the diagnosis.
