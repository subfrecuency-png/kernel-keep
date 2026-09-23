// Client entry: menus, input, camera, main loop. Presentation only — all rules live in src/sim.
import { B, Command, CommandResult, DT, Entity } from '../sim/types.ts';
import { Game } from '../sim/game.ts';
import { saveGame, loadGame, SaveFile } from '../sim/save.ts';
import { ClientState, COLORS } from './state.ts';
import { render, renderMinimap, wallLine } from './render.ts';
import { updateTopbar, updateAlerts, updateObjectives, updateSelection, updateCommands, resetHudCaches, CmdButton, fmtTime } from './hud.ts';
import { loadSettings, saveSettings, ACTIONS, keyName, defaultSettings } from './settings.ts';
import { sfx, setAudio } from './audio.ts';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const mini = document.getElementById('mini') as HTMLCanvasElement;
const mctx = mini.getContext('2d')!;
const $ = (id: string) => document.getElementById(id)!;
const AUTOSAVE = 'kernelkeep.autosave.v1', SLOT = 'kernelkeep.slot1.v1';

let cs: ClientState | null = null;
const settings = loadSettings();
applySettings();

function applySettings() {
  document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  setAudio(settings.volume, settings.muted);
  saveSettings(settings);
}

// ======================================================================
// Match lifecycle
// ======================================================================
function startMatch(game: Game) {
  const w = game.world;
  const core = w.coreOf(1)!;
  const z = 30;
  cs = {
    game, me: 1, cam: { x: core.x - innerWidth / z / 2, y: core.y - (innerHeight - 200) / z / 2, z }, sel: new Set(), groups: {}, prev: new Map(), alpha: 0,
    mouse: { sx: 0, sy: 0, wx: 0, wy: 0, inView: false }, fx: [], settings, paused: false, speed: 1, showPerf: false, fps: 60, time: 0, hudDirty: true, over: !!w.winner,
  };
  resetHudCaches();
  $('hud').classList.remove('hidden');
  hideModal();
  resize();
  (window as any).__kk = testHooks();
}

function newMatch(difficulty: 'easy' | 'normal', seed = (Date.now() % 100000)) {
  startMatch(new Game({ seed, difficulty, players: [{ name: 'You', ai: false }, { name: 'Rival Kernel', ai: true }] }));
  toast(`New match — seed ${seed}, ${difficulty}. Build, feed, fortify.`, true);
}

function issue(c: Omit<Command, 'player'> & Record<string, any>, quiet = false): CommandResult {
  if (!cs) return { ok: false, reason: 'no game' };
  const r = cs.game.issue({ ...(c as any), player: cs.me });
  if (!r.ok) { if (!quiet) { toast(r.reason ?? 'Cannot do that.'); sfx.deny(); } }
  else if (!quiet) sfx.order();
  return r;
}

// ======================================================================
// Main loop
// ======================================================================
let acc = 0, last = performance.now(), frames = 0, fpsT = 0, autosaveT = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (!cs) { drawTitleBackdrop(now); return; }
  cs.time += dt;
  frames++; fpsT += dt; if (fpsT >= 1) { cs.fps = frames / fpsT; frames = 0; fpsT = 0; }
  const w = cs.game.world;
  if (!cs.paused && !w.winner) {
    acc += dt * cs.speed;
    let steps = 0;
    while (acc >= DT && steps < 8) {
      cs.prev.clear();
      for (const e of w.entities) if (e.kind === 'unit') cs.prev.set(e.id, { x: e.x, y: e.y });
      cs.game.step(); steps++;
      handleEvents();
      acc -= DT;
    }
    if (steps === 8) acc = 0;
  }
  cs.alpha = cs.paused ? 1 : Math.min(1, acc / DT);
  // camera keys + edge scroll
  const pan = 18 * dt / (cs.cam.z / 30);
  const k = settings.keys;
  if (held.has(k.camUp)) cs.cam.y -= pan; if (held.has(k.camDown)) cs.cam.y += pan;
  if (held.has(k.camLeft)) cs.cam.x -= pan; if (held.has(k.camRight)) cs.cam.x += pan;
  if (settings.edgeScroll && cs.mouse.inView && document.hasFocus()) {
    const m = 6;
    if (cs.mouse.sx < m) cs.cam.x -= pan; if (cs.mouse.sx > innerWidth - m) cs.cam.x += pan;
    if (cs.mouse.sy < m) cs.cam.y -= pan; if (cs.mouse.sy > innerHeight - m) cs.cam.y += pan;
  }
  clampCam();
  // effects
  for (const f of cs.fx) f.t += dt;
  cs.fx = cs.fx.filter(f => f.t < f.life);
  // selection hygiene
  for (const id of [...cs.sel]) if (!w.get(id)) cs.sel.delete(id);
  if (cs.placing) { const t = tileAt(cs.mouse.sx, cs.mouse.sy); cs.placing.tx = t.tx - Math.floor((B.buildings[cs.placing.type].w - 1) / 2); cs.placing.ty = t.ty - Math.floor((B.buildings[cs.placing.type].h - 1) / 2); }
  render(ctx, cs, canvas.width, canvas.height);
  if (frames % 3 === 0) renderMinimap(mctx, cs, canvas.width, canvas.height);
  updateTopbar(cs);
  updateAlerts(cs, jump);
  updateObjectives(cs);
  updateSelection(cs, t => { cs!.sel = new Set([...cs!.sel].filter(id => cs!.game.world.get(id)?.type === t)); }, (b, i) => issue({ t: 'cancelTrain', building: b, index: i }));
  updateCommands(cs, commandButtons());
  const perf = $('perf'); perf.classList.toggle('hidden', !cs.showPerf);
  if (cs.showPerf) perf.textContent = `${cs.fps.toFixed(0)} fps · sim ${cs.game.perf.avgStepMs.toFixed(2)} ms/tick (max ${cs.game.perf.maxStepMs.toFixed(1)}) · ${w.entities.filter(e => e.kind === 'unit').length} units · tick ${w.tick}`;
  if (w.winner && !cs.over) { cs.over = true; gameOver(); }
  autosaveT += dt; if (autosaveT > 60 && !w.winner) { autosaveT = 0; try { localStorage.setItem(AUTOSAVE, JSON.stringify(saveGame(cs.game))); } catch { /* ignore */ } }
}

