---
name: spec-to-ship
description: >-
  Spec-driven delivery method that takes a feature from a product spec (written by a PM or the owner) to a verified,
  release-ready build; push or deploy only if you choose. Code survey, owner interview, decision log, engineering
  spec with adversarial critique rounds and a test plan, a hard stop for the owner's "go", tests written first from
  the spec, a contract step, parallel workstreams with independent verifiers, integration and E2E, lens verifiers,
  a release gate, then stop, push, or deploy with post-deploy checks, as agreed at the start. It also has an
  expedited track (mockups, short engineering section, builder(s) plus one verifier) for small or UI-only changes.
  Use this skill whenever someone hands over a product spec, PRD, feature brief or epic and wants it built, or says
  things like "let's do the next spec", "same workflow as last time", "build spec 07", "expedited build", "turn this
  product doc into an engineering spec", "interview me about this feature", "run the gate and deploy", even if they
  don't name the method. Execution phases run as multi-agent workflows (ultracode) and require the Workflow tool.
---

# Spec to ship

A method for building software with an owner, an optional product manager (PM), and Claude as the **orchestrator**
who runs everything else through multi-agent workflows. It has been used for a dozen epics on a real production app,
from "add a note field" to "make the app multi-tenant", and it is shaped by what went wrong along the way.

The core idea: **decide everything that can be decided before anyone writes code, write the tests from the spec
before the code that makes them pass, then let many agents build in parallel against a written contract, and trust
nothing until an independent agent has checked it.** The owner makes product decisions; the orchestrator makes
engineering decisions, writes them down, and only stops when the owner must decide or when an action would cost money.

## Requirements (no fallback)

- **The Workflow tool must be available.** Every execution phase (survey, spec writing and critique, contract step,
  workstreams, verifiers, fixes) runs as a workflow script. Invoking this skill is the user's opt-in to multi-agent
  orchestration: treat execution as **ultracode** (author and run a workflow for every substantive phase, favour
  exhaustive coverage and adversarial verification over token savings). If the Workflow tool is missing, stop and
  tell the user this skill can't run without it; do not quietly fall back to doing the work in one context.
- Read `references/workflows.md` before writing the first workflow script; templates live in `assets/workflows/`.
- The repo should have the project scaffolding described in `references/project-setup.md` (a CLAUDE.md with hard
  safety rules and commands, a `specs/` folder with status front matter, a test suite, and a deploy procedure only if
  the owner wants Claude to deploy). If parts are missing, offer to set them up first; the method leans on them.

## First question: how far should this run go?

Ask once, at the start (with the track question if that's open too). Record the answer in the decision log (full
track) or in Part B's release line and the persistent notes (expedited):

| Option | What happens after a green gate |
|---|---|
| **Stop after the gate** (recommended default) | Everything is committed locally; you report and stop. The owner pushes and releases themselves. |
| **Commit and push** | Push to the main branch (or open a PR if the repo works that way); check CI; no deploy. |
| **Deploy** | Push, run the project's deploy procedure, post-deploy checks, `status: done`. Only offer this when the repo has a documented deploy procedure (`references/project-setup.md` §5). |

Most people pick the first. A request that already names the scope ("build, gate, deploy", "just commit it")
answers this question. Don't re-ask later; the answer holds for the whole run. Without a deploy, the spec's status
goes to `done` only when the owner confirms it's live.

## Roles

| Role | Does | Never |
|---|---|---|
| **Owner** | Product decisions, answers interviews, says "go", approves anything that spends money or touches real credentials | — |
| **PM** (optional; may be the owner) | Writes the product spec (Part A): problem, what we build, principles, out of scope, risks, open questions | Engineering decisions |
| **Orchestrator** (you) | Survey, interview, engineering decisions, workflow scripts, commits, gate, push/deploy/post-deploy only as agreed at the start, honest reports | Edits the PM's drafts; skips the stop for "go"; claims a cause without measuring |
| **Build agents** (workflow subagents) | Implement one workstream inside its file ownership; report CCRs (change requests) for anything outside it | git add/commit/push, touch production, read secrets, edit files they don't own |
| **Verifiers** (workflow subagents) | Independently re-check a workstream or a lens; read-only on repo files; scratch tests only | Fix what they find (a fixer does that) |

## Pick the track

