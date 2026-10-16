export const meta = {
  name: 'spec-part-b',
  description: 'Write Part B (engineering spec + build plan) under the PM product spec, critique it through lenses, fix, critique the whole, fix',
  phases: [{ title: 'Write' }, { title: 'Critique 1' }, { title: 'Fix 1' }, { title: 'Critique 2' }, { title: 'Fix 2' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  mainSha: '<sha>',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  decisions: '/path/to/scratch/decisions.md',   // decision log from the interview (O/D/E)
  survey: '/path/to/scratch/survey.json',       // survey workflow result
  template: null,                               // a previous spec with a good Part B ('/path/to/repo/specs/NN_….md'), or null
  ownerRules: 'No owner-personal examples in product text.', // product-wide rules the owner set
  specFormat: '/abs/path/to/skill/references/spec-format.md', // subagents don't know where the plugin is installed
  testing: '/abs/path/to/skill/references/testing.md',
  releaseScope: 'stop after the gate',          // the owner's answer: stop after the gate | commit and push | deploy
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo}, main at ${CONFIG.mainSha}. Spec file: ${CONFIG.spec} (keep its front matter).
Inputs: decision log ${CONFIG.decisions} (owner answers O*, owner defaults D*, engineering decisions E* — binding);
code survey ${CONFIG.survey}; ${CONFIG.template ? `structural model ${CONFIG.template}` : `no earlier Part B exists: follow ${CONFIG.specFormat}`}.
Rules: no product code changes; never touch other specs; never read secrets; no git, no docker. Every file:line ref
you cite must be verified against the current tree. Owner rules: ${CONFIG.ownerRules}`

const LENSES = [
  { key: 'ai', prompt: 'LENS: AI and prompts. Load the Claude API skill first if Anthropic calls are involved. Check prompt versioning (released prompts immutable), cache friendliness (per-row data never in system blocks), injection framing, what each call sees, fake-provider hooks and how tests prove it.' },
  { key: 'privacy', prompt: 'LENS: privacy, security, leaks. User text never in logs, job results, error columns or foreign audit rows; DB error messages carrying row values; emails/exports (escaping, formula injection); third parties receiving data; limits enforced at every entry point.' },
  { key: 'data', prompt: 'LENS: data model, tenancy, concurrency, migration, release. DDL and test pins, tenancy/guards, lock order, races (in-flight background jobs), carry-over paths, downgrade, rehearsal needs, post-deploy checks, canonical numbers unchanged or regenerated on purpose.' },
  { key: 'ux', prompt: 'LENS: frontend and UX. Every owner default implemented, states (empty/filled/read-only/loading/error), phone width with no horizontal scroll, 44 px targets on each control own box, a11y names, copy placement, mocks, E2E placement and ordering constraints, conflicts with nearby specs.' },
  { key: 'plan', prompt: `LENS: completeness and build plan. Every Part A requirement and every O/D decision maps to a section, a test and a workstream with an Owns list; departures in B0; workstreams have disjoint files (contract step first); DoD includes the full test suite; docs list complete; owner-defaults section present; no TBDs. The test plan meets "Tests first" points 1–2 and "Rules for contract-time tests" in ${CONFIG.testing} and the Test plan / Ownership rows of ${CONFIG.specFormat}.` },
]
const FIND = { type: 'object', properties: { findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, section: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'section', 'problem', 'fix'] } } }, required: ['findings'] }

phase('Write')
await agent(`${BASE}

TASK: write Part B, the engineering spec and build plan, into ${CONFIG.spec}:
- Rewrite only the header status quote (product session + spike, technical interview with decisions, engineering spec date; Part A kept as the PM wrote it; Part B wins where they differ, B0 lists departures; the build starts only after the owner's "go").
- "# Part A — Product (PM, <date>)" containing the PM's sections VERBATIM.
- "# Part B — Engineering spec" with a baseline paragraph and every section of ${CONFIG.specFormat} (B0 departures … test plan … ownership and workstreams … execution and release … decisions … acceptance criteria … owner-overridable defaults in plain language).
- The TEST PLAN, the contract file table (one acceptance file per owner) and the handover sentence exactly as "Tests first" points 1–2 in ${CONFIG.testing} and the Test plan / Ownership rows of ${CONFIG.specFormat} say.
- Release scope chosen by the owner: ${CONFIG.releaseScope}. Write it into "Execution and release"; post-deploy checks are written either way (the owner runs them on their own release).
- Exact names, signatures, DDL, JSON shapes, copy, prompt text drafts, test names. No TBDs: decide engineering matters yourself with a reason.
Return a short summary and every decision you made beyond the decision log.`, { label: 'write-part-b', phase: 'Write' })

const critique = async (round, lenses, phaseName) => {
  const res = await parallel(lenses.map(l => () => agent(`${BASE}

You are an adversarial reviewer of Part B of ${CONFIG.spec} (round ${round}). READ-ONLY. ${l.prompt}
Verify claims against the code. Report only real problems: wrong facts/refs, contradictions with Part A or the decision log, missing requirements, unbuildable or ambiguous instructions, risks to money/tenancy/privacy. Severity: blocker = would produce a wrong or unsafe build; major = a builder would get it wrong or a requirement is missing; minor = clarity. Each with a concrete fix.`, { label: `critique${round}:${l.key}`, phase: phaseName, schema: FIND })))
  return res.filter(Boolean).flatMap((r, i) => r.findings.map(f => ({ lens: lenses[i] ? lenses[i].key : '?', ...f })))
}
const fix = (findings, label, phaseName) => agent(`${BASE}

Apply these review findings to Part B of ${CONFIG.spec} (Part A stays verbatim). For each: fix it, or reject it with a one-line reason after checking the code. Keep Part B consistent everywhere a fix touches (B0, decisions, tests, workstreams, docs list, defaults). Return per finding "applied" or "rejected: reason", then any new decisions.
FINDINGS:\n${JSON.stringify(findings, null, 1)}`, { label, phase: phaseName })

phase('Critique 1')
const f1 = await critique(1, LENSES, 'Critique 1')
log(`round 1: ${f1.length} findings (${f1.filter(f => f.severity === 'blocker').length} blocker, ${f1.filter(f => f.severity === 'major').length} major)`)
phase('Fix 1')
const fix1 = await fix(f1, 'fix-1', 'Fix 1')

phase('Critique 2')
const f2 = await critique(2, [{ key: 'whole', prompt: `LENS: whole-spec second pass after round-1 fixes: every lens above (AI, privacy, data/release, UX, plan) for remaining blockers/majors, and internal consistency after the edits. Round-1 fix report: ${String(fix1).slice(0, 6000)}` }], 'Critique 2')
let fix2 = 'no findings'
if (f2.length) { phase('Fix 2'); fix2 = await fix(f2, 'fix-2', 'Fix 2') }
return { round1: f1, fix1, round2: f2, fix2 }
