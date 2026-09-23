// DOM HUD: resource bar, alerts, objectives, selection panel, command card.
import { B, Entity, Cost } from '../sim/types.ts';
import { codeIncomeRate } from '../sim/systems.ts';
import { costText } from '../sim/commands.ts';
import { ClientState } from './state.ts';
import { keyName } from './settings.ts';

const $ = (id: string) => document.getElementById(id)!;

export interface CmdButton { id: string; label: string; key?: string; cost?: Cost; enabled: boolean; title: string; run: () => void }

export function fmtTime(ticks: number) { const s = Math.floor(ticks / B.tickRate); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

let lastHudKey = '';
export function updateTopbar(cs: ClientState) {
  const w = cs.game.world; const p = w.players[cs.me];
  const caps = w.caps(cs.me);
  let upkeep = 0;
  for (const e of w.entities) if (e.kind === 'unit' && e.owner === cs.me && !e.dead && !e.suspended && !e.forkOf) upkeep += B.units[e.type].upkeep;
  const drain = upkeep * B.economy.rations[p.ration].mult / B.economy.upkeepCycleSec;
  const inc = codeIncomeRate(w, cs.me);
  const net = inc - drain;
  const demand = w.computeDemand(cs.me);
  const mem = w.memUsed(cs.me);
  $('v-data').textContent = `${Math.floor(p.data)}/${caps.dataCap}`;
  $('s-data').textContent = p.data >= caps.dataCap - 1 ? 'storage full' : 'harvest by Runners';
  $('v-code').textContent = `${Math.floor(p.code)}/${caps.codeCap}`;
  $('s-code').textContent = `${net >= 0 ? '+' : ''}${(net * 60).toFixed(0)}/min` + (net < 0 && p.code > 0 ? ` · ${Math.ceil(p.code / -net)}s left` : '');
  $('v-hash').textContent = `${Math.floor(p.hash)}/${caps.hashCap}`;
  $('s-hash').textContent = 'mined by Rigs';
  $('v-compute').textContent = `${demand}/${caps.compute}`;
  $('s-compute').textContent = demand > caps.compute ? `BROWNOUT ${Math.round(caps.compute / demand * 100)}%` : 'demand / supply';
  $('v-mem').textContent = `${mem}/${caps.memory}`;
  $('s-mem').textContent = mem >= caps.memory ? 'full — build Memory Bank' : 'used / limit';
  $('v-stab').textContent = `${Math.round(p.stability)}` + (p.stability < B.economy.crashThreshold ? ' CRASHING' : '');
  $('c-code').className = 'chip' + (p.code < 1 && drain > 0 ? ' bad' : net < 0 && p.code / -net < B.economy.lowCodeWarnSec ? ' warn' : '');
  $('c-compute').className = 'chip' + (demand > caps.compute ? ' warn' : '');
  $('c-mem').className = 'chip' + (mem >= caps.memory ? ' warn' : '');
  $('c-data').className = 'chip' + (p.data >= caps.dataCap - 1 ? ' warn' : '');
  $('c-stab').className = 'chip' + (p.stability < B.economy.crashThreshold ? ' bad' : p.stability < 40 ? ' warn' : '');
  for (const b of Array.from(document.querySelectorAll('#rations button'))) (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.r === p.ration);
  $('clock').textContent = fmtTime(w.tick);
  $('b-pause').textContent = cs.paused ? 'Resume' : 'Pause';
  $('b-speed').textContent = `${cs.speed}×`;
  $('pausedBanner').classList.toggle('hidden', !cs.paused || cs.over);
}

export function updateAlerts(cs: ClientState, onJump: (x: number, y: number) => void) {
  const w = cs.game.world; const p = w.players[cs.me];
  const recent = p.alerts.filter(a => w.tick - a.tick < 25 * B.tickRate).slice(0, 5);
  const key = recent.map(a => a.tick + a.kind).join('|');
  if (key === lastHudKey) return;
  lastHudKey = key;
  const box = $('alerts'); box.innerHTML = '';
  for (const a of recent) {
    const d = document.createElement('div'); d.className = 'alert ' + a.severity;
    d.innerHTML = `<span class="ic">${a.severity === 'danger' ? '⚠' : a.severity === 'warn' ? '!' : 'i'}</span>`;
    d.appendChild(document.createTextNode(`${fmtTime(a.tick)} — ${a.text}`));
    if (a.x !== undefined) d.onclick = () => onJump(a.x!, a.y!);
    box.appendChild(d);
  }
}

// ---------------- objectives / tutorial ----------------
export interface Objective { text: string; hint: string; done: (cs: ClientState) => boolean }
const count = (cs: ClientState, f: (e: Entity) => boolean) => cs.game.world.entities.filter(e => !e.dead && e.owner === cs.me && f(e)).length;
export const OBJECTIVES: Objective[] = [
  { text: 'Harvest Data', hint: 'Drag a box around your Runners (small circles), then right-click a glowing hexagon well.', done: cs => count(cs, e => e.type === 'runner' && e.order?.type === 'harvest') > 0 },
  { text: 'Build a Compiler', hint: 'Select a Runner, press C (or click Compiler below), then click open ground near your Core.', done: cs => count(cs, e => e.type === 'compiler') > 0 },
  { text: 'Feed your programs', hint: 'A finished Compiler automatically pulls a Runner in as its operator and turns Data into Code. Code is food: every program eats it.', done: cs => cs.game.world.entities.some(e => e.owner === cs.me && e.type === 'compiler' && cs.game.world.operatorPresent(e)) },
  { text: 'Grow to 7 Runners', hint: 'Select the Core and press Q to compile Runners (Data + Code). More hands = more Data.', done: cs => count(cs, e => e.type === 'runner') >= 7 },
  { text: 'Build a Mining Rig and a Memory Bank', hint: 'M = Mining Rig (mines Hash Credits, needs an operator and 4 Compute). K = Memory Bank (+6 population room).', done: cs => count(cs, e => e.type === 'rig' && !!e.built) > 0 && count(cs, e => e.type === 'bank' && !!e.built) > 0 },
  { text: 'Build a Training Grid and 4 combat programs', hint: 'T = Training Grid. Select it: Q Ping, W Bulwark, E Lancer, R Patcher, T Breaker. Each consumes a free Runner and costs Hash.', done: cs => count(cs, e => e.kind === 'unit' && e.type !== 'runner' && !e.forkOf) >= 4 },
  { text: 'Fortify a pass', hint: 'Select Runners, press W and drag across a pass in the void rift to lay Firewalls; add a Gate (G) so your army can pass. Enemies cannot open your gates.', done: cs => count(cs, e => e.type === 'wall' && !!e.built) >= 4 && count(cs, e => e.type === 'gate' && !!e.built) >= 1 },
  { text: 'Raise a Sentry Tower', hint: 'R = Sentry Tower. Towers draw 2 Compute; if Compute runs short (brownout) they fire slower — pause a Rig (O) during a siege.', done: cs => count(cs, e => e.type === 'tower' && !!e.built) > 0 },
  { text: 'Destroy the Rival Core', hint: 'The first Rival wave usually comes around 6–7 minutes (never before 5:30). Hold, then push with Bulwarks in front, Lancers behind and Breakers to crack hardened walls, towers and the Core. F = Fork: temporary copies of selected fighters.', done: cs => cs.game.world.winner === cs.me },
];
let objKey = '';
const latched = new Set<number>();
export function updateObjectives(cs: ClientState) {
  // completed objectives stay completed (no flicker when e.g. harvesters are reassigned)
  const done = OBJECTIVES.map((o, i) => { if (latched.has(i)) return true; const d = o.done(cs); if (d) latched.add(i); return d; });
  const cur = done.indexOf(false);
  const key = done.join() + cs.settings.showHints;
  if (key === objKey) return; objKey = key;
  const list = $('objlist'); list.innerHTML = '';
  OBJECTIVES.forEach((o, i) => {
    const d = document.createElement('div');
    d.className = 'obj' + (done[i] ? ' done' : i === cur ? ' cur' : '');
    d.innerHTML = `<span>${done[i] ? '✓' : i === cur ? '▶' : '·'}</span><span></span>`;
    const span = d.lastChild as HTMLElement; span.textContent = o.text;
    if (i === cur && cs.settings.showHints) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = o.hint; span.appendChild(h); }
    list.appendChild(d);
  });
}

