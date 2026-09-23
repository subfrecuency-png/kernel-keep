// In-match HUD. Reads the engine snapshot only; every button calls an engine method that
// goes through the validated command path. No game rules are duplicated here.
import { Fragment, useState } from 'react';
import { engine, MatchView, RosterItem } from '../client/engine.ts';
import { keyName } from '../client/settings.ts';
import { PORTRAITS } from './assets.ts';
import type { Ration } from '../sim/types.ts';

const GLYPH: Record<string, string> = { data: '◇', code: '⌘', hash: '⬡', compute: '▦', memory: '▥' };
/** Icons for commands that have no concept portrait (kit style: Move / Attack / Hold / Fork row). */
const CMD_GLYPH: Record<string, string> = { attackMove: '⌖', hold: '◉', fork: '⑂', stop: '■', suspend: '⏸', decompile: '✕', toggle: '⏻', demolish: '✕', gate: '⇄', cancel: '↺' };

function TopBar({ m }: { m: MatchView }) {
  const t = m.top;
  return <header id="topbar" className="topbar">
    <button className="brand" onClick={() => engine.openModal('pause')} aria-label="Open menu"><span className="brand-mark" aria-hidden="true">⌘</span><span>KERNEL <b>KEEP</b></span></button>
    {t.resources.map(r => <div key={r.id} className={`chip res-${r.id} ${r.tone}`} title={r.tip} data-res={r.id}>
      <span className="chip-icon" aria-hidden="true">{GLYPH[r.id]}</span>
      <div><small>{r.name}</small><strong className="mono">{r.value}</strong><span className="chip-sub">{r.sub}</span></div>
    </div>)}
    <div className={`chip stab ${t.stabilityTone}`} title="STABILITY — drifts toward a target set by rations and hunger. High = faster work; below 20 programs crash (auto-suspend).">
      <div><small>Stability</small><strong className="mono">{t.stability}{t.crashing ? ' · CRASHING' : ''}</strong>
        <div id="rations" role="group" aria-label="Rations">{(['lean', 'standard', 'surplus'] as Ration[]).map(r =>
          <button key={r} data-r={r} className={t.ration === r ? 'on' : ''} aria-pressed={t.ration === r} onClick={() => engine.setRation(r)}
            title={r === 'lean' ? 'Half upkeep, −25 Stability target' : r === 'surplus' ? '+50% upkeep, +15 Stability target' : 'Normal upkeep'}>{r === 'standard' ? 'Std' : r[0].toUpperCase() + r.slice(1)}</button>)}</div>
      </div>
    </div>
    <div className="spacer" />
    <div id="clock" className="mono clock">{m.clock}</div>
    <button id="b-speed" className="tbtn" onClick={() => engine.cycleSpeed()} title="Game speed">{m.speed}×</button>
    <button id="b-pause" className="tbtn" onClick={() => engine.togglePause()} title="Pause (P)">{m.paused ? 'Resume' : 'Pause'}</button>
    <button id="b-menu" className="tbtn" onClick={() => engine.openModal('pause')} title="Menu (Esc)">Menu</button>
  </header>;
}

function Alerts({ m }: { m: MatchView }) {
  return <div id="alerts" className="alerts" aria-live="polite">{m.alerts.map(a =>
    <button key={a.key} className={`alert ${a.severity}`} onClick={() => a.x !== undefined && engine.jumpTo(a.x, a.y!)}>
      <span className="ic" aria-hidden="true">{a.severity === 'danger' ? '⚠' : a.severity === 'warn' ? '!' : 'i'}</span>{a.time} — {a.text}
    </button>)}</div>;
}

