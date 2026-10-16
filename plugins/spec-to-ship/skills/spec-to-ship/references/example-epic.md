# Worked examples (from a real production app)

## Full track: "free-text notes on records, fed to AI calls"

Both examples ran with the owner's release scope set to "deploy", and both predate the tests-first rule: their
agents wrote tests alongside the code.

**Hand-over.** The PM's product doc (problem: records nobody can make sense of later; a short free-text note on any
record, shown in details and lists, with history, fed into every AI call) plus a read-only spike report on what
each AI call sees. The orchestrator committed both as handed over.

**Survey** (5 readers + synthesis, ~15 min). Found that a history view already existed (history = existing audit rows,
no schema change), that search already matched the record's main text field, that the migration-rehearsal tool only
supported earlier migrations, and that detecting stale upstream data needed a new per-source date. It produced 27
product questions.

**Interview.** One round of 4 questions (review card behaviour while the AI re-runs; what changes when a source's
data is stale; what counts as "stale"; notes in exports and emails) plus 17 proposed defaults listed in the
message. The owner picked three recommendations and one non-recommended answer (notes in the weekly summary email
too).

**Spec workflow** (writer, 5 lens critics, fixer, whole-spec critic, fixer; ~90 min). Round 1: 58 findings, 0
blockers, 17 majors (e.g. the analysis tools would have shown user names inside other labels to a model that then
dropped its own findings for repeating them). Round 2: 1 blocker: database errors would have printed the note
into logs. Part B ended at ~2,200 lines with 24 owner defaults (17 from the interview, 7 judgement calls).

**Stop for "go".** The owner said "Go" without changes.

**Build.**
- Contract step (1 agent + verifier, ~50 min): migration, schema fields, database-error hygiene, stubs, byte copies
  of five new prompt versions, mocks. Full suite green; verifier pass; committed.
- Workstreams (backend, AI, frontend in parallel, ~65 min): each passed its own verifier first time; two CCRs applied
  by the orchestrator (a new export column broke one API test and one E2E header).
- Integration + final workstream + 5 lenses (~2.4 h): integration proved all 22 leak tests could fail and fixed
  one capture gap; the final workstream added the pipeline test, a new E2E spec and docs; the UX lens found an
  undersized button and a layout overflow at phone width; one fix round.

**Gate.** Green except one E2E measurement taken mid-render after a viewport change; the check was made to retry
until the layout settled, then the gate was green. **Deploy** with a pre-deploy backup; post-deploy queries;
pending checks (first data import with the new column, first AI calls with the new prompt versions, a cost
comparison a week later) went into a handoff note with dates.

**After release.** The owner disliked the note UI on sight. Mockups with four options → the owner picked one →
expedited reskin (builder + browser verifier) → gate → deploy, the same afternoon.

## Expedited track: "pick which existing rows a change applies to"

The PM's note: an "also apply to N existing rows" offer was all-or-nothing; show the N rows and let people untick
some, everywhere the offer appears. The owner asked for mockups first.

- Mockup page: the shared dialog with a switch between two row styles (newest first vs grouped by current
  group), the phone bottom sheet where only the list scrolls, the other places that show the offer. Live ticking. The
  owner: "Beautiful. A."
- One workflow: short Part B (~250 lines: rows from the existing preview route with paging, an optional include or
  exclude id list on the existing apply inputs, one shared offer flow, no migration, no new route) → backend →
  frontend (full E2E suite green, incl. a phone-width check that the buttons stay on screen) → verifier (pass, 4
  minors).
- The orchestrator fixed two minors (an "Also apply to 0" offer that did nothing; a wrong error code in the spec),
  ran the gate (green), deployed, set `status: done`.
