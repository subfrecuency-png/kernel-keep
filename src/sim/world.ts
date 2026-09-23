// World state + shared helpers. Authoritative simulation state lives here; the client only reads it.
import { B, Cost, Entity, Player, SimEvent, Alert, Ration, BuildingDef, UnitDef } from './types.ts';
import { Rng } from './rng.ts';
import { Nav } from './nav.ts';
import { buildMap, MapDef } from './map.ts';

/** Square via multiplication (exactly rounded everywhere; avoids Math.pow). */
const sq = (v: number) => v * v;

export interface WorldOptions {
  seed: number; players?: { name: string; ai: boolean }[]; difficulty?: 'easy' | 'normal';
  /** Fairness experiments only: create player 2's start entities first (gives them the lower entity ids). */
  setupOrder?: 'p1first' | 'p2first';
  /** Fairness experiments only: per-player AI update phase within each 10-tick cycle (default pid*3). */
  aiPhase?: Record<number, number>;
}

export class World {
  tick = 0;
  seed: number;
  rng: Rng;
  nextId = 1;
  entities: Entity[] = [];             // always sorted by id (append-only, compacted on removal)
  byId = new Map<number, Entity>();
  players: Player[] = [];              // index 0 unused (neutral), 1 and 2 are players
  map: MapDef;
  nav: Nav;
  winner = 0;                          // 0 = ongoing
  difficulty: 'easy' | 'normal';
  setupOrder: 'p1first' | 'p2first';
  events: SimEvent[] = [];
  /** Hits/heals queued during a tick and applied together by applyHits() (never saved: empty between ticks). */
  hits: { target: number; from: number; amount: number }[] = [];
  // derived, rebuilt each tick
  visible: Uint8Array[] = [];
  cellHead: Int32Array; cellNext: Int32Array = new Int32Array(0); cellEnts: Entity[] = [];

  constructor(opts: WorldOptions, skipSetup = false) {
    this.seed = opts.seed >>> 0;
    this.rng = new Rng(this.seed);
    this.map = buildMap();
    this.nav = new Nav(this.map.w, this.map.h, this.map.terrain);
    this.difficulty = opts.difficulty ?? 'normal';
    this.setupOrder = opts.setupOrder ?? 'p1first';
    this.cellHead = new Int32Array(this.map.w * this.map.h);
    const n = this.map.w * this.map.h;
    this.visible = [new Uint8Array(n), new Uint8Array(n), new Uint8Array(n)];
    const defs = opts.players ?? [{ name: 'You', ai: false }, { name: 'Rival Kernel', ai: true }];
    this.players = [makePlayer(0, 'Neutral', false, n)];
    defs.forEach((d, i) => this.players.push(makePlayer(i + 1, d.name, d.ai, n)));
    if (!skipSetup) this.setup();
  }

  private setup() {
    for (const wl of this.map.wells) this.spawnWell(wl.x, wl.y, wl.amount);
    const order = this.setupOrder === 'p2first' ? [1, 0] : [0, 1];
    order.forEach(i => {
      const c = this.map.cores[i];
      const owner = i + 1;
      const core = this.spawnBuilding('core', owner, c.tx, c.ty, true);
      for (let k = 0; k < B.start.runners; k++) {
        const t = this.freeTileNear(core, owner, k);
        if (t >= 0) this.spawnUnit('runner', owner, (t % this.map.w) + 0.5, Math.floor(t / this.map.w) + 0.5);
      }
    });
  }

  // ---------- entity management ----------
  add(e: Entity) { this.entities.push(e); this.byId.set(e.id, e); return e; }
  get(id: number | undefined): Entity | undefined { if (!id) return undefined; const e = this.byId.get(id); return e && !e.dead ? e : undefined; }

