---
name: spec-to-ship
description: >-
  Spec-driven delivery method that takes a feature from a product spec (written by a PM or the owner) to a verified
  production deploy: code survey, owner interview, decision log, engineering spec with adversarial critique rounds,
  a hard stop for the owner's "go", a contract step, parallel workstreams with independent verifiers, integration and
  E2E, lens verifiers, a release gate, deploy and post-deploy checks. It also has an expedited track (mockups, short
  engineering section, one builder plus one verifier) for small or UI-only changes. Use this skill whenever someone
  hands over a product spec, PRD, feature brief or epic and wants it built, or says things like "let's do the next
  spec", "same workflow as last time", "build spec 07", "expedited build", "turn this product doc into an engineering
  spec", "interview me about this feature", "run the gate and deploy", even if they don't name the method. Execution
  phases run as multi-agent workflows (ultracode) and require the Workflow tool.
---

# Spec to ship

A method for building software with an owner, an optional product manager (PM), and Claude as the **orchestrator**
who runs everything else through multi-agent workflows. It has been used for a dozen epics on a real production app,
from "add a comment field" to "make the app multi-tenant", and it is shaped by what went wrong along the way.

The core idea: **decide everything that can be decided before anyone writes code, then let many agents build in
parallel against a written contract, and trust nothing until an independent agent has checked it.** The owner makes
product decisions; the orchestrator makes engineering decisions, writes them down, and only stops when the owner
must decide or when an action would cost money.

## Requirements (no fallback)

- **The Workflow tool must be available.** Every execution phase (survey, spec writing and critique, contract step,
  workstreams, verifiers, fixes) runs as a workflow script. Invoking this skill is the user's opt-in to multi-agent
  orchestration: treat execution as **ultracode** (author and run a workflow for every substantive phase, favour
  exhaustive coverage and adversarial verification over token savings). If the Workflow tool is missing, stop and
  tell the user this skill can't run without it; do not quietly fall back to doing the work in one context.
- Read `references/workflows.md` before writing the first workflow script; templates live in `assets/workflows/`.
- The repo should have the project scaffolding described in `references/project-setup.md` (a CLAUDE.md with hard
  safety rules and commands, a `specs/` folder with status front matter, a test suite, a deploy procedure). If parts
  are missing, offer to set them up first; the method leans on them.

## Roles

| Role | Does | Never |
|---|---|---|
| **Owner** | Product decisions, answers interviews, says "go", approves anything that spends money or touches real credentials | — |
| **PM** (optional; may be the owner) | Writes the product spec (Part A): problem, what we build, principles, out of scope, risks, open questions | Engineering decisions |
| **Orchestrator** (you) | Survey, interview, engineering decisions, workflow scripts, commits, gate, deploy, post-deploy, honest reports | Edits the PM's drafts; skips the stop for "go"; claims a cause without measuring |
| **Build agents** (workflow subagents) | Implement one workstream inside its file ownership; report CCRs (change requests) for anything outside it | git add/commit/push, touch production, read secrets, edit files they don't own |
| **Verifiers** (workflow subagents) | Independently re-check a workstream or a lens; read-only on repo files; scratch tests only | Fix what they find (a fixer does that) |

## Pick the track

| Track | Use when | Shape |
|---|---|---|
| **Full** | New data model, migrations, AI/prompt changes, money or privacy impact, several areas of the codebase, anything you'd want a second pair of eyes on | survey → interview → decision log → spec workflow (writer + critique rounds) → owner defaults → commit → **STOP for "go"** → contract step → parallel workstreams (each build → verify → fix) → integration → final workstream (integration tests, E2E, docs) → lens verifiers → fix loop → gate → deploy → post-deploy → CI check |
| **Expedited** | Small, mostly UI or additive change; the owner says "expedited", "just a reskin", "build, gate, deploy"; the product spec already settled the behaviour | (mockups → owner picks a look) → short engineering section → one workflow: builder(s) → one verifier (diff + real browser) → at most one fix → gate → deploy |

When unsure, ask the owner which track in one question. A track can escalate: if the expedited builder hits a
migration, a contract change across many callers, or a privacy question, stop and switch to the full track.

## The full track, step by step

Each step names its reference. Read the reference when you reach the step, not all at once.

1. **Hand-over.** The owner hands over a spec (often an untracked PM draft). Commit the PM's version **as is**
   before changing anything, so Part A's history is clean. Never edit or commit other untracked specs; they are the
   PM's drafts in progress. Check the spec's `dependency` front matter: don't start while a dependency isn't `done`.
   (`references/spec-format.md`)
2. **Survey** (workflow, read-only, ~5 parallel readers by area + a synthesis agent). Map every file the change
   touches with current `file:line` refs, re-verify any older spike report, flag stale refs, and collect the product
   questions the spec leaves open. (`assets/workflows/survey.js`)
3. **Interview the owner.** At most 4 questions per round and 4 options per question, recommended option first and
   marked, as many rounds as needed. Ask only product questions with real trade-offs; decide engineering matters
   yourself. Offer the low-stakes answers as a list of proposed defaults the owner can object to, instead of asking
   each one. (`references/interview.md`)
