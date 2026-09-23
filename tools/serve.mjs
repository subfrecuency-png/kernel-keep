// Tiny static server for the optional offline-install (PWA) path: `node tools/serve.mjs [port]`,
// then open http://127.0.0.1:<port>/?pwa . Binds to localhost only. The file:// launch stays the default.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname, port = Number(process.argv[2] ?? 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  if (p.includes('..')) { res.writeHead(400).end(); return; }
  try {
    const body = await readFile(join(root, p || 'index.html'));
    res.writeHead(200, { 'content-type': types[extname(p || 'index.html')] ?? 'application/octet-stream', 'cache-control': 'no-cache' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Kernel Keep: http://127.0.0.1:${port}/?pwa  (Ctrl+C to stop)`));
