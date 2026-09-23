// Menus and dialogs: title, how-to, pause, settings, controls, game over, art codex.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { engine, Snapshot } from '../client/engine.ts';
import { ACTIONS, keyName } from '../client/settings.ts';
import { B } from '../sim/types.ts';
import { costText } from '../sim/commands.ts';
import { ART, PORTRAITS } from './assets.ts';

/** Accessible modal card: focus moves in, Tab stays inside, Esc is handled by the engine (Back). */
function Card({ children, wide, label }: { children: ReactNode; wide?: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const prev = document.activeElement as HTMLElement | null;
    (el.querySelector('[data-autofocus]') as HTMLElement ?? el.querySelector('button') as HTMLElement)?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = [...el.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')].filter(x => !x.hasAttribute('disabled'));
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    el.addEventListener('keydown', trap);
    return () => { el.removeEventListener('keydown', trap); prev?.focus?.(); };
  }, []);
  return <div id="modal" className="modal" role="dialog" aria-modal="true" aria-label={label}>
    <div id="modalCard" ref={ref} className={`card ${wide ? 'wide' : ''}`}>{children}</div>
  </div>;
}

export function Title({ snap }: { snap: Snapshot }) {
  const d = snap.difficulty;
  return <main className="title" style={{ backgroundImage: `linear-gradient(90deg,#040d16f2 0%,#040d16d9 34%,transparent 78%),url(${ART.menuBg})` }}>
    <div className="title-copy">
      <div className="brand big"><img src={ART.icon} alt="" width={44} height={44} /><span>KERNEL <b>KEEP</b></span></div>
      <p className="eyebrow">A CIVILIZATION WRITTEN IN CODE</p>
      <h1>Build the keep.<br /><em>Command the kernel.</em></h1>
      <p className="lead">Harvest <b className="c-data">Data</b>, compile the <b className="c-code">Code</b> that feeds your programs, mine fictional <b className="c-hash">Hash Credits</b> to arm them, balance scarce <b className="c-compute">Compute</b> — and break the Rival Kernel's Core.</p>
      <div className="diff" role="group" aria-label="Rival difficulty"><span>Rival</span>
        <button id="d-easy" className={d === 'easy' ? 'sel' : ''} aria-pressed={d === 'easy'} onClick={() => engine.setDifficulty('easy')}>Easy</button>
        <button id="d-normal" className={d === 'normal' ? 'sel' : ''} aria-pressed={d === 'normal'} onClick={() => engine.setDifficulty('normal')}>Normal</button></div>
      <div className="menu-actions">
        <button id="t-new" className="primary" data-autofocus onClick={() => engine.newMatch(d)}>New match <span>↗</span></button>
        {snap.hasAutosave && <button id="t-cont" onClick={() => engine.continueAutosave()}>Continue (autosave)</button>}
        <button id="t-load" onClick={() => engine.importSave()}>Load save file…</button>
        <button id="t-how" onClick={() => engine.openModal('howto')}>How to play</button>
        <button id="t-codex" onClick={() => engine.openModal('codex')}>Art codex</button>
        <button id="t-set" onClick={() => engine.openModal('settings')}>Settings</button>
      </div>
    </div>
    <footer className="title-footer"><span><i className="status-dot" /> OFFLINE · NO ACCOUNT · HASH CREDITS ARE FICTIONAL AND MATCH-LOCAL</span><span>MERIDIAN DIVIDE · PROTOTYPE 0.2 · PROVISIONAL TITLE</span></footer>
  </main>;
}

