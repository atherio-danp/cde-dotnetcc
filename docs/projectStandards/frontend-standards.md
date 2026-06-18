# {{ProductName}} — Frontend (TypeScript / React / Next.js) Standards

> The single source of truth for how we write the `apps/web` frontend. The C# side has
> a strict analyzer set; this is its JS-ecosystem analogue — **ESLint + Prettier + a
> strict `tsconfig`**, enforced in the build and CI. Like the C# standard, the philosophy
> is *strict from day one* on a greenfield codebase.

**Baseline:** Next.js (App Router, latest stable) · React (server components) · TypeScript
strict · Node 22 LTS.

> **Status: not yet applied.** `apps/web` is not scaffolded. This document specifies the
> target configuration so that when `create-next-app` runs, these settings are merged in
> rather than rediscovered. The concrete config files (`eslint.config.mjs`, `.prettierrc`,
> `tsconfig.json`) are created at scaffold time, not now — Next.js generates its own
> baselines that we then tighten to match this doc.

## Where the rules will live

| File | Enforces |
|---|---|
| `apps/web/tsconfig.json` | TypeScript strictness (the compiler is the first analyzer). |
| `apps/web/eslint.config.mjs` | Lint rules (flat config): `next/core-web-vitals` + `typescript-eslint` (type-checked). |
| `apps/web/.prettierrc` | Formatting — the one autofix command, like `dotnet format`. |
| Repo-root `.editorconfig` | Shared charset / final newline / 2-space indent for web files. |
| This document | The *why*, plus conventions no linter enforces. |

## Severity model

CI runs `tsc --noEmit`, `eslint .`, and `prettier --check`. **Any error fails the build**
— the same warnings-as-errors stance as the .NET side. Prettier owns formatting entirely;
never hand-format or argue style in review.

## TypeScript — strict, no escape hatches

- `"strict": true` plus `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `exactOptionalPropertyTypes`, `noFallthroughCasesInSwitch`.
- **No `any`.** Use `unknown` at boundaries and narrow. ESLint
  `@typescript-eslint/no-explicit-any` is an error.
- **No non-null `!`** to silence the compiler — handle the null. (`no-non-null-assertion`.)
- **Explicit return types** on exported functions and React components.
- Prefer `type` aliases for unions/objects; `interface` only when declaration-merging or
  `extends` is genuinely needed.

## React / Next.js conventions

- **Server-first.** Default to React Server Components. Add `"use client"` only when the
  component needs interactivity, browser APIs, or stateful hooks — and push it to the leaf.
- **The frontend is a thin BFF.** `apps/web` proxies the .NET API and **relays the SSE
  token stream** to the browser; it does not own business logic, model routing, or
  persistence. Route handlers proxy; the .NET API decides.
- **Streaming** uses SSE end-to-end — the .NET API streams tokens, a Next.js route handler
  relays them. Prefer first-party Next.js streaming docs; this post-dates the cutoff.
- **Data fetching:** be explicit about `fetch` caching (`cache`/`revalidate`); never cache
  tenant-scoped or user data across requests.

## Naming & files

- **Components** `PascalCase`; the file matches the export (`ProjectPanel.tsx`).
- **Functions / variables / hooks** `camelCase` (hooks start with `use`).
- **Non-component files** `kebab-case` (`model-router.ts`, `use-project.ts`).
- **No default exports** for shared modules — named exports only. Next.js convention files
  (`page.tsx`, `layout.tsx`, route handlers) are the required exception.
- Folder structure mirrors routing under `app/`; shared code in `lib/`, `components/`.

## Security & data residency (review-enforced)

- **No secrets in client code.** Anything in a client component or prefixed `NEXT_PUBLIC_*`
  is shipped to the browser and is public. Provider keys, tenant data, and tokens stay in
  server components / route handlers / the .NET API.
- **EU data residency applies to the BFF too, if your product requires it** — don't route
  data through non-EU edge regions or third-party analytics that egress the EU. This mirrors
  the backend's residency constraint.
- Validate and type all data crossing the API boundary (e.g. Zod) — never trust a shape.

## Changing a standard

This file *is* the standard — edit it, don't work around it. When a lint rule is genuinely
wrong for a case, disable it inline with a one-line justification comment (the eslint
analogue of the `.editorconfig` suppression policy), and prefer a scoped disable over a
global one.
