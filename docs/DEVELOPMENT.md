# Development

## How it works

- **Static app.** Vite, React and TypeScript, built to static files. No server code.
- **`src/core/`** is shared with LabTrails and knows nothing about growth: the encrypted vault and
  store, backup, documents and the PDF viewer, the review step, the Anthropic client and its
  components, settings and design tokens. Its interface is in [src/core/README.md](../src/core/README.md).
- **`src/growth/`** is the WHO maths (LMS z-scores, the ±3 SD adjustment, length/height
  adjustment), the tables loader, unit conversions and the chart component.
- **`src/app/`** is BabyTrails itself: the landing page (`/`), the app's screens under `/app`
  (`Layout.tsx` has the app bar and the routes for one child), app types, the summary facts,
  prompts, the demo and the report. `accent.css` holds the honey accent; `app.css` only what the
  kit doesn't cover (the growth chart, the report preview).
- **`src/core/ui/`** is Trails UI v2, the design system shared with LabTrails; see its README.
- **`src/core/import/`** is the shared import (several documents or zips, duplicates, a review
  queue); BabyTrails plugs in with `src/app/import/babyAdapter.ts`.
- **WHO data** isn't committed. `scripts/who-data.mjs` downloads WHO's expanded tables, checks them
  against pinned SHA-256 checksums and writes JSON to `src/growth/data/` (git-ignored). See
  [DATA-NOTICE.md](../DATA-NOTICE.md).
- **pdf.js support files** are copied by `scripts/copy-pdfjs.mjs` into `public/vendor/pdfjs/`
  (git-ignored), so the viewer loads nothing from other origins.

## Build

Node 22 (`.nvmrc`). Write the lockfile with Node 22's npm 10 (`npx npm@10 install`), not a newer
global npm.

```bash
npm ci
npm run dev        # http://localhost:5173 (no CSP in development)
npm run build      # dist/, with the CSP <meta> tag and the service worker
npm run preview    # serve the build
```

`npm run dev`, `build`, `typecheck` and `test` all run `npm run assets` first (WHO tables and pdf.js
files).

### Images

- `node scripts/make-images.mjs` renders the app icons and the Open Graph image with local Chrome.
- `node scripts/screenshots.mjs` takes the demo screenshots in `docs/screenshots/` and the landing
  page's images in `public/landing/` from a running build (`npx vite preview --port 4190`).
- `node scripts/make-sample-pdf.mjs` writes the made-up growth report PDF used by the tests.
- `node scripts/make-booklet.mjs` draws made-up health booklet pages as photos: the demo's English
  page (`public/demo/booklet-page.jpg`, rows in `src/app/demoBooklet.json`) and a Portuguese page
  photographed three times as rows were added (`tests/fixtures/booklet/`, rows in `rows-pt.json`).
  Real booklet pages never go into the repository, screenshots or the demo; these stand in for them,
  with the same hard cases (grams and kilograms, a decimal comma, a note in the wrong column, a
  two-digit year, a covered date). The handwriting fonts are dev dependencies only.

All three are run by hand and their output is committed. Screenshots and fixtures use made-up data
only.

## Tests

```bash
npm test           # unit tests (Vitest)
npm run test:e2e   # browser tests (Playwright) against the production build
```

- **WHO maths:** values from WHO's `anthro` package tests and the 2006 report's examples beyond
  ±3 SD, table edges, the length/height switch at 731 days, percentile formatting.
- **Vault:** create, lock, unlock; a wrong passphrase fails; tampered, moved or truncated data fails
  to decrypt; nothing readable in IndexedDB; changing the passphrase.
- **Backup:** round trips with documents and unknown collections; a wrong passphrase or a damaged
  file changes nothing.
- **Review:** only accepted, valid rows are saved; decimal commas; day/month ambiguity.
- **Import:** zips and their limits, fingerprints, the queue's rules and document kinds; BabyTrails'
  adapter (kinds from file names, the demo's sample, saving, measurements already saved).
- **AI:** the request goes only to Anthropic with the browser header; errors never contain the key;
  structured output is validated; AI text is never rendered as HTML.
- **Browser tests** (every one fails if the app requests any origin other than its own; AI tests
  allow Anthropic and answer with a mock, so nothing real is sent): the CSP is in the build; the
  demo; a full vault flow; extraction sends nothing before the user agrees, sends no name or date of
  birth, and saves only confirmed rows; the import in the demo catches a duplicate, keeps an ultrasound
  image unread and doesn't save measurements twice; summaries send no name, nickname, date of birth or notes;
  report exports; offline reload; and an update: the test serves a copy of the build, changes
  `sw.js` on disk like a deploy, and checks that the banner appears, nothing reloads by itself, and
  Reload switches to the new version.

What the tests can't prove: how real growth reports read (that needs Thomas's own documents, in his
own browser), and behavior on real phones (iPhone Safari, Android Chrome).

## Releases and deploys

Every push to `main` runs CI and publishes a build as a GitHub release (`site-<run>-<sha>`); the
server installs it within a few minutes. See
[deploy/README.md](../deploy/README.md). Version numbers are plain git tags (`v0.1.0`) with a
`CHANGELOG.md` section, not GitHub releases, because the server deploys the newest GitHub release.
