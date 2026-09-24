// In-game performance test (the "Air measurement script" from the Master v0.2 kit, docs/04, made one-click).
// A fixed scene is played in real time in two phases (about 80, then about 200 programs fighting in view) while
// every frame's duration, render cost and simulation cost are recorded. Results are summarised as percentiles,
// shown in a dialog, can be copied or saved, and the last few runs are kept in this browser.
// Measuring never affects the simulation: the scene is built through the normal world API and runs at 1×.

export interface Pct { p50: number; p95: number; p99: number; max: number }
export interface PerfPhase { label: string; seconds: number; frames: number; fps: number; units: number; frameMs: Pct; renderMs: Pct; simMsPerTick: Pct }
export interface PerfResult {
  when: string; build: string; userAgent: string; platform: string; cores: number | null; dpr: number;
  canvas: string; uiScale: number; reducedFlash: boolean; heapMB: number | null;
  phases: PerfPhase[]; verdict: string;
}

export function pct(xs: number[]): Pct {
  if (!xs.length) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))];
  const r = (v: number) => Math.round(v * 100) / 100;
  return { p50: r(at(0.5)), p95: r(at(0.95)), p99: r(at(0.99)), max: r(s[s.length - 1]) };
}

export class PerfRecorder {
  frames: number[] = []; renders: number[] = []; sims: number[] = []; units: number[] = [];
  addFrame(frameMs: number, renderMs: number, units: number) { this.frames.push(frameMs); this.renders.push(renderMs); this.units.push(units); }
  addTick(simMs: number) { this.sims.push(simMs); }
  summary(label: string, seconds: number): PerfPhase {
    const fr = pct(this.frames);
    const avgFrame = this.frames.reduce((a, b) => a + b, 0) / Math.max(1, this.frames.length);
    return {
      label, seconds, frames: this.frames.length, fps: Math.round(1000 / Math.max(1e-6, avgFrame) * 10) / 10,
      units: Math.round(this.units.reduce((a, b) => a + b, 0) / Math.max(1, this.units.length)),
      frameMs: fr, renderMs: pct(this.renders), simMsPerTick: pct(this.sims),
    };
  }
}

/** Plain-language reading of the numbers against the kit's proposed targets (60 fps, 30 fps fallback). */
export function verdict(phases: PerfPhase[]): string {
  const worst = phases[phases.length - 1];
  const p95fps = 1000 / Math.max(1, worst.frameMs.p95);
  if (worst.fps >= 55 && p95fps >= 45) return `Smooth: about ${Math.round(worst.fps)} fps with ~${worst.units} programs (95% of frames faster than ${Math.round(p95fps)} fps).`;
  if (worst.fps >= 28) return `Playable: about ${Math.round(worst.fps)} fps in the big fight. Try UI scale 1.0, a smaller window, or Reduced flashing if it feels heavy.`;
  return `Heavy: about ${Math.round(worst.fps)} fps in the big fight. This is below the 30 fps fallback target — copy the results so the scene can be tuned for this machine.`;
}

export function toMarkdown(r: PerfResult): string {
  let s = `Kernel Keep performance test — ${r.when}\n${r.build} · ${r.userAgent}\nplatform ${r.platform} · cores ${r.cores ?? '?'} · DPR ${r.dpr} · canvas ${r.canvas} · UI scale ${r.uiScale}${r.heapMB !== null ? ` · JS heap ${r.heapMB} MB` : ''}\n\n`;
  s += `| Phase | Programs | fps (avg) | frame ms p50/p95/p99/max | render ms p50/p95 | sim ms/tick p50/p95/max |\n|---|---|---|---|---|---|\n`;
  for (const p of r.phases) s += `| ${p.label} | ${p.units} | ${p.fps} | ${p.frameMs.p50}/${p.frameMs.p95}/${p.frameMs.p99}/${p.frameMs.max} | ${p.renderMs.p50}/${p.renderMs.p95} | ${p.simMsPerTick.p50}/${p.simMsPerTick.p95}/${p.simMsPerTick.max} |\n`;
  return s + `\n${r.verdict}\n`;
}

export const PERF_HISTORY = 'kernelkeep.perf.v1';
export function loadHistory(): PerfResult[] { try { return JSON.parse(localStorage.getItem(PERF_HISTORY) ?? '[]'); } catch { return []; } }
export function saveHistory(r: PerfResult) { try { localStorage.setItem(PERF_HISTORY, JSON.stringify([r, ...loadHistory()].slice(0, 5))); } catch { /* storage unavailable */ } }
