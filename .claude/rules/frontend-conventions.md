---
paths:
  - "apps/web/**/*.ts"
  - "apps/web/**/*.tsx"
  - "apps/web/**/*.js"
  - "apps/web/**/*.jsx"
  - "apps/web/**/*.mjs"
---

# Frontend (Next.js / React / TypeScript) conventions

The authoritative standard is `docs/projectStandards/frontend-standards.md` — read it
before writing or changing frontend code. Quality is machine-enforced by ESLint +
Prettier + a strict `tsconfig` (configured at scaffold time), the JS-ecosystem analogue
of the C# strict analyzer set.

Stack reality:
- **Next.js App Router** + React server/client components. Routing, server components,
  `fetch` caching, and **SSE/streaming** idioms post-date the training cutoff — prefer
  first-party docs (`nextjs.org`, `react.dev`) over memory and flag uncertainty.
- `apps/web` is a **thin BFF**: it proxies the .NET API and relays the SSE token stream
  to the browser. Keep business logic in the .NET API, not the frontend.

Conventions (most are lint-enforced; the rest are review-upheld):
- **TypeScript strict** — no `any` (use `unknown` + narrowing); no non-null `!` to silence
  the compiler; explicit return types on exported functions.
- **Server-first** — default to React Server Components; mark `"use client"` only when
  interactivity/state genuinely requires it.
- **Naming** — `PascalCase` components, `camelCase` functions/vars, `kebab-case` files
  (except components which match their export). No default exports for shared modules
  (Next.js route files are the exception).
- **No secrets in client code** — anything under a client component or `NEXT_PUBLIC_*` is
  public. Provider keys and tenant data stay server-side.
- **Data residency** (e.g. EU residency, if your product requires it) still applies in the BFF: don't route data through out-of-region edges.

<!-- If these @imports are not expanded inline, treat the path below as required reading. -->

@../../docs/projectStandards/frontend-standards.md