export function HowTo() {
  return <Card label="How to play" wide><p className="eyebrow">FIELD MANUAL</p><h2>How to play</h2>
    <div className="legend">
      <b>Goal</b><span>Destroy the Rival Core (top-right). Lose your Core and you lose.</span>
      <b>Data</b><span>Runners harvest glowing hexagon wells and carry Data to the Core or a Data Cache. Wells run dry; fight for the centre.</span>
      <b>Code = food</b><span>Every program eats Code. Compilers (staffed by a Runner) turn Data into Code. If Code runs out, Stability falls; below 20 programs crash (auto-suspend). Recover with Lean rations, more Compilers, or by Suspending idle programs — the Stability panel offers these as buttons.</span>
      <b>Hash</b><span>Mining Rigs mine fictional Hash Credits. Each extra Rig yields 15% less, and every Rig needs an operator and 4 Compute.</span>
      <b>Compute</b><span>Rigs, Towers and a training Grid share Compute. Over-demand causes a brownout that slows all of them. Switch a Rig off (O) in a siege.</span>
      <b>Army</b><span>The Training Grid specializes a free Runner into a Ping, Bulwark, Lancer, Patcher or Breaker. Veterans rank up after 2 and 5 kills.</span>
      <b>Walls</b><span>Firewalls, Gates and Towers are hardened: only Breakers hurt them properly. Enemies never pass your gates.</span>
      <b>Fork</b><span>Commander power: temporary copies of selected fighters for 25s. Costs 60 Hash, surges Compute, forks die with their originals.</span>
      <b>Mouse</b><span>Left-click/drag select · right-click = smart order · wheel zoom · middle-drag pan · minimap click / right-click.</span>
      <b>Keys</b><span>A attack-move · S stop · H hold · F fork · Z suspend · O switch/gate · Del decompile · Ctrl+1–9 groups · P pause · Space last alert · . idle Runner · Home Core · F1 controls.</span>
    </div>
    <div className="row"><button id="h-back" className="primary" onClick={() => engine.back()}>Back</button></div></Card>;
}

export function Pause({ snap }: { snap: Snapshot }) {
  const m = snap.match!;
  return <Card label="Paused"><p className="eyebrow">PAUSED · {m.clock}</p><h2>Menu</h2>
    <div className="row"><button id="p-resume" className="primary" onClick={() => engine.closeModals(true)}>Resume</button><button id="p-save" onClick={() => engine.quickSave()}>Quick save</button><button id="p-load" onClick={() => engine.quickLoad()}>Quick load</button><button id="p-export" onClick={() => engine.exportSave()}>Export save file</button><button id="p-import" onClick={() => engine.importSave()}>Import save file</button></div>
    <div className="row"><button id="p-restart" onClick={() => engine.restart()}>Restart match</button><button id="p-how" onClick={() => engine.openModal('howto')}>How to play</button><button id="p-codex" onClick={() => engine.openModal('codex')}>Art codex</button><button id="p-set" onClick={() => engine.openModal('settings')}>Settings & controls</button><button id="p-quit" onClick={() => engine.quitToTitle()}>Quit to title</button></div>
    <p className="tag">Seed {m.seed} · {m.difficulty} · balance v{B.version}. Autosave every 60s.</p></Card>;
}

export function SettingsCard({ snap }: { snap: Snapshot }) {
  const s = snap.settings;
  return <Card label="Settings"><p className="eyebrow">LOCAL PREFERENCES</p><h2>Settings</h2>
    <label className="set">Interface scale <input id="s-scale" type="range" min={0.8} max={1.6} step={0.05} value={s.uiScale} onChange={e => engine.updateSettings({ uiScale: Number(e.target.value) })} /><output>{s.uiScale.toFixed(2)}×</output></label>
    <label className="set"><input id="s-flash" type="checkbox" checked={s.reducedFlash} onChange={e => engine.updateSettings({ reducedFlash: e.target.checked })} /> Reduced flashing and motion (also follows your OS setting on first run)</label>
    <label className="set"><input id="s-edge" type="checkbox" checked={s.edgeScroll} onChange={e => engine.updateSettings({ edgeScroll: e.target.checked })} /> Edge-of-screen camera scrolling</label>
    <label className="set"><input id="s-hints" type="checkbox" checked={s.showHints} onChange={e => engine.updateSettings({ showHints: e.target.checked })} /> Show objective hints</label>
    <label className="set">Volume <input id="s-vol" type="range" min={0} max={1} step={0.05} value={s.volume} onChange={e => engine.updateSettings({ volume: Number(e.target.value) })} /> <input id="s-mute" type="checkbox" checked={s.muted} onChange={e => engine.updateSettings({ muted: e.target.checked })} /> mute</label>
    <div className="row"><button id="s-keys" onClick={() => engine.openModal('controls')}>Controls / key bindings</button><button id="s-reset" onClick={() => engine.resetSettings()}>Reset to defaults</button><button id="s-back" className="primary" onClick={() => engine.back()}>Done</button></div></Card>;
}

