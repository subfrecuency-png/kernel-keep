// In-game sprites cut from the Master v0.2 concept sheets by tools/art/cut_sprites.py (P2 = red-shifted).
// esbuild inlines them as data: URIs. Images decode asynchronously; the renderer falls back to simple shapes until ready.
import runner_p1 from '../../assets/art/sprites/runner-p1.webp';
import runner_p2 from '../../assets/art/sprites/runner-p2.webp';
import ping_p1 from '../../assets/art/sprites/ping-p1.webp';
import ping_p2 from '../../assets/art/sprites/ping-p2.webp';
import bulwark_p1 from '../../assets/art/sprites/bulwark-p1.webp';
import bulwark_p2 from '../../assets/art/sprites/bulwark-p2.webp';
import lancer_p1 from '../../assets/art/sprites/lancer-p1.webp';
import lancer_p2 from '../../assets/art/sprites/lancer-p2.webp';
import patcher_p1 from '../../assets/art/sprites/patcher-p1.webp';
import patcher_p2 from '../../assets/art/sprites/patcher-p2.webp';
import breaker_p1 from '../../assets/art/sprites/breaker-p1.webp';
import breaker_p2 from '../../assets/art/sprites/breaker-p2.webp';
import core_p1 from '../../assets/art/sprites/core-p1.webp';
import core_p2 from '../../assets/art/sprites/core-p2.webp';
import cache_p1 from '../../assets/art/sprites/cache-p1.webp';
import cache_p2 from '../../assets/art/sprites/cache-p2.webp';
import compiler_p1 from '../../assets/art/sprites/compiler-p1.webp';
import compiler_p2 from '../../assets/art/sprites/compiler-p2.webp';
import rig_p1 from '../../assets/art/sprites/rig-p1.webp';
import rig_p2 from '../../assets/art/sprites/rig-p2.webp';
import node_p1 from '../../assets/art/sprites/node-p1.webp';
import node_p2 from '../../assets/art/sprites/node-p2.webp';
import bank_p1 from '../../assets/art/sprites/bank-p1.webp';
import bank_p2 from '../../assets/art/sprites/bank-p2.webp';
import grid_p1 from '../../assets/art/sprites/grid-p1.webp';
import grid_p2 from '../../assets/art/sprites/grid-p2.webp';
import wall_p1 from '../../assets/art/sprites/wall-p1.webp';
import wall_p2 from '../../assets/art/sprites/wall-p2.webp';
import gate_p1 from '../../assets/art/sprites/gate-p1.webp';
import gate_p2 from '../../assets/art/sprites/gate-p2.webp';
import tower_p1 from '../../assets/art/sprites/tower-p1.webp';
import tower_p2 from '../../assets/art/sprites/tower-p2.webp';

export const SPRITE_URLS: Record<string, [string, string]> = {
  runner: [runner_p1, runner_p2],
  ping: [ping_p1, ping_p2],
  bulwark: [bulwark_p1, bulwark_p2],
  lancer: [lancer_p1, lancer_p2],
  patcher: [patcher_p1, patcher_p2],
  breaker: [breaker_p1, breaker_p2],
  core: [core_p1, core_p2],
  cache: [cache_p1, cache_p2],
  compiler: [compiler_p1, compiler_p2],
  rig: [rig_p1, rig_p2],
  node: [node_p1, node_p2],
  bank: [bank_p1, bank_p2],
  grid: [grid_p1, grid_p2],
  wall: [wall_p1, wall_p2],
  gate: [gate_p1, gate_p2],
  tower: [tower_p1, tower_p2],
};

const cache = new Map<string, HTMLImageElement>();
/** Decoded sprite for a type and owner (owner 2 gets the red-shifted variant), or null while loading. */
export function sprite(type: string, owner: number): HTMLImageElement | null {
  const urls = SPRITE_URLS[type]; if (!urls || typeof Image === 'undefined') return null;
  const key = type + (owner === 2 ? ':2' : ':1');
  let img = cache.get(key);
  if (!img) { img = new Image(); img.decoding = 'async'; img.src = urls[owner === 2 ? 1 : 0]; cache.set(key, img); }
  return img.complete && img.naturalWidth > 0 ? img : null;
}
/** Start decoding every sprite (called once when a match starts). */
export function preloadSprites() { for (const t of Object.keys(SPRITE_URLS)) { sprite(t, 1); sprite(t, 2); } }

// ---------------------------------------------------------------- pre-scaled, pre-filtered copies
// Scaling a 400 px render down to ~80 px and running CSS filters every frame is the main cost on software
// rendering, so each (sprite, variant, size bucket) is rendered once into an offscreen canvas and reused.
export type Variant = '' | 'gray' | 'susp' | 'fork' | 'holo' | 'glow';
const FILTERS: Record<Variant, string> = {
  '': '', gray: 'grayscale(0.75) brightness(0.7)', susp: 'grayscale(1) brightness(0.55)', fork: 'saturate(0.35) brightness(1.55)',
  holo: 'brightness(1.6) saturate(0.4)', glow: 'brightness(2.2) saturate(1.4)',
};
const scaledCache = new Map<string, HTMLCanvasElement>();
const STEP = Math.log(1.08);
/** A copy of the sprite at roughly `w` px wide (8% size buckets) with the variant's filter baked in. */
export function scaledSprite(type: string, owner: number, variant: Variant, w: number): CanvasImageSource | null {
  const img = sprite(type, owner); if (!img) return null;
  const bucket = Math.max(1, Math.round(Math.log(Math.max(8, w)) / STEP));
  const key = `${type}|${owner === 2 ? 2 : 1}|${variant}|${bucket}`;
  let c = scaledCache.get(key);
  if (!c) {
    if (scaledCache.size > 600) scaledCache.clear();
    const bw = Math.min(img.naturalWidth, Math.round(Math.exp(bucket * STEP) * 1.25)); // a little headroom for sharpness
    const bh = Math.round(bw * img.naturalHeight / img.naturalWidth);
    c = document.createElement('canvas'); c.width = bw; c.height = bh;
    const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high';
    if (FILTERS[variant] && 'filter' in g) g.filter = FILTERS[variant];
    g.drawImage(img, 0, 0, bw, bh);
    scaledCache.set(key, c);
  }
  return c;
}