function handleEvents() {
  const w = cs!.game.world; const me = cs!.me;
  for (const ev of w.events) {
    switch (ev.t) {
      case 'shot': {
        const visible = w.isVisible(me, ev.x1, ev.y1) || w.isVisible(me, ev.x2, ev.y2);
        if (!visible) break;
        cs!.fx.push({ kind: ev.heal ? 'heal' : ev.siege ? 'siege' : 'beam', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, t: 0, life: ev.siege ? 0.35 : 0.14, color: ev.heal ? '#6dffa8' : COLORS[ev.owner].main });
        if (!ev.heal) sfx.shot(ev.siege);
        break;
      }
      case 'death':
        if (!w.isVisible(me, ev.x, ev.y) && ev.owner !== me) break;
        if (ev.type === 'absorbed') { cs!.fx.push({ kind: 'ring', x: ev.x, y: ev.y, t: 0, life: 0.5, color: '#ffffff' }); break; }
        cs!.fx.push({ kind: 'burst', x: ev.x, y: ev.y, t: 0, life: ev.kind === 'building' ? 0.9 : 0.5, color: ev.kind === 'well' ? '#7cc7ff' : COLORS[ev.owner]?.main ?? '#fff' });
        if (ev.kind !== 'well') sfx.death();
        break;
      case 'built': if (ev.owner === me) { const e = w.get(ev.id); if (e) cs!.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.8, color: '#ffffff' }); if (e && !B.buildings[e.type].wall) sfx.built(); } break;
      case 'spawn': if (ev.owner === me) sfx.spawn(); break;
      case 'deposit': if (ev.owner === me) cs!.fx.push({ kind: 'text', x: ev.x, y: ev.y - 0.4, t: 0, life: 0.9, color: '#7cc7ff', text: '+Data' }); break;
      case 'produce': if (ev.owner === me) { const e = w.get(ev.id); if (e) cs!.fx.push({ kind: 'text', x: e.x, y: e.y - 0.8, t: 0, life: 1.1, color: ev.res === 'code' ? '#9cff8a' : '#ffcf5a', text: ev.res === 'code' ? '+Code' : '+Hash' }); } break;
      case 'alert':
        if (ev.owner !== me) break;
        if (ev.alert.x !== undefined) cs!.lastAlert = { x: ev.alert.x, y: ev.alert.y! };
        if (ev.alert.kind === 'attacked') sfx.attacked(); else if (ev.alert.severity !== 'info') sfx.warn();
        break;
    }
  }
}

// ======================================================================
// Camera & coordinates
// ======================================================================
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (cs) (cs as any).dpr = dpr;
}
addEventListener('resize', resize);
function dpr() { return canvas.width / innerWidth; }
function screenToWorld(sx: number, sy: number) { const d = dpr(); return { x: cs!.cam.x + sx * d / cs!.cam.z, y: cs!.cam.y + sy * d / cs!.cam.z }; }
function tileAt(sx: number, sy: number) { const p = screenToWorld(sx, sy); return { tx: Math.floor(p.x), ty: Math.floor(p.y) }; }
function clampCam() {
  if (!cs) return; const w = cs.game.world; const vw = canvas.width / cs.cam.z, vh = canvas.height / cs.cam.z;
  cs.cam.x = Math.max(-vw * 0.3, Math.min(w.map.w - vw * 0.7, cs.cam.x));
  cs.cam.y = Math.max(-vh * 0.3, Math.min(w.map.h - vh * 0.5, cs.cam.y));
}
function jump(x: number, y: number) { if (!cs) return; cs.cam.x = x - canvas.width / cs.cam.z / 2; cs.cam.y = y - canvas.height / cs.cam.z / 2 + 2; }

function pick(sx: number, sy: number): Entity | undefined {
  const w = cs!.game.world; const p = screenToWorld(sx, sy);
  let best: Entity | undefined, bd = 0.8;
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'unit') {
      if (e.owner !== cs!.me && !w.canSee(cs!.me, e)) continue;
      const d = Math.sqrt((e.x - p.x) ** 2 + (e.y - p.y) ** 2) - B.units[e.type].radius;
      if (d < bd) { bd = d; best = e; }
    }
  }
  if (best) return best;
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'building') {
      if (e.owner !== cs!.me && !w.canSee(cs!.me, e)) continue;
      if (p.x >= e.tx! && p.x < e.tx! + e.w! && p.y >= e.ty! - 0.4 && p.y < e.ty! + e.h!) return e;
    } else if (e.kind === 'well') {
      if (!w.players[cs!.me].explored[Math.floor(e.y) * w.map.w + Math.floor(e.x)]) continue;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < 0.6) return e;
    }
  }
  return undefined;
}

