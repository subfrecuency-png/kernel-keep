import { Game } from '../src/sim/game.ts';
import { B, Command, Entity } from '../src/sim/types.ts';
import { World } from '../src/sim/world.ts';
import { completeBuilding } from '../src/sim/systems.ts';

export function humanGame(seed = 1, p2ai = false): Game {
  return new Game({ seed, players: [{ name: 'P1', ai: false }, { name: 'P2', ai: p2ai }] });
}
export function cmd(g: Game, c: any, player = 1) { return g.issue({ ...c, player } as Command); }
export function units(w: World, owner: number, type?: string): Entity[] { return w.entities.filter(e => !e.dead && e.kind === 'unit' && e.owner === owner && (!type || e.type === type)); }
export function buildingsOf(w: World, owner: number, type?: string): Entity[] { return w.entities.filter(e => !e.dead && e.kind === 'building' && e.owner === owner && (!type || e.type === type)); }
export function core(w: World, owner: number) { return w.coreOf(owner)!; }
export function nearestWell(w: World, x: number, y: number) { return w.entities.filter(e => e.kind === 'well' && !e.dead).sort((a, b) => ((a.x - x) ** 2 + (a.y - y) ** 2) - ((b.x - x) ** 2 + (b.y - y) ** 2))[0]; }
/** Instantly add a finished building (test setup only). */
export function instantBuilding(w: World, type: string, owner: number, tx: number, ty: number): Entity {
  const b = w.spawnBuilding(type, owner, tx, ty, false);
  b.hp = b.maxHp; completeBuilding(w, b);
  return b;
}
export function revealAll(w: World) { for (const p of w.players) p.explored.fill(1); }
export function secs(g: Game, s: number) { g.run(Math.round(s * B.tickRate)); }
export function totalDataInWorld(w: World, owner: number) {
  let wells = 0, carried = 0;
  for (const e of w.entities) { if (e.dead) continue; if (e.kind === 'well') wells += e.amount!; if (e.kind === 'unit' && e.owner === owner) carried += e.carry ?? 0; }
  return { wells, carried, stock: w.players[owner].data };
}
