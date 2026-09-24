// Animation lab (codex): every shipped sheet playing for both teams, with pause and frame stepping, so new
// clips can be checked for loop seams, drift and team colour before they appear in a match.
import { useEffect, useRef, useState } from 'react';
import { listSheets, animFrame, preloadAnims } from '../client/anim.ts';
import { facing8, type AnimSheet, type Facing8 } from '../client/animlogic.ts';

const DIRS: Facing8[] = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'];
const VEC: Record<Facing8, [number, number]> = { e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0], nw: [-1, -1], n: [0, -1], ne: [1, -1] };

function Player({ sheet }: { sheet: AnimSheet }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [dir, setDir] = useState<Facing8>('se');
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
        const fz = facing8(...VEC[dir]);
        // one-shot clips (attack, death) are looped here so they can be reviewed
        const f = playing ? Math.floor(t * sheet.fps) % sheet.frames : frame;
        const a = animFrame(sheet.type, sheet.clip, owner, t, { frame: f, facing: sheet.facings ? fz.draw : undefined });
        if (!a) return; shown = a.frame;
        const w = sheet.cell[0] * s, h = sheet.cell[1] * s, x0 = k * cw + (cw - w) / 2;
        g.save(); if (sheet.facings && fz.mirror) { g.translate(x0 * 2 + w, 0); g.scale(-1, 1); }
        g.drawImage(a.img, a.sx, a.sy, a.sw, a.sh, x0, c.height - h, w, h); g.restore();
      });
      const lbl = document.getElementById(`lab-f-${sheet.type}-${sheet.clip}`); if (lbl) lbl.textContent = `frame ${shown + 1} / ${sheet.frames}`;
      if (playing) raf = requestAnimationFrame(draw);
    };
    preloadAnims(); draw(); if (!playing) { const id = setTimeout(draw, 60); return () => clearTimeout(id); }
    return () => cancelAnimationFrame(raf);
  }, [playing, frame, sheet, dir]);
  const step = (d: number) => { setPlaying(false); setFrame(f => (f + d + sheet.frames) % sheet.frames); };
  return <figure className="lab-item" data-sheet={`${sheet.type}:${sheet.clip}`}>
    <canvas ref={ref} width={440} height={250} />
    <figcaption><b>{sheet.type} · {sheet.clip}</b><span>{sheet.frames} frames · {sheet.fps} fps · {sheet.loop ? 'loop' : 'one-shot'} · yours / Rival</span>
      <span className="mono" id={`lab-f-${sheet.type}-${sheet.clip}`}>frame – / {sheet.frames}</span>
      <span className="row"><button onClick={() => step(-1)} aria-label="Previous frame">◀</button>
        <button className="lab-play" onClick={() => setPlaying(p => !p)}>{playing ? 'Pause' : 'Play'}</button>
        <button onClick={() => step(1)} aria-label="Next frame">▶</button>
        {sheet.facings && <button className="lab-dir" onClick={() => setDir(d => DIRS[(DIRS.indexOf(d) + 1) % DIRS.length])}>Facing {dir.toUpperCase()}</button>}</span></figcaption></figure>;
}

export function AnimLab() {
  const sheets = listSheets();
  return <>
    <h3>Animation lab</h3>
    <p className="tag">Clips that ship in this build. Structures play their working loop while they work (Compiler and Rig when staffed, Grid while training, Core and Node always). The Runner has six clips in eight facings (three are mirrored); the other programs keep their stills for now.</p>
    <div className="lab-grid">{sheets.map(s => <Player key={`${s.type}:${s.clip}`} sheet={s} />)}</div>
  </>;
}
