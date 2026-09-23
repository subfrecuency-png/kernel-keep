import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/sim/types.ts';
import { humanGame, cmd, units, buildingsOf, core, nearestWell, instantBuilding, secs, totalDataInWorld } from './helpers.ts';

test('bootstrap: starting core + 4 runners can harvest, build a compiler and produce code without prior production', () => {
  const g = humanGame(11); const w = g.world;
  const rs = units(w, 1, 'runner');
  assert.equal(rs.length, B.start.runners);
  const c = core(w, 1);
  const well = nearestWell(w, c.x, c.y);
  assert.ok(cmd(g, { t: 'harvest', ids: rs.slice(0, 3).map(r => r.id), target: well.id }).ok);
  const r = cmd(g, { t: 'place', building: 'compiler', tx: 12, ty: 50, ids: [rs[3].id] });
  assert.ok(r.ok, r.reason);
  secs(g, 150);
  const comp = buildingsOf(w, 1, 'compiler')[0];
  assert.ok(comp.built, 'compiler finished');
  assert.ok(w.operatorPresent(comp), 'compiler staffed automatically');
  assert.ok(w.players[1].stats.codeProduced > 0, 'code produced');
  assert.ok(w.players[1].stats.dataHarvested > 0, 'data harvested');
});

test('idle start never enters a crash spiral: core trickle keeps a small population above the crash line', () => {
  const g = humanGame(12); const w = g.world;
  secs(g, 20 * 60);
  const p = w.players[1];
  assert.equal(p.code, p.code); // not NaN
  assert.ok(p.stability > B.economy.crashThreshold, `stability ${p.stability}`);
  assert.equal(p.stats.crashes, 0);
  assert.ok(p.alerts.some(a => a.kind === 'starving' || a.kind === 'lowcode'), 'warned about code');
});

test('starvation is staged: warning, stability decline, crashes that auto-suspend, then recovery with Lean + resume', () => {
  const g = humanGame(13); const w = g.world;
  const c = core(w, 1);
  for (let i = 0; i < 16; i++) w.spawnUnit('runner', 1, c.x + 3 + (i % 4) * 0.7, c.y - 3 - Math.floor(i / 4) * 0.7);
  w.players[1].code = 5;
  secs(g, 12);
  assert.ok(w.players[1].alerts.some(a => a.kind === 'starving'), 'starving alert raised');
  const stab0 = w.players[1].stability;
  secs(g, 30);
  assert.ok(w.players[1].stability < stab0, 'stability falls while starving');
  secs(g, 60);
  const crashed = units(w, 1).filter(u => u.suspended && u.crashed);
  assert.ok(crashed.length > 0, 'some programs crashed');
  assert.ok(w.players[1].stats.crashes === crashed.length);
  // recovery: lean rations + suspend the idle surplus; code income (trickle) must now cover demand
  assert.ok(cmd(g, { t: 'ration', level: 'lean' }).ok);
  const idle = units(w, 1, 'runner').filter(u => !u.suspended).slice(2);
  cmd(g, { t: 'suspend', ids: idle.map(u => u.id), on: true });
  w.players[1].code = 40; // e.g. a compiler came online
  secs(g, 60);
  assert.ok(w.players[1].stability > B.economy.crashThreshold, `recovered stability ${w.players[1].stability}`);
  const before = w.players[1].stats.crashes;
  secs(g, 30);
  assert.equal(w.players[1].stats.crashes, before, 'no further crashes after recovery');
  // resume clears the crashed flag
  assert.ok(cmd(g, { t: 'suspend', ids: crashed.map(u => u.id), on: false }).ok);
  assert.ok(crashed.every(u => !u.suspended && !u.crashed));
});

test('data conservation: wells + carried + stock is constant while only harvesting (no duplicate rewards)', () => {
  const g = humanGame(14); const w = g.world;
  const c = core(w, 1);
  const well = nearestWell(w, c.x, c.y);
  const rs = units(w, 1, 'runner');
  cmd(g, { t: 'harvest', ids: rs.map(r => r.id), target: well.id });
  const t0 = totalDataInWorld(w, 1);
  const sum0 = t0.wells + t0.carried + t0.stock;
  let deposits = 0;
  for (let i = 0; i < 1200; i++) { g.step(); deposits += w.events.filter(e => e.t === 'deposit' && e.owner === 1).length; }
  const t1 = totalDataInWorld(w, 1);
  assert.ok(Math.abs(t1.wells + t1.carried + t1.stock - sum0) < 1e-9, 'data conserved');
  assert.ok(deposits >= 8, `runners completed trips (${deposits})`);
  assert.equal(w.players[1].stats.dataHarvested, deposits * B.economy.carry, 'each trip deposits exactly one load');
});

