# Fridge Feast — Research Summary

**Author:** Deacon Lock
**Date:** 2026-05-21
**Status:** Pre-build validation phase (Step 1 of 5 complete; Step 2 in progress)
**Purpose:** Objective summary of research data collected to date, for external review.

---

## 1. Project Concept

**Fridge Feast** is a hypothesised mobile app that helps users decide what to cook with the ingredients already in their fridge. Intended workflow: user takes 2–5 photos of ingredients, an AI identifies them, user selects meal type / cuisine / "recipe mood" (familiar vs adventurous), and the app returns cookable recipes.

**Intended differentiation from existing competitors:**
- **Photo input** instead of manual pantry maintenance (the SuperCook pain point)
- **AI-generated recipes** instead of a fixed scraped recipe database
- **Cross-cuisine lateral translation** of orphaned specialty ingredients
- **Mobile-first** rather than web-with-mobile

**Origin:** Founder's wife (Rosan) found SuperCook intolerable to use (manual ingredient entry, stale UX). The project was triggered by her frustration; she is currently the prototype user.

---

## 2. Validation Methodology

Five-step playbook adopted before any code is written:
1. Passive listening on Reddit / TikTok / YouTube to surface raw pain language.
2. 8–10 problem interviews with home cooks.
3. Pricing question framed by current spend.
4. Landing page with a real price.
5. Pre-committed kill criteria.

The author is currently transitioning from Step 1 to Step 2.

**Pre-committed kill criteria** (set before data collection, to prevent motivated reasoning):
- If <4 of every 10 interviewees describe the pain as a *weekly* frustration → shelve.
- If landing page converts <5% on real traffic → fix pitch once, then shelve if still low.
- If zero people pre-pay $1 to reserve a spot → shelve.
- If the deeper pain is meal-planning or batch-cooking (not real-time fridge decisions) → pivot rather than build as scoped.

---

## 3. Data Sources & Findings

### 3.1 Passive listening on Reddit (Step 1)

**Method:** Searched Reddit using Google site-search for phrases like *"what should I cook with"*, *"I have"*, *"in the fridge"*, *"random ingredients"*. Each candidate comment was checked against a written disqualifier: *"Would this person open Fridge Feast tonight to solve their stated problem?"* — if no, it was moved to an Adjacent bucket or Competitive Graveyard rather than counted as Core Pain.

**Volume:** 17 original entries collected; 8 reclassified as Adjacent or Graveyard after applying the disqualifier check. Final Core Pain count: **9 entries**.

**Source distribution:**
- 8 of 9 Core Pain entries from r/Cooking.
- 1 of 9 from r/EatCheapAndHealthy.
- Adjacent Pains (13 entries): primarily r/MealPrepSunday, plus r/Cooking and r/EatCheapAndHealthy.

**Three Core Pain sub-shapes emerged:**

| Sub-shape | Count | Description | Representative quote |
|---|---|---|---|
| Fresh produce paralysis | 4 | Standing in front of the fridge with no plan | *"I typically open the pantry and/or freezer and stare at the contents listlessly."* (44 upvotes) |
| Specific ingredient combo helplessness | 2 | A finite list of items and no idea what to make | *"The only four ingredients I have left… bacon, syrup, pasta, & black pepper."* |
| Specialty leftover orphaning | 2 | Forgotten specialty ingredients or cross-cuisine leftovers | *"I have lotus root, quail eggs, fish balls — and no idea what to do with them outside their original cuisine."* |
| Aspirational / "want the skill" | 2 | Want to learn to cook without recipes | *"How do I learn to look at random ingredients and make something?"* |

**Adjacent Pain themes (13 entries):**
- Variety exhaustion / "tired of cooking the same 5 dinners" (largest cluster)
- Time pressure / energy depletion
- Identity & relational stakes (e.g. husband frustrated about not having dinner ready for his wife)
- Meal planning systems (spreadsheets, Etsy planners)
- Guilt about ordering delivery

