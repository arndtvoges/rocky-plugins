# Workflow scripts

Every execution phase is a Workflow script. Templates in `assets/workflows/` are complete, runnable scripts with a
`CONFIG` block at the top: copy one, fill in the config (repo path, spec path, scratch dir, commands, workstreams,
the absolute paths of this skill's references where a template asks for them, since subagents don't know where the
plugin is installed), adjust the prompts to the spec, and pass it inline to the Workflow tool. CONFIG placeholders
like `<§ ownership>` stand for the section of *your* Part B; fill in the real section.

| Template | Phase | Agents |
|---|---|---|
| `survey.js` | Survey before the interview | 5 readers + 1 synthesis |
| `spec.js` | Part B writer + critique rounds | writer, 5 lens critics, fixer, whole-spec critic, fixer |
| `contract.js` | Contract step | builder, verifier, ≤2 × (fixer + verifier) |
| `workstreams.js` | Parallel workstreams | per workstream: tests first + build, verify, ≤2 × (fix + verify) |
| `integrate-verify.js` | Integration, final workstream, lens verifiers, fix loop | integration, final, 5 lenses, ≤2 × (fixer + failing lenses) |
| `expedited.js` | Expedited track | Part B writer, backend, frontend (each tests first), verifier, ≤1 fix + re-verify |

## The shared prompt block (BASE)

Every agent prompt starts with the same block. Subagents get the repo's CLAUDE.md automatically, so name only the
rules a phase needs; don't paste CLAUDE.md. The block states:

1. Repo path, current main sha, what is live, and the spec path with "Part B wins over Part A; the owner kept
   every default" (or which ones changed).
2. What is already committed in earlier phases and therefore **frozen** (changes go into the report as a CCR:
   exact file, exact diff, reason).
3. Hard safety rules: the template's `CONFIG.safety` (survey/spec: their inline rules line), filled from the repo
   CLAUDE.md (`project-setup.md` §1) plus "never touch the PM's drafts or production".
4. The owner rules for the product (e.g. "no owner-personal examples in product text", "no third-party trackers").
5. "Other agents work in the same tree at the same time: edit only the files your workstream owns, never revert or
   reformat others' changes, expect unrelated files to change under you; name a peer's failure, never fix it." Plus
   the peer-error rule (DoD below) and the unexpected-pass rule (`testing.md`).
6. Pointers to background files (survey, decision log) instead of pasting them.
7. Known harness gotchas, e.g. escaped Unicode (`\uXXXX`) typed into tool inputs can be written as the literal
   invisible character: build such characters in code and scan written files for stray format characters.

## Structured results

Reuse the templates' schema constants (REPORT, VERDICT, ACCEPTANCE). The rules the schemas don't show: `tests`
(contract step: `exit_gate`) lists every DoD command with its counts; the orchestrator pastes each owner's slice of
the contract step's `acceptance_tests` into that workstream's CONFIG entry; a verifier passes only when no blocker
or major remains; a fix loop runs while any non-minor finding exists, capped at 2 rounds (1 for expedited).

## Definition of done (DoD) per agent

- **Tests first** per `testing.md` point 3 (red run saved, own markers removed, assertions never changed; a wrong
  test is a CCR).
- Lint, format check, type check, the project's guard scripts.
- Its own test paths while iterating (no parallelism flags, fast feedback).
- **The full test suite once at the end**, with a reduced worker count when several agents run suites at once.
- **Peer errors:** if collection or compilation fails in a file the agent doesn't own (a peer's half-written file),
  rerun once a few minutes later; if it still fails, report `peer error: <file>`. The DoD is then its own paths plus
  the full suite minus the named peer errors (pytest: `--ignore <file>` for that run; never in the gate). Give
  workstreams whole packages/modules where possible, so in a compiled stack a half-written file breaks only its owner.
- Contract drift check (API schema regenerated → no diff) and canonical-data checks when they exist.
- Frontend: typecheck, unit tests, lint, format check, a build into a temp dir (never the gate-only commands).
- E2E where the agent changed user-visible behaviour (the final workstream and fixers of UX findings).

## Verifiers

- Independent: a fresh agent that didn't build the thing, with the builder's report as a claim to check.
- Read-only on repo files; scratch tests and screenshots only under a scratch dir.
- Tests-first evidence: `testing.md` "What verifiers check". Flag outside-ownership changes only when the agent's
  `files_changed` lists them or no workstream owns the file (in a shared tree, others' edits aren't its doing).
- Concrete checks, not "review the code": re-run the DoD, write scratch tests for the risky cases (races, other
  tenants' ids, user decisions never overwritten, error paths), drive a real browser on an agent-safe dev stack at
  phone and desktop width, light and dark, measure 44 px targets on each control's own box, look for horizontal
  scroll at phone width.
- Lens verifiers for the final pass, chosen by the feature's risks: money/figures, AI and prompts (load the Claude
  API skill before judging Anthropic-facing code), privacy and injection (prove leak tests actually capture logs by
  injecting a sentinel and watching them fail), re-runs and races, tenancy and guards, UX in a real browser.

## Fixers

A fixer gets the builder's report and the verifier's findings, fixes every blocker and major (and cheap minors) with
tests, and re-runs the full DoD. Then the same verifier lens runs again (round N+1). Only failing lenses re-run.

## Orchestration patterns

- `pipeline()` for workstreams: each runs build → verify → fix without waiting for the others.
- `parallel()` only where the next step needs all results (e.g. a fixer that takes every failing lens at once).
- Commit between workflows (contract, workstreams, integration) so each phase starts from a clean, named commit and
  "frozen" means something.
- Keep agents per workflow reasonable (≤10–15); split big phases into consecutive workflows.

## Pitfalls seen in practice

- **Resuming a parallel phase** re-runs agents when the call order changed; after a pause, write a continuation
  script that starts from the last committed state and reads a handoff note.
- **Agents claiming facts from the task text:** verify them before commit; verifiers flag unverified claims.
- **Builders sweeping formatters over the whole tree** reformat peers' files; tell them to format only their paths.
- **Global state leaks between tests** (a flag set by one test changes later tests on the same worker) show up only
  under new test orders; reset process globals in `finally`.
