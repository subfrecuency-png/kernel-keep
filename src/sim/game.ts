// Game orchestrator: fixed-tick stepping, command log (for replays), AI controllers, state hash.
import { B, Command, CommandResult } from './types.ts';
import { World, WorldOptions } from './world.ts';
import { applyCommand } from './commands.ts';
import { stepEconomy, stepBuildings, stepUnits, stepSeparation, stepFog, applyHits } from './systems.ts';
import { AIController } from './ai.ts';

export interface LoggedCommand { tick: number; cmd: Command }

export class Game {
  world: World;
  ais: AIController[] = [];
  log: LoggedCommand[] = [];
  perf = { lastStepMs: 0, avgStepMs: 0, maxStepMs: 0 };

  constructor(opts: WorldOptions, world?: World) {
    this.world = world ?? new World(opts);
    for (const p of this.world.players) if (p.id > 0 && p.ai) {
      const ai = new AIController(p.id, this.world.difficulty);
      if (opts.aiPhase?.[p.id] !== undefined) ai.s.phase = opts.aiPhase[p.id];
      this.ais.push(ai);
    }
    if (!world) stepFog(this.world); // loaded worlds restore their saved visibility
  }

  /** Human command: validated and applied immediately (between ticks), logged with the tick it applied before. */
  issue(cmd: Command): CommandResult {
    const r = applyCommand(this.world, cmd);
    if (r.ok) this.log.push({ tick: this.world.tick, cmd: JSON.parse(JSON.stringify(cmd)) });
    return r;
  }

  step() {
    const w = this.world;
    if (w.winner) return;
    const t0 = now();
    w.events = [];
    w.nav.spent = 0;
    stepFog(w);
    w.rebuildCells();
    stepEconomy(w);
    stepBuildings(w);
    stepUnits(w);
    applyHits(w);
    w.rebuildCells();
    stepSeparation(w);
    w.compact();
    for (const ai of this.ais) ai.update(w, (c) => applyCommand(w, c));
    w.tick++;
    const ms = now() - t0;
    this.perf.lastStepMs = ms;
    this.perf.avgStepMs = this.perf.avgStepMs * 0.98 + ms * 0.02;
    if (ms > this.perf.maxStepMs) this.perf.maxStepMs = ms;
  }

  run(ticks: number) { for (let i = 0; i < ticks && !this.world.winner; i++) this.step(); }
  seconds(): number { return this.world.tick / B.tickRate; }
}

function now(): number { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }

/** Deterministic state fingerprint (FNV-1a over exact numeric values). */
export function stateHash(w: World): string {
  let h = 0x811c9dc5;
  const mix = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  mix(`${w.tick}|${w.rng.state}|${w.nextId}|${w.winner}`);
  for (const p of w.players) mix(`P${p.id}:${p.data}:${p.code}:${p.hash}:${p.stability}:${p.ration}:${p.unmet}`);
  for (const e of w.entities) {
    mix(`E${e.id}:${e.type}:${e.owner}:${e.x}:${e.y}:${e.hp}:${e.order?.type ?? ''}:${e.order?.target ?? ''}:${e.carry ?? ''}:${e.progress ?? ''}:${e.amount ?? ''}:${e.suspended ? 1 : 0}`);
    if (e.queue) for (const q of e.queue) mix(`Q${q.unit}:${q.progress}:${q.started}`);
  }
  return h.toString(16).padStart(8, '0');
}

/** Replay a command log from a fresh world with the same options; AI commands regenerate deterministically. */
export function replay(opts: WorldOptions, log: LoggedCommand[], ticks: number): Game {
  const g = new Game(opts);
  let k = 0;
  for (let t = 0; t < ticks; t++) {
    while (k < log.length && log[k].tick === g.world.tick) { applyCommand(g.world, log[k].cmd); g.log.push(log[k]); k++; }
    g.step();
  }
  return g;
}
