# rocky-plugins

Product engineering plugins for [Claude Code](https://code.claude.com). The first one, **spec-to-ship**, is a
complete method for taking a feature from a product spec to a verified, release-ready build (push or deploy only if
you choose), with Claude as the orchestrator of many agents and you as the owner who makes the product decisions.

## Install

```
/plugin marketplace add arndtvoges/rocky-plugins
/plugin install spec-to-ship@rocky-plugins
```

or from a shell:

```
claude plugin marketplace add arndtvoges/rocky-plugins
claude plugin install spec-to-ship@rocky-plugins
```

## spec-to-ship

Hand Claude a product spec ("here's spec 07, let's build it") and it runs the method:

0. **Ask how far to go:** stop after the gate (default), commit and push, or deploy. In the same round: any design references (Figma, an existing mockup)? They become the binding look; otherwise visual changes get mockups first.
1. **Survey** the code the spec touches, with current file and line references.
2. **Interview** you: at most four questions per round, recommended option first, product questions only;
   engineering decisions are made and written down for you.
3. **Engineering spec** (Part B) under the untouched product spec (Part A), written by one agent and attacked by
   critics through five lenses (AI, privacy, data and release, UX, plan completeness), fixed, attacked again.
4. **Stop for your "go".** You see every default and the test plan in plain language before any code exists.
5. **Tests first:** the acceptance tests from the spec's test plan are written and committed failing (strict
   expected-failure markers, checked to fail for the right reason) before the feature code; each workstream writes its
   own tests first, saves the failing run, and makes them pass. End-to-end journeys are written after the code and
   proven able to fail by a deliberate break.
6. **Build:** a contract step that freezes the shared schemas and stubs, parallel workstreams with disjoint file
   ownership, an independent verifier for each, integration, end-to-end tests, docs, and lens verifiers with fix
   loops.
7. **Gate**, then only as far as you chose at the start: stop with a local commit (default), push, or deploy with
   post-deploy checks.

An **expedited track** covers small and UI-only changes: mockups first, a short engineering section, builder(s)
writing tests first, one verifier in a real browser, gate, then release only as far as you chose.

The skill also ships a catalog of test types worth having (static guards, unit and property tests, database and
migration tests, API auth and isolation matrices, leak sentinels, integration tests on a canonical dataset with an
independent oracle, frontend, E2E, release rehearsals) and where their test data comes from.

The method grew out of a dozen epics on a real, self-hosted production app. Its rules come from what went wrong
along the way: measure before blaming, run the full test suite at every step, prove that leak tests can fail, never
let build agents commit, keep the owner's personal data out of product text.

### Requirements

- **Claude Code with the Workflow tool.** Every execution phase runs as a multi-agent workflow; the skill refuses to
  run without it rather than quietly doing the work in a single context. On claude.ai the skill loads but stops.
- A repo with a CLAUDE.md (safety rules, commands), a `specs/` folder and a test suite. The skill's
  `references/project-setup.md` describes what it relies on and offers to set up what's missing. A deploy procedure
  is only needed if you want Claude to deploy.

## License

MIT
