// Optional-PWA smoke test: serves dist/ on localhost, installs the service worker via ?pwa, then reloads
// with the network disabled. Run after `npm run build`:  node e2e/pwa-smoke.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const port = 4199, srv = spawn(process.execPath, ['tools/serve.mjs', String(port)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage();
const errs = []; p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', e => errs.push(String(e)));
let ok = false;
try {
  await p.goto(`http://127.0.0.1:${port}/?pwa`);
  const reg = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { active: !!r.active, manifest: !!document.querySelector('link[rel=manifest]') }; });
  const keys = await p.evaluate(() => caches.keys());
  await p.reload(); await p.waitForTimeout(500);
  await ctx.setOffline(true);
  await p.reload(); await p.waitForSelector('#t-new', { timeout: 5000 });
  ok = reg.active && reg.manifest && keys.length === 1 && errs.length === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  PWA: service worker active=${reg.active}, manifest=${reg.manifest}, cache=${keys.join(',')}, offline reload shows title, console errors=${errs.length}`);
} finally { await b.close(); srv.kill(); }
process.exit(ok ? 0 : 1);
