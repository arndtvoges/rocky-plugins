# Spec format and lifecycle

## The `specs/` folder

```
specs/
  CLAUDE.md                 # the folder's rules (template: assets/specs-CLAUDE.md)
  01_INITIAL_SPEC.md        # one file per spec, numbered
  02_SOME_FEATURE.md
  BACKLOG.md                # plain unordered list of small follow-ups (no priorities, no front matter)
  SPIKES/                   # read-only investigation reports cited by specs (no front matter)
  MOCKUPS/                  # design references: the owner's (Figma links, exports, HTML) or approved mockups
  DRAFTS_DONT_WORK_ON/      # shelved ideas; never work on them
```

- Untracked spec files are the PM's drafts in progress: don't edit or commit them until the owner hands them over.

## Front matter = the truth about status

```yaml
---
status: ready            # draft | ready | building | done
dependency: 08_SOME_FEATURE.md   # optional; a YAML list if several
---
```

| Event | Status |
|---|---|
| PM still writing | `draft` |
| Spec committed (PM's version, or after Part B in the full track) | `ready` |
| Owner says "go" (expedited: asks for the build) | `building` |
| Live: deployed by the orchestrator with post-deploy checks passing, or confirmed live by the owner | `done` |

Commit every status change. The `> **Status:**` quote under the title is the spec's history (who wrote what when),
not its status.

## One file, two parts

```markdown
---
status: ready
---

# <Product name> — <Feature>

> **Status:** product session <owner> + PM (<date>) with a read-only spike (<date>; report: `SPIKES/...`),
> technical interview <owner> + orchestrator (<date>, owner decisions O1–On plus owner defaults D1–Dn),
> engineering spec written <date>. Part A is the product document, kept as the PM wrote it. **Part B is the
> engineering spec and build plan**; where the two differ, Part B wins (its first section lists every departure).
> The build starts only after the owner's "go".
>
> **UI reference:** `MOCKUPS/<NN>_<NAME>.html` or a Figma link (binding look), if any.
>
> **Relation to other specs:** ...

---

# Part A — Product (PM, <date>)

(the PM's sections, verbatim: problem, what we're building, principles, details, out of scope, risks, open
questions for engineering)

# Part B — Engineering spec

(see skeleton below)
```

Part A is never edited after hand-over, even to fix a typo; disagreements go into Part B's B0 table. If the owner
changes something after release, Part B records it as "owner's change of <date>" (usually built expedited; the
owner-defaults list strikes the old item through).

## Part B skeleton (full track)

Scale each section to the change; small epics merge sections. Every section is concrete: exact names, signatures,
DDL, JSON shapes, copy strings, prompt text drafts, test names, file paths with verified `file:line` refs. **No
TBDs**: decide and give the reason.

| § | Section | Contents |
|---|---|---|
| — | Status quote + baseline | Main sha, migration head before → after, API operation count before → after, released prompt versions → new ones (if the repo versions prompts), canonical numbers changed or not, next ADR number. Owner rules that apply (e.g. "no personal examples in product text"). |
| B0 | Where Part B departs from Part A | Table: Part A says / Part B says / why (decision id). |
| B1 | What ships | Numbered list; new response/request fields. |
| B2 | Semantics (MUST) | The rules: data shape and normalization, what the feature never does, what each AI call sees, error handling, privacy rules. |
| B3 | Data model and migration | DDL, constraints, downgrade behaviour, head pins in tests, backfill or none. |
| B4 | Write path and API contract | Services, routes, schemas, status codes, errors, audit, locking order. |
| B5… | Feature sections | History, search, background jobs/re-runs, carry-over, AI prompts (new version folders if the repo versions prompts), emails/exports — whatever the feature needs. |
| Bn | Frontend | Components, copy file, states (empty/filled/read-only/loading/error), a11y (44 px targets, phone width without horizontal scroll, light/dark), mocks. |
| Bn | Fakes and test data | Fake providers' hooks; whether canonical datasets change (prefer not). |
| Bn | Test plan | Per acceptance criterion, the named tests with the fields of `testing.md` "Tests first" point 1 (owner incl. `INTEGRATION`/`FINAL`, expected stub failure, regression guards per "Rules for contract-time tests"); every contract-time test writable against the contract alone; incl. leak/sentinel tests and isolation tests for every new route or parameter. |
| Bn | E2E | Which spec hosts the journey, ordering constraints, phone-width checks. |
| Bn | Docs | Every doc file/section to update; ADR (incl. amendments of older specs/ADRs); CLAUDE.md gotcha; runbook; backlog. |
| Bn | Ownership and workstreams | Contract step (single agent; the only one allowed to touch frozen files; exact file table incl. every acceptance test file, one per owner; the handover sentence (`testing.md` point 2)), concurrent workstreams with disjoint **Owns** lists, final workstream; verifier lenses; DoD per workstream. |
| Bn | Execution and release | Flow, gate commands, and the release scope the owner chose at the start (stop after the gate / commit and push / deploy). Post-deploy checks with exact queries either way (the owner runs them on their own release). Only with deploy: production checks before deploy (e.g. a cost baseline, read-only), deploy, rollback, CI check. |
| Bn | Out of scope | |
| Bn | Risks | |
| Bn | Decisions | O (owner answers), D (owner defaults), E (engineering decisions from the interview), J (spec-writer judgement calls), each with reason. |
| Bn | Acceptance criteria | Numbered, each mapped to a test in the test plan (or, only for facts that exist only live, a post-deploy check; without the deploy scope it goes into the report for the owner). |
| Bn | Owner-overridable defaults | Numbered list in plain language; "Yes keeps it; '3 no' changes one". Interview defaults first, then the writer's judgement calls the owner might care about. |

## Expedited Part B

150–300 lines: footprint (migration? new routes? prompt changes?), read shape, write shape, flows unified, copy,
a test plan (named tests per place: backend/frontend written first and seen failing; E2E incl. phone width written
after the code and proven able to fail by a deliberate break; negative tests start with a positive precondition),
docs, a release line with the scope the owner chose, B0 departures. Same "no TBDs" rule.
