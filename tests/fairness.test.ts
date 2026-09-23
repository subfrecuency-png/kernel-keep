// Mirror symmetry regression: two identical AIs with the same decision phase on the point-symmetric map must stay
// exactly point-mirrored. This guards the 0.2/0.3.1 fairness fixes (docs/FAIRNESS_RESULTS.md): any new
// id-ordered tie-break, unmirrored offset or float-sensitive comparison shows up here as a divergence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.ts';

test('mirror symmetry: equal-phase AI vs AI stays exactly point-mirrored for 5 minutes', () => {
  const g = new Game({ seed: 3, aiPhase: { 1: 0, 2: 0 }, players: [{ name: 'A', ai: true }, { name: 'B', ai: true }] });
  const w = g.world; const W = w.map.w, H = w.map.h;
  const sig = (pid: number) => w.entities.filter(e => !e.dead && e.owner === pid)
    .map(e => `${e.type}@${(pid === 2 ? W - e.x : e.x).toFixed(9)},${(pid === 2 ? H - e.y : e.y).toFixed(9)}:${Math.round(e.hp * 1e6)}`).sort().join('|');
  for (let t = 1; t <= 3000; t++) {
    g.step();
    if (t % 50 === 0) {
      assert.equal(sig(1), sig(2), `mirror broke by tick ${t}`);
      const a = w.players[1], b = w.players[2];
      assert.ok(Math.abs(a.data - b.data) < 1e-9 && Math.abs(a.code - b.code) < 1e-9 && Math.abs(a.hash - b.hash) < 1e-9, `resources differ at tick ${t}`);
    }
  }
});
