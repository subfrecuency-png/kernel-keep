// Screenshot helper for visual review: node e2e/peek.mjs [ticks] [out-prefix]
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const ticks = Number(process.argv[2] ?? 3600), pre = process.argv[3] ?? 'e2e/out/peek';
const b = await chromium.launch({ args: ['--use-gl=swiftshader'] }); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e))); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto(pathToFileURL('dist/kernel-keep.html').href);
await p.evaluate(() => window.__kkBoot.newMatch('normal', 4242));
await p.waitForTimeout(400);
await p.screenshot({ path: `${pre}-start.png` });
await p.evaluate(t => { const k = window.__kk; k.autopilot(); k.step(t); const w = k.cs.game.world; const c = w.coreOf(1); k.jump(c.x + 3, c.y - 3); }, ticks);
await p.waitForTimeout(500);
await p.screenshot({ path: `${pre}-base.png` });
await p.evaluate(() => { const k = window.__kk; const w = k.cs.game.world; const r = w.entities.find(e => e.owner === 1 && e.type === 'runner' && !e.dead); k.select([r.id]); k.jump(r.x, r.y); });
await p.waitForTimeout(400); await p.screenshot({ path: `${pre}-runner.png` });
await p.evaluate(() => { const k = window.__kk; const w = k.cs.game.world; const g = w.entities.find(e => e.owner === 1 && e.type === 'grid' && !e.dead) ?? w.coreOf(1); k.select([g.id]); k.jump(g.x, g.y); });
await p.waitForTimeout(400); await p.screenshot({ path: `${pre}-grid.png` });
const fight = await p.evaluate(() => { const k = window.__kk; const w = k.cs.game.world;
  for (let i = 0; i < 12; i++) { w.spawnUnit(['bulwark', 'lancer', 'breaker', 'patcher', 'ping', 'runner'][i % 6], 1, 30 + (i % 4), 34 + Math.floor(i / 4)); w.spawnUnit(['bulwark', 'lancer', 'breaker', 'patcher', 'ping', 'runner'][i % 6], 2, 36 + (i % 4), 28 + Math.floor(i / 4)); }
  k.step(12); k.jump(33, 31); return w.tick; });
await p.waitForTimeout(300);
await p.screenshot({ path: `${pre}-battle.png` });
console.log('tick', fight, 'errors', errs);
await b.close();