test('storage caps: data stock never exceeds cap; hash vault caps at 600', () => {
  const g = humanGame(15); const w = g.world;
  w.players[1].data = 10_000; w.players[1].hash = 10_000;
  g.step();
  assert.equal(w.players[1].data, w.caps(1).dataCap);
  assert.equal(w.players[1].hash, B.economy.hashCap);
});

test('mining: diminishing returns per rig and compute brownout throttles yield', () => {
  const g = humanGame(16); const w = g.world;
  const rs = units(w, 1, 'runner');
  const rigs = [instantBuilding(w, 'rig', 1, 12, 48), instantBuilding(w, 'rig', 1, 15, 48)];
  rigs.forEach((r, i) => cmd(g, { t: 'operate', ids: [rs[i].id], target: r.id }));
  secs(g, 10); // walk
  const eff = w.computeEff(1);
  assert.equal(w.computeDemand(1), 8);
  assert.equal(eff, 1, 'core supplies 10 compute');
  let h0 = w.players[1].hash; secs(g, 10);
  const two = (w.players[1].hash - h0) / 10;
  const ws = w.workSpeed(1);
  assert.ok(Math.abs(two - (1 + B.economy.miningFalloff) * ws) < 0.05, `two rigs ≈ 1.85×ws, got ${two}`);
  // third rig -> 12 demand > 10 supply
  const r3 = instantBuilding(w, 'rig', 1, 18, 48); cmd(g, { t: 'operate', ids: [rs[2].id], target: r3.id });
  secs(g, 10);
  assert.ok(w.computeEff(1) < 1, 'brownout');
  h0 = w.players[1].hash; secs(g, 10);
  const three = (w.players[1].hash - h0) / 10;
  const ideal = (1 + 0.85 + 0.85 * 0.85) * w.workSpeed(1);
  assert.ok(three < ideal * 0.9, `brownout reduces yield (${three} < ${ideal})`);
  // switching one rig off restores full efficiency
  cmd(g, { t: 'toggleActive', building: r3.id }); g.step();
  assert.equal(w.computeEff(1), 1);
});

test('insufficient resources and invalid placement give readable reasons and change nothing', () => {
  const g = humanGame(17); const w = g.world;
  const rs = units(w, 1, 'runner');
  w.players[1].data = 10;
  let r = cmd(g, { t: 'place', building: 'grid', tx: 12, ty: 49, ids: [rs[0].id] });
  assert.equal(r.ok, false); assert.match(r.reason!, /Need .*Data/);
  assert.equal(w.players[1].data, 10);
  w.players[1].data = 500;
  r = cmd(g, { t: 'place', building: 'compiler', tx: 8, ty: 53, ids: [] }); assert.match(r.reason!, /occupied/);
  r = cmd(g, { t: 'place', building: 'compiler', tx: 40, ty: 10, ids: [] }); assert.match(r.reason!, /unexplored/);
  // a void tile inside explored territory
  w.players[1].explored.fill(1);
  let voidTile = -1; for (let i = 0; i < w.map.w * w.map.h; i++) if (w.nav.terrain[i]) { voidTile = i; break; }
  r = cmd(g, { t: 'place', building: 'wall', tx: voidTile % w.map.w, ty: Math.floor(voidTile / w.map.w), ids: [] });
  assert.equal(r.ok, false);
  r = cmd(g, { t: 'place', building: 'core', tx: 20, ty: 50, ids: [] }); assert.equal(r.ok, false);
  r = cmd(g, { t: 'train', building: core(w, 1).id, unit: 'breaker' }); assert.equal(r.ok, false);
  assert.equal(w.players[1].data, 500);
});

test('cancel construction refunds fully; demolish refunds 25%', () => {
  const g = humanGame(18); const w = g.world;
  const d0 = w.players[1].data;
  const r = cmd(g, { t: 'place', building: 'bank', tx: 12, ty: 50, ids: [] });
  const id = Number(r.reason);
  assert.equal(w.players[1].data, d0 - 50);
  assert.ok(cmd(g, { t: 'cancelBuild', building: id }).ok);
  assert.equal(w.players[1].data, d0);
  assert.equal(w.nav.block[w.nav.idx(12, 50)], 0, 'footprint cleared');
  const b = instantBuilding(w, 'bank', 1, 12, 50);
  assert.ok(cmd(g, { t: 'demolish', building: b.id }).ok);
  assert.equal(w.players[1].data, d0 + 50 * B.economy.demolishRefund);
});

