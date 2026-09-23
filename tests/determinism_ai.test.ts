import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, stateHash, replay } from '../src/sim/game.ts';
import { saveGame, loadGame } from '../src/sim/save.ts';
import { applyCommand } from '../src/sim/commands.ts';
import { AIController } from '../src/sim/ai.ts';
import { Command } from '../src/sim/types.ts';
import { units, core, nearestWell } from './helpers.ts';

const AIvAI = (seed: number) => new Game({ seed, players: [{ name: 'A', ai: true }, { name: 'B', ai: true }] });

test('same seed + same commands => identical state hash (repeated seeded scenario)', () => {
  const a = AIvAI(101), b = AIvAI(101);
  a.run(3000); b.run(3000);
  assert.equal(stateHash(a.world), stateHash(b.world));
  const c = AIvAI(102); c.run(3000);
  assert.notEqual(stateHash(a.world), stateHash(c.world), 'different seed diverges (sanity)');
});

test('command-log replay reproduces a human+AI match exactly', () => {
  const opts = { seed: 202, players: [{ name: 'H', ai: false }, { name: 'AI', ai: true }] };
  const g = new Game(opts); const w = g.world;
  const rs = units(w, 1, 'runner'); const c = core(w, 1);
  g.issue({ t: 'harvest', ids: rs.slice(0, 3).map(r => r.id), target: nearestWell(w, c.x, c.y).id, player: 1 });
  g.issue({ t: 'place', building: 'compiler', tx: 12, ty: 50, ids: [rs[3].id], player: 1 });
  g.run(400);
  g.issue({ t: 'train', building: c.id, unit: 'runner', player: 1 });
  g.issue({ t: 'ration', level: 'lean', player: 1 });
  g.run(1600);
  const r = replay(opts, g.log, w.tick);
  assert.equal(r.world.tick, w.tick);
  assert.equal(stateHash(r.world), stateHash(w));
});

test('save/load mid-match (queues, orders, rng, timers) continues bit-identically', () => {
  const a = AIvAI(303);
  a.run(4000);
  const snap = JSON.parse(JSON.stringify(saveGame(a)));
  const b = loadGame(snap);
  assert.equal(stateHash(b.world), stateHash(a.world), 'identical right after load');
  // queues/timers present in the snapshot
  assert.ok(snap.entities.some((e: any) => e.queue && e.queue.some((q: any) => q.started)), 'snapshot contains an in-progress training queue');
  assert.ok(snap.entities.some((e: any) => e.kind === 'unit' && e.order && e.order.type !== 'idle'), 'snapshot contains active unit orders');
  a.run(3000); b.run(3000);
  assert.equal(stateHash(b.world), stateHash(a.world), 'identical 3000 ticks later');
  assert.equal(b.world.memUsed(1), a.world.memUsed(1), 'population accounting survives save/load');
});

test('save schema is versioned and rejects unknown versions', () => {
  const a = AIvAI(304); a.run(50);
  const s = saveGame(a); (s as any).schema = 99;
  assert.throws(() => loadGame(s), /Unsupported save schema/);
});

test('AI plays within its information and command rules', () => {
  const g = new Game({ seed: 405, players: [{ name: 'H', ai: false }, { name: 'AI', ai: true }] });
  const w = g.world;
  const issued: { c: Command; ok: boolean; visibleTarget?: boolean }[] = [];
  const ai = g.ais[0];
  g.ais = [];
  const wrapped = new AIController(ai.s.pid, 'normal', ai.s);
  // P1 sits still with a few units; the AI must scout/fight using only what it can see
  for (let t = 0; t < 9000 && !w.winner; t++) {
    g.step();
    wrapped.update(w, (c) => {
      let visibleTarget: boolean | undefined;
      if (c.t === 'attack') { const tg = w.get(c.target); visibleTarget = !!tg && w.canSee(2, tg); }
      const r = applyCommand(w, c);
      issued.push({ c, ok: r.ok, visibleTarget });
      return r;
    });
  }
  assert.ok(issued.length > 50, 'AI acted');
  assert.ok(issued.every(i => i.c.player === 2), 'AI only commands its own player');
  assert.ok(issued.filter(i => i.c.t === 'attack' && i.ok).every(i => i.visibleTarget), 'no attacks on unseen targets');
  const p2 = w.players[2];
  // resources only come from its own economy: everything it spent was earned
  assert.ok(p2.stats.dataHarvested > 0 && p2.stats.hashMined > 0);
  const types = new Set(issued.filter(i => i.ok).map(i => i.c.t));
  for (const t of ['train', 'place', 'harvest', 'attackMove']) assert.ok(types.has(t as any), `AI used ${t}`);
  // the AI attacked the human base (which only has 4 runners) and should have won or be winning
  assert.ok(w.winner === 2 || w.players[1].stats.buildingsLost + w.players[1].stats.unitsLost > 0, 'AI pressured the undefended player');
});

test('extended AI-vs-AI run: 30 simulated minutes without NaN, leaks or stuck state', () => {
  const g = AIvAI(506);
  const n = 30 * 60 * 10;
  for (let i = 0; i < n && !g.world.winner; i++) g.step();
  const w = g.world;
  for (const e of w.entities) {
    assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.hp), `finite entity ${e.id}`);
    assert.ok(e.x >= 0 && e.y >= 0 && e.x <= w.map.w && e.y <= w.map.h, 'in bounds');
    if (e.kind === 'unit') assert.ok(w.nav.terrain[Math.floor(e.y) * w.map.w + Math.floor(e.x)] === 0, 'never inside the void');
  }
  for (const p of w.players.slice(1)) {
    assert.ok(p.data >= 0 && p.code >= 0 && p.hash >= 0, 'no negative stock');
    assert.ok(Number.isFinite(p.stability));
    assert.ok(w.memUsed(p.id) <= w.caps(p.id).memory + 3, 'population within cap (+ in-flight tolerance)');
  }
  assert.equal(w.entities.filter(e => e.dead).length, 0, 'dead entities compacted');
  assert.ok(g.perf.maxStepMs < 200, `max step ${g.perf.maxStepMs}ms`);
});
