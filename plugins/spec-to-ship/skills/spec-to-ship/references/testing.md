# Testing: tests first, and which tests are worth having

## Tests first (how the method does TDD with many agents)

Tests are written from the spec before the code that makes them pass, at four points:

1. **Part B plans them.** Every acceptance criterion gets at least one named test: file, test name, layer from the
   catalog below, what it proves, its owner, and the failure it should show against the stub (the stub's
   not-implemented error, a 501 from a stub route, or an assertion on value X). Only a fact that exists only live
   ("the first scheduled run after the deploy uses the new version") may be a post-deploy check instead; without the
   deploy scope it goes into the final report for the owner. The owner sees the test plan before "go".
2. **The contract step writes the acceptance tests** against the frozen contract (schemas, stubs with final
   signatures, fixtures) and commits them **failing**, under a strict expected-failure marker whose reason tag is
   exactly `ACCEPT:<OWNER>`:
   - `<OWNER>` is a workstream key (uppercase, e.g. `WS-B`) when one workstream can make the test pass;
   - `INTEGRATION` when the test needs several workstreams (prefer splitting it into one test per workstream plus
     one integration test); the integration agent removes these markers;
   - `FINAL` for E2E journeys and whole-pipeline integration tests, which are placeholders, not failing tests (see
     "The exception" below).

   One acceptance test file per owner (two if its tests need two runners, e.g. backend and frontend), listed in the
   contract's file table. The contract's handover sentence hands each file to its owner **for marker removal only**
   (the `FINAL` file: placeholders replaced by the real tests); the assertions stay frozen.
3. **Each workstream starts with tests.** Before implementing, it writes its own unit/DB/API/component tests from
   Part B, runs them, and saves the **red run** to a scratch file: the command, the failing test names, the first
   failure line of each. Every failure must be missing behaviour ("Fails for the right reason" below). Then it
   implements until those tests and its acceptance tests pass, and removes the markers in its own acceptance file(s)
   ("Removing a marker" below). It never edits an acceptance assertion; a wrong test is a CCR to the orchestrator,
   with the reason. If a test it doesn't own passes unexpectedly in its full-suite run, it reports `unexpected pass:
   <test> (owner <OWNER>)` and leaves the marker alone; the orchestrator moves it to its owner or to the integration
   agent.
4. **The final workstream replaces the `FINAL` placeholders** with the real E2E and pipeline tests and proves each
   one can fail: break the behaviour in one line, watch the test fail, revert, and record the failure line in its red
   run.

**The exception.** E2E journeys and whole-pipeline integration tests are not written failing by the contract step.
Written against a UI or pipeline that doesn't exist yet, they'd guess locators and shapes, burn a full timeout on
every run and leave half-run state in an ordered suite. The contract step adds one named placeholder per criterion
instead, which doesn't run and leaves no state: `test.fixme('AC7 <criterion> ACCEPT:FINAL', async () => {})`
(Playwright), `@pytest.mark.skip(reason="ACCEPT:FINAL")` on a test whose body is `...`, or the runner's skip/todo
with the tag in the reason or name. Their "seen failing" proof is the deliberate break in point 4.

**Pure helpers** the contract step implements fully follow the same order inside that one agent: tests first, a red
run against the stub, then the implementation. The red run goes into its report.

**The expedited track** has no contract commit and no markers: each builder writes or extends the tests for the
change first, saves the red run to `<scratch>/red-<backend|frontend>.txt`, then implements; the verifier reads those
files.

### Rules for contract-time tests

- **Negative and invariant tests start with a positive precondition that fails on a stub.** "A foreign id answers
  404" first checks that the own tenant's request answers 200 (a route that isn't registered already 404s); "the
  sentinel appears in no log" first shows the failure path ran (a log line was captured, the job reached `failed`).
  Without that, the test passes against the stub and the strict marker turns the gate red.
- **Criteria that already hold before the build** ("existing behaviour unchanged") are regression guards: written
  green, unmarked, and labelled as regression guards in the test plan.
- **No self-recording assertions.** No snapshot or screenshot assertion that writes its baseline on the first run
  (`toMatchSnapshot`, `toHaveScreenshot`, a snapshot plugin in update mode): use explicit assertions. If the suite
  has such assertions elsewhere, run the contract gate in CI mode (`CI=true`, `--ci`, `--update-snapshots=none`) so
  a missing baseline fails instead of being written. The owning workstream creates snapshots from the real output.
- **Backend stubs** raise the language's not-implemented error, with the final names and signatures.
- **Frontend stubs** are modules with the final exports and prop types that render `null` (components) or return the
  contract's mock fixtures (hooks, API clients). They never throw, least of all asynchronously: an error thrown in an
  effect, an event handler or an un-awaited promise is an "unhandled error" that fails the whole run, marker or not.
  A test against such a stub fails by assertion (element not found).

### Strictness lives in committed files

A strict marker fails the run when a marked test unexpectedly passes, so nobody "finishes" a criterion by accident
and nobody forgets to remove a marker. Put the strictness in committed files (the marker itself, a helper, the runner
config), never in a CLI flag, so CI on any intermediate commit behaves like the local gate: green with markers, red on
an unexpected pass. One switch turns the markers off so the real failures can be printed: the env var `RUN_PENDING=1`
(pytest: `--runxfail`).

| Stack | Strict marker (committed) | Markers off |
|---|---|---|
| pytest | `@pytest.mark.xfail(strict=True, raises=(NotImplementedError, AssertionError), reason="ACCEPT:WS-B")` (a global `xfail_strict = true` only if the repo has no other xfails: it makes every old xfail strict) | `pytest --runxfail -rf <paths>` |
| Vitest | the `pending` helper below, built on `test.fails` | `RUN_PENDING=1 npx vitest run <paths>` |
| Jest (28.1+, jest-circus) | the same helper built on `test.failing` | `RUN_PENDING=1 npx jest <paths>` |
| Playwright | first line of the test: `test.fail(!process.env.RUN_PENDING, 'ACCEPT:WS-C')` (rare: E2E normally uses `FINAL` placeholders) | `RUN_PENDING=1 npx playwright test <spec>` |
| RSpec | first line of the example: `pending 'ACCEPT:WS-B' unless ENV['RUN_PENDING']` (RSpec's `pending` is strict) | `RUN_PENDING=1 bundle exec rspec <paths>` |

```ts
// test/pending.ts: shared helper (Jest: use test.failing)
import { test } from 'vitest'
export const pending = (tag: string) => (name: string, fn: () => unknown) =>
  (process.env.RUN_PENDING ? test : test.fails)(`${name} [${tag}]`, fn)