// ---------------- selection panel ----------------
const STALL_TEXT: Record<string, string> = {
  noOperator: 'Idle — no operator. A free Runner (idle or harvesting) will be pulled in automatically; compile more Runners if none are free.',
  operatorSuspended: 'Operator is suspended. Resume it (Z) to restart work.',
  noData: 'Starved of Data — send Runners to harvest.',
  codeFull: 'Code storage is full. Build another Compiler or spend Code.',
  hashFull: 'Hash vault is full (600). Spend Hash on training or towers.',
  paused: 'Switched off (O to switch on). Paused buildings use no Compute and release their operator.',
  needRunner: 'Waiting for a free Runner to specialize (idle or harvesting). Compile more at the Core.',
  memFull: 'Memory full. Build a Memory Bank to raise the program limit.',
  spawnBlocked: 'Spawn blocked — clear space around the building.',
  brownout: 'Brownout: not enough Compute; training runs slower. Build a Compute Node or pause a Rig.',
};

function orderText(e: Entity): string {
  if (e.suspended) return e.crashed ? 'CRASHED (suspended). Needs Code + Stability; press Z to resume.' : 'Suspended (uses no Code). Press Z to resume.';
  const o = e.order; if (!o) return 'Idle';
  switch (o.type) {
    case 'idle': return e.engaged ? 'Fighting' : 'Idle';
    case 'move': return 'Moving';
    case 'attackMove': return e.engaged ? 'Fighting (attack-move)' : 'Attack-moving';
    case 'attack': return 'Attacking target';
    case 'harvest': return o.phase === 'gather' ? 'Harvesting Data' : o.phase === 'toDrop' ? `Carrying ${e.carry} Data home` : 'Walking to a Data well';
    case 'build': return 'Building';
    case 'repair': return 'Repairing (costs 1 Data per 10 integrity)';
    case 'operate': return o.phase === 'work' ? 'Operating a building' : 'Walking to operate a building';
    case 'hold': return 'Holding position';
  }
  return o.type;
}

