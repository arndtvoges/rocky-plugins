# Worked examples (from a self-hosted budgeting app)

## Full track: "transaction comments and AI context"

**Hand-over.** The PM's product doc (problem: transactions nobody can read later; a 60-character comment on any
transaction, shown in details and lists, with history, fed into every AI call) plus a read-only spike report on what
each AI call sees. The orchestrator committed both as handed over.

**Survey** (5 readers + synthesis, ~15 min). Found that a "Change history" card already existed (history = existing
audit rows, no schema change), that search already matched the payee, that the migration-rehearsal tool only
supported earlier migrations, and that detecting bank-side data lag needed a new per-account date. It produced 27
product questions.

**Interview.** One round of 4 questions (review card behaviour while the AI re-runs; what changes when an account's
data is stale; what counts as "stale"; comments in exports and emails) plus 17 proposed defaults listed in the
message. The owner picked three recommendations and one non-recommended answer (comments in the digest email too).

**Spec workflow** (writer, 5 lens critics, fixer, whole-spec critic, fixer; ~90 min). Round 1: 58 findings, 0
blockers, 17 majors (e.g. the analysis tools would have shown member names in category names to a model that then
dropped its own findings for repeating them). Round 2: 1 blocker: database errors would have printed the comment
into logs. Part B ended at ~2,200 lines with 24 owner defaults (17 from the interview, 7 judgement calls).

**Stop for "go".** The owner said "Go" without changes.

**Build.**
- Contract step (1 agent + verifier, ~50 min): migration, schema fields, database-error hygiene, stubs, byte copies
  of five new prompt versions, mocks. Full suite green; verifier pass; committed.
- Workstreams (backend, AI, frontend in parallel, ~65 min): each passed its own verifier first time; two CCRs applied
  by the orchestrator (a new export column broke one API test and one E2E header).
- Integration + final workstream + 5 lenses (~2.4 h): integration proved all 22 leak tests could fail and fixed
  one capture gap; the final workstream added the pipeline test, a new E2E spec and docs; the UX lens found a 41.8 px
  button and a layout overflow at phone width; one fix round.

**Gate.** Green except one E2E measurement taken mid-render after a viewport change; the check was made to retry
until the layout settled, then the gate was green. **Deploy** with a pre-deploy backup; post-deploy queries;
pending checks (first sync with the new column, first AI calls with the new prompt versions, a cost comparison a
week later) went into a handoff note with dates.

**After release.** The owner disliked the comment UI on sight. Mockups with four options → the owner picked one →
expedited reskin (builder + browser verifier) → gate → deploy, the same afternoon.

## Expedited track: "apply a new rule to selected rows only"

The PM's note: "Also apply to N existing transactions" was all-or-nothing; show the N rows and let people untick
some, in nine places that show the offer. The owner asked for mockups first.

- Mockup page: the shared dialog with a switch between two row styles (newest first vs grouped by current
  category), the phone bottom sheet where only the list scrolls, the review card, the rule editor. Live ticking. The
  owner: "Beautiful. A."
- One workflow: short Part B (~250 lines: rows from the existing preview route with paging, an optional include or
  exclude id list on the existing apply inputs, one shared offer flow, no migration, no new route) → backend →
  frontend (60/60 E2E incl. a phone-width check that the buttons stay on screen) → verifier (pass, 4 minors).
- The orchestrator fixed two minors (an "Also apply to 0" offer that did nothing; a wrong error code in the spec),
  ran the gate (green), deployed, set `status: done`.
