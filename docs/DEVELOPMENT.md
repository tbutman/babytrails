# Development

## How it works

- **Static app.** Vite, React and TypeScript, built to static files. No server code.
- **`src/core/`** is shared with LabTrails and knows nothing about growth: the encrypted vault and
  store, backup, documents and the PDF viewer, the review step, the Anthropic client and its
  components, settings and design tokens. Its interface is in [src/core/README.md](../src/core/README.md).
- **`src/growth/`** is the WHO maths (LMS z-scores, the ±3 SD adjustment, length/height
  adjustment), the tables loader, unit conversions and the chart component.
- **`src/app/`** is BabyTrails itself: screens, app types, the summary facts, prompts, the demo and
  the report.
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
- `node scripts/screenshots.mjs` takes the demo screenshots in `docs/screenshots/` from a running
  build (`npx vite preview --port 4190`).
- `node scripts/make-sample-pdf.mjs` writes the made-up growth report used by the demo and tests.

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
- **AI:** the request goes only to Anthropic with the browser header; errors never contain the key;
  structured output is validated; AI text is never rendered as HTML.
- **Browser tests** (every one fails if the app requests any origin other than its own; AI tests
  allow Anthropic and answer with a mock, so nothing real is sent): the CSP is in the build; the
  demo; a full vault flow; extraction sends nothing before the user agrees, sends no name or date of
  birth, and saves only confirmed rows; summaries send no name, nickname, date of birth or notes;
  report exports; offline reload.

What the tests can't prove: how real growth reports read (that needs Thomas's own documents, in his
own browser), and behaviour on real phones (iPhone Safari, Android Chrome).

## Releases and deploys

Every push to `main` runs CI and publishes a build as a GitHub release (`site-<run>-<sha>`); the
server installs it within a few minutes once hosting is live. See
[deploy/README.md](../deploy/README.md). Version numbers are plain git tags (`v1.0.0`) with a
`CHANGELOG.md` section, not GitHub releases, because the server deploys the newest GitHub release.
