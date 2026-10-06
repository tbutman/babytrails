# Changelog

## Unreleased

The first version, not yet tagged. Version 1.0.0 is Thomas's call, after it's live and he has used it
with real records.

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
