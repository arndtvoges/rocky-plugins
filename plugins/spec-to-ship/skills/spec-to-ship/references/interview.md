# Interview and decision log

## Goal

Turn the product spec's open questions into decisions before the engineering spec is written, so the build never
waits on the owner and the owner never sees a surprise.

## Before asking

Run the survey first. Questions grounded in the code ("today a review card never shows a re-run in progress — what
should it do?") get better answers than abstract ones, and the survey removes questions the code already answers.
Drop anything the product spec already decides; don't re-open it.

## How to ask

- **At most 4 questions per round, at most 4 options per question.** Use the structured question tool when
  available. Rounds are unlimited: ask as many rounds as the decisions need; the first takes the big forks.
- **Recommended option first, marked "(Recommended)"**, with a one-line trade-off per option.
- **Product questions only.** If the answer changes what the user sees, what it costs, or who can do what, ask.
  If it's an engineering choice (schema shape, where a helper lives, lock order), decide it yourself and log it.
- **Batch the low-stakes questions as proposed defaults.** Before the question round, list them in your message
  ("I'd take these defaults; tell me any you want changed") and ask only the 3–4 with real trade-offs. Silence =
  accepted, but they're listed again as owner-overridable defaults in the spec.
- **Use mockups for look questions.** If the owner has to choose between layouts, show them (a published HTML page
  in the product's real tokens) instead of describing them.
- When an answer surprises you (the owner picks the non-recommended option, or adds scope), ask one follow-up only
  if the build genuinely can't proceed without it; otherwise make a sensible engineering call and log it.

## Decision log (scratch file the spec workflow reads)

```markdown
# Spec NN — decision log (interview <owner> + orchestrator, <date>)

Release scope (asked at the start): stop after the gate | commit and push | deploy.

Part A §x already settles: <list, so nobody re-opens them>.

## Owner answers (asked)
- **O1 <topic>:** <the answer, concrete enough to build from>.
- **O2 …**

## Owner defaults (proposed in the interview, not objected; listed again in Part B's owner-defaults section)
- D1 <topic>: <default>.

## Engineering decisions (orchestrator; from the survey)
- E1 <topic>: <decision> — <reason>.
```

IDs are stable for the epic and referenced everywhere (Part B, tests, commit messages, reports).