4. **Decision log.** Write owner answers (O1…), proposed defaults (D1…) and your engineering decisions (E1…) with
   reasons into a scratch file the spec workflow reads. (`references/interview.md`)
5. **Spec workflow.** One writer drafts Part B (the engineering spec) under the PM's untouched Part A, then
   adversarial critics by lens (AI/prompts, privacy/security, data/concurrency/release, UX, plan completeness), a
   fixer, one whole-spec critic, a final fixer. (`assets/workflows/spec.js`, `references/spec-format.md`)
6. **Owner defaults.** Part B ends with a numbered list of every default the owner can still change (interview
   defaults plus the spec writer's judgement calls), written for a non-engineer. Show the owner the new items and
   ask for "yes" or "3 no, …".
7. **Commit the spec** (`status: ready`), then **STOP and wait for "go"**. This stop is the point of the method: the
   owner sees exactly what will be built before any code exists. "Go" without changes means every default stays.
8. **"Go" → `status: building`.** Commit.
9. **Contract step** (workflow: one agent + one independent verifier + up to 2 fix rounds). The only step that may
   edit frozen/shared files: migrations, models, API schemas, shared types, generated clients, stubs with final
   signatures, test fixtures and mocks. Its exit gate is the full test suite. The orchestrator commits it; after
   that, everything it touched is frozen except what it explicitly hands over. (`assets/workflows/contract.js`)
10. **Parallel workstreams** (workflow: `pipeline()` over 2–4 workstreams with disjoint file ownership; each:
    build → independent verify → fix ≤2 → re-verify). Each agent's DoD includes the **full** test suite (reduced
    worker count while several run at once), not only its own tests; a failure in a peer's half-written file is named,
    never "fixed". Apply correct CCRs yourself, then commit. (`assets/workflows/workstreams.js`)
11. **Integration → final workstream → lens verifiers** (one workflow): integration agent (handles verifier minors,
    makes everything green together incl. E2E, walks the acceptance criteria); final workstream (integration tests,
    E2E specs, docs, ADR, backlog); 4–5 lens verifiers in parallel (real browser for UX); fix loop ≤2 rounds re-running
    only failing lenses. (`assets/workflows/integrate-verify.js`)
12. **Gate** (orchestrator, parallel lanes): lint, types, contract drift, canonical data checks, full backend and
    frontend suites, build, E2E, deploy rehearsal when deploy files changed. Fix flakes properly (make the check
    robust), rerun, never ship red. (`references/gate-and-release.md`, `assets/gate.sh`)
13. **Commit, push, deploy, post-deploy checks, `status: done`, CI check, report.** Production reads are read-only
    and done by you, never by build agents. (`references/gate-and-release.md`)

## The expedited track

1. If the look matters, make **mockups first** as a published HTML page in the product's real tokens and fonts,
   with 2–4 genuinely different options, live interactions where cheap, and your pick with reasons. The owner picks a
   letter. Use the product's own example data, never the owner's personal records.
2. Commit the PM's spec as is; set `status: building`.
3. One workflow (`assets/workflows/expedited.js`): a short Part B writer (150–300 lines, no TBDs) when the change has
   any backend or contract part → builder(s) (backend then frontend if both) → one independent verifier (diff review
   + real browser at phone and desktop width, light and dark) → at most one fix round + re-verify.
4. Fix the verifier's cheap minors yourself, gate, deploy, post-deploy, `status: done`.

## Rules that hold everywhere

- **Measure before blaming.** No root-cause claim about slowness, flakiness or failures without measurements
  (timings, logs, load, a controlled A/B). Label guesses as guesses. When the owner pushes back, verify.
- **Report faithfully.** Say what failed, with output. If you said something that turned out wrong, correct it
  plainly in your next message. Don't call a step done because its tests pass if the goal wasn't met.
- **Only stop for the owner when needed:** product decisions, the "go", anything that spends money on external
  accounts, real credentials, irreversible production actions not covered by the deploy procedure. Otherwise act.
- **Commit specific files only.** Never sweep in the PM's drafts or unrelated work. If the deploy script requires a
  clean tree and a PM draft is modified, back it up, stash only that file, deploy, pop it, and verify it's
  byte-identical.
- **Build agents never commit, push, stash, reset or touch production.** The orchestrator owns git and releases.
- **No owner-personal content in the product.** Examples in copy, placeholders, prompts and runbooks are neutral;
  specs and tests may quote the owner's case.
- **Released prompts are immutable** (new version folder), unless no production call has used the version yet;
  check with a read-only query before editing in place, and record it.
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
| `references/workflows.md` | Before writing any workflow script (shared prompt blocks, schemas, verifier and fixer patterns, pitfalls) |
| `references/gate-and-release.md` | Gate, deploy, post-deploy, CI, rollback |
| `references/lessons.md` | Skim once per epic: failure modes this method was shaped by |
| `references/example-epic.md` | A worked example of one full epic and one expedited change |
