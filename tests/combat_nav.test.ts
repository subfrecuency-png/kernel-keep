import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/sim/types.ts';
import { humanGame, cmd, units, instantBuilding, secs, revealAll, core } from './helpers.ts';

test('attack order: target dies, cooldown respected, attacker returns to idle; no friendly fire', () => {
  const g = humanGame(31); const w = g.world; revealAll(w);
  const a = w.spawnUnit('lancer', 1, 30.5, 50.5);
  const friend = w.spawnUnit('bulwark', 1, 31.5, 50.5);
  const t = w.spawnUnit('runner', 2, 33.5, 50.5);
  const shots: number[] = [];
  assert.ok(cmd(g, { t: 'attack', ids: [a.id], target: t.id }).ok || true);
  g.step(); // fog must see the target first
  assert.ok(cmd(g, { t: 'attack', ids: [a.id], target: t.id }).ok);
  for (let i = 0; i < 100 && !t.dead; i++) { g.step(); for (const e of w.events) if (e.t === 'shot' && e.from === a.id) shots.push(w.tick); }
  assert.ok(t.dead, 'target destroyed');
  const gaps = shots.slice(1).map((s, i) => s - shots[i]);
  assert.ok(gaps.every(gp => gp >= Math.round(B.units.lancer.attack!.cd * B.tickRate) - 1), `cooldown respected ${gaps}`);
  assert.equal(friend.hp, friend.maxHp, 'no friendly fire');
  g.step();
  assert.equal(a.order!.type, 'idle');
});

test('cannot target what you cannot see (fog-limited commands)', () => {
  const g = humanGame(32); const w = g.world;
  const a = w.spawnUnit('lancer', 1, 10.5, 45.5);
  const enemyCore = core(w, 2);
  const r = cmd(g, { t: 'attack', ids: [a.id], target: enemyCore.id });
  assert.equal(r.ok, false); assert.match(r.reason!, /not visible/);
});

test('hardened walls: non-siege attacks deal 25%, Breakers full damage', () => {
  const g = humanGame(33); const w = g.world; revealAll(w);
  const wall = instantBuilding(w, 'wall', 2, 30, 40);
  const bul = w.spawnUnit('bulwark', 1, 29.5, 40.5);
  g.step(); cmd(g, { t: 'attack', ids: [bul.id], target: wall.id });
  const hp0 = wall.hp;
  for (let i = 0; i < 20; i++) g.step();
  const dealt = hp0 - wall.hp;
  assert.ok(dealt > 0 && dealt <= B.units.bulwark.attack!.dmg * 0.25 * 2 + 1e-9, `bulwark vs wall ${dealt}`);
  const br = w.spawnUnit('breaker', 1, 25.5, 40.5);
  g.step(); cmd(g, { t: 'attack', ids: [br.id], target: wall.id });
  const hp1 = wall.hp;
  for (let i = 0; i < 12; i++) g.step();
  assert.ok(hp1 - wall.hp >= B.units.breaker.attack!.dmg * 0.99, 'breaker full damage');
});

