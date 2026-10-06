// A tiny static server over a copy of the build, so a test can change files on disk the way a
// deploy does (for example a new sw.js), which request interception can't do for service workers.

import { cpSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { extname, join, normalize } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf',
}

export async function serveCopyOfBuild(): Promise<{ root: string; url: string; close: () => Promise<void> }> {
  const root = mkdtempSync(join(tmpdir(), 'babytrails-build-'))
  cpSync('dist', root, { recursive: true })
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(root, path)
    try {
      if (!statSync(file).isFile()) throw new Error()
    } catch {
      file = join(root, 'index.html') // client-side routes
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(readFileSync(file))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as { port: number }).port
  return {
    root,
    url: `http://localhost:${port}`,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections()
        server.close(() => {
          rmSync(root, { recursive: true, force: true })
          resolve()
        })
      }),
  }
}
