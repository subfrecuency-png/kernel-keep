// Browser end-to-end test: drives the built single-file game through real mouse/keyboard input
// in headless Chromium (Playwright). Screenshots show appearance only; the assertions are the evidence.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Game, stateHash } from '../src/sim/game.ts';
const OUT = 'e2e/out'; mkdirSync(OUT, { recursive: true });
const results = []; let failed = 0;
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); if (!ok) failed++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const remote = []; page.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:') && !u.startsWith('blob:')) remote.push(u); });
const settle = () => page.waitForTimeout(160);
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto('file://' + process.cwd() + '/dist/kernel-keep.html');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-title.png` });
check('title screen renders with New match button', await page.isVisible('#t-new'));

await page.click('#t-new');
await page.waitForTimeout(500);
check('HUD visible after New match', await page.isVisible('#topbar'));
// ---- React integration: exactly one simulation driver under StrictMode, advancing at the fixed 10 Hz ----
{
  const a = await ev(() => ({ tick: window.__kk.cs.game.world.tick, loops: window.__kk.engine.loopCount }));
  await page.waitForTimeout(2000);
  const b2 = await ev(() => window.__kk.cs.game.world.tick);
  const rate = (b2 - a.tick) / 2;
  check('React StrictMode mounts ONE simulation loop that runs at ~10 ticks/s', a.loops === 1 && rate > 7 && rate < 12.5, `loops ${a.loops}, ${rate.toFixed(1)} ticks/s`);
}
await ev(() => { window.__kk.cs.paused = true; });

// ---- drag-select the four runners with the mouse ----
const rs = await ev(() => { const k = window.__kk; return k.cs.game.world.entities.filter(e => e.owner === 1 && e.type === 'runner').map(e => ({ id: e.id, ...k.worldToScreen(e.x, e.y) })); });
const xs = rs.map(r => r.x), ys = rs.map(r => r.y);
await page.mouse.move(Math.min(...xs) - 25, Math.min(...ys) - 25);
await page.mouse.down();
await page.mouse.move(Math.max(...xs) + 25, Math.max(...ys) + 25, { steps: 5 });
await page.mouse.up();
const selN = await ev(() => window.__kk.cs.sel.size);
check('drag box selects the 4 starting Runners', selN === 4, `selected ${selN}`);

// ---- right-click a well: smart order = harvest ----
const well = await ev(() => { const k = window.__kk; const w = k.cs.game.world; const c = w.coreOf(1); const wl = w.entities.filter(e => e.kind === 'well').sort((a, b) => ((a.x - c.x) ** 2 + (a.y - c.y) ** 2) - ((b.x - c.x) ** 2 + (b.y - c.y) ** 2))[0]; return { id: wl.id, ...k.worldToScreen(wl.x, wl.y) }; });
await page.mouse.click(well.x, well.y, { button: 'right' });
const harvesting = await ev(() => window.__kk.cs.game.world.entities.filter(e => e.owner === 1 && e.order?.type === 'harvest').length);
check('right-click on a well orders harvest', harvesting === 4, `${harvesting} harvesting`);

// ---- select one runner, press C, click to place a Compiler ----
const r0 = rs[0];
await page.mouse.click(r0.x, r0.y);
await page.keyboard.press('c');
const placing = await ev(() => window.__kk.cs.placing?.type);
check('C key enters Compiler placement with a Runner selected', placing === 'compiler', String(placing));
const spot = await ev(() => window.__kk.worldToScreen(13.2, 50.2));
await page.mouse.move(spot.x, spot.y); await page.waitForTimeout(80);
await page.screenshot({ path: `${OUT}/02-placement-ghost.png` });
await page.mouse.click(spot.x, spot.y);
const sites = await ev(() => window.__kk.cs.game.world.entities.filter(e => e.owner === 1 && e.type === 'compiler').length);
check('left-click places the Compiler site', sites === 1);
const invalid = await ev(() => { const k = window.__kk; k.startPlacing('bank'); const r = k.cs.game.issue({ t: 'place', building: 'bank', tx: 8, ty: 53, ids: [], player: 1 }); k.cs.placing = undefined; return r; });
check('placement on the Core is rejected with a reason', !invalid.ok && /occupied/.test(invalid.reason), invalid.reason);

// ---- insufficient resources feedback via UI ----
await ev(() => { window.__kk.cs.game.world.players[1].data = 5; window.__kk.cs.game.world.players[1].explored.fill(1); });
await page.mouse.click(r0.x, r0.y); await page.keyboard.press('t');
await ev(() => { const k = window.__kk; const p = k.worldToScreen(15, 46); return p; }).then(async p => { await page.mouse.move(p.x, p.y); await page.mouse.click(p.x, p.y); });
await settle(); const toast = await page.textContent('#toast');
check('insufficient Data shows a readable toast', /Need .*Data/.test(toast), toast);
await page.keyboard.press('Escape');
await ev(() => { window.__kk.cs.game.world.players[1].data = 150; });

// ---- fast-forward the simulation and verify the economy moved ----
await ev(() => window.__kk.step(1500));
const eco = await ev(() => { const w = window.__kk.cs.game.world; const c = w.entities.find(e => e.type === 'compiler' && e.owner === 1); return { built: c.built, staffed: w.operatorPresent(c), code: w.players[1].stats.codeProduced, data: w.players[1].stats.dataHarvested }; });
check('Compiler built and auto-staffed; Code produced; Data harvested', eco.built && eco.staffed && eco.code > 0 && eco.data > 0, JSON.stringify(eco));

// ---- Core: Q trains, clicking the queue item cancels with refund ----
const core = await ev(() => { const k = window.__kk; const c = k.cs.game.world.coreOf(1); return { id: c.id, ...k.worldToScreen(c.x, c.y) }; });
await ev(id => window.__kk.select([id]), core.id);
const before = await ev(() => ({ ...window.__kk.cs.game.world.players[1] }));
await settle();
await page.keyboard.press('q');
await page.waitForTimeout(250);
const q1 = await ev(id => window.__kk.cs.game.world.get(id).queue.length, core.id);
check('Q queues a Runner at the Core', q1 === 1);
await page.waitForTimeout(250);
await page.click('.qi'); await settle();
const after = await ev(() => ({ ...window.__kk.cs.game.world.players[1] }));
const q2 = await ev(id => window.__kk.cs.game.world.get(id).queue.length, core.id);
check('clicking the queue item cancels it with a full refund', q2 === 0 && Math.abs(after.code - before.code) < 0.5 && Math.abs(after.data - before.data) < 0.5, `code ${before.code.toFixed(1)}→${after.code.toFixed(1)}`);

// ---- pause stops the simulation; unpause resumes ----
await ev(() => { window.__kk.cs.paused = false; });
await page.mouse.move(700, 400);
await page.keyboard.press('p');
const t1 = await ev(() => window.__kk.cs.game.world.tick); await page.waitForTimeout(700);
const t2 = await ev(() => window.__kk.cs.game.world.tick);
check('P pauses the simulation', t1 === t2, `${t1}→${t2}`);
await page.keyboard.press('p'); await page.waitForTimeout(700);
const t3 = await ev(() => window.__kk.cs.game.world.tick);
check('P again resumes it', t3 > t2, `${t2}→${t3}`);

// ---- mid-game via autopilot (the player's side is driven by the same rule AI) ----
await ev(() => { window.__kk.autopilot(); window.__kk.step(4200); });
await ev(() => { const k = window.__kk; const c = k.cs.game.world.coreOf(1); k.jump(c.x + 4, c.y - 4); k.cs.sel.clear(); });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/03-midgame-base.png` });

