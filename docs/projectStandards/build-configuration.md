# {{ProductName}} — Build Configuration & Repository Layout

> How the build-governance files are placed across this **monorepo** (Next.js frontend +
> .NET backend), and why. This is a deliberate decision, not an accident of where files
> happened to land.

## Repository layout

```
{{ProductName}}/               ← repo root
│  .editorconfig                   root=true; shared cross-stack formatting ONLY
│  .gitattributes                  LF normalization (.cs → CRLF on checkout)
│  .gitignore
├─ apps/
│  ├─ web/                     ← Next.js (App Router) — owns its own TS/ESLint/Prettier
│  └─ api/                     ← .NET solution root — owns the C# governance
│     │  Directory.Build.props      build/analysis settings for ALL .NET projects
│     │  Directory.Packages.props   Central Package Management — every version pinned once
│     │  .editorconfig              C# style/naming/severities (NOT root=true; layers on root)
│     ├─ src/                  (created at scaffold time)
│     └─ tests/                (a tests/Directory.Build.props may be added — see below)
└─ docs/
```

## The governing principle

**Shared configuration lives at the lowest common ancestor of everything that
shares it — and no higher.** Two consumers, two ancestors:

- The **C# baseline** (analyzers, nullable, central package versions) is shared by
  `apps/api/src` and `apps/api/tests` only. Their lowest common ancestor is
  **`apps/api/`** — so that's where the .NET governance belongs. Putting it at the repo
  root would place it *above* the Next.js tree, which does not consume it.
- **Cross-stack formatting** (charset, final newline, base indent) is shared by
  *everything*, so it lives in the **repo-root `.editorconfig`** (`root = true`).

The frontend (`apps/web`) is governed by **ESLint + Prettier + a strict `tsconfig`**, the
JS-ecosystem analogue of the .NET analyzer set — not by EditorConfig or MSBuild. See
[frontend-standards.md](frontend-standards.md).

## How the tools find these files

### MSBuild (`.props`)
Per Microsoft's [Customize the build by folder](https://learn.microsoft.com/en-us/visualstudio/msbuild/customize-by-directory):

> MSBuild walks the directory structure upwards from your project location,
> stopping after it locates a *Directory.Build.props* file.

A project at `apps/api/src/{{ProjectName}}.Domain/` walks up to `apps/api/`, finds the file
there, and applies it. **The solution file's location is irrelevant** to this search.

### EditorConfig (the two-level layering)
EditorConfig also walks upward, merging files until it hits one marked `root = true`.
`apps/api/.editorconfig` is **deliberately not** `root = true`: for a `.cs` file it merges
the C# rules there with the shared formatting in the repo-root file, then stops at the
root. This is how the C# standard layers cleanly on top of the shared one without
duplicating it.

## Decision 1 — No `apps/api/src/Directory.Build.props`

Microsoft's docs illustrate a three-level layout (root + `src` + `test` props files),
but that example exists to *demonstrate the merging mechanism*. The doc's own wording is
conditional: it "**might be desirable**." The rule is: **create an inner
`Directory.Build.props` only when that level has settings that genuinely differ from its
parent.** We have no settings that apply only to production code — the `apps/api`
baseline fits `src/` exactly — so we **do not create one**.

## Decision 2 — Test overrides, two mechanisms

Tests want the full baseline *minus a few rules*. That's an **override** relationship,
not exclusion. Two places handle the two kinds of difference:

1. **Analyzer / style / naming severities** → a path-scoped section in
   `apps/api/.editorconfig`:

   ```ini
   [tests/**.cs]
   # relaxations for test code go here (already seeded: async-suffix rule off)
   ```

   Because the section appears *after* the `[*.cs]` rules, its settings win for test
   files. No extra file required.

2. **MSBuild properties** (e.g. `IsPackable=false`, a test-only analyzer package like
   `xunit.analyzers`) → an **`apps/api/tests/Directory.Build.props`**. Because MSBuild
   stops at the first props file it finds, this inner file must re-enter the upward scan
   by importing the `apps/api` one:

   ```xml
   <Import Project="$([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../'))"
           Condition="'' != $([MSBuild]::GetPathOfFileAbove('Directory.Build.props', '$(MSBuildThisFileDirectory)../'))" />
   ```

   This file is **added when the test project is scaffolded**, not before.

## Decision 3 — One `Directory.Packages.props`, at `apps/api/`

Central Package Management is **not** split per level. Per Microsoft's
[Central Package Management](https://learn.microsoft.com/en-us/nuget/consume-packages/central-package-management)
guidance, you create one file at the root of the .NET tree, and when multiple exist
"the file **closest** to a given project's directory will be evaluated for it" — NuGet
picks the nearest single file, it does **not merge**. Splitting would strip projects of
central versioning. So **all** versions — including test-only packages — live in the
single `apps/api/Directory.Packages.props`; projects reference them by name only.

## Current status

Only the **`apps/api` governance files** exist today — `src/` and `tests/` are not yet
scaffolded, and `apps/web` is not yet created. `apps/api/Directory.Packages.props` already
pins the **analyzer** packages (Meziantou, SonarAnalyzer) and the **test toolchain**
(`Microsoft.NET.Test.Sdk`, `xunit`, `xunit.runner.visualstudio`, `coverlet.collector`); the
**runtime** package versions are deliberately deferred to scaffold time — several
`Microsoft.Agents.AI.*` packages still carry a prerelease tag and must be version-verified
then (see the commented "expected set" inside that file). When the .NET test project is scaffolded:

- Wire the test `.csproj` to reference the already-pinned test packages (add `xunit.analyzers`
  only if you want a dedicated analyzer beyond xunit's transitive set).
- Add the `[tests/**.cs]` relaxations to `apps/api/.editorconfig` as they prove necessary
  (the section is already seeded).
- Add `apps/api/tests/Directory.Build.props` (with the import snippet above) if any
  test-specific MSBuild *property* is needed.

When `apps/web` is scaffolded, its ESLint/Prettier/tsconfig land there (see
frontend-standards.md). No repo-root .NET build file is planned.
