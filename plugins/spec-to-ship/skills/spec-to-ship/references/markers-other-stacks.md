# Strict markers for stacks without one

Read this only when the survey finds a stack with no strict expected-failure marker (Rust, Go, JUnit, .NET,
`node:test`, others). The rest of the mechanics (tags, the `RUN_PENDING` switch, "Fails for the right reason") are in
`testing.md`. Never fall back to a plain skip or ignore for an acceptance test (the `FINAL` placeholders are the one
skip).

## Markers

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

## Removing these markers

As in `testing.md` "Removing a marker", nothing else in the test changes:

- **Marker line** (delete it): Rust `cfg_attr`, JUnit `@Pending`.
- **Wrapper call** (replace it by the plain test call): `node:test` `pending(tag, name, fn)` becomes `test(name, fn)`.
  Go and .NET: unwrap `Pending(t, "ACCEPT:WS-B", func(t testing.TB) { ... })` or `Pending.Run("ACCEPT:WS-B", () =>
  { ... })` so the body's statements sit directly in the test function, every statement unchanged (only the
  indentation moves).
