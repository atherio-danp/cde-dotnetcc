# {{ProductName}} — Product Overview

> **TEMPLATE.** This is the vision/domain/roadmap doc for the product built on this harness.
> Replace every `TODO` below before real work begins. The harness reads nothing from here at
> runtime except via the SessionStart stub (`.claude/hooks/context/product-context.md`), which
> you should fill in to match. Keep this doc the single source of truth for the *why*.

## 1. What it is
TODO — one sharp paragraph: what the product is, and what it is *not*.

## 2. The moat / why we win
TODO — the durable advantage. What compounds with usage?

## 3. Who it's for
TODO — buyer, user, segment, the wedge.

## 4. Differentiators
TODO — the 3–4 reasons a customer picks this over the alternatives.

## 5. First-class invariants (non-negotiable)
- **Tenancy** — `tenant_id` everywhere; a Tenant/Organization is the top-level isolation
  boundary; never cross tenant. *(Harness default — delete if single-tenant.)*
- TODO — any other non-negotiable (data residency, compliance, latency, …).

## 6. Core domain nouns
TODO — the entities and their relationships (the harness examples use `Project` · `Member` ·
`Document`; replace with yours).

## 7. Stack (decided)
TODO — frontend · API · orchestration/AI · database · identity · hosting · streaming.
*(Harness baseline: Next.js BFF · .NET 10 Web API · EF Core on PostgreSQL/Npgsql ·
Microsoft.Extensions.AI `IChatClient` + MAF for agentic work · SSE streaming. Swap freely.)*

## 8. Roadmap
TODO.

## How we work
Lead with the **product vision, not the tech**. Decisions are the owner's. Governance &
operating model live in `docs/projectStandards/` and `.claude/`.
