// Node/V8 reference hashes for tools/webkit_determinism.py: npx tsx tools/hashes.ts [seeds=777,1,42] [ticks=3000]
import { Game, stateHash } from '../src/sim/game.ts';
const seeds = (process.argv[2] ?? '777,1,42').split(',').map(Number), N = Number(process.argv[3] ?? 3000);
const out: Record<string, string> = {};
for (const seed of seeds) { const g = new Game({ seed, difficulty: 'normal', players: [{ name: 'You', ai: false }, { name: 'Rival Kernel', ai: true }] }); g.run(N); out[seed] = stateHash(g.world); }
console.log(JSON.stringify({ engine: `Node ${process.version} (V8)`, ticks: N, hashes: out }));
