// Usage: npx tsx tools/mirror_probe.ts [tolerance=1e-9] [ticks=6000]
// Mirror-exactness probe: runs two identical AIs with equal decision phases and reports the first tick where the
// point-mirrored states differ by more than TOL.
import { Game } from '../src/sim/game.ts';
const TOL = Number(process.argv[2] ?? 1e-9), MAX = Number(process.argv[3] ?? 6000);
const g = new Game({ seed: 1, aiPhase: { 1: 0, 2: 0 }, players: [{ name: 'A', ai: true }, { name: 'B', ai: true }] });
const w = g.world; const W = w.map.w, H = w.map.h;
const list = (pid: number) => w.entities.filter(e => !e.dead && e.owner === pid).map(e => ({ e, t: e.type, x: pid === 2 ? W - e.x : e.x, y: pid === 2 ? H - e.y : e.y }))
  .sort((a, b) => a.t.localeCompare(b.t) || a.x - b.x || a.y - b.y);
for (let t = 1; t <= MAX; t++) {
  const snapA = new Map<number, any>(); for (const e of w.entities) if (e.kind === 'unit') snapA.set(e.id, { x: e.x, y: e.y, o: JSON.stringify(e.order), pI: e.pathI, path: e.path?.slice(0, 4) });
  g.step();
  const A = list(1), Bl = list(2);
  let bad = '';
  if (A.length !== Bl.length) bad = `count ${A.length} vs ${Bl.length}`;
  else for (let i = 0; i < A.length; i++) { const a = A[i], b = Bl[i]; if (a.t !== b.t || Math.abs(a.x - b.x) > TOL || Math.abs(a.y - b.y) > TOL) {
    const fmt = (q: any, pid: number) => { const e = q.e; const pre = snapA.get(e.id); return `#${e.id} ${e.type} now(${q.x.toFixed(6)},${q.y.toFixed(6)}) order=${JSON.stringify(e.order)} pathI=${e.pathI} path=${JSON.stringify(e.path?.map((n: number) => pid === 2 ? [W - 1 - n % W, H - 1 - Math.floor(n / W)] : [n % W, Math.floor(n / W)]))} pre=${pre ? JSON.stringify({ ...pre, x: pid === 2 ? W - pre.x : pre.x, y: pid === 2 ? H - pre.y : pre.y, path: undefined }) : '-'}`; };
    bad = `\n  P1 ${fmt(a, 1)}\n  P2 ${fmt(b, 2)}`; break; } }
  const pa = w.players[1], pb = w.players[2];
  if (!bad && (Math.abs(pa.data - pb.data) > 1e-6 || Math.abs(pa.code - pb.code) > 1e-6)) bad = `resources ${pa.data},${pa.code} vs ${pb.data},${pb.code}`;
  if (bad) { console.log('first divergence at tick', t, bad); process.exit(0); }
}
console.log('mirror-exact through', MAX);