export function Controls({ snap }: { snap: Snapshot }) {
  const [rebinding, setRebinding] = useState<string | null>(null);
  useEffect(() => {
    if (!rebinding) return;
    engine.captureKeys = true;
    const onKey = (e: KeyboardEvent) => { e.preventDefault(); e.stopImmediatePropagation(); if (e.key !== 'Escape') engine.rebind(rebinding, e.key); setRebinding(null); };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => { window.removeEventListener('keydown', onKey, { capture: true }); engine.captureKeys = false; };
  }, [rebinding]);
  return <Card label="Controls" wide><p className="eyebrow">KEY BINDINGS</p><h2>Controls</h2>
    <p className="tag">Click a key, then press the new key (Esc cancels). Build keys apply with Runners selected; train keys with a Core or Training Grid selected. Group keys (Ctrl+1–9), Esc and F1 are fixed.</p>
    <table className="keys"><tbody>{ACTIONS.map(a => <tr key={a.id}><td>{a.label}</td><td>
      <button data-a={a.id} onClick={() => setRebinding(a.id)}>{rebinding === a.id ? 'press a key…' : keyName(snap.settings.keys[a.id])}</button></td></tr>)}</tbody></table>
    <div className="row"><button id="k-back" className="primary" onClick={() => engine.back()}>Done</button></div></Card>;
}

export function GameOver({ snap }: { snap: Snapshot }) {
  const m = snap.match!; const st = m.stats;
  return <Card label={m.won ? 'Victory' : 'Defeat'}><p className="eyebrow">MATCH COMPLETE · {m.clock}</p>
    <h1 className={m.won ? 'win' : 'lose'}>{m.won ? 'VICTORY' : 'DEFEAT'}</h1>
    <p>{m.won ? "The Rival Kernel's Core has been decompiled." : 'Your Core has fallen.'}</p>
    <div className="legend"><b>Data harvested</b><span>{Math.round(st.dataHarvested)}</span><b>Code compiled / eaten</b><span>{Math.round(st.codeProduced)} / {Math.round(st.codeConsumed)}</span><b>Hash mined</b><span>{Math.round(st.hashMined)}</span><b>Programs trained / lost</b><span>{st.unitsTrained} / {st.unitsLost}</span><b>Kills</b><span>{st.kills}</span><b>Crashes</b><span>{st.crashes}</span></div>
    <div className="row"><button id="g-again" className="primary" onClick={() => engine.newMatch(m.difficulty)}>Play again</button><button id="g-title" onClick={() => engine.quitToTitle()}>Title</button></div></Card>;
}

const ROLE_ORDER = ['runner', 'ping', 'bulwark', 'lancer', 'patcher', 'breaker'];
const STRUCT_ORDER = ['core', 'cache', 'compiler', 'rig', 'node', 'bank', 'grid', 'wall', 'gate', 'tower'];
export function Codex() {
  return <Card label="Art codex" wide><p className="eyebrow">THE VISUAL LANGUAGE · STATS FROM THE LIVE BALANCE FILE</p><h2>Codex</h2>
    <h3>Six program roles</h3>
    <div className="codex-grid">{ROLE_ORDER.map(t => { const u = B.units[t]; return <figure key={t} className="codex-item">
      <img src={PORTRAITS[t]} alt={`${u.name} concept`} /><figcaption><b>{u.name}</b><span>{u.role}</span>
        <small>{costText(u.cost)}{u.needsRunner ? ' + a Runner' : ''} · HP {u.hp} · Mem {u.mem} · upkeep {u.upkeep}{u.attack ? ` · ${u.attack.dmg} dmg / ${u.attack.cd}s, range ${u.attack.range}` : ''}{u.heal ? ` · heals ${u.heal.amt}/${u.heal.cd}s` : ''}</small></figcaption></figure>; })}</div>
    <h3>Ten structures</h3>
    <div className="codex-grid">{STRUCT_ORDER.map(t => { const b = B.buildings[t]; return <figure key={t} className="codex-item">
      <img src={PORTRAITS[t]} alt={`${b.name} concept`} /><figcaption><b>{b.name}</b><span>{b.desc}</span>
        <small>{b.buildable === false ? 'starting structure' : costText(b.cost)} · HP {b.hp} · {b.w}×{b.h}{b.hardened ? ' · hardened' : ''}</small></figcaption></figure>; })}</div>
    <h3>Concept sheets</h3>
    <p className="tag">Generated concept art from the Kernel_Keep_Master_v0.2 kit. These are portraits and direction — the battlefield still uses the readable procedural shapes until production sprites exist.</p>
    <img className="sheet" src={ART.sheetRoles} alt="Concept sheet: six program roles" />
    <img className="sheet" src={ART.sheetStructures} alt="Concept sheet: ten structures" />
    <div className="row"><button id="c-back" className="primary" data-autofocus onClick={() => engine.back()}>Back</button></div></Card>;
}