// ======================================================================
// Input
// ======================================================================
const held = new Set<string>();
let dragStart: { sx: number; sy: number } | null = null, midDrag: { sx: number; sy: number; cx: number; cy: number } | null = null;
let lastClick = { t: 0, id: 0 };
let lastGroupTap = { k: '', t: 0 };

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousemove', e => {
  if (!cs) return;
  cs.mouse.sx = e.clientX; cs.mouse.sy = e.clientY; cs.mouse.inView = true;
  const p = screenToWorld(e.clientX, e.clientY); cs.mouse.wx = p.x; cs.mouse.wy = p.y;
  const d = dpr();
  if (dragStart && !cs.placing) cs.box = { x0: dragStart.sx * d, y0: dragStart.sy * d, x1: e.clientX * d, y1: e.clientY * d };
  if (midDrag) { cs.cam.x = midDrag.cx - (e.clientX - midDrag.sx) * d / cs.cam.z; cs.cam.y = midDrag.cy - (e.clientY - midDrag.sy) * d / cs.cam.z; }
});
canvas.addEventListener('mouseleave', () => { if (cs) cs.mouse.inView = false; });
canvas.addEventListener('mousedown', e => {
  if (!cs) return;
  if (e.button === 1) { midDrag = { sx: e.clientX, sy: e.clientY, cx: cs.cam.x, cy: cs.cam.y }; e.preventDefault(); return; }
  if (e.button === 0) {
    if (cs.placing) {
      const d = B.buildings[cs.placing.type];
      if (d.wall) { cs.placing.dragStart = { tx: cs.placing.tx, ty: cs.placing.ty }; return; }
      placeAt(cs.placing.tx, cs.placing.ty, e.shiftKey);
      return;
    }
    if (cs.mode === 'attackMove') { const p = screenToWorld(e.clientX, e.clientY); attackMoveTo(p.x, p.y); if (!e.shiftKey) cs.mode = undefined; return; }
    dragStart = { sx: e.clientX, sy: e.clientY };
  }
  if (e.button === 2) {
    if (cs.placing || cs.mode) { cs.placing = undefined; cs.mode = undefined; return; }
    rightClick(e.clientX, e.clientY);
  }
});
addEventListener('mouseup', e => {
  if (!cs) return;
  if (e.button === 1) midDrag = null;
  if (e.button !== 0) return;
  if (cs.placing?.dragStart) {
    const tiles = wallLine(cs.placing.dragStart, { tx: cs.placing.tx, ty: cs.placing.ty });
    const builders = selectedOwn().filter(u => u.type === 'runner').map(u => u.id);
    let placed = 0, lastReason = '';
    for (const t of tiles) { const r = cs.game.issue({ t: 'place', building: cs.placing.type, tx: t.tx, ty: t.ty, ids: builders, player: cs.me }); if (r.ok) placed++; else lastReason = r.reason ?? ''; }
    if (placed) { sfx.order(); toast(`${placed} ${B.buildings[cs.placing.type].name} segment${placed > 1 ? 's' : ''} placed.` + (placed < tiles.length ? ` ${tiles.length - placed} skipped: ${lastReason}` : ''), true); }
    else { sfx.deny(); toast(lastReason || 'Cannot place here.'); }
    if (!e.shiftKey) cs.placing = undefined; else cs.placing.dragStart = undefined;
    return;
  }
  if (!dragStart) return;
  const d = dpr();
  const box = cs.box; cs.box = undefined;
  const add = e.shiftKey;
  if (box && Math.abs(box.x1 - box.x0) + Math.abs(box.y1 - box.y0) > 8) {
    const a = screenToWorld(Math.min(box.x0, box.x1) / d, Math.min(box.y0, box.y1) / d), b = screenToWorld(Math.max(box.x0, box.x1) / d, Math.max(box.y0, box.y1) / d);
    const inBox = cs.game.world.entities.filter(u => u.kind === 'unit' && !u.dead && u.owner === cs!.me && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y);
    // prefer combat programs when a mixed box is dragged
    const combat = inBox.filter(u => u.type !== 'runner');
    const chosen = combat.length && combat.length < inBox.length && !add ? combat : inBox;
    if (!add) cs.sel.clear();
    for (const u of chosen) cs.sel.add(u.id);
    if (chosen.length) sfx.click();
  } else {
    const hit = pick(e.clientX, e.clientY);
    const now = performance.now();
    if (hit && lastClick.id === hit.id && now - lastClick.t < 350 && hit.owner === cs.me) {
      // double-click: all of this type on screen
      const vw = canvas.width / cs.cam.z, vh = canvas.height / cs.cam.z;
      for (const u of cs.game.world.entities) if (!u.dead && u.owner === cs.me && u.type === hit.type && u.x >= cs.cam.x && u.x <= cs.cam.x + vw && u.y >= cs.cam.y && u.y <= cs.cam.y + vh) cs.sel.add(u.id);
    } else {
      if (!add) cs.sel.clear();
      if (hit) { if (add && cs.sel.has(hit.id)) cs.sel.delete(hit.id); else cs.sel.add(hit.id); sfx.click(); }
    }
    lastClick = { t: now, id: hit?.id ?? 0 };
  }
  dragStart = null;
});
canvas.addEventListener('wheel', e => {
  if (!cs) return; e.preventDefault();
  const before = screenToWorld(e.clientX, e.clientY);
  cs.cam.z = Math.max(12, Math.min(64, cs.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
  const after = screenToWorld(e.clientX, e.clientY);
  cs.cam.x += before.x - after.x; cs.cam.y += before.y - after.y;
}, { passive: false });

function miniToWorld(e: MouseEvent) { const r = mini.getBoundingClientRect(); const w = cs!.game.world; return { x: (e.clientX - r.left) / r.width * w.map.w, y: (e.clientY - r.top) / r.height * w.map.h }; }
let miniDrag = false;
mini.addEventListener('contextmenu', e => e.preventDefault());
mini.addEventListener('mousedown', e => {
  if (!cs) return; const p = miniToWorld(e);
  if (e.button === 0) { miniDrag = true; jump(p.x, p.y); }
  if (e.button === 2) { const us = selectedOwn().filter(u => u.kind === 'unit'); if (us.length) { issue({ t: cs.mode === 'attackMove' ? 'attackMove' : 'move', ids: us.map(u => u.id), x: p.x, y: p.y }); cs.mode = undefined; } }
});
mini.addEventListener('mousemove', e => { if (miniDrag && cs) { const p = miniToWorld(e); jump(p.x, p.y); } });
addEventListener('mouseup', () => { miniDrag = false; });

function selectedOwn(): Entity[] { if (!cs) return []; const w = cs.game.world; return [...cs.sel].map(id => w.get(id)).filter((e): e is Entity => !!e && e.owner === cs!.me); }

function rightClick(sx: number, sy: number) {
  const w = cs!.game.world; const own = selectedOwn();
  const units = own.filter(e => e.kind === 'unit');
  const p = screenToWorld(sx, sy);
  const target = pick(sx, sy);
  if (!units.length) {
    const b = own.find(e => e.kind === 'building' && B.buildings[e.type].trains);
    if (b) { issue({ t: 'rally', building: b.id, x: p.x, y: p.y }); marker(p.x, p.y, '#ffffff'); }
    return;
  }
  const runners = units.filter(u => u.type === 'runner');
  const fighters = units.filter(u => u.type !== 'runner');
  if (target && target.owner !== cs!.me && target.owner !== 0) {
    issue({ t: 'attack', ids: units.map(u => u.id), target: target.id }); marker(target.x, target.y, '#ff4f6d'); return;
  }
  if (target && target.kind === 'well') {
    if (runners.length) issue({ t: 'harvest', ids: runners.map(u => u.id), target: target.id }, fighters.length > 0);
    if (fighters.length) issue({ t: 'move', ids: fighters.map(u => u.id), x: p.x, y: p.y });
    marker(target.x, target.y, '#7cc7ff'); return;
  }
  if (target && target.kind === 'building' && target.owner === cs!.me && runners.length) {
    const bd = B.buildings[target.type];
    let r: CommandResult | undefined;
    if (!target.built) r = issue({ t: 'assist', ids: runners.map(u => u.id), target: target.id });
    else if (target.hp < target.maxHp) r = issue({ t: 'repair', ids: runners.map(u => u.id), target: target.id });
    else if (bd.operator) r = issue({ t: 'operate', ids: [runners[0].id], target: target.id });
    else if (bd.dropoff) r = issue({ t: 'move', ids: runners.map(u => u.id), x: p.x, y: p.y });
    if (fighters.length) issue({ t: 'move', ids: fighters.map(u => u.id), x: p.x, y: p.y }, true);
    if (r) { marker(target.x, target.y, '#6dffa8'); return; }
  }
  issue({ t: 'move', ids: units.map(u => u.id), x: p.x, y: p.y });
  marker(p.x, p.y, '#6dffa8');
}
function attackMoveTo(x: number, y: number) {
  const us = selectedOwn().filter(u => u.kind === 'unit');
  if (!us.length) return;
  issue({ t: 'attackMove', ids: us.map(u => u.id), x, y }); marker(x, y, '#ff4f6d');
}
function marker(x: number, y: number, color: string) { cs!.fx.push({ kind: 'marker', x, y, t: 0, life: 0.5, color }); }

function placeAt(tx: number, ty: number, keep: boolean) {
  const builders = selectedOwn().filter(u => u.type === 'runner').map(u => u.id);
  const r = issue({ t: 'place', building: cs!.placing!.type, tx, ty, ids: builders });
  if (r.ok && !keep) cs!.placing = undefined;
}

function startPlacing(type: string) {
  if (!cs) return;
  const runners = selectedOwn().filter(u => u.type === 'runner');
  if (!runners.length) { toast('Select one or more Runners first — they build it.'); sfx.deny(); return; }
  cs.placing = { type, tx: 0, ty: 0, ok: false }; cs.mode = undefined;
}

// ======================================================================
// Command card (context sensitive)
// ======================================================================
const BUILD_ORDER = ['compiler', 'rig', 'node', 'bank', 'cache', 'grid', 'tower', 'wall', 'gate'];
function commandButtons(): CmdButton[] {
  if (!cs) return [];
  const w = cs.game.world; const own = selectedOwn(); const k = settings.keys;
  const out: CmdButton[] = [];
  const units = own.filter(e => e.kind === 'unit');
  const buildings = own.filter(e => e.kind === 'building');
  const ids = units.map(u => u.id);
  if (units.length) {
    const runners = units.filter(u => u.type === 'runner');
    if (runners.length === units.length) {
      for (const t of BUILD_ORDER) {
        const d = B.buildings[t];
        out.push({ id: 'build_' + t, label: d.name, key: k['build_' + t], cost: d.cost, enabled: w.canAfford(cs.me, d.cost), title: d.desc, run: () => startPlacing(t) });
      }
    } else {
      out.push({ id: 'attackMove', label: 'Attack-move', key: k.attackMove, enabled: true, title: 'Move and fight anything met on the way. Click a destination.', run: () => { cs!.mode = 'attackMove'; } });
      out.push({ id: 'hold', label: 'Hold', key: k.hold, enabled: true, title: 'Hold position; fight only what is in range.', run: () => issue({ t: 'hold', ids }) });
      const p = w.players[cs.me];
      const ready = w.tick >= p.forkReadyTick;
      out.push({ id: 'fork', label: ready ? 'Fork' : `Fork ${Math.ceil((p.forkReadyTick - w.tick) / B.tickRate)}s`, key: k.fork, cost: B.fork.cost, enabled: ready && w.canAfford(cs.me, B.fork.cost),
        title: `COMMANDER POWER — Fork: create temporary copies of up to ${B.fork.maxUnits} selected combat programs for ${B.fork.durationSec}s at ${B.fork.hpFraction * 100}% of their integrity. Forks eat no Code and use no Memory, but they draw +${B.fork.computeSurge} Compute while alive (brownout risk) and vanish if their original dies. Recharge ${B.fork.cooldownSec}s.`,
        run: () => issue({ t: 'fork', ids }) });
    }
    out.push({ id: 'stop', label: 'Stop', key: k.stop, enabled: true, title: 'Stop current order.', run: () => issue({ t: 'stop', ids }) });
    const anySusp = units.some(u => u.suspended);
    out.push({ id: 'suspend', label: anySusp ? 'Resume' : 'Suspend', key: k.suspend, enabled: true, title: 'Suspended programs eat no Code and do nothing. Use it to survive a Code shortage; resume when fed.', run: () => issue({ t: 'suspend', ids, on: !anySusp }) });
    out.push({ id: 'decompile', label: 'Decompile', key: k.decompile, enabled: true, title: 'Permanently delete the selected programs (frees Memory and upkeep, no refund).', run: () => issue({ t: 'decompile', ids }) });
    return out;
  }
  if (buildings.length === 1) {
    const b = buildings[0]; const d = B.buildings[b.type];
    if (b.built && d.trains) {
      d.trains.forEach((u, i) => {
        const ud = B.units[u];
        out.push({ id: 'train_' + u, label: ud.name, key: k['train' + (i + 1)], cost: ud.cost, enabled: w.canAfford(cs!.me, ud.cost), title: `${ud.role}. HP ${ud.hp}, Memory ${ud.mem}, upkeep ${ud.upkeep}.${ud.needsRunner ? ' Consumes a free Runner.' : ''}`, run: () => issue({ t: 'train', building: b.id, unit: u }) });
      });
    }
    if (b.built && (d.operator || d.compute)) out.push({ id: 'toggle', label: b.active ? 'Switch off' : 'Switch on', key: k.toggle, enabled: true, title: 'Switched-off buildings use no Compute and release their operator.', run: () => issue({ t: 'toggleActive', building: b.id }) });
    if (b.built && d.gate) out.push({ id: 'toggle', label: b.open ? 'Close gate' : 'Open gate', key: k.toggle, enabled: true, title: 'Open: your programs pass, enemies never do. Closed: nobody passes.', run: () => issue({ t: 'gate', building: b.id, open: !b.open }) });
    if (b.type !== 'core') out.push({ id: 'decompile', label: b.built ? 'Demolish' : 'Cancel', key: k.decompile, enabled: true, title: b.built ? `Demolish (refund ${B.economy.demolishRefund * 100}% of cost).` : 'Cancel construction (full refund).', run: () => issue({ t: b.built ? 'demolish' : 'cancelBuild', building: b.id }) });
  }
  return out;
}

// ======================================================================
// Keyboard
// ======================================================================
addEventListener('keydown', e => {
  if (rebinding) { e.preventDefault(); finishRebind(e.key); return; }
  if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
  if (e.key === 'F1') { e.preventDefault(); showControls(); return; }
  if (!cs) return;
  const k = settings.keys; const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  held.add(key.length === 1 ? key : e.key);
  if (e.key === 'Escape') { if (cs.placing || cs.mode) { cs.placing = undefined; cs.mode = undefined; } else if ($('modal').classList.contains('hidden')) showPauseMenu(); else if (!cs.over) { hideModal(); } return; }
  if (!$('modal').classList.contains('hidden')) return;
  // control groups
  if (/^[0-9]$/.test(e.key)) {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); cs.groups[e.key] = [...cs.sel]; toast(`Group ${e.key} set (${cs.sel.size}).`, true); return; }
    const g = (cs.groups[e.key] ?? []).filter(id => cs!.game.world.get(id));
    if (g.length) {
      cs.sel = new Set(g);
      const now = performance.now();
      if (lastGroupTap.k === e.key && now - lastGroupTap.t < 350) { const u = cs.game.world.get(g[0])!; jump(u.x, u.y); }
      lastGroupTap = { k: e.key, t: now };
    }
    return;
  }
  if (key === k.perf) { e.preventDefault(); cs.showPerf = !cs.showPerf; return; }
  if (key === k.pause) { cs.paused = !cs.paused; return; }
  if (key === k.centerCore) { const c = cs.game.world.coreOf(cs.me); if (c) jump(c.x, c.y); return; }
  if (key === k.lastAlert) { e.preventDefault(); if (cs.lastAlert) jump(cs.lastAlert.x, cs.lastAlert.y); return; }
  if (key === k.idleRunner) {
    const idle = cs.game.world.entities.filter(u => u.owner === cs!.me && u.type === 'runner' && !u.dead && u.order?.type === 'idle' && !u.suspended);
    if (idle.length) { const u = idle[(Math.floor(performance.now() / 300)) % idle.length]; cs.sel = new Set([u.id]); jump(u.x, u.y); } else toast('No idle Runners.', true);
    return;
  }
  // context commands: match against the visible command card
  for (const b of commandButtons()) {
    if (b.key && b.key === key) { e.preventDefault(); b.run(); return; }
  }
});
addEventListener('keyup', e => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; held.delete(key); held.delete(e.key); });
addEventListener('blur', () => held.clear());

