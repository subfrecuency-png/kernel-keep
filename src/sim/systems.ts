// Simulation systems: economy, buildings, units (orders, movement, combat), separation, fog.
// Deterministic: iteration is in entity-id order, randomness only through world.rng,
// and only + - * / sqrt floating-point operations are used (squares via multiplication, no Math.pow/trig).
import { B, DT, Entity, AttackDef } from './types.ts';
import { World } from './world.ts';

/** Square via multiplication (exactly rounded everywhere; avoids Math.pow). */
const sq = (v: number) => v * v;

const EC = B.economy;

// =====================================================================
// Economy: code upkeep, rations, stability, crashes, caps, warnings
// =====================================================================
export function stepEconomy(w: World) {
  for (const p of w.players) {
    if (p.id === 0 || p.defeated) continue;
    const core = w.coreOf(p.id);
    if (core) p.code += EC.coreCodeTrickle * DT;
    // upkeep demand
    let upkeep = 0;
    for (const e of w.entities) if (e.kind === 'unit' && e.owner === p.id && !e.dead && !e.suspended && !e.forkOf) upkeep += B.units[e.type].upkeep;
    const r = EC.rations[p.ration];
    const need = upkeep * r.mult / EC.upkeepCycleSec * DT;
    let unmetFrac = 0;
    if (need > 0) {
      if (p.code >= need) { p.code -= need; p.stats.codeConsumed += need; }
      else { unmetFrac = (need - p.code) / need; p.stats.codeConsumed += p.code; p.code = 0; }
    }
    p.unmet = p.unmet * 0.95 + unmetFrac * 0.05;
    // stability drifts toward its target
    let target = EC.stabilityBase + r.stability - EC.starvationPenalty * p.unmet;
    target = Math.max(0, Math.min(100, target));
    const step = EC.stabilityRatePerSec * DT;
    if (p.stability < target) p.stability = Math.min(target, p.stability + step);
    else p.stability = Math.max(target, p.stability - step);
    // staged consequence: crashes (programs auto-suspend, which also stops their upkeep)
    if (p.stability < EC.crashThreshold) {
      p.crashT += DT;
      if (p.crashT >= EC.crashIntervalSec) { p.crashT = 0; crashOne(w, p.id); }
    } else p.crashT = 0;
    // caps
    const caps = w.caps(p.id);
    if (p.data > caps.dataCap) p.data = caps.dataCap;
    if (p.code > caps.codeCap) p.code = caps.codeCap;
    if (p.hash > caps.hashCap) p.hash = caps.hashCap;
    // warnings, once per second
    if (w.tick % B.tickRate === 0) economyWarnings(w, p.id, upkeep * r.mult / EC.upkeepCycleSec);
  }
}

function crashOne(w: World, pid: number) {
  // Priority: idle runners, then harvesting runners, then operators, then combat programs.
  const cands = w.entities.filter(e => e.kind === 'unit' && e.owner === pid && !e.dead && !e.suspended && !e.forkOf);
  if (!cands.length) return;
  const rank = (e: Entity) => e.type !== 'runner' ? 3 : e.order?.type === 'idle' ? 0 : e.order?.type === 'operate' ? 2 : 1;
  const minR = Math.min(...cands.map(rank));
  const pool = cands.filter(e => rank(e) === minR);
  const u = pool[w.rng.int(pool.length)];
  u.suspended = true; u.crashed = true; u.path = undefined;
  w.players[pid].stats.crashes++;
  w.alert(pid, 'crash', `A ${B.units[u.type].name} crashed from low Stability and suspended itself. Feed Code, then Resume it.`, 'danger', u.x, u.y, 1);
}

export function codeIncomeRate(w: World, pid: number): number {
  let r = w.coreOf(pid) ? EC.coreCodeTrickle : 0;
  const ws = w.workSpeed(pid);
  for (const b of w.entities) {
    if (b.kind !== 'building' || b.owner !== pid || !b.built || b.dead || !b.active) continue;
    const c = B.buildings[b.type].cycle;
    if (c && w.operatorPresent(b)) r += (c.out.code ?? 0) / c.time * ws;
  }
  return r;
}

function economyWarnings(w: World, pid: number, drain: number) {
  const p = w.players[pid];
  const net = codeIncomeRate(w, pid) - drain;
  if (p.code < 0.5 && drain > 0 && p.unmet > 0.02) {
    w.alert(pid, 'starving', 'Programs are starving: Code has run out. Build/staff Compilers, switch to Lean rations, or Suspend idle programs.', 'danger');
  } else if (net < 0 && p.code / -net < EC.lowCodeWarnSec) {
    w.alert(pid, 'lowcode', `Code reserve low: about ${Math.ceil(p.code / -net)}s left at this rate.`, 'warn', undefined, undefined, 15);
  }
  const eff = w.computeEff(pid);
  if (eff < 1) w.alert(pid, 'brownout', `Brownout: Compute demand exceeds supply — rigs, towers and training run at ${Math.round(eff * 100)}%.`, 'warn', undefined, undefined, 20);
}