  spawnWell(x: number, y: number, amount: number, fragment = false): Entity {
    return this.add({ id: this.nextId++, kind: 'well', type: fragment ? 'fragment' : 'well', owner: 0, x, y, hp: 1, maxHp: 1, amount, initial: amount });
  }
  spawnUnit(type: string, owner: number, x: number, y: number): Entity {
    const d = B.units[type];
    const pl = this.players[owner];
    const seq = pl ? (pl.spawnSeq = (pl.spawnSeq ?? 0) + 1) : 0;
    const e: Entity = { id: this.nextId++, kind: 'unit', type, owner, x, y, hp: d.hp, maxHp: d.hp, order: { type: 'idle' }, cd: 0, carry: 0, kills: 0, rank: 0, seq };
    this.add(e);
    this.events.push({ t: 'spawn', id: e.id, owner, type });
    return e;
  }
  spawnBuilding(type: string, owner: number, tx: number, ty: number, built: boolean): Entity {
    const d = B.buildings[type];
    const e: Entity = {
      id: this.nextId++, kind: 'building', type, owner, tx, ty, w: d.w, h: d.h,
      x: tx + d.w / 2, y: ty + d.h / 2, hp: built ? d.hp : Math.max(1, Math.round(d.hp * 0.1)), maxHp: d.hp,
      built, progress: built ? d.build : 0, active: true, queue: [], timer: 0, cd: 0,
    };
    if (d.gate) e.open = true;
    this.add(e);
    this.nav.setFootprint(tx, ty, d.w, d.h, e.id, owner);
    if (built && d.gate) this.nav.setGate(tx, ty, owner);
    this.ejectUnitsFrom(e);
    return e;
  }

  /** Move any unit standing inside a building footprint to the nearest open tile (obstruction recovery). */
  ejectUnitsFrom(b: Entity) {
    for (const u of this.entities) {
      if (u.kind !== 'unit' || u.dead) continue;
      const tx = Math.floor(u.x), ty = Math.floor(u.y);
      if (tx >= b.tx! && tx < b.tx! + b.w! && ty >= b.ty! && ty < b.ty! + b.h!) {
        if (this.nav.passableXY(tx, ty, u.owner)) continue; // e.g. own open gate
        const t = this.nav.nearestPassable(u.x, u.y, u.owner, 10);
        if (t >= 0) { u.x = (t % this.map.w) + 0.5; u.y = Math.floor(t / this.map.w) + 0.5; u.path = undefined; }
      }
    }
  }

  kill(e: Entity, killer?: Entity) {
    if (e.dead) return;
    e.dead = true; e.hp = 0;
    this.events.push({ t: 'death', id: e.id, x: e.x, y: e.y, owner: e.owner, kind: e.kind, type: e.type });
    const p = this.players[e.owner];
    if (e.kind === 'unit') {
      if (p && !e.forkOf) p.stats.unitsLost++;
      if (killer && killer.kind === 'unit' && !killer.forkOf && !e.forkOf) {
        killer.kills = (killer.kills ?? 0) + 1;
        const kpr = B.veterancy.killsPerRank;
        const newRank = kpr.filter(k => killer.kills! >= k).length;
        if (newRank > (killer.rank ?? 0)) {
          const oldMult = 1 + (killer.rank ?? 0) * B.veterancy.bonusPerRank;
          killer.rank = newRank;
          const mult = 1 + newRank * B.veterancy.bonusPerRank;
          const base = B.units[killer.type].hp;
          const frac = killer.hp / (base * oldMult);
          killer.maxHp = base * mult; killer.hp = killer.maxHp * frac;
        }
        const kp = this.players[killer.owner]; if (kp) kp.stats.kills++;
      }
      // release building operator slot
      if (e.order?.type === 'operate') { const b = this.get(e.order.target); if (b && b.operator === e.id) b.operator = undefined; }
      // bounded replication: forks die with their source
      for (const f of this.entities) if (f.forkOf === e.id && !f.dead) this.kill(f);
    } else if (e.kind === 'building') {
      if (p) p.stats.buildingsLost++;
      const d = B.buildings[e.type];
      this.nav.setFootprint(e.tx!, e.ty!, e.w!, e.h!, 0, 0);
      if (e.operator) { const op = this.get(e.operator); if (op) op.order = { type: 'idle' }; }
      // salvage: destroyed structures leave harvestable fragments
      const salvage = Math.floor((d.cost.data ?? 0) * B.economy.salvageFraction * (e.built ? 1 : (e.progress! / d.build)));
      if (salvage >= 10) this.spawnWell(e.x, e.y, salvage, true);
      if (e.type === 'core') {
        if (p) p.defeated = true;
        const alive = this.players.filter(pl => pl.id > 0 && !pl.defeated);
        if (alive.length === 1 && !this.winner) this.winner = alive[0].id;
      }
    } else if (e.kind === 'well') {
      // depleted
    }
  }

