---
name: spec-to-ship
description: >-
  Spec-driven multi-agent delivery: product spec → survey and owner interview → engineering spec with critique and
  a test plan → stop for "go" → tests first → parallel build with verifiers → release gate; push or deploy only if
  chosen. Expedited track for small or UI-only changes.
  Use this skill whenever someone hands over a product spec, PRD, feature brief or epic and wants it built, or says
  things like "let's do the next spec", "same workflow as last time", "build spec 07", "expedited build", "turn this
  product doc into an engineering spec", "interview me about this feature", "run the gate and deploy", even if they
  don't name the method. Execution phases run as multi-agent workflows (ultracode) and require the Workflow tool.
---

# Spec to ship

A method for building software with an owner, an optional product manager (PM), and Claude as the **orchestrator**
who runs everything else through multi-agent workflows.

The core idea: **decide everything that can be decided before anyone writes code, write the tests from the spec
before the code that makes them pass, then let many agents build in parallel against a written contract, and trust
nothing until an independent agent has checked it.** The owner makes product decisions; the orchestrator makes
engineering decisions and writes them down.

## Requirements (no fallback)

- **The Workflow tool must be available.** Every execution phase runs as a workflow script. Invoking this skill is
  the user's opt-in to multi-agent orchestration: treat execution as **ultracode** (author and run a workflow for
  every substantive phase, favour exhaustive coverage and adversarial verification over token savings). If the
  Workflow tool is missing, stop and tell the user this skill can't run without it; do not quietly fall back to doing
  the work in one context.
- The repo should have the project scaffolding (a CLAUDE.md with safety rules and commands, a `specs/` folder with
  status front matter, a test suite; see `references/project-setup.md`). If parts are missing, offer to set them up
  first; the method leans on them.

## First question: how far should this run go?

