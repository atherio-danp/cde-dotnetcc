---
paths:
  - "apps/api/**/*.cs"
---

# C# coding conventions

The two files imported below are the **authoritative, complete** C# standard for this
repo — the written conventions plus the machine-enforced rule set. Follow them when
writing or modifying any C# file under `apps/api`. The build enforces most of this
(warnings are errors), so violations fail compilation regardless.

For version-specific .NET 10 / C# 14 behavior (new language features, API signatures,
analyzer rules) and Microsoft Agent Framework / `Microsoft.Extensions.AI` APIs, prefer
the **Microsoft Learn MCP** (`microsoft_docs_search` / `microsoft_docs_fetch`) over
training-data assumptions — it returns current, first-party Microsoft docs. This stack
post-dates the model's training cutoff.

Conventions that are **not** machine-enforced (review-upheld), so keep them top of
mind: rich **mutable** DDD entities — never records; **no primary constructors**;
async discipline (`CancellationToken` everywhere, no `.Result`/`.Wait()`, no
`async void`). Tenancy: `tenant_id` is a first-class invariant on every persisted
entity. The standards doc covers these in full.

<!-- If these @imports are not expanded inline (rules-file import support is
     undocumented), treat the two paths as required reading and open them with the
     Read tool before writing C#. They are the source of truth. -->

@../../docs/projectStandards/coding-standards.md

@../../apps/api/.editorconfig
