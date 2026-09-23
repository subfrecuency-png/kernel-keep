import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await p.goto('file:///home/claude/kernel-keep/dist/kernel-keep.html');
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/shots/title.png' });
await p.click('#t-new');
await p.waitForTimeout(800);
// select runners and harvest
await p.evaluate(() => { const k = window.__kk; const w = k.cs.game.world; const rs = w.entities.filter(e=>e.owner===1&&e.type==='runner'); k.select(rs.map(r=>r.id)); const well = w.entities.filter(e=>e.kind==='well').sort((a,b)=>((a.x-8)**2+(a.y-53)**2)-((b.x-8)**2+(b.y-53)**2))[0]; k.issue({t:'harvest', ids: rs.slice(0,3).map(r=>r.id), target: well.id}); k.issue({t:'place', building:'compiler', tx: 12, ty: 50, ids:[rs[3].id]}); });
await p.waitForTimeout(3000);
await p.screenshot({ path: '/tmp/shots/game1.png' });
console.log(errs.join('\n') || 'no errors');
await b.close();
