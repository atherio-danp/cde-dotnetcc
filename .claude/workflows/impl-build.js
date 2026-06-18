export const meta = {
  name: 'impl-build',
  description: 'Implement a plan (or a focused slice / fix-list), validate it in a loop until clean, then write the plan\'s exact tests. Reconciles a stale plan to the real code (bounded), surfaces every deviation, and stops on a material/blocking divergence. Returns implementation + deviations + validation verdict + test results.',
  phases: [
    { title: 'Implement' },
    { title: 'Validate' },
    { title: 'Test' },
  ],
}

// args: { planPath: string, focus?: string, maxFixes?: number, skipTests?: boolean }
// (a bare string is treated as the plan path)
const planPath = (args && args.planPath) || (typeof args === 'string' ? args : null)
const focus = (args && args.focus) || 'the entire plan'
const maxFixes = (args && args.maxFixes) || 3
const skipTests = Boolean(args && args.skipTests)

if (!planPath) {
  return { error: 'impl-build requires a plan path (args.planPath or a bare string).' }
}

const IMPL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['completed', 'blocked'] },
    buildClean: { type: 'boolean' },
    filesChanged: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { path: { type: 'string' }, change: { type: 'string' } },
        required: ['path', 'change'],
      },
    },
    deviations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          planAssumed: { type: 'string' },
          reality: { type: 'string' },
          action: { type: 'string' },
          rationale: { type: 'string' },
          severity: { type: 'string', enum: ['minor', 'notable', 'blocking'] },
        },
        required: ['planAssumed', 'reality', 'action', 'severity'],
      },
    },
    blocker: { type: 'string' },
    recommendedOptions: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['status', 'buildClean', 'filesChanged', 'deviations', 'summary'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pass: { type: 'boolean' },
    buildClean: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          symbol: { type: 'string' },
          problem: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
        },
        required: ['file', 'problem', 'severity'],
      },
    },
    summary: { type: 'string' },
  },
  required: ['pass', 'buildClean', 'issues', 'summary'],
}

const ADAPT = `The plan may be STALE (written earlier; symbols may have been renamed/re-signatured/moved). Do not blindly follow stale plan text and do not stop on the first mismatch: reconcile to the ACTUAL code (verify with Serena), preserving the plan's intent, with the SMALLEST change. If the gap is material — a locked decision is invalidated, the approach no longer works, the fix is large/ambiguous, or a new library would be needed — set status="blocked", do only what is safe, and return the blocker + recommended options. REPORT every off-plan change in deviations (planAssumed → reality → action → why).`

const deviations = []

phase('Implement')
log(`Implementing ${focus} from ${planPath}`)
const implemented = await agent(
  `You are implementing an APPROVED implementation plan. Read the plan at \`${planPath}\` in full, then implement: ${focus}.
Follow the plan's code samples, file paths, and locked decisions, and obey every rule in .claude/rules/**. Edit C# (.cs) only through the Serena MCP tools (native Edit/Write on .cs is blocked). Build (\`dotnet build\` / \`npm run build\`) and fix compile errors before returning. Add no third-party library without approval. Stay in scope.
${ADAPT}`,
  { agentType: 'implementer', label: 'implement', phase: 'Implement', schema: IMPL_SCHEMA },
)
if (implemented && Array.isArray(implemented.deviations)) deviations.push(...implemented.deviations)

// Material divergence: stop and hand the decision back to the main agent.
if (implemented && implemented.status === 'blocked') {
  log('Implementer is BLOCKED on a material divergence — returning for the main agent to resolve.')
  return {
    planPath,
    focus,
    blocked: true,
    blocker: implemented.blocker || implemented.summary,
    recommendedOptions: implemented.recommendedOptions || [],
    deviations,
    implemented,
    validated: false,
    tests: null,
  }
}

phase('Validate')
let verdict = await agent(
  `Validate the implementation of "${focus}" against the plan at \`${planPath}\` and the rules in .claude/rules/**. Confirm every planned file/symbol exists with the right signature, all rules are honored, and the build is clean (zero warnings).
The plan may be stale: where the implementation reconciles to the real code and the implementer REPORTED the deviation, that is acceptable — judge against intent + reality, not stale text. FAIL unreported deviations, locked-decision changes, or scope creep. Reported deviations to account for:\n${JSON.stringify(deviations, null, 2)}
Report only — do not edit.`,
  { agentType: 'validator', label: 'validate', phase: 'Validate', schema: VERDICT_SCHEMA },
)

let fixAttempts = 0
while (verdict && verdict.pass !== true && fixAttempts < maxFixes) {
  fixAttempts++
  log(`Validation failed — fix attempt ${fixAttempts}/${maxFixes} (${verdict.issues.length} issue(s))`)
  const fix = await agent(
    `The validator rejected the implementation of "${focus}". Fix EXACTLY these issues and rebuild — no unrelated changes:\n${JSON.stringify(verdict.issues, null, 2)}\nPlan: \`${planPath}\`. Edit C# via Serena. Build clean before returning.\n${ADAPT}`,
    { agentType: 'implementer', label: `fix-${fixAttempts}`, phase: 'Validate', schema: IMPL_SCHEMA },
  )
  if (fix && Array.isArray(fix.deviations)) deviations.push(...fix.deviations)
  if (fix && fix.status === 'blocked') {
    log('Fix attempt hit a material divergence — returning for the main agent to resolve.')
    return {
      planPath, focus, blocked: true,
      blocker: fix.blocker || fix.summary,
      recommendedOptions: fix.recommendedOptions || [],
      deviations, implemented, validation: verdict, fixAttempts, validated: false, tests: null,
    }
  }
  verdict = await agent(
    `Re-validate "${focus}" against the plan at \`${planPath}\` and the rules (accounting for reported deviations as above). Report only.`,
    { agentType: 'validator', label: `revalidate-${fixAttempts}`, phase: 'Validate', schema: VERDICT_SCHEMA },
  )
}

let tests = null
if (!skipTests) {
  phase('Test')
  tests = await agent(
    `Write the tests for "${focus}" exactly as specified in the plan's "Exact test list" at \`${planPath}\`, using the project's approved test stack (do not introduce a new test library without approval). Run the suite and report EXACT pass/fail/skip counts. If a test reveals a real defect, report it — never weaken or skip a test to get green.`,
    { agentType: 'testing-expert', label: 'tests', phase: 'Test' },
  )
}

return {
  planPath,
  focus,
  blocked: false,
  implemented,
  deviations,
  validated: verdict ? verdict.pass === true : false,
  validation: verdict,
  fixAttempts,
  exhaustedFixBudget: verdict ? verdict.pass !== true : false,
  tests,
}