// =====================================================================
// Buildings: production, mining, training, towers, operator staffing
// =====================================================================
export function stepBuildings(w: World) {
  const effCache = new Map<number, number>();
  const eff = (pid: number) => { let v = effCache.get(pid); if (v === undefined) { v = w.computeEff(pid); effCache.set(pid, v); } return v; };
  const wsCache = new Map<number, number>();
  const ws = (pid: number) => { let v = wsCache.get(pid); if (v === undefined) { v = w.workSpeed(pid); wsCache.set(pid, v); } return v; };
  const staff = w.tick % 10 === 0;
  const rigRank = new Map<number, number>();

  for (const b of w.entities) {
    if (b.kind !== 'building' || b.dead || !b.built) continue;
    const d = B.buildings[b.type];
    const p = w.players[b.owner];
    b.stall = undefined;
    // --- operator bookkeeping ---
    if (d.operator) {
      const op = w.get(b.operator);
      if (!op || op.order?.type !== 'operate' || op.order.target !== b.id) b.operator = undefined;
      if (!b.active) {
        if (op && op.order?.type === 'operate' && op.order.target === b.id) op.order = { type: 'idle' };
        b.operator = undefined;
      } else if (!b.operator) {
        b.stall = 'noOperator';
        if (staff) assignOperator(w, b);
      } else if (!w.operatorPresent(b)) b.stall = op?.suspended ? 'operatorSuspended' : 'operatorWalking';
    }
    if (!b.active) { b.stall = 'paused'; continue; }
    // --- compiler cycle ---
    if (d.cycle && w.operatorPresent(b)) {
      if (b.timer! < d.cycle.time) b.timer! += DT * ws(b.owner);
      if (b.timer! >= d.cycle.time) {
        const caps = w.caps(b.owner);
        const out = d.cycle.out.code ?? 0;
        if (!w.canAfford(b.owner, d.cycle.in)) { b.stall = 'noData'; w.alert(b.owner, 'compilerData', 'A Compiler is idle: not enough Data to compile Code.', 'warn', b.x, b.y, 20); }
        else if (p.code + out > caps.codeCap) { b.stall = 'codeFull'; }
        else {
          w.pay(b.owner, d.cycle.in); p.code += out; p.stats.codeProduced += out; b.timer! -= d.cycle.time;
          w.events.push({ t: 'produce', id: b.id, owner: b.owner, res: 'code' });
        }
      }
    }
    // --- mining ---
    if (d.mining && w.operatorPresent(b)) {
      const k = rigRank.get(b.owner) ?? 0; rigRank.set(b.owner, k + 1);
      let rate = EC.miningBaseRate;
      for (let i = 0; i < k; i++) rate *= EC.miningFalloff;
      const gain = rate * eff(b.owner) * ws(b.owner) * DT;
      if (p.hash + gain > EC.hashCap) { b.stall = 'hashFull'; w.alert(b.owner, 'hashFull', 'Hash vault full (600). Spend Hash Credits on training or towers.', 'info', b.x, b.y, 30); }
      const before = p.hash; p.hash = Math.min(EC.hashCap, p.hash + gain); p.stats.hashMined += p.hash - before;
      b.timer! += DT; if (b.timer! >= 2) { b.timer = 0; w.events.push({ t: 'produce', id: b.id, owner: b.owner, res: 'hash' }); }
    }
    // --- training queue ---
    if (d.trains && b.queue!.length) stepQueue(w, b, d.computeWhileTraining ? eff(b.owner) : 1, ws(b.owner));
    // --- tower ---
    if (d.attack) {
      if (b.cd! > 0) b.cd! -= DT * eff(b.owner);
      if (b.cd! <= 0) {
        const t = acquire(w, b, d.attack.range, d.attack, true);
        if (t) { fire(w, b, t, d.attack, 1); b.cd = d.attack.cd; }
      }
    }
  }
}


/** Nearest available Runner: idle first, then harvesters (empty-handed preferred). Builders, repairers and operators are never pulled. */
export function pickLaborer(w: World, owner: number, x: number, y: number): Entity | undefined {
  let best: Entity | undefined, bs = 1e18;
  for (const u of w.entities) {
    if (u.kind !== 'unit' || u.dead || u.owner !== owner || u.type !== 'runner' || u.suspended || u.forkOf) continue;
    const t = u.order?.type;
    if (t !== 'idle' && t !== 'harvest') continue;
    const s = (t === 'idle' ? 0 : 1e6 + (u.carry ?? 0) * 1e4) + sq(u.x - x) + sq(u.y - y);
    if (s < bs) { bs = s; best = u; }
  }
  return best;
}

