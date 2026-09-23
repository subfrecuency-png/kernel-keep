// Isometric (2:1) projection shared by the renderer and the input code. Presentation only: the simulation
// keeps its square tile grid, so hashes, replays and saves are unaffected by anything here.
//
// World (x, y) → iso plane (u, v):  u = (x − y)·KU,  v = (x + y)·KV   (a tile becomes a 2:1 diamond)
// Iso plane → canvas pixels:        sx = (u − cam.x)·z, sy = (v − cam.y)·z
// So cam.x/cam.y are the iso-plane coordinates of the canvas's top-left corner and z is pixels per iso unit.
// Keeping the camera in the iso plane means panning, drag-panning and zoom-at-cursor stay linear.
import { B, Entity } from '../sim/types.ts';
import SPRITES from '../../assets/art/sprites/sprites.json';

export const KU = Math.SQRT1_2, KV = Math.SQRT1_2 / 2;
export interface Cam { x: number; y: number; z: number }

export const toU = (x: number, y: number) => (x - y) * KU;
export const toV = (x: number, y: number) => (x + y) * KV;
/** World → canvas pixels. */
export function proj(cam: Cam, x: number, y: number): [number, number] { return [(toU(x, y) - cam.x) * cam.z, (toV(x, y) - cam.y) * cam.z]; }
/** Canvas pixels → world (on the ground plane). */
export function unproj(cam: Cam, sx: number, sy: number): { x: number; y: number } {
  const u = cam.x + sx / cam.z, v = cam.y + sy / cam.z;
  const a = u / KU, b = v / KV; // a = x − y, b = x + y
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
/** Canvas transform that maps world coordinates onto the ground plane (for terrain, fog, rings, footprints). */
export function groundMatrix(cam: Cam): [number, number, number, number, number, number] {
  const z = cam.z;
  return [KU * z, KV * z, -KU * z, KV * z, -cam.x * z, -cam.y * z];
}
/** Iso-plane bounds of a map: u ∈ [−h·KU, w·KU], v ∈ [0, (w+h)·KV]. */
export function mapBounds(w: number, h: number) { return { u0: -h * KU, u1: w * KU, v0: 0, v1: (w + h) * KV }; }

// ---------------------------------------------------------------- sprite layout
export interface SpriteMeta { kind: 'unit' | 'building'; w: number; h: number; ax: number; ay: number }
export const META = SPRITES as unknown as Record<string, SpriteMeta>;

/** On-screen height of each program, in tiles' worth of pixels (z units); tuned so silhouettes read at 1×. */
export const UNIT_HEIGHT: Record<string, number> = { runner: 1.05, ping: 1.05, bulwark: 1.3, lancer: 1.15, patcher: 1.05, breaker: 1.2 };
/** Which way the concept render faces (+1 right, −1 left); the sprite is mirrored to face its movement. */
export const NATIVE_FACING: Record<string, number> = { runner: 1, ping: -1, bulwark: 1, lancer: 1, patcher: -1, breaker: 1 };
/** Building sprites are scaled so their base spans the footprint diamond; these nudge the few oddly framed renders. */
const BUILD_FIT: Record<string, { width?: number; lift?: number }> = {
  gate: { width: 1.9, lift: 0.1 }, tower: { width: 1.12 }, core: { width: 1.1 }, grid: { width: 1.06 }, bank: { width: 1.1 },
};

export interface Rect { x: number; y: number; w: number; h: number }

/** Screen rectangle of a unit sprite whose ground point is (x, y). */
export function unitRect(cam: Cam, type: string, x: number, y: number): Rect {
  const m = META[type]; const [gx, gy] = proj(cam, x, y);
  const h = UNIT_HEIGHT[type] * cam.z * 1.1; const s = h / m.h; const w = m.w * s;
  return { x: gx - m.ax * s, y: gy - m.ay * s, w, h };
}
/** Screen rectangle of a building sprite on its footprint. */
export function buildingRect(cam: Cam, type: string, tx: number, ty: number, fw: number, fh: number): Rect {
  const m = META[type]; const fit = BUILD_FIT[type] ?? {};
  // footprint diamond: left (tx, ty+fh), right (tx+fw, ty), bottom (tx+fw, ty+fh)
  const [lx] = proj(cam, tx, ty + fh), [rx] = proj(cam, tx + fw, ty), [, by] = proj(cam, tx + fw, ty + fh);
  const wide = (rx - lx) * (fit.width ?? 1.04); const s = wide / m.w; const h = m.h * s;
  const cx = (lx + rx) / 2;
  return { x: cx - wide / 2, y: by + h * 0.02 + (fit.lift ?? 0) * cam.z - h, w: wide, h };
}
/** Depth key for painter's ordering: farther (smaller x+y) first. */
export function depthOf(e: Entity): number {
  if (e.kind === 'building') return e.tx! + e.w! / 2 + e.ty! + e.h! / 2 + (B.buildings[e.type].wall ? 0.05 : 0);
  return e.x + e.y;
}
