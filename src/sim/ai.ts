// Rival Kernel: a bounded, rule-based opponent. It issues the same validated commands as a human.
// Information rules (disclosed in GAME_DESIGN.md): it knows the map layout and both start
// positions (like a player who knows the map); everything else it learns through its own fog of war.
// Difficulty changes attack timing and wave size only — no resource bonuses, no map hacks.
import { B, Command, CommandResult, Entity } from './types.ts';
import { World } from './world.ts';
import { canPlace } from './commands.ts';
import { codeIncomeRate } from './systems.ts';

export interface AIState {
  pid: number; difficulty: string;
  nextWaveTick: number; waveSize: number; attacking: boolean; attackIds: number[]; launched: number;
  compIdx: number; scoutId: number; scoutPhase: number; rigsPaused: number[];
  /** Optional personality overrides (used by the economy simulation and future factions). */
  plan?: [string, number][]; comp?: string[]; noAttack?: boolean; noMilitary?: boolean;
  laborPaused?: number[];
}

const PLAN: [string, number][] = [
  ['compiler', 1], ['bank', 1], ['rig', 1], ['node', 1], ['grid', 1], ['compiler', 2], ['bank', 2],
  ['rig', 2], ['tower', 1], ['node', 2], ['rig', 3], ['bank', 3], ['compiler', 3], ['tower', 2], ['bank', 4], ['cache', 1],
];
const COMP = ['ping', 'bulwark', 'lancer', 'lancer', 'bulwark', 'lancer', 'patcher', 'breaker', 'lancer', 'bulwark', 'breaker', 'lancer'];

export class AIController {
  s: AIState;
  constructor(pid: number, difficulty: string, state?: AIState) {
    const d = B.ai[difficulty] ?? B.ai.normal;
    this.s = state ?? {
      pid, difficulty, nextWaveTick: d.firstAttackSec * B.tickRate, waveSize: d.firstWave, attacking: false, attackIds: [], launched: 0,
      compIdx: 0, scoutId: 0, scoutPhase: 0, rigsPaused: [],
    };
  }

