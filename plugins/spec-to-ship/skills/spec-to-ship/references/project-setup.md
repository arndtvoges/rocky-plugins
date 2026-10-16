# Project scaffolding the method relies on

The method is stack-agnostic, but it leans on a few things in the repo. Before the first epic, check for them and
offer to add what's missing (as a small change of its own, committed before the epic starts).

## 1. A root CLAUDE.md that agents can trust

Subagents read it automatically, so it carries the rules every agent must follow:

- **Hard safety rules** at the top: an agent marker env var every shell exports (the app can refuse to load real
  secrets when it's set), never read/print secret files, never contact real external services (list them), use
  fake providers in dev/test, only agent-safe ways to start stacks (own project names, ports, volumes), never touch a
  stack you didn't create, **build agents never git add/commit/push/stash/checkout/reset** (the orchestrator commits).
- **Commands table:** install, backend tests (own paths while iterating; the full suite command with worker count),
  foundation/contract tests, lint/types, frontend commands for agents vs gate-only, schema regeneration, dataset
  regeneration, dev stack, E2E (and how to iterate on one spec), deploy rehearsal and image build (if any), CLI.
- **Architecture map** (folders and what lives where) and **gotchas** learned in earlier epics (one bullet per
  hard-won rule, with the reason). Each epic's final workstream adds its gotchas.
- **Ownership and change requests:** agents edit only files their workstream owns; anything else is a CCR (exact
  file, exact diff, reason) in their report. A list of frozen foundation files.

## 2. A `specs/` folder with status front matter

See `spec-format.md`. Copy `assets/specs-CLAUDE.md` into `specs/CLAUDE.md` so every agent that reads a spec sees the
lifecycle rules.

## 3. Docs the build updates

- `docs/architecture.md` (normative names/signatures/DDL/API plus a change log section), `docs/adr/` (one ADR per
  epic decision that outlives the spec), `docs/runbook.md` (owner operations, post-deploy checks), a handoff folder
  for notes between sessions or phases, `specs/BACKLOG.md` (plain unordered list).
- A work plan holding the agents' DoD (`workflows.md` "Definition of done").

## 4. Tests that make parallel agents safe

Per `testing.md`: the catalog layers the project's shape needs, a strict expected-failure marker in committed files
with an off switch (stacks without one: `markers-other-stacks.md`), guard scripts, a canonical dataset + independent
oracle (so "numbers unchanged" is a one-line check), and a suite fast enough that every agent runs it in full.

## 5. A deploy procedure (only for the "deploy" release scope)

Don't build a deploy procedure unless the owner wants Claude to deploy. If they do: one command that takes a backup,
ships the release, waits for healthy services, checks the migration head, logs and readiness, and prints what it did.
Read-only production access for post-deploy queries. Owner-only steps written down in the runbook.
