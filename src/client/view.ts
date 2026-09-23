// View models: pure functions that project authoritative World state into immutable,
// UI-ready data for the React HUD. No DOM, no React, no mutation — unit-testable in Node.
// Everything the HUD shows is derived from engine state here; nothing is a sample value.
import { B, Entity, Cost, Ration } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import { codeIncomeRate } from '../sim/systems.ts';
import { costText } from '../sim/commands.ts';

export function fmtTime(ticks: number) { const s = Math.floor(ticks / B.tickRate); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

// ---------------- resources / top bar ----------------
export type Tone = '' | 'warn' | 'bad';
export interface ResourceView { id: 'data' | 'code' | 'hash' | 'compute' | 'memory'; name: string; value: string; sub: string; tone: Tone; tip: string }
export interface TopView { resources: ResourceView[]; stability: number; stabilityTone: Tone; crashing: boolean; ration: Ration; codeNetPerMin: number; codeReserveSec: number | null }

export const TIPS = {
  data: 'DATA — raw feedstock. Runners harvest it from glowing wells and carry it to your Core or a Data Cache. Spent on construction and turned into Code by Compilers.',
  code: 'CODE — food for your programs. Every program eats it (its upkeep). Compilers make it from Data; the Core trickles a little. Running out lowers Stability.',
  hash: 'HASH CREDITS — fictional, match-local currency mined by staffed Mining Rigs. Pays for combat programs, towers and the Fork power. Vault holds 600.',
  compute: 'COMPUTE — a capacity, not a stockpile. Rigs (4), Towers (2) and a training Grid (3) draw on it. If demand exceeds supply, all of them slow down (brownout).',
  memory: 'MEMORY — your population limit. Runner 1, Bulwark 2, Breaker 3 … Memory Banks add 6.',
  stability: 'STABILITY — how well-fed and orderly your population is. It drifts toward a target set by rations and hunger. High = faster work; below 20, programs crash (auto-suspend).',
};

export function upkeepDrain(w: World, pid: number): number {
  let upkeep = 0;
  for (const e of w.entities) if (e.kind === 'unit' && e.owner === pid && !e.dead && !e.suspended && !e.forkOf) upkeep += B.units[e.type].upkeep;
  return upkeep * B.economy.rations[w.players[pid].ration].mult / B.economy.upkeepCycleSec;
}

export function topView(w: World, pid: number): TopView {
  const p = w.players[pid];
  const caps = w.caps(pid);
  const drain = upkeepDrain(w, pid);
  const net = codeIncomeRate(w, pid) - drain;
  const demand = w.computeDemand(pid);
  const mem = w.memUsed(pid);
  // A reserve estimate only exists for a negative net rate (and assumes the rate stays constant).
  const reserve = net < 0 && p.code > 0 ? Math.ceil(p.code / -net) : null;
  const starving = p.code < 1 && drain > 0;
  return {
    resources: [
      { id: 'data', name: 'Data', value: `${Math.floor(p.data)}/${caps.dataCap}`, sub: p.data >= caps.dataCap - 1 ? 'storage full' : 'delivered stock', tone: p.data >= caps.dataCap - 1 ? 'warn' : '', tip: TIPS.data },
      { id: 'code', name: 'Code', value: `${Math.floor(p.code)}/${caps.codeCap}`, sub: `${net >= 0 ? '+' : ''}${(net * 60).toFixed(0)}/min` + (reserve !== null ? ` · ${reserve}s left` : ''), tone: starving ? 'bad' : reserve !== null && reserve < B.economy.lowCodeWarnSec ? 'warn' : '', tip: TIPS.code },
      { id: 'hash', name: 'Hash', value: `${Math.floor(p.hash)}/${caps.hashCap}`, sub: 'mined by Rigs', tone: '', tip: TIPS.hash },
      { id: 'compute', name: 'Compute', value: `${demand}/${caps.compute}`, sub: demand > caps.compute ? `BROWNOUT ${Math.round(caps.compute / demand * 100)}%` : 'demand / supply', tone: demand > caps.compute ? 'warn' : '', tip: TIPS.compute },
      { id: 'memory', name: 'Memory', value: `${mem}/${caps.memory}`, sub: mem >= caps.memory ? 'full — build Memory Bank' : 'used / limit', tone: mem >= caps.memory ? 'warn' : '', tip: TIPS.memory },
    ],
    stability: Math.round(p.stability),
    stabilityTone: p.stability < B.economy.crashThreshold ? 'bad' : p.stability < 40 ? 'warn' : '',
    crashing: p.stability < B.economy.crashThreshold,
    ration: p.ration,
    codeNetPerMin: Math.round(net * 60),
    codeReserveSec: reserve,
  };
}

// ---------------- recovery panel (the master kit's "system stability" panel, wired to real state) ----------------
export interface RecoveryAction { id: string; label: string }
export interface RecoveryIssue { kind: 'starving' | 'codeLow' | 'brownout' | 'suspended' | 'memory' | 'crashing'; title: string; detail: string; actions: RecoveryAction[]; severity: 'warn' | 'danger' }

export function recoveryView(w: World, pid: number): RecoveryIssue[] {
  const p = w.players[pid];
  const top = topView(w, pid);
  const out: RecoveryIssue[] = [];
  const mine = w.entities.filter(e => !e.dead && e.owner === pid);
  const compilers = mine.filter(e => e.type === 'compiler');
  const idleRunners = mine.filter(e => e.type === 'runner' && !e.suspended && e.order?.type === 'idle');
  const suspended = mine.filter(e => e.kind === 'unit' && e.suspended);
  const crashed = suspended.filter(e => e.crashed);
  const drain = upkeepDrain(w, pid);
  const codeActions = (): RecoveryAction[] => {
    const a: RecoveryAction[] = [];
    if (p.ration !== 'lean') a.push({ id: 'ration-lean', label: 'Switch to Lean rations' });
    if (idleRunners.length) a.push({ id: 'suspend-idle', label: `Suspend ${idleRunners.length} idle Runner${idleRunners.length > 1 ? 's' : ''}` });
    a.push(compilers.length ? { id: 'select-compiler', label: 'Inspect a Compiler' } : { id: 'hint-compiler', label: 'Build a Compiler (select a Runner, C)' });
    return a;
  };
  // p.unmet is the engine's smoothed unmet-upkeep fraction: it catches both an empty stock and
  // intermittent hunger between Compiler batches.
  if ((p.code < 1 && drain > 0 && p.unmet > 0.02) || p.unmet > 0.08) {
    out.push({ kind: 'starving', severity: 'danger', title: 'Programs are starving', detail: `${Math.round(p.unmet * 100)}% of upkeep is going unmet (upkeep ${(drain * 60).toFixed(0)}/min). Stability is falling toward the crash line (${B.economy.crashThreshold}).`, actions: codeActions() });
  } else if (top.codeReserveSec !== null && top.codeReserveSec < B.economy.lowCodeWarnSec) {
    out.push({ kind: 'codeLow', severity: 'warn', title: `Code low · ~${top.codeReserveSec}s reserve`, detail: `Net ${top.codeNetPerMin}/min. The estimate assumes the current rate stays the same.`, actions: codeActions() });
  }
  if (top.crashing) out.push({ kind: 'crashing', severity: 'danger', title: `Stability ${top.stability} — programs crashing`, detail: `Below ${B.economy.crashThreshold}, one program crashes (auto-suspends) every ${B.economy.crashIntervalSec}s until Code is restored.`, actions: p.ration !== 'lean' ? [{ id: 'ration-lean', label: 'Switch to Lean rations' }] : [] });
  const demand = w.computeDemand(pid), supply = w.caps(pid).compute;
  if (demand > supply) {
    const rigs = mine.filter(e => e.type === 'rig' && e.built && e.active);
    const a: RecoveryAction[] = [];
    if (rigs.length) a.push({ id: 'rig-off', label: 'Switch off a Mining Rig' });
    a.push({ id: 'hint-node', label: 'Build a Compute Node (N)' });
    out.push({ kind: 'brownout', severity: 'warn', title: `Compute brownout · ${demand}/${supply}`, detail: `Rigs, towers and training run at ${Math.round(supply / demand * 100)}%.`, actions: a });
  }
  if (suspended.length) {
    const a: RecoveryAction[] = [{ id: 'select-suspended', label: 'Select them' }];
    if (p.code > 20 && !top.crashing) a.unshift({ id: 'resume-all', label: `Resume all ${suspended.length}` });
    out.push({ kind: 'suspended', severity: crashed.length ? 'danger' : 'warn', title: `${suspended.length} program${suspended.length > 1 ? 's' : ''} suspended${crashed.length ? ` (${crashed.length} crashed)` : ''}`, detail: 'Suspended programs eat no Code and do nothing. Restore the Code supply before resuming, or they may crash again.', actions: a });
  }
  const waiting = mine.some(e => e.kind === 'building' && e.stall === 'memFull');
  if (waiting) out.push({ kind: 'memory', severity: 'warn', title: 'Memory full', detail: 'Training is waiting for population room.', actions: [{ id: 'hint-bank', label: 'Build a Memory Bank (K)' }] });
  return out;
}

// ---------------- objectives ----------------
export interface Objective { text: string; hint: string; done: (w: World, pid: number) => boolean }
const count = (w: World, pid: number, f: (e: Entity) => boolean) => w.entities.filter(e => !e.dead && e.owner === pid && f(e)).length;
export const OBJECTIVES: Objective[] = [
  { text: 'Harvest Data', hint: 'Drag a box around your Runners (small circles), then right-click a glowing hexagon well.', done: (w, p) => count(w, p, e => e.type === 'runner' && e.order?.type === 'harvest') > 0 },
  { text: 'Build a Compiler', hint: 'Select a Runner, press C (or click Compiler in the command card), then click open ground near your Core.', done: (w, p) => count(w, p, e => e.type === 'compiler') > 0 },
  { text: 'Feed your programs', hint: 'A finished Compiler pulls in a Runner as its operator and turns Data into Code. Code is food: every program eats it.', done: (w, p) => w.entities.some(e => e.owner === p && e.type === 'compiler' && w.operatorPresent(e)) },
  { text: 'Grow to 7 Runners', hint: 'Select the Core and press Q to compile Runners (Data + Code). More hands = more Data.', done: (w, p) => count(w, p, e => e.type === 'runner') >= 7 },
  { text: 'Build a Mining Rig and a Memory Bank', hint: 'M = Mining Rig (mines Hash, needs an operator and 4 Compute). K = Memory Bank (+6 population room).', done: (w, p) => count(w, p, e => e.type === 'rig' && !!e.built) > 0 && count(w, p, e => e.type === 'bank' && !!e.built) > 0 },
  { text: 'Build a Training Grid and 4 combat programs', hint: 'T = Training Grid. Select it: Q Ping, W Bulwark, E Lancer, R Patcher, T Breaker. Each consumes a free Runner and costs Hash.', done: (w, p) => count(w, p, e => e.kind === 'unit' && e.type !== 'runner' && !e.forkOf) >= 4 },
  { text: 'Fortify a pass', hint: 'Select Runners, press W and drag across a pass in the void rift to lay Firewalls; add a Gate (G) so your army can pass. Enemies cannot open your gates.', done: (w, p) => count(w, p, e => e.type === 'wall' && !!e.built) >= 4 && count(w, p, e => e.type === 'gate' && !!e.built) >= 1 },
  { text: 'Raise a Sentry Tower', hint: 'R = Sentry Tower. Towers draw 2 Compute; in a brownout they fire slower — switch a Rig off (O) during a siege.', done: (w, p) => count(w, p, e => e.type === 'tower' && !!e.built) > 0 },
  { text: 'Destroy the Rival Core', hint: 'The first Rival wave usually comes around 6–7 minutes (never before 5:30). Hold, then push with Bulwarks in front, Lancers behind and Breakers to crack hardened walls, towers and the Core. F = Fork.', done: (w, p) => w.winner === p },
];

// ---------------- selection ----------------
export const STALL_TEXT: Record<string, string> = {
  noOperator: 'Idle — no operator. A free Runner (idle or harvesting) will be pulled in automatically; compile more Runners if none are free.',
  operatorSuspended: 'Operator is suspended. Resume it (Z) to restart work.',
  noData: 'Starved of Data — send Runners to harvest.',
  codeFull: 'Code storage is full. Build another Compiler or spend Code.',
  hashFull: 'Hash vault is full (600). Spend Hash on training or towers.',
  paused: 'Switched off (O to switch on). Switched-off buildings use no Compute and release their operator.',
  needRunner: 'Waiting for a free Runner to specialize (idle or harvesting). Compile more at the Core.',
  memFull: 'Memory full. Build a Memory Bank to raise the program limit.',
  spawnBlocked: 'Spawn blocked — clear space around the building.',
  brownout: 'Brownout: not enough Compute; training runs slower. Build a Compute Node or switch a Rig off.',
};

export function orderText(e: Entity): string {
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

export interface QueueView { unit: string; name: string; progress: number; refund: string }
export interface SelectionView {
  kind: 'none' | 'single' | 'multi';
  // single
  id?: number; type?: string; entityKind?: 'unit' | 'building' | 'well'; name?: string; role?: string; mine?: boolean; hpFrac?: number;
  facts?: [string, string][]; why?: string; queue?: QueueView[];
  // multi
  count?: number; groups?: { type: string; name: string; n: number }[];
}

export function selectionView(w: World, pid: number, ids: Iterable<number>): SelectionView {
  const sel = [...ids].map(id => w.get(id)).filter((e): e is Entity => !!e);
  if (!sel.length) return { kind: 'none' };
  if (sel.length > 1) {
    const by = new Map<string, number>();
    for (const e of sel) by.set(e.type, (by.get(e.type) ?? 0) + 1);
    const hp = sel.reduce((a, e) => a + e.hp, 0), mx = sel.reduce((a, e) => a + e.maxHp, 0);
    return { kind: 'multi', count: sel.length, hpFrac: mx ? hp / mx : 0, groups: [...by].map(([type, n]) => ({ type, n, name: (B.units[type] ?? B.buildings[type])?.name ?? type })) };
  }
  const e = sel[0];
  const mine = e.owner === pid;
  const facts: [string, string][] = [];
  const name = e.kind === 'unit' ? B.units[e.type].name : e.kind === 'building' ? B.buildings[e.type].name : e.type === 'fragment' ? 'Salvage Fragments' : 'Data Well';
  const role = e.kind === 'unit' ? B.units[e.type].role : e.kind === 'building' ? B.buildings[e.type].desc : 'Runners harvest 10 Data per trip. Wells run dry.';
  if (e.kind === 'well') facts.push(['Remaining', `${Math.floor(e.amount!)} / ${e.initial}`]);
  else facts.push(['Integrity', `${Math.ceil(e.hp)} / ${Math.round(e.maxHp)}`]);
  if (e.kind === 'unit') {
    const ud = B.units[e.type];
    facts.push(['State', orderText(e)]);
    facts.push(['Upkeep', `${ud.upkeep} Code / ${B.economy.upkeepCycleSec}s · Memory ${ud.mem}`]);
    if (ud.attack) facts.push(['Attack', `${ud.attack.dmg}${e.rank ? ` (+${Math.round(e.rank * B.veterancy.bonusPerRank * 100)}%)` : ''} every ${ud.attack.cd}s · range ${ud.attack.range}${ud.attack.siege ? ' · siege' : ''}`]);
    if (ud.heal) facts.push(['Repair', `${ud.heal.amt} every ${ud.heal.cd}s · range ${ud.heal.range}`]);
    facts.push(['Armor · Speed', `${ud.armor} · ${ud.speed}`]);
    if (e.type !== 'runner') facts.push(['Experience', `${e.kills ?? 0} kills · rank ${e.rank ?? 0}/2`]);
    if (e.forkOf && e.expires) facts.push(['Fork expires', `${Math.ceil((e.expires - w.tick) / B.tickRate)}s`]);
  }
  if (e.kind === 'building') {
    const bd = B.buildings[e.type];
    if (!e.built) facts.push(['Construction', `${Math.floor(e.progress! / bd.build * 100)}% — Runners build it`]);
    if (bd.operator) facts.push(['Operator', w.operatorPresent(e) ? 'working' : e.operator ? 'on the way' : 'none']);
    if (bd.compute) facts.push(['Compute', `${bd.compute}${bd.computeWhileTraining ? ' while training' : ''}`]);
    if (bd.provides) facts.push(['Provides', Object.entries(bd.provides).map(([k, v]) => `+${v} ${k}`).join(', ')]);
    if (bd.gate) facts.push(['Gate', e.open ? 'OPEN for your programs (enemies never pass)' : 'CLOSED to everyone']);
    if (bd.hardened) facts.push(['Hardened', 'Non-siege attacks deal 25%']);
  }
  let why: string | undefined;
  if (e.kind === 'building' && mine && e.stall && STALL_TEXT[e.stall]) why = STALL_TEXT[e.stall];
  if (e.kind === 'unit' && mine && e.suspended) why = orderText(e);
  const queue = e.queue && mine ? e.queue.map(q => ({ unit: q.unit, name: B.units[q.unit].name, progress: q.progress / B.units[q.unit].time, refund: 'Click to cancel (full refund' + (q.consumedRunner ? ', Runner returned' : '') + ')' })) : undefined;
  return {
    kind: 'single', id: e.id, type: e.type, entityKind: e.kind, name: `${name}${e.forkOf ? ' (Fork)' : ''}${!mine && e.owner ? ' — Rival' : ''}`, role, mine,
    hpFrac: e.kind === 'well' ? (e.amount! / e.initial!) : Math.max(0, e.hp / e.maxHp), facts, why, queue,
  };
}

export interface CommandView { id: string; label: string; key?: string; cost?: Cost; costShort?: string; enabled: boolean; title: string }
export function costShort(c?: Cost) { return c ? costText(c).replace(/ Data/g, 'D').replace(/ Code/g, 'C').replace(/ Hash/g, 'H') : undefined; }