  update(w: World, issue: (c: Command) => CommandResult) {
    const s = this.s; const pid = s.pid;
    if ((w.tick + pid * 3) % 10 !== 0) return;
    const p = w.players[pid];
    if (p.defeated || w.winner) return;
    const core = w.coreOf(pid); if (!core) return;
    const cmd = (c: any) => issue({ ...c, player: pid } as Command);
    const mine = w.entities.filter(e => !e.dead && e.owner === pid);
    const units = mine.filter(e => e.kind === 'unit' && !e.forkOf);
    const runners = units.filter(e => e.type === 'runner');
    const army = units.filter(e => e.type !== 'runner' && !e.suspended);
    const buildings = mine.filter(e => e.kind === 'building');
    const count = (t: string) => buildings.filter(b => b.type === t).length;
    const enemyId = pid === 1 ? 2 : 1;
    const enemyStart = w.map.cores[enemyId - 1];
    const enemyCore = { x: enemyStart.tx + 1.5, y: enemyStart.ty + 1.5 };

    // ---------- threats (fog-limited) ----------
    const threats: Entity[] = [];
    for (const e of w.entities) {
      if (e.dead || e.kind !== 'unit' || e.owner === pid || e.owner === 0) continue;
      if (!w.canSee(pid, e)) continue;
      if (buildings.some(b => (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 14 * 14)) threats.push(e);
    }
    const underAttack = threats.length > 0;

    // ---------- economy upkeep decisions ----------
    const upkeep = units.filter(u => !u.suspended).reduce((a, u) => a + B.units[u.type].upkeep, 0) / B.economy.upkeepCycleSec;
    const income = codeIncomeRate(w, pid);
    if (p.code < 15 && p.ration !== 'lean' && income < upkeep) cmd({ t: 'ration', level: 'lean' });
    else if (p.ration === 'lean' && (p.code > 60 || income > upkeep * 1.3)) cmd({ t: 'ration', level: 'standard' });
    const crashed = units.filter(u => u.suspended);
    if (crashed.length && p.code > 40) cmd({ t: 'suspend', ids: crashed.map(u => u.id), on: false });

    // brownout under attack: pause a rig so towers get full compute
    const eff = w.computeEff(pid);
    if (underAttack && eff < 1) {
      const rig = buildings.find(b => b.type === 'rig' && b.built && b.active);
      if (rig) { cmd({ t: 'toggleActive', building: rig.id }); s.rigsPaused.push(rig.id); }
    } else if (!underAttack && s.rigsPaused.length) {
      for (const id of s.rigsPaused) { const r = w.get(id); if (r && !r.active) cmd({ t: 'toggleActive', building: id }); }
      s.rigsPaused = [];
    }

    // labour balance: if Data income collapses, pull operators off Code/Hash buildings back to harvesting
    const harvesters = runners.filter(u => u.order?.type === 'harvest').length;
    s.laborPaused = s.laborPaused ?? [];
    if (p.data < 40 && harvesters < 4) {
      const victim = buildings.filter(b => b.built && b.active && (b.type === 'rig' || b.type === 'compiler')).sort((a, b) => (a.type === 'rig' ? 0 : 1) - (b.type === 'rig' ? 0 : 1) || b.id - a.id)
        .find(b => b.type === 'rig' || buildings.filter(c => c.type === 'compiler' && c.active).length > 1);
      if (victim) { cmd({ t: 'toggleActive', building: victim.id }); s.laborPaused.push(victim.id); }
    } else if (p.data > 180 && s.laborPaused.length) {
      const id = s.laborPaused.pop()!; const b = w.get(id); if (b && !b.active) cmd({ t: 'toggleActive', building: id });
    }

    // ---------- runners ----------
    const opBuildings = buildings.filter(b => B.buildings[b.type].operator).length;
    const runnerTarget = Math.min(18, 7 + opBuildings + 2);
    const caps = w.caps(pid);
    const memFree = caps.memory - w.memUsed(pid);
    if (runners.length < runnerTarget && core.queue!.length < 2 && p.code >= 30 && memFree >= 1 && w.canAfford(pid, B.units.runner.cost)) cmd({ t: 'train', building: core.id, unit: 'runner' });

    // ---------- build plan (rebuilds losses automatically) ----------
    const sites = buildings.filter(b => !b.built);
    if (sites.length === 0) {
      const plan = [...(s.plan ?? PLAN)];
      // adapt: convert surplus Data into Code; spend surplus Hash on defence
      if (!s.plan && count('grid') > 0) {
        if (p.data > 0.8 * caps.dataCap && p.code < 60 && count('compiler') < 5) plan.unshift(['compiler', count('compiler') + 1]);
        if (p.hash > 450 && count('tower') < 4) plan.unshift(['tower', count('tower') + 1]);
        if (memFree <= 3 && count('bank') < 7) plan.unshift(['bank', count('bank') + 1]);
      }
      for (const [type, n] of plan) {
        if (count(type) >= n) continue;
        const d = B.buildings[type];
        if (type === 'bank' && memFree > 4) continue; // not needed yet
        if (!w.canAfford(pid, d.cost)) break;               // save up for it
        const spot = this.findSpot(w, core, type, enemyCore);
        if (!spot) continue;
        const builders = this.pickRunners(w, runners, core, 2);
        const r = cmd({ t: 'place', building: type, tx: spot.x, ty: spot.y, ids: builders.map(b => b.id) });
        if (r.ok) break;
      }
    } else {
      for (const site of sites) {
        const onIt = runners.filter(u => u.order?.type === 'build' && u.order.target === site.id).length;
        if (onIt < 2) { const extra = this.pickRunners(w, runners, site, 2 - onIt, true); if (extra.length) cmd({ t: 'assist', ids: extra.map(e => e.id), target: site.id }); }
      }
    }

    // ---------- military production ----------
    const grid = buildings.find(b => b.type === 'grid' && b.built);
    let reserve = 0;
    if (grid && !s.noMilitary) {
      reserve = grid.queue!.filter(q => !q.started && B.units[q.unit].needsRunner).length;
      if (grid.queue!.length < 2) {
        const comp = s.comp ?? COMP;
        const want = comp[s.compIdx % comp.length];
        const ud = B.units[want];
        if (w.canAfford(pid, ud.cost) && p.code > (ud.cost.code ?? 0) + 35) {
          const r = cmd({ t: 'train', building: grid.id, unit: want });
          if (r.ok) { s.compIdx++; reserve++; }
        }
      }
      if (!grid.rally) cmd({ t: 'rally', building: grid.id, x: core.x + (enemyCore.x - core.x) * 0.12, y: core.y + (enemyCore.y - core.y) * 0.12 });
    }

    // ---------- idle runners: build > harvest, keeping a reserve for specialization ----------
    const idle = runners.filter(u => u.order?.type === 'idle' && !u.suspended);
    let kept = 0;
    const harvestCount = new Map<number, number>();
    for (const u of runners) if (u.order?.type === 'harvest' && u.order.target) harvestCount.set(u.order.target, (harvestCount.get(u.order.target) ?? 0) + 1);
    for (const u of idle) {
      if (kept < reserve) { kept++; continue; }
      const well = this.pickWell(w, pid, core, harvestCount);
      if (well) { cmd({ t: 'harvest', ids: [u.id], target: well.id }); harvestCount.set(well.id, (harvestCount.get(well.id) ?? 0) + 1); }
    }

    // ---------- scouting ----------
    if (s.scoutPhase === 0) {
      const ping = army.find(u => u.type === 'ping');
      if (ping) { s.scoutId = ping.id; s.scoutPhase = 1; cmd({ t: 'move', ids: [ping.id], x: enemyCore.x + (core.x - enemyCore.x) * 0.25, y: enemyCore.y + (core.y - enemyCore.y) * 0.25 }); }
    } else if (s.scoutPhase === 1) {
      const ping = w.get(s.scoutId);
      if (!ping) s.scoutPhase = 2;
      else if (ping.order?.type === 'idle') { s.scoutPhase = 2; cmd({ t: 'move', ids: [ping.id], x: core.x + 3, y: core.y - 3 }); }
    }
    const fighters = army.filter(u => !(s.scoutPhase === 1 && u.id === s.scoutId));

    // ---------- defense ----------
    const attackSet = new Set(s.attackIds);
    if (underAttack) {
      let nearest = threats[0], nd = 1e9;
      for (const t of threats) { const d = (t.x - core.x) ** 2 + (t.y - core.y) ** 2; if (d < nd) { nd = d; nearest = t; } }
      const home = fighters.filter(u => !attackSet.has(u.id) && (u.order?.type === 'idle' || u.order?.type === 'move'));
      if (home.length) cmd({ t: 'attackMove', ids: home.map(u => u.id), x: nearest.x, y: nearest.y });
      const nearCore = threats.filter(t => (t.x - core.x) ** 2 + (t.y - core.y) ** 2 < 10 * 10).length;
      if (s.attacking && nearCore >= 3) { s.attacking = false; cmd({ t: 'attackMove', ids: s.attackIds, x: nearest.x, y: nearest.y }); s.attackIds = []; }
    }

    // ---------- attack waves ----------
    const d = B.ai[s.difficulty] ?? B.ai.normal;
    if (!s.attacking && !s.noAttack) {
      const avail = fighters.filter(u => u.type !== 'ping');
      const capped = memFree < 2 && avail.length >= Math.ceil(s.waveSize * 0.6);
      if (w.tick >= s.nextWaveTick && (avail.length >= s.waveSize || capped) && !underAttack) {
        s.attacking = true; s.attackIds = avail.map(u => u.id); s.launched = avail.length;
        s.nextWaveTick = w.tick + d.waveIntervalSec * B.tickRate; s.waveSize += d.waveGrowth;
        cmd({ t: 'attackMove', ids: s.attackIds, x: enemyCore.x, y: enemyCore.y });
      }
    } else {
      const alive = s.attackIds.filter(id => w.get(id));
      s.attackIds = alive;
      if (alive.length < Math.max(1, Math.ceil(s.launched * 0.3))) {
        s.attacking = false;
        if (alive.length) cmd({ t: 'move', ids: alive, x: core.x + 2, y: core.y - 2 });
        s.attackIds = [];
      } else {
        const idleAtk = alive.map(id => w.get(id)!).filter(u => u.order?.type === 'idle');
        if (idleAtk.length) cmd({ t: 'attackMove', ids: idleAtk.map(u => u.id), x: enemyCore.x, y: enemyCore.y });
        // commander power: fork engaged attackers
        const engaged = alive.map(id => w.get(id)!).filter(u => u.engaged);
        if (engaged.length >= 3 && w.tick >= p.forkReadyTick && p.hash >= (B.fork.cost.hash ?? 0) + 40) cmd({ t: 'fork', ids: engaged.map(u => u.id) });
      }
    }
  }

  private pickRunners(w: World, runners: Entity[], near: Entity, n: number, _excludeBuilders = false): Entity[] {
    const cands = runners.filter(u => !u.suspended && (u.order?.type === 'idle' || u.order?.type === 'harvest'));
    cands.sort((a, b) => ((a.x - near.x) ** 2 + (a.y - near.y) ** 2) - ((b.x - near.x) ** 2 + (b.y - near.y) ** 2) || a.id - b.id);
    return cands.slice(0, n);
  }

  private pickWell(w: World, pid: number, core: Entity, counts: Map<number, number>): Entity | undefined {
    const p = w.players[pid];
    let best: Entity | undefined, bs = 1e9;
    for (const e of w.entities) {
      if (e.kind !== 'well' || e.dead) continue;
      if (!p.explored[Math.floor(e.y) * w.map.w + Math.floor(e.x)]) continue;
      const d = Math.sqrt((e.x - core.x) ** 2 + (e.y - core.y) ** 2);
      if (d > 26) continue;
      const s = d + (counts.get(e.id) ?? 0) * 4;
      if (s < bs) { bs = s; best = e; }
    }
    return best;
  }

  private findSpot(w: World, core: Entity, type: string, enemyCore: { x: number; y: number }): { x: number; y: number } | undefined {
    const d = B.buildings[type];
    const pid = this.s.pid;
    let ax = core.x, ay = core.y;
    if (type === 'tower') { const dx = enemyCore.x - core.x, dy = enemyCore.y - core.y, l = Math.sqrt(dx * dx + dy * dy); ax += dx / l * 6; ay += dy / l * 6; }
    const cands: { x: number; y: number; s: number }[] = [];
    for (let ty = Math.floor(ay) - 12; ty <= Math.floor(ay) + 12; ty++) for (let tx = Math.floor(ax) - 12; tx <= Math.floor(ax) + 12; tx++) {
      const cx = tx + d.w / 2, cy = ty + d.h / 2;
      const s = (cx - ax) ** 2 + (cy - ay) ** 2;
      if (type !== 'tower' && s < 9) continue;
      cands.push({ x: tx, y: ty, s });
    }
    cands.sort((a, b) => a.s - b.s || a.y - b.y || a.x - b.x);
    for (const c of cands) {
      // keep a one-tile lane around every structure
      let clear = true;
      for (let y = c.y - 1; y <= c.y + d.h && clear; y++) for (let x = c.x - 1; x <= c.x + d.w; x++) {
        if (!w.nav.inBounds(x, y)) { clear = false; break; }
        const i = w.nav.idx(x, y);
        if (w.nav.block[i] || w.nav.terrain[i]) { clear = false; break; }
      }
      if (!clear) continue;
      // keep clear of wells
      if (w.entities.some(e => e.kind === 'well' && !e.dead && e.x > c.x - 2 && e.x < c.x + d.w + 2 && e.y > c.y - 2 && e.y < c.y + d.h + 2)) continue;
      if (canPlace(w, pid, type, c.x, c.y).ok) return c;
    }
    return undefined;
  }
}
