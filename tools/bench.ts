// Simulation benchmark: N-vs-N battles plus a full economy, measured in ms per simulation tick
// on whatever machine runs it. Usage: npm run bench
import { Game } from '../src/sim/game.ts';
import { B } from '../src/sim/types.ts';
import os from 'node:os';

function battle(perSide: number) {
  const g = new Game({ seed: 9, players: [{ name: 'A', ai: true }, { name: 'B', ai: true }] });
  const w = g.world;
  g.run(1800); // 3 minutes of economy so buildings/AI exist
  const types = ['bulwark', 'lancer', 'lancer', 'patcher', 'breaker', 'ping'];
  for (let i = 0; i < perSide; i++) {
    const t = types[i % types.length];
    w.spawnUnit(t, 1, 24 + (i % 10) * 0.8, 44 + Math.floor(i / 10) * 0.8);
    w.spawnUnit(t, 2, 40 + (i % 10) * 0.8, 22 - Math.floor(i / 10) * 0.8);
  }
  for (const e of w.entities) if (e.kind === 'unit' && e.type !== 'runner') { e.order = { type: 'attackMove', x: e.owner === 1 ? 44 : 20, y: e.owner === 1 ? 20 : 44 }; e.path = undefined; }
  const units0 = w.entities.filter(e => e.kind === 'unit').length;
  const times: number[] = [];
  for (let i = 0; i < 600; i++) { const t0 = performance.now(); g.step(); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  return { perSide, unitsAtStart: units0, unitsAtEnd: w.entities.filter(e => e.kind === 'unit').length, avg: +avg.toFixed(3), p95: +times[Math.floor(times.length * 0.95)].toFixed(3), max: +times[times.length - 1].toFixed(3) };
}

console.log(`Machine: ${os.cpus()[0]?.model ?? 'unknown'} × ${os.cpus().length}, Node ${process.version}. Budget per tick at ${B.tickRate} Hz = ${1000 / B.tickRate} ms.`);
for (const n of [25, 50, 100, 200]) {
  const r = battle(n);
  console.log(`${String(n).padStart(3)} per side | units start ${r.unitsAtStart} end ${r.unitsAtEnd} | avg ${r.avg} ms  p95 ${r.p95} ms  max ${r.max} ms per tick`);
}
