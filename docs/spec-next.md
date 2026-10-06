# BabyTrails: what's next (draft spec)

*Draft for Thomas's approval, 6 October 2026. Once approved, the agreed parts move into `SPEC.md`
as new sections and this file is deleted. Nothing here is built yet.*

## 1. Why

BabyTrails grew out of a months-long chat with an AI assistant about one baby. Each check-up, a
photo of the same health booklet page with new rows; between check-ups, home measurements, a
"what if he's a bit longer?", a "that doesn't sound possible", and follow-up questions that built on earlier
answers: where is he on the charts, how fast is he gaining, is that rate usual, will he stay big?
Along the way it produced charts and a shareable growth report.

The first version of BabyTrails covers the records: WHO charts computed by code, the booklet read
into rows the parent confirms, encrypted on the device. This spec covers **the rest of that
experience**: answering the next question, showing growth over time, catching a doubtful number,
and a report worth sending to family. The aim is to keep what made the chat useful and design out
what made it fragile: numbers worked out by a model, an assumption turning into a saved
measurement, charts drawn by an image model, reassurance instead of a reference.

## 2. Principles (additions to SPEC section 10's rules)

1. **The code computes; the AI explains; the parent confirms.** Unchanged, and it now covers answers
   to free-form questions: every number about the baby in an answer must come from the code (8).
2. **References, not reassurance.** "Is this normal?" is answered by comparing with a reference the
   code computes from WHO data (5), described neutrally. The app never says "normal", "healthy",
   "good" or "nothing to worry about", and never the opposite.
3. **What-ifs are never saved.** Trying a number in the form shows its percentile without saving
   (already true); answers never treat a hypothetical as a measurement.
4. **Doubt is recorded, not deleted.** A measurement can be marked as doubtful and kept out of charts
   and summaries without losing it (6).
5. **Flag changes, not positions.** A baby who is large all round would get the same "above the 97th
   percentile" flags at every visit. Flags say what's new (7).
6. **No projections.** No future weight, length or adult height, on charts or in answers. Infant
   percentiles shift in the first two years, and a projected point drawn next to measured ones
   reads as a fact.

## 3. Build order

Each step is its own pull request, merged with Thomas's OK.

| Step | What | AI? | Shared core? |
| --- | --- | --- | --- |
| 1 | Booklet pages with new rows aren't skipped (PR #5) | no | no |
| 2 | Gain over time and "on the same percentile line" (4, 5) | no | no |
| 3 | Newborn details and flags about changes (7) | no | no |
| 4 | Doubtful measurements: where measured, sanity checks, "leave out" (6) | no | no |
| 5 | The report card (9) | optional | maybe the layout primitives |
| 6 | Look-alike booklet pages for the demo and tests (10) | no | no |
| 7 | Ask about the numbers (8) | yes | proposed for the core, with LabTrails |
| 8 | WHO growth velocity tables (5, second part) | no | no |

Steps 2–4 make the facts richer, and steps 5 and 7 build on those facts, so the order matters.

## 4. Gain over time