| Track | Use when | Shape |
|---|---|---|
| **Full** | New data model, migrations, AI/prompt changes, money or privacy impact, several areas of the codebase, anything you'd want a second pair of eyes on | release scope → survey → interview → decision log → spec workflow (writer + critique rounds, test plan per acceptance criterion) → owner defaults → commit → **STOP for "go"** → contract step (incl. the acceptance tests, failing) → parallel workstreams (each: tests first → build → verify → fix) → integration → final workstream (real E2E and pipeline tests in place of the placeholders, docs) → lens verifiers → fix loop → gate → (push / deploy, as agreed at the start) |
| **Expedited** | Small, mostly UI or additive change; the owner says "expedited", "just a reskin", "build, gate, deploy"; the product spec already settled the behaviour | release scope → (mockups → owner picks a look) → short engineering section → one workflow: builder(s), tests first → one verifier (diff + real browser) → at most one fix → gate → (push / deploy, as agreed) |

When unsure, ask the owner which track in one question. A track can escalate: if the expedited builder hits a
migration, a contract change across many callers, or a privacy question, stop and switch to the full track.

## The full track, step by step

Each step names its reference. Read the reference when you reach the step, not all at once.

0. **Release scope.** Ask the first question (or take it from the request, e.g. "build, gate, deploy").
1. **Hand-over.** The owner hands over a spec (often an untracked PM draft). Commit the PM's version **as is**
   before changing anything, so Part A's history is clean. Never edit or commit other untracked specs; they are the
   PM's drafts in progress. Check the spec's `dependency` front matter: don't start while a dependency isn't `done`.
   (`references/spec-format.md`)
2. **Survey** (workflow, read-only, ~5 parallel readers by area + a synthesis agent). Map every file the change
   touches with current `file:line` refs, re-verify any older spike report, flag stale refs, list the test layers,
   fixtures and strict expected-failure markers the repo has, and collect the product questions the spec leaves
   open. (`assets/workflows/survey.js`)
3. **Interview the owner.** At most 4 questions per round and 4 options per question, recommended option first and
   marked, as many rounds as needed. Ask only product questions with real trade-offs; decide engineering matters
   yourself. Offer the low-stakes answers as a list of proposed defaults the owner can object to, instead of asking
   each one. (`references/interview.md`)
4. **Decision log.** Write the release scope, owner answers (O1…), proposed defaults (D1…) and your engineering
   decisions (E1…) with reasons into a scratch file the spec workflow reads. (`references/interview.md`)
5. **Spec workflow.** One writer drafts Part B (the engineering spec) under the PM's untouched Part A, then
   adversarial critics by lens (AI/prompts, privacy/security, data/concurrency/release, UX, plan completeness), a
   fixer, one whole-spec critic, a final fixer. Part B includes a **test plan**: every acceptance criterion maps to
   named tests from the test catalog's layers (unit, DB, API/isolation, leak sentinel, integration, frontend, E2E),
   each with its owner and the failure it should show against the stub. (`assets/workflows/spec.js`,
   `references/spec-format.md`, `references/testing.md`)
6. **Owner defaults.** Part B ends with a numbered list of every default the owner can still change (interview
   defaults plus the spec writer's judgement calls), written for a non-engineer. Show the owner the new items and
   ask for "yes" or "3 no, …".
7. **Commit the spec** (`status: ready`), then **STOP and wait for "go"**. This stop is the point of the method: the
   owner sees exactly what will be built before any code exists. "Go" without changes means every default stays.
8. **"Go" → `status: building`.** Commit.
9. **Contract step** (workflow: one agent + one independent verifier + up to 2 fix rounds). The only step that may
   edit frozen/shared files: migrations, models, API schemas, shared types, generated clients, stubs with final
   signatures, test fixtures and mocks, **and the acceptance tests from the test plan, committed failing** under a
   strict expected-failure marker tagged `ACCEPT:<OWNER>`, one file per owner, each seen failing for the right
   reason. E2E journeys and whole-pipeline tests get named `ACCEPT:FINAL` placeholders instead. Its exit gate is the
   full test suite (green apart from those markers). The orchestrator commits it; after that, everything it touched
   is frozen except what its handover sentence hands over (each acceptance file to its owner, for marker removal
   only; the `FINAL` file: placeholders replaced by the real tests). (`assets/workflows/contract.js`,
   `references/testing.md`)
10. **Parallel workstreams** (workflow: `pipeline()` over 2–4 workstreams with disjoint file ownership; each:
    **tests first** → build → independent verify → fix ≤2 → re-verify). Each agent first writes its own tests from
    Part B and saves the red run, then implements until they and its acceptance tests pass, and removes its own
    markers (assertions untouched). Its DoD includes the **full** test suite (reduced worker count while several run
    at once); a peer's broken file is rerun once, then named, never "fixed"; an unexpected pass in a test it doesn't
    own is reported, not touched. Verifiers check the tests-first evidence against the contract commit without
    checking it out. Apply correct CCRs yourself, then commit. (`assets/workflows/workstreams.js`)
11. **Integration → final workstream → lens verifiers** (one workflow): integration agent (handles verifier minors,
    makes everything green together incl. E2E, removes `ACCEPT:INTEGRATION` markers, walks the acceptance criteria);
    final workstream (replaces each `ACCEPT:FINAL` placeholder with the real test and proves it can fail, docs, ADR,
    backlog); 4–5 lens verifiers in parallel (real browser for UX); fix loop ≤2 rounds re-running only failing
    lenses. (`assets/workflows/integrate-verify.js`)
12. **Gate** (orchestrator, parallel lanes): lint, types, contract drift, canonical data checks, no `ACCEPT:` marker
    left, full backend and frontend suites, build, E2E if the repo has it, deploy rehearsal if it has one and deploy
    files changed. Fix flakes properly (make the check robust), rerun, never ship red.
    (`references/gate-and-release.md`, `assets/gate.sh`)
13. **Release as agreed at the start:** stop and report (default), or push and check CI, or push, deploy, run the
    post-deploy checks and set `status: done`. What each report contains: `references/gate-and-release.md`.
    Production reads are read-only and done by you, never by build agents.

## The expedited track

0. **Release scope.** Ask the first question (or take it from the request); it goes into Part B's release line.
1. If the look matters, make **mockups first** as a published HTML page in the product's real tokens and fonts,
   with 2–4 genuinely different options, live interactions where cheap, and your pick with reasons. The owner picks a
   letter. Use the product's own example data, never the owner's personal records.
2. Commit the PM's spec as is; set `status: building` (the owner's request to build is the "go").
3. One workflow (`assets/workflows/expedited.js`): a short Part B writer (150–300 lines, no TBDs, with a test plan)
   when the change has any backend or contract part → builder(s) (backend then frontend if both), each writing or
   extending the tests for the change first and saving the red run → one independent verifier (diff review, red
   runs, real browser at phone and desktop width, light and dark) → at most one fix round + re-verify.
