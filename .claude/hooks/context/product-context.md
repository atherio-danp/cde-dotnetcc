# {{ProductName}} — product context

> Injected at the start of every session so work always leads with the product vision, not the tech.
> **TEMPLATE — fill in the TODOs for your product.** Edit this file to change what's injected.
> Full spec: `docs/product-overview.md`.

**{{ProductName}} is TODO — one-sentence what-it-is.**
TODO — one sentence on what it is *not*, to set the altitude.

## The moat — TODO
TODO — the durable advantage that compounds with usage.

## Who it's for
TODO — buyer / user / segment.

## Differentiators (why we win)
1. TODO
2. TODO
3. TODO

## First-class invariants (non-negotiable)
- **Tenancy** — `tenant_id` everywhere; Tenant/Organization is the top-level isolation boundary;
  never cross tenant. *(Harness default — remove if this product is single-tenant.)*
- TODO — any other invariant (e.g. data residency).

## Core domain nouns
TODO — your entities (harness examples: Project · Member · Document).

## Stack (decided)
TODO — frontend · API · AI/orchestration · DB · identity · hosting.
*(Harness baseline: Next.js BFF · .NET 10 Web API · MEAI `IChatClient` + MAF · PostgreSQL/Npgsql +
pgvector · SSE streaming.)*

## How we work
Lead with the **product vision, not the tech** — the "why / who / moat" comes first; the stack is
the substrate. Decisions are the owner's. Governance & operating model live in
`docs/projectStandards/` and `.claude/`.