// ---- save → quick load restores an identical state ----
await page.keyboard.press('Escape');
check('Esc opens the pause menu', await page.isVisible('#p-save'));
await page.click('#p-save');
const h1 = await ev(() => window.__kk.hash());
await ev(() => window.__kk.step(50));
await page.click('#p-load'); await settle();
const h2 = await ev(() => window.__kk.hash());
check('Quick save + Quick load restores the exact state (hash)', h1 === h2, `${h1} vs ${h2}`);

// ---- settings: UI scale, reduced flashing, key rebinding ----
await page.keyboard.press('Escape'); await page.click('#p-set');
await page.fill('#s-scale', '1.3'); await page.dispatchEvent('#s-scale', 'input');
const scale = await ev(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim());
check('UI scale setting applies', scale === '1.3', scale);
await page.check('#s-flash');
await page.click('#s-keys'); await settle();
await page.click('table.keys button[data-a="stop"]');
await page.keyboard.press('x'); await settle();
const bound = await ev(() => window.__kk.cs.settings.keys.stop);
check('key rebinding works (Stop → X)', bound === 'x', bound);
await page.click('#k-back'); await page.click('#s-reset'); await page.click('#s-back');
await page.click('#p-resume');

// ---- Stability/recovery panel is driven by real engine state and its buttons issue real commands ----
{
  await ev(() => { const k = window.__kk; const w = k.cs.game.world; k.cs.game.ais = k.cs.game.ais.filter(a => a.s.pid !== 1); w.players[1].code = 0; w.players[1].ration = 'standard';
    for (const b of w.entities.filter(e => e.owner === 1 && e.type === 'compiler' && e.active)) k.issue({ t: 'toggleActive', building: b.id });
    const c = w.coreOf(1); for (let i = 0; i < 25; i++) w.spawnUnit('runner', 1, c.x + 4 + (i % 5) * 0.6, c.y - 4 - Math.floor(i / 5) * 0.6); k.step(40); });
  await settle();
  const issue = await ev(() => [...document.querySelectorAll('#recovery [data-issue]')].map(e => e.dataset.issue));
  const eng = await ev(() => { const w = window.__kk.cs.game.world; return { code: +w.players[1].code.toFixed(1), unmet: +w.players[1].unmet.toFixed(2) }; });
  check('recovery panel reports the real Code shortage (starving or low reserve)', issue.includes('starving') || issue.includes('codeLow'), `${issue.join(',')} · engine code ${eng.code}, unmet ${eng.unmet}`);
  await page.click('#recovery [data-action="ration-lean"]'); await settle();
  const ration = await ev(() => window.__kk.cs.game.world.players[1].ration);
  check('recovery button "Switch to Lean rations" issues the real ration command', ration === 'lean', ration);
  await ev(() => { const k = window.__kk; const w = k.cs.game.world; w.players[1].code = 200; w.players[1].surgeUntil = w.tick + 5000;
    for (let i = 0; i < 2; i++) { const b = w.spawnBuilding('tower', 1, 3 + i * 3, 44, true); } k.step(1); });
  await settle();
  const brown = await page.textContent('#recovery [data-issue="brownout"]').catch(() => null);
  const demand = await ev(() => ({ d: window.__kk.cs.game.world.computeDemand(1), s: window.__kk.cs.game.world.caps(1).compute }));
  check('brownout issue shows the engine demand/supply', !!brown && brown.includes(`${demand.d}/${demand.s}`), `${brown?.slice(0, 40)} · engine ${demand.d}/${demand.s}`);
  await ev(() => { const k = window.__kk; const w = k.cs.game.world; w.players[1].surgeUntil = 0; const r = w.entities.filter(e => e.owner === 1 && e.type === 'runner').slice(0, 3).map(e => e.id); k.issue({ t: 'suspend', ids: r, on: true }); k.step(1); });
  await settle();
  check('suspended programs appear in the recovery panel', await page.isVisible('#recovery [data-issue="suspended"]'));
  await page.click('#recovery [data-action="resume-all"]'); await settle();
  const still = await ev(() => window.__kk.cs.game.world.entities.filter(e => e.owner === 1 && e.suspended).length);
  check('"Resume all" resumes them through the command path', still === 0, `${still} still suspended`);
}
// ---- art from the master kit: selection portrait + codex ----
{
  const rid = await ev(() => window.__kk.cs.game.world.entities.find(e => e.owner === 1 && e.type === 'runner').id);
  await ev(id => window.__kk.select([id]), rid); await settle();
  const portrait = await page.evaluate(() => { const i = document.querySelector('#sel img.portrait'); return i ? i.naturalWidth : 0; });
  check('selection panel shows the Runner portrait (decoded image)', portrait > 100, `naturalWidth ${portrait}`);
  await page.keyboard.press('Escape'); await page.click('#p-codex'); await settle();
  const imgs = await page.evaluate(() => [...document.querySelectorAll('#modalCard img')].map(i => i.naturalWidth));
  check('art codex shows 16 portraits + 2 concept sheets, all decoded', imgs.length === 18 && imgs.every(w => w > 100), `${imgs.length} images`);
  await page.click('#c-back'); await settle(); await page.click('#p-resume'); await settle();
}