// ======================================================================
// Top bar buttons
// ======================================================================
for (const b of Array.from(document.querySelectorAll('#rations button'))) (b as HTMLElement).onclick = () => issue({ t: 'ration', level: (b as HTMLElement).dataset.r as any });
$('b-pause').onclick = () => { if (cs) cs.paused = !cs.paused; };
$('b-speed').onclick = () => { if (cs) cs.speed = cs.speed === 1 ? 1.5 : cs.speed === 1.5 ? 2 : 1; };
$('b-menu').onclick = () => showPauseMenu();
$('b-obj').onclick = () => { const l = $('objlist'); l.classList.toggle('hidden'); $('b-obj').textContent = l.classList.contains('hidden') ? 'show' : 'hide'; };

// ======================================================================
// Modals: title, pause, settings, controls, game over
// ======================================================================
function modal(html: string) { $('modalCard').innerHTML = html; $('modal').classList.remove('hidden'); }
function hideModal() { $('modal').classList.add('hidden'); }
function btn(id: string, fn: () => void) { const el = document.getElementById(id); if (el) el.onclick = fn; }

let chosenDiff: 'easy' | 'normal' = 'normal';
function showTitle() {
  if (cs) { cs = null; $('hud').classList.add('hidden'); }
  let hasAuto = false; try { hasAuto = !!localStorage.getItem(AUTOSAVE); } catch { /* ignore */ }
  modal(`<h1>KERNEL KEEP</h1><div class="tag">provisional title · prototype 0.1 · offline single-player</div>
  <p>You rule a civilization of programs inside a luminous machine. Harvest <b style="color:var(--data)">Data</b>, compile it into <b style="color:var(--code)">Code</b> to feed your people,
  mine <b style="color:var(--hash)">Hash Credits</b> to arm them, balance scarce <b style="color:var(--compute)">Compute</b>, raise Firewalls and Sentry Towers across the rift — then break the Rival Kernel's Core.</p>
  <div class="row"><span class="tag" style="align-self:center">Rival difficulty:</span><button class="btn" id="d-easy">Easy</button><button class="btn" id="d-normal">Normal</button></div>
  <div class="row"><button class="btn primary" id="t-new">New match</button>${hasAuto ? '<button class="btn" id="t-cont">Continue (autosave)</button>' : ''}<button class="btn" id="t-load">Load save file…</button><button class="btn" id="t-how">How to play</button><button class="btn" id="t-set">Settings</button></div>
  <p class="tag">Hash Credits are fictional, match-local currency. Nothing here mines, trades or connects to anything real. No account or internet needed.</p>`);
  const setD = (d: 'easy' | 'normal') => { chosenDiff = d; $('d-easy').classList.toggle('sel', d === 'easy'); $('d-normal').classList.toggle('sel', d === 'normal'); };
  setD(chosenDiff);
  btn('d-easy', () => setD('easy')); btn('d-normal', () => setD('normal'));
  btn('t-new', () => newMatch(chosenDiff));
  btn('t-cont', () => { try { startMatch(loadGame(JSON.parse(localStorage.getItem(AUTOSAVE)!))); toast('Autosave restored.', true); } catch (err) { toast('Autosave unreadable: ' + (err as Error).message); } });
  btn('t-load', () => importFile());
  btn('t-how', () => showHowTo(showTitle));
  btn('t-set', () => showSettings(showTitle));
}
function showHowTo(back: () => void) {
  modal(`<h2>How to play</h2>
  <div class="legend">
  <b>Goal</b><span>Destroy the Rival Core (top-right). Lose your Core and you lose.</span>
  <b>Data</b><span>Runners harvest glowing hexagon wells and carry Data to the Core or a Data Cache. Wells run dry; fight for the centre.</span>
  <b>Code = food</b><span>Every program eats Code. Compilers (staffed by a Runner) turn Data into Code. If Code runs out, Stability falls; below 20 programs crash (auto-suspend). Recover with Lean rations, more Compilers, or by Suspending idle programs.</span>
  <b>Hash</b><span>Mining Rigs mine fictional Hash Credits. Each extra Rig yields 15% less, and every Rig needs an operator and 4 Compute.</span>
  <b>Compute</b><span>Rigs, Towers and a training Grid share Compute. Over-demand causes a brownout that slows all of them — so greed for Hash weakens your defences. Switch a Rig off (O) in a siege.</span>
  <b>Army</b><span>The Training Grid specializes a free Runner into a Ping, Bulwark, Lancer, Patcher or Breaker. Veterans rank up after 2 and 5 kills.</span>
  <b>Walls</b><span>Firewalls, Gates and Towers are hardened: only Breakers hurt them properly. Enemies never pass your gates; they must break a wall or gate.</span>
  <b>Fork</b><span>Commander power: temporary copies of selected fighters for 25s. Costs 60 Hash, surges Compute, forks die with their originals.</span>
  <b>Mouse</b><span>Left-click/drag select · right-click = smart order (move, attack, harvest, build, repair, operate) · wheel zoom · middle-drag pan · minimap click/right-click.</span>
  <b>Keys</b><span>A attack-move · S stop · H hold · F fork · Z suspend · O switch/gate · Del decompile · Ctrl+1–9 groups · P pause · Space last alert · . idle Runner · Home Core · F1 controls. All rebindable in Settings.</span>
  </div><div class="row"><button class="btn primary" id="h-back">Back</button></div>`);
  btn('h-back', back);
}
function showPauseMenu() {
  if (!cs) return;
  const wasPaused = cs.paused; cs.paused = true;
  modal(`<h2>Paused — ${fmtTime(cs.game.world.tick)}</h2>
  <div class="row"><button class="btn primary" id="p-resume">Resume</button><button class="btn" id="p-save">Quick save</button><button class="btn" id="p-load">Quick load</button><button class="btn" id="p-export">Export save file</button><button class="btn" id="p-import">Import save file</button></div>
  <div class="row"><button class="btn" id="p-restart">Restart match</button><button class="btn" id="p-how">How to play</button><button class="btn" id="p-set">Settings & controls</button><button class="btn" id="p-quit">Quit to title</button></div>
  <p class="tag">Seed ${cs.game.world.seed} · ${cs.game.world.difficulty} · build uses balance v${B.version}. Autosave every 60s.</p>`);
  btn('p-resume', () => { hideModal(); cs!.paused = wasPaused && false; });
  btn('p-save', () => { try { localStorage.setItem(SLOT, JSON.stringify(saveGame(cs!.game))); toast('Saved.', true); } catch (err) { toast('Save failed: ' + (err as Error).message); } });
  btn('p-load', () => { try { const raw = localStorage.getItem(SLOT); if (!raw) { toast('No quick save yet.'); return; } startMatch(loadGame(JSON.parse(raw))); cs!.paused = true; toast('Loaded (paused).', true); } catch (err) { toast('Load failed: ' + (err as Error).message); } });
  btn('p-export', () => exportFile());
  btn('p-import', () => importFile());
  btn('p-restart', () => newMatch(cs!.game.world.difficulty, cs!.game.world.seed));
  btn('p-how', () => showHowTo(showPauseMenu));
  btn('p-set', () => showSettings(showPauseMenu));
  btn('p-quit', () => showTitle());
}
function exportFile() {
  if (!cs) return;
  const blob = new Blob([JSON.stringify(saveGame(cs.game))], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kernel-keep-${fmtTime(cs.game.world.tick).replace(':', 'm')}s.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importFile() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try { const s = JSON.parse(await f.text()) as SaveFile; startMatch(loadGame(s)); cs!.paused = true; toast('Save loaded (paused).', true); }
    catch (err) { toast('Could not load: ' + (err as Error).message); }
  };
  inp.click();
}

