import { useEffect, useRef, useSyncExternalStore } from 'react';
import { engine } from '../client/engine.ts';
import { Hud } from './Hud.tsx';
import { Title, HowTo, Pause, SettingsCard, Controls, GameOver, Codex, PerfCard } from './Menus.tsx';

export function App() {
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  const canvas = useRef<HTMLCanvasElement>(null);
  // mount() is idempotent, so StrictMode's double effect never creates a second simulation loop.
  useEffect(() => { if (canvas.current) engine.mount(canvas.current); }, []);
  const reduced = snap.settings.reducedFlash;
  const m = snap.match;
  return <div className={`app ${reduced ? 'reduced' : ''}`}>
    <canvas id="view" ref={canvas} aria-label="Battlefield" />
    {m && <Hud m={m} hints={snap.settings.showHints} />}
    {!m && snap.modalStack.includes('title') && <Title snap={snap} />}
    {snap.modal === 'howto' && <HowTo snap={snap} />}
    {snap.modal === 'pause' && m && <Pause snap={snap} />}
    {snap.modal === 'settings' && <SettingsCard snap={snap} />}
    {snap.modal === 'controls' && <Controls snap={snap} />}
    {snap.modal === 'gameover' && m && <GameOver snap={snap} />}
    {snap.modal === 'codex' && <Codex />}
    {snap.modal === 'perf' && <PerfCard snap={snap} />}
    {snap.perfRunning && <div id="perfBanner" className="banner perf-run">PERFORMANCE TEST · phase {snap.perfRunning.phase}/{snap.perfRunning.phases} · {snap.perfRunning.left}s left — hands off</div>}
    <div id="toast" role="status" className={`toast ${snap.toast?.ok ? 'ok' : ''} ${snap.toast ? 'show' : ''}`}>{snap.toast?.text ?? ''}</div>
  </div>;
}
