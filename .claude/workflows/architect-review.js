export const meta = {
  name: 'architect-review',
  description: 'Run the relevant reviewers (backend/frontend/fullstack architects + backend security auditor) in parallel for rule-adherence, security (OWASP/tenancy/residency), and bug hunt, then adversarially verify each finding line-by-line. Returns findings tagged real/noise for the main agent\'s final triage.',
  phases: [
    { title: 'Review' },
    { title: 'Verify' },
  ],
}

// args: { scope?: string[], changedPaths?: string, planPath?: string }
// Robust against args arriving as a JSON string (observed: some harness invocations stringify the
// args object, which silently dropped an explicit `scope` and defaulted to backend-only review).
const a = typeof args === 'string' ? JSON.parse(args) : (args || {})
const scope = (Array.isArray(a.scope) && a.scope.length ? a.scope : ['backend'])
const changed = a.changedPaths || 'the current git diff (run `git diff` to see it)'
const planPath = a.planPath || null

const LENSES = {
  backend: { agentType: 'architect-backend', what: 'the .NET backend under apps/api' },
  frontend: { agentType: 'architect-frontend', what: 'the Next.js frontend under apps/web' },
  fullstack: { agentType: 'architect-fullstack', what: 'the API↔BFF seam across apps/api and apps/web' },
  security: { agentType: 'security-auditor-backend', what: 'backend security — OWASP Top 10, tenant isolation, secret handling, EU data residency' },
}

const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file: { type: 'string' },
          symbol: { type: 'string' },
          line: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
          kind: { type: 'string', enum: ['rule', 'bug'] },
          title: { type: 'string' },
          detail: { type: 'string' },
        },
        required: ['file', 'severity', 'kind', 'title', 'detail'],
      },
    },
  },
  required: ['findings'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    real: { type: 'boolean' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    evidence: { type: 'string' },
    reason: { type: 'string' },
  },
  required: ['real', 'confidence', 'evidence', 'reason'],
}

const planNote = planPath ? ` The change implements the plan at \`${planPath}\`.` : ''

phase('Review')
const lenses = scope.filter((s) => LENSES[s])
log(`Reviewing ${changed} with architects: ${lenses.join(', ')}`)
const reviews = await parallel(
  lenses.map((s) => () =>
    agent(
      `Review ${changed} — focus on ${LENSES[s].what}.${planNote} Check adherence to the project rules in .claude/rules/** AND hunt for real bugs. Report each as a structured finding (file, symbol, severity, kind rule|bug, title, detail). Be specific and verifiable — each finding will be adversarially checked line-by-line, so do not pad with speculation.`,
      { agentType: LENSES[s].agentType, label: `review:${s}`, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
  ),
)

const allFindings = reviews.filter(Boolean).flatMap((r) => (r.findings || []))
log(`${allFindings.length} raw finding(s); verifying each adversarially.`)

phase('Verify')
const verified = await parallel(
  allFindings.map((f) => () =>
    agent(
      `Adversarially verify this architect finding by reading the actual code line-by-line. Decide REAL (a genuine bug or rule violation you can prove from the source) vs NOISE (unprovable, handled elsewhere, or a style nit). Default to NOISE if uncertain.\nFinding:\n${JSON.stringify(f, null, 2)}`,
      { agentType: 'findings-verifier', label: `verify:${f.file || '?'}`, phase: 'Verify', schema: VERDICT_SCHEMA },
    ).then((v) => ({ finding: f, verdict: v })),
  ),
)

const results = verified.filter(Boolean)
const real = results.filter((r) => r.verdict && r.verdict.real === true)

return {
  scope: lenses,
  rawCount: allFindings.length,
  verifiedReal: real.length,
  // The MAIN agent does the final line-by-line triage on these — verdicts are a pre-filter, not the decision.
  findings: results,
}
