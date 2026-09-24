// Animated sprite sheets (animation pilot, Phase 0). Presentation only.
// Each sheet is one atlas image plus its JSON (see animlogic.ts for the format). Only the player-1 atlas ships;
// the Rival copy is red-shifted once at load with the same hue rule as tools/art/cut_sprites.py, which keeps
// the single-file build ~1 MB smaller per sheet. If a sheet is missing or still decoding, callers fall back
// to the still sprite, so an absent clip never breaks drawing.
import compilerWorkingUrl from '../../assets/anim/compiler-working.webp';
import compilerWorking from '../../assets/anim/compiler-working.json';
import { AnimSheet, cellRect, frameAt, Facing } from './animlogic.ts';

interface Entry { sheet: AnimSheet; url: string; img?: HTMLImageElement; rival?: HTMLCanvasElement }
const ENTRIES: Entry[] = [
  { sheet: compilerWorking as unknown as AnimSheet, url: compilerWorkingUrl },
];
const byKey = new Map(ENTRIES.map(e => [`${e.sheet.type}:${e.sheet.clip}`, e]));

/** Every sheet that ships (for the Animation lab). */
export function listSheets(): AnimSheet[] { return ENTRIES.map(e => e.sheet); }
export function hasClip(type: string, clip: string): boolean { return byKey.has(`${type}:${clip}`); }

/** Blue/cyan hues → crimson; amber, greys and whites untouched (mirrors cut_sprites.py redshift()). */
export function redshiftPixels(d: Uint8ClampedArray) {
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c0 = mx - mn + 1e-9;
    let h = mx === r ? (((g - b) / c0) % 6 + 6) % 6 : mx === g ? (b - r) / c0 + 2 : (r - g) / c0 + 4; h *= 60;
    const s = mx > 0 ? c0 / (mx + 1e-9) : 0;
    if (!(h >= 165 && h <= 275 && s > 0.18)) continue;
    const s2 = Math.min(1, s * 1.05), v = mx, c = v * s2, hp = 348 / 60, x = c * (1 - Math.abs((hp % 2) - 1)), m = v - c;
    // hp = 5.8 → sector 5: (c, 0, x)
    d[i] = Math.round((c + m) * 255); d[i + 1] = Math.round(m * 255); d[i + 2] = Math.round((x + m) * 255);
  }
}

function source(e: Entry, owner: number): CanvasImageSource | null {
  if (typeof Image === 'undefined') return null;
  if (!e.img) { e.img = new Image(); e.img.decoding = 'async'; e.img.src = e.url; }
  if (!e.img.complete || !e.img.naturalWidth) return null;
  if (owner !== 2) return e.img;
  if (!e.rival) {
    const c = document.createElement('canvas'); c.width = e.img.naturalWidth; c.height = e.img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(e.img, 0, 0);
    try { const px = g.getImageData(0, 0, c.width, c.height); redshiftPixels(px.data); g.putImageData(px, 0, 0); }
    catch { /* a tainted canvas can't happen with data: URLs; keep the unshifted copy if it ever does */ }
    e.rival = c;
  }
  return e.rival;
}

/** Start decoding every sheet (called with preloadSprites). */
export function preloadAnims() {
  for (const e of ENTRIES) {
    source(e, 1);
    // build the Rival copy as soon as the atlas decodes, so the one-off recolour never lands mid-match
    const img = e.img; if (!img) continue;
    if (img.complete && img.naturalWidth) source(e, 2);
    else img.addEventListener('load', () => source(e, 2), { once: true });
  }
}

export interface AnimDraw { img: CanvasImageSource; sx: number; sy: number; sw: number; sh: number; frame: number }
/** The frame to draw for `type:clip` at time t, or null when the sheet is not available (use the still). */
export function animFrame(type: string, clip: string, owner: number, t: number, opts: { phase?: number; frame?: number; facing?: Facing } = {}): AnimDraw | null {
  const e = byKey.get(`${type}:${clip}`); if (!e) return null;
  const img = source(e, owner); if (!img) return null;
  const frame = opts.frame ?? frameAt(e.sheet, t, opts.phase ?? 0);
  const [sx, sy, sw, sh] = cellRect(e.sheet, frame, opts.facing ?? 's');
  return { img, sx, sy, sw, sh, frame };
}