// usage: pending('ACCEPT:WS-C')('shows the note under the title', async () => { ... })
```

Only pytest's `raises=` also checks *why* a test fails; the other markers accept any error, timeouts included. So
the reason check is a separate, mechanical step. Don't copy the usage comment into the repo: keep the literal tag out
of the helper's own file, or the gate's `markers` step finds it there.

### Fails for the right reason (mechanical)

Run the marked tests once with markers off and write a table to a scratch file: test, owner, first failure line.
Every line must be one of:

- the stub's not-implemented error (`NotImplementedError`, `todo!()`, `UnsupportedOperationException`, …);
- a 5xx/501 from a stub route, seen as an assertion failure on the status;
- an assertion on the expected value (including "element not found" against a frontend stub that renders `null`).

An import, attribute, type or name error, a missing fixture, a 404 from a route that isn't registered, a timeout or
an unhandled async error means the test is wrong: fix it before committing. The contract step reports the table in
its `acceptance_tests` (`reason_seen`); workstreams save theirs as `red_run`; verifiers re-run the marked tests with
markers off and check the lines themselves.

### Stacks without a strict expected-failure marker

Never fall back to a plain skip or ignore for an acceptance test (the `FINAL` placeholders are the one skip).

- **Rust:** stubs use `todo!()`. Acceptance tests carry
  `#[cfg_attr(not(feature = "run_pending"), should_panic(expected = "not yet implemented"))] // ACCEPT:WS-B`, which
  checks the reason too; for a test that fails by assertion, drop `expected`. Declare `run_pending = []` under
  `[features]`; markers off is `cargo test --features run_pending`. `should_panic` is strict: no panic, test fails.
- **Go:** a committed helper (in a `_test.go` file or a test-only package) runs the body against a recording
  `testing.TB` and fails when nothing failed. The body uses only the `t` it is given (no subtests):

  ```go
  type recorder struct { testing.TB; failed bool; first string }
  func (r *recorder) fail(s string)             { if !r.failed { r.failed, r.first = true, s } }
  func (r *recorder) Error(a ...any)            { r.fail(fmt.Sprint(a...)) }
  func (r *recorder) Errorf(f string, a ...any) { r.fail(fmt.Sprintf(f, a...)) }
  func (r *recorder) Fail()                     { r.fail("Fail") }
  func (r *recorder) Failed() bool              { return r.failed }
  func (r *recorder) Fatal(a ...any)            { r.fail(fmt.Sprint(a...)); runtime.Goexit() }
  func (r *recorder) Fatalf(f string, a ...any) { r.fail(fmt.Sprintf(f, a...)); runtime.Goexit() }
  func (r *recorder) FailNow()                  { r.fail("FailNow"); runtime.Goexit() }

  func Pending(t *testing.T, tag string, body func(t testing.TB)) {
  	t.Helper()
  	if os.Getenv("RUN_PENDING") != "" { body(t); return }
  	r := &recorder{TB: t}
  	done := make(chan struct{})
  	go func() {
  		defer close(done)
  		defer func() { if p := recover(); p != nil { r.fail(fmt.Sprint("panic: ", p)) } }()
  		body(r)
  	}()
  	<-done
  	if !r.failed { t.Fatalf("%s passed unexpectedly: remove Pending", tag) }
  	t.Logf("%s pending: %s", tag, r.first)
  }
  ```

  Used as `Pending(t, "ACCEPT:WS-B", func(t testing.TB) { ... })`; stubs `panic("not implemented")`.
