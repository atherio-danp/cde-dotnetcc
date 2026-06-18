# {{ProductName}} — Implementation-Plan Authoring Standard

> Every non-trivial implementation plan **must** look like this. Plans are **build-from-this
> contracts**, not sketches: per-file/per-symbol detail, full code samples, a locked-decisions
> ledger, an exact named-test list, and status banners with **exact** build/test counts. This
> format is what the implementation **workflow** consumes (driven by the `run-impl-loop` skill).

**Where plans live:** `docs/plans/<topic>.md` (single file) or `docs/plans/<topic>/` with a master
+ `phases/PHASE-N-<NAME>.md` (large work).

## Single-file vs master+phases — the threshold
- **Single file** — one cohesive change, ~5–12 files in one layer, buildable in one sitting. Linear
  `### Step 1…N` inside the doc, full code samples, a `## Files Changed Summary` table.
- **Master + `phases/`** — multi-layer / multi-PR work with ≥3 independently-mergeable units that have
  ordering constraints, *or* any single phase carrying more than a few hundred lines of code samples.
  The master becomes a thin index of locked decisions + roadmap; each phase is its own buildable file.

## House style (non-negotiable)
Exhaustive, evidence-first, decision-led, terse. State the goal **and the scope boundary in the same
breath** (bold what must NOT change). Pin every consequential choice into a **Locked decisions** ledger
with stable IDs (`D1`, `NEW-C`, `Routing`) referenced across master and phases. Detail descends to
**individual symbols and line edits**. Every code sample carries its **absolute target path** and a
**"modelled on `<Existing>.cs:line`"** lineage note. Line/`:line` anchors are **leads, not contracts —
anchor on the symbol name**. Cite external API facts inline with `Source: https://…`. Status banners
carry **exact** counts (`6,558 passed / 0 failed / 3 skipped`), never "tests pass".

---

## Template — MASTER plan

```markdown
# <Feature> — Phased Implementation Plan (Master)

> **Goal**: <one paragraph: precisely what changes — bold the scope word (e.g. **ONLY**) — and, emphatically, what does NOT change>.
> **Detail**: each phase's buildable plan lives under `phases/`; this master is the index + source of locked decisions.
> **Anchors**: `File.cs:line` anchors are code-verified leads — re-confirm on touch.

## 1. Locked decisions (do not revisit without sign-off)
| # | Decision | Resolution |
|---|---|---|
| D1 | <decision> | **<terminal, bolded resolution>** |
| Scope | **Scope boundary** | **<what the change does / does NOT touch>** |

## 2. Implementation roadmap (sequence & dependencies)
| Phase | Area | Layer | Depends on | Detailed plan |
|---|---|---|---|---|
| **1** | <area> | BE/FE/fullstack/ops | — | [PHASE-1-<NAME>.md](phases/PHASE-1-<NAME>.md) |

**Status (live, YYYY-MM-DD):**
- **Phase 1 — <state>.** `dotnet build` <result>; tests <pass/fail/skip>; migrations <n>; residuals <…>.

<prose: merge ordering, what runs in parallel, the per-phase quality gates>.

## 3. Phase 1 — <Name>
**<Area>.** <symbol/file-level digest, citing `File.cs:line`>.
**Tests (testing-expert):** <what gets covered>.

## <N>. Explicitly OUT of scope — <one-line guarantee>
- **<exclusion>** — <named files deliberately untouched, justified>.

## <N+1>. Risks
- **<risk>** — mitigated by <mitigation>.

**No further changes to this plan will be made without your sign-off.**
```

---

## Template — PHASE / single-file plan

```markdown
# Phase N — <Name> (Buildable Plan)

> **STATUS — <state> (YYYY-MM-DD).** <exact build result>; <exact test counts>; <migrations>; <deviations from samples>; <residuals>.

## Reference
- Master plan: [`…/<MASTER>.md`](../<MASTER>.md) **§<n> Phase N** (locked decisions <IDs>).
- **Dependency (consumed, not redefined):** [`PHASE-<m>.md`](PHASE-<m>.md) — <exact symbols + signatures consumed>.

### Contract checklist (confirm against landed code before editing)
- [ ] `<Symbol.Signature(...)>` exists and <behaviour>.

### Locked decisions in force
- **<ID>** — <what it means here>.

### <Tech> API facts (official docs — cited inline)
- <fact>. Source: https://…

## 1. Ordered task checklist
Execute top-to-bottom; build after each lettered group.
### Group A — <theme>
- [ ] **A1** <imperative> (`path/File.cs`).
### Group <X> — Validate
- [ ] **X1** `dotnet build …` — zero warnings.
- [ ] **X2** testing-expert writes the §<n> test list.
- [ ] **X3** `dotnet test …` green.

## 2. Code samples — files to create / modify
### A1 — `path/File.cs`
`<absolute path>` (modelled on `<Existing>.cs:line`).
` ``csharp
<full file, or targeted snippet with precise insertion instructions: "add after `SubscriptionTier` (:34)">
`` `

## <n>. Exact test list (testing-expert)
<paradigm note; e.g. EF in-memory + NSubstitute; no coverage/CRAP gate>
### <Area> tests
- **`Test_Method_Name`** — <one-line assertion of what it guards>.
> **Known coverage gap:** <what the harness cannot verify>.

## <n+1>. Observability
- <spans/tags/meters/sources touched; auto vs manual>.

## <n+2>. OPEN QUESTIONS (decisions, not facts)
1. **<question>** — <options>. *Default: <…>; confirm.*

## <n+3>. Assumptions
- <falsifiable premise the plan rests on>.
```

---

## Rigor checklist (a plan is ready when…)
- [ ] Goal **and** scope boundary stated; bold what must NOT change.
- [ ] Locked-decisions ledger with stable IDs.
- [ ] Every symbol referenced **verified to exist** (the workflow's step-1 analysis enforces this).
- [ ] Code samples carry absolute path + lineage note; line numbers flagged as leads.
- [ ] Ordered checklist ending in a **Validate** group (zero-warning build + green tests).
- [ ] **Exact named-test list** (delegated to testing-expert).
- [ ] OPEN QUESTIONS fenced off from verified facts; Assumptions surfaced; OUT-of-scope named.
- [ ] Status banner uses exact counts, never "tests pass".

<!-- last reviewed: 2026-06-17 -->
