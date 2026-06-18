---
name: dotnet-ai-stack
description: Choose and wire AI features in the .NET backend — LLM calls, agentic tool-calling/multi-step workflows, RAG/vector search, structured output, streaming. Use when adding or changing anything that talks to a model or orchestrates agents (your agentic pipeline). Tailored to our LLM provider + MAF + pgvector stack.
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__search_for_pattern, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol
---

# AI/ML technology selection & wiring ({{ProductName}})

Our substrate is **`Microsoft.Extensions.AI` (MEAI, the `IChatClient` seam) + Microsoft Agent Framework (MAF,
`Microsoft.Agents.AI`)**, provider = **your LLM provider**, vectors = **pgvector on our PostgreSQL**,
hosting = **your (EU) host**. This skill adapts Microsoft's `technology-selection` guidance to those decisions.
Read with `docs/projectStandards/backend-architecture.md` (your agentic pipeline). C# (`.cs`) edits via **Serena**.

> **⚠ Every AI package needs Dan's approval.** Several `Microsoft.Agents.AI.*` are still `--prerelease`; the
> LLM provider client and vector providers are dependencies. The expected set is noted in `apps/api/Directory.Packages.props`,
> but confirm each at scaffold time. Never add silently.

## Task → technology
| Need | Use |
|---|---|
| Single prompt → response | **`IChatClient`** (MEAI) |
| Tool calling / multi-step / multi-agent | **MAF (`Microsoft.Agents.AI`, `ChatClientAgent`)** over MEAI — **do NOT hand-roll tool dispatch on `IChatClient`** |
| RAG / vector search | `Microsoft.Extensions.VectorData.Abstractions` + **pgvector** (our Postgres) — **NOT Azure AI Search** |
| Streaming to the browser | `GetStreamingResponseAsync` / `IAsyncEnumerable` → our **SSE relay** through the Next.js BFF |

**Layers (never skip one):** MEAI abstraction (always) → provider SDK wired via `AddChatClient(...)` → MAF for
orchestration. **Provider = your LLM provider** (not hardwired to one vendor) — wire it behind
`IChatClient` (the abstraction is exactly our swap-point; keep provider specifics at the edge). Never mix a raw
`HttpClient`-to-provider call with MEAI in the same flow.

## Guardrails (the substance — apply these)
- **LLM calls:** set `Temperature = 0f` + `MaxOutputTokens`; use `GetResponseAsync<T>` for **structured output**;
  **pin dated model ids** (don't float "latest"); count tokens before sending; never hardcode keys.
- **Agentic (MAF):** cap iterations (`AgentInvokeOptions { MaximumIterations = N }`); enforce a **token budget per
  execution**; give tools **explicit schemas**; prefer single-agent until multi is justified. **NEVER log raw
  `message.Content`** — log metadata only (PII/secrets + **EU residency**). This reinforces your agentic pipeline design.
- **RAG:** cache embeddings; semantic chunking; a relevance threshold (e.g. `MinimumScore ≈ 0.75`); **source
  attribution**; batch embedding calls.
- **Non-determinism:** validate the structured-output schema; graceful fallback (rule-based) on malformed output;
  keep an eval harness + golden dataset; pinned model versions.
- **Perf/cost:** `IHttpClientFactory`; response/semantic caching; **stream** rather than buffer; health checks.

## Anti-patterns (ours + Microsoft's)
- **No `Microsoft.SemanticKernel`** for new code — superseded by MEAI + MAF.
- Don't implement tool loops manually on `IChatClient` — use MAF.
- No Azure services (Azure OpenAI / Azure AI Search / Key Vault) — your LLM provider + pgvector + our own secrets mechanism
  (env / user-secrets / our vault), EU-resident.
- No keys in committed config; no records-as-entities / primary constructors in the AI code (our standards hold here too).
- ML.NET / ONNX / Ollama / Copilot SDK paths from the upstream skill are out of scope for now (we're
  LLM-orchestration-first) — but its **structured-output, streaming, and non-determinism** guidance applies directly.

## Validate
`dotnet build -c Release` (warnings = errors) and tests per the plan. Trace model/agent calls via `otel-instrumentation`.
