// Animation clip selection (animation pilot, Phase 0). Pure functions with no DOM or asset imports, so they are
// unit-tested in Node. Presentation only: nothing here is read by the simulation, so hashes and replays are
// unaffected.
//
// Sheet format ("sprites v2", one JSON per atlas, see docs/ART_AND_UI_GUIDE.md):
//   { type, clip, frames, fps, loop, cell: [w, h], cols, facings?: ['s','se','e','ne','n'], fire?: n, pivot?: [x, y] }
// Frames are packed row-major; with facings, facing k occupies frames [k·frames, (k+1)·frames).
import type { Entity } from '../sim/types.ts';

export interface AnimSheet {
  type: string; clip: string; frames: number; fps: number; loop: boolean;
  cell: [number, number]; cols: number;
  facings?: Facing[]; fire?: number; pivot?: [number, number];
}
export type Facing = 's' | 'se' | 'e' | 'ne' | 'n';
export type Facing8 = Facing | 'sw' | 'w' | 'nw';
export type UnitClip = 'idle' | 'walk' | 'carry' | 'harvest' | 'build' | 'attack' | 'death';

/** Eight-way screen facing from a screen-space direction (du → right, dv → down). The three left-hand facings
 *  are drawn as mirrored copies of their right-hand twins, so only five are ever rendered. */
export function facing8(du: number, dv: number): { dir: Facing8; draw: Facing; mirror: boolean } {
  if (Math.abs(du) < 1e-9 && Math.abs(dv) < 1e-9) return { dir: 's', draw: 's', mirror: false };
  const a = Math.atan2(dv, du);                        // 0 = right (e), +π/2 = down (s)
  const k = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8; // 0 e, 1 se, 2 s, 3 sw, 4 w, 5 nw, 6 n, 7 ne
  const dir = (['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'] as Facing8[])[k];
  const MIRROR: Partial<Record<Facing8, Facing>> = { sw: 'se', w: 'e', nw: 'ne' };
  const m = MIRROR[dir];
  return { dir, draw: m ?? (dir as Facing), mirror: !!m };
}

/** Frame index of a clip at time t (seconds). Loops wrap; one-shots hold their last frame. */
export function frameAt(sheet: Pick<AnimSheet, 'frames' | 'fps' | 'loop'>, t: number, phase = 0): number {
  const f = Math.floor(Math.max(0, t) * sheet.fps + phase);
  return sheet.loop ? ((f % sheet.frames) + sheet.frames) % sheet.frames : Math.min(sheet.frames - 1, f);
}

/** Attack frames follow the weapon cooldown, so the fire frame always lands on the tick the shot is fired.
 *  Right after a shot (cdLeft ≈ cdMax) the clip plays its follow-through (frames after `fire`), then rests on
 *  frame 0, then winds up so it reaches `fire` exactly as the cooldown reaches 0. */
export function attackFrame(cdLeft: number, cdMax: number, frames = 6, fire = 4, windupSec = 0.4): number {
  const since = cdMax - cdLeft;                   // seconds since the last shot
  const after = frames - 1 - fire;                // follow-through frames
  const followSec = Math.min(0.25, cdMax * 0.3);
  if (after > 0 && since < followSec) return fire + 1 + Math.min(after - 1, Math.floor(since / followSec * after));
  const wind = Math.min(windupSec, cdMax * 0.6);
  if (cdLeft > wind) return 0;
  return Math.min(fire, Math.floor((1 - cdLeft / wind) * fire));
}

/** Which clip a program should show. `moving` and `firing` come from the renderer's interpolation. */
export function unitClip(u: Pick<Entity, 'order' | 'carry' | 'engaged' | 'dead'>, moving: boolean, inCombat: boolean): UnitClip {
  if (u.dead) return 'death';
  const o = u.order;
  if (inCombat && !moving) return 'attack';
  if (moving) return (u.carry ?? 0) > 0 ? 'carry' : 'walk';
  if (o?.type === 'harvest' && o.phase === 'gather') return 'harvest';
  if ((o?.type === 'build' || o?.type === 'repair') && o.phase === 'work') return 'build';
  return 'idle';
}

/** A structure plays its working loop when it is finished, powered, not paused and staffed. */
export function buildingClip(b: Pick<Entity, 'built' | 'active' | 'stall'>, operatorPresent: boolean): 'working' | null {
  return b.built && b.active && b.stall !== 'paused' && operatorPresent ? 'working' : null;
}

/** Source rectangle of frame `i` (in facing `f`) inside the atlas. */
export function cellRect(sheet: AnimSheet, i: number, f: Facing = 's'): [number, number, number, number] {
  const k = sheet.facings ? Math.max(0, sheet.facings.indexOf(f)) : 0;
  const n = k * sheet.frames + i; const [cw, ch] = sheet.cell;
  return [(n % sheet.cols) * cw, Math.floor(n / sheet.cols) * ch, cw, ch];
}
