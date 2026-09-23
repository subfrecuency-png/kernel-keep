// AI-vs-AI headless match report: npx tsx tools/aivai.ts [seed] [minutes]
import { Game, stateHash } from '../src/sim/game.ts';
import { B } from '../src/sim/types.ts';
const g = new Game({ seed: Number(process.argv[2] ?? 7), players: [{name:'A',ai:true},{name:'B',ai:true}] });
const t0 = performance.now();
for (let m = 1; m <= Number(process.argv[3] ?? 20) && !g.world.winner; m++) {
  g.run(600);
  const w = g.world;
  const line = w.players.slice(1).map(p => {
    const u = w.entities.filter(e => e.kind==='unit' && e.owner===p.id);
    const b = w.entities.filter(e => e.kind==='building' && e.owner===p.id);
    return `P${p.id} D${p.data|0} C${p.code|0} H${p.hash|0} st${p.stability.toFixed(0)} ${p.ration[0]} run${u.filter(x=>x.type==='runner').length} army${u.filter(x=>x.type!=='runner').length} bld[${b.map(x=>x.type[0]+(x.built?'':'*')).join('')}] crash${p.stats.crashes} lost${p.stats.unitsLost}`;
  }).join(' | ');
  console.log(`min ${m}: ${line}`);
}
console.log('winner', g.world.winner, 'tick', g.world.tick, 'hash', stateHash(g.world), 'ms', (performance.now()-t0).toFixed(0), 'avgStep', g.perf.avgStepMs.toFixed(3), 'max', g.perf.maxStepMs.toFixed(2));
for (const p of g.world.players.slice(1)) console.log(p.id, JSON.stringify(p.stats), p.alerts.slice(0,4).map(a=>a.text).join(' / '));
