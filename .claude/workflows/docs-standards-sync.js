export const meta = {
  name: 'docs-standards-sync',
  description: 'Detect drift between our standards/governance docs and the actual code/config. One agent per doc compares its claims to reality; returns a consolidated drift report with proposed fixes. Proposes only — never edits.',
  phases: [
    { title: 'Audit' },
  ],
}

// args: { docs?: string[] } — defaults to the core standards + governance docs.
const DEFAULT_DOCS = [
  'docs/projectStandards/coding-standards.md',
  'docs/projectStandards/build-configuration.md',
  'docs/projectStandards/backend-architecture.md',
  'docs/projectStandards/frontend-standards.md',
  'docs/projectStandards/implementation-plan-format.md',
  'docs/product-overview.md',
]
const docs = (args && Array.isArray(args.docs) && args.docs.length) ? args.docs : DEFAULT_DOCS

const DRIFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    doc: { type: 'string' },
    drift: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },     // what the doc asserts
          reality: { type: 'string' },   // what the code/config actually is
          location: { type: 'string' },  // file/section evidence
          proposal: { type: 'string' },  // proposed fix (to the doc OR the code)
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['claim', 'reality', 'location', 'proposal', 'severity'],
      },
    },
  },
  required: ['doc', 'drift'],
}

phase('Audit')
log(`Auditing ${docs.length} doc(s) for drift vs the actual code/config.`)
const results = await parallel(
  docs.map((doc) => () =>
    agent(
      `Compare the standards/governance doc at \`${doc}\` against the ACTUAL code and config in this repo, and report DRIFT — places where the doc no longer matches reality. Look for: referenced files/paths/symbols that don't exist; settings the doc asserts (e.g. in \`.editorconfig\`, \`Directory.Build.props\`/\`Directory.Packages.props\`, \`settings.json\`, rules) that differ from what's actually configured; rules/decisions the doc states that the code structurally contradicts; stale "status"/locked-decision claims. Read the doc, then verify each load-bearing claim against the real files (Glob/Serena/Read). For each drift item give: the claim, the reality (with file evidence), a proposed fix (update the DOC or the CODE — say which), and a severity. Do NOT edit anything — propose only. If the doc is in sync, return an empty drift array.`,
      { label: `audit:${doc.split('/').pop()}`, phase: 'Audit', schema: DRIFT_SCHEMA },
    ),
  ),
)

const reports = results.filter(Boolean)
const totalDrift = reports.reduce((n, r) => n + (r.drift ? r.drift.length : 0), 0)
log(`${totalDrift} drift item(s) across ${reports.length} doc(s).`)

return {
  totalDrift,
  reports, // the MAIN agent reviews these and decides what to update (propose-only; no auto-apply)
}