// ---- battle + performance sample ----
await ev(() => {
  const k = window.__kk; const w = k.cs.game.world; const types = ['bulwark', 'lancer', 'lancer', 'patcher', 'breaker', 'ping'];
  for (let i = 0; i < 50; i++) { const t = types[i % 6]; w.spawnUnit(t, 1, 22 + (i % 10) * 0.8, 44 + Math.floor(i / 10) * 0.8); w.spawnUnit(t, 2, 34 + (i % 10) * 0.8, 30 - Math.floor(i / 10) * 0.8); }
  for (const e of w.entities) if (e.kind === 'unit' && e.type !== 'runner' && !e.forkOf) { e.order = { type: 'attackMove', x: e.owner === 1 ? 36 : 22, y: e.owner === 1 ? 30 : 44 }; e.path = undefined; }
  for (const p of w.players) p.explored.fill(1);
  k.jump(29, 38); k.cs.cam.z = 26; k.cs.showPerf = true;
});
await page.waitForTimeout(3500);
await page.screenshot({ path: `${OUT}/04-battle.png` });
const perf = await ev(() => ({ fps: window.__kk.cs.fps, avgStep: window.__kk.cs.game.perf.avgStepMs, units: window.__kk.cs.game.world.entities.filter(e => e.kind === 'unit').length }));
check('battle with 100+ spawned combat units renders (container, software GPU)', perf.fps > 5, JSON.stringify(perf));

