---
name: otel-instrumentation
description: Add or change OpenTelemetry tracing, metrics, and structured logging in the .NET API (apps/api) — OTLP exporter setup, custom ActivitySource spans, IMeterFactory metrics, log/trace correlation. Use when adding observability, custom spans/metrics, or troubleshooting distributed traces.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__replace_regex
---

# OpenTelemetry for the {{ProductName}} .NET API

Adapted for our stack: **OTLP → self-hosted Grafana/Tempo/Loki/Prometheus on your (EU) host** — **never** Azure
Monitor / Application Insights. EF Core on **Npgsql** (not SqlClient). C# (`.cs`) edits go through **Serena**
(native Edit/Write on `.cs` is blocked). Follows `docs/projectStandards/backend-architecture.md` and the
backend rules. **Every NuGet package below needs Dan's explicit approval before adding** — the OTel packages
are the CNCF standard but still dependencies (no library without approval).

## 1. Packages (flag for approval)
```
OpenTelemetry.Extensions.Hosting              # required for DI integration
OpenTelemetry.Instrumentation.AspNetCore
OpenTelemetry.Instrumentation.Http
OpenTelemetry.Exporter.OpenTelemetryProtocol  # OTLP — traces, metrics AND logs through one exporter
OpenTelemetry.Instrumentation.EntityFrameworkCore   # NOT .Instrumentation.SqlClient — we're on Npgsql
# OpenTelemetry.Instrumentation.Runtime       # optional GC/thread metrics
# OpenTelemetry.Exporter.Console              # DEV ONLY — never in production
```
Do **not** install `OpenTelemetry` alone — you need `.Extensions.Hosting` for DI.

## 2. Configure all three signals in `Program.cs` (via Serena)
`builder.Services.AddOpenTelemetry()` → `.ConfigureResource(r => r.AddService("{{ProjectName}}-api"))` →
- `.WithTracing(t => t.AddAspNetCoreInstrumentation(o => o.Filter = ctx => !ctx.Request.Path.StartsWithSegments("/health")).AddHttpClientInstrumentation(o => o.RecordException = true).AddEntityFrameworkCoreInstrumentation().AddSource("{{ProjectName}}.*"))`
- `.WithMetrics(m => m.AddAspNetCoreInstrumentation().AddHttpClientInstrumentation().AddMeter("{{ProjectName}}.*"))`
- `.WithLogging(l => l.IncludeScopes = true)`
- `.UseOtlpExporter();`  — reads `OTEL_EXPORTER_OTLP_ENDPOINT`; point it at our collector. Default gRPC **4317**;
  for HTTP set `OtlpExportProtocol.HttpProtobuf` (**4318**). **Prometheus OTLP ingestion needs explicit opt-in.**

## 3. Logs correlate automatically
`.WithLogging()` stamps every log with `TraceId`/`SpanId` and propagates the resource — no extra packages.

## 4. Custom spans
- `private static readonly ActivitySource ActivitySource = new("{{ProjectName}}.<Feature>");` — **the source name MUST
  exactly match an `AddSource("{{ProjectName}}.*")` filter** or spans are silently dropped (the #1 bug).
- `using var activity = ActivitySource.StartActivity("ProcessProject");` then `activity?.SetTag("project.id", id)`,
  child spans with `ActivityKind.Client`, `activity?.SetStatus(ActivityStatusCode.Error, msg)`.
- Prefer `_logger.LogError(ex, ...)` over `activity?.RecordException(ex)` (OTel is deprecating span-event exceptions).

## 5. Custom metrics — via `IMeterFactory` (DI), not `new Meter()`
- `_meter = meterFactory.Create("{{ProjectName}}.<Feature>");` then `CreateCounter<long>` / `CreateHistogram<double>` /
  `CreateUpDownCounter<int>`; record with a `TagList` for dimensions.
- The metrics class uses an **explicit constructor** assigning `readonly` fields (**no primary constructors**),
  registered `AddSingleton<…Metrics>()`.

## 6. Context propagation across queues/pipeline stages
Automatic over HTTP; for your agentic pipeline / any message hop, `Inject`/`Extract` with
`Propagators.DefaultTextMapPropagator` + `PropagationContext`/`Baggage`, then start the downstream activity
with the extracted `ActivityContext` as parent.

## Conventions (ours)
- **Naming:** ActivitySources and Meters are `{{ProjectName}}.<Feature>` (match our namespaces).
- **Cardinality + tenancy:** `tenant_id` may be a **span attribute** (useful for tracing), but **never a metric
  dimension** if tenant count is non-trivial (cardinality blowup). No user IDs / UUIDs / request IDs as metric
  tags. Be mindful of EU residency — don't ship PII in telemetry attributes.
- **Pitfalls:** null `StartActivity` → source-name mismatch; missing traces → wrong OTLP port/protocol;
  `ActivitySource` is static, `Meter` comes from the factory.