function assignOperator(w: World, b: Entity) {
  const best = pickLaborer(w, b.owner, b.x, b.y);
  if (!best) { w.alert(b.owner, 'noOperator', `${B.buildings[b.type].name} needs an operator: no free Runner. Compile more Runners at the Core.`, 'warn', b.x, b.y, 25); return; }
  best.order = { type: 'operate', target: b.id, phase: 'go' }; best.path = undefined;
  b.operator = best.id;
}

function stepQueue(w: World, b: Entity, eff: number, ws: number) {
  const q = b.queue![0];
  const ud = B.units[q.unit];
  const p = w.players[b.owner];
  if (!q.started) {
    const caps = w.caps(b.owner);
    const used = w.memUsed(b.owner);
    let runner: Entity | undefined;
    if (ud.needsRunner) {
      runner = pickLaborer(w, b.owner, b.x, b.y);
      if (!runner) { b.stall = 'needRunner'; w.alert(b.owner, 'needRunner', `${B.buildings[b.type].name}: waiting for a free Runner (idle or harvesting) to specialize.`, 'info', b.x, b.y, 20); return; }
    }
    const freed = runner ? B.units.runner.mem : 0;
    if (used - freed + ud.mem > caps.memory) { b.stall = 'memFull'; w.alert(b.owner, 'memFull', 'Memory full: build a Memory Bank to raise the program limit.', 'warn', b.x, b.y, 20); return; }
    if (runner) { runner.dead = true; w.byId.delete(runner.id); q.consumedRunner = true; w.events.push({ t: 'death', id: runner.id, x: runner.x, y: runner.y, owner: runner.owner, kind: 'unit', type: 'absorbed' }); }
    q.started = true;
  }
  if (q.progress < ud.time) { q.progress += DT * eff * ws; b.stall = eff < 1 ? 'brownout' : undefined; }
  if (q.progress >= ud.time) {
    q.progress = ud.time;
    const t = w.freeTileNear(b, b.owner);
    if (t < 0) { q.blocked = true; b.stall = 'spawnBlocked'; w.alert(b.owner, 'spawnBlocked', `${B.buildings[b.type].name}: spawn blocked — clear space around it.`, 'warn', b.x, b.y, 15); return; }
    q.blocked = false;
    const u = w.spawnUnit(q.unit, b.owner, (t % w.map.w) + 0.5, Math.floor(t / w.map.w) + 0.5);
    p.stats.unitsTrained++;
    b.queue!.shift();
    if (b.rally) issueMove(w, u, b.rally.x, b.rally.y, u.type === 'runner' ? 'move' : 'attackMove');
  }
}

// =====================================================================
// Units
// =====================================================================
export function issueMove(w: World, u: Entity, x: number, y: number, type: 'move' | 'attackMove') {
  u.order = { type, x, y }; u.engaged = undefined; u.path = undefined; u.stuckN = 0;
}

/** Per-tick A* budget (node expansions). Requests over budget are deferred to a later tick: the unit waits. */
export const PATH_BUDGET = 12000;

export function setPath(w: World, u: Entity, goal: number[], breach: boolean) {
  u.pathGoal = goal; u.pathBreach = breach;
  if (w.nav.spent >= PATH_BUDGET) { u.path = []; u.pathI = 0; u.pathPartial = false; u.pathDeferred = true; return; }
  const r = w.nav.findPath(Math.floor(u.x), Math.floor(u.y), goal, u.owner, breach);
  u.path = r.tiles; u.pathI = 0; u.pathPartial = r.partial; u.pathBreach = r.breach; u.pathDeferred = false;
  u.navVer = w.nav.version; u.repathT = 5; u.stuckT = 0; u.lastX = u.x; u.lastY = u.y;
}

type MoveResult = 'arrived' | 'moving' | { blockedBy: number };

