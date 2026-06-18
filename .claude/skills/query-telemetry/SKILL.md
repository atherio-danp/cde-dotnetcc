---
name: query-telemetry
description: Query the {{ProductName}} observability stack (OTLP → Grafana/Loki/Tempo/Prometheus) for logs, traces, and metrics during diagnosis. Use when investigating an issue via telemetry — errors, latency, request traces, custom metrics. Preloaded by the rca-investigator agent.
argument-hint: <environment> <query>
allowed-tools: Read, Bash
---

# Query telemetry ({{ProductName}})

Query our self-hosted observability stack to see what actually happened. Queries the OTLP/Grafana stack:
**Loki** (logs, LogQL), **Tempo** (traces, TraceQL), **Prometheus** (metrics, PromQL). Telemetry is emitted per the
`otel-instrumentation` skill (sources/meters are `{{ProjectName}}.<Feature>`).

> **⚠ Endpoints & auth are PLACEHOLDERS.** No observability stack is deployed yet. Fill these in once it exists
> (your OTLP/Grafana endpoint); until then this is the agreed *shape* — ask Dan for specifics. Tokens come from
> env / a vault; never hardcode.

## Environment configuration (PLACEHOLDER — fill at deploy)
| Environment | Grafana / data-source endpoints | Auth |
|---|---|---|
| **prod** | Loki `<LOKI_URL_PROD>` · Tempo `<TEMPO_URL_PROD>` · Prometheus `<PROM_URL_PROD>` | `<token via env/vault>` |
| **test** | `<…_TEST>` | `<token via env/vault>` |

## Query commands (PLACEHOLDER)
```bash
# Logs (LogQL) — e.g. via logcli or the Loki HTTP API:
logcli --addr="$LOKI_URL_PROD" query '{service="{{ProjectName}}-api"} |= "error"' --since=1h -o jsonl
# Metrics (PromQL) — Prometheus HTTP API:
curl -s --get "$PROM_URL_PROD/api/v1/query" --data-urlencode 'query=<PROMQL>'
# Traces (TraceQL) — Tempo HTTP API:
curl -s --get "$TEMPO_URL_PROD/api/search" --data-urlencode 'q=<TRACEQL>'
```

## What's where
| Signal | Store / language | Notes |
|---|---|---|
| **Logs** | Loki / **LogQL** | Structured logs; correlate by `TraceId`/`SpanId` (OTel log correlation). |
| **Traces / spans** | Tempo / **TraceQL** | Spans from `{{ProjectName}}.<Feature>` ActivitySources; HTTP + EF Core auto-instrumentation. |
| **Metrics** | Prometheus / **PromQL** | Counters/histograms from `{{ProjectName}}.<Feature>` meters. |

## Discipline
- **All times UTC.**
- **No secrets/PII in telemetry** — and don't print any that slipped in; flag it as a finding (it's an A09 issue).
- **Discover tenants dynamically**; never hardcode ids. Be careful with high-cardinality labels.
- Quote query results as evidence; correlate logs↔traces↔metrics by trace id.

## Steps
1. Pick the environment (`$0`, default `prod`) and signal (logs/traces/metrics).
2. Run the query against the right store.
3. Present results cleanly and tie them back to the hypothesis under test.