test('training queue: cap, cancellation refunds and returns the specialized Runner; population accounting stays exact', () => {
  const g = humanGame(19); const w = g.world;
  const p = w.players[1];
  p.data = 400; p.code = 200; p.hash = 400;
  const grid = instantBuilding(w, 'grid', 1, 12, 48);
  const runners0 = units(w, 1, 'runner').length;
  const mem0 = w.memUsed(1);
  assert.ok(cmd(g, { t: 'train', building: grid.id, unit: 'bulwark' }).ok);
  const afterPay = { code: p.code, hash: p.hash };
  g.step(); // starts: absorbs a runner and reserves memory
  assert.equal(units(w, 1, 'runner').length, runners0 - 1);
  assert.equal(w.memUsed(1), mem0 - 1 + B.units.bulwark.mem);
  assert.ok(cmd(g, { t: 'cancelTrain', building: grid.id, index: 0 }).ok);
  assert.equal(units(w, 1, 'runner').length, runners0, 'runner returned');
  assert.equal(w.memUsed(1), mem0);
  assert.ok(Math.abs(p.code - (afterPay.code + 20)) < 0.2 && Math.abs(p.hash - (afterPay.hash + 35)) < 0.01, 'refund');
  for (let i = 0; i < B.economy.maxQueue; i++) assert.ok(cmd(g, { t: 'train', building: grid.id, unit: 'ping' }).ok);
  const r = cmd(g, { t: 'train', building: grid.id, unit: 'ping' });
  assert.equal(r.ok, false); assert.match(r.reason!, /Queue is full/);
  // complete training: population = units + started items
  secs(g, 60);
  const pings = units(w, 1, 'ping').length;
  assert.ok(pings >= 3, `trained ${pings}`);
  const expected = units(w, 1).reduce((a, u) => a + B.units[u.type].mem, 0) + grid.queue!.filter(q => q.started).reduce((a, q) => a + B.units[q.unit].mem, 0);
  assert.equal(w.memUsed(1), expected);
  // death frees memory
  const victim = units(w, 1, 'ping')[0]; const m1 = w.memUsed(1);
  w.kill(victim); w.compact();
  assert.equal(w.memUsed(1), m1 - 1);
});

test('memory cap blocks training until a Memory Bank exists', () => {
  const g = humanGame(20); const w = g.world;
  const c = core(w, 1);
  for (let i = 0; i < 6; i++) w.spawnUnit('runner', 1, c.x + 3, c.y - 3 - i * 0.5);
  assert.equal(w.memUsed(1), 10);
  w.players[1].code = 200; w.players[1].data = 300;
  assert.ok(cmd(g, { t: 'train', building: c.id, unit: 'runner' }).ok);
  secs(g, 12);
  assert.equal(units(w, 1, 'runner').length, 10, 'no spawn while memory is full');
  assert.equal(c.stall, 'memFull');
  instantBuilding(w, 'bank', 1, 12, 48);
  secs(g, 12);
  assert.equal(units(w, 1, 'runner').length, 11);
});

test('blocked spawn waits (no loss) and resumes once space clears', () => {
  const g = humanGame(21); const w = g.world;
  const c = core(w, 1);
  w.players[1].data = 5000; w.players[1].code = 200;
  // ring the core with walls at distance 1..4 so no spawn tile exists
  const walls: number[] = [];
  for (let r = 1; r <= 4; r++) for (let y = c.ty! - r; y <= c.ty! + 2 + r; y++) for (let x = c.tx! - r; x <= c.tx! + 2 + r; x++) {
    if (!w.nav.inBounds(x, y) || w.nav.block[w.nav.idx(x, y)] || w.nav.terrain[w.nav.idx(x, y)]) continue;
    if (w.entities.some(e => e.kind === 'well' && Math.floor(e.x) === x && Math.floor(e.y) === y)) continue;
    walls.push(instantBuilding(w, 'wall', 1, x, y).id);
  }
  const before = units(w, 1, 'runner').length;
  cmd(g, { t: 'train', building: c.id, unit: 'runner' });
  secs(g, 12);
  assert.equal(c.stall, 'spawnBlocked');
  assert.equal(units(w, 1, 'runner').length, before);
  for (const id of walls.slice(0, 40)) cmd(g, { t: 'demolish', building: id });
  secs(g, 1);
  assert.equal(units(w, 1, 'runner').length, before + 1);
});