Ask once, at the start (with the track question if that's open too). Record it in the decision log (expedited:
Part B's release line + notes).

| Option | What happens after a green gate |
|---|---|
| **Stop after the gate** (recommended default) | Everything is committed locally; you report and stop. The owner pushes and releases themselves. |
| **Commit and push** | Push to the main branch (or open a PR if the repo works that way); check CI; no deploy. |
| **Deploy** | Push, run the project's deploy procedure, post-deploy checks, `status: done`. Only offer this when the repo has a documented deploy procedure (`references/project-setup.md` §5). |

A request that already names the scope ("build, gate, deploy", "just commit it") answers this question. Don't
re-ask later; the answer holds for the whole run.

**In the same round, ask for design references:** a Figma link, an existing mockup or HTML file, screenshots. If
there is one, it becomes the binding look: store it in `specs/MOCKUPS/` (or link it there) and name it in the spec
header; read Figma through a design connector when one is available, otherwise ask for exports. Part B, the frontend
builders and the UX verifier work against it, and no mockups get invented. If there is none and the change is
visual, offer mockups (expedited step 1; in the full track before the interview's look questions).

## Roles

| Role | Does | Never |
|---|---|---|
| **Owner** | Product decisions, answers interviews, says "go", approves anything that spends money or touches real credentials | — |
| **PM** (optional; may be the owner) | Writes the product spec (Part A): problem, what we build, principles, out of scope, risks, open questions | Engineering decisions |
| **Orchestrator** (you) | Engineering decisions, workflows, commits, gate, release as agreed, honest reports | Edits the PM's drafts |
| **Build agents** (workflow subagents) | Implement one workstream inside its file ownership; report CCRs (change requests) for anything outside it | git add/commit/push/stash/reset, touch production, read secrets, edit files they don't own |
| **Verifiers** (workflow subagents) | Independently re-check a workstream or a lens; read-only on repo files; scratch tests only | Fix what they find (a fixer does that) |

## Pick the track

| Track | Use when |
|---|---|
| **Full** (steps 0–13 below) | New data model, migrations, AI/prompt changes, money or privacy impact, several areas of the codebase, anything you'd want a second pair of eyes on |
| **Expedited** (steps 1–4 below) | Small, mostly UI or additive change; the owner says "expedited", "just a reskin", "build, gate, deploy"; the product spec already settled the behaviour |

When unsure, ask the owner which track in one question. A track can escalate: if the expedited builder hits a
migration, a contract change across many callers, or a privacy question, stop and switch to the full track.

## The full track, step by step

Each step names its reference. Read the reference when you reach the step, not all at once.

0. **Release scope.** Ask the first question (or take it from the request, e.g. "build, gate, deploy").
1. **Hand-over.** The owner hands over a spec (often an untracked PM draft). Commit the PM's version **as is**
   before changing anything, so Part A's history is clean. Check the spec's `dependency` front matter: don't start
   while a dependency isn't `done`. (`references/spec-format.md`)
2. **Survey** (read-only workflow, ~5 readers + synthesis): touched files with current `file:line` refs, test layers
   and strict markers, open product questions. (`assets/workflows/survey.js`)
3. **Interview the owner:** product questions with real trade-offs only (decide engineering yourself), low-stakes
   ones as proposed defaults; format (4×4, recommended first, unlimited rounds) in `references/interview.md`.
4. **Decision log** (template in `references/interview.md`) in a scratch file the spec workflow reads.
5. **Spec workflow.** A writer drafts Part B (the engineering spec) under the untouched Part A → lens critics →
   fixer → whole-spec critic → fixer. Part B includes a **test plan** mapping every acceptance criterion to named
   tests. (`assets/workflows/spec.js`, `references/spec-format.md`, `references/testing.md`)
6. **Owner defaults.** Part B ends with a numbered list of every default the owner can still change. Show the owner
   the new items and ask for "yes" or "3 no, …".
7. **Commit the spec** (`status: ready`), then **STOP and wait for "go"**. This stop is the point of the method: the
   owner sees exactly what will be built before any code exists. "Go" without changes means every default stays.
8. **"Go" → `status: building`.** Commit.
9. **Contract step** (one agent + verifier + up to 2 fix rounds). The only step that edits frozen/shared files
   (migrations, models, schemas, generated clients, stubs, fixtures/mocks); it commits the test plan's acceptance
   tests **failing** under strict `ACCEPT:<OWNER>` markers, E2E/pipeline tests as `ACCEPT:FINAL` placeholders. Exit
   gate: the full suite. Afterwards frozen except its handover. (`assets/workflows/contract.js`,
   `references/testing.md`)
10. **Parallel workstreams** (`pipeline()` over 2–4 workstreams with disjoint ownership; each: **tests first** →
    build → independent verify → fix ≤2 → re-verify). Each DoD includes the **full** test suite. Apply correct CCRs
    yourself, then commit. (`assets/workflows/workstreams.js`)
11. **Integration → final workstream → lens verifiers** (one workflow): integration, then the final workstream, then
    4–5 lens verifiers (real browser for UX), then a fix loop of ≤2 rounds re-running only failing lenses.
    (`assets/workflows/integrate-verify.js`)
12. **Gate** on the committed tree: no `ACCEPT:` marker left, never ship red. (`references/gate-and-release.md`,
    `assets/gate.sh`)
13. **Release** as chosen in the first question; report contents in `references/gate-and-release.md`.

## The expedited track

1. If the look matters and the owner has no design reference, make **mockups first** as a published HTML page in the product's real tokens and fonts,
   with 2–4 genuinely different options, live interactions where cheap, and your pick with reasons. The owner picks a
   letter. Use the product's own example data, never the owner's personal records.
2. Commit the PM's spec as is; set `status: building` (the owner's request to build is the "go").
3. One workflow (`assets/workflows/expedited.js`): a short Part B when the change has any backend or contract part
   → builder(s) (backend then frontend if both), tests first, red run saved → one independent verifier → at most one
   fix round + re-verify.
4. Fix the verifier's cheap minors yourself, gate, then release as agreed at the start.

## Rules that hold everywhere

- **Tests first, from the spec.** Tests are written and seen failing for the right reason before the code. E2E
  journeys and whole-pipeline tests, written after the code, must be shown able to fail by a deliberate one-line
  break. Never weaken an assertion to make it pass; a wrong test is a CCR. Mechanics per stack:
  `references/testing.md`.
- **Measure before blaming.** No root-cause claim about slowness, flakiness or failures without measurements
  (timings, logs, load, a controlled A/B). Label guesses as guesses. When the owner pushes back, verify.
- **Report faithfully.** Say what failed, with output. If you said something that turned out wrong, correct it
  plainly in your next message. Don't call a step done because its tests pass if the goal wasn't met.
- **Only stop for the owner when needed:** product decisions, the "go", anything that spends money on external
  accounts, real credentials, irreversible production actions not covered by the deploy procedure, and any release
  step beyond what the owner chose at the start. Otherwise act.
- **Commit specific files only;** never sweep in the PM's drafts or unrelated work.
- **No owner-personal content in the product.** Examples in copy, placeholders, prompts and runbooks are neutral;
  specs and tests may quote the owner's case.
- **If the repo versions AI prompts, released prompts are immutable** (new version folder), unless no production
  call has used the version yet; check that with a read-only query before editing in place, and record it. Without
  read access to production, always create a new version folder.
- **Keep the owner informed in short updates** while workflows run: what finished, what's running, what's next.
- **Persist state for long epics** (a memory note or handoff file): decisions, commits, what's running, what's next,
  so work survives a context reset or a closed laptop. Pause workflows cleanly when the owner leaves.

## References

| File | Read when |
|---|---|
| `references/project-setup.md` | Before the first epic in a repo, or when the scaffolding is missing |
| `references/spec-format.md` | Hand-over, spec workflow, status changes |
| `references/interview.md` | Interview and decision log |
| `references/testing.md` | Spec test plan, contract step, workstreams, verifiers (markers per stack, test catalog) |
| `references/markers-other-stacks.md` | Only when the survey finds a stack without a strict expected-failure marker (Rust, Go, JUnit, .NET, `node:test`, others) |
| `references/workflows.md` | Before writing any workflow script |
| `references/gate-and-release.md` | Gate, the stop-after-gate report, push, deploy, post-deploy, CI, rollback |
| `references/lessons.md` | Skim once per epic: failure modes this method was shaped by |
| `references/example-epic.md` | A worked example of one full epic and one expedited change |
