// Map definition: "Meridian Divide" — a point-symmetric 64x64 map split by a diagonal
// void rift with three passes (choke points). Deterministic; no randomness needed.
import { B } from './types.ts';

export interface MapDef {
  w: number; h: number;
  terrain: Uint8Array;                  // 0 = open lattice, 1 = void (impassable)
  cores: { tx: number; ty: number }[];  // index 0 = player 1, index 1 = player 2
  wells: { x: number; y: number; amount: number }[];
}

export function mirror(w: number, h: number, x: number, y: number) { return { x: w - 1 - x, y: h - 1 - y }; }

export function buildMap(): MapDef {
  const { w, h } = B.map;
  const terrain = new Uint8Array(w * h);
  const setSym = (x: number, y: number, v: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    terrain[y * w + x] = v;
    const m = mirror(w, h, x, y);
    terrain[m.y * w + m.x] = v;
  };
  // Diagonal rift |x - y| <= 1 with three 5-tile passes at x+y = 31, 63, 95.
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.abs(x - y) <= 1) {
      const s = x + y;
      const inPass = Math.abs(s - 31) <= 2 || Math.abs(s - 63) <= 2 || Math.abs(s - 95) <= 2;
      if (!inPass) terrain[y * w + x] = 1;
    }
  }
  // Scattered void outcrops (mirrored) that shape approach lanes.
  const outcrops: [number, number, number, number][] = [
    [18, 44, 3, 2], [24, 54, 2, 3], [5, 36, 3, 2], [30, 46, 2, 2], [14, 30, 2, 2], [38, 58, 3, 2],
  ];
  for (const [ox, oy, ow, oh] of outcrops)
    for (let y = oy; y < oy + oh; y++) for (let x = ox; x < ox + ow; x++) setSym(x, y, 1);
  // Map border is open; bounds are enforced by nav.

  const core1 = { tx: 7, ty: 52 };
  const m = mirror(w, h, core1.tx + 2, core1.ty + 2); // mirror the far corner of the 3x3 footprint
  const core2 = { tx: m.x, ty: m.y };
  // Wells for player 1 side; mirrored for player 2.
  const p1Wells = [
    { x: 14.5, y: 56.5, amount: 1200 }, { x: 4.5, y: 46.5, amount: 1200 },   // home
    { x: 20.5, y: 38.5, amount: 1500 }, { x: 26.5, y: 49.5, amount: 1500 },  // forward
    { x: 27.5, y: 38.5, amount: 2500 },                                      // rich, near the centre pass
  ];
  const wells: MapDef['wells'] = [];
  for (const wl of p1Wells) {
    wells.push(wl);
    wells.push({ x: w - wl.x, y: h - wl.y, amount: wl.amount });
  }
  // Make sure no well or core footprint sits on void.
  const clear = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) terrain[y * w + x] = 0; };
  for (const wl of wells) clear(Math.floor(wl.x), Math.floor(wl.y));
  for (const c of [core1, core2]) for (let y = c.ty - 1; y <= c.ty + 3; y++) for (let x = c.tx - 1; x <= c.tx + 3; x++) clear(x, y);
  return { w, h, terrain, cores: [core1, core2], wells };
}