/** Advance along the current path. Handles repath on nav changes and obstruction. */
function followPath(w: World, u: Entity, speedMult = 1): MoveResult {
  if (!u.path) return 'arrived';
  if (u.pathDeferred) {
    setPath(w, u, u.pathGoal!, !!u.pathBreach);
    if (u.pathDeferred) return 'moving'; // still waiting for budget
  }
  if (u.repathT! > 0) u.repathT!--;
  // Nav changed (gate toggled, wall built/destroyed): re-plan partial paths or paths now crossing blocked tiles.
  if (u.navVer !== w.nav.version && u.repathT! <= 0 && u.pathGoal) {
    let needs = !!u.pathPartial;
    if (!needs) for (let i = u.pathI!; i < u.path.length; i++) if (!w.nav.passable(u.path[i], u.owner)) { needs = true; break; }
    u.navVer = w.nav.version;
    if (needs) setPath(w, u, u.pathGoal, !!u.pathBreach);
  }
  if (u.pathI! >= u.path.length) {
    // final approach to exact point for move orders
    if (u.order && (u.order.type === 'move' || u.order.type === 'attackMove') && u.order.x !== undefined && !u.pathPartial) {
      const tx = Math.floor(u.order.x), ty = Math.floor(u.order.y!);
      if (Math.floor(u.x) === tx && Math.floor(u.y) === ty) {
        const dx = u.order.x - u.x, dy = u.order.y! - u.y, dist = Math.sqrt(dx * dx + dy * dy);
        const step = B.units[u.type].speed * speedMult * DT;
        if (dist > step + 1e-6) { u.x += dx / dist * step; u.y += dy / dist * step; return 'moving'; }
        u.x = u.order.x; u.y = u.order.y!;
      }
    }
    u.path = undefined; return 'arrived';
  }
  const next = u.path[u.pathI!];
  if (!w.nav.passable(next, u.owner)) {
    const bid = w.nav.block[next];
    if (bid && w.nav.blockOwner[next] !== u.owner && u.pathBreach) return { blockedBy: bid };
    if (u.repathT! <= 0 && u.pathGoal) setPath(w, u, u.pathGoal, !!u.pathBreach);
    else if (u.repathT! > 0) return 'moving';
    if (!u.path || u.path.length === 0) { u.path = undefined; return 'arrived'; }
    return 'moving';
  }
  const nx = (next % w.map.w) + 0.5, ny = Math.floor(next / w.map.w) + 0.5;
  const dx = nx - u.x, dy = ny - u.y, dist = Math.sqrt(dx * dx + dy * dy);
  const step = B.units[u.type].speed * speedMult * DT;
  if (dist <= step + 1e-6) { u.x = nx; u.y = ny; u.pathI!++; } // epsilon: mirrored float paths must arrive on the same tick
  else { u.x += dx / dist * step; u.y += dy / dist * step; }
  // stuck detection
  u.stuckT = (u.stuckT ?? 0) + 1;
  if (u.stuckT >= 20) {
    const moved = Math.sqrt(sq(u.x - u.lastX!) + sq(u.y - u.lastY!));
    u.stuckT = 0; u.lastX = u.x; u.lastY = u.y;
    if (moved < 0.3 && u.pathGoal) {
      u.stuckN = (u.stuckN ?? 0) + 1;
      if (u.stuckN >= 4) { u.stuckN = 0; u.path = undefined; return 'arrived'; }
      const t = w.nav.nearestPassable(u.x, u.y, u.owner, 3);
      if (t >= 0 && t !== Math.floor(u.y) * w.map.w + Math.floor(u.x)) { u.x = (t % w.map.w) + 0.5; u.y = Math.floor(t / w.map.w) + 0.5; }
      setPath(w, u, u.pathGoal, !!u.pathBreach);
    } else u.stuckN = 0;
  }
  return 'moving';
}

function isEnemy(a: Entity, b: Entity) { return a.owner !== b.owner && a.owner !== 0 && b.owner !== 0; }

/** Find the best target for attacker a within radius r (fog-limited). */
export function acquire(w: World, a: Entity, r: number, atk: AttackDef, unitsOnly = false): Entity | undefined {
  let best: Entity | undefined, bs = 1e9;
  const siege = !!atk.siege;
  const minR = atk.minRange ?? 0;
  w.unitsNear(a.x, a.y, r + 1, e => {
    if (e.dead || !isEnemy(a, e)) return;
    const d = w.distTo(a.x, a.y, e);
    if (d > r || d < minR) return;
    if (!w.canSee(a.owner, e)) return;
    const s = d + (siege ? 4 : 0);
    if (s < bs || (s === bs && best && e.id < best.id)) { bs = s; best = e; }
  });
  if (!unitsOnly) {
    for (const e of w.entities) {
      if (e.kind !== 'building' || e.dead || !isEnemy(a, e)) continue;
      const bd = B.buildings[e.type];
      if ((bd.wall || bd.gate) && !siege) continue; // walls are breached via pathing, not auto-targeted
      const d = w.distTo(a.x, a.y, e);
      if (d > r) continue; // minimum range applies to programs only
      if (!w.canSee(a.owner, e)) continue;
      const s = d + (siege ? 0 : 3);
      if (s < bs || (s === bs && best && e.id < best.id)) { bs = s; best = e; }
    }
  }
  return best;
}

function fire(w: World, a: Entity, t: Entity, atk: AttackDef, rankMult: number) {
  let dmg = atk.dmg * rankMult;
  if (t.kind === 'building') {
    const bd = B.buildings[t.type];
    dmg *= bd.hardened ? (atk.vsHardened ?? 0.25) : 1;
  } else {
    dmg *= atk.vsUnits ?? 1;
    dmg = Math.max(1, dmg - B.units[t.type].armor);
  }
  // Simultaneous resolution: damage is queued and applied once per tick in applyHits(), so the
  // entity that happens to be processed first in a tick gains no first-strike advantage.
  w.hits.push({ target: t.id, from: a.id, amount: dmg });
  w.events.push({ t: 'shot', from: a.id, to: t.id, x1: a.x, y1: a.y, x2: t.x, y2: t.y, owner: a.owner, siege: atk.siege });
  if (t.owner !== 0) w.alert(t.owner, 'attacked', t.kind === 'building' ? `${B.buildings[t.type].name} under attack!` : 'Your programs are under attack!', 'danger', t.x, t.y, 12);
}

