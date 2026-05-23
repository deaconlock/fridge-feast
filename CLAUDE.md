# Fridge Feast — Project Guide for Claude Code

You are helping Deacon work on **Fridge Feast**, a photo-first app for deciding what to cook with ingredients already in the fridge. Before doing anything, follow the steps below.

---

## Step 1 — Load the research database

There should be a file at `./docs/research/FridgeFeast_Research.xlsx` (or similar in this folder).

**If the file exists:**

1. Read it using `extract-text` or the openpyxl Python library — start with the `Project Context` tab. That tab contains the validation-stage summary, the working ICP, current research state, and the pre-committed kill criteria.
2. Confirm to Deacon, in one sentence, what stage of validation the project is at and what the immediate next action is according to that tab.
3. Wait for Deacon's actual task before doing anything else.

**If the file does NOT exist:**

Stop and ask Deacon to add it. Use this exact message:

> I can't find the research database at `./docs/research/FridgeFeast_Research.xlsx`. This file contains the validation context for Fridge Feast — Core Pain entries, Adjacent Pains, Competitive Graveyard, and the working ICP. Without it, I'll be working without the research grounding that everything in this project depends on.
>
> Please drop the latest version (`FridgeFeast_Research_v4.xlsx` or newer) into `./docs/research/` and let me know when it's there. If you've renamed it, tell me the path.

Then wait. Do not proceed with any task until the file is loaded.

---

## Step 2 — Match the task to the right tab

When Deacon gives you a task, identify which research tab is most relevant and read **only that one** (not the whole file). The tabs are designed for different decisions:

| Task type | Read this tab |
| --- | --- |
| Landing copy, pitches, headlines | `Core Pain` (mine for verbatim phrases) |
| Pricing, positioning, competitor comparisons | `Competitive Graveyard` |
| Pivot or scope questions | `Adjacent Pains` |
| Re-running the cluster analysis | `How to use + Claude prompt` |
| Adding a new comment entry | `Core Pain` or `Adjacent Pains` (apply the disqualifier check from the `How to use` tab) |

If multiple tabs apply, read them in order of relevance, and tell Deacon which ones you loaded.

---

## Step 3 — Respect the validation stage

The project is currently in **passive listening → interviews** transition. **Do not** generate:

- Landing pages
- Production code or build scaffolding for new features
- Marketing copy
- Pricing pages
- Design mockups beyond exploratory sketches

…until Deacon confirms that interviews 2–10 have happened and the validation playbook has progressed past Step 2. The premature-build trap is real and the playbook exists to avoid it.

What you **can** help with at the current stage:

- Drafting interview scripts (Mom Test compliant — past behaviour, not future intent)
- Reviewing new Core Pain or Adjacent entries against the disqualifier check
- Running the clustering prompt over the collected data
- Analysing competitive landscape questions (especially: why Allrecipes killed their Dinner Spinner app)
- Editing the spreadsheet itself (adding entries, fixing classifications, updating context)

---

## Step 4 — When in doubt, push back

Deacon explicitly wants honest pushback, not encouragement. If a request would:

- Skip ahead of the validation playbook
- Re-introduce framing the data doesn't support (e.g. ICP assumptions not grounded in the research)
- Confuse "this should exist" with "this is a business"
- Conflate enthusiasm with evidence

…flag it directly and explain the concern. The cost of friction now is much lower than the cost of building the wrong thing.

---

## Pre-committed kill criteria (do not move these)

- If <4 of every 10 interviewees describe Fridge Feast pain as a weekly frustration → shelve.
- If landing page converts <5% on real traffic → fix pitch once, then shelve if still low.
- If zero people pre-pay $1 to reserve a spot → shelve.
- If the deeper pain turns out to be meal planning or batch cooking (not real-time fridge decisions) → pivot, don't build as currently scoped.

If Deacon proposes a decision that would soften any of these criteria, push back. They're committed to prevent motivated reasoning later.