**What:** weight gain in g/week, and length and head gain in cm/month, between every pair of
consecutive measurements of that kind (a weight-only visit doesn't break the length series).

- **Measurements screen:** a "Gain" column beside each value ("+150 g/week since 15 Aug").
- **Overview:** a "Gain over time" card: one bar per interval for weight, newest last, with the
  dates on tap. Length and head as a second tab when there are at least three such measurements.
- **Facts for the AI:** `intervals` for the last six intervals per measure, so a summary can say
  "weight gain has slowed at each of the last four visits" from code-computed numbers.
- **Short intervals** (under 7 days for weight, under 21 days for length or head) are shown with a
  note that small differences between scales or measurers dominate, and aren't used for trend
  statements.

```ts
type Interval = {
  measure: 'weight' | 'length' | 'head'
  from: string; to: string; days: number
  change: number            // kg or cm, as measured
  perWeek?: number          // weight, grams per week
  perMonth?: number         // length and head, cm per 30.4375 days
  sameLine?: number         // see 5: the gain that keeps the same z-score, same unit
  short: boolean
}
```

**Tests:** intervals skip missing values; units; short intervals; leaving out doubtful
measurements; the facts never hold dates of birth or names (dates in intervals become ages in days
before anything is sent).

## 5. "Is this gain usual?": references from WHO data

**Part one (step 2, no new data): the same percentile line.** For each interval, the code works out
the gain that would have kept the baby on the same z-score: the value at the earlier z-score at the
later age (`valueAtZ`, already in `src/growth/lms.ts`), minus the earlier value. It works for any
interval, uses only the tables the app already has, and answers the real question for a baby
following his own curve:

> 15 Aug → 15 Sep: gained 150 g a week. Staying on the same weight-for-age line would have meant
> about 140 g a week, so the weight percentile rose slightly (52nd → 54th).

(Illustrative wording and numbers, not from a real child.)

**Part two (step 8): WHO's growth velocity standards.** WHO publishes increment standards for
weight (1- and 2-month intervals), length (2-, 3-, 4- and 6-month) and head circumference (2-, 3-,
4- and 6-month), birth to 24 months. When two measurements are close to one of those intervals, the
code can place the increment on WHO's increment percentiles. **To verify before building:** the
exact tables and their parameters (WHO describes them as LMS-type with a shift for negative
increments), WHO's tolerance for how far an interval may differ from the nominal one, and the
licence, which should match the tables BabyTrails already downloads (and the permission request to
WHO should mention them). Intervals that don't fit are not scaled; the app says "WHO's reference
covers 1- and 2-month intervals" and shows part one only.

## 6. Doubtful measurements

- **Where measured:** `Measurement.place?: 'clinic' | 'home' | 'other'`. Read from a document →
  `clinic` by default (editable at review). Typed in → the form asks, remembering the last choice.
  Charts draw home measurements as hollow points; the facts include the place.
- **Sanity checks**, in the form and on the review screen, after the existing hard ranges:
  - *Far off the chart for the age:* |z| ≥ 4 → "That's far above the chart for this age. Babies are
    hard to measure at home; if you can, measure again." Still savable. Beyond WHO Anthro's
    "biologically implausible" limits (weight-for-age below −6 or above +5, length-for-age beyond
    ±6, weight-for-length and head beyond ±5; **to check against Anthro's documentation**) → "This
    is very unlikely to be right. Check the number and the unit." Savable only after a second tap.
  - *Shrinking:* length or head more than 1 cm less than the previous measurement → "Length can't
    go down; one of the two measurements is probably off. Measurements of a baby's length often
    differ by about a centimetre."
  - *A big jump in a short time:* a z-score change of 1 or more within 4 weeks → "This is a big
    change since <date>. Check the number."
- **Leave out:** `Measurement.excluded?: boolean`, toggled on the measurement's page ("Leave this
  out of charts and summaries"). Kept in the list, struck through, with a reason field. Excluded
  measurements are never sent to the AI.

## 7. Newborn details and flags about changes

- **Birth:** the child form gets optional birth weight, length and head circumference, saved as a
  measurement on the date of birth with `place: 'clinic'` and a "Birth" label.
- **Weight change from birth**, for measurements in the first 28 days: "−7% from birth weight",
  and "back to birth weight by day 11" (the first measurement at or above it; no interpolation).
  A loss of more than 10% goes under "worth mentioning" (**cite the source for the 10% threshold
  before building**; it's widely used, for example in breastfeeding guidance).
- **Charts in weeks for the first three months:** while the latest age is under 14 weeks, age charts
  run from birth to 14 weeks with weekly ticks, instead of the current six-month minimum.
- **Flags about changes, not positions** (changes `buildFacts`):
  - Outside the 3rd–97th band: flagged **the first time**, or when it moves outside. After that,
    the facts carry it as `stillOutside` context ("above the 97th percentile, as at the last three
    visits"), which summaries may mention but don't flag.
  - Kept: a move of one z-score or more since the previous measurement; weight down after two weeks.
  - New: weight-for-length moving outside the band; more than 10% below birth weight; the first
    measurement after a doubtful one is compared with the one before it.

## 8. Ask about the numbers

The piece that makes BabyTrails a conversation. **Needs Thomas's approval of the rules below, and a
coordination request to LabTrails**, which has "questions about your history" on its roadmap.

**UI.** On Overview, below "In plain words": **Ask about the numbers**, a text box with three
suggestions that change with the data ("Is this weight gain usual for his age?", "Why is
weight-for-length lower than weight-for-age?", "What does the 99th percentile mean?"). The answer
appears as a thread; follow-ups continue it. Threads are listed per child, saved encrypted, and
can be deleted.

**What is sent** (shown on the send sheet before the first question of a thread, and again if the
measurements changed since): the question; earlier questions and answers in this thread; the facts
object (sex, age today in days, gestational age if recorded, every non-excluded measurement as age
in days with its values, z-scores, percentiles, place, intervals, same-line gains, flags). Never
the name, nickname, date of birth or dates (only ages in days), and never documents.

**Answer format** (structured output):

```ts
type Answer = {
  kind: 'answer' | 'out-of-scope'
  text: string                        // the small Markdown subset, rendered by our own code
  numbers: { text: string; fact: string }[]   // every number about the baby, with the fact it came from
}
```

**Checked by the code before showing anything:**
- every number in `numbers` matches the named fact (same value, same rounding);
- the text contains no other number with a unit (g, kg, cm, %, percentile, z, weeks, months); if
  it does, the answer is withheld and retried once, then shown as "BabyTrails couldn't check this
  answer's numbers";
- the banned phrases from SPEC section 10 aren't there (healthy, normal, fine, at risk, and so on).

**Rules in the prompt:** use only the facts for anything about this baby; general knowledge about
how growth charts work is fine, but no general reference numbers (those come only from the code,
as in 5); no diagnosis, causes, treatment, feeding advice or reassurance; no predictions of future
size; say plainly when the facts can't answer something, and suggest asking the paediatrician;
anything about symptoms or illness ("he has a fever") is `out-of-scope`, answered with a fixed
message to contact the paediatrician or emergency services. Every answer is labelled as AI-written,
with the short disclaimer.

**Cost:** about 3,000 tokens in and 500 out per question with Sonnet 5.5, so about 1–1.5 US cents.

**Demo:** the three suggestions have prepared answers, labelled as prepared in advance (like the
demo summaries); typing another question in the demo explains that answers need a key.

**Shared core proposal:** the thread UI, its storage, the send sheet wiring and the numbers check go
in `src/core/ask/`; the facts object, prompts and suggestions stay in each app.

**Tests:** the numbers check (matching, rounding, extra numbers, retries); nothing sent before the
sheet; the name and date of birth never in a request; out-of-scope handling; a browser test with a
mocked API for a thread with a follow-up; prepared answers in the demo.

## 9. The report card

A designed, shareable page, like the infographic the chat produced, but **drawn by code from saved
data**, so every number and point is exact.

**Content**, top to bottom:
1. Header: the name, nickname or no name (as today), age today, the date, the BabyTrails mark.
2. Latest measurements: weight, length and head, each with its percentile chip and the change since
   the previous measurement.
3. Four small charts: weight-for-age, length-for-age, head-for-age and weight-for-length, with the
   WHO bands and the baby's points (home measurements hollow, excluded ones left out).
4. History: the last eight measurements as a table (age, weight, length, head).
5. Gain over time: the weight bars from 4, with the same-line reference.
6. Highlights: two to four sentences **written by code from templates** ("Gained 150 g a week since
   15 Aug", "Weight-for-length is lower than weight-for-age: heavy for age, less so for length"),
   so the card needs no key. Optionally, the latest AI summary's first paragraph, labelled as
   AI-written.
7. Footer: "Not medical advice. Made with BabyTrails; the records stay on the parent's device."

**Formats:** a phone-shaped image (1080 × 1920, for messaging apps), a square image (1080 × 1080,
latest numbers and one chart only), and an A4 PDF. Always the light theme, in the honey-and-ink
style with Inter. Built as SVG by the same chart code, then exported through the existing PNG and
PDF path (`src/app/screens/Report.tsx`).

**Choices:** the existing privacy choices (name, nickname or none; age instead of date of birth),
plus toggles for head circumference, history and the AI paragraph. The current one-page report
stays as the "Simple" layout.

**Not included:** projections, documents, anything about ultrasound images.

**Tests:** the card's data model equals the app's computed values (a unit test over the demo data);
PNG and PDF exports in a browser test; screenshots of each format in `scripts/screenshots.mjs`.

## 10. Demo and test material

Real booklet pages never go into the repository, screenshots or the demo. Instead, a script
(`scripts/make-booklet.mjs`) draws **look-alike booklet pages** from made-up data:
- the same kind of table (date, age, weight, length, head, BMI, BMI percentile), in English for the
  demo and screenshots and in Portuguese for the tests;
- filled in with a handwriting font (OFL-licensed, used only by the script, not shipped in the app),
  in two "hands" and two inks, with a slight rotation and shadow so it reads as a photo;
- **three versions of the same page with rows added**, so the demo shows a re-photographed page
  importing only its new rows;
- the hard cases: grams and kilograms on the same page, a decimal comma, a weight-change note in
  the length column, a non-growth note across other columns, a two-digit year, a partly covered
  date.

The demo's extraction answers for these pages are prepared in advance, as today. Real documents
are tested privately by Thomas, with his own key, in a local build, and nothing from them is
committed.

## 11. Data model changes

```ts
Measurement  { …existing, place?: 'clinic' | 'home' | 'other', excluded?: boolean,
               excludedReason?: string, birth?: true }
AskThread    { id, childId, createdAt, updatedAt, model,
               turns: { role: 'parent' | 'ai', text, kind?, numbers?, factsDigest, createdAt }[] }
AppSettings  { …existing, lastPlace?: 'clinic' | 'home' | 'other',
               reportCard?: { layout, includeHead, includeHistory, includeAi } }
```

All optional fields, so existing vaults and backups load unchanged; the backup format version stays
the same.

## 12. Out of scope

Projections of any kind, mid-parental or adult height estimates, interpreting ultrasound images,
advice about feeding or illness, and sharing a live link (reports stay files the parent sends).

## 13. Questions for Thomas

1. **Ask about the numbers:** agree that answers may use only code-computed numbers, with no
   general reference figures from the AI (the chat's "105–130 g/week from US hospital sites" would
   be replaced by the same-line and WHO references)?
2. **Report card:** are the phone-shaped image, square image and A4 PDF the right three? Should the
   card be the default share layout?
3. **The 10% weight-loss flag** for newborns: include it (with a cited source)?
4. **Where measured:** ask on every manual entry, or default to the last choice silently?
5. **Shared core:** propose "Ask about the numbers" to LabTrails as a shared module?
