# Gate and release

The orchestrator runs these steps itself. Build agents never push, never deploy and never touch production.

**The gate always runs. Everything after it follows the release scope the owner chose at the start of the run:**
stop after the gate (the default), commit and push, or deploy. Never go further than the owner chose; if the run
turned out riskier than expected, say so in the report and let the owner decide.

## The gate

Run after the last workflow, on the committed tree. Template: `assets/gate.sh` (fill in the commands from the repo's
CLAUDE.md; leave a command empty when the repo has no such step, and the gate records it as skipped). Shape:

1. **Phase 1, sequential and fast:** lint, typecheck, API schema drift (regenerate → `git diff --exit-code`),
   canonical-data checks, and the **markers** check: no `ACCEPT:` tests-first tag left in the test dirs (a grep;
   the tag keeps the repo's older, legitimate expected failures out of the check). Schema regeneration runs early
   because it rewrites generated client files that later builds read.
2. **Phase 2, parallel lanes,** each with its own docker project / test database:
   - **A:** full backend suite in CI mode (it already contains contract/foundation tests: no separate step),
     frontend unit suite, frontend build, the unscoped-query (tenancy auditor) log check if the repo has one.
   - **B:** the full E2E suite, if the repo has one. Usually the long pole: stateful, ordered specs in one browser,
     mostly waiting on the UI; low CPU, so it parallelizes well with lane A.
   - **C:** the deploy rehearsal (production compose behind the real proxy setup), only if the repo has one, and
     **only when something that goes into the image or the deploy changed** against what production runs
     (Dockerfile, compose files, deploy scripts, dependency locks), or when forced. Without a known production ref
     (no remote, no release branch) it runs only when forced.
3. One summary line per step with rc and seconds (or "skipped"), a total wall time, `GATE_DONE rc=0|1`.

Rules:

- **Never ship red.** A flaky test gets fixed (make the check robust, e.g. retry a layout measurement until it
  settles), then the gate reruns. Don't just rerun until green.
- The gate runs the whole suite as is: never `--continue-on-collection-errors`, skip lists or deselects that a
  workstream used to get past a peer's half-written file.
- Add migration rehearsals (before/after images on a synthetic database, or a copy of the production dump run by
  the orchestrator only) when the migration changes or moves data. Additive DDL can skip it; say so in Part B.
- Measure the gate's own time; when it gets slow, measure where the time goes before changing anything.

## Stop after the gate (default)

Everything stays committed locally; don't push. Report:

- the local commits (sha and subject, oldest first);
- the gate summary (each step's rc and time, skipped steps named);
- open issues and anything the verifiers left as minor;
- for the owner's own release: Part B's post-deploy checks, migration and rehearsal notes, owner-only steps (real
  credentials, provider dashboards, spend limits), and the acceptance criteria that can only be checked live.

The spec stays `building` until the owner confirms it's live; then set `status: done` and commit.

## Commit and push

1. Commit specific files only (never the PM's drafts or unrelated work).
2. Push to the main branch, or open a pull request if that's how the repo works.
3. Check the CI run for the pushed commit and report its result and timing, plus the same owner notes as above. No
   deploy.

## Before the deploy (deploy scope only)

- Production reads the spec asks for (e.g. an AI cost baseline before prompt changes): read-only queries, results
  as counts and money only, written to a handoff note.
- Owner-only steps (real credentials, provider dashboards, spend limits): list them for the owner; never do them.

## Deploy

1. Commit specific files (never the PM's drafts or unrelated work); push.
2. If the deploy script needs a clean tree and a PM draft is modified: back it up, stash only that file, deploy,
   pop, verify byte-identical with `cmp`.
3. Run the project's deploy command (e.g. a script that takes a pre-deploy backup, pushes the release branch,
   triggers the platform deploy, waits for healthy containers, checks migration head, logs and readiness). Don't
   wait for CI before deploying when the local gate is green and CI minutes are scarce; check CI afterwards.

## Post-deploy checks

- Containers healthy; migration head as expected; readiness endpoint ready; no error/traceback lines in the app
  logs since the deploy.
- The feature-specific checks from Part B's release section, as exact read-only queries (e.g. "0 rows with the new
  column set right after the deploy", "new prompt versions only after the new worker's start time").
- Checks that need a later event (next scheduled sync, first AI call, a week of data) go into a handoff note with
  dates; follow up when the event happens and report.
- Check the live frontend bundle when UI changed (fetch the served assets and grep for a new string). Remind the owner
  that an installed PWA needs a close-and-reopen to load the new version.
- Optional owner smoke test, described in one or two sentences with neutral example data.

## After the deploy

- Spec front matter `status: done`, commit (spec-only commits skip CI when CI ignores docs).
- Check the main CI run for the deployed commit; report its result and timing.
- Update the persistent notes (memory / handoff) with what's live and what's still pending.

## When production "is slow"

Measure each hop before blaming anything: in-container timing, LAN through the proxy, public through the CDN
(TTFB, connect, TLS), server load and app request logs (p50/p95/max), CDN edge location and tunnel logs. In one case
the app itself answered in milliseconds and the delay was the CDN's routing; the fix was waiting it out, not a code
change.

## CI on a budget

- Measure CI per configuration (workers, coverage on/off) before tuning; runner speed varies (log the CPU model).
- Move costly extras (coverage, slow E2E) to a scheduled weekly job when nobody reads them per push.
- More workers than vCPUs stretches each test and invites per-test timeouts; prefer headroom.
- Keep tests-first strictness in committed files (see `testing.md`), so CI on an intermediate commit behaves like
  the local gate.