/**
 * Apply every hit and heal queued this tick at once (order-independent). Net change per target is
 * summed; a target at or below 0 dies, credited to the attacker that dealt it the most damage this
 * tick (ties → lower id). Heals cannot lift a target that took lethal net damage.
 */
export function applyHits(w: World) {
  if (!w.hits.length) return;
  const net = new Map<number, { dmg: number; heal: number; by: Map<number, number> }>();
  for (const h of w.hits) {
    let n = net.get(h.target); if (!n) { n = { dmg: 0, heal: 0, by: new Map() }; net.set(h.target, n); }
    if (h.amount >= 0) { n.dmg += h.amount; n.by.set(h.from, (n.by.get(h.from) ?? 0) + h.amount); } else n.heal -= h.amount;
  }
  w.hits = [];
  for (const id of [...net.keys()].sort((a, b) => a - b)) {
    const t = w.get(id); if (!t) continue;
    const n = net.get(id)!;
    t.hp = Math.min(t.maxHp, t.hp - n.dmg + n.heal);
    if (t.hp <= 0 && n.dmg > 0) {
      let killer = 0, best = -1;
      for (const [from, d] of n.by) if (d > best || (d === best && from < killer)) { best = d; killer = from; }
      w.kill(t, w.get(killer));
    } else if (t.hp <= 0) t.hp = 1;
  }
}

/** Engage target t: attack if in range, else move toward it. Returns false if the target is invalid. */
function combat(w: World, u: Entity, t: Entity, allowChase: boolean): boolean {
  const ud = B.units[u.type];
  const atk = ud.attack!;
  const d = w.distTo(u.x, u.y, t);
  const minR = atk.minRange ?? 0;
  if (t.kind === 'unit' && d < minR) return false;
  if (d <= atk.range) {
    u.path = undefined;
    if (u.cd! <= 0) { fire(w, u, t, atk, 1 + (u.rank ?? 0) * B.veterancy.bonusPerRank); u.cd = atk.cd; }
    return true;
  }
  if (!allowChase) return false;
  // chase: re-plan periodically toward a moving target, breaching walls when no open route exists
  if (!u.path || (u.repathT! <= 0 && t.kind === 'unit')) {
    setPath(w, u, w.goalFor(t), false);
    if (u.pathPartial && !u.pathDeferred) setPath(w, u, w.goalFor(t), true);
    u.repathT = 10;
  }
  const res = followPath(w, u);
  if (typeof res === 'object') { const blk = w.get(res.blockedBy); if (blk) u.engaged = blk.id; }
  return true;
}

export function stepUnits(w: World) {
  const ents = w.entities;
  for (let k = 0; k < ents.length; k++) {
    const u = ents[k];
    if (u.kind !== 'unit' || u.dead) continue;
    if (u.forkOf && u.expires !== undefined && w.tick >= u.expires) { w.kill(u); continue; }
    if (u.suspended) continue;
    const ud = B.units[u.type];
    if (u.cd! > 0) u.cd = Math.max(0, u.cd! - DT); // cooldowns are in seconds
    const o = u.order ?? (u.order = { type: 'idle' });
    // ---- support heal ----
    if (ud.heal && (o.type === 'idle' || o.type === 'attackMove' || o.type === 'hold')) {
      if (healStep(w, u, o.type !== 'hold')) continue;
    }
    // ---- engaged target (auto or breach) ----
    if (ud.attack && u.engaged) {
      const t = w.get(u.engaged);
      const valid = t && isEnemy(u, t) && w.canSee(u.owner, t) && (o.type !== 'hold' || w.distTo(u.x, u.y, t) <= ud.attack.range);
      if (valid && combat(w, u, t!, o.type !== 'hold')) continue;
      u.engaged = undefined; u.path = undefined;
    }
    // ---- auto-acquire (staggered every 3 ticks) ----
    if (ud.attack && ud.autoAttack && (o.type === 'idle' || o.type === 'attackMove' || o.type === 'hold') && (w.tick + u.id) % 3 === 0) {
      const t = acquire(w, u, o.type === 'hold' ? ud.attack.range : ud.sight, ud.attack);
      if (t) { u.engaged = t.id; u.path = undefined; combat(w, u, t, o.type !== 'hold'); continue; }
    }
    switch (o.type) {
      case 'idle': case 'hold': break;
      case 'move': case 'attackMove': {
        if (o.x === undefined) { u.order = { type: 'idle' }; break; }
        const goal = [Math.floor(o.x), Math.floor(o.y!), Math.floor(o.x), Math.floor(o.y!)];
        const canBreach = o.type === 'attackMove' && !!ud.attack;
        if (!u.path) {
          setPath(w, u, goal, false);
          // no open route: attack-moving programs chew through enemy structures instead
          if (u.pathPartial && canBreach && !u.pathDeferred) setPath(w, u, goal, true);
        }
        const r = followPath(w, u);
        if (typeof r === 'object') { if (canBreach) u.engaged = r.blockedBy; else { u.order = { type: 'idle' }; u.path = undefined; } }
        else if (r === 'arrived') {
          if (canBreach && u.pathPartial && !u.pathBreach) { setPath(w, u, goal, true); if (u.path!.length) break; }
          u.order = { type: 'idle' }; u.path = undefined;
        }
        break;
      }
      case 'attack': {
        const t = w.get(o.target);
        if (!t || !isEnemy(u, t) || !w.canSee(u.owner, t) || !ud.attack) { u.order = { type: 'idle' }; u.path = undefined; break; }
        combat(w, u, t, true);
        break;
      }
      case 'harvest': harvestStep(w, u, o); break;
      case 'build': buildStep(w, u, o); break;
      case 'repair': repairStep(w, u, o); break;
      case 'operate': operateStep(w, u, o); break;
    }
  }
}