let selKey = '';
export function updateSelection(cs: ClientState, onSelectType: (type: string) => void, onCancel: (b: number, i: number) => void) {
  const w = cs.game.world;
  const sel = [...cs.sel].map(id => w.get(id)).filter((e): e is Entity => !!e);
  const box = $('sel');
  const key = sel.map(e => `${e.id}:${Math.round(e.hp)}:${e.order?.type}:${e.order?.phase}:${e.stall}:${e.queue?.map(q => q.unit + Math.floor(q.progress)).join()}:${e.suspended}:${e.active}:${e.open}:${e.built}:${Math.floor(e.progress ?? 0)}:${e.amount}:${e.carry}:${e.rank}`).join('|') + '#' + w.tick % 10;
  if (key === selKey) return; selKey = key;
  box.innerHTML = '';
  if (!sel.length) {
    box.innerHTML = `<h2>Nothing selected</h2><div class="role">Left-click or drag to select. Right-click to order. Press <b>F1</b> for controls.</div>`;
    return;
  }
  if (sel.length === 1) {
    const e = sel[0];
    const mine = e.owner === cs.me;
    const h = document.createElement('h2');
    const name = e.kind === 'unit' ? B.units[e.type].name : e.kind === 'building' ? B.buildings[e.type].name : e.type === 'fragment' ? 'Salvage Fragments' : 'Data Well';
    h.textContent = `${name}${e.forkOf ? ' (Fork)' : ''}${!mine && e.owner ? ' — Rival' : ''}`;
    box.appendChild(h);
    const role = document.createElement('div'); role.className = 'role';
    role.textContent = e.kind === 'unit' ? B.units[e.type].role : e.kind === 'building' ? B.buildings[e.type].desc : 'Runners harvest 10 Data per trip. Wells run dry.';
    box.appendChild(role);
    if (e.kind !== 'well') {
      const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = `<i style="width:${Math.max(0, e.hp / e.maxHp * 100)}%"></i>`; box.appendChild(bar);
    }
    const kv = document.createElement('div'); kv.className = 'kv';
    const add = (k: string, v: string) => { const b = document.createElement('b'); b.textContent = k; const s = document.createElement('span'); s.textContent = v; kv.append(b, s); };
    if (e.kind === 'well') add('Remaining', `${Math.floor(e.amount!)} / ${e.initial}`);
    else add('Integrity', `${Math.ceil(e.hp)} / ${Math.round(e.maxHp)}`);
    if (e.kind === 'unit') {
      const ud = B.units[e.type];
      add('State', orderText(e));
      add('Upkeep', `${ud.upkeep} Code / ${B.economy.upkeepCycleSec}s · Memory ${ud.mem}`);
      if (ud.attack) add('Attack', `${ud.attack.dmg}${e.rank ? ` (+${Math.round(e.rank * B.veterancy.bonusPerRank * 100)}%)` : ''} every ${ud.attack.cd}s · range ${ud.attack.range}${ud.attack.siege ? ' · siege' : ''}`);
      if (ud.heal) add('Repair', `${ud.heal.amt} every ${ud.heal.cd}s · range ${ud.heal.range}`);
      add('Armor · Speed', `${ud.armor} · ${ud.speed}`);
      if (e.type !== 'runner') add('Experience', `${e.kills ?? 0} kills · rank ${e.rank ?? 0}/2`);
      if (e.forkOf && e.expires) add('Fork expires', `${Math.ceil((e.expires - w.tick) / B.tickRate)}s`);
    }
    if (e.kind === 'building') {
      const bd = B.buildings[e.type];
      if (!e.built) add('Construction', `${Math.floor(e.progress! / bd.build * 100)}% — Runners build it`);
      if (bd.operator) add('Operator', w.operatorPresent(e) ? 'working' : e.operator ? 'on the way' : 'none');
      if (bd.compute) add('Compute', `${bd.compute}${bd.computeWhileTraining ? ' while training' : ''}`);
      if (bd.provides) add('Provides', Object.entries(bd.provides).map(([k, v]) => `+${v} ${k}`).join(', '));
      if (bd.gate) add('Gate', e.open ? 'OPEN for your programs (enemies never pass)' : 'CLOSED to everyone');
      if (bd.hardened) add('Hardened', 'Non-siege attacks deal 25%');
    }
    box.appendChild(kv);
    if (e.kind === 'building' && mine && e.stall && STALL_TEXT[e.stall]) { const why = document.createElement('div'); why.className = 'why'; why.textContent = STALL_TEXT[e.stall]; box.appendChild(why); }
    if (e.kind === 'unit' && mine && e.suspended) { const why = document.createElement('div'); why.className = 'why'; why.textContent = orderText(e); box.appendChild(why); }
    if (e.queue && e.queue.length && mine) {
      const q = document.createElement('div'); q.className = 'queue';
      e.queue.forEach((it, i) => {
        const d = document.createElement('div'); d.className = 'qi'; d.title = 'Click to cancel (full refund' + (it.consumedRunner ? ', Runner returned' : '') + ')';
        d.textContent = B.units[it.unit].name;
        const pg = document.createElement('i'); pg.className = 'pg'; pg.style.width = `${it.progress / B.units[it.unit].time * 100}%`; d.appendChild(pg);
        d.onclick = () => onCancel(e.id, i);
        q.appendChild(d);
      });
      box.appendChild(q);
    }
    return;
  }
  const h = document.createElement('h2'); h.textContent = `${sel.length} selected`; box.appendChild(h);
  const byType = new Map<string, number>();
  for (const e of sel) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
  const m = document.createElement('div'); m.className = 'multi';
  for (const [t, n] of byType) {
    const d = document.createElement('div'); d.className = 'mu';
    d.textContent = `${(B.units[t] ?? B.buildings[t])?.name ?? t} × ${n}`;
    d.title = 'Click to select only these'; d.onclick = () => onSelectType(t);
    m.appendChild(d);
  }
  box.appendChild(m);
  const hp = sel.reduce((a, e) => a + e.hp, 0), mx = sel.reduce((a, e) => a + e.maxHp, 0);
  const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = `<i style="width:${hp / mx * 100}%"></i>`; box.appendChild(bar);
}

let cmdKey = '';
export function updateCommands(cs: ClientState, buttons: CmdButton[]) {
  const key = buttons.map(b => b.id + b.enabled + b.label).join('|');
  if (key === cmdKey) return; cmdKey = key;
  const box = $('cmds'); box.innerHTML = '';
  for (const b of buttons) {
    const d = document.createElement('div'); d.className = 'cb' + (b.enabled ? '' : ' dis');
    d.title = b.title + (b.cost ? `\nCost: ${costText(b.cost)}` : '');
    d.dataset.cmd = b.id;
    if (b.key) { const k = document.createElement('span'); k.className = 'hk'; k.textContent = keyName(b.key); d.appendChild(k); }
    const l = document.createElement('span'); l.textContent = b.label; d.appendChild(l);
    if (b.cost) { const c = document.createElement('span'); c.className = 'cost'; c.textContent = costText(b.cost).replace(/ Data/g, 'D').replace(/ Code/g, 'C').replace(/ Hash/g, 'H'); d.appendChild(c); }
    d.onclick = (ev) => { ev.stopPropagation(); b.run(); };
    box.appendChild(d);
  }
}
export function resetHudCaches() { lastHudKey = ''; objKey = ''; selKey = ''; cmdKey = ''; latched.clear(); }
