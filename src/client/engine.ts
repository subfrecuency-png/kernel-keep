// EngineHost: the ONE driver of the game on the page. It owns the Game (authoritative sim),
// the fixed-tick loop, the Canvas renderer, pointer/keyboard input and the command path.
// React never steps the simulation or mutates entities; it reads immutable snapshots via
// subscribe/getSnapshot (useSyncExternalStore) and calls the methods below.
import { B, Command, CommandResult, DT, Entity, Ration } from '../sim/types.ts';
import { Game, stateHash } from '../sim/game.ts';
import { saveGame, loadGame, SaveFile } from '../sim/save.ts';
import { AIController } from '../sim/ai.ts';
import { ClientState, COLORS } from './state.ts';
import { render, renderMinimap, wallLine, pickAt, miniToWorld, unitFacing } from './render.ts';
import { proj, unproj, toU, toV, mapBounds } from './iso.ts';
import { preloadSprites } from './sprites.ts';
import { loadSettings, saveSettings, defaultSettings, Settings } from './settings.ts';
import { sfx, setAudio } from './audio.ts';
import {
  fmtTime, topView, TopView, recoveryView, RecoveryIssue, OBJECTIVES, selectionView, SelectionView, CommandView, costShort,
} from './view.ts';

export type ModalId = 'title' | 'howto' | 'pause' | 'settings' | 'controls' | 'gameover' | 'codex';
export interface AlertView { key: string; time: string; text: string; severity: 'info' | 'warn' | 'danger'; x?: number; y?: number }
export interface ObjectiveView { text: string; hint: string; state: 'done' | 'current' | 'todo' }
export interface RosterItem { type: string; kind: 'unit' | 'building'; name: string; sub: string; count: number; busy: number }
export interface MatchView {
  tick: number; clock: string; seed: number; difficulty: 'easy' | 'normal';
  paused: boolean; speed: number; over: boolean; won: boolean;
  top: TopView; alerts: AlertView[]; objectives: ObjectiveView[]; recovery: RecoveryIssue[];
  selection: SelectionView; commands: CommandView[]; mode: 'attackMove' | null; placing: string | null;
  perf: string | null;
  /** Own programs and structures by type (for the roster and structure tabs). */
  roster: RosterItem[];
  stats: { dataHarvested: number; codeProduced: number; codeConsumed: number; hashMined: number; unitsTrained: number; unitsLost: number; kills: number; crashes: number };
}
export interface Snapshot {
  rev: number;
  modal: ModalId | null;
  modalStack: ModalId[];
  hasAutosave: boolean;
  difficulty: 'easy' | 'normal';
  toast: { id: number; text: string; ok: boolean } | null;
  settings: Settings;
  match: MatchView | null;
}

const AUTOSAVE = 'kernelkeep.autosave.v1', SLOT = 'kernelkeep.slot1.v1';
const BUILD_ORDER = ['compiler', 'rig', 'node', 'bank', 'cache', 'grid', 'tower', 'wall', 'gate'];
interface CmdButton extends CommandView { run: () => void }

export class EngineHost {
  cs: ClientState | null = null;
  settings: Settings;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mini: HTMLCanvasElement | null = null;
  private mctx: CanvasRenderingContext2D | null = null;
  private listeners = new Set<() => void>();
  private snap: Snapshot;
  private rev = 0;
  private dirty = true;
  private lastPublish = 0;
  private started = false;
  private modalStack: ModalId[] = ['title'];
  private difficulty: 'easy' | 'normal' = 'normal';
  private toastState: Snapshot['toast'] = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private latched = new Set<number>();
  /** Set by React while it captures keys (e.g. rebinding) so the engine ignores them. */
  captureKeys = false;
  // loop
  private acc = 0; private last = 0; private frames = 0; private fpsT = 0; private autosaveT = 0;
  loopCount = 0; // number of rAF loops started (must stay 1 — asserted by the browser test)
  // input
  private held = new Set<string>();
  private dragStart: { sx: number; sy: number } | null = null;
  private midDrag: { sx: number; sy: number; cx: number; cy: number } | null = null;
  private miniDrag = false;
  private lastClick = { t: 0, id: 0 };
  private lastGroupTap = { k: '', t: 0 };

  constructor() {
    this.settings = loadSettings();
    // Respect the OS reduced-motion preference unless the player has chosen explicitly.
    try {
      if (!localStorage.getItem('kernelkeep.settings.v1') && matchMedia('(prefers-reduced-motion: reduce)').matches) this.settings.reducedFlash = true;
    } catch { /* storage unavailable */ }
    this.applySettings();
    this.snap = this.buildSnapshot();
  }