function approach(w: World, u: Entity, t: Entity, reach: number): 'there' | 'moving' | 'fail' {
  if (w.distTo(u.x, u.y, t) <= reach) { u.path = undefined; return 'there'; }
  if (!u.path) {
    setPath(w, u, w.goalFor(t), false);
    if (u.pathPartial && u.path!.length === 0) { u.path = undefined; return 'fail'; }
  }
  const r = followPath(w, u);
  if (r === 'arrived') {
    if (w.distTo(u.x, u.y, t) <= reach) return 'there';
    // Final approach: step straight toward the nearest point of the target if that stays on open ground.
    let px = t.x, py = t.y;
    if (t.kind === 'building') { px = Math.max(t.tx!, Math.min(t.tx! + t.w!, u.x)); py = Math.max(t.ty!, Math.min(t.ty! + t.h!, u.y)); }
    const dx = px - u.x, dy = py - u.y, dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1e-6 && dist < 2.5) {
      const step = Math.min(dist, B.units[u.type].speed * DT);
      const nx = u.x + dx / dist * step, ny = u.y + dy / dist * step;
      if (w.nav.passableXY(Math.floor(nx), Math.floor(ny), u.owner)) { u.x = nx; u.y = ny; u.path = []; u.pathI = 0; return 'moving'; }
    }
    u.path = undefined;
    u.stuckN = (u.stuckN ?? 0) + 1;
    if (u.stuckN > 3) { u.stuckN = 0; return 'fail'; }
  }
  return 'moving';
}

