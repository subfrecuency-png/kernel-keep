// The React HUD renders only these view models, so they must reflect authoritative engine state
// (the master kit's rule: no sample values, no invented thresholds).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B } from '../src/sim/types.ts';
import { topView, recoveryView, selectionView } from '../src/client/view.ts';
import { humanGame, cmd, units, instantBuilding, secs, core } from './helpers.ts';

test('top bar: values come from the engine; a reserve estimate exists only for a negative net Code rate', () => {
  const g = humanGame(51); const w = g.world;
  const t0 = topView(w, 1);
  assert.equal(t0.resources.find(r => r.id === 'data')!.value, `${Math.floor(w.players[1].data)}/${w.caps(1).dataCap}`);
  assert.equal(t0.resources.find(r => r.id === 'compute')!.value, `${w.computeDemand(1)}/${w.caps(1).compute}`);
  assert.equal(t0.resources.find(r => r.id === 'memory')!.value, `${w.memUsed(1)}/${w.caps(1).memory}`);
  // 4 runners eat 0.2/s, Core trickles 0.1/s -> negative net -> reserve shown
  assert.ok(t0.codeNetPerMin < 0 && t0.codeReserveSec !== null);
  // a staffed compiler makes net positive -> no reserve estimate
  const c = instantBuilding(w, 'compiler', 1, 12, 49);
  cmd(g, { t: 'operate', ids: [units(w, 1, 'runner')[0].id], target: c.id });
  secs(g, 6);
  const t1 = topView(w, 1);
  assert.ok(t1.codeNetPerMin > 0, `net ${t1.codeNetPerMin}`);
  assert.equal(t1.codeReserveSec, null);
});

test('recovery panel: starvation, brownout, suspension and memory issues mirror engine state; actions map to real commands', () => {
  const g = humanGame(52); const w = g.world;
  assert.deepEqual(recoveryView(w, 1), [], 'fresh match has no issues');
  const c = core(w, 1);
  for (let i = 0; i < 16; i++) w.spawnUnit('runner', 1, c.x + 4 + (i % 4) * 0.7, c.y - 4 - Math.floor(i / 4) * 0.7);
  w.players[1].code = 0; secs(g, 5);
  const starving = recoveryView(w, 1).find(i => i.kind === 'starving');
  assert.ok(starving, 'starving issue');
  assert.ok(starving!.actions.some(a => a.id === 'ration-lean'));
  // brownout: two towers (4) + a Fork surge (8) > 10 supply
  instantBuilding(w, 'tower', 1, 3, 44); instantBuilding(w, 'tower', 1, 6, 44);
  w.players[1].surgeUntil = w.tick + 1000;
  const brown = recoveryView(w, 1).find(i => i.kind === 'brownout');
  assert.ok(brown && brown.title.includes(`${w.computeDemand(1)}/${w.caps(1).compute}`));
  // suspension
  cmd(g, { t: 'suspend', ids: units(w, 1, 'runner').slice(0, 2).map(u => u.id), on: true });
  const susp = recoveryView(w, 1).find(i => i.kind === 'suspended');
  assert.ok(susp && susp.title.startsWith('2 programs suspended'));
  // every action id is one the engine knows how to execute
  const known = new Set(['ration-lean', 'suspend-idle', 'resume-all', 'select-suspended', 'select-compiler', 'rig-off', 'hint-compiler', 'hint-node', 'hint-bank']);
  for (const i of recoveryView(w, 1)) for (const a of i.actions) assert.ok(known.has(a.id), `unknown action ${a.id}`);
});

test('selection view: facts, stall explanation and queue reflect the entity', () => {
  const g = humanGame(53); const w = g.world;
  const grid = instantBuilding(w, 'grid', 1, 12, 48);
  w.players[1].hash = 200; w.players[1].code = 200;
  cmd(g, { t: 'train', building: grid.id, unit: 'lancer' });
  const v = selectionView(w, 1, [grid.id]);
  assert.equal(v.kind, 'single'); assert.equal(v.name, B.buildings.grid.name);
  assert.equal(v.queue!.length, 1); assert.equal(v.queue![0].name, 'Lancer');
  const r = units(w, 1, 'runner')[0];
  const rv = selectionView(w, 1, [r.id]);
  assert.ok(rv.facts!.some(([k, val]) => k === 'Upkeep' && val.startsWith(`${B.units.runner.upkeep} Code`)));
  const multi = selectionView(w, 1, units(w, 1).map(u => u.id));
  assert.equal(multi.kind, 'multi'); assert.equal(multi.count, units(w, 1).length);
});
