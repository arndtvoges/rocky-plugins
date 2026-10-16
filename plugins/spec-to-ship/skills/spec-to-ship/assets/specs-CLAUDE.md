# specs/

Each spec starts with YAML front matter holding its status: `draft` (being written), `ready` (complete, waiting to
be picked up or for the owner's "go"), `building`, `done` (live in production). The front matter is the truth; the
`> **Status:**` line below the title is the history of how the spec came about.

- Optional `dependency`: the file name of a spec that must be `done` before this one is built (e.g.
  `dependency: 08_SOME_FEATURE.md`; a YAML list if there are several). Don't start a build while a dependency isn't
  `done`.
- Update the status at each step: spec committed → `ready`, owner's "go" → `building`, deployed → `done`. A new spec
  gets front matter from its first commit.
- A spec has two parts: Part A (the product document, kept as the PM wrote it) and Part B (the engineering spec,
  which wins where they differ and lists every departure in its first section).
- `BACKLOG*.md` and spike reports in `SPIKES/` are not specs (no front matter); a spike report stays as long as a
  spec cites it. `DRAFTS_DONT_WORK_ON/` is shelved: never work on it.
- Untracked specs are the PM's drafts in progress: don't edit or commit them until the owner hands them over.
- `ls specs/` before picking a spec number.
