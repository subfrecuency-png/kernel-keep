// Validated player commands. Every player action (human or AI) goes through here,
// so the AI cannot do anything a human could not, and invalid actions get a readable reason.
import { B, Command, CommandResult, Entity, Cost } from './types.ts';
import { World } from './world.ts';
import { issueMove, setPath } from './systems.ts';

const fail = (reason: string): CommandResult => ({ ok: false, reason });
const OK: CommandResult = { ok: true };

export function costText(c: Cost) {
  const parts: string[] = [];
  if (c.data) parts.push(`${c.data} Data`); if (c.code) parts.push(`${c.code} Code`); if (c.hash) parts.push(`${c.hash} Hash`);
  return parts.join(' + ') || 'free';
}
function missing(w: World, pid: number, c: Cost): string {
  const p = w.players[pid]; const m: string[] = [];
  if ((c.data ?? 0) > p.data) m.push(`${Math.ceil((c.data ?? 0) - p.data)} more Data`);
  if ((c.code ?? 0) > p.code) m.push(`${Math.ceil((c.code ?? 0) - p.code)} more Code`);
  if ((c.hash ?? 0) > p.hash) m.push(`${Math.ceil((c.hash ?? 0) - p.hash)} more Hash`);
  return 'Need ' + m.join(', ');
}

function ownUnits(w: World, pid: number, ids: number[], filter?: (e: Entity) => boolean): Entity[] {
  const out: Entity[] = [];
  for (const id of [...new Set(ids)].sort((a, b) => a - b)) {
    const e = w.get(id);
    if (e && e.kind === 'unit' && e.owner === pid && (!filter || filter(e))) out.push(e);
  }
  return out;
}
function ownBuilding(w: World, pid: number, id: number): Entity | undefined {
  const e = w.get(id); return e && e.kind === 'building' && e.owner === pid ? e : undefined;
}

export function canPlace(w: World, pid: number, type: string, tx: number, ty: number): CommandResult {
  const d = B.buildings[type];
  if (!d || d.buildable === false) return fail('That structure cannot be built.');
  const p = w.players[pid];
  for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) {
    if (!w.nav.inBounds(x, y)) return fail('Out of bounds.');
    const i = w.nav.idx(x, y);
    if (!p.explored[i]) return fail('Cannot build in unexplored space.');
    if (w.nav.terrain[i]) return fail('Cannot build on the void.');
    if (w.nav.block[i]) return fail('Space is occupied.');
  }
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'well') {
      const x = Math.floor(e.x), y = Math.floor(e.y);
      if (x >= tx - (d.wall || d.gate ? 0 : 1) && x < tx + d.w + (d.wall || d.gate ? 0 : 1) && y >= ty - (d.wall || d.gate ? 0 : 1) && y < ty + d.h + (d.wall || d.gate ? 0 : 1)) return fail('Too close to a Data well.');
    } else if (e.kind === 'unit' && e.owner !== pid && w.canSee(pid, e)) {
      if (e.x >= tx - 0.5 && e.x < tx + d.w + 0.5 && e.y >= ty - 0.5 && e.y < ty + d.h + 0.5) return fail('Enemy programs are in the way.');
    }
  }
  // territory: must be near one of your structures
  let near = false;
  const cx = tx + d.w / 2, cy = ty + d.h / 2;
  for (const e of w.entities) if (e.kind === 'building' && !e.dead && e.owner === pid && (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy) <= 18 * 18) { near = true; break; }
  if (!near) return fail('Too far from your structures (18 tiles).');
  if (!w.canAfford(pid, d.cost)) return fail(missing(w, pid, d.cost));
  return OK;
}

function formationPoints(n: number, x: number, y: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const side = Math.ceil(Math.sqrt(n));
  const sp = 0.8;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / side), c = i % side;
    pts.push({ x: x + (c - (side - 1) / 2) * sp, y: y + (r - (side - 1) / 2) * sp });
  }
  return pts;
}

