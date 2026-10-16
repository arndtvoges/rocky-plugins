export const meta = {
  name: 'build-workstreams',
  description: 'Build part 2: parallel workstreams, each tests first → build → verify → fix',
  phases: [{ title: 'Workstreams', detail: 'each: tests first → build → verify → fix ≤2' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  contractSha: '<sha of the committed contract step>',
  ownershipSection: '<§ of Part B with the ownership table>',
  testing: '/abs/path/to/skill/references/testing.md', // markers per stack, "fails for the right reason"; for a stack without a strict marker (Rust, Go, JUnit, .NET, node:test, …) make it '<…>/testing.md and <…>/markers-other-stacks.md'
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker; never read secrets; fake providers only; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production.',
  backendDod: 'DoD: lint, format check, type check, guard scripts; your own test paths (no parallelism while iterating); the foundation/contract tests; the FULL backend suite once at the end with a reduced worker count (others run suites at the same time); canonical-data checks clean.',
  frontendDod: 'DoD (frontend): typecheck; unit tests for your paths and finally the whole suite once; lint and format check on touched files; a build into a temp dir. Never the gate-only commands. Also the foundation/contract tests once.',
  workstreams: [
    // key (uppercase: it is the ACCEPT:<key> tag), which DoD, the paths it owns (files), its acceptance test file(s),
    // its slice of the contract report's acceptance_tests, and the assignment (Part B sections, tests it must add).
    { key: 'WS-A', dod: 'backend', files: '<owned paths>', acceptanceFiles: '<its acceptance test file>', acceptance: '<its acceptance_tests slice>', p: 'You are workstream WS-A "<name>" (<§ ownership>). Own exactly its files plus the contract handover. Implement <§ sections> … Tests: …' },
    { key: 'WS-B', dod: 'backend', files: '<owned paths>', acceptanceFiles: '<…>', acceptance: '<…>', p: 'You are workstream WS-B "<name>" …' },
    { key: 'WS-C', dod: 'frontend', files: '<owned paths>', acceptanceFiles: '<…>', acceptance: '<…>', p: 'You are workstream WS-C "Frontend" … a11y: 44 px targets on the element own box, phone width without horizontal scroll, light/dark, no money arithmetic in the client …' },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo}. Binding spec ${CONFIG.spec} (Part B wins). The contract step is COMMITTED as ${CONFIG.contractSha}: every contract file not handed over in its handover sentence is frozen (a change is a CCR in your report: exact file + diff + reason). Your acceptance test files are handed over for marker removal only (delete or unwrap the markers): never edit their assertions. ${CONFIG.safety}
Other agents work in the same tree at the same time: edit ONLY files your workstream owns (${CONFIG.ownershipSection} + your handover), never revert or reformat others' changes, expect unrelated files to change under you. If collection or compilation fails in a file you don't own, rerun once a few minutes later; if it still fails, report "peer error: <file>" and never fix it: your DoD is then your paths plus the full suite minus the named peer errors (e.g. pytest --ignore <file> for that run only). If a test you don't own passes unexpectedly, report "unexpected pass: <test> (owner <key>)" and leave its marker alone.
Harness gotcha: \\uXXXX in tool inputs may land as invisible characters; build them in code, scan written files.`
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, red_run: { type: 'string' }, markers_removed: { type: 'array', items: { type: 'string' } }, tests: { type: 'string' }, ccrs: { type: 'array', items: { type: 'string' } }, open_issues: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'red_run', 'markers_removed', 'tests', 'open_issues'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }
const serious = v => v && v.findings.some(f => f.severity !== 'minor')
const dodOf = w => (w.dod === 'frontend' ? CONFIG.frontendDod : CONFIG.backendDod)
const red = w => `${CONFIG.scratch}/red-${w.key}.txt`

phase('Workstreams')
const results = await pipeline(CONFIG.workstreams,
  w => agent(`${BASE}\n\n${w.p}\nYour acceptance tests (in ${w.acceptanceFiles}, marked ACCEPT:${w.key}): ${w.acceptance}\nTESTS FIRST (rules: ${CONFIG.testing}): before implementing anything, write the tests Part B assigns to you, run them, and save the red run to ${red(w)}: the command, then "test → first failure line" for each. Every line must be missing behaviour, not an import, typo, fixture or timeout error. Then implement until those tests and your acceptance tests pass; delete or unwrap only the ACCEPT:${w.key} markers in your acceptance files ("Removing a marker" in ${CONFIG.testing}); a wrong test is a CCR with the reason.\n${dodOf(w)}\nReport CCRs for anything outside your files. In red_run give the file path and counts; in markers_removed the acceptance tests whose markers you removed. Return the report.`, { label: `${w.key}:build`, phase: 'Workstreams', schema: REPORT }),
  async (build, w) => {
    const vp = (rep, round) => `${BASE}\n\nYou are the INDEPENDENT VERIFIER of ${w.key} (round ${round}). Its assignment: ${w.p}\nIts report: ${JSON.stringify(rep)}\nCheck the working tree for that workstream's files only (git diff ${CONFIG.contractSha} -- ${w.files} ${w.acceptanceFiles}, new files). READ-ONLY for repo files; never check out another commit; scratch tests only under ${CONFIG.scratch}/v-${w.key}/. Check: every MUST of its sections implemented exactly (names, signatures, status codes, copy, decisions); tests-first evidence ("What verifiers check" in ${CONFIG.testing}): \`git show ${CONFIG.contractSha}:<acceptance file>\` shows each owned test with its ACCEPT:${w.key} marker; \`git diff -w -U0 ${CONFIG.contractSha} -- ${w.acceptanceFiles}\` removes or unwraps only markers, every assertion line unchanged (any other change needs an applied CCR); ${red(w)} exists and every line is missing behaviour for a test that targets behaviour absent at ${CONFIG.contractSha}; tests meaningful and green (re-run its paths and the DoD); outside-ownership changes flagged only when its files_changed lists them or no workstream owns the file; guards/tenancy respected; no user text in logs; canonical numbers unchanged. ${dodOf(w)}\nVerdict pass only if no blocker/major remains.`
    let rep = build
    let v = await agent(vp(rep, 1), { label: `${w.key}:verify1`, phase: 'Workstreams', schema: VERDICT })
    const fixes = []
    for (let r = 1; r <= 2 && serious(v); r++) {
      const fx = await agent(`${BASE}\n\nYou are the FIXER for ${w.key} (round ${r}); you have its ownership. Assignment: ${w.p}\nFix every blocker and major (and cheap minors) with tests (a new test is seen failing first; append its line to ${red(w)}), then re-run the DoD. ${dodOf(w)}\nPrevious report: ${JSON.stringify(rep)}\nFindings: ${JSON.stringify(v.findings)}`, { label: `${w.key}:fix${r}`, phase: 'Workstreams', schema: REPORT })
      fixes.push(fx); if (fx) rep = { ...rep, fix: fx }
      v = await agent(vp(rep, r + 1), { label: `${w.key}:verify${r + 1}`, phase: 'Workstreams', schema: VERDICT })
    }
    return { key: w.key, build, fixes, verdict: v }
  })
const ws = results.filter(Boolean)
log(`workstreams: ${ws.map(r => `${r.key}=${r.verdict ? r.verdict.verdict : 'none'}`).join(', ')}`)
return ws
