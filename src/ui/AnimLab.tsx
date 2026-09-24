// Animation lab (codex): every shipped sheet playing for both teams, with pause and frame stepping, so new
// clips can be checked for loop seams, drift and team colour before they appear in a match.
import { useEffect, useRef, useState } from 'react';
import { listSheets, animFrame, preloadAnims } from '../client/anim.ts';
import type { AnimSheet } from '../client/animlogic.ts';

function Player({ sheet }: { sheet: AnimSheet }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const t0 = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const c = ref.current; if (!c) return;
      const g = c.getContext('2d')!; g.clearRect(0, 0, c.width, c.height);
      const t = (performance.now() - t0.current) / 1000;
      const cw = c.width / 2, s = Math.min(cw / sheet.cell[0], c.height / sheet.cell[1]);
      let shown = frame;
      [1, 2].forEach((owner, k) => {
        const a = animFrame(sheet.type, sheet.clip, owner, t, playing ? {} : { frame });
        if (!a) return; shown = a.frame;
        const w = sheet.cell[0] * s, h = sheet.cell[1] * s;
        g.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, k * cw + (cw - w) / 2, c.height - h, w, h);
      });
      const lbl = document.getElementById(`lab-f-${sheet.type}-${sheet.clip}`); if (lbl) lbl.textContent = `frame ${shown + 1} / ${sheet.frames}`;
      if (playing) raf = requestAnimationFrame(draw);
    };
    preloadAnims(); draw(); if (!playing) { const id = setTimeout(draw, 60); return () => clearTimeout(id); }
    return () => cancelAnimationFrame(raf);
  }, [playing, frame, sheet]);
  const step = (d: number) => { setPlaying(false); setFrame(f => (f + d + sheet.frames) % sheet.frames); };
  return <figure className="lab-item" data-sheet={`${sheet.type}:${sheet.clip}`}>
    <canvas ref={ref} width={440} height={250} />
    <figcaption><b>{sheet.type} · {sheet.clip}</b><span>{sheet.frames} frames · {sheet.fps} fps · {sheet.loop ? 'loop' : 'one-shot'} · yours / Rival</span>
      <span className="mono" id={`lab-f-${sheet.type}-${sheet.clip}`}>frame – / {sheet.frames}</span>
      <span className="row"><button onClick={() => step(-1)} aria-label="Previous frame">◀</button>
        <button className="lab-play" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button onClick={() => step(1)} aria-label="Next frame">▶</button></span></figcaption></figure>;
}

export function AnimLab() {
  const sheets = listSheets();
  return <>
    <h3>Animation lab</h3>
    <p className="tag">Clips that ship in this build (animation pilot). Structures play their working loop while staffed and powered; programs keep their stills until their frames pass review.</p>
    <div className="lab-grid">{sheets.map(s => <Player key={`${s.type}:${s.clip}`} sheet={s} />)}</div>
  </>;
}