**Notable absences in Core Pain comments:**
- Zero mentions of competitors (Supercook, Allrecipes, Paprika, ChatGPT, Pinterest, Google).
- Zero mentions of money spent or willingness to pay.
- The one competitor mention in the entire dataset (*"Supercook just gives me the same garbage"*) appears in the **Adjacent** bucket, in a variety-exhaustion complaint.

### 3.2 Competitive Graveyard

| Product | Status | Notes |
|---|---|---|
| **Allrecipes — Dinner Spinner** (mobile app) | **Discontinued** | A well-resourced incumbent built exactly this feature, ran it for years, then killed the app. Users on Reddit still surface it unprompted years later. Reason for shutdown unresearched. |
| **Supercook** | **Live, unfunded since ~2009** | 11M+ scraped recipes, 18K source sites, 20 languages. Ad-supported. Founder has publicly asked for monetisation advice. Multiple user complaints about pantry-maintenance burden. |
| **Paprika App** | **Live, paid (one-time)** | Recipe manager first, ingredient search second. Suggests a paid model can work for a well-built focused product, but its primary value prop is not ingredient-matching. |
| **App Store "Allrecipes" knockoff** | **Live (likely scam)** | 2.7 stars, 262 reviews. Charges "lifetime access" but reportedly doesn't function. Notable as a demand-strength signal — scammers don't target dead categories. |

**Key unanswered commercial question:** Why did Allrecipes discontinue Dinner Spinner? (Likely candidates: weak ad unit economics, low daily-active use, strategic refocus on web. Not yet investigated.)

### 3.3 Independent clustering analysis (Step 1.5)

The 9 Core + 13 Adjacent comments were submitted to a fresh Claude session (no prior project context) with a pre-written prompt asking for cluster analysis, frequency × desperation ranking, and an explicit "honest verdict" on whether to continue.

**Summary of that analysis's conclusions:**
- The Core Pain is *recognisable* but tonally **resigned**, not desperate. No cluster sits in the "frequent AND emotionally charged" quadrant.
- The Adjacent comments contain **substantially more emotional weight** — guilt, shame, marital frustration, identity stakes — than the Core comments.
- The absence of competitor mentions in Core comments suggests the pain is not acute enough to drive solution-seeking.
- The 44-upvote "stare listlessly" comment confirms the *moment* resonates widely, but engagement on the feeling does not equal willingness to pay.
- The analysis recommended either (a) collecting more Core Pain data from outside r/Cooking, or (b) considering a reframe toward the household-cook / variety pain that is louder in the Adjacent bucket.

### 3.4 Founder's spouse interview (Step 2, n=1)

A structured conversation with Rosan surfaced **two distinct pains in one household**:

- **Deacon's pain (the non-cook):** waste and storage. Small leftover ingredients accumulate in the fridge / freezer, take up space, and are eventually thrown out. Frames as money loss and clutter.
- **Rosan's pain (the cook):** creativity / inspiration. She enjoys cooking; she opens the fridge and wants help bridging available ingredients into a meal that is (a) healthy and (b) matches her current cuisine mood. She also reports forgetting what is in the freezer.

These are **two different jobs-to-be-done** sharing the same physical scene (the fridge). Rosan's pain matches the original Fridge Feast spec closely; Deacon's pain is closer to a pantry-inventory / waste-tracking product.

**Methodological caveat:** Rosan is the founder's spouse, lives in the same household, and is aware of the project. Her data is high-resolution but cannot be treated as independent.

### 3.5 Reddit post (Step 2, in flight)

A post asking *"What do you actually do when you open the fridge with no plan?"* was submitted to **r/Cooking** (removed by moderators within minutes — sub-wide rule against "what should I make" questions) and then to **r/EatCheapAndHealthy** (live at time of writing, no replies yet).

No data points yet.

### 3.6 WhatsApp parenting group chat (Step 2, n≈7)

The same question was posted in a parenting group chat. ~7 substantive responses returned. Themes:

| Theme | Frequency | Sample quote |
|---|---|---|
| **Plan ahead** (weekly menu, rotation) | 2+ | *"We plan one week's worth of dinner and repeat it weekly... alternate Mondays different style or flavour of chicken"* |
| **Batch / freezer-prep** | 3+ | *"Homemade chicken stock... prepare a batch weekly, then freeze it"*; chicken marinades batched every 2 weeks |
| **Fast trusted playbook** | 2 | *"Mille feuille pot... dinner within 20 mins ish"* |
| **Sometimes just give up** | 2 | *"Sometimes it's just not worth all that effort and it's okay to get food delivered"* |
| **Buy hardware** | 1 | *"Or invest in thermomix"* |

**Notable absences in the chat:**
- Zero respondents described the "open the fridge with random ingredients and don't know what to cook" moment.
- Zero respondents mentioned an app, AI, ChatGPT, Google, or recipe-search.
- Zero respondents mentioned waste, expiring ingredients, or leftovers.
- Zero respondents described Rosan's "what cuisine am I in the mood for" question.

**Methodological caveat:** Parenting group chats bias toward organised planners (kids force planning) and toward respondents confident enough to share a system publicly. People without a system may have stayed silent. Not a representative sample of home cooks.

---

## 4. Patterns Observed Across Sources

| Hypothesis | Reddit Core | Reddit Adjacent | Spouse (n=1) | Parenting chat (n≈7) |
|---|---|---|---|---|
| Photo-the-fridge / ingredient-led cooking is a felt pain | Weak signal (resigned tone) | — | Strong (matches spec) | **Not mentioned** |
| Meal-planning / variety / "tired of repeating myself" | Weak | **Strong** (largest cluster) | Partial (cuisine variety) | **Strong** (dominant theme) |
| Food waste / leftover guilt | Weak | Moderate | Strong (Deacon's pain) | **Not mentioned** |
| Willingness to pay for a solution | No evidence | Indirect (Etsy planner mentioned) | Untested | No evidence |
| Current workaround is acceptable | Yes (default to pasta / takeout) | Mixed | No | Yes (planning, batching) |

**The pattern is consistent across three of four sources:** the meal-planning / variety / "I want to feel fresh again" pain is louder, more emotional, and more frequently mentioned than the fridge-photo moment. The fridge-photo moment is corroborated only by Rosan, who is n=1 and not independent.

---

## 5. Decisions Made

- The project is **not killed**.
- No code or landing page has been written.
- The author is currently treating the data as suggesting *either* (a) the original product needs sharper validation among non-spouse home cooks who are anti-planners, or (b) a reframe toward the meal-planning pain is worth exploring.

---

## 6. Open Questions for the Professor

1. Is the methodology of the disqualifier check (Core vs Adjacent bucketing) sound, or is it too restrictive / too generous?
2. Is the founder's spouse interview methodologically defensible as a data point, given the obvious dependence?
3. The dominant signal across non-spouse sources is meal-planning / variety, not fridge-paralysis. Is the right next move to (a) gather more disconfirming data on the original hypothesis, or (b) start surfacing the meal-planning hypothesis directly?
4. The competitive graveyard contains one well-resourced incumbent that built and killed this exact feature (Allrecipes Dinner Spinner). How much weight should this carry relative to the user-language evidence?
5. Sample size remains very small (Core n=9 from one subreddit; spouse n=1; group chat n≈7 from one demographic). What is the minimum sample needed before any pivot/persist decision?
6. The author has pre-committed numeric kill criteria (e.g. <40% weekly-pain threshold in interviews). Are these thresholds reasonable, or too generous / too strict?

---

## 7. Appendices (available on request)

- **Appendix A** — Full Core Pain entries (9 verbatim Reddit quotes with sources, demographic hints, sub-shape tags).
- **Appendix B** — Full Adjacent Pains entries (13 verbatim Reddit quotes).
- **Appendix C** — Competitive Graveyard detail.
- **Appendix D** — Full clustering analysis output from independent Claude session.
- **Appendix E** — WhatsApp screenshots (7 respondents, parenting group).

Source spreadsheet: `docs/research/FridgeFeast_Research.xlsx`.
