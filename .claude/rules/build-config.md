---
paths:
  - "apps/api/**/Directory.Build.props"
  - "apps/api/**/Directory.Packages.props"
  - "apps/api/**/.editorconfig"
  - "apps/api/**/*.csproj"
  - "apps/api/**/*.props"
  - ".editorconfig"
---

# Build & configuration layout

When editing build/config files, follow the layering decisions in
`docs/projectStandards/build-configuration.md` (authoritative — read it for the full
rationale, the multi-level import snippet, and the Microsoft doc citations). Key rules:

- **.NET governance lives at `apps/api/`** — the lowest common ancestor of
  `apps/api/src` and `apps/api/tests`: `Directory.Build.props`, `Directory.Packages.props`,
  and the C# `.editorconfig`. Do **not** move them to the repo root (the Next.js tree
  doesn't consume them) and do **not** push them down into `src/`.
- **The repo-root `.editorconfig` is `root = true`** and holds shared cross-stack
  formatting only. `apps/api/.editorconfig` is **not** `root = true`, so it layers on top
  of the root one for `.cs` files. The frontend's TS/React rules live in ESLint/Prettier
  under `apps/web`, not in EditorConfig.
- **No `apps/api/src/Directory.Build.props`** — there are no settings unique to
  production code; the `apps/api` baseline fits `src/` exactly.
- **One `Directory.Packages.props`, at `apps/api/`** (Central Package Management): every
  version — including test packages — pinned there; projects reference by name only.
  CPM evaluates the *nearest* file and does **not** merge, so never split it.
- **Test overrides, two mechanisms:** analyzer/style/naming severities → a `[tests/**.cs]`
  section in `apps/api/.editorconfig`; MSBuild *property* differences (`IsPackable=false`,
  test-only analyzers) → a `apps/api/tests/Directory.Build.props` that imports the
  `apps/api` one via `GetPathOfFileAbove`. Add these when the test project is scaffolded.
- **Analyzer tuning is maximal + reactive:** never pre-disable rules; downgrade an
  individual rule only with a justification comment in `.editorconfig`. The only standing
  exceptions are the "seal your classes" rules (CA1852, MA0053), set to suggestion.