test('gates: owner passes when open, is blocked when closed; enemies never pass; routes recalculate', () => {
  const g = humanGame(34); const w = g.world; revealAll(w);
  // sealed pen x 10..16, y 40..46 with a single gate on the north side at (13,40)
  let gate: any;
  for (let y = 40; y <= 46; y++) for (let x = 10; x <= 16; x++) {
    if (x > 10 && x < 16 && y > 40 && y < 46) continue;
    if (x === 13 && y === 40) gate = instantBuilding(w, 'gate', 1, x, y);
    else instantBuilding(w, 'wall', 1, x, y);
  }
  const mine = w.spawnUnit('runner', 1, 13.5, 43.5);
  const enemy = w.spawnUnit('runner', 2, 12.5, 43.5);
  const out = [13, 35, 13, 35];
  assert.equal(w.nav.findPath(13, 43, out, 1).partial, false, 'owner routes through open gate');
  assert.ok(w.nav.findPath(13, 43, out, 1).tiles.includes(w.nav.idx(13, 40)));
  assert.equal(w.nav.findPath(12, 43, out, 2).partial, true, 'enemy cannot pass an open gate');
  cmd(g, { t: 'move', ids: [mine.id], x: 13.5, y: 35.5 });
  cmd(g, { t: 'move', ids: [enemy.id], x: 12.5, y: 35.5 }, 2);
  secs(g, 10);
  assert.ok(mine.y < 40, `owner crossed (y=${mine.y.toFixed(2)})`);
  assert.ok(enemy.y > 40, 'enemy held back');
  assert.equal(enemy.order!.type, 'idle', 'enemy gave up cleanly (unreachable)');
  // close gate: owner blocked too
  cmd(g, { t: 'gate', building: gate.id, open: false });
  assert.equal(w.nav.findPath(13, 36, [13, 43, 13, 43], 1).partial, true, 'closed gate blocks owner');
  cmd(g, { t: 'move', ids: [mine.id], x: 13.5, y: 43.5 });
  secs(g, 6);
  assert.ok(mine.y < 40, 'owner stays out while closed');
  assert.equal(mine.order!.type, 'idle', 'order to an unreachable spot ends cleanly');
  // an order in progress re-plans automatically when the nav grid changes (gate reopens mid-walk)
  cmd(g, { t: 'move', ids: [mine.id], x: 13.5, y: 32.5 }); secs(g, 4);
  cmd(g, { t: 'move', ids: [mine.id], x: 13.5, y: 43.5 });
  g.run(5);
  assert.equal(mine.pathPartial, true, 'walking on a partial path while closed');
  cmd(g, { t: 'gate', building: gate.id, open: true });
  secs(g, 8);
  assert.ok(mine.y > 40, `owner re-routed after reopening (y=${mine.y.toFixed(2)})`);
  // destroy a wall segment: the enemy can now leave through the breach
  const seg = w.entities.find(e => e.type === 'wall' && e.tx === 11 && e.ty === 40)!;
  w.kill(seg); w.compact();
  assert.equal(w.nav.findPath(12, 43, out, 2).partial, false, 'breach opens a route');
});

test('unreachable destination: unit walks to the closest reachable point and stops (no wandering)', () => {
  const g = humanGame(35); const w = g.world; revealAll(w);
  const u = w.spawnUnit('runner', 1, 20.5, 50.5);
  let vx = -1, vy = -1;
  for (let y = 0; y < w.map.h && vx < 0; y++) for (let x = 0; x < w.map.w; x++) if (w.nav.terrain[w.nav.idx(x, y)] && Math.abs(x - y) <= 1 && x > 40) { vx = x; vy = y; break; }
  assert.ok(cmd(g, { t: 'move', ids: [u.id], x: vx + 0.5, y: vy + 0.5 }).ok);
  secs(g, 40);
  assert.equal(u.order!.type, 'idle', 'order finished');
  assert.ok(w.nav.passableXY(Math.floor(u.x), Math.floor(u.y), 1), 'standing on open ground');
  assert.ok(Math.hypot(u.x - vx, u.y - vy) < 4, 'ended near the unreachable target');
});

test('obstruction recovery: a building placed on top of units ejects them to open ground', () => {
  const g = humanGame(36); const w = g.world;
  const c = core(w, 1);
  const u = w.spawnUnit('runner', 1, 13.5, 50.5);
  w.players[1].data = 500;
  assert.ok(cmd(g, { t: 'place', building: 'compiler', tx: 13, ty: 50, ids: [] }).ok);
  assert.ok(w.nav.passableXY(Math.floor(u.x), Math.floor(u.y), 1), 'unit ejected');
  void c;
});

test('siege routing: attack-move into a walled base breaches the wall instead of giving up', () => {
  const g = humanGame(37); const w = g.world; revealAll(w);
  // seal a box around a target building
  const target = instantBuilding(w, 'bank', 2, 30, 50);
  for (let y = 48; y <= 53; y++) for (let x = 28; x <= 33; x++) {
    if (x > 28 && x < 33 && y > 48 && y < 53) continue;
    if (!w.nav.block[w.nav.idx(x, y)] && !w.nav.terrain[w.nav.idx(x, y)]) instantBuilding(w, 'wall', 2, x, y);
  }
  const br = w.spawnUnit('breaker', 1, 22.5, 50.5);
  const bw = w.spawnUnit('bulwark', 1, 22.5, 51.5);
  g.step();
  assert.ok(cmd(g, { t: 'attackMove', ids: [br.id, bw.id], x: 30.5, y: 50.5 }).ok);
  secs(g, 90);
  const wallsLost = w.players[2].stats.buildingsLost;
  assert.ok(wallsLost >= 1, 'breached at least one wall');
  assert.ok(target.hp < target.maxHp || target.dead, 'reached and hit the target');
});

