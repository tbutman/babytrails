# Deploying BabyTrails

BabyTrails is static files. The home server pulls each new build from GitHub and serves it; nothing
on the internet can connect to the server, and no workflow holds credentials for it. The same setup
serves LabTrails, the sister app.

```
push to main ──► GitHub Actions: lint, typecheck, unit and browser tests, build
                 └─► release "site-<run>-<sha>" with site.tar.gz and its SHA-256
server timer, every 2 minutes ──► newest release? ──► verify checksum ──► unpack ──► swap "current"
nginx (trails-web) ──► Cloudflare Tunnel (outbound only) ──► https://babytrails.app
```

**Once this is live, a push to `main` is a production deploy.** Work on branches and merge to
`main` deliberately.

## What runs where

| Piece | File here | Installed as |
| --- | --- | --- |
| Deploy script, shared by the apps | `trails-deploy.sh` | `/usr/local/bin/trails-deploy.sh` |
| Timer and service, per app | `systemd/babytrails-deploy.{service,timer}` | `/etc/systemd/system/` |
| Site config | `nginx/babytrails.conf` | the `trails-web` container's `conf.d` |
| Security headers, included in every location | `nginx/babytrails-headers.conf` | the same `conf.d` |
| Catch-all for unknown host names, once per server | `nginx/00-default.conf` | the same `conf.d` |

- **`trails-static`** is a Compose project with one pinned nginx container, `trails-web`, that serves
  every Trails app, each from its own `server` block and its own folder (`/srv/babytrails/current`).
- Each app has its own **system user** (`babytrails-deploy`) that can write only its own folder,
  and its own timer.
- `trails-deploy.sh` is a copy of tbutman.com's deploy script, so a change there can't break the
  apps. It installs the newest release, keeps the last five, and has `rollback` (switch to the
  previous release and pin it) and `unpin`.
- The server-specific setup script (users, folders, the Compose project, the tunnel network) lives
  in the private infrastructure repository, not here.

## Headers and logs

- The **Content-Security-Policy** allows requests only to the app itself and
  `https://api.anthropic.com`. It's sent by nginx and also built into `index.html`
  (`vite.config.ts`); keep the two in step.
- **HSTS**, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `frame-ancestors 'none'` (and `X-Frame-Options: DENY`), `Cross-Origin-Opener-Policy`,
  `Cross-Origin-Resource-Policy`, and a **Permissions-Policy** that turns off the camera,
  microphone, location, payments, USB and other device features.
- **No access log.** The app has no server-side data, and there are no analytics. nginx errors go
  to the container log, capped at 3 × 10 MB.
- The service worker and manifest are served `no-cache`, so updates reach installed apps; hashed
  build files are cached for a year.

## Cloudflare settings for the domain

Turn **off** anything that injects scripts or rewrites pages: Web Analytics' automatic setup,
Rocket Loader, email address obfuscation, and similar. They would break the CSP and the privacy
promise. "Always Use HTTPS" on (`.app` domains are HTTPS-only in browsers anyway).

## Operations (on the server)

```bash
systemctl list-timers babytrails-deploy.timer
journalctl -u babytrails-deploy.service -n 20 --no-pager
readlink /srv/babytrails/current
sudo systemctl start babytrails-deploy.service          # check for a new release now
sudo -u babytrails-deploy env SITE_REPO=tbutman/babytrails SITE_ROOT=/srv/babytrails trails-deploy.sh rollback
sudo -u babytrails-deploy env SITE_REPO=tbutman/babytrails SITE_ROOT=/srv/babytrails trails-deploy.sh unpin
```

nginx config changes aren't part of a release: copy the changed files into the container's
`conf.d` (and the staged setup folder), then test and reload nginx in the `trails-static` project.

## Tested

- `trails-deploy.sh` in an Ubuntu 24.04 container against this repository's real releases: first
  install, a no-op re-run (HTTP 304), rollback and pin, a timer run while pinned, unpin and redeploy.
- The nginx config in `nginx:1.30.5-alpine` (the pinned image), serving a real release: `nginx -t`
  passes; every path returns the right type with the headers; client-side routes get `index.html`;
  missing assets get 404; `www` redirects to the bare domain with the path kept; unknown host names
  get no response.
