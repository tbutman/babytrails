# Changelog

## Unreleased

Changes from the product review of October 7, 2026 (branch `review-fixes`), not live yet.

- **Safety.** For a baby born before 37 weeks, a note on the overview, the charts and the report card
  says the percentiles use age from birth (corrected age is the next feature), and the second looks
  around birth expect small numbers. The first weeks spell out NICE's two flags and link NICE NG75.
  What the code finds worth mentioning (below the 3rd or above the 97th percentile, about one WHO
  line crossed, weight going down) is a card on the overview and a line on the report card. Second
  looks say what to do if the number is right.
- **The vault.** "Erase this vault", in Settings and under "Forgot your passphrase?" on the Unlock
  form. Changing the passphrase asks for the new one twice. New passphrases need 4 different
  characters, can't repeat one word or use the app's name, and get a weak, OK or strong hint. A
  restore checks the passphrase before anything changes, then shows the Unlock form. Tabs lock
  together and see each other's changes. PBKDF2 where Argon2id can't run.
- **AI.** Summaries send no dates; summaries and answers share one list of words the app withholds;
  answers' numbers are checked with their sign; refusals and offline errors have their own
  messages; photos are always re-encoded, so their location details aren't sent.
- **Fixes.** A weight typed with its unit is read; "Add a child" while locked no longer crashes, and
  any screen that fails shows a calm message; close measurements and same-day entries; the backup
  reminder counts from setup; the installed app opens the app; a title and date at import; lock or
  reload returns to where you were.
- **Report card and charts.** The highlights show the direction; the card shows Girl or Boy, weeks at
  birth and a legend; charts label their lines, can be read as a table, and say why measurements
  after 5 years aren't charted.
- **Words.** US English and US dates ("Sep 19, 2026") in the app, the prompts and the docs; plainer
  labels; "report card" throughout; the WHO wording in About and DATA-NOTICE.

## 0.1.0 (live since October 6, 2026)

The first version, live at babytrails.app. Not tagged yet: Thomas tags it `v0.1.0`.

- A passphrase-protected, encrypted vault in the browser, with auto-lock, persistent-storage
  request, and encrypted backup export and import.
- Children with name, nickname, date of birth, sex and weeks of pregnancy at birth.
- Measurements by hand: weight, length or height, head circumference, in metric or imperial, with
  the percentile shown as you type.
- WHO growth charts from birth to 5 years: weight, length/height, head circumference, weight for
  length/height and BMI, with WHO's LMS method and its adjustment beyond ±3 SD.
- Documents: PDFs and photos stored encrypted and viewed in the app.
- Optional AI with your own Anthropic key: reading measurements from a growth report or booklet
  page (every value checked by you before saving), "what changed" summaries, questions for the next
  check-up, and summaries of doctor's notes.
- A one-page report to share as an image or PDF, with privacy choices.
- A demo with a made-up baby, no passphrase or key needed.
- Installable, and works offline once opened. Light and dark themes.
- When a new version has downloaded, a banner offers to reload into it; it never reloads by itself.
- Adding documents: several at once or in a zip, with files already in the vault set aside, a type
  for each file (ultrasound images and doctor's notes are kept, not read), one agreement to send the
  growth reports, and each one checked in turn. Measurements already saved for the same date aren't
  saved again. Documents not read yet are listed so they can be read later. Each document's title,
  date and type can be edited.
- Trails UI v2, shared with LabTrails: Inter throughout, a refined honey-and-ink palette, a tab bar
  on phones, metric cards with sparklines, and a landing page at babytrails.app with the app at
  /app (old addresses redirect).
- A health booklet page photographed again with new rows is no longer called "a report you already
  added" with an offer to skip it, which would have dropped the new rows. Rows already saved are
  left out as before; the new ones go to review.
- Gain over time: weight gain per week, and length and head gain per month, between every pair of
  measurements, on the overview (a bar for each interval) and in the measurements list. Each gain
  sits next to the gain that would have kept the same WHO percentile over the same days, worked out
  by the code. Summaries can now describe the trend from these numbers.
- A report card to share, now the default: the latest weight, length and head with percentiles and
  the change since the previous measurement, four WHO charts, gain over time, the history and a few
  highlights written by the code, as a phone-sized image (1080 × 1920) or an A4 PDF. Head
  circumference, the history and the latest AI summary (labelled) are optional. The one-page report
  stays as "Simple".
- The first weeks: measurements at birth (offered right after adding a child), weight change from
  birth weight on the measurements list, and an overview card with the lowest point and when birth
  weight was regained. More than 10% lost in the first two weeks, or not back to birth weight by 3
  weeks, is listed as worth mentioning to the paediatrician (NICE NG75).
- Charts for babies under 14 weeks are drawn in weeks.
- Summaries flag a measurement outside the 3rd–97th percentile band when it gets there; while it
  stays there, they mention it as continuing instead of flagging it again at every visit.
- Where each measurement was taken (clinic, home or other; the form remembers the last choice, and
  values read from documents are from the clinic). Home measurements are open circles on the charts.
- Second looks before saving, on the form and on the review screen: a value far off the chart for
  the age, a length or head smaller than last time, or a big change in a short time. Values beyond
  WHO's implausible limits need a second tap.
- Leave a measurement out of charts, gains, summaries and reports without deleting it; it stays in
  the list, marked "Left out", with an optional reason.
- The demo's document is now a photo of a made-up health booklet page in English, with every
  check-up on it and one new visit: reading it shows the saved rows left out and only the new one
  to check. The demo baby's dates are fixed (born 20 March 2026) so the page matches. Look-alike
  pages are drawn by `scripts/make-booklet.mjs`, with Portuguese copies photographed three times for
  the tests.
- The review works out whether a document's dates are day first from all its rows, including the
  ones already saved, so a page with only one new row doesn't ask.
- Ask about the numbers: questions answered from the facts BabyTrails computes, with suggested
  questions that fit the baby's data and saved, encrypted conversations. The AI declares every
  number it uses with the fact it came from; the app checks each one (and that there are no others,
  and no reassurance), retries once, and otherwise withholds the answer. Questions about illness
  get a fixed pointer to the paediatrician. The demo's suggested questions have answers prepared in
  advance.
- Deleting a child now also deletes their summaries and conversations.
- A full name typed in a question becomes one "your baby", not one per word.
- Weight gains compared with WHO's own weight velocity standards when the two measurements match
  one of WHO's 1- or 2-month intervals (within 3 days): "about the 50th percentile of WHO's weight
  gains for 5–6 months", on the overview, the report card and in summaries and answers.
- A refreshed case study and screenshots (landing page, overview and gains, the booklet review, the
  import queue, the report card, Ask about the numbers, and a dark chart on a phone), taken from
  the demo by `scripts/screenshots.mjs`, which now captures close-ups without the app bar over them.
- Accessibility: a "Skip to content" link; after each screen change, focus moves to the new screen's
  heading and the tab's title names it. A browser test runs axe (WCAG 2.1 AA) on every screen in
  both themes at phone and desktop widths, and checks nothing scrolls sideways. The landing page's
  footer no longer skips heading levels.
- A lighter first load: app screens load when first opened, the vault after the first paint, and
  the Inter font is preloaded. The landing page needs 139 kB of compressed JS and CSS instead of 186.
- Pages of one document: photos of a booklet spread or a long report can be grouped in the import,
  in page order, read together in one request, checked once and kept as one document with all its
  pages. In the review, the previous and next page buttons now work for multi-page PDFs too.
