# Lessons this method was shaped by

Each rule in SKILL.md exists because something went wrong without it. Skim this once per epic.

## Process

- **The stop for "go" catches real problems.** Owners change defaults when they see them written down in plain
  language; after release, a change costs a second deploy.
- **Owners react to looks, not descriptions.** A comment field described as "a small Add comment button under the
  merchant" was approved in the interview and rejected on sight after release ("hiding it in plain sight"). For
  anything visual, show mockups before building.
- **Interview fatigue is real.** A survey produced 27 product questions; asking 4 and offering 23 as defaults kept the
  owner engaged and nothing important was lost.
- **Expedited doesn't mean unverified.** Even a reskin got one independent verifier in a real browser; it caught a
  41.8 px button (44 required) and a focus bug.
- **Specs written by agents claim things.** A spec writer described an in-place prompt edit as "before any
  production call"; it was true, but only a production query proved it. Verify claims that came from the prompt.

## Engineering

- **The contract step makes parallel work safe.** Workstreams that share schemas, stubs and fixtures from one
  committed contract rarely collide; workstreams that each extend shared files do.
- **Run the full suite at every step.** Bugs at integration time were mostly things a full-suite run in the
  workstream would have shown (a peer's export column breaking another file's test; order-dependent global state).
- **Leak tests can pass vacuously.** A log-capture fixture that depends on logging having been configured earlier in
  the same worker made "no comment text in logs" tests pass without capturing anything. Prove each sentinel test can
  fail.
- **Database errors carry row values.** Constraint violations print the failing row (all columns, user text
  included) into exception messages, tracebacks and job error columns. Sanitize at the engine level.
- **Example text leaks into the product.** The owner's personal purchase from the spec's problem statement ended up
  as a prompt example and in the runbook. Product text uses neutral examples.
- **Released prompts are immutable.** New behaviour = new version folder; old renders stay byte-identical and are
  snapshot-pinned.

## Measuring

- **Measure before blaming.** "Agents compete for the Mac's CPU" was wrong; measurements showed an idle CPU and a
  per-test database teardown forcing an fsync. "The server is slow" was a CDN route through another continent.
- **Time every test.** One 5-minute test floored a 6-minute suite and went unnoticed until per-test durations were
  printed. Print the slowest tests in every run.
- **Splitting a test doesn't help if each piece repeats the expensive setup.** Build the shared state once (e.g. a
  template database the pieces clone).
- **One CI run proves nothing about speed.** Free runners vary ~1.5× between runs; log the runner's CPU and compare
  several runs.

## Honesty

- When you said something wrong ("this run logs the CPU model" when the step didn't exist yet), correct it in the
  next message, plainly.
- Don't report a step done because its tests pass if the goal wasn't met (a test split that saved nothing).