function SidePanels({ m, hints }: { m: MatchView; hints: boolean }) {
  const [open, setOpen] = useState(true);
  const worst = m.recovery.some(r => r.severity === 'danger') ? 'danger' : m.recovery.length ? 'warn' : 'ok';
  return <aside className="side">
    <section id="recovery" className={`panel recovery ${worst}`} aria-label="System stability">
      <div className="panel-title"><span className="eyebrow">SYSTEM STABILITY</span><strong className="mono">{m.top.stability}%</strong></div>
      <div className="meter"><span style={{ width: `${m.top.stability}%` }} /></div>
      {m.recovery.length === 0 && <><h3>Population supplied</h3><p>Code {m.top.codeNetPerMin >= 0 ? '+' : ''}{m.top.codeNetPerMin}/min. No shortages.</p></>}
      {m.recovery.map(issue => <div key={issue.kind} className={`issue ${issue.severity}`} data-issue={issue.kind}>
        <h3>△ {issue.title}</h3><p>{issue.detail}</p>
        {issue.actions.length > 0 && <div className="issue-actions">{issue.actions.map(a =>
          <button key={a.id} data-action={a.id} onClick={() => engine.runRecovery(a.id)}>{a.label}</button>)}</div>}
      </div>)}
    </section>
    <section id="objectives" className="panel objectives">
      <div className="panel-title"><span className="eyebrow">OBJECTIVES</span><button id="b-obj" className="link" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'hide' : 'show'}</button></div>
      {open && <div id="objlist">{m.objectives.map((o, i) => <div key={i} className={`obj ${o.state}`}>
        <span aria-hidden="true">{o.state === 'done' ? '✓' : o.state === 'current' ? '▶' : '·'}</span>
        <span>{o.text}{o.state === 'current' && hints && <span className="hint">{o.hint}</span>}</span>
      </div>)}</div>}
    </section>
  </aside>;
}

function Selection({ m }: { m: MatchView }) {
  const s = m.selection;
  if (s.kind === 'none') return <div id="sel" className="panel sel roster-panel">
    <div className="panel-title"><span className="eyebrow">YOUR PROGRAMS</span><span className="dimtxt">Click a role to select all · F1 controls</span></div>
    <Roster items={m.roster.filter(r => r.kind === 'unit')} />
  </div>;
  if (s.kind === 'multi') return <div id="sel" className="panel sel">
    <h2>{s.count} selected</h2>
    <div className="multi">{s.groups!.map(g => <button key={g.type} className="mu" title="Select only these" onClick={() => engine.selectType(g.type)}>
      {PORTRAITS[g.type] && <img src={PORTRAITS[g.type]} alt="" />}{g.name} × {g.n}</button>)}</div>
    <div className="bar"><i style={{ width: `${(s.hpFrac ?? 0) * 100}%` }} /></div>
  </div>;
  const portrait = PORTRAITS[s.type!];
  return <div id="sel" className="panel sel single">
    {portrait && <img className="portrait" src={portrait} alt={`${s.name} concept portrait`} />}
    <div className="sel-body">
      <p className="eyebrow">{s.entityKind === 'unit' ? 'SELECTED PROGRAM' : s.entityKind === 'building' ? 'SELECTED STRUCTURE' : 'RESOURCE'}</p>
      <h2>{s.name}</h2>
      <p className="role">{s.role}</p>
      <div className="bar"><i style={{ width: `${(s.hpFrac ?? 0) * 100}%` }} /></div>
      <div className="kv">{s.facts!.map(([k, v]) => <Fragment key={k}><b>{k}</b><span>{v}</span></Fragment>)}</div>
      {s.why && <div className="why">{s.why}</div>}
      {s.queue && s.queue.length > 0 && <div className="queue">{s.queue.map((q, i) =>
        <button key={i} className="qi" title={q.refund} onClick={() => engine.cancelTrain(s.id!, i)}>
          {PORTRAITS[q.unit] && <img src={PORTRAITS[q.unit]} alt="" />}<span>{q.name}</span><i className="pg" style={{ width: `${q.progress * 100}%` }} />
        </button>)}</div>}
    </div>
  </div>;
}