- **Java/Kotlin (JUnit 5):** stubs throw `UnsupportedOperationException` (Kotlin: `TODO()`). A ~20-line
  `InvocationInterceptor` extension behind `@Pending("ACCEPT:WS-B")`: when `RUN_PENDING` is set it just runs the
  test; otherwise it aborts the test (`TestAbortedException` with the failure message) when the body throws, and
  fails it when the body passes. JUnit Pioneer's `@ExpectedToFail("ACCEPT:WS-B")` does the same if the project may
  add that test dependency, but has no off switch.
- **.NET:** a `Pending.Run("ACCEPT:WS-B", () => { ... })` helper that catches the stub's `NotImplementedException` and
  the framework's assertion exception and fails when nothing was thrown (xUnit, MSTest). NUnit 3+ records an
  assertion failure in the result before throwing it, so a catch doesn't help there: use the fallback below.
- **Node's built-in runner** (`node:test`; its `todo` isn't strict): a helper `pending(tag, name, fn)` that wraps
  `test(...)`, runs `fn(t)` directly when `RUN_PENDING` is set, and otherwise catches the failure (logging it with
  `t.diagnostic`) and calls `assert.fail(...)` when `fn` didn't throw.
- **Anything else:** tag the acceptance tests (build tag, JUnit `@Tag`, test category), exclude the tag from the
  normal suite, and add a `pending-check` command that runs only the tagged tests with a JUnit XML report and fails if
  any of them passed. Run `pending-check` in every DoD and in the gate, or unexpected passes go unnoticed.

### Removing a marker

A workstream removes a marker in one of two ways, depending on the stack, and changes nothing else in the test:

- **Marker line:** delete the line. pytest `xfail` decorator, Playwright `test.fail(...)`, RSpec `pending`, Rust
  `cfg_attr`, JUnit `@Pending`.
- **Wrapper call:** replace the wrapper by the plain test call, body untouched. Vitest/Jest: `pending('ACCEPT:WS-C')(`
  becomes `test(` on the same line. node:test: `pending(tag, name, fn)` becomes `test(name, fn)`. Go and .NET:
  unwrap `Pending(t, "ACCEPT:WS-B", func(t testing.TB) { ... })` or `Pending.Run("ACCEPT:WS-B", () => { ... })` so
  the body's statements sit directly in the test function, every statement unchanged (only the indentation moves).

So `git diff -w -U0 <contractSha> -- <acceptance files>` shows only deleted marker lines and the rewritten opening and
closing lines of unwrapped wrappers; every assertion line is unchanged.

### What verifiers check

- Every acceptance criterion maps to a test (or to a live-only post-deploy check).
- Each owned acceptance test existed with its marker at the contract commit: `git show <contractSha>:<file>`. Never
  check out an old commit; the contract's green strict gate proves the test failed then.
- `git diff -w -U0 <contractSha> -- <acceptance files>` removes or unwraps only markers ("Removing a marker"), every
  assertion line unchanged; in the `FINAL` file, placeholders are replaced by real tests. Any other change needs an
  applied CCR.
- The red run file exists and every line is missing behaviour; marked tests run with markers off show the expected
  failure. Optionally reproduce a workstream's own red run: `git archive <contractSha> | tar -x -C <scratch>/base`,
  copy the new tests in and watch them fail.