function nearestWell(w: World, u: Entity, maxD: number): Entity | undefined {
  let best: Entity | undefined, bd = maxD * maxD;
  for (const e of w.entities) {
    if (e.kind !== 'well' || e.dead) continue;
    const d = sq(e.x - u.x) + sq(e.y - u.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nearestDropoff(w: World, u: Entity): Entity | undefined {
  let best: Entity | undefined, bd = 1e9;
  for (const e of w.entities) {
    if (e.kind !== 'building' || e.dead || !e.built || e.owner !== u.owner || !B.buildings[e.type].dropoff) continue;
    const d = w.distTo(u.x, u.y, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function harvestStep(w: World, u: Entity, o: NonNullable<Entity['order']>) {
  const p = w.players[u.owner];
  if (!o.phase) o.phase = u.carry! > 0 ? 'toDrop' : 'toWell';
  if (o.phase === 'toWell') {
    let well = w.get(o.target);
    if (!well) {
      well = nearestWell(w, u, 20);
      if (!well) { u.order = { type: 'idle' }; w.alert(u.owner, 'noWell', 'A Runner has no Data well in reach and went idle.', 'warn', u.x, u.y, 20); return; }
      o.target = well.id; u.path = undefined;
    }
    const r = approach(w, u, well, 0.55);
    if (r === 'there') { o.phase = 'gather'; o.timer = 0; }
    else if (r === 'fail') { o.target = undefined; u.path = undefined; }
  } else if (o.phase === 'gather') {
    const well = w.get(o.target);
    if (!well) { o.phase = 'toWell'; o.target = undefined; return; }
    o.timer! += DT * w.workSpeed(u.owner);
    if (o.timer! >= EC.harvestTimeSec) {
      const amt = Math.min(EC.carry, well.amount!);
      well.amount! -= amt; u.carry = amt;
      if (well.amount! <= 0) { w.kill(well); }
      o.phase = 'toDrop'; u.path = undefined;
    }
  } else if (o.phase === 'toDrop') {
    const drop = nearestDropoff(w, u);
    if (!drop) { u.order = { type: 'idle' }; return; }
    const r = approach(w, u, drop, 0.8);
    if (r === 'there') {
      const cap = w.caps(u.owner).dataCap;
      const dep = Math.max(0, Math.min(u.carry!, cap - p.data));
      if (dep > 0) {
        p.data += dep; u.carry! -= dep; p.stats.dataHarvested += dep;
        w.events.push({ t: 'deposit', id: u.id, owner: u.owner, x: u.x, y: u.y });
      }
      if (u.carry! > 0) { w.alert(u.owner, 'dataFull', 'Data storage full: build a Data Cache or spend Data.', 'warn', drop.x, drop.y, 20); return; }
      o.phase = 'toWell'; u.path = undefined;
    }
  }
}

function buildStep(w: World, u: Entity, o: NonNullable<Entity['order']>) {
  let site = w.get(o.target);
  if (!site || site.built || site.owner !== u.owner) {
    // auto-continue to the nearest unfinished site within 10 tiles (wall lines)
    let best: Entity | undefined, bd = 100;
    for (const e of w.entities) {
      if (e.kind !== 'building' || e.dead || e.built || e.owner !== u.owner) continue;
      const d = sq(e.x - u.x) + sq(e.y - u.y); if (d < bd) { bd = d; best = e; }
    }
    if (!best) { u.order = { type: 'idle' }; u.path = undefined; return; }
    o.target = best.id; site = best; u.path = undefined;
  }
  const r = approach(w, u, site, 0.9);
  if (r === 'fail') { u.order = { type: 'idle' }; w.alert(u.owner, 'unreachable', 'A construction site is unreachable.', 'warn', site.x, site.y, 10); return; }
  if (r !== 'there') return;
  const d = B.buildings[site.type];
  const inc = DT * w.workSpeed(u.owner);
  site.progress! += inc;
  site.hp = Math.min(site.maxHp, site.hp + site.maxHp * 0.9 * inc / d.build);
  if (site.progress! >= d.build) completeBuilding(w, site);
}

export function completeBuilding(w: World, site: Entity) {
  const d = B.buildings[site.type];
  site.built = true; site.progress = d.build;
  if (d.gate && site.open) w.nav.setGate(site.tx!, site.ty!, site.owner);
  w.events.push({ t: 'built', id: site.id, owner: site.owner, type: site.type });
  if (!d.wall) w.alert(site.owner, 'built' + site.type, `${d.name} complete.`, 'info', site.x, site.y, 3);
}

function repairStep(w: World, u: Entity, o: NonNullable<Entity['order']>) {
  const t = w.get(o.target);
  if (!t || t.owner !== u.owner || t.kind !== 'building' || !t.built || t.hp >= t.maxHp) { u.order = { type: 'idle' }; u.path = undefined; return; }
  const r = approach(w, u, t, 0.9);
  if (r === 'fail') { u.order = { type: 'idle' }; return; }
  if (r !== 'there') return;
  const p = w.players[u.owner];
  const heal = Math.min(t.maxHp - t.hp, EC.repairHpPerSec * DT * w.workSpeed(u.owner));
  u.repairAcc = (u.repairAcc ?? 0) + heal;
  while (u.repairAcc >= EC.repairHpPerData) {
    if (p.data < 1) { u.order = { type: 'idle' }; w.alert(u.owner, 'repairData', 'Repairs stopped: no Data.', 'warn', t.x, t.y, 15); return; }
    p.data -= 1; u.repairAcc -= EC.repairHpPerData;
  }
  t.hp += heal;
}

function operateStep(w: World, u: Entity, o: NonNullable<Entity['order']>) {
  const b = w.get(o.target);
  if (!b || b.owner !== u.owner || !b.built || !b.active || (b.operator && b.operator !== u.id)) { u.order = { type: 'idle' }; u.path = undefined; return; }
  b.operator = u.id;
  if (o.phase === 'work') return;
  const r = approach(w, u, b, 0.9);
  if (r === 'there') o.phase = 'work';
  else if (r === 'fail') { u.order = { type: 'idle' }; b.operator = undefined; }
}

function healStep(w: World, u: Entity, allowMove: boolean): boolean {
  const hd = B.units[u.type].heal!;
  const sight = B.units[u.type].sight;
  let best: Entity | undefined, bs = 1e9;
  w.unitsNear(u.x, u.y, sight, e => {
    if (e.dead || e.owner !== u.owner || e.id === u.id || e.hp >= e.maxHp || e.suspended) return;
    const d = w.distTo(u.x, u.y, e);
    if (d > sight) return;
    const s = e.hp / e.maxHp + d * 0.02;
    if (s < bs) { bs = s; best = e; }
  });
  if (!best) for (const e of w.entities) {
    if (e.kind !== 'building' || e.dead || e.owner !== u.owner || !e.built || e.hp >= e.maxHp) continue;
    const d = w.distTo(u.x, u.y, e); if (d > sight) continue;
    const s = 1 + e.hp / e.maxHp + d * 0.02; if (s < bs) { bs = s; best = e; }
  }
  if (!best) return false;
  const t = best as Entity;
  const d = w.distTo(u.x, u.y, t);
  if (d <= hd.range) {
    u.path = undefined;
    if (u.cd! <= 0) {
      w.hits.push({ target: t.id, from: u.id, amount: -hd.amt }); u.cd = hd.cd;
      w.events.push({ t: 'shot', from: u.id, to: t.id, x1: u.x, y1: u.y, x2: t.x, y2: t.y, owner: u.owner, heal: true });
    }
    return true;
  }
  if (!allowMove) return false;
  if (!u.path || u.repathT! <= 0) { setPath(w, u, w.goalFor(t), false); u.repathT = 10; }
  followPath(w, u);
  return true;
}

// =====================================================================
// Separation: soft push so units do not stack; never pushes into blocked tiles.
// =====================================================================
export function stepSeparation(w: World) {
  // Jacobi-style: every push is computed from start-of-step positions and applied afterwards, so the
  // result does not depend on entity-id order (a Gauss-Seidel sweep favoured whichever side was
  // pushed later — see docs/FAIRNESS_RESULTS.md).
  const acc = new Map<Entity, [number, number]>();
  const add = (e: Entity, dx: number, dy: number) => { const a = acc.get(e); if (a) { a[0] += dx; a[1] += dy; } else acc.set(e, [dx, dy]); };
  for (const u of w.cellEnts) {
    if (u.dead) continue;
    const ru = B.units[u.type].radius;
    w.unitsNear(u.x, u.y, 1, v => {
      if (v.id <= u.id || v.dead) return;
      const rv = B.units[v.type].radius;
      const dx = v.x - u.x, dy = v.y - u.y; const dd = dx * dx + dy * dy; const min = ru + rv;
      if (dd >= min * min) return;
      let dist = Math.sqrt(dd); let nx = 1, ny = 0;
      if (dist > 1e-6) { nx = dx / dist; ny = dy / dist; } else { nx = u.owner === 2 ? -1 : 1; ny = 0; dist = 0; } // exact overlap: mirrored fixed axis
      const push = (min - dist) * 0.25;
      add(u, -nx * push, -ny * push);
      add(v, nx * push, ny * push);
    });
  }
  const moved = [...acc.entries()].sort((a, b) => a[0].id - b[0].id);
  for (const [e, [dx, dy]] of moved) tryNudge(w, e, dx, dy);
}
function tryNudge(w: World, u: Entity, dx: number, dy: number) {
  if (u.suspended || (u.order?.type === 'operate' && u.order.phase === 'work')) return;
  const nx = u.x + dx, ny = u.y + dy;
  if (w.nav.passableXY(Math.floor(nx), Math.floor(ny), u.owner)) { u.x = nx; u.y = ny; }
}

// =====================================================================
// Fog of war: radial sight (walls do not block sight in the prototype).
// =====================================================================
export function stepFog(w: World) {
  const W = w.map.w, H = w.map.h;
  for (let pid = 1; pid < w.players.length; pid++) {
    const vis = w.visible[pid]; vis.fill(0);
    const p = w.players[pid];
    for (const e of w.entities) {
      if (e.dead || e.owner !== pid || e.kind === 'well') continue;
      const s = e.kind === 'unit' ? B.units[e.type].sight : B.buildings[e.type].sight;
      const r2 = s * s;
      const x0 = Math.max(0, Math.floor(e.x - s)), x1 = Math.min(W - 1, Math.floor(e.x + s));
      const y0 = Math.max(0, Math.floor(e.y - s)), y1 = Math.min(H - 1, Math.floor(e.y + s));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - e.x, dy = y + 0.5 - e.y;
        if (dx * dx + dy * dy <= r2) { const i = y * W + x; vis[i] = 1; p.explored[i] = 1; }
      }
    }
    // remembered enemy structures ("last seen")
    for (const e of w.entities) {
      if (e.kind !== 'building' || e.dead || e.owner === pid) continue;
      if (w.canSee(pid, e)) p.lastSeen[e.id] = { type: e.type, tx: e.tx!, ty: e.ty!, w: e.w!, h: e.h!, owner: e.owner };
    }
    for (const key of Object.keys(p.lastSeen)) {
      const id = Number(key); const ls = p.lastSeen[id];
      const e = w.byId.get(id);
      if (!e || e.dead) {
        // forget only once we can see the spot is empty
        const cx = ls.tx + Math.floor(ls.w / 2), cy = ls.ty + Math.floor(ls.h / 2);
        if (vis[cy * W + cx]) delete p.lastSeen[id];
      }
    }
  }
}