// ---- victory ----
await ev(() => { const w = window.__kk.cs.game.world; w.kill(w.coreOf(2)); });
await page.waitForTimeout(500);
const vic = await page.textContent('#modalCard');
check('destroying the Rival Core shows VICTORY', /VICTORY/.test(vic));
await page.screenshot({ path: `${OUT}/05-victory.png` });
await page.click('#g-again'); await page.waitForTimeout(300);
const fresh = await ev(() => ({ tick: window.__kk.cs.game.world.tick, over: window.__kk.cs.over }));
check('Play again restarts a fresh match', fresh.tick < 30 && !fresh.over, JSON.stringify(fresh));

// ---- defeat ----
await ev(() => { const w = window.__kk.cs.game.world; w.kill(w.coreOf(1)); });
await page.waitForTimeout(500);
check('losing your Core shows DEFEAT', /DEFEAT/.test(await page.textContent('#modalCard')));

// ---- cross-runtime determinism: Node (tsx) vs the bundled build in Chromium ----
{
  const seed = 777, N = 3000;
  const g = new Game({ seed, difficulty: 'normal', players: [{ name: 'You', ai: false }, { name: 'Rival Kernel', ai: true }] });
  g.run(N);
  const nodeHash = stateHash(g.world);
  const browserHash = await ev(({ seed, N }) => { window.__kkBoot.newMatch('normal', seed); const k = window.__kk; k.cs.paused = true; k.step(N); return k.hash(); }, { seed, N });
  check('same seed, 3000 ticks: Node build and browser bundle produce the same state hash', nodeHash === browserHash, `${nodeHash} vs ${browserHash}`);
}

check('no page errors or console errors', errors.length === 0, errors.join(' | '));
check('fully offline: no network requests (file: and data: only)', remote.length === 0, remote.slice(0, 3).join(' '));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ date: new Date().toISOString(), results, perf, errors }, null, 1));
await browser.close();
console.log(`\n${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