  // ------------------------------------------------------------------ store
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private invalidate() { this.dirty = true; }
  private publish() {
    this.snap = this.buildSnapshot();
    this.dirty = false;
    for (const l of this.listeners) l();
  }
  private buildSnapshot(): Snapshot {
    let hasAutosave = false; try { hasAutosave = !!localStorage.getItem(AUTOSAVE); } catch { /* ignore */ }
    return Object.freeze({
      rev: ++this.rev,
      modal: this.modalStack[this.modalStack.length - 1] ?? null,
      modalStack: [...this.modalStack],
      hasAutosave,
      difficulty: this.difficulty,
      toast: this.toastState,
      settings: JSON.parse(JSON.stringify(this.settings)),
      match: this.cs ? this.matchView() : null,
    });
  }
  private matchView(): MatchView {
    const cs = this.cs!; const w = cs.game.world; const me = cs.me; const p = w.players[me];
    const alerts = p.alerts.filter(a => w.tick - a.tick < 25 * B.tickRate).slice(0, 5)
      .map(a => ({ key: a.tick + a.kind, time: fmtTime(a.tick), text: a.text, severity: a.severity, x: a.x, y: a.y }));
    const done = OBJECTIVES.map((o, i) => { if (this.latched.has(i)) return true; const d = o.done(w, me); if (d) this.latched.add(i); return d; });
    const cur = done.indexOf(false);
    const units = w.entities.filter(e => e.kind === 'unit').length;
    return {
      tick: w.tick, clock: fmtTime(w.tick), seed: w.seed, difficulty: w.difficulty,
      paused: cs.paused, speed: cs.speed, over: cs.over, won: w.winner === me,
      top: topView(w, me), alerts,
      objectives: OBJECTIVES.map((o, i) => ({ text: o.text, hint: o.hint, state: done[i] ? 'done' : i === cur ? 'current' : 'todo' })),
      recovery: recoveryView(w, me),
      selection: selectionView(w, me, cs.sel),
      commands: this.commandButtons().map(({ run, ...v }) => v),
      mode: cs.mode ?? null, placing: cs.placing?.type ?? null,
      perf: cs.showPerf ? `${cs.fps.toFixed(0)} fps · sim ${cs.game.perf.avgStepMs.toFixed(2)} ms/tick (max ${cs.game.perf.maxStepMs.toFixed(1)}) · ${units} units · tick ${w.tick}` : null,
      roster: this.roster(),
      stats: { ...p.stats },
    };
  }

  private roster(): RosterItem[] {
    const cs = this.cs!; const w = cs.game.world; const me = cs.me;
    const count = new Map<string, number>(), busy = new Map<string, number>();
    for (const e of w.entities) {
      if (e.dead || e.owner !== me || (e.kind !== 'unit' && e.kind !== 'building')) continue;
      count.set(e.type, (count.get(e.type) ?? 0) + 1);
      const working = e.kind === 'unit' ? !!e.order && e.order.type !== 'idle' : !e.built || (e.queue?.length ?? 0) > 0 || w.operatorPresent(e);
      if (working) busy.set(e.type, (busy.get(e.type) ?? 0) + 1);
    }
    const units = Object.entries(B.units).map(([type, d]) => ({ type, kind: 'unit' as const, name: d.name, sub: d.role.split(':')[0], count: count.get(type) ?? 0, busy: busy.get(type) ?? 0 }));
    const blds = Object.entries(B.buildings).map(([type, d]) => ({ type, kind: 'building' as const, name: d.name, sub: `${d.w}×${d.h}`, count: count.get(type) ?? 0, busy: busy.get(type) ?? 0 }));
    return [...units, ...blds];
  }
  /** Roster click: programs → select all of that role; structures → cycle through them. Camera follows. */
  focusType(type: string) {
    const cs = this.cs; if (!cs) return; const w = cs.game.world;
    const own = w.entities.filter(e => !e.dead && e.owner === cs.me && e.type === type);
    if (!own.length) return;
    if (own[0].kind === 'unit') {
      cs.sel = new Set(own.map(e => e.id));
      const cx = own.reduce((a, e) => a + e.x, 0) / own.length, cy = own.reduce((a, e) => a + e.y, 0) / own.length;
      this.jump(cx, cy);
    } else {
      const cur = own.findIndex(e => cs.sel.has(e.id)); const next = own[(cur + 1) % own.length];
      cs.sel = new Set([next.id]); this.jump(next.x, next.y);
    }
    sfx.click(); this.publish();
  }

  // ------------------------------------------------------------------ lifecycle
  /** Attach the battlefield canvas. Idempotent: StrictMode double effects never start a second loop. */
  mount(canvas: HTMLCanvasElement) {
    if (this.canvas === canvas) return;
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!;
    this.bindCanvas(canvas);
    this.resize();
    if (!this.started) {
      this.started = true; this.loopCount++;
      addEventListener('resize', () => this.resize());
      addEventListener('keydown', e => this.onKeyDown(e));
      addEventListener('keyup', e => { const key = e.key.length === 1 ? e.key.toLowerCase() : e.key; this.held.delete(key); this.held.delete(e.key); });
      addEventListener('blur', () => this.held.clear());
      addEventListener('mouseup', e => this.onMouseUp(e));
      this.last = performance.now();
      requestAnimationFrame(t => this.frame(t));
    }
  }
  attachMinimap(el: HTMLCanvasElement | null) {
    if (!el || el === this.mini) { if (!el) this.mini = null; return; }
    this.mini = el; this.mctx = el.getContext('2d')!;
    const toWorld = (e: MouseEvent) => { const r = el.getBoundingClientRect(); return miniToWorld((e.clientX - r.left) / r.width * el.width, (e.clientY - r.top) / r.height * el.height); };
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('mousedown', e => {
      if (!this.cs) return; const p = toWorld(e);
      if (e.button === 0) { this.miniDrag = true; this.jump(p.x, p.y); }
      if (e.button === 2) { const us = this.selectedOwn().filter(u => u.kind === 'unit'); if (us.length) { this.issue({ t: this.cs.mode === 'attackMove' ? 'attackMove' : 'move', ids: us.map(u => u.id), x: p.x, y: p.y }); this.cs.mode = undefined; } }
    });
    el.addEventListener('mousemove', e => { if (this.miniDrag && this.cs) { const p = toWorld(e); this.jump(p.x, p.y); } });
  }

  private applySettings() {
    document.documentElement.style.setProperty('--ui-scale', String(this.settings.uiScale));
    setAudio(this.settings.volume, this.settings.muted);
    saveSettings(this.settings);
  }
  updateSettings(patch: Partial<Settings>) { Object.assign(this.settings, patch); this.applySettings(); this.invalidate(); this.publish(); }
  rebind(action: string, key: string) { this.settings.keys[action] = key.length === 1 ? key.toLowerCase() : key; this.applySettings(); this.publish(); }
  resetSettings() { Object.assign(this.settings, defaultSettings()); this.applySettings(); this.publish(); }

