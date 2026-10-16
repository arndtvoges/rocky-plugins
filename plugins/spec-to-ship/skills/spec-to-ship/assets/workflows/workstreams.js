export const meta = {
  name: 'build-workstreams',
  description: 'Build part 2: parallel workstreams with disjoint file ownership, each build → independent verify → fix → re-verify',
  phases: [{ title: 'Workstreams', detail: 'each: build → verify → fix ≤2' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  contractSha: '<sha of the committed contract step>',
  ownershipSection: '§B17.2',
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker; never read secrets; fake providers only; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production.',
  backendDod: 'DoD: lint, format check, type check, guard scripts; your own test paths (no parallelism while iterating); the foundation/contract tests; the FULL backend suite once at the end with a reduced worker count (others run suites at the same time; name a peer failure, never skip or fix it); canonical-data checks clean.',
  frontendDod: 'DoD (frontend): typecheck; unit tests for your paths and finally the whole suite once; lint and format check on touched files; a build into a temp dir. Never the gate-only commands. Also the foundation/contract tests once.',
  workstreams: [
    // key, which DoD, and the assignment: the Part B sections, the files it owns (incl. the contract handover), and the tests it must add.
    { key: 'WS-A', dod: 'backend', p: 'You are workstream WS-A "<name>" (§B17.2). Own exactly its files plus the contract handover (<files>). Implement §B4–§B8 … Tests: …' },
    { key: 'WS-B', dod: 'backend', p: 'You are workstream WS-B "<name>" …' },
    { key: 'WS-C', dod: 'frontend', p: 'You are workstream WS-C "Frontend" … a11y: 44 px targets on the element own box, phone width without horizontal scroll, light/dark, no money arithmetic in the client …' },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo}. Binding spec ${CONFIG.spec} (Part B wins). The contract step is COMMITTED as ${CONFIG.contractSha}: every contract file not handed over in its handover sentence is frozen (a change is a CCR in your report: exact file + diff + reason). ${CONFIG.safety}
Other agents work in the same tree at the same time: edit ONLY files your workstream owns (${CONFIG.ownershipSection} + your handover), never revert or reformat others' changes, expect unrelated files to change under you.
Harness gotcha: \\uXXXX escapes typed into tool inputs can become literal invisible characters; build them in code and scan files you write.`
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' }, ccrs: { type: 'array', items: { type: 'string' } }, open_issues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'tests', 'open_issues'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }
const serious = v => v && v.findings.some(f => f.severity !== 'minor')
const dodOf = w => (w.dod === 'frontend' ? CONFIG.frontendDod : CONFIG.backendDod)

phase('Workstreams')
const results = await pipeline(CONFIG.workstreams,
  w => agent(`${BASE}\n\n${w.p}\n${dodOf(w)}\nReport CCRs for anything outside your files. Return the report.`, { label: `${w.key}:build`, phase: 'Workstreams', schema: REPORT }),
  async (build, w) => {
    const vp = (rep, round) => `${BASE}\n\nYou are the INDEPENDENT VERIFIER of ${w.key} (round ${round}). Its assignment: ${w.p}\nIts report: ${JSON.stringify(rep)}\nCheck the working tree for that workstream's files only (git diff ${CONFIG.contractSha} -- <its files>, new files). READ-ONLY for repo files; scratch tests only under ${CONFIG.scratch}/v-${w.key}/. Check: every MUST of its sections implemented exactly (names, signatures, status codes, copy, decisions); tests meaningful and green (re-run its paths and the DoD); no files outside its ownership changed by it; guards/tenancy respected; no user text in logs; canonical numbers unchanged. ${dodOf(w)}\nVerdict pass only if no blocker/major remains.`
    let rep = build
    let v = await agent(vp(rep, 1), { label: `${w.key}:verify1`, phase: 'Workstreams', schema: VERDICT })
    const fixes = []
    for (let r = 1; r <= 2 && serious(v); r++) {
      const fx = await agent(`${BASE}\n\nYou are the FIXER for ${w.key} (round ${r}); you have its ownership. Assignment: ${w.p}\nFix every blocker and major (and cheap minors) with tests, then re-run the DoD. ${dodOf(w)}\nPrevious report: ${JSON.stringify(rep)}\nFindings: ${JSON.stringify(v.findings)}`, { label: `${w.key}:fix${r}`, phase: 'Workstreams', schema: REPORT })
      fixes.push(fx); if (fx) rep = { ...rep, fix: fx }
      v = await agent(vp(rep, r + 1), { label: `${w.key}:verify${r + 1}`, phase: 'Workstreams', schema: VERDICT })
    }
    return { key: w.key, build, fixes, verdict: v }
  })
const ws = results.filter(Boolean)
log(`workstreams: ${ws.map(r => `${r.key}=${r.verdict ? r.verdict.verdict : 'none'}`).join(', ')}`)
return ws
