# Gate and release

The orchestrator runs these steps. **The gate always runs; then follow the release scope from the start, never
further.** If the run turned out riskier than expected, say so and let the owner decide.

## The gate

Run after the last workflow, on the committed tree, with `assets/gate.sh` (fill in its COMMANDS block from the repo's
CLAUDE.md; an empty command is recorded as skipped). What the script doesn't say:

- Lane A's full backend suite already contains the contract/foundation tests: no separate step.
- E2E (lane B) is usually the long pole: stateful, ordered specs in one browser, mostly waiting on the UI. It uses
  little CPU, so it runs in parallel with lane A.
- The deploy rehearsal (lane C) runs only when something that goes into the image or the deploy changed against what
  production runs, or when forced; without a known production ref (no remote, no release branch) only when forced.
- Each lane gets its own docker project / test database.

Rules:

- **Never ship red.** A flaky test gets fixed (make the check robust, e.g. retry a layout measurement until it
  settles), then the gate reruns. Don't just rerun until green.
- The gate runs the whole suite as is: never `--continue-on-collection-errors`, skip lists or deselects that a
  workstream used to get past a peer's half-written file.
- Add migration rehearsals (before/after images on a synthetic database, or a copy of the production dump run by
  the orchestrator only) when the migration changes or moves data. Additive DDL can skip it; say so in Part B.

## Stop after the gate (default)

Everything stays committed locally on the run's branch; don't push. Report:

- the branch and its local commits (sha and subject, oldest first);
- the gate summary (each step's rc and time, skipped steps named);
- open issues and anything the verifiers left as minor;
- for the owner's own release: Part B's post-deploy checks, migration and rehearsal notes, owner-only steps (real
  credentials, provider dashboards, spend limits), and the acceptance criteria that can only be checked live.

The spec stays `building` until the owner confirms it's live; then set `status: done` and commit.

## Commit and push

1. Commit specific files only, on the run's branch (chosen in the first round).
2. Push that branch and open a pull request if that's how the repo works (title and body from the spec and the gate
   summary); push to the main branch directly only when the owner chose to work on it.
3. Check the CI run for the pushed commit and report its result and timing, plus the same owner notes as above. No
   deploy.

## Before the deploy (deploy scope only)

- Production reads the spec asks for (e.g. an AI cost baseline before prompt changes): read-only queries, results
  as counts and money only, written to a handoff note.
- Owner-only steps (real credentials, provider dashboards, spend limits): list them for the owner; never do them.

## Deploy

1. Commit specific files on the run's branch; get it into the main branch the way the repo merges (pull request
   with green CI, or a direct merge if the owner works that way); deploy from the merged main branch only.
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
(TTFB, connect, TLS), server load and app request logs (p50/p95/max), CDN edge location and tunnel logs.

## CI on a budget

- Measure CI per configuration before tuning (log the CPU model).
- Move costly extras (coverage, slow E2E) to a scheduled weekly job when nobody reads them per push.
- More workers than vCPUs stretches each test and invites per-test timeouts; prefer headroom.
