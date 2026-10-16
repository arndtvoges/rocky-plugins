export const meta = {
  name: 'expedited-build',
  description: 'Expedited track: short Part B → backend + contract → frontend + E2E → one verifier (diff + real browser) → at most one fix',
  phases: [{ title: 'Spec' }, { title: 'Backend' }, { title: 'Frontend' }, { title: 'Verify' }, { title: 'Fix' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  mainSha: '<sha>',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  mockup: '/path/to/scratch/mockups.html',   // the approved mockup page, or null
  look: 'Option A of the mockup (describe the approved look in one paragraph: layout, states, copy).',
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker; never read secrets; fake providers only; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production; no owner-personal examples in product text.',
  backendOnly: false,   // set true to skip the frontend agent
  frontendOnly: false,  // set true for a pure reskin (no Part B writer, no backend agent)
  beDod: 'Backend DoD: lint/format/types/guards; your test paths; the foundation tests; the FULL backend suite (you run alone); API schema regeneration leaves no diff on a second run; canonical-data checks clean.',
  feDod: 'Frontend DoD: typecheck, the whole unit-test suite, lint, format check, a build into a temp dir; E2E typecheck and the FULL E2E suite green, including a phone-width check of the new UI.',
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo} (main at ${CONFIG.mainSha}). Spec: ${CONFIG.spec} (Part A = the product note, binding). Approved look: ${CONFIG.look}${CONFIG.mockup ? ` Mockup: ${CONFIG.mockup}.` : ''} ${CONFIG.safety}
Contract changes only via the repo's schema regeneration; tenancy, guards and choke points hold. This is an EXPEDITED build.
Harness gotcha: \\uXXXX escapes typed into tool inputs can become literal invisible characters; scan files you write.`
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' }, open_issues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'tests', 'open_issues'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }

const rep = {}
if (!CONFIG.frontendOnly) {
  phase('Spec')
  rep.spec = await agent(`${BASE}

Write a SHORT engineering Part B into ${CONFIG.spec} (keep the front matter; keep Part A verbatim under "# Part A — Product (PM, <date>)"; update the header quote: look approved from mockups on <date>, expedited build at the owner's request; Part B wins where they differ). Read the current code first. 150–300 lines, exact names, no TBDs: footprint (migration? new routes? prompt changes?), read shape, write shape, flows to unify, copy strings, tests (backend, frontend per place, E2E incl. phone width), docs, release, B0 departures. Return a summary with every decision.`, { label: 'spec', phase: 'Spec', schema: REPORT })

  phase('Backend')
  rep.be = await agent(`${BASE}\n\nYou are the BACKEND agent. Implement Part B of ${CONFIG.spec} for the backend and the contract (schemas, regenerated client types, mock fixtures for the new fields — the frontend agent does the UI), backend tests per Part B (incl. isolation probes for changed routes), the architecture change log. Spec summary: ${JSON.stringify(rep.spec)}\n${CONFIG.beDod}`, { label: 'backend', phase: 'Backend', schema: REPORT })
}
if (!CONFIG.backendOnly) {
  phase('Frontend')
  rep.fe = await agent(`${BASE}\n\nYou are the FRONTEND agent.${rep.be ? ` The backend + contract part is done (report: ${JSON.stringify(rep.be)}).` : ''} Implement the approved look exactly, every state (empty, filled, editing, read-only, loading, error), a11y (44 px targets on each control own box, phone width without horizontal scroll, light/dark, focus return, accessible names), copy in the repo's copy files, unit tests per place, E2E updates.\n${CONFIG.feDod}`, { label: 'frontend', phase: 'Frontend', schema: REPORT })
}

const vp = (r) => `${BASE}

You are the INDEPENDENT VERIFIER (round ${r}). Reports: ${JSON.stringify(rep).slice(0, 50000)}
READ-ONLY for repo files (scratch under ${CONFIG.scratch}/v-expedited/). 1) Diff review (git diff ${CONFIG.mainSha}): the spec implemented exactly, no behaviour lost, tests meaningful; write scratch tests for the risky backend cases. 2) Real browser: start an agent-safe dev stack, seed it, drive it with Playwright at phone and desktop width, light and dark, comparing with the approved look; 44 px targets, no horizontal scroll, no console errors; stop the stack at the end. 3) Re-run the full backend suite and the foundation tests. Verdict pass only if no blocker/major.`
phase('Verify')
let v = await agent(vp(1), { label: 'verify1', phase: 'Verify', schema: VERDICT })
if (v && v.findings.some(f => f.severity !== 'minor')) {
  phase('Fix')
  rep.fix = await agent(`${BASE}\n\nYou are the FIXER. Fix every blocker and major (and cheap minors) with tests, then re-run both DoDs.\n${CONFIG.beDod}\n${CONFIG.feDod}\nReports: ${JSON.stringify(rep).slice(0, 40000)}\nFindings: ${JSON.stringify(v.findings)}`, { label: 'fix', phase: 'Fix', schema: REPORT })
  phase('Verify')
  v = await agent(vp(2), { label: 'verify2', phase: 'Verify', schema: VERDICT })
}
return { rep, verdict: v }
