export const meta = {
  name: 'build-integrate-verify',
  description: 'Build part 3: integration (cross-workstream issues, INTEGRATION markers, full suites + E2E, acceptance walk) → final workstream (real E2E and pipeline tests in place of the placeholders, docs) → lens verifiers → fix loop',
  phases: [{ title: 'Integration' }, { title: 'Final' }, { title: 'Verify' }, { title: 'Fix' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  contractSha: '<sha of the committed contract step>',
  headSha: '<sha of the committed workstreams>',
  wsReports: '/path/to/scratch/ws-results.json',  // workstream reports + verifier minors (saved by the orchestrator)
  testing: '/abs/path/to/skill/references/testing.md',
  acceptanceFiles: '<every acceptance test file from the contract file table>',
  testDirs: '<test dirs, e.g. backend/tests frontend/src e2e>',
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker; never read secrets; fake providers only; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production.',
  full: 'lint/format/types/guards; the FULL backend suite; the foundation tests; the frontend whole suite + build into a temp dir; API schema regeneration with no diff; canonical-data checks',
  e2e: 'the full E2E suite (iterate on single specs with a kept stack as the repo documents, stop the kept stack at the end)',
  finalSection: '<§ of Part B for the final workstream>',
  acceptanceSection: '<§ of Part B with the acceptance criteria>',
  lenses: [
    { key: 'ai', p: 'AI AND PROMPTS lens (load the Claude API skill first): new prompt versions vs the spec, released folders byte-identical (if the repo versions prompts), per-row data never in system blocks, scrubbing per call on REAL runs with the fake provider, request shapes unchanged.' },
    { key: 'privacy', p: 'PRIVACY AND INJECTION lens: an injection string renders neutralized and framed as data in every call it reaches; no user text in logs/job results/error columns/foreign audit rows — prove it with scratch tests that capture logs for real, including a forced DB error; emails escape HTML; exports pass the formula-injection guard.' },
    { key: 'races', p: 'RE-RUNS AND RACES lens: the eligibility matrix for background re-runs, every exit path clears its markers, in-flight races in both orders, user decisions never overwritten, no surprise side effects (alerts, rule offers). Write scratch DB tests for uncovered cases.' },
    { key: 'tenancy', p: 'TENANCY AND GUARDS lens (if multi-tenant): every new query scoped (run with two tenants, the SQL auditor log stays empty), foreign ids answer like unknown ids, guard scripts catch violations (try a scratch one), lock order, migration on a multi-tenant DB.' },
    { key: 'ux', p: 'UX lens (real browser): start an agent-safe dev stack, seed it, drive it with Playwright at phone and desktop width, light and dark, through every new state; 44 px targets on each control own box, no horizontal scroll at phone width, focus return, aria names, copy as specified, no console errors. Stop the stack at the end.' },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo}. Binding spec ${CONFIG.spec} (Part B wins). Contract (${CONFIG.contractSha}) and workstreams (${CONFIG.headSha}) are COMMITTED; workstream reports: ${CONFIG.wsReports}. Tests-first rules: ${CONFIG.testing}. Never check out another commit; read old versions with git show. ${CONFIG.safety}
Harness gotcha: \\uXXXX escapes typed into tool inputs can become literal invisible characters; build them in code and scan files you write.`
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, red_run: { type: 'string' }, markers_removed: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' }, open_issues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'tests', 'open_issues'] }
const FINAL_REPORT = { ...REPORT, required: [...REPORT.required, 'red_run', 'markers_removed'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }
const serious = v => v && v.findings.some(f => f.severity !== 'minor')
const markerCheck = `grep -rnE 'ACCEPT:[A-Z]' ${CONFIG.testDirs}`
const assertionCheck = `git diff ${CONFIG.contractSha} -- ${CONFIG.acceptanceFiles} (-w: markers only removed or unwrapped, every assertion line unchanged, FINAL placeholders replaced by real tests; no assertion weakened or deleted)`

phase('Integration')
const integ = await agent(`${BASE}

You are the INTEGRATION agent. You may edit any file the epic touched (frozen files only where needed — list each).
1. Handle the verifiers' minors that are real; resolve cross-workstream issues and every "unexpected pass" / "peer error" the workstreams reported; apply correct CCRs not yet applied. Check that every leak/sentinel test actually captures what it asserts on (inject the sentinel temporarily, watch the test fail, revert).
2. Make everything green together: ${CONFIG.full}; and ${CONFIG.e2e}.
3. Remove every ACCEPT:INTEGRATION marker once its test passes (assertions untouched; list them in markers_removed). Then \`${markerCheck}\` must find nothing except the ACCEPT:FINAL placeholders, listed by name; any workstream marker left is a gap: make its test pass and remove it, or report it.
4. Walk the acceptance criteria (${CONFIG.acceptanceSection}): covered by a named passing test / FINAL placeholder for the final workstream / gap. Fix code gaps.
Return the report; put the acceptance table in 'tests'.`, { label: 'integration', phase: 'Integration', schema: REPORT })

phase('Final')
const final = await agent(`${BASE}

You are the FINAL WORKSTREAM (${CONFIG.finalSection}), after integration. Integration report: ${JSON.stringify(integ)}
Own exactly its files. Do:
- Replace each ACCEPT:FINAL placeholder with the real test: the pipeline integration tests and the E2E journeys (respect the suite's ordering constraints; run ${CONFIG.e2e} until green). For each new test prove it can fail: break the behaviour with a temporary one-line edit, run the test, record its failure line in ${CONFIG.scratch}/red-final.txt, revert, confirm the revert with git diff. Then extend the journeys Part B lists.
- The docs (architecture sections + change log, the ADR incl. amendments of older specs/ADRs, runbook, CLAUDE.md gotchas, backlog as a plain unordered list).
DoD: your tests, the FULL backend suite, the foundation tests, guards, the full E2E suite; \`${markerCheck}\` finds nothing (report the count); ${assertionCheck}. Report what ran (counts) in 'tests', the red-run file in red_run, the replaced placeholders in markers_removed.`, { label: 'final', phase: 'Final', schema: FINAL_REPORT })

phase('Verify')
const vPrompt = (l, round, ctx) => `${BASE}\n\nYou are an INDEPENDENT VERIFIER (round ${round}), ${l.p}\nContext (reports): ${JSON.stringify(ctx).slice(0, 60000)}\nREAD-ONLY for repo files; scratch files only under ${CONFIG.scratch}/v-${l.key}/. Also confirm: \`${markerCheck}\` finds nothing; ${assertionCheck}; ${CONFIG.scratch}/red-final.txt has a failure line for every new E2E/pipeline test. DoD: your scratch tests plus the FULL backend suite once (reduced workers; others run too), the foundation tests, guards. Verdict pass only if no blocker/major remains.`
let ctx = { integration: integ, final }
let verdicts = await parallel(CONFIG.lenses.map(l => () => agent(vPrompt(l, 1, ctx), { label: `verify1:${l.key}`, phase: 'Verify', schema: VERDICT }).then(v => ({ key: l.key, v }))))
const fixRounds = []
for (let r = 1; r <= 2; r++) {
  const failing = verdicts.filter(Boolean).filter(x => serious(x.v))
  if (!failing.length) break
  phase('Fix')
  const fx = await agent(`${BASE}\n\nYou are the FIXER (round ${r}); you may edit any file the epic touched (frozen files only where a finding requires it — list each). Fix every blocker and major (and cheap minors) with tests (each new test seen failing first). Then re-run: ${CONFIG.full}; and ${CONFIG.e2e} if any user-visible behaviour changed.\nFindings: ${JSON.stringify(failing)}`, { label: `fix${r}`, phase: 'Fix', schema: REPORT })
  fixRounds.push(fx)
  ctx = { ...ctx, [`fix${r}`]: fx }
  phase('Verify')
  const again = await parallel(failing.map(x => () => agent(vPrompt(CONFIG.lenses.find(l => l.key === x.key), r + 1, ctx), { label: `verify${r + 1}:${x.key}`, phase: 'Verify', schema: VERDICT }).then(v => ({ key: x.key, v }))))
  verdicts = verdicts.map(x => (again.find(a => a && x && a.key === x.key) || x))
}
return { integration: integ, final, fixRounds, verdicts }