  // ------------------------------------------------------------------ modals / navigation
  openModal(m: ModalId) { if (this.modalStack[this.modalStack.length - 1] !== m) this.modalStack.push(m); if (this.cs && m === 'pause') this.cs.paused = true; this.publish(); }
  back() {
    this.modalStack.pop();
    if (!this.modalStack.length && !this.cs) this.modalStack = ['title'];
    this.publish();
  }
  closeModals(resume = false) { this.modalStack = this.cs ? [] : ['title']; if (resume && this.cs) this.cs.paused = false; this.publish(); }
  setDifficulty(d: 'easy' | 'normal') { this.difficulty = d; this.publish(); }
  quitToTitle() { this.cs = null; this.modalStack = ['title']; this.publish(); }

  toast(text: string, ok = false) {
    this.toastState = { id: (this.toastState?.id ?? 0) + 1, text, ok };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastState = null; this.publish(); }, 2600);
    this.publish();
  }

  // ------------------------------------------------------------------ matches
  startMatch(game: Game) {
    const w = game.world; const core = w.coreOf(1)!; const z = 46;
    preloadSprites();
    this.cs = {
      game, me: 1, cam: { x: 0, y: 0, z }, sel: new Set(), groups: {}, prev: new Map(), alpha: 0,
      mouse: { sx: 0, sy: 0, wx: 0, wy: 0, inView: false }, fx: [], settings: this.settings, paused: false, speed: 1, showPerf: false, fps: 60, time: 0, hudDirty: true, over: !!w.winner,
    };
    this.latched.clear();
    this.modalStack = [];
    this.resize();
    this.jump(core.x, core.y);
    this.publish();
  }
  newMatch(difficulty: 'easy' | 'normal' = this.difficulty, seed = (Date.now() % 100000)) {
    this.difficulty = difficulty;
    this.startMatch(new Game({ seed, difficulty, players: [{ name: 'You', ai: false }, { name: 'Rival Kernel', ai: true }] }));
    this.toast(`New match — seed ${seed}, ${difficulty}. Build, feed, fortify.`, true);
  }
  continueAutosave() { try { this.startMatch(loadGame(JSON.parse(localStorage.getItem(AUTOSAVE)!))); this.toast('Autosave restored.', true); } catch (err) { this.toast('Autosave unreadable: ' + (err as Error).message); } }
  quickSave() { if (!this.cs) return; try { localStorage.setItem(SLOT, JSON.stringify(saveGame(this.cs.game))); this.toast('Saved.', true); } catch (err) { this.toast('Save failed: ' + (err as Error).message); } }
  quickLoad() {
    try { const raw = localStorage.getItem(SLOT); if (!raw) { this.toast('No quick save yet.'); return; } this.startMatch(loadGame(JSON.parse(raw))); this.cs!.paused = true; this.toast('Loaded (paused).', true); }
    catch (err) { this.toast('Load failed: ' + (err as Error).message); }
  }
  exportSave() {
    if (!this.cs) return;
    const blob = new Blob([JSON.stringify(saveGame(this.cs.game))], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `kernel-keep-${fmtTime(this.cs.game.world.tick).replace(':', 'm')}s.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  importSave() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      try { const s = JSON.parse(await f.text()) as SaveFile; this.startMatch(loadGame(s)); this.cs!.paused = true; this.toast('Save loaded (paused).', true); }
      catch (err) { this.toast('Could not load (your current game is untouched): ' + (err as Error).message); }
    };
    inp.click();
  }
  restart() { if (this.cs) this.newMatch(this.cs.game.world.difficulty, this.cs.game.world.seed); }
  togglePause() { if (this.cs) { this.cs.paused = !this.cs.paused; this.publish(); } }
  cycleSpeed() { if (this.cs) { this.cs.speed = this.cs.speed === 1 ? 1.5 : this.cs.speed === 1.5 ? 2 : 1; this.publish(); } }
  setRation(level: Ration) { this.issue({ t: 'ration', level }); this.publish(); }

  issue(c: Record<string, any>, quiet = false): CommandResult {
    if (!this.cs) return { ok: false, reason: 'no game' };
    const r = this.cs.game.issue({ ...(c as any), player: this.cs.me } as Command);
    if (!r.ok) { if (!quiet) { this.toast(r.reason ?? 'Cannot do that.'); sfx.deny(); } }
    else if (!quiet) sfx.order();
    this.invalidate();
    return r;
  }

  // ------------------------------------------------------------------ frame loop
  private frame(now: number) {
    requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.25, (now - this.last) / 1000); this.last = now;
    const cs = this.cs;
    if (!cs || !this.ctx || !this.canvas) { if (this.ctx && this.canvas) this.drawBackdrop(now); if (this.dirty) this.publish(); return; }
    cs.time += dt;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { cs.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; }
    const w = cs.game.world;
    if (!cs.paused && !w.winner) {
      this.acc += dt * cs.speed;
      let steps = 0;
      while (this.acc >= DT && steps < 8) {
        cs.prev.clear();
        for (const e of w.entities) if (e.kind === 'unit') cs.prev.set(e.id, { x: e.x, y: e.y });
        cs.game.step(); steps++;
        this.handleEvents();
        this.acc -= DT;
      }
      if (steps === 8) this.acc = 0;
      if (steps) this.invalidate();
    }
    cs.alpha = cs.paused ? 1 : Math.min(1, this.acc / DT);
    const pan = 18 * dt / (cs.cam.z / 30);
    const k = this.settings.keys;
    if (!this.captureKeys) {
      if (this.held.has(k.camUp)) cs.cam.y -= pan; if (this.held.has(k.camDown)) cs.cam.y += pan;
      if (this.held.has(k.camLeft)) cs.cam.x -= pan; if (this.held.has(k.camRight)) cs.cam.x += pan;
    }
    if (this.settings.edgeScroll && cs.mouse.inView && document.hasFocus() && !this.modalOpen()) {
      const m = 6;
      if (cs.mouse.sx < m) cs.cam.x -= pan; if (cs.mouse.sx > innerWidth - m) cs.cam.x += pan;
      if (cs.mouse.sy < m) cs.cam.y -= pan; if (cs.mouse.sy > innerHeight - m) cs.cam.y += pan;
    }
    this.clampCam();
    for (const f of cs.fx) f.t += dt;
    cs.fx = cs.fx.filter(f => f.t < f.life);
    for (const id of [...cs.sel]) if (!w.get(id)) cs.sel.delete(id);
    if (cs.placing) { const t = this.tileAt(cs.mouse.sx, cs.mouse.sy); const d = B.buildings[cs.placing.type]; cs.placing.tx = t.tx - Math.floor((d.w - 1) / 2); cs.placing.ty = t.ty - Math.floor((d.h - 1) / 2); }
    render(this.ctx, cs, this.canvas.width, this.canvas.height);
    if (this.mctx && this.frames % 3 === 0) renderMinimap(this.mctx, cs, this.canvas.width, this.canvas.height);
    if (w.winner && !cs.over) { cs.over = true; w.winner === cs.me ? sfx.victory() : sfx.defeat(); this.modalStack = ['gameover']; this.invalidate(); }
    this.autosaveT += dt;
    if (this.autosaveT > 60 && !w.winner) { this.autosaveT = 0; try { localStorage.setItem(AUTOSAVE, JSON.stringify(saveGame(cs.game))); } catch { /* ignore */ } }
    // Publish UI snapshots at ~10 Hz; this never affects game progression.
    if (this.dirty && now - this.lastPublish > 95) { this.lastPublish = now; this.publish(); }
  }

  private handleEvents() {
    const cs = this.cs!; const w = cs.game.world; const me = cs.me;
    for (const ev of w.events) {
      switch (ev.t) {
        case 'shot': {
          if (!(w.isVisible(me, ev.x1, ev.y1) || w.isVisible(me, ev.x2, ev.y2))) break;
          cs.fx.push({ kind: ev.heal ? 'heal' : ev.siege ? 'siege' : 'beam', x: ev.x1, y: ev.y1, x2: ev.x2, y2: ev.y2, t: 0, life: ev.siege ? 0.35 : 0.16, color: ev.heal ? '#6dffa8' : COLORS[ev.owner].main, from: ev.from, to: ev.to });
          if (!ev.heal) sfx.shot(ev.siege);
          break;
        }
        case 'death':
          if (!w.isVisible(me, ev.x, ev.y) && ev.owner !== me) break;
          if (ev.type === 'absorbed') { cs.fx.push({ kind: 'ring', x: ev.x, y: ev.y, t: 0, life: 0.5, color: '#ffffff' }); break; }
          { // de-rez the sprite (presentation only): remember what died, where, and which way it faced
            const type = ev.kind === 'unit' ? (B.units[ev.type] ? ev.type : w.byId.get(ev.id)?.type) : ev.kind === 'building' ? ev.type : undefined;
            if (type && (B.units[type] || (B.buildings[type] && !B.buildings[type].wall))) cs.fx.push({ kind: 'derez', x: ev.x, y: ev.y, t: 0, life: ev.kind === 'building' ? 1.1 : 0.7, color: COLORS[ev.owner]?.main ?? '#fff', type, owner: ev.owner, id: ev.id, face: unitFacing(ev.id) });
          }
          cs.fx.push({ kind: 'burst', x: ev.x, y: ev.y, t: 0, life: ev.kind === 'building' ? 0.9 : 0.5, color: ev.kind === 'well' ? '#7cc7ff' : COLORS[ev.owner]?.main ?? '#fff' });
          if (ev.kind !== 'well') sfx.death();
          break;
        case 'built': if (ev.owner === me) { const e = w.get(ev.id); if (e) cs.fx.push({ kind: 'ring', x: e.x, y: e.y, t: 0, life: 0.8, color: '#ffffff' }); if (e && !B.buildings[e.type].wall) sfx.built(); } break;
        case 'spawn': {
          if (ev.owner === me) sfx.spawn();
          const e = w.get(ev.id);
          if (e && e.kind === 'unit' && (ev.owner === me || w.canSee(me, e))) cs.fx.push({ kind: 'spawn', x: e.x, y: e.y, t: 0, life: 0.55, color: COLORS[ev.owner]?.main ?? '#fff', id: e.id });
          break;
        }
        case 'deposit': if (ev.owner === me && cs.cam.z >= 24) cs.fx.push({ kind: 'text', x: ev.x, y: ev.y - 0.4, t: 0, life: 0.6, color: '#7cc7ff', text: '+10' }); break;
        case 'produce': if (ev.owner === me) { const e = w.get(ev.id); if (e) cs.fx.push({ kind: 'text', x: e.x, y: e.y - 0.8, t: 0, life: 1.1, color: ev.res === 'code' ? '#9cff8a' : '#ffcf5a', text: ev.res === 'code' ? '+Code' : '+Hash' }); } break;
        case 'alert':
          if (ev.owner !== me) break;
          if (ev.alert.x !== undefined) cs.lastAlert = { x: ev.alert.x, y: ev.alert.y! };
          if (ev.alert.kind === 'attacked') sfx.attacked(); else if (ev.alert.severity !== 'info') sfx.warn();
          break;
      }
    }
  }

  private drawBackdrop(now: number) {
    const ctx = this.ctx!, W = this.canvas!.width, H = this.canvas!.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#02070d'; ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------------ camera
  private resize() {
    if (!this.canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(innerWidth * dpr); this.canvas.height = Math.floor(innerHeight * dpr);
    this.canvas.style.width = innerWidth + 'px'; this.canvas.style.height = innerHeight + 'px';
  }
  dpr() { return this.canvas ? this.canvas.width / innerWidth : 1; }
  screenToWorld(sx: number, sy: number) { const d = this.dpr(); return unproj(this.cs!.cam, sx * d, sy * d); }
  worldToScreen(x: number, y: number) { const d = this.dpr(); const [sx, sy] = proj(this.cs!.cam, x, y); return { x: sx / d, y: sy / d }; }
  private tileAt(sx: number, sy: number) { const p = this.screenToWorld(sx, sy); return { tx: Math.floor(p.x), ty: Math.floor(p.y) }; }
  private clampCam() {
    const cs = this.cs; if (!cs || !this.canvas) return; const w = cs.game.world; const vw = this.canvas.width / cs.cam.z, vh = this.canvas.height / cs.cam.z;
    const b = mapBounds(w.map.w, w.map.h); // camera lives in the iso plane (see iso.ts)
    cs.cam.x = Math.max(b.u0 - vw * 0.3, Math.min(b.u1 - vw * 0.7, cs.cam.x));
    cs.cam.y = Math.max(b.v0 - vh * 0.3, Math.min(b.v1 - vh * 0.5, cs.cam.y));
  }
  jump(x: number, y: number) { const cs = this.cs; if (!cs || !this.canvas) return; cs.cam.x = toU(x, y) - this.canvas.width / cs.cam.z / 2; cs.cam.y = toV(x, y) - this.canvas.height * 0.42 / cs.cam.z; }

  // ------------------------------------------------------------------ picking / selection
  private pick(sx: number, sy: number): Entity | undefined { const d = this.dpr(); return pickAt(this.cs!, sx * d, sy * d); }
  selectedOwn(): Entity[] { const cs = this.cs; if (!cs) return []; const w = cs.game.world; return [...cs.sel].map(id => w.get(id)).filter((e): e is Entity => !!e && e.owner === cs.me); }
  select(ids: number[]) { if (!this.cs) return; this.cs.sel = new Set(ids); this.publish(); }
  selectType(type: string) { const cs = this.cs; if (!cs) return; cs.sel = new Set([...cs.sel].filter(id => cs.game.world.get(id)?.type === type)); this.publish(); }
  cancelTrain(building: number, index: number) { this.issue({ t: 'cancelTrain', building, index }); this.publish(); }
  jumpTo(x: number, y: number) { this.jump(x, y); }

  // ------------------------------------------------------------------ canvas input
  private modalOpen() { return this.modalStack.length > 0; }
  private bindCanvas(canvas: HTMLCanvasElement) {
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('mousemove', e => {
      const cs = this.cs; if (!cs) return;
      cs.mouse.sx = e.clientX; cs.mouse.sy = e.clientY; cs.mouse.inView = true;
      const p = this.screenToWorld(e.clientX, e.clientY); cs.mouse.wx = p.x; cs.mouse.wy = p.y;
      const d = this.dpr();
      if (this.dragStart && !cs.placing) cs.box = { x0: this.dragStart.sx * d, y0: this.dragStart.sy * d, x1: e.clientX * d, y1: e.clientY * d };
      if (this.midDrag) { cs.cam.x = this.midDrag.cx - (e.clientX - this.midDrag.sx) * d / cs.cam.z; cs.cam.y = this.midDrag.cy - (e.clientY - this.midDrag.sy) * d / cs.cam.z; }
    });
    canvas.addEventListener('mouseleave', () => { if (this.cs) this.cs.mouse.inView = false; });
    canvas.addEventListener('mousedown', e => {
      const cs = this.cs; if (!cs || this.modalOpen()) return;
      if (e.button === 1) { this.midDrag = { sx: e.clientX, sy: e.clientY, cx: cs.cam.x, cy: cs.cam.y }; e.preventDefault(); return; }
      if (e.button === 0) {
        if (cs.placing) {
          if (B.buildings[cs.placing.type].wall) { cs.placing.dragStart = { tx: cs.placing.tx, ty: cs.placing.ty }; return; }
          this.placeAt(cs.placing.tx, cs.placing.ty, e.shiftKey); return;
        }
        if (cs.mode === 'attackMove') { const p = this.screenToWorld(e.clientX, e.clientY); this.attackMoveTo(p.x, p.y); if (!e.shiftKey) cs.mode = undefined; this.invalidate(); return; }
        this.dragStart = { sx: e.clientX, sy: e.clientY };
      }
      if (e.button === 2) {
        if (cs.placing || cs.mode) { cs.placing = undefined; cs.mode = undefined; this.invalidate(); return; }
        this.rightClick(e.clientX, e.clientY);
      }
    });
    canvas.addEventListener('wheel', e => {
      const cs = this.cs; if (!cs) return; e.preventDefault();
      const d = this.dpr(); const px = e.clientX * d, py = e.clientY * d;
      const u = cs.cam.x + px / cs.cam.z, v = cs.cam.y + py / cs.cam.z; // keep the iso point under the cursor fixed
      cs.cam.z = Math.max(18, Math.min(110, cs.cam.z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
      cs.cam.x = u - px / cs.cam.z; cs.cam.y = v - py / cs.cam.z;
    }, { passive: false });
  }
  private onMouseUp(e: MouseEvent) {
    this.miniDrag = false;
    const cs = this.cs; if (!cs) return;
    if (e.button === 1) this.midDrag = null;
    if (e.button !== 0) return;
    if (cs.placing?.dragStart) {
      const tiles = wallLine(cs.placing.dragStart, { tx: cs.placing.tx, ty: cs.placing.ty });
      const builders = this.selectedOwn().filter(u => u.type === 'runner').map(u => u.id);
      let placed = 0, lastReason = '';
      for (const t of tiles) { const r = cs.game.issue({ t: 'place', building: cs.placing.type, tx: t.tx, ty: t.ty, ids: builders, player: cs.me }); if (r.ok) placed++; else lastReason = r.reason ?? ''; }
      if (placed) { sfx.order(); this.toast(`${placed} ${B.buildings[cs.placing.type].name} segment${placed > 1 ? 's' : ''} placed.` + (placed < tiles.length ? ` ${tiles.length - placed} skipped: ${lastReason}` : ''), true); }
      else { sfx.deny(); this.toast(lastReason || 'Cannot place here.'); }
      if (!e.shiftKey) cs.placing = undefined; else cs.placing.dragStart = undefined;
      this.invalidate();
      return;
    }
    if (!this.dragStart) return;
    const d = this.dpr();
    const box = cs.box; cs.box = undefined;
    const add = e.shiftKey;
    if (box && Math.abs(box.x1 - box.x0) + Math.abs(box.y1 - box.y0) > 8) {
      const bx0 = Math.min(box.x0, box.x1), bx1 = Math.max(box.x0, box.x1), by0 = Math.min(box.y0, box.y1), by1 = Math.max(box.y0, box.y1);
      const lift = cs.cam.z * 0.45; // a box around the body (not just the feet) should catch the program
      const inBox = cs.game.world.entities.filter(u => { if (u.kind !== 'unit' || u.dead || u.owner !== cs.me) return false; const [sx, sy] = proj(cs.cam, u.x, u.y); return sx >= bx0 && sx <= bx1 && sy >= by0 && sy - lift <= by1; });
      const combat = inBox.filter(u => u.type !== 'runner');
      const chosen = combat.length && combat.length < inBox.length && !add ? combat : inBox;
      if (!add) cs.sel.clear();
      for (const u of chosen) cs.sel.add(u.id);
      if (chosen.length) sfx.click();
    } else {
      const hit = this.pick(e.clientX, e.clientY);
      const now = performance.now();
      if (hit && this.lastClick.id === hit.id && now - this.lastClick.t < 350 && hit.owner === cs.me) {
        const cw = this.canvas!.width, ch = this.canvas!.height;
        for (const u of cs.game.world.entities) { if (u.dead || u.owner !== cs.me || u.type !== hit.type) continue; const [sx, sy] = proj(cs.cam, u.x, u.y); if (sx >= 0 && sx <= cw && sy >= 0 && sy <= ch) cs.sel.add(u.id); }
      } else {
        if (!add) cs.sel.clear();
        if (hit) { if (add && cs.sel.has(hit.id)) cs.sel.delete(hit.id); else cs.sel.add(hit.id); sfx.click(); }
      }
      this.lastClick = { t: now, id: hit?.id ?? 0 };
    }
    this.dragStart = null;
    this.publish();
  }
  private rightClick(sx: number, sy: number) {
    const cs = this.cs!; const own = this.selectedOwn();
    const units = own.filter(e => e.kind === 'unit');
    const p = this.screenToWorld(sx, sy);
    const target = this.pick(sx, sy);
    if (!units.length) {
      const b = own.find(e => e.kind === 'building' && B.buildings[e.type].trains);
      if (b) { this.issue({ t: 'rally', building: b.id, x: p.x, y: p.y }); this.marker(p.x, p.y, '#ffffff'); }
      return;
    }
    const runners = units.filter(u => u.type === 'runner');
    const fighters = units.filter(u => u.type !== 'runner');
    if (target && target.owner !== cs.me && target.owner !== 0) { this.issue({ t: 'attack', ids: units.map(u => u.id), target: target.id }); this.marker(target.x, target.y, '#ff4f6d'); return; }
    if (target && target.kind === 'well') {
      if (runners.length) this.issue({ t: 'harvest', ids: runners.map(u => u.id), target: target.id }, fighters.length > 0);
      if (fighters.length) this.issue({ t: 'move', ids: fighters.map(u => u.id), x: p.x, y: p.y });
      this.marker(target.x, target.y, '#7cc7ff'); return;
    }
    if (target && target.kind === 'building' && target.owner === cs.me && runners.length) {
      const bd = B.buildings[target.type];
      let r: CommandResult | undefined;
      if (!target.built) r = this.issue({ t: 'assist', ids: runners.map(u => u.id), target: target.id });
      else if (target.hp < target.maxHp) r = this.issue({ t: 'repair', ids: runners.map(u => u.id), target: target.id });
      else if (bd.operator) r = this.issue({ t: 'operate', ids: [runners[0].id], target: target.id });
      else if (bd.dropoff) r = this.issue({ t: 'move', ids: runners.map(u => u.id), x: p.x, y: p.y });
      if (fighters.length) this.issue({ t: 'move', ids: fighters.map(u => u.id), x: p.x, y: p.y }, true);
      if (r) { this.marker(target.x, target.y, '#6dffa8'); return; }
    }
    this.issue({ t: 'move', ids: units.map(u => u.id), x: p.x, y: p.y });
    this.marker(p.x, p.y, '#6dffa8');
  }
  private attackMoveTo(x: number, y: number) {
    const us = this.selectedOwn().filter(u => u.kind === 'unit'); if (!us.length) return;
    this.issue({ t: 'attackMove', ids: us.map(u => u.id), x, y }); this.marker(x, y, '#ff4f6d');
  }
  private marker(x: number, y: number, color: string) { this.cs!.fx.push({ kind: 'marker', x, y, t: 0, life: 0.5, color }); }
  private placeAt(tx: number, ty: number, keep: boolean) {
    const builders = this.selectedOwn().filter(u => u.type === 'runner').map(u => u.id);
    const r = this.issue({ t: 'place', building: this.cs!.placing!.type, tx, ty, ids: builders });
    if (r.ok && !keep) this.cs!.placing = undefined;
  }
  startPlacing(type: string) {
    const cs = this.cs; if (!cs) return;
    if (!this.selectedOwn().some(u => u.type === 'runner')) { this.toast('Select one or more Runners first — they build it.'); sfx.deny(); return; }
    cs.placing = { type, tx: 0, ty: 0, ok: false }; cs.mode = undefined; this.publish();
  }
  cancelMode() { if (this.cs) { this.cs.placing = undefined; this.cs.mode = undefined; this.publish(); } }

  // ------------------------------------------------------------------ command card
  private commandButtons(): CmdButton[] {
    const cs = this.cs; if (!cs) return [];
    const w = cs.game.world; const own = this.selectedOwn(); const k = this.settings.keys;
    const out: CmdButton[] = [];
    const units = own.filter(e => e.kind === 'unit');
    const buildings = own.filter(e => e.kind === 'building');
    const ids = units.map(u => u.id);
    const add = (b: Omit<CmdButton, 'costShort'>) => out.push({ ...b, costShort: costShort(b.cost) });
    if (units.length) {
      if (units.every(u => u.type === 'runner')) {
        for (const t of BUILD_ORDER) {
          const d = B.buildings[t];
          add({ id: 'build_' + t, label: d.name, key: k['build_' + t], cost: d.cost, enabled: w.canAfford(cs.me, d.cost), title: d.desc, run: () => this.startPlacing(t) });
        }
      } else {
        add({ id: 'attackMove', label: 'Attack-move', key: k.attackMove, enabled: true, title: 'Move and fight anything met on the way. Click a destination.', run: () => { cs.mode = 'attackMove'; this.publish(); } });
        add({ id: 'hold', label: 'Hold', key: k.hold, enabled: true, title: 'Hold position; fight only what is in range.', run: () => this.issue({ t: 'hold', ids }) });
        const p = w.players[cs.me];
        const ready = w.tick >= p.forkReadyTick;
        add({ id: 'fork', label: ready ? 'Fork' : `Fork ${Math.ceil((p.forkReadyTick - w.tick) / B.tickRate)}s`, key: k.fork, cost: B.fork.cost, enabled: ready && w.canAfford(cs.me, B.fork.cost),
          title: `COMMANDER POWER — Fork: temporary copies of up to ${B.fork.maxUnits} selected combat programs for ${B.fork.durationSec}s at ${B.fork.hpFraction * 100}% of their integrity. Forks eat no Code and use no Memory, but draw +${B.fork.computeSurge} Compute while alive and vanish if their original dies. Recharge ${B.fork.cooldownSec}s.`,
          run: () => this.issue({ t: 'fork', ids }) });
      }
      add({ id: 'stop', label: 'Stop', key: k.stop, enabled: true, title: 'Stop current order.', run: () => this.issue({ t: 'stop', ids }) });
      const anySusp = units.some(u => u.suspended);
      add({ id: 'suspend', label: anySusp ? 'Resume' : 'Suspend', key: k.suspend, enabled: true, title: 'Suspended programs eat no Code and do nothing. Use it to survive a Code shortage; resume when fed.', run: () => this.issue({ t: 'suspend', ids, on: !anySusp }) });
      add({ id: 'decompile', label: 'Decompile', key: k.decompile, enabled: true, title: 'Permanently delete the selected programs (frees Memory and upkeep, no refund).', run: () => this.issue({ t: 'decompile', ids }) });
      return out;
    }
    if (buildings.length === 1) {
      const b = buildings[0]; const d = B.buildings[b.type];
      if (b.built && d.trains) d.trains.forEach((u, i) => {
        const ud = B.units[u];
        add({ id: 'train_' + u, label: ud.name, key: k['train' + (i + 1)], cost: ud.cost, enabled: w.canAfford(cs.me, ud.cost), title: `${ud.role}. HP ${ud.hp}, Memory ${ud.mem}, upkeep ${ud.upkeep}.${ud.needsRunner ? ' Consumes a free Runner.' : ''}`, run: () => this.issue({ t: 'train', building: b.id, unit: u }) });
      });
      if (b.built && (d.operator || d.compute)) add({ id: 'toggle', label: b.active ? 'Switch off' : 'Switch on', key: k.toggle, enabled: true, title: 'Switched-off buildings use no Compute and release their operator.', run: () => this.issue({ t: 'toggleActive', building: b.id }) });
      if (b.built && d.gate) add({ id: 'toggle', label: b.open ? 'Close gate' : 'Open gate', key: k.toggle, enabled: true, title: 'Open: your programs pass, enemies never do. Closed: nobody passes.', run: () => this.issue({ t: 'gate', building: b.id, open: !b.open }) });
      if (b.type !== 'core') add({ id: 'decompile', label: b.built ? 'Demolish' : 'Cancel', key: k.decompile, enabled: true, title: b.built ? `Demolish (refund ${B.economy.demolishRefund * 100}% of cost).` : 'Cancel construction (full refund).', run: () => this.issue({ t: b.built ? 'demolish' : 'cancelBuild', building: b.id }) });
    }
    return out;
  }
  runCommand(id: string) { const b = this.commandButtons().find(x => x.id === id); if (b) { b.run(); this.publish(); } return !!b; }

  /** Recovery-panel actions: conveniences that map onto existing commands only (no new mechanics). */
  runRecovery(id: string) {
    const cs = this.cs; if (!cs) return;
    const w = cs.game.world; const mine = w.entities.filter(e => !e.dead && e.owner === cs.me);
    switch (id) {
      case 'ration-lean': this.issue({ t: 'ration', level: 'lean' }); break;
      case 'suspend-idle': { const ids = mine.filter(e => e.type === 'runner' && !e.suspended && e.order?.type === 'idle').map(e => e.id); if (ids.length) this.issue({ t: 'suspend', ids, on: true }); break; }
      case 'resume-all': { const ids = mine.filter(e => e.kind === 'unit' && e.suspended).map(e => e.id); if (ids.length) this.issue({ t: 'suspend', ids, on: false }); break; }
      case 'select-suspended': { const s = mine.filter(e => e.kind === 'unit' && e.suspended); cs.sel = new Set(s.map(e => e.id)); if (s[0]) this.jump(s[0].x, s[0].y); break; }
      case 'select-compiler': { const c = mine.find(e => e.type === 'compiler'); if (c) { cs.sel = new Set([c.id]); this.jump(c.x, c.y); } break; }
      case 'rig-off': { const r = [...mine].reverse().find(e => e.type === 'rig' && e.built && e.active); if (r) this.issue({ t: 'toggleActive', building: r.id }); break; }
      case 'hint-compiler': this.toast('Select a Runner, press C, then click open ground near your Core.', true); break;
      case 'hint-node': this.toast('Select a Runner and press N to place a Compute Node (+8 Compute).', true); break;
      case 'hint-bank': this.toast('Select a Runner and press K to place a Memory Bank (+6 Memory).', true); break;
    }
    this.publish();
  }

  // ------------------------------------------------------------------ keyboard
  private onKeyDown(e: KeyboardEvent) {
    if (this.captureKeys) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (e.key === 'F1') { e.preventDefault(); this.openModal('controls'); return; }
    const cs = this.cs; if (!cs) return;
    const k = this.settings.keys; let key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === 'Backspace' && k.decompile === 'Delete') key = 'Delete';
    this.held.add(key.length === 1 ? key : e.key);
    if (e.key === 'Escape') {
      if (cs.placing || cs.mode) this.cancelMode();
      else if (!this.modalOpen()) this.openModal('pause');
      else if (!cs.over) this.back();
      return;
    }
    if (this.modalOpen()) return;
    if (e.repeat && !/^Arrow/.test(e.key)) return; // no duplicate commands from key-repeat
    if (/^[0-9]$/.test(e.key)) {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); cs.groups[e.key] = [...cs.sel]; this.toast(`Group ${e.key} set (${cs.sel.size}).`, true); return; }
      const g = (cs.groups[e.key] ?? []).filter(id => cs.game.world.get(id));
      if (g.length) {
        cs.sel = new Set(g);
        const now = performance.now();
        if (this.lastGroupTap.k === e.key && now - this.lastGroupTap.t < 350) { const u = cs.game.world.get(g[0])!; this.jump(u.x, u.y); }
        this.lastGroupTap = { k: e.key, t: now };
        this.publish();
      }
      return;
    }
    if (key === k.perf) { e.preventDefault(); cs.showPerf = !cs.showPerf; this.publish(); return; }
    if (key === k.pause) { this.togglePause(); return; }
    if (key === k.centerCore) { const c = cs.game.world.coreOf(cs.me); if (c) this.jump(c.x, c.y); return; }
    if (key === k.lastAlert) { e.preventDefault(); if (cs.lastAlert) this.jump(cs.lastAlert.x, cs.lastAlert.y); return; }
    if (key === k.idleRunner) {
      const idle = cs.game.world.entities.filter(u => u.owner === cs.me && u.type === 'runner' && !u.dead && u.order?.type === 'idle' && !u.suspended);
      if (idle.length) { const u = idle[(Math.floor(performance.now() / 300)) % idle.length]; cs.sel = new Set([u.id]); this.jump(u.x, u.y); this.publish(); } else this.toast('No idle Runners.', true);
      return;
    }
    for (const b of this.commandButtons()) if (b.key && b.key === key) { e.preventDefault(); b.run(); this.publish(); return; }
  }

  // ------------------------------------------------------------------ test hooks
  hooks() {
    const self = this;
    return {
      get cs() { return self.cs; },
      engine: self,
      issue: (c: any) => self.cs!.game.issue({ ...c, player: self.cs!.me }),
      step: (n: number) => { for (let i = 0; i < n; i++) { self.cs!.game.step(); self.handleEvents(); } self.publish(); },
      save: () => saveGame(self.cs!.game), load: (s: SaveFile) => self.startMatch(loadGame(s)),
      newMatch: (d: 'easy' | 'normal', seed?: number) => self.newMatch(d, seed),
      select: (ids: number[]) => self.select(ids), jump: (x: number, y: number) => self.jump(x, y),
      startPlacing: (t: string) => self.startPlacing(t),
      autopilot: () => { if (!self.cs!.game.ais.some(a => a.s.pid === self.cs!.me)) self.cs!.game.ais.push(new AIController(self.cs!.me, 'normal')); },
      hash: () => stateHash(self.cs!.game.world),
      worldToScreen: (x: number, y: number) => self.worldToScreen(x, y),
      pressCommand: (id: string) => self.runCommand(id),
      publish: () => self.publish(),
    };
  }
}

/** Module-level singleton: created once per page, independent of React mounting. */
export const engine = new EngineHost();