function Roster({ items }: { items: RosterItem[] }) {
  return <div className="roster">{items.map(r => <button key={r.type} className={`rc ${r.count ? '' : 'none'}`} data-roster={r.type} disabled={!r.count}
    onClick={() => engine.focusType(r.type)} title={r.count ? `${r.name}: ${r.count} (${r.busy} working)` : `No ${r.name} yet`}>
    {PORTRAITS[r.type] && <img src={PORTRAITS[r.type]} alt="" />}
    <span className="rn">{r.name}</span><span className="rs">{r.sub} · <b className="mono">{r.count}</b></span>
  </button>)}</div>;
}

function Overview({ m }: { m: MatchView }) {
  const [tab, setTab] = useState<'structures' | 'economy'>('structures');
  const st = m.stats;
  return <div id="cmds" className="panel cmds overview">
    <div className="tabs" role="tablist">{(['structures', 'economy'] as const).map(t =>
      <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'structures' ? 'Structures' : 'Economy'}</button>)}</div>
    {tab === 'structures' ? <Roster items={m.roster.filter(r => r.kind === 'building')} /> :
      <div className="econ kv">
        <b>Data harvested</b><span className="mono">{Math.round(st.dataHarvested)}</span>
        <b>Code produced / eaten</b><span className="mono">{Math.round(st.codeProduced)} / {Math.round(st.codeConsumed)}</span>
        <b>Code net</b><span className="mono">{m.top.codeNetPerMin >= 0 ? '+' : ''}{m.top.codeNetPerMin}/min</span>
        <b>Hash mined</b><span className="mono">{Math.round(st.hashMined)}</span>
        <b>Programs trained / lost</b><span className="mono">{st.unitsTrained} / {st.unitsLost}</span>
        <b>Kills · crashes</b><span className="mono">{st.kills} · {st.crashes}</span>
      </div>}
  </div>;
}

function Commands({ m }: { m: MatchView }) {
  if (m.commands.length === 0) return <Overview m={m} />;
  return <div id="cmds" className="panel cmds" role="toolbar" aria-label="Commands">
    {m.commands.map((c, i) => <button key={c.id + i} className={`cb ${c.enabled ? '' : 'dis'}`} data-cmd={c.id} aria-disabled={!c.enabled}
      title={c.title + (c.costShort ? `\nCost: ${c.costShort}` : '')} onClick={e => { e.currentTarget.blur(); engine.runCommand(c.id); }}>
      {c.key && <span className="hk">{keyName(c.key)}</span>}
      {c.id.startsWith('build_') && PORTRAITS[c.id.slice(6)] && <img src={PORTRAITS[c.id.slice(6)]} alt="" />}
      {c.id.startsWith('train_') && PORTRAITS[c.id.slice(6)] && <img src={PORTRAITS[c.id.slice(6)]} alt="" />}
      {CMD_GLYPH[c.id] && <span className="gl" aria-hidden="true">{CMD_GLYPH[c.id]}</span>}
      <span className="lbl">{c.label}</span>{c.costShort && <span className="cost">{c.costShort}</span>}
    </button>)}
  </div>;
}

export function Hud({ m, hints }: { m: MatchView; hints: boolean }) {
  return <div className="hud">
    <TopBar m={m} />
    <Alerts m={m} />
    <SidePanels m={m} hints={hints} />
    {m.paused && !m.over && <div id="pausedBanner" className="banner">PAUSED — you can still give orders</div>}
    {(m.placing || m.mode) && <div className="banner mode">{m.placing ? `Placing — left-click to place${m.placing === 'wall' ? ' (drag for a line)' : ''}, right-click or Esc to cancel` : 'Attack-move — click a destination'}</div>}
    {m.perf && <div id="perf" className="perf mono">{m.perf}</div>}
    <section id="bottom" className="bottom">
      <div className="panel mini-wrap">
        <div className="panel-title"><span className="eyebrow">SECTOR VIEW</span><span className="legend"><i className="lf" />You <i className="lr" />Rival</span></div>
        <canvas id="mini" width={256} height={180} ref={el => engine.attachMinimap(el)} aria-label="Minimap: click to move the camera, right-click to move the selection" />
      </div>
      <Selection m={m} />
      <Commands m={m} />
    </section>
  </div>;
}