4. Fix the verifier's cheap minors yourself, gate, then release as agreed at the start.

## Rules that hold everywhere

- **Tests first, from the spec.** Unit, DB, API and component tests are written and seen failing for the right reason
  before the code. E2E journeys and whole-pipeline tests, written after the code, must be shown able to fail by a
  deliberate one-line break. Never weaken an assertion to make it pass; a wrong test is a reported change, not a
  quiet edit. Mechanics per stack: `references/testing.md`.
- **Measure before blaming.** No root-cause claim about slowness, flakiness or failures without measurements
  (timings, logs, load, a controlled A/B). Label guesses as guesses. When the owner pushes back, verify.
- **Report faithfully.** Say what failed, with output. If you said something that turned out wrong, correct it
  plainly in your next message. Don't call a step done because its tests pass if the goal wasn't met.
- **Only stop for the owner when needed:** product decisions, the "go", anything that spends money on external
  accounts, real credentials, irreversible production actions not covered by the deploy procedure, and any release
  step beyond what the owner chose at the start. Otherwise act.
- **Commit specific files only.** Never sweep in the PM's drafts or unrelated work. If the deploy script requires a
  clean tree and a PM draft is modified, back it up, stash only that file, deploy, pop it, and verify it's
  byte-identical.
- **Build agents never commit, push, stash, reset or touch production.** The orchestrator owns git and releases.
- **No owner-personal content in the product.** Examples in copy, placeholders, prompts and runbooks are neutral;
  specs and tests may quote the owner's case.
- **If the repo versions AI prompts, released prompts are immutable** (new version folder), unless no production
  call has used the version yet; check that with a read-only query before editing in place, and record it. Without
  read access to production, always create a new version folder.
- **Keep the owner informed in short updates** while workflows run: what finished, what's running, what's next.
- **Persist state for long epics** (a memory note or handoff file): decisions, commits, what's running, what's next,
  so work survives a context reset or a closed laptop. Pause workflows cleanly when the owner leaves; resume a
  parallel phase with a hand-written continuation script rather than resuming a run whose call order changed.

## References

| File | Read when |
|---|---|
| `references/project-setup.md` | Before the first epic in a repo, or when the scaffolding is missing |
| `references/spec-format.md` | Hand-over, spec workflow, status changes |
| `references/interview.md` | Interview and decision log |
| `references/testing.md` | Spec test plan, contract step, every workstream and verifier: markers per stack, "fails for the right reason", the test catalog, test data |
| `references/workflows.md` | Before writing any workflow script (shared prompt blocks, schemas, verifier and fixer patterns, pitfalls) |
| `references/gate-and-release.md` | Gate, the stop-after-gate report, push, deploy, post-deploy, CI, rollback |
| `references/lessons.md` | Skim once per epic: failure modes this method was shaped by |
| `references/example-epic.md` | A worked example of one full epic and one expedited change |
