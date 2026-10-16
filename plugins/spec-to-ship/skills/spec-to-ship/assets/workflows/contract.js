export const meta = {
  name: 'build-contract',
  description: 'Build part 1: contract step (one agent) → verifier → up to 2 fix rounds',
  phases: [{ title: 'Contract' }, { title: 'Verify' }, { title: 'Fix' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  mainSha: '<sha after the "building" commit>',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  contractSection: '<§ of Part B with the contract file table and handover sentence>',
  testing: '/abs/path/to/skill/references/testing.md', // markers per stack, "fails for the right reason"; for a stack without a strict marker (Rust, Go, JUnit, .NET, node:test, …) make it '<…>/testing.md and <…>/markers-other-stacks.md'
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker (see CLAUDE.md); never read secret files; never contact real external services; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production.',
  gate: `Exit gate (all green, report counts): lint + format check + type check + guard scripts; the FULL backend suite in CI mode (green apart from the strict expected failures you added; a missing snapshot fails, never gets written); the foundation/contract tests; frontend typecheck, unit tests, lint/format on touched files, a build into a temp dir; E2E typecheck/list if the repo has E2E (the placeholders compile and are listed); the API schema regeneration leaves no diff on a second run; canonical-data checks clean; released prompt folders and snapshots byte-identical (if any).`,
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo} (main at ${CONFIG.mainSha}). The binding spec is ${CONFIG.spec} — Part B wins over Part A; the owner kept every default unless Part B says otherwise. ${CONFIG.safety}
Harness gotcha: \\uXXXX in tool inputs may land as invisible characters; build them in code, scan written files.`
const ACCEPTANCE = { type: 'array', items: { type: 'object', properties: { test: { type: 'string' }, criterion: { type: 'string' }, owner: { type: 'string' }, reason_seen: { type: 'string' } }, required: ['test', 'criterion', 'owner'] } }
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, frozen_edits: { type: 'array', items: { type: 'string' } }, acceptance_tests: ACCEPTANCE, exit_gate: { type: 'string' }, open_issues: { type: 'array', items: { type: 'string' } }, ccrs: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'acceptance_tests', 'exit_gate', 'open_issues'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }

phase('Contract')
const built = await agent(`${BASE}

You are the CONTRACT STEP (${CONFIG.contractSection}): a single agent, the ONLY step allowed to edit frozen/shared files. Read Part B in full first, then "Tests first" in ${CONFIG.testing} in full. Do exactly what ${CONFIG.contractSection} lists and nothing owned by later workstreams. If the repo versions AI prompts in folders, new prompt folders are byte copies of the released ones (header comments only); real prompt changes belong to later workstreams.
TESTS FIRST: write the acceptance tests from Part B's test plan now, against the contract alone, one file per owner as the contract file table lists, and leave them FAILING (the orchestrator commits them) under the stack's strict expected-failure marker with the reason tag exactly "ACCEPT:<OWNER>" (a workstream key, or INTEGRATION for tests that need several workstreams). E2E journeys and whole-pipeline tests get one named ACCEPT:FINAL placeholder per criterion instead, never a failing test. Checklist: stubs per that section (frontend stubs never throw asynchronously); negative tests start with a positive precondition; regression guards green and unmarked; no self-recording snapshots.
Then run the marked tests with markers off and save the table "test → first failure line" to ${CONFIG.scratch}/contract-red.txt. Each line is the stub's not-implemented error, a 5xx/501 from a stub route, or an assertion on the value; anything else means the test is wrong: fix it. Pure helpers you implement fully: tests first, a red run against the stub (add it to the same file), then the implementation; their tests end green.
Report every acceptance test in acceptance_tests (test, criterion, owner, reason_seen = its first failure line, or "placeholder" / "regression guard").
${CONFIG.gate}
If the spec is wrong or impossible somewhere, do the closest correct thing and list it in open_issues.`, { label: 'contract', phase: 'Contract', schema: REPORT })

let report = built
const verifyPrompt = (round) => `${BASE}

You are the INDEPENDENT VERIFIER of the contract step (round ${round}). Its claims: ${JSON.stringify(report)}
Read Part B (${CONFIG.contractSection} and every section it implements) and ${CONFIG.testing}, and check the working tree (git diff ${CONFIG.mainSha}, new files). READ-ONLY for repo files; scratch tests only under ${CONFIG.scratch}/contract-verify/. Check:
1. Contract exactly as specified: every new field, type, default, route count, schema regeneration stable, mocks consistent.
2. Migration: write a scratch DB test (copy the repo's migration test patterns) on a realistic database (several tenants if multi-tenant): columns/constraints, downgrade behaviour, pins moved, "migrated == freshly created".
3. Pure domain helpers against every rule in Part B (edge cases included); their red run is in ${CONFIG.scratch}/contract-red.txt.
4. Every acceptance criterion in Part B's test plan has its test: under a strict marker tagged exactly ACCEPT:<OWNER> with the owner the plan names, in that owner's acceptance file(s) as the contract file table lists; E2E/pipeline criteria as ACCEPT:FINAL placeholders; regression guards green and labelled. Re-run the marked tests with markers off yourself (the command in ${CONFIG.testing}) and check each failure line is missing behaviour, not an import, typo, fixture, 404-from-unregistered-route or timeout error. Negative tests have a positive precondition. No self-recording snapshots. Strictness is in committed files (an unexpected pass fails the normal run).
5. Frozen-file edits are exactly those allowed; later workstreams' code exists only as stubs with exact signatures (frontend stubs render null / return fixtures, never throw asynchronously); copies byte-identical.
6. Re-run the exit-gate pieces that matter and confirm the reported counts.
Verdict pass only if no blocker/major remains.`

phase('Verify')
let verdict = await agent(verifyPrompt(1), { label: 'verify:1', phase: 'Verify', schema: VERDICT })
const fixes = []
for (let round = 1; round <= 2 && verdict && verdict.findings.some(f => f.severity !== 'minor'); round++) {
  phase('Fix')
  const fx = await agent(`${BASE}\n\nYou are the CONTRACT FIXER (round ${round}); you have the contract step's ownership (frozen files included). Fix every blocker and major (and cheap minors) with tests, keep ${CONFIG.scratch}/contract-red.txt and acceptance_tests current, then re-run the full exit gate.\n${CONFIG.gate}\nPrevious report: ${JSON.stringify(report)}\nFindings: ${JSON.stringify(verdict.findings)}`, { label: `fix:${round}`, phase: 'Fix', schema: REPORT })
  fixes.push(fx)
  if (fx) report = { ...report, fix_round: round, fix_summary: fx.summary, acceptance_tests: fx.acceptance_tests, exit_gate: fx.exit_gate, open_issues: fx.open_issues }
  phase('Verify')
  verdict = await agent(verifyPrompt(round + 1), { label: `verify:${round + 1}`, phase: 'Verify', schema: VERDICT })
}
// The orchestrator commits, then pastes each owner's slice of report.acceptance_tests into workstreams.js CONFIG.
return { built, fixes, verdict, acceptance_tests: report ? report.acceptance_tests : null }
