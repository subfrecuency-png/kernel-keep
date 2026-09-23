// Tiny synthesized sound set (WebAudio oscillators). Original, no sample files, works offline.
let ctx: AudioContext | null = null;
let vol = 0.5, muted = false;
const last = new Map<string, number>();

export function setAudio(volume: number, mute: boolean) { vol = volume; muted = mute; }
function ac(): AudioContext | null {
  if (muted) return null;
  try { if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slide = 0) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function throttle(k: string, ms: number) { const n = performance.now(); if ((last.get(k) ?? 0) + ms > n) return false; last.set(k, n); return true; }

export const sfx = {
  click() { if (throttle('click', 40)) tone(880, 0.05, 'square', 0.04); },
  order() { if (throttle('order', 60)) { tone(520, 0.06, 'triangle', 0.08); tone(780, 0.06, 'triangle', 0.06, 0.05); } },
  deny() { if (throttle('deny', 150)) tone(180, 0.18, 'sawtooth', 0.07, 0, -60); },
  built() { if (throttle('built', 300)) { tone(440, 0.12, 'sine', 0.1); tone(660, 0.12, 'sine', 0.1, 0.1); tone(990, 0.2, 'sine', 0.08, 0.2); } },
  spawn() { if (throttle('spawn', 200)) tone(700, 0.08, 'sine', 0.06, 0, 300); },
  attacked() { if (throttle('attacked', 4000)) { tone(300, 0.22, 'square', 0.09); tone(220, 0.3, 'square', 0.09, 0.25); } },
  warn() { if (throttle('warn', 5000)) { tone(620, 0.12, 'triangle', 0.08); tone(620, 0.12, 'triangle', 0.08, 0.2); } },
  shot(siege?: boolean) { if (throttle(siege ? 'siege' : 'shot', siege ? 150 : 70)) tone(siege ? 120 : 1400, siege ? 0.25 : 0.04, siege ? 'sawtooth' : 'square', siege ? 0.05 : 0.015, 0, siege ? -60 : -700); },
  death() { if (throttle('death', 90)) tone(260, 0.2, 'sawtooth', 0.04, 0, -200); },
  victory() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'sine', 0.1, i * 0.18)); },
  defeat() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.45, 'triangle', 0.1, i * 0.25)); },
};
