export const meta = {
  name: 'spec-survey',
  description: 'Read-only survey of the code a product spec will touch: parallel readers by area, then a synthesis of owner questions and engineering facts',
  phases: [{ title: 'Survey', detail: 'parallel read-only readers' }, { title: 'Synthesize' }],
}

// ── CONFIG: fill in before running ───────────────────────────────────────────
const CONFIG = {
  repo: '/path/to/repo',
  mainSha: '<sha>',
  spec: 'specs/NN_FEATURE.md',          // the PM's product spec (Part A)
  spike: null,                           // optional older spike report; its refs may be stale
  areas: [                               // 3–6 areas; each becomes one reader
    { key: 'data', focus: 'data model, migrations, history/audit, API routes and schemas, search, tenancy/guards' },
    { key: 'logic', focus: 'services and background jobs the feature changes; existing similar mechanisms to reuse' },
    { key: 'ai', focus: 'AI calls, prompts and versions, fake providers, what each call sees today' },
    { key: 'frontend', focus: 'screens, components, copy files, mocks, tests the feature touches; what exists today' },
    { key: 'ops', focus: 'tests, E2E ordering, docs that must change, ADR numbering, release/rehearsal tooling' },
  ],
}
// ─────────────────────────────────────────────────────────────────────────────

const COMMON = `Repo ${CONFIG.repo}, main at ${CONFIG.mainSha}. READ-ONLY survey for the spec ${CONFIG.spec} (Part A = the product document).
${CONFIG.spike ? `Skim the spike report ${CONFIG.spike}; its file:line refs may predate later work — re-verify every ref you rely on.` : ''}
Do NOT edit any file, run no tests, no docker, no git writes, never read secrets.
Return precise current file:line references. Flag every place where older documents are stale or wrong.
Also list product questions the OWNER must decide that the product spec does not already answer (behaviour/UX/cost
only, not engineering choices), each with 2-4 concrete options and your recommendation.`

const SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    facts: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, refs: { type: 'string' } }, required: ['fact', 'refs'] } },
    stale_refs: { type: 'array', items: { type: 'string' } },
    engineering_notes: { type: 'array', items: { type: 'string' } },
    owner_questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, why: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' } }, required: ['question', 'why', 'options', 'recommendation'] } },
  },
  required: ['area', 'facts', 'stale_refs', 'engineering_notes', 'owner_questions'],
}

phase('Survey')
const reports = (await parallel(CONFIG.areas.map(a => () =>
  agent(`${COMMON}\n\nAREA: ${a.focus}`, { label: `survey:${a.key}`, phase: 'Survey', schema: SCHEMA })))).filter(Boolean)
log(`${reports.length}/${CONFIG.areas.length} survey reports`)

phase('Synthesize')
const synthesis = await agent(`Merge these read-only survey reports for ${CONFIG.spec}. Repo ${CONFIG.repo}; read files to resolve conflicts, edit nothing.
Produce: (1) a deduplicated list of OWNER product questions (drop anything the product spec already decides and pure engineering choices), ordered by how much each changes the build, each with 2-4 options and a recommendation; (2) the key engineering facts and decisions an engineering spec needs (with refs); (3) stale refs. Be concise.
REPORTS:\n${JSON.stringify(reports)}`, {
  label: 'synthesize', phase: 'Synthesize',
  schema: { type: 'object', properties: { owner_questions: SCHEMA.properties.owner_questions, engineering: { type: 'array', items: { type: 'string' } }, stale_refs: { type: 'array', items: { type: 'string' } } }, required: ['owner_questions', 'engineering', 'stale_refs'] },
})
return { synthesis, reports }
