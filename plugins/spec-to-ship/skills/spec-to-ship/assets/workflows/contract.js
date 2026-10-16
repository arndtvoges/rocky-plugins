export const meta = {
  name: 'build-contract',
  description: 'Build part 1: the contract step (migrations, shared schemas/types, frozen seams, stubs, mocks) by one agent, then an independent verifier and up to 2 fix rounds',
  phases: [{ title: 'Contract' }, { title: 'Verify' }, { title: 'Fix' }],
}

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  mainSha: '<sha after the "building" commit>',
  spec: '/path/to/repo/specs/NN_FEATURE.md',
  contractSection: '§B17.1',            // Part B section with the contract step's file table and handover sentence
  scratch: '/path/to/scratch',
  safety: 'Every shell starts with the project agent marker (see CLAUDE.md); never read secret files; never contact real external services; only agent-safe stack targets; NO git add/commit/push/stash/checkout/reset; never touch the PM drafts or production.',
  gate: `Exit gate (all green, report counts): lint + format check + type check + guard scripts; the FULL backend suite; the foundation/contract tests; frontend typecheck, unit tests, lint/format on touched files, a build into a temp dir; the API schema regeneration leaves no diff on a second run; canonical-data checks clean; released prompt folders and snapshots byte-identical.`,
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE = `Repo ${CONFIG.repo} (main at ${CONFIG.mainSha}). The binding spec is ${CONFIG.spec} — Part B wins over Part A; the owner kept every default unless Part B says otherwise. ${CONFIG.safety}
Harness gotcha: \\uXXXX escapes typed into tool inputs can become literal invisible characters; build them in code and scan files you write.`
const REPORT = { type: 'object', properties: { summary: { type: 'string' }, files_changed: { type: 'array', items: { type: 'string' } }, frozen_edits: { type: 'array', items: { type: 'string' } }, exit_gate: { type: 'string' }, open_issues: { type: 'array', items: { type: 'string' } }, ccrs: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'files_changed', 'exit_gate', 'open_issues'] }
const VERDICT = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'fail'] }, findings: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string', enum: ['blocker', 'major', 'minor'] }, file: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['severity', 'problem', 'fix'] } }, checked: { type: 'string' } }, required: ['verdict', 'findings', 'checked'] }

phase('Contract')
const built = await agent(`${BASE}

You are the CONTRACT STEP (${CONFIG.contractSection}): a single agent, the ONLY step allowed to edit frozen/shared files. Read Part B in full first. Do exactly what ${CONFIG.contractSection} lists and nothing owned by later workstreams: where it says "stub", leave bodies raising NotImplementedError (or the language equivalent) with the final names and signatures. Prompt folders are byte copies of the released ones (header comments only); real prompt changes belong to later workstreams.
${CONFIG.gate}
If the spec is wrong or impossible somewhere, do the closest correct thing and list it in open_issues.`, { label: 'contract', phase: 'Contract', schema: REPORT })

let report = built
const verifyPrompt = (round) => `${BASE}

You are the INDEPENDENT VERIFIER of the contract step (round ${round}). Its claims: ${JSON.stringify(report)}
Read Part B (${CONFIG.contractSection} and every section it implements) and check the working tree (git diff ${CONFIG.mainSha}, new files). READ-ONLY for repo files; scratch tests only under ${CONFIG.scratch}/contract-verify/. Check:
1. Contract exactly as specified: every new field, type, default, route count, schema regeneration stable, mocks consistent.
2. Migration: write a scratch DB test (copy the repo's migration test patterns) on a realistic multi-tenant database: columns/constraints, downgrade behaviour, pins moved, "migrated == freshly created".
3. Pure domain helpers against every rule in Part B (edge cases included).
4. Frozen-file edits are exactly those allowed; later workstreams' code exists only as stubs with exact signatures; copies byte-identical.
5. Re-run the exit-gate pieces that matter and confirm the reported counts.
Verdict pass only if no blocker/major remains.`

phase('Verify')
let verdict = await agent(verifyPrompt(1), { label: 'verify:1', phase: 'Verify', schema: VERDICT })
const fixes = []
for (let round = 1; round <= 2 && verdict && verdict.findings.some(f => f.severity !== 'minor'); round++) {
  phase('Fix')
  const fx = await agent(`${BASE}\n\nYou are the CONTRACT FIXER (round ${round}); you have the contract step's ownership (frozen files included). Fix every blocker and major (and cheap minors) with tests, then re-run the full exit gate.\n${CONFIG.gate}\nPrevious report: ${JSON.stringify(report)}\nFindings: ${JSON.stringify(verdict.findings)}`, { label: `fix:${round}`, phase: 'Fix', schema: REPORT })
  fixes.push(fx)
  if (fx) report = { ...report, fix_round: round, fix_summary: fx.summary, exit_gate: fx.exit_gate, open_issues: fx.open_issues }
  phase('Verify')
  verdict = await agent(verifyPrompt(round + 1), { label: `verify:${round + 1}`, phase: 'Verify', schema: VERDICT })
}
return { built, fixes, verdict }