function releaseOperator(w: World, u: Entity) {
  if (u.order?.type === 'operate') { const b = w.get(u.order.target); if (b && b.operator === u.id) b.operator = undefined; }
}

export function applyCommand(w: World, c: Command): CommandResult {
  if (w.winner) return fail('The match is over.');
  const pid = c.player;
  const p = w.players[pid];
  if (!p || pid === 0 || p.defeated) return fail('Invalid player.');
  switch (c.t) {
    case 'move': case 'attackMove': {
      const us = ownUnits(w, pid, c.ids, e => !e.suspended);
      if (!us.length) return fail('No active programs selected.');
      if (!w.nav.inBounds(Math.floor(c.x), Math.floor(c.y))) return fail('Out of bounds.');
      const pts = formationPoints(us.length, c.x, c.y);
      us.forEach((u, k) => {
        releaseOperator(w, u);
        const pt = pts[k];
        const t = w.nav.nearestPassable(pt.x, pt.y, pid, 3);
        const tx = t >= 0 ? (t % w.map.w) + 0.5 : c.x, ty = t >= 0 ? Math.floor(t / w.map.w) + 0.5 : c.y;
        issueMove(w, u, t >= 0 && Math.floor(pt.x) === Math.floor(tx) && Math.floor(pt.y) === Math.floor(ty) ? pt.x : tx,
          t >= 0 && Math.floor(pt.x) === Math.floor(tx) && Math.floor(pt.y) === Math.floor(ty) ? pt.y : ty,
          c.t === 'attackMove' && (B.units[u.type].attack || B.units[u.type].heal) ? 'attackMove' : 'move');
      });
      return OK;
    }
    case 'attack': {
      const t = w.get(c.target);
      if (!t || t.owner === pid || t.owner === 0) return fail('Not an enemy target.');
      if (!w.canSee(pid, t)) return fail('Target is not visible.');
      const us = ownUnits(w, pid, c.ids, e => !e.suspended && !!B.units[e.type].attack);
      if (!us.length) return fail('No selected program can attack.');
      for (const u of us) { releaseOperator(w, u); u.order = { type: 'attack', target: t.id }; u.engaged = undefined; u.path = undefined; }
      return OK;
    }
    case 'stop': case 'hold': {
      const us = ownUnits(w, pid, c.ids);
      if (!us.length) return fail('Nothing selected.');
      for (const u of us) { releaseOperator(w, u); u.order = { type: c.t === 'hold' ? 'hold' : 'idle' }; u.path = undefined; u.engaged = undefined; }
      return OK;
    }
    case 'harvest': {
      const t = w.get(c.target);
      if (!t || t.kind !== 'well') return fail('That is not a Data well.');
      if (!p.explored[Math.floor(t.y) * w.map.w + Math.floor(t.x)]) return fail('Well is unexplored.');
      const us = ownUnits(w, pid, c.ids, e => e.type === 'runner' && !e.suspended);
      if (!us.length) return fail('Only Runners can harvest Data.');
      for (const u of us) { releaseOperator(w, u); u.order = { type: 'harvest', target: t.id }; u.path = undefined; u.engaged = undefined; }
      return OK;
    }
    case 'place': {
      const r = canPlace(w, pid, c.building, c.tx, c.ty);
      if (!r.ok) return r;
      w.pay(pid, B.buildings[c.building].cost);
      const site = w.spawnBuilding(c.building, pid, c.tx, c.ty, false);
      for (const u of ownUnits(w, pid, c.ids, e => e.type === 'runner' && !e.suspended)) {
        releaseOperator(w, u); u.order = { type: 'build', target: site.id }; u.path = undefined;
      }
      return { ok: true, reason: String(site.id) };
    }
    case 'assist': {
      const t = ownBuilding(w, pid, c.target);
      if (!t || t.built) return fail('Not one of your construction sites.');
      const us = ownUnits(w, pid, c.ids, e => e.type === 'runner' && !e.suspended);
      if (!us.length) return fail('Only Runners can build.');
      for (const u of us) { releaseOperator(w, u); u.order = { type: 'build', target: t.id }; u.path = undefined; }
      return OK;
    }
    case 'repair': {
      const t = ownBuilding(w, pid, c.target);
      if (!t || !t.built) return fail('Can only repair your finished structures.');
      if (t.hp >= t.maxHp) return fail('Already at full integrity.');
      const us = ownUnits(w, pid, c.ids, e => e.type === 'runner' && !e.suspended);
      if (!us.length) return fail('Only Runners can repair (Patchers heal automatically).');
      for (const u of us) { releaseOperator(w, u); u.order = { type: 'repair', target: t.id }; u.path = undefined; }
      return OK;
    }
    case 'operate': {
      const t = ownBuilding(w, pid, c.target);
      if (!t || !t.built || !B.buildings[t.type].operator) return fail('That building does not take an operator.');
      const us = ownUnits(w, pid, c.ids, e => e.type === 'runner' && !e.suspended);
      if (!us.length) return fail('Only Runners can operate buildings.');
      const u = us[0];
      if (t.operator && t.operator !== u.id) { const old = w.get(t.operator); if (old) old.order = { type: 'idle' }; }
      releaseOperator(w, u);
      t.active = true; t.operator = u.id; u.order = { type: 'operate', target: t.id, phase: 'go' }; u.path = undefined;
      return OK;
    }
    case 'train': {
      const b = ownBuilding(w, pid, c.building);
      if (!b || !b.built) return fail('Building not ready.');
      const d = B.buildings[b.type];
      if (!d.trains?.includes(c.unit)) return fail('This building cannot train that.');
      if (b.queue!.length >= B.economy.maxQueue) return fail(`Queue is full (${B.economy.maxQueue}).`);
      const ud = B.units[c.unit];
      if (!w.canAfford(pid, ud.cost)) return fail(missing(w, pid, ud.cost));
      w.pay(pid, ud.cost);
      b.queue!.push({ unit: c.unit, progress: 0, started: false, paid: { ...ud.cost }, consumedRunner: false });
      return OK;
    }
    case 'cancelTrain': {
      const b = ownBuilding(w, pid, c.building);
      if (!b || !b.queue || c.index < 0 || c.index >= b.queue.length) return fail('Nothing to cancel.');
      const [q] = b.queue.splice(c.index, 1);
      w.refund(pid, q.paid);
      if (q.consumedRunner) {
        let t = w.freeTileNear(b, pid);
        if (t < 0) t = w.nav.nearestPassable(b.x, b.y, pid, 8);
        if (t >= 0) w.spawnUnit('runner', pid, (t % w.map.w) + 0.5, Math.floor(t / w.map.w) + 0.5);
      }
      return OK;
    }
    case 'cancelBuild': case 'demolish': {
      const b = ownBuilding(w, pid, c.building);
      if (!b) return fail('Not your structure.');
      if (b.type === 'core') return fail('The Core cannot be removed.');
      if (c.t === 'cancelBuild' && b.built) return fail('Already finished — use Demolish.');
      if (c.t === 'demolish' && !b.built) return fail('Still under construction — use Cancel.');
      const d = B.buildings[b.type];
      w.refund(pid, d.cost, c.t === 'cancelBuild' ? 1 : B.economy.demolishRefund);
      // return queued training
      for (const q of b.queue ?? []) {
        w.refund(pid, q.paid);
        if (q.consumedRunner) { const t = w.nav.nearestPassable(b.x, b.y, pid, 8); if (t >= 0) w.spawnUnit('runner', pid, (t % w.map.w) + 0.5, Math.floor(t / w.map.w) + 0.5); }
      }
      b.queue = [];
      if (b.operator) { const op = w.get(b.operator); if (op) op.order = { type: 'idle' }; }
      b.dead = true;
      w.nav.setFootprint(b.tx!, b.ty!, b.w!, b.h!, 0, 0);
      w.events.push({ t: 'death', id: b.id, x: b.x, y: b.y, owner: pid, kind: 'building', type: b.type });
      return OK;
    }
    case 'toggleActive': {
      const b = ownBuilding(w, pid, c.building);
      if (!b || !b.built) return fail('Building not ready.');
      const d = B.buildings[b.type];
      if (!d.operator && !d.compute) return fail('This building has no on/off switch.');
      b.active = !b.active;
      return OK;
    }
    case 'gate': {
      const b = ownBuilding(w, pid, c.building);
      if (!b || !B.buildings[b.type].gate) return fail('Not your gate.');
      if (!b.built) return fail('Gate is still under construction.');
      b.open = c.open;
      w.nav.setGate(b.tx!, b.ty!, c.open ? pid : 0);
      if (!c.open) w.ejectUnitsFrom(b);
      return OK;
    }
    case 'rally': {
      const b = ownBuilding(w, pid, c.building);
      if (!b || !B.buildings[b.type].trains) return fail('This building does not produce programs.');
      b.rally = { x: c.x, y: c.y };
      return OK;
    }
    case 'ration': {
      if (!B.economy.rations[c.level]) return fail('Unknown ration level.');
      p.ration = c.level;
      return OK;
    }
    case 'suspend': {
      const us = ownUnits(w, pid, c.ids, e => !e.forkOf);
      if (!us.length) return fail('Nothing to suspend.');
      for (const u of us) {
        u.suspended = c.on;
        if (!c.on) u.crashed = false;
        u.path = undefined; u.engaged = undefined;
      }
      return OK;
    }
    case 'decompile': {
      const us = ownUnits(w, pid, c.ids);
      if (!us.length) return fail('Nothing to decompile.');
      for (const u of us) {
        releaseOperator(w, u);
        u.dead = true;
        w.events.push({ t: 'death', id: u.id, x: u.x, y: u.y, owner: pid, kind: 'unit', type: 'decompiled' });
        for (const f of w.entities) if (f.forkOf === u.id && !f.dead) { f.dead = true; w.events.push({ t: 'death', id: f.id, x: f.x, y: f.y, owner: pid, kind: 'unit', type: 'decompiled' }); }
      }
      return OK;
    }
    case 'fork': {
      if (w.tick < p.forkReadyTick) return fail(`Fork recharging (${Math.ceil((p.forkReadyTick - w.tick) / B.tickRate)}s).`);
      if (!w.canAfford(pid, B.fork.cost)) return fail(missing(w, pid, B.fork.cost));
      const us = ownUnits(w, pid, c.ids, e => e.type !== 'runner' && !e.forkOf && !e.suspended).slice(0, B.fork.maxUnits);
      if (!us.length) return fail('Select combat programs to fork (not Runners).');
      w.pay(pid, B.fork.cost);
      const dur = B.fork.durationSec * B.tickRate;
      p.forkReadyTick = w.tick + B.fork.cooldownSec * B.tickRate;
      p.surgeUntil = w.tick + dur;
      for (const u of us) {
        const t = w.nav.nearestPassable(u.x + 0.6, u.y + 0.6, pid, 3);
        const fx = t >= 0 ? (t % w.map.w) + 0.5 : u.x, fy = t >= 0 ? Math.floor(t / w.map.w) + 0.5 : u.y;
        const f = w.spawnUnit(u.type, pid, fx, fy);
        f.forkOf = u.id; f.expires = w.tick + dur;
        f.hp = Math.max(1, u.hp * B.fork.hpFraction); f.maxHp = u.maxHp;
        f.order = u.order ? { ...u.order } : { type: 'idle' };
        if (f.order.type === 'move' || f.order.type === 'attackMove') { f.path = undefined; }
        if (f.order.type === 'operate') f.order = { type: 'idle' };
        f.engaged = u.engaged;
      }
      return OK;
    }
  }
  return fail('Unknown command.');
}

export { setPath };