test('victory and defeat: destroying a Core ends the match and further commands are rejected', () => {
  const g = humanGame(38); const w = g.world;
  const c2 = core(w, 2);
  w.kill(c2);
  assert.equal(w.winner, 1);
  assert.equal(w.players[2].defeated, true);
  const r = cmd(g, { t: 'ration', level: 'lean' });
  assert.equal(r.ok, false);
  const t0 = w.tick; g.step(); assert.equal(w.tick, t0, 'simulation stops after victory');
});

test('fork: temporary copies use no memory, expire, and die with their source', () => {
  const g = humanGame(39); const w = g.world;
  const a = w.spawnUnit('lancer', 1, 20.5, 50.5); const b = w.spawnUnit('lancer', 1, 21.5, 50.5);
  w.players[1].hash = 200;
  const mem0 = w.memUsed(1);
  assert.ok(cmd(g, { t: 'fork', ids: [a.id, b.id] }).ok);
  const forks = units(w, 1).filter(u => u.forkOf);
  assert.equal(forks.length, 2);
  assert.equal(w.memUsed(1), mem0, 'forks use no memory');
  assert.equal(w.computeDemand(1), B.fork.computeSurge, 'compute surge while forks live');
  const r = cmd(g, { t: 'fork', ids: [a.id] }); assert.equal(r.ok, false, 'cooldown');
  w.kill(a);
  assert.ok(forks.find(f => f.forkOf === a.id)!.dead, 'fork dies with source');
  secs(g, B.fork.durationSec + 1);
  assert.equal(units(w, 1).filter(u => u.forkOf).length, 0, 'forks expire');
  assert.equal(w.computeDemand(1), 0);
});

test('towers fire slower in a brownout', () => {
  const g = humanGame(40); const w = g.world; revealAll(w);
  const tower = instantBuilding(w, 'tower', 1, 30, 50);
  const dummy = w.spawnUnit('bulwark', 2, 33.5, 51.5); dummy.hp = dummy.maxHp = 1e6;
  const countShots = (n: number) => { let s = 0; for (let i = 0; i < n; i++) { g.step(); s += w.events.filter(e => e.t === 'shot' && e.from === tower.id).length; } return s; };
  const full = countShots(120);
  w.players[1].surgeUntil = w.tick + 10_000; // +8 demand -> 10/10 (tower 2 + surge 8) still ok; add rigs
  for (let i = 0; i < 3; i++) { const r = instantBuilding(w, 'rig', 1, 12 + i * 3, 46); const ru = w.spawnUnit('runner', 1, 13 + i * 3, 45.5); cmd(g, { t: 'operate', ids: [ru.id], target: r.id }); }
  g.run(60);
  assert.ok(w.computeEff(1) < 0.6, `eff ${w.computeEff(1)}`);
  const slow = countShots(120);
  assert.ok(slow < full, `brownout shots ${slow} < ${full}`);
});

test('demolishing a Training Grid mid-training refunds and returns the absorbed Runner', async () => {
  const { buildingsOf } = await import('./helpers.ts');
  const g = humanGame(41); const w = g.world;
  w.players[1].code = 200; w.players[1].hash = 200;
  const grid = instantBuilding(w, 'grid', 1, 12, 48);
  const r0 = units(w, 1, 'runner').length;
  cmd(g, { t: 'train', building: grid.id, unit: 'lancer' });
  g.step();
  assert.equal(units(w, 1, 'runner').length, r0 - 1, 'runner absorbed');
  const hash = w.players[1].hash;
  assert.ok(cmd(g, { t: 'demolish', building: grid.id }).ok);
  assert.equal(units(w, 1, 'runner').length, r0, 'runner returned');
  assert.equal(w.players[1].hash, hash + 40, 'training cost refunded');
  assert.equal(buildingsOf(w, 1, 'grid').length, 0);
});

test('Patchers keep healing while attack-moving with an army', () => {
  const g = humanGame(42); const w = g.world;
  const pa = w.spawnUnit('patcher', 1, 20.5, 50.5);
  const hurt = w.spawnUnit('bulwark', 1, 21.5, 50.5); hurt.hp = 50;
  assert.ok(cmd(g, { t: 'attackMove', ids: [pa.id, hurt.id], x: 30.5, y: 50.5 }).ok);
  assert.equal(pa.order!.type, 'attackMove');
  secs(g, 4);
  assert.ok(hurt.hp > 50, `healed on the move (${hurt.hp})`);
});
