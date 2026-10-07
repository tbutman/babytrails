# BabyTrails threat model

Last updated 6 October 2026, before the first version is built. It describes the design in
[SPEC.md](SPEC.md); when the code and this file disagree, that's a bug in one of them.

This is written for anyone who wants to know how safe their baby's records are, and for reviewers
who want to check. Plain answers first, details after.

## In short

- **Your records live only in your browser, encrypted with your passphrase.** BabyTrails' server
  only sends the app's files; it never receives your records.
- **Nobody can reset your passphrase**, including us. If you forget it and have no backup, the
  records are gone.
- **AI features are optional.** When you use one, the document or numbers you approve are sent from
  your browser straight to Anthropic, using your own API key. Anthropic sees what you send.
- **A web app can't protect you from a compromised device**, a malicious browser extension, or a
  malicious version of the app itself. Those limits are explained below.

## What we protect

| Asset | Where it lives |
| --- | --- |
| Profiles, measurements, visits, summaries | Encrypted records in the browser's IndexedDB |
| Documents and photos (growth reports, doctor's notes, ultrasound images) | Encrypted blobs in IndexedDB |
| The user's Anthropic API key | Inside the encrypted vault |
| The passphrase | Only in the user's head; never stored |
| The data key | Stored only wrapped (encrypted) by a key derived from the passphrase; in memory as a non-extractable key while unlocked |

## How the protection works

- **Encryption at rest.** Each record and blob is encrypted with AES-256-GCM under a random data
  key. The data key is wrapped by a key derived from the passphrase with Argon2id (19 MiB memory,
  2 passes, OWASP's recommended setting), or PBKDF2-SHA256 with 600,000 iterations if Argon2id
  can't run. Each record's encryption is bound to its collection and ID, so records can't be swapped.
- **Locking.** The vault locks after 5 minutes of inactivity by default, and when the page has been
  hidden that long. Locking drops the keys from memory.
- **No server data.** There are no accounts, no database, no analytics, no cookies and no
  third-party scripts. The web server keeps no access log.
- **A strict Content-Security-Policy.** The page may only load its own files and talk to itself and
  `https://api.anthropic.com`. A test fails the build if the app requests anything else.
- **AI output is untrusted.** It's shown as plain text or a small Markdown subset rendered by our
  own code, never as HTML. The AI has no tools that act. Extracted values are checked against a
  schema and must be confirmed one by one by the user before they're saved.
- **Less data in AI requests.** The child's name is replaced with a placeholder and dates are left
  out; ages are sent in days. Together with the time of the request, an age in days still reveals
  the date of birth to the provider. Before each request the app shows what will be sent and to
  whom.

## Threats, mitigations and limits

### Someone gets the device while the vault is locked

- **Mitigation:** everything is encrypted, and the passphrase has to go through a deliberately
  slow key derivation before each guess. Setup requires at least 12 characters and suggests four
  or more random words.
- **Limit:** anyone can copy the browser's database and guess offline, with no lockout. A short or
  common passphrase can be guessed. What isn't hidden: how many records and blobs there are, their
  approximate sizes, and the names of the collections.

### Someone gets the device while the vault is unlocked

- **Mitigation:** auto-lock.
- **Limit:** until it locks, they can see everything the user can.

### Malware on the device, or a malicious browser extension

- **Limit:** no web app can defend against software that can read the screen, the keyboard or the
  page. This is out of scope, and we say so.

### A lost passphrase

- **Mitigation:** a clear warning at setup, and encrypted backups.
- **Limit:** by design there's no recovery. A backup needs the same passphrase.

### The browser deletes the data

Browsers can clear a site's storage: Safari deletes it after 7 days of use without visiting the
site, unless the app was added to the Home Screen; any browser can clear it under storage pressure
or when the user clears site data.
- **Mitigation:** the app asks for persistent storage, prompts iPhone users to add it to the Home
  Screen, and reminds users to back up after new documents, after new measurements, and when the
  last backup is two weeks old.
- **Limit:** only a backup kept somewhere else fully protects against this.

### The AI provider sees what's sent

- **Mitigation:** nothing is sent without the user's go-ahead on a sheet that lists what's sent;
  text prompts use a placeholder instead of the name, leave dates out and send ages in days; the
  app recommends a dedicated API key with a spending limit.
- **Limit:** Anthropic receives the documents and numbers the user approves, under the user's own
  account and Anthropic's terms. As of 6 October 2026, Anthropic's
  [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) say it may not train models on
  API content, and its
  [Privacy Center](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data)
  says API inputs and outputs are deleted within 30 days, or kept up to 2 years if flagged by its
  safety systems. Uploaded documents may contain the child's name; the app can't redact them.

### Instructions hidden in an uploaded document (prompt injection)

- **Mitigation:** the AI has no tools and can't change data; extracted values are validated
  against a schema and each one is confirmed by the user; output is never rendered as HTML.
- **Limit:** a crafted document could still make a summary misleading. Summaries are labelled as AI
  output with a short disclaimer.

### Cross-site scripting

- **Mitigation:** React escapes text by default; no `innerHTML`; the strict CSP blocks inline and
  third-party scripts; tests check that AI output with HTML in it is shown as text.
- **Limit:** Trusted Types aren't enabled yet (pdf.js's worker and the service worker need a policy
  written for them); planned as extra hardening.

### The API key in the browser

Calling Anthropic from a browser needs the header `anthropic-dangerous-direct-browser-access`.
Anthropic's SDK warns that browser use risks exposing API credentials. That warning is about apps
that ship their own key to every visitor. Here each user brings their own key, which is stored
encrypted in their own vault and sent only to Anthropic.
- **Limit:** while the vault is unlocked, anything that can run code in the page (see the next
  section) could read the key. A dedicated key with a spending limit caps the damage.
- Organisations with zero data retention can't use browser calls; Anthropic doesn't support CORS
  for them.

### A malicious version of the app

The app's code comes from GitHub (source and builds), npm (dependencies), the home server, and
Cloudflare (which carries the traffic). If any of them were compromised, they could serve code that
reads the records after the user unlocks them.
- **Mitigation:** the code is public; every build is made by GitHub Actions from a public commit,
  with a checksum the server verifies; dependencies are few and locked; the CSP is set by the
  server's configuration, not by the build, so a bad build can't widen it; Cloudflare features that
  inject scripts are turned off.
- **Limit:** this is the biggest limit of any web app. The CSP doesn't stop determined malicious
  code: even the one allowed AI endpoint could carry data out under an attacker's own API key. The
  CSP limits mistakes and injected content, not a compromised deployment.

### The network

- **Mitigation:** HTTPS only (`.app` domains are HTTPS-only in browsers), HSTS, and no health data
  ever goes to BabyTrails' server. `Referrer-Policy: no-referrer`.
- **Limit:** Cloudflare terminates TLS for the app's files, as it does for most websites. It sees
  which pages are requested, not the records.

### The home server

- **Mitigation:** it serves static files only, through an outbound-only Cloudflare Tunnel; nothing
  on the internet can connect to it directly; it pulls builds published by GitHub Actions and
  checks their checksums rather than accepting pushes, and no workflow holds server credentials.
- **Limit:** whoever controls the server controls the code it serves (see "A malicious version of
  the app").

## Not in scope

- Sharing live records between devices or caregivers (there's no sync; backups can be imported).
- Medical accuracy of AI summaries. The app doesn't give medical advice; the numbers come from WHO's
  method, computed by the app, and summaries only explain them.
- Physical or legal coercion.

## Reporting a problem

See [SECURITY.md](SECURITY.md).
