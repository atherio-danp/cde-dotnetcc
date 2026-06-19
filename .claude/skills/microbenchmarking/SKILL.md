---
name: microbenchmarking
description: Create, run, configure, and interpret BenchmarkDotNet microbenchmarks in the .NET API — measure and compare approaches, runtime configs, or package versions. Use when proving a performance change, comparing implementations, or validating a hot-path optimization. (Not for profiling or load testing.)
allowed-tools: Read, Glob, Grep, Bash, mcp__serena__initial_instructions, mcp__serena__get_symbols_overview, mcp__serena__find_symbol, mcp__serena__find_referencing_symbols, mcp__serena__find_declaration, mcp__serena__find_implementations, mcp__serena__search_for_pattern, mcp__serena__get_diagnostics_for_file, mcp__serena__list_dir, mcp__serena__find_file, mcp__serena__create_text_file, mcp__serena__replace_symbol_body, mcp__serena__insert_after_symbol, mcp__serena__insert_before_symbol, mcp__serena__replace_content, mcp__serena__rename_symbol, mcp__serena__safe_delete_symbol
---

> **Serena MCP is mandatory for C# code.** First call `mcp__serena__initial_instructions` to load the Serena tool manual, then use the Serena tools for ALL `.cs` reading / searching / navigation / creation / editing — prefer symbol navigation (`get_symbols_overview` / `find_symbol` / `find_referencing_symbols`) over whole-file reads. Native `Edit`/`Write` on `.cs` is hook-blocked (the TS/React frontend uses the native tools).

# Microbenchmarking with BenchmarkDotNet ({{ProductName}})

Use this to turn a perf claim (often from `dotnet-performance-review`) into **measured evidence**. C# (`.cs`)
benchmark files are written via **Serena**.

> **⚠ Library approval required.** BenchmarkDotNet is a third-party NuGet package. It is the de-facto .NET
> standard, but per our governance it needs **Dan's explicit approval** before being added (likely to a
> dedicated `*.Benchmarks` project, not the product projects). Do not add it silently.

## Concepts
- **Benchmark case** = one method × one param combo × one job (the atomic measured unit).
- Benchmarks are **comparative**: a single run can compare *approaches*, *runtime configuration*, or *package
  versions* (e.g. LLM-provider-client versions, GC settings). Hardware/OS and historical comparisons need separate runs.

## Cost-aware job presets
`--job Dry` (<1s, correctness only) → `--job Short` (5–8s, dev iteration) → Default (15–25s, final) →
`--job Medium`/`--job Long` (max confidence). Start cheap, escalate.

## CLI
```
dotnet add package BenchmarkDotNet        # only after approval
dotnet run -c Release -- --filter "*MethodName" --noOverwrite > benchmark.log 2>&1
```
Always **Release**. Use `--filter` (with `BenchmarkSwitcher`, or `BenchmarkRunner` to run directly) so it
doesn't hang waiting for input.

## Writing workflow
1. **Plan** — pick the use case (coverage suite / investigation / change-validation / throwaway) and the
   comparison axis; justify the cost (preset).
2. **Implement** — `[Benchmark]` methods that **return** their result (so the JIT can't elide them); init in
   `[GlobalSetup]` (never in the benchmark body); **no manual loops**; mark the reference `[Benchmark(Baseline = true)]`;
   store inputs in fields or `[Params]`/`[ParamsSource]`, **not literals**; `[MemoryDiagnoser]` for allocations.
3. **Validate** — `--job Dry` to confirm it compiles/runs → one representative case at defaults → full suite.

Key attributes: `[Benchmark]`, `[Benchmark(Baseline=true)]`, `[MemoryDiagnoser]`, `[Params]`, `[ParamsSource]`,
`[Arguments]`, `[GlobalSetup]`, `[IterationSetup]`.

## Ours
- Benchmark classes/methods are `.cs` → write via Serena.
- **LLMs routinely write bad BenchmarkDotNet code from stale assumptions** — measure correctly (return values,
  setup outside the body, no loops) and treat a single noisy run with skepticism.
- A benchmark is the evidence behind a perf change; cite the numbers (mean, allocations, ratio-to-baseline) when
  proposing the optimization back to Dan.