  compact() {
    if (!this.entities.some(e => e.dead)) return;
    this.entities = this.entities.filter(e => { if (e.dead) this.byId.delete(e.id); return !e.dead; });
  }

  // ---------- geometry ----------
  /** Distance from point to entity edge (buildings: rect, units: centre minus radius, wells: centre). */
  distTo(x: number, y: number, e: Entity): number {
    if (e.kind === 'building') {
      const dx = Math.max(e.tx! - x, 0, x - (e.tx! + e.w!));
      const dy = Math.max(e.ty! - y, 0, y - (e.ty! + e.h!));
      return Math.sqrt(dx * dx + dy * dy);
    }
    const r = e.kind === 'unit' ? B.units[e.type].radius : 0;
    return Math.max(0, Math.sqrt(sq(e.x - x) + sq(e.y - y)) - r);
  }
  /** Goal rect for pathing to interact with an entity. */
  goalFor(e: Entity): number[] {
    if (e.kind === 'building') return [e.tx! - 1, e.ty! - 1, e.tx! + e.w!, e.ty! + e.h!];
    const tx = Math.floor(e.x), ty = Math.floor(e.y);
    return [tx, ty, tx, ty];
  }
  freeTileNear(b: Entity, owner: number, skip = 0): number {
    // Ring search around the footprint for passable tiles not currently occupied by units.
    const occupied = new Set<number>();
    for (const u of this.entities) if (u.kind === 'unit' && !u.dead) occupied.add(Math.floor(u.y) * this.map.w + Math.floor(u.x));
    let seen = 0;
    for (let r = 1; r <= 4; r++) {
      const x0 = b.tx! - r, y0 = b.ty! - r, x1 = b.tx! + b.w! - 1 + r, y1 = b.ty! + b.h! - 1 + r;
      // Scan in the owner's mirrored frame (player 2 starts from the opposite corner) so spawn
      // positions are point-symmetric between the two sides.
      const flip = owner === 2;
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const y = flip ? y0 + y1 - yy : yy, x = flip ? x0 + x1 - xx : xx;
        if (x !== x0 && x !== x1 && y !== y0 && y !== y1) continue;
        if (!this.nav.passableXY(x, y, owner)) continue;
        const i = y * this.map.w + x;
        if (occupied.has(i)) continue;
        if (seen++ < skip) continue;
        return i;
      }
    }
    return -1;
  }

  // ---------- spatial hash (units only) ----------
  rebuildCells() {
    this.cellHead.fill(-1);
    this.cellEnts = [];
    for (const e of this.entities) if (e.kind === 'unit' && !e.dead && !(e.order?.type === 'operate' && e.order.phase === 'work')) this.cellEnts.push(e);
    this.cellNext = new Int32Array(this.cellEnts.length);
    const w = this.map.w;
    this.cellEnts.forEach((e, k) => {
      const i = clampI(Math.floor(e.y), this.map.h) * w + clampI(Math.floor(e.x), w);
      this.cellNext[k] = this.cellHead[i]; this.cellHead[i] = k;
    });
  }
  unitsNear(x: number, y: number, r: number, fn: (e: Entity) => void) {
    const w = this.map.w, h = this.map.h;
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(w - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(h - 1, Math.floor(y + r));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++)
      for (let k = this.cellHead[ty * w + tx]; k !== -1; k = this.cellNext[k]) fn(this.cellEnts[k]);
  }

  isVisible(player: number, x: number, y: number): boolean {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return false;
    return this.visible[player][ty * this.map.w + tx] === 1;
  }
  /** Is entity e visible to player? Buildings are visible if any footprint tile is visible. */
  canSee(player: number, e: Entity): boolean {
    if (e.owner === player) return true;
    if (e.kind === 'building') {
      for (let y = e.ty!; y < e.ty! + e.h!; y++) for (let x = e.tx!; x < e.tx! + e.w!; x++) if (this.visible[player][y * this.map.w + x]) return true;
      return false;
    }
    return this.isVisible(player, e.x, e.y);
  }

  // ---------- player economy helpers ----------
  caps(pid: number) {
    let compute = 0, memory = 0, dataCap = 0, codeCap = 0;
    for (const e of this.entities) {
      if (e.kind !== 'building' || e.owner !== pid || !e.built || e.dead) continue;
      const pr = B.buildings[e.type].provides; if (!pr) continue;
      compute += pr.compute ?? 0; memory += pr.memory ?? 0; dataCap += pr.dataCap ?? 0; codeCap += pr.codeCap ?? 0;
    }
    return { compute, memory, dataCap, codeCap, hashCap: B.economy.hashCap };
  }
  computeDemand(pid: number): number {
    let d = 0;
    for (const e of this.entities) {
      if (e.kind !== 'building' || e.owner !== pid || !e.built || e.dead || !e.active) continue;
      const bd = B.buildings[e.type];
      if (!bd.compute) continue;
      if (bd.computeWhileTraining && !(e.queue && e.queue.length > 0 && e.queue[0].started)) continue;
      if (bd.operator && !this.operatorPresent(e)) continue;
      d += bd.compute;
    }
    const p = this.players[pid];
    if (p.surgeUntil > this.tick) d += B.fork.computeSurge;
    return d;
  }
  computeEff(pid: number): number {
    const d = this.computeDemand(pid); const s = this.caps(pid).compute;
    return d <= s ? 1 : s / d;
  }
  memUsed(pid: number): number {
    let m = 0;
    for (const e of this.entities) {
      if (e.dead || e.owner !== pid) continue;
      if (e.kind === 'unit' && !e.forkOf) m += B.units[e.type].mem;
      if (e.kind === 'building' && e.queue) for (const q of e.queue) if (q.started) m += B.units[q.unit].mem;
    }
    return m;
  }
  operatorPresent(b: Entity): boolean {
    const op = this.get(b.operator);
    return !!op && op.order?.type === 'operate' && op.order.target === b.id && op.order.phase === 'work' && !op.suspended;
  }
  workSpeed(pid: number): number {
    const p = this.players[pid]; const ec = B.economy;
    return ec.workSpeedMin + (ec.workSpeedMax - ec.workSpeedMin) * (p.stability / 100);
  }
  canAfford(pid: number, c: Cost) { const p = this.players[pid]; return p.data >= (c.data ?? 0) && p.code >= (c.code ?? 0) && p.hash >= (c.hash ?? 0); }
  pay(pid: number, c: Cost) { const p = this.players[pid]; p.data -= c.data ?? 0; p.code -= c.code ?? 0; p.hash -= c.hash ?? 0; }
  refund(pid: number, c: Cost, frac = 1) {
    // Refunds may exceed storage caps; excess is clamped on the next economy tick (documented rule: refunds are not lost below cap).
    const p = this.players[pid]; p.data += (c.data ?? 0) * frac; p.code += (c.code ?? 0) * frac; p.hash += (c.hash ?? 0) * frac;
  }
  alert(pid: number, kind: string, text: string, severity: Alert['severity'], x?: number, y?: number, throttleSec = 8) {
    const p = this.players[pid]; if (!p) return;
    const last = p.alerts.find(a => a.kind === kind);
    if (last && this.tick - last.tick < throttleSec * B.tickRate) return;
    const a: Alert = { tick: this.tick, kind, text, severity, x, y };
    p.alerts = [a, ...p.alerts.filter(al => al.kind !== kind)].slice(0, 12);
    this.events.push({ t: 'alert', owner: pid, alert: a });
  }
  unitDef(e: Entity): UnitDef { return B.units[e.type]; }
  buildingDef(e: Entity): BuildingDef { return B.buildings[e.type]; }
  coreOf(pid: number): Entity | undefined { return this.entities.find(e => e.kind === 'building' && e.type === 'core' && e.owner === pid && !e.dead); }
}

function clampI(v: number, n: number) { return v < 0 ? 0 : v >= n ? n - 1 : v; }

function makePlayer(id: number, name: string, ai: boolean, n: number): Player {
  return {
    id, name, ai, data: B.start.data, code: B.start.code, hash: B.start.hash,
    ration: 'standard' as Ration, stability: B.economy.stabilityStart, unmet: 0, crashT: 0,
    forkReadyTick: 0, surgeUntil: 0, defeated: false,
    stats: { dataHarvested: 0, codeProduced: 0, codeConsumed: 0, hashMined: 0, unitsTrained: 0, unitsLost: 0, buildingsLost: 0, kills: 0, crashes: 0 },
    alerts: [], explored: new Uint8Array(n), lastSeen: {},
  };
}
