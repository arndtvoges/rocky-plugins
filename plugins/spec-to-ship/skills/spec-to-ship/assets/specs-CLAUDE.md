# specs/

- Status lives in YAML front matter (the `> **Status:**` line below the title is history): `draft` → `ready`
  (committed, waiting for pickup or the owner's "go") → `building` (the "go"; expedited: the request to build) →
  `done` (live: after the orchestrator's own deploy, else when the owner confirms it). A new spec has front matter
  from its first commit.
- Optional `dependency`: the file name of a spec that must be `done` before this one is built (e.g.
  `dependency: 08_SOME_FEATURE.md`; a YAML list if there are several). Don't start a build while a dependency isn't
  `done`.
- A spec has two parts: Part A (the product document, kept as the PM wrote it) and Part B (the engineering spec,
  which wins where they differ and lists every departure in its first section).
- Design references live in `MOCKUPS/` (the owner's Figma links, exports or HTML, or approved mockups named after
  their spec, e.g. `12_FEATURE_PREVIEW.html`); the spec names them in its header as the binding look.
- `BACKLOG*.md` and spike reports in `SPIKES/` are not specs (no front matter); a spike report stays as long as a
  spec cites it. `DRAFTS_DONT_WORK_ON/` is shelved: never work on it.
- Untracked specs are the PM's drafts in progress: don't edit or commit them until the owner hands them over.
- `ls specs/` before picking a spec number.