let rebinding: string | null = null; let rebindBack: (() => void) | null = null;
function finishRebind(key: string) {
  if (key !== 'Escape' && rebinding) settings.keys[rebinding] = key.length === 1 ? key.toLowerCase() : key;
  rebinding = null; applySettings(); if (rebindBack) showControls(rebindBack);
}
function showSettings(back: () => void) {
  modal(`<h2>Settings</h2>
  <label class="set">Interface scale <input type="range" id="s-scale" min="0.8" max="1.6" step="0.05" value="${settings.uiScale}"><span id="s-scale-v">${settings.uiScale.toFixed(2)}×</span></label>
  <label class="set"><input type="checkbox" id="s-flash" ${settings.reducedFlash ? 'checked' : ''}> Reduced flashing and motion (no pulsing, no animated glyphs)</label>
  <label class="set"><input type="checkbox" id="s-edge" ${settings.edgeScroll ? 'checked' : ''}> Edge-of-screen camera scrolling</label>
  <label class="set"><input type="checkbox" id="s-hints" ${settings.showHints ? 'checked' : ''}> Show objective hints</label>
  <label class="set">Volume <input type="range" id="s-vol" min="0" max="1" step="0.05" value="${settings.volume}"> <input type="checkbox" id="s-mute" ${settings.muted ? 'checked' : ''}> mute</label>
  <div class="row"><button class="btn" id="s-keys">Controls / key bindings</button><button class="btn" id="s-reset">Reset to defaults</button><button class="btn primary" id="s-back">Done</button></div>`);
  const on = (id: string, ev: string, fn: (el: HTMLInputElement) => void) => { const el = document.getElementById(id) as HTMLInputElement; el.addEventListener(ev, () => { fn(el); applySettings(); }); };
  on('s-scale', 'input', el => { settings.uiScale = Number(el.value); $('s-scale-v').textContent = settings.uiScale.toFixed(2) + '×'; });
  on('s-flash', 'change', el => { settings.reducedFlash = el.checked; });
  on('s-edge', 'change', el => { settings.edgeScroll = el.checked; });
  on('s-hints', 'change', el => { settings.showHints = el.checked; });
  on('s-vol', 'input', el => { settings.volume = Number(el.value); });
  on('s-mute', 'change', el => { settings.muted = el.checked; });
  btn('s-keys', () => showControls(() => showSettings(back)));
  btn('s-reset', () => { Object.assign(settings, defaultSettings()); applySettings(); showSettings(back); });
  btn('s-back', back);
}
function showControls(back?: () => void) {
  const b = back ?? (() => { if (cs) hideModal(); else showTitle(); });
  rebindBack = b;
  const rows = ACTIONS.map(a => `<tr><td>${a.label}</td><td><button data-a="${a.id}">${keyName(settings.keys[a.id])}</button></td></tr>`).join('');
  modal(`<h2>Controls</h2><p class="tag">Click a key to rebind it, then press the new key (Esc cancels). Build keys apply when Runners are selected; train keys when a Core or Training Grid is selected. Mouse: left select/drag · right smart-order · wheel zoom · middle-drag pan.</p>
  <table class="keys">${rows}</table><div class="row"><button class="btn primary" id="k-back">Done</button></div>`);
  for (const el of Array.from(document.querySelectorAll('table.keys button'))) (el as HTMLElement).onclick = () => { rebinding = (el as HTMLElement).dataset.a!; (el as HTMLElement).textContent = 'press a key…'; };
  btn('k-back', b);
}
function gameOver() {
  const w = cs!.game.world; const won = w.winner === cs!.me;
  won ? sfx.victory() : sfx.defeat();
  const st = w.players[cs!.me].stats;
  modal(`<h1 style="color:${won ? 'var(--good)' : 'var(--bad)'}">${won ? 'VICTORY' : 'DEFEAT'}</h1>
  <p>${won ? 'The Rival Kernel\'s Core has been decompiled.' : 'Your Core has fallen.'} Match time ${fmtTime(w.tick)}.</p>
  <div class="legend"><b>Data harvested</b><span>${Math.round(st.dataHarvested)}</span><b>Code compiled / eaten</b><span>${Math.round(st.codeProduced)} / ${Math.round(st.codeConsumed)}</span><b>Hash mined</b><span>${Math.round(st.hashMined)}</span><b>Programs trained / lost</b><span>${st.unitsTrained} / ${st.unitsLost}</span><b>Kills</b><span>${st.kills}</span><b>Crashes</b><span>${st.crashes}</span></div>
  <div class="row"><button class="btn primary" id="g-again">Play again</button><button class="btn" id="g-title">Title</button></div>`);
  btn('g-again', () => newMatch(w.difficulty));
  btn('g-title', () => showTitle());
}