- At the end of the build: no `ACCEPT:` tag left in the test dirs (the gate's `markers` step), no acceptance assertion
  weakened or deleted since the contract commit.

## The catalog

Pick the layers the feature needs; most features touch four or five. Each line says what the layer catches that the
others don't. Layers marked "(if …)" apply only when the project has that shape. Libraries, CLIs and mobile apps map
the rest: API tests become public-API tests of the library, golden CLI output on fixed inputs, or simulator/device UI
tests; E2E becomes a scripted session against the built artefact.

### Static checks and guards (every change, before any test)
- Linting, formatting and strict type checking on backend and frontend.
- **Custom AST guards for project rules:** no direct clock calls (time is injected), no float money, one choke
  point for sensitive writes, one writer for encrypted fields, no unscoped queries. Cheap, and they catch whole
  classes of agent mistakes.
- **Contract drift:** the API schema is regenerated and must match what's committed; the generated client too.

### Unit tests (pure logic, milliseconds each; most of the suite)
- Example-based tests of domain rules, including pinned edge cases ("a false positive that must stay false").
- **Property-based tests** (Hypothesis, fast-check): invariants such as "parts sum to the total" over thousands of
  generated inputs.
- **Contract pins:** public signatures, dataclass fields and enum values must not drift.
- **Snapshot tests** for AI prompts, tool definitions and email templates, byte for byte; updated only on purpose,
  and released versions stay pinned forever. Never at contract time (see the rules above).

### Database tests (real database in a container; a fresh database per test)
- A fresh database per test, cloned from a migrated template (or the stack's fastest way to get a clean database).
- Service behaviour against real SQL: transactions, locks, concurrency, queues with SKIP LOCKED.
- **Migrations:** upgrade, downgrade (or its refusal), idempotence, "migrated == freshly created".
- **Multi-tenant isolation (if multi-tenant):** every query scoped; an SQL auditor flags any unscoped statement during
  the run.
- **Races:** both orders of a concurrent write (e.g. a user edit while a background job is in flight).

### API tests (HTTP through the real app)
- **Auth matrix (if the app has users):** every route checked for anonymous, member, and (if multi-tenant) another
  tenant.
- **Isolation matrix (if multi-tenant):** another tenant's ids answer like unknown ids (404), for every new route or
  parameter.
- **API snapshot:** paths, params, status codes and models frozen.
- Error envelopes, input validation (including inputs the database can't represent), rate limits.

### Privacy and leak tests
- **Sentinel tests:** put a unique string into user text, run the failure paths (exceptions, retries, a forced
  database constraint violation, a failing background job) and assert the string appears in no log line, job
  result, error column or foreign audit row. **Prove each one can fail** by temporarily logging the sentinel.
- Escaping in emails (HTML) and exports (formula injection in CSV).

### Integration tests (the whole pipeline in one process, fakes for every external service)
- Real sync → ingest → background processing → reports, against a fake external API server and a fake LLM.
- A canonical dataset plus an independent oracle that computes the expected numbers separately from the app's code.

### Frontend tests (components and pages in a simulated browser with a mocked API)
- Rendering, user flows, every state (empty, filled, editing, read-only, loading, error), copy, accessibility
  (labels, roles, keyboard, focus return), what is sent in each request.

### End-to-end tests (real browser against a full disposable stack)
- Few tests, each a long user journey; ordered and stateful when that mirrors real use.
- A mobile project: phone width without horizontal scroll, 44 px touch targets measured on each control's own box,
  an open sheet or dialog keeping its buttons on screen.
- Measurements retry until the layout settles (no sleeps).

### Release rehearsals (if the project deploys containers; before a deploy)
- Production compose behind the real proxy setup: headers, cookies, client IP, backup and restore.
- Migration rehearsal on a synthetic database shaped like production, and (orchestrator only) on a copy of the
  production dump, with before/after snapshot diffs.

### Live smoke tests and independent review
- Opt-in tests against the real AI provider, owner only, never in CI.
- Independent verifier agents per workstream and per lens (money, tenancy, AI, privacy, UX) before release.

## Where test data comes from

No test talks to a real external service; real data appears only in the orchestrator's final rehearsal.

- **Canonical dataset:** a seeded generator writes a fixed, realistic dataset (accounts, a year of records, edge
  cases); regenerated only on purpose and checked for drift.
- **Expected numbers** computed from that dataset by an independent, dependency-free oracle, never by the app's code.
- **Fake servers** for every external API (data feed, email/OAuth, captcha, payment), in-process or as a container;
  they serve the canonical data and can mint extra tenants or special accounts on demand.
- **Fake LLM:** deterministic answers from a catalog keyed by input, plus directives that force refusals, failures
  and delays; feature-specific hooks (e.g. a keyword table) local to the fake.
- **Factories:** small helpers that build valid rows with sensible defaults, overridden per test.
- **Generated inputs:** property-test strategies.
- **Frontend mocks:** typed fixtures that mirror the API's serializer rules, served by a mocked network layer.
- **Time:** an injected clock (frozen or offset), so dates are reproducible.

## A fast suite makes all of this affordable

The method runs the full suite at every step, so its speed matters. Measure first (per-test durations, database
teardown cost, scheduler behaviour), then fix the measured causes: a no-fsync tmpfs test database, a work-stealing
parallel scheduler, longest-first ordering that keeps fixture groups together, and splitting the one test that floors
the run (with its expensive setup built once and cloned). Print the slowest tests in every run.
