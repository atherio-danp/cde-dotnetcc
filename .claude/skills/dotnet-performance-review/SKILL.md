---
name: dotnet-performance-review
description: Scan .NET/C# code for performance anti-patterns (async, memory/strings, collections/LINQ, regex, serialization, I/O) with tiered severity, reporting findings without editing. Use when auditing hot paths, reviewing allocation-heavy code, or analyzing the API for optimization opportunities.
allowed-tools: Read, Glob, Grep, Bash, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__search_for_pattern
---

# .NET performance review (read-only scan)

A **static, read-only** anti-pattern scanner for the {{ProductName}} .NET API — it reports, it does **not** edit. Pairs
with the `architect-backend` review and `microbenchmarking` (to confirm a fix with evidence). Aligns with our
`coding-standards.md` and async-discipline rules.

**Inputs:** the source to scan (required); hot-path context + target framework (`.NET 10`); depth =
`critical-only` / `standard` (default) / `comprehensive`.

## Workflow
1. **Signal detection → topics.** Scan for signals and select topics: `async`/`await`/`Task`/`ValueTask` →
   async; `Span<`/`stackalloc`/`ArrayPool`/`Substring`/`.Replace`/`.ToLower`/`+=` in loops → memory & strings;
   `Regex`/`[GeneratedRegex]` → regex; `Dictionary<`/`List<`/`.ToList()`/LINQ → collections; `JsonSerializer`/
   `HttpClient`/`Stream` → I/O & serialization.
2. **Scan & confirm with grep** (emit a checklist with **exact hit counts**; 0 hits is a valid finding):
   - `grep -n '\.Substring('` · `grep -En '\.(StartsWith|EndsWith|Contains)\s*\('` (missing `StringComparison`) ·
     `grep -n '\.ToLower()\|\.ToUpper()'` (use `StringComparison.OrdinalIgnoreCase`) ·
     `grep -n 'new HttpClient('` (check for `IHttpClientFactory` first) ·
     `grep -n 'RegexOptions.Compiled'` vs `grep -n 'GeneratedRegex'` (prefer source-gen for literal patterns) ·
     `grep -n 'static readonly Dictionary<'` (FrozenDictionary candidate **only if never mutated**).
   - **Verify-the-inverse:** for absence patterns report the ratio (e.g. "3 of 7 use `StringComparison`").
3. **Classify:** 🔴 Critical (deadlock/crash/security/>10×), 🟡 Moderate (2–10× / hot-path best practice),
   ℹ️ Info. Hot-path code elevates severity; 11–50 instances bump Info→Moderate, 50+ = systematic. Report counts.
4. **Report** compactly per finding: `#### ID. Title (N instances)` / Impact / Files as `File.cs:L42` /
   Fix / optional Caveat — grouped by severity, ending in a summary table. Close with the non-determinism caveat
   (an LLM scan is a lead, not proof — confirm hot-path wins with `microbenchmarking`).

## Correctness rules (don't over-flag)
- `Memory<T>` not `Span<T>` in **async** methods (aligns with our async discipline).
- LINQ only on **hot paths** (since .NET 7 `Min/Max/Sum/Average` are vectorized — no blanket ban).
- `ConfigureAwait(false)` only in **library** code (e.g. `{{ProjectName}}.Shared`), not in the API/handlers.
- `ValueTask` only for frequently-synchronous hot paths; `[GeneratedRegex]` only for compile-time-literal patterns.
- Never recommend `unsafe` / `CollectionsMarshal.AsSpan` without **benchmarked** evidence.

## Our deviation from the upstream scanner
The Microsoft version flags **unsealed classes** as a structural perf finding. **We do not** — our standard
deliberately drops "seal your classes" (`CA1852`/`MA0053` → suggestion) because the domain model uses
intentional inheritance. **Skip the unsealed-class finding** (or scope it strictly to internal non-domain hot
types), and never propose sealing domain entities/aggregates.