let toastT: any = 0;
function toast(msg: string, ok = false) {
  const t = $('toast'); t.textContent = msg; t.className = ok ? 'ok' : ''; t.style.opacity = '1';
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.opacity = '0'; }, 2600);
}

// Title backdrop: slow drifting lattice
function drawTitleBackdrop(now: number) {
  const W = canvas.width, H = canvas.height; ctx.fillStyle = '#02040a'; ctx.fillRect(0, 0, W, H);
  const s = 40 * dpr(), off = (now / 60) % s;
  ctx.strokeStyle = '#0d2240'; ctx.lineWidth = 1;
  for (let x = -off; x < W; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = -off; y < H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

// ======================================================================
// Test hooks (used by the automated browser test; harmless otherwise)
// ======================================================================
function testHooks() {
  return {
    get cs() { return cs; },
    issue: (c: any) => cs!.game.issue({ ...c, player: cs!.me }),
    step: (n: number) => { for (let i = 0; i < n; i++) { cs!.game.step(); handleEvents(); } },
    save: () => saveGame(cs!.game), load: (s: SaveFile) => startMatch(loadGame(s)),
    newMatch, select: (ids: number[]) => { cs!.sel = new Set(ids); }, jump, startPlacing,
    pressCommand: (id: string) => { const b = commandButtons().find(x => x.id === id); if (b) b.run(); return !!b; },
  };
}
(window as any).__kkBoot = { newMatch, showTitle };

resize();
showTitle();
requestAnimationFrame(frame);
