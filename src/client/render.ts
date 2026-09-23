// Isometric Canvas renderer. Reads world state; never mutates it.
// Three passes:
//   1. ground (world coordinates under the iso ground matrix): terrain, lattice, void, fog, team pads,
//      unit shadows and ownership rings, selection, placement footprints, ground effects;
//   2. objects (screen space, painter's order by depth): Data wells, building sprites, wall prisms, unit sprites;
//   3. overlay (screen space): bars, labels, beams, floating text, drag box, cursors.
// Sprites are the Master v0.2 concept renders cut out by tools/art/cut_sprites.py (see ART_AND_UI_GUIDE.md).
import { B, Entity } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import { ClientState, COLORS, Fx } from './state.ts';
import { canPlace } from '../sim/commands.ts';
import { KU, KV, proj, unproj, groundMatrix, mapBounds, unitRect, buildingRect, depthOf, NATIVE_FACING, Rect, toU } from './iso.ts';
import { sprite, scaledSprite } from './sprites.ts';

let fogCanvas: HTMLCanvasElement | null = null;
let fogCtx: CanvasRenderingContext2D | null = null;
let fogImg: ImageData | null = null;
let fogIso: HTMLCanvasElement | null = null;
let fogFor: World | null = null; let fogTick = -1;
const FOG_RES = 6; // iso-canvas pixels per iso unit
let miniBase: HTMLCanvasElement | null = null;
let miniBaseFor: World | null = null;
const facing = new Map<number, number>();
/** Last on-screen facing of a program (+1 right, −1 left), used when it de-rezzes. */
export function unitFacing(id: number) { const f = facing.get(id); facing.delete(id); return f; }

const DATA_C = '#7cc7ff', FRAG_C = '#c59bff';

/** Height above the ground (in z units) where beams attach: roughly chest height of a program. */
const CHEST = 0.55;

export function render(ctx: CanvasRenderingContext2D, cs: ClientState, W: number, H: number) {
  const w = cs.game.world;
  const cam = cs.cam; const z = cam.z;
  const me = cs.me;
  const vis = w.visible[me], exp = w.players[me].explored;
  const MW = w.map.w, MH = w.map.h;
  const rf = cs.settings.reducedFlash;
  const t = cs.time;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#03080f'; ctx.fillRect(0, 0, W, H);

  // visible world range (the screen is a rotated window over the grid)
  const corners = [unproj(cam, 0, 0), unproj(cam, W, 0), unproj(cam, 0, H), unproj(cam, W, H)];
  const tx0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c.x))) - 1), tx1 = Math.min(MW - 1, Math.ceil(Math.max(...corners.map(c => c.x))) + 1);
  const ty0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c.y))) - 1), ty1 = Math.min(MH - 1, Math.ceil(Math.max(...corners.map(c => c.y))) + 1);
  const px = 1 / z / KV; // ~1 screen pixel expressed in world units (conservative)

  // ================================================================ 1. ground
  ctx.setTransform(...groundMatrix(cam));
  // map slab edge (gives the board some thickness)
  ctx.fillStyle = '#071122'; ctx.fillRect(0, 0, MW, MH);
  // void tiles
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) if (w.nav.terrain[y * MW + x]) {
    ctx.fillStyle = (x + y) % 2 ? '#05020d' : '#070312'; ctx.fillRect(x, y, 1.02, 1.02);
  }
  // lattice
  ctx.lineWidth = px;
  for (let x = tx0; x <= tx1 + 1; x++) { ctx.strokeStyle = x % 8 === 0 ? '#1b3a66' : '#0d1d36'; ctx.beginPath(); ctx.moveTo(x, Math.max(0, ty0)); ctx.lineTo(x, Math.min(MH, ty1 + 1)); ctx.stroke(); }
  for (let y = ty0; y <= ty1 + 1; y++) { ctx.strokeStyle = y % 8 === 0 ? '#1b3a66' : '#0d1d36'; ctx.beginPath(); ctx.moveTo(Math.max(0, tx0), y); ctx.lineTo(Math.min(MW, tx1 + 1), y); ctx.stroke(); }
  // void edges: glowing rift lips
  ctx.strokeStyle = '#7a45e8b0'; ctx.lineWidth = px * 1.4; ctx.beginPath();
  for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
    if (!w.nav.terrain[y * MW + x]) continue;
    if (x > 0 && !w.nav.terrain[y * MW + x - 1]) { ctx.moveTo(x, y); ctx.lineTo(x, y + 1); }
    if (x < MW - 1 && !w.nav.terrain[y * MW + x + 1]) { ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + 1); }
    if (y > 0 && !w.nav.terrain[(y - 1) * MW + x]) { ctx.moveTo(x, y); ctx.lineTo(x + 1, y); }
    if (y < MH - 1 && !w.nav.terrain[(y + 1) * MW + x]) { ctx.moveTo(x, y + 1); ctx.lineTo(x + 1, y + 1); }
  }
  ctx.stroke();
  // fog (on the ground only, so tall sprites stay legible). The 64×64 visibility image is projected into a
  // small iso-space canvas once per tick; the per-frame draw is then an axis-aligned scale, which is cheap.
  if (!fogCanvas || fogFor !== w) {
    fogFor = w; fogTick = -1;
    fogCanvas = document.createElement('canvas'); fogCanvas.width = MW; fogCanvas.height = MH; fogCtx = fogCanvas.getContext('2d')!; fogImg = fogCtx.createImageData(MW, MH);
    fogIso = document.createElement('canvas'); fogIso.width = Math.ceil((MW + MH) * KU * FOG_RES); fogIso.height = Math.ceil((MW + MH) * KV * FOG_RES);
  }
  if (fogTick !== w.tick) {
    fogTick = w.tick;
    const d = fogImg!.data;
    for (let i = 0; i < MW * MH; i++) { d[i * 4] = 1; d[i * 4 + 1] = 3; d[i * 4 + 2] = 8; d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 150 : 250; }
    fogCtx!.putImageData(fogImg!, 0, 0);
    const g = fogIso!.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fogIso!.width, fogIso!.height);
    g.setTransform(KU * FOG_RES, KV * FOG_RES, -KU * FOG_RES, KV * FOG_RES, MH * KU * FOG_RES, 0); g.imageSmoothingEnabled = true;
    g.drawImage(fogCanvas, 0, 0, MW, MH);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true;
  { const bnd = mapBounds(MW, MH); const [ox, oy] = [(bnd.u0 - cam.x) * z, (bnd.v0 - cam.y) * z]; ctx.drawImage(fogIso!, ox, oy, (bnd.u1 - bnd.u0) * z, (bnd.v1 - bnd.v0) * z); }
  ctx.setTransform(...groundMatrix(cam));

  // gather what the player can see
  const buildings: Entity[] = [], ghosts: Entity[] = [], units: Entity[] = [], wells: Entity[] = [];
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'well') { if (exp[Math.floor(e.y) * MW + Math.floor(e.x)]) wells.push(e); continue; }
    if (e.owner !== me && !w.canSee(me, e)) continue;
    (e.kind === 'building' ? buildings : units).push(e);
  }
  for (const [key, ls] of Object.entries(w.players[me].lastSeen)) {
    const id = Number(key); const e = w.byId.get(id);
    if (e && !e.dead && w.canSee(me, e)) continue;
    ghosts.push({ id, kind: 'building', type: ls.type, owner: ls.owner, x: ls.tx + ls.w / 2, y: ls.ty + ls.h / 2, tx: ls.tx, ty: ls.ty, w: ls.w, h: ls.h, hp: 1, maxHp: 1, built: true, active: false });
  }
  const upos = new Map<number, [number, number, number, number]>(); // interpolated x, y and motion dx, dy
  for (const e of units) {
    const p = cs.prev.get(e.id);
    upos.set(e.id, [p ? p.x + (e.x - p.x) * cs.alpha : e.x, p ? p.y + (e.y - p.y) * cs.alpha : e.y, p ? e.x - p.x : 0, p ? e.y - p.y : 0]);
  }

  // team pads under structures: ownership readable without relying on the sprite colours
  for (const b of [...buildings, ...ghosts]) {
    const c = COLORS[b.owner] ?? COLORS[0]; const bd = B.buildings[b.type];
    if (bd.wall) continue;
    ctx.fillStyle = c.main + (ghosts.includes(b) ? '10' : '1c'); ctx.fillRect(b.tx!, b.ty!, b.w!, b.h!);
    ctx.strokeStyle = c.main + (b.owner === me ? '66' : 'aa'); ctx.lineWidth = px * 1.5;
    if (b.owner !== me && b.owner !== 0) ctx.setLineDash([px * 6, px * 4]);
    ctx.strokeRect(b.tx! + 0.04, b.ty! + 0.04, b.w! - 0.08, b.h! - 0.08); ctx.setLineDash([]);
  }
  // wells: glow and remaining-amount ring on the ground
  for (const e of wells) {
    const col = e.type === 'fragment' ? FRAG_C : DATA_C; const r = e.type === 'fragment' ? 0.3 : 0.45;
    ctx.fillStyle = col + '22'; ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff66'; ctx.lineWidth = px * 2;
    ctx.beginPath(); ctx.arc(e.x, e.y, r * 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.amount! / e.initial!)); ctx.stroke();
  }
  // selected buildings: outline, rally line, tower range
  for (const b of buildings) if (cs.sel.has(b.id)) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px * 2; ctx.setLineDash([px * 8, px * 5]);
    ctx.strokeRect(b.tx! - 0.05, b.ty! - 0.05, b.w! + 0.1, b.h! + 0.1); ctx.setLineDash([]);
    const atk = B.buildings[b.type].attack;
    if (atk) { ctx.strokeStyle = '#ffffff30'; ctx.beginPath(); ctx.arc(b.x, b.y, atk.range, 0, Math.PI * 2); ctx.stroke(); }
    if (b.rally && b.owner === me) {
      ctx.strokeStyle = '#ffffff66'; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.rally.x, b.rally.y); ctx.stroke();
      ctx.fillStyle = COLORS[me].main; ctx.beginPath(); ctx.arc(b.rally.x, b.rally.y, 0.18, 0, Math.PI * 2); ctx.fill();
    }
  }
  // unit shadows, ownership rings (circle = yours, square-on-the-ground = enemy), selection.
  // Batched into a few paths: one fill for all shadows, one stroke per ring colour.
  {
    const shadow = new Path2D(); const rings = new Map<string, Path2D>(); const sel = new Path2D();
    const ring = (col: string) => { let p = rings.get(col); if (!p) { p = new Path2D(); rings.set(col, p); } return p; };
    for (const e of units) {
      const [x, y] = upos.get(e.id)!; const r = B.units[e.type].radius; const c = COLORS[e.owner] ?? COLORS[0];
      shadow.moveTo(x + 0.06 + r * 1.05, y + 0.06); shadow.arc(x + 0.06, y + 0.06, r * 1.05, 0, Math.PI * 2);
      const p = ring(e.suspended ? '#8a93a5' : c.main);
      if (e.owner === me) { p.moveTo(x + r + 0.08, y); p.arc(x, y, r + 0.08, 0, Math.PI * 2); }
      else { const q = r + 0.1; p.rect(x - q, y - q, 2 * q, 2 * q); }
      if (cs.sel.has(e.id)) { sel.moveTo(x + r + 0.2, y); sel.arc(x, y, r + 0.2, 0, Math.PI * 2); }
    }
    ctx.fillStyle = '#00000080'; ctx.fill(shadow);
    ctx.lineWidth = px * 1.6; for (const [col, p] of rings) { ctx.strokeStyle = col + 'aa'; ctx.stroke(p); }
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px * 2.2; ctx.stroke(sel);
    for (const e of units) if (e.forkOf && e.expires !== undefined) {
      const [x, y] = upos.get(e.id)!; const r = B.units[e.type].radius;
      const left = Math.max(0, (e.expires - w.tick) / (B.fork.durationSec * B.tickRate));
      ctx.strokeStyle = '#c59bff'; ctx.lineWidth = px * 2.2; ctx.beginPath(); ctx.arc(x, y, r + 0.32, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
    }
  }
  // ground effects
  for (const f of cs.fx) {
    const k = f.t / f.life; ctx.globalAlpha = Math.max(0, 1 - k);
    if (f.kind === 'ring') { ctx.strokeStyle = f.color; ctx.lineWidth = px * 2; ctx.beginPath(); ctx.arc(f.x, f.y, 0.4 + k * 1.2, 0, Math.PI * 2); ctx.stroke(); }
    else if (f.kind === 'marker') { ctx.strokeStyle = f.color; ctx.lineWidth = px * 2; ctx.beginPath(); ctx.arc(f.x, f.y, 0.7 - k * 0.5, 0, Math.PI * 2); ctx.stroke(); }
    else if (f.kind === 'burst') { ctx.strokeStyle = f.color; ctx.lineWidth = px * 2.5; ctx.beginPath(); ctx.arc(f.x, f.y, 0.2 + k * 1.1, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  // placement footprints
  if (cs.placing) drawPlacementGround(ctx, cs, w, px);

  // ================================================================ 2. objects
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  type Item = { depth: number; draw: () => void };
  const items: Item[] = [];
  for (const e of wells) items.push({ depth: e.x + e.y, draw: () => drawWell(ctx, cs, e, rf) });
  for (const b of buildings) items.push({ depth: depthOf(b), draw: () => drawBuilding(ctx, cs, w, b, 1) });
  for (const b of ghosts) items.push({ depth: depthOf(b), draw: () => drawBuilding(ctx, cs, w, b, 0.4) });
  const hitNow = new Set<number>(), firing = new Map<number, number>();
  for (const f of cs.fx) if (f.from !== undefined && f.t < 0.12) { if (f.to !== undefined && f.kind !== 'heal') hitNow.add(f.to); firing.set(f.from, toU(f.x2!, f.y2!) - toU(f.x, f.y)); }
  const spawning = new Map<number, number>();
  for (const f of cs.fx) {
    if (f.kind === 'spawn' && f.id !== undefined) spawning.set(f.id, f.t / f.life);
    if (f.kind === 'derez') items.push({ depth: f.x + f.y, draw: () => drawDerez(ctx, cs, f) });
  }
  for (const e of units) items.push({ depth: depthOf(e), draw: () => drawUnit(ctx, cs, e, upos.get(e.id)!, hitNow.has(e.id), firing.get(e.id), spawning.get(e.id)) });
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) it.draw();

  // ================================================================ 3. overlay
  for (const b of buildings) overlayBuilding(ctx, cs, b);
  // x-ray: programs standing behind a nearer structure show through as a flat team-coloured silhouette
  // (stronger when selected), so nobody is lost inside a dense base
  {
    const fronts = buildings.filter(b => !B.buildings[b.type].wall).map(b => ({ d: depthOf(b), r: buildingRect(cam, b.type, b.tx!, b.ty!, b.w!, b.h!) }));
    for (const e of units) {
      if (e.order?.type === 'operate' && e.order.phase === 'work') continue; // operators are meant to be inside
      const [x, y] = upos.get(e.id)!; const r = unitRect(cam, e.type, x, y); const cx = r.x + r.w / 2, cy = r.y + r.h * 0.55; const d = x + y;
      const hidden = fronts.some(f => f.d > d && cx > f.r.x + f.r.w * 0.12 && cx < f.r.x + f.r.w * 0.88 && cy > f.r.y + f.r.h * 0.08 && cy < f.r.y + f.r.h * 0.95);
      if (!hidden) continue;
      const img = scaledSprite(e.type, e.owner, 'sil', r.w); if (!img) continue;
      ctx.save(); ctx.globalAlpha = cs.sel.has(e.id) ? 0.6 : 0.34; ctx.translate(r.x + r.w / 2, r.y);
      if ((facing.get(e.id) ?? 1) * NATIVE_FACING[e.type] < 0) ctx.scale(-1, 1);
      ctx.drawImage(img, -r.w / 2, 0, r.w, r.h); ctx.restore();
    }
  }
  for (const e of units) overlayUnit(ctx, cs, e, upos.get(e.id)!);
  for (const f of cs.fx) {
    const k = f.t / f.life; ctx.globalAlpha = Math.max(0, 1 - k);
    if (f.kind === 'beam' || f.kind === 'siege' || f.kind === 'heal') {
      const src = f.from !== undefined ? w.get(f.from) : undefined, dst = f.to !== undefined ? w.get(f.to) : undefined;
      const [sx, sy] = proj(cam, src ? src.x : f.x, src ? src.y : f.y), [ex, ey] = proj(cam, dst ? dst.x : f.x2!, dst ? dst.y : f.y2!);
      const h0 = z * (src?.kind === 'building' ? 1.3 : CHEST), h1 = z * (dst?.kind === 'building' ? 0.6 : CHEST);
      const lw = f.kind === 'siege' ? Math.max(2.5, Math.min(6, z * 0.06)) : Math.max(1.5, Math.min(3, z * 0.03));
      if (f.kind === 'heal') { ctx.strokeStyle = f.color; ctx.lineWidth = lw; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(sx, sy - h0); ctx.lineTo(ex, ey - h1); ctx.stroke(); ctx.setLineDash([]); }
      else glowLine(ctx, f.color, lw, [[sx, sy - h0], [ex, ey - h1]]);
      ctx.strokeStyle = f.color; ctx.lineWidth = lw;
      if (f.kind === 'siege') { ctx.beginPath(); ctx.ellipse(ex, ey - h1, z * (0.3 + k * 0.6), z * (0.15 + k * 0.3), 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (f.kind === 'burst') {
      const [sx, sy] = proj(cam, f.x, f.y);
      for (let s = 0; s < 8; s++) { const an = s * 0.785 + f.x; const r1 = z * (0.2 + k * 1.0); ctx.fillStyle = f.color; ctx.fillRect(sx + Math.cos(an) * r1 - 2, sy - z * 0.4 + Math.sin(an) * r1 * 0.6 - 2 - k * z * 0.5, 4, 4); }
    } else if (f.kind === 'text') {
      const [sx, sy] = proj(cam, f.x, f.y);
      ctx.fillStyle = f.color; ctx.font = `600 ${Math.max(11, z * 0.3)}px ui-monospace,monospace`; ctx.textAlign = 'center';
      ctx.fillText(f.text!, sx, sy - z * 0.9 - k * z * 0.8);
    }
    ctx.globalAlpha = 1;
  }
  if (cs.placing) drawPlacementLabel(ctx, cs);
  if (cs.box) {
    const { x0, y0, x1, y1 } = cs.box;
    ctx.strokeStyle = '#9ff3ff'; ctx.lineWidth = 1; ctx.fillStyle = '#3ee6ff18';
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  if (cs.mode === 'attackMove' && cs.mouse.inView) {
    const dpr = W / innerWidth; const sx = cs.mouse.sx * dpr, sy = cs.mouse.sy * dpr;
    ctx.strokeStyle = '#ff4f6d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.moveTo(sx - 15, sy); ctx.lineTo(sx + 15, sy); ctx.moveTo(sx, sy - 15); ctx.lineTo(sx, sy + 15); ctx.stroke();
  }
}

// ---------------------------------------------------------------- objects
function drawWell(ctx: CanvasRenderingContext2D, cs: ClientState, e: Entity, rf: boolean) {
  const z = cs.cam.z; const [gx, gy] = proj(cs.cam, e.x, e.y);
  if (gx < -z * 2 || gy < -z * 2 || gx > ctx.canvas.width + z * 2 || gy > ctx.canvas.height + z * 2) return;
  const col = e.type === 'fragment' ? FRAG_C : DATA_C;
  const s = z * (e.type === 'fragment' ? 0.28 : 0.42) * (0.55 + 0.45 * e.amount! / e.initial!);
  const bob = rf ? 0 : Math.sin(cs.time * 2 + e.id) * z * 0.04;
  // a cluster of upright data crystals
  const shards: [number, number, number][] = [[0, 1.6, 0.55], [-0.55, 1.05, 0.4], [0.5, 1.15, 0.42], [0.15, 0.8, 0.3]];
  for (const [ox, hgt, wd] of shards) {
    const cx = gx + ox * s, top = gy - hgt * s * 1.6 + bob, half = wd * s;
    const grd = ctx.createLinearGradient(cx, top, cx, gy); grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, col); grd.addColorStop(1, col + '33');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + half, top + half * 1.4); ctx.lineTo(cx + half * 0.7, gy - half * 0.2); ctx.lineTo(cx - half * 0.7, gy - half * 0.2); ctx.lineTo(cx - half, top + half * 1.4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffffff99'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, gy - half * 0.2); ctx.stroke();
  }
}

/** A bright line with a soft halo (two strokes; cheaper than shadowBlur on software rendering). */
function glowLine(ctx: CanvasRenderingContext2D, color: string, width: number, pts: [number, number][]) {
  ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.strokeStyle = color + '55'; ctx.lineWidth = width * 3; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function drawBuilding(ctx: CanvasRenderingContext2D, cs: ClientState, w: World, e: Entity, alpha: number) {
  const bd = B.buildings[e.type];
  if (bd.wall) { drawWall(ctx, cs, w, e, alpha); return; }
  const r = buildingRect(cs.cam, e.type, e.tx!, e.ty!, e.w!, e.h!);
  if (r.x > ctx.canvas.width || r.y > ctx.canvas.height || r.x + r.w < 0 || r.y + r.h < 0) return;
  const img = scaledSprite(e.type, e.owner, '', r.w);
  const c = COLORS[e.owner] ?? COLORS[0];
  const rf = cs.settings.reducedFlash;
  if (!img) { ctx.globalAlpha = alpha; ctx.fillStyle = c.dark; ctx.fillRect(r.x + r.w * 0.2, r.y + r.h * 0.3, r.w * 0.6, r.h * 0.6); ctx.globalAlpha = 1; return; }
  const inactive = alpha < 1 || (e.built && (!e.active || e.stall === 'paused'));
  if (!e.built) {
    // hologram of the finished structure, with the built part rising from the ground
    const f = Math.max(0, Math.min(1, e.progress! / bd.build));
    ctx.globalAlpha = 0.22; ctx.drawImage(scaledSprite(e.type, e.owner, 'holo', r.w) ?? img, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
    const reveal = r.h * (0.12 + 0.88 * f);
    ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y + r.h - reveal, r.w, reveal); ctx.clip();
    ctx.drawImage(img, r.x, r.y, r.w, r.h); ctx.restore();
    glowLine(ctx, c.main, 2, [[r.x + r.w * 0.08, r.y + r.h - reveal], [r.x + r.w * 0.92, r.y + r.h - reveal]]);
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.drawImage(inactive ? scaledSprite(e.type, e.owner, 'gray', r.w) ?? img : img, r.x, r.y, r.w, r.h);
  ctx.globalAlpha = 1;
  if (alpha < 1) return;
  // working glow: producers pulse while staffed and powered
  if (!inactive && !rf && w.operatorPresent(e) && ['compiler', 'rig', 'node', 'core'].includes(e.type)) {
    const glow = scaledSprite(e.type, e.owner, 'glow', r.w);
    if (glow) { ctx.globalAlpha = 0.07 + 0.06 * Math.sin(cs.time * 4 + e.id); ctx.drawImage(glow, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
  }
  if (cs.sel.has(e.id)) { // selected: a soft highlight on the sprite itself (the ground outline is hidden behind it)
    const g = scaledSprite(e.type, e.owner, 'glow', r.w);
    if (g) { ctx.globalAlpha = 0.16 + (rf ? 0 : 0.06 * Math.sin(cs.time * 5)); ctx.drawImage(g, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
  }
  if (e.type === 'gate' && !e.open) {
    // closed gate: a translucent energy barrier across the arch
    const bx = r.x + r.w * 0.3, by = r.y + r.h * 0.42, bw = r.w * 0.4, bh = r.h * 0.48;
    ctx.fillStyle = c.main + '40'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = c.main + 'cc'; ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) { const yy = by + ((k / 5 + (rf ? 0 : cs.time * 0.4)) % 1) * bh; ctx.beginPath(); ctx.moveTo(bx, yy); ctx.lineTo(bx + bw, yy); ctx.stroke(); }
  }
  // damage: sparks when below half integrity
  const hpf = e.hp / e.maxHp;
  if (hpf < 0.5 && !rf) {
    for (let k = 0; k < (hpf < 0.25 ? 4 : 2); k++) {
      const ph = (cs.time * 3 + k * 0.37 + e.id * 0.13) % 1; if (ph > 0.35) continue;
      const sx = r.x + r.w * (0.25 + ((e.id * 7 + k * 13) % 50) / 100), sy = r.y + r.h * (0.35 + ((e.id * 3 + k * 29) % 40) / 100);
      ctx.fillStyle = k % 2 ? '#ffcf5a' : '#ff6a3d'; ctx.fillRect(sx - 2, sy - 2 - ph * 12, 3, 3);
    }
  }
}

/** Firewall segments, modelled on the concept render: thin graphite panels with a glowing team seam between
 *  taller pillars (at line ends, corners and junctions). Built procedurally so any wall line joins cleanly. */
function drawWall(ctx: CanvasRenderingContext2D, cs: ClientState, w: World, e: Entity, alpha: number) {
  const cam = cs.cam, z = cam.z; const x = e.tx!, y = e.ty!;
  const [cx, cy] = proj(cam, x + 0.5, y + 0.5);
  if (cx < -z * 2 || cx > ctx.canvas.width + z * 2 || cy < -z || cy > ctx.canvas.height + z * 2) return;
  const isWall = (xx: number, yy: number) => { if (xx < 0 || yy < 0 || xx >= w.map.w || yy >= w.map.h) return false; const id = w.nav.block[yy * w.map.w + xx]; const n = id ? w.get(id) : undefined; return !!n && (B.buildings[n.type].wall || B.buildings[n.type].gate); };
  const nx0 = isWall(x - 1, y), nx1 = isWall(x + 1, y), ny0 = isWall(x, y - 1), ny1 = isWall(x, y + 1);
  // straight runs are panels; ends, corners, junctions and lone tiles get a taller pillar
  const pillar = !((nx0 && nx1 && !ny0 && !ny1) || (ny0 && ny1 && !nx0 && !nx1));
  const grow = e.built ? 1 : Math.max(0.1, Math.min(1, e.progress! / B.buildings.wall.build));
  const c = COLORS[e.owner] ?? COLORS[0]; const rf = cs.settings.reducedFlash;
  ctx.globalAlpha = alpha * (e.built ? 1 : 0.85);
  const T = 0.16; // half thickness of a panel run
  // panel runs toward each neighbour (drawn back-to-front: the -x/-y halves first)
  if (nx0) wallBox(ctx, cam, x, y + 0.5 - T, x + 0.5, y + 0.5 + T, z * 0.8 * grow, c.main, rf, false);
  if (ny0) wallBox(ctx, cam, x + 0.5 - T, y, x + 0.5 + T, y + 0.5, z * 0.8 * grow, c.main, rf, false);
  if (pillar) wallBox(ctx, cam, x + 0.22, y + 0.22, x + 0.78, y + 0.78, z * 1.12 * grow, c.main, rf, true);
  else wallBox(ctx, cam, nx0 || nx1 ? x + 0.5 - 0.01 : x + 0.5 - T, nx0 || nx1 ? y + 0.5 - T : y + 0.5 - 0.01, nx0 || nx1 ? x + 0.5 + 0.01 : x + 0.5 + T, nx0 || nx1 ? y + 0.5 + T : y + 0.5 + 0.01, z * 0.8 * grow, c.main, rf, false);
  if (nx1) wallBox(ctx, cam, x + 0.5, y + 0.5 - T, x + 1, y + 0.5 + T, z * 0.8 * grow, c.main, rf, false);
  if (ny1) wallBox(ctx, cam, x + 0.5 - T, y + 0.5, x + 0.5 + T, y + 1, z * 0.8 * grow, c.main, rf, false);
  ctx.globalAlpha = 1;
}
/** An extruded box over the world rectangle [x0,x1]×[y0,y1], height H px, in the firewall's material. */
function wallBox(ctx: CanvasRenderingContext2D, cam: { x: number; y: number; z: number }, x0: number, y0: number, x1: number, y1: number, H: number, team: string, rf: boolean, pillar: boolean) {
  const [lx, ly] = proj(cam, x0, y1), [bx, by] = proj(cam, x1, y1), [rx, ry] = proj(cam, x1, y0), [tx, ty] = proj(cam, x0, y0);
  const face = (ax: number, ay: number, qx: number, qy: number, top: string, bot: string) => {
    const g = ctx.createLinearGradient(0, Math.min(ay, qy) - H, 0, Math.max(ay, qy)); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(qx, qy); ctx.lineTo(qx, qy - H); ctx.lineTo(ax, ay - H); ctx.closePath(); ctx.fill();
  };
  face(lx, ly, bx, by, '#2a3546', '#121925'); face(bx, by, rx, ry, '#1c2533', '#0b1018');
  ctx.fillStyle = '#34425a'; ctx.beginPath(); ctx.moveTo(tx, ty - H); ctx.lineTo(rx, ry - H); ctx.lineTo(bx, by - H); ctx.lineTo(lx, ly - H); ctx.closePath(); ctx.fill();
  // bevel edges
  ctx.strokeStyle = '#5b6d86'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(lx, ly - H); ctx.lineTo(bx, by - H); ctx.lineTo(rx, ry - H); ctx.moveTo(bx, by - H); ctx.lineTo(bx, by); ctx.stroke();
  // circuit seam: a stepped glowing line across both visible faces (the concept's cyan trace)
  const k1 = pillar ? 0.25 : 0.55, k2 = pillar ? 0.75 : 0.35;
  const pts: [number, number][] = [[lx, ly - H * k1], [(lx + bx) / 2, (ly + by) / 2 - H * k1], [(lx + bx) / 2, (ly + by) / 2 - H * k2], [bx, by - H * k2], [(bx + rx) / 2, (by + ry) / 2 - H * k2], [(bx + rx) / 2, (by + ry) / 2 - H * k1], [rx, ry - H * k1]];
  if (!rf) { ctx.strokeStyle = team + '44'; ctx.lineWidth = Math.max(3, cam.z * 0.07); ctx.beginPath(); pts.forEach(([a, b2], i) => i ? ctx.lineTo(a, b2) : ctx.moveTo(a, b2)); ctx.stroke(); }
  ctx.strokeStyle = team; ctx.lineWidth = Math.max(1, cam.z * 0.025); ctx.beginPath(); pts.forEach(([a, b2], i) => i ? ctx.lineTo(a, b2) : ctx.moveTo(a, b2)); ctx.stroke();
  if (pillar) {
    // cap, antenna and amber status lights, as on the concept's end posts
    const mx = (tx + bx) / 2, my = (ty + by) / 2 - H;
    ctx.strokeStyle = '#8fa3bd'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - cam.z * 0.28); ctx.stroke();
    ctx.fillStyle = team; ctx.fillRect(mx - 1.5, my - cam.z * 0.3 - 1.5, 3, 3);
    ctx.fillStyle = '#ffb74a'; ctx.fillRect((lx + bx) / 2 - 1.5, (ly + by) / 2 - H * 0.9, 3, 2); ctx.fillRect((bx + rx) / 2 - 1.5, (by + ry) / 2 - H * 0.9, 3, 2);
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, cs: ClientState, e: Entity, pos: [number, number, number, number], hit: boolean, fireDu?: number, spawnK?: number) {
  const [x, y, dx, dy] = pos;
  const r = unitRect(cs.cam, e.type, x, y);
  if (r.x > ctx.canvas.width || r.y > ctx.canvas.height || r.x + r.w < 0 || r.y + r.h < 0) return;
  const rf = cs.settings.reducedFlash;
  // facing: toward the current shot, else toward movement, else keep the last facing
  const du = fireDu ?? (dx - dy) * KU;
  if (Math.abs(du) > 0.002) facing.set(e.id, du > 0 ? 1 : -1);
  const face = facing.get(e.id) ?? (e.owner === 2 ? -1 : 1);
  const flip = face * NATIVE_FACING[e.type] < 0;
  const speed = Math.hypot(dx, dy); const moving = speed > 1e-4;
  const phase = cs.time * (6 + speed * 40) + e.id * 1.7;
  const bob = moving && !rf ? -Math.abs(Math.sin(phase)) * r.h * 0.035 : 0;
  // firing: ranged programs kick back, melee programs lunge in
  const melee = (B.units[e.type].attack?.range ?? 2) < 1.2;
  const kick = fireDu !== undefined && !rf ? (melee ? 1 : -1) * Math.sign(fireDu) * r.w * (melee ? 0.08 : 0.04) : 0;
  const variant = e.suspended ? 'susp' : e.forkOf ? 'fork' : '';
  const img = scaledSprite(e.type, e.owner, variant, r.w);
  ctx.save();
  ctx.translate(r.x + r.w / 2 + kick, r.y + bob);
  if (flip) ctx.scale(-1, 1);
  if (e.forkOf) ctx.globalAlpha = 0.72;
  if (img) {
    const iw = (img as HTMLCanvasElement).width, ih = (img as HTMLCanvasElement).height;
    if (spawnK !== undefined && spawnK < 1) {
      // materialise: the program compiles in from the ground up behind a bright scan line
      const k = spawnK, reveal = r.h * k;
      ctx.save(); ctx.beginPath(); ctx.rect(-r.w, r.h - reveal, r.w * 2, reveal); ctx.clip(); ctx.drawImage(img, -r.w / 2, 0, r.w, r.h); ctx.restore();
      const g = scaledSprite(e.type, e.owner, 'sil', r.w); if (g) { ctx.globalAlpha = 0.35 * (1 - k); ctx.drawImage(g, -r.w / 2, 0, r.w, r.h); ctx.globalAlpha = 1; }
      ctx.fillStyle = (COLORS[e.owner] ?? COLORS[0]).main; ctx.fillRect(-r.w * 0.45, r.h - reveal - 1, r.w * 0.9, 2);
    } else if (moving && !rf) {
      // stride: the upper body rides the bob while the lower third swings about the hips (no extra frames needed)
      const hip = 0.62, sway = Math.sin(phase) * 0.16;
      ctx.drawImage(img, 0, 0, iw, ih * hip, -r.w / 2, 0, r.w, r.h * hip);
      ctx.save(); ctx.translate(0, r.h * hip); ctx.transform(1, 0, sway, 1, 0, 0);
      ctx.drawImage(img, 0, ih * hip, iw, ih * (1 - hip), -r.w / 2, -0.5, r.w, r.h * (1 - hip) + 0.5);
      ctx.restore();
    } else ctx.drawImage(img, -r.w / 2, 0, r.w, r.h);
    if (hit && !rf) { const g = scaledSprite(e.type, e.owner, 'glow', r.w); if (g) { ctx.globalAlpha = 0.5; ctx.drawImage(g, -r.w / 2, 0, r.w, r.h); } }
  } else {
    const c = COLORS[e.owner] ?? COLORS[0]; ctx.fillStyle = c.dark; ctx.strokeStyle = c.main;
    ctx.beginPath(); ctx.ellipse(0, r.h * 0.6, r.h * 0.22, r.h * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  // muzzle flash for ranged shots, at the weapon side at chest height
  if (fireDu !== undefined && !melee && !rf) {
    const mx = r.x + r.w / 2 + Math.sign(fireDu) * r.w * 0.42, my = r.y + r.h * 0.42;
    ctx.fillStyle = '#ffffffcc'; ctx.beginPath(); ctx.arc(mx, my, Math.max(2, cs.cam.z * 0.06), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = (COLORS[e.owner] ?? COLORS[0]).main + '88'; ctx.beginPath(); ctx.arc(mx, my, Math.max(4, cs.cam.z * 0.13), 0, Math.PI * 2); ctx.fill();
  }
}

/** A destroyed program or structure de-rezzes: horizontal slices glitch sideways, sink and fade. */
function drawDerez(ctx: CanvasRenderingContext2D, cs: ClientState, f: Fx) {
  const k = f.t / f.life; const type = f.type!;
  const isUnit = !!B.units[type];
  let r: Rect;
  if (isUnit) r = unitRect(cs.cam, type, f.x, f.y);
  else { const d = B.buildings[type]; r = buildingRect(cs.cam, type, f.x - d.w / 2, f.y - d.h / 2, d.w, d.h); }
  if (r.x > ctx.canvas.width || r.y > ctx.canvas.height || r.x + r.w < 0 || r.y + r.h < 0) return;
  const img = scaledSprite(type, f.owner ?? 1, 'glow', r.w) as HTMLCanvasElement | null; if (!img) return;
  const flip = isUnit && (f.face ?? (f.owner === 2 ? -1 : 1)) * NATIVE_FACING[type] < 0;
  const rf = cs.settings.reducedFlash;
  ctx.save(); ctx.translate(r.x + r.w / 2, r.y + r.h * k * 0.25); if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = Math.max(0, 1 - k) * 0.9;
  const slices = 10; const iw = img.width, ih = img.height;
  for (let sIdx = 0; sIdx < slices; sIdx++) {
    const sy = ih * sIdx / slices, sh = ih / slices + 1;
    const off = rf ? 0 : Math.sin(sIdx * 12.9898 + f.x * 78.233 + f.t * 40) * r.w * 0.18 * k;
    ctx.drawImage(img, 0, sy, iw, sh, -r.w / 2 + off, r.h * sIdx / slices, r.w, r.h / slices + 1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- overlay
function overlayBuilding(ctx: CanvasRenderingContext2D, cs: ClientState, e: Entity) {
  const bd = B.buildings[e.type]; const z = cs.cam.z;
  let top: number, cx: number, wid: number;
  if (bd.wall) { const [bx, by] = proj(cs.cam, e.tx! + 0.5, e.ty! + 0.5); cx = bx; top = by - z * 1.3; wid = z * 0.9; }
  else { const r = buildingRect(cs.cam, e.type, e.tx!, e.ty!, e.w!, e.h!); cx = r.x + r.w / 2; top = r.y + r.h * 0.08; wid = Math.max(28, r.w * 0.5); }
  if (cx < -wid || cx > ctx.canvas.width + wid || top < -40 || top > ctx.canvas.height + 40) return;
  if (!e.built) bar(ctx, cx - wid / 2, top - 8, wid, 4, e.progress! / bd.build, '#ffd24a');
  else if (e.hp < e.maxHp || cs.sel.has(e.id)) bar(ctx, cx - wid / 2, top - 8, wid, 4, e.hp / e.maxHp, hpColor(e.hp / e.maxHp));
  if (e.queue && e.queue.length && e.queue[0].started) bar(ctx, cx - wid / 2, top - 2, wid, 3, e.queue[0].progress / B.units[e.queue[0].unit].time, '#3ee6ff');
  if (e.owner === cs.me && e.stall && e.stall !== 'operatorWalking') {
    const sev = e.stall === 'paused' ? '#7f95b8' : '#ffd24a';
    ctx.fillStyle = '#000000b0'; ctx.beginPath(); ctx.arc(cx + wid / 2 + 8, top - 6, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = sev; ctx.font = `700 12px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.stall === 'paused' ? '⏸' : '!', cx + wid / 2 + 8, top - 5); ctx.textBaseline = 'alphabetic';
  }
}

function overlayUnit(ctx: CanvasRenderingContext2D, cs: ClientState, e: Entity, pos: [number, number, number, number]) {
  const r = unitRect(cs.cam, e.type, pos[0], pos[1]);
  if (r.x > ctx.canvas.width || r.y > ctx.canvas.height || r.x + r.w < 0 || r.y + r.h < 0) return;
  const cx = r.x + r.w / 2, top = r.y;
  if (e.hp < e.maxHp || cs.sel.has(e.id)) { const bw = Math.max(18, cs.cam.z * 0.6); bar(ctx, cx - bw / 2, top - 6, bw, 3, e.hp / e.maxHp, hpColor(e.hp / e.maxHp)); }
  for (let k = 0; k < (e.rank ?? 0); k++) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 4, top - 10 - k * 4); ctx.lineTo(cx, top - 13 - k * 4); ctx.lineTo(cx + 4, top - 10 - k * 4); ctx.stroke(); }
  if (e.type === 'runner' && (e.carry ?? 0) > 0) { ctx.fillStyle = DATA_C; ctx.save(); ctx.translate(cx + r.w * 0.28, top + r.h * 0.12); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
  if (e.suspended) { ctx.fillStyle = '#cfd6e4'; ctx.font = `700 ${Math.max(10, cs.cam.z * 0.25)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(e.crashed ? '!z' : 'z', cx, top - 10); }
}

function hpColor(f: number) { return f > 0.6 ? '#6dffa8' : f > 0.3 ? '#ffd24a' : '#ff4f6d'; }
function bar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, col: string) {
  ctx.fillStyle = '#000000aa'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}

export function wallLine(a: { tx: number; ty: number }, b: { tx: number; ty: number }): { tx: number; ty: number }[] {
  // Bresenham-style line of tiles; walls prefer straight/diagonal runs.
  const out: { tx: number; ty: number }[] = [];
  let x = a.tx, y = a.ty; const dx = Math.abs(b.tx - x), dy = Math.abs(b.ty - y); const sx = x < b.tx ? 1 : -1, sy = y < b.ty ? 1 : -1;
  let err = dx - dy;
  for (let n = 0; n < 64; n++) {
    out.push({ tx: x, ty: y });
    if (x === b.tx && y === b.ty) break;
    const e2 = 2 * err;
    if (e2 > -dy && e2 < dx) { // diagonal step: add an orthogonal tile so the wall has no diagonal gap
      err -= dy; x += sx; out.push({ tx: x, ty: y }); err += dx; y += sy; continue;
    }
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return out;
}

function drawPlacementGround(ctx: CanvasRenderingContext2D, cs: ClientState, w: World, px: number) {
  const p = cs.placing!;
  const d = B.buildings[p.type];
  const tiles = p.dragStart && d.wall ? wallLine(p.dragStart, { tx: p.tx, ty: p.ty }) : [{ tx: p.tx, ty: p.ty }];
  let dataLeft = w.players[cs.me].data;
  for (const t of tiles) {
    let r = canPlace(w, cs.me, p.type, t.tx, t.ty);
    if (r.ok && (d.cost.data ?? 0) > dataLeft) r = { ok: false, reason: 'Not enough Data for the whole line' };
    if (r.ok) dataLeft -= d.cost.data ?? 0;
    ctx.fillStyle = r.ok ? '#6dffa833' : '#ff4f6d44'; ctx.strokeStyle = r.ok ? '#6dffa8' : '#ff4f6d'; ctx.lineWidth = px * 2;
    ctx.fillRect(t.tx, t.ty, d.w, d.h); ctx.strokeRect(t.tx + 0.03, t.ty + 0.03, d.w - 0.06, d.h - 0.06);
    if (d.attack) { ctx.strokeStyle = '#ffffff40'; ctx.beginPath(); ctx.arc(t.tx + d.w / 2, t.ty + d.h / 2, d.attack.range, 0, Math.PI * 2); ctx.stroke(); }
  }
  const first = canPlace(w, cs.me, p.type, p.tx, p.ty);
  p.ok = first.ok; p.reason = first.reason;
}
function drawPlacementLabel(ctx: CanvasRenderingContext2D, cs: ClientState) {
  const p = cs.placing!; const d = B.buildings[p.type];
  // ghost of the sprite itself, so the player sees what will stand there
  if (!d.wall) {
    const img = sprite(p.type, cs.me);
    if (img) { const r = buildingRect(cs.cam, p.type, p.tx, p.ty, d.w, d.h); ctx.globalAlpha = 0.5; ctx.drawImage(img, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
  }
  const [sx, sy] = proj(cs.cam, p.tx, p.ty);
  ctx.font = '600 13px system-ui,sans-serif'; ctx.textAlign = 'left';
  const label = `${d.name}${d.wall ? ' — drag for a line' : ''}${p.ok ? '' : ' · ' + p.reason}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#000000cc'; ctx.fillRect(sx - tw / 2 - 5, sy - 26, tw + 10, 18);
  ctx.fillStyle = p.ok ? '#d8ffe8' : '#ffc3cd'; ctx.fillText(label, sx - tw / 2, sy - 12);
}

// ---------------------------------------------------------------- picking (screen space, front-most first)
/** Entity under canvas pixel (sx, sy): unit sprites, then structures (sprite or footprint), then wells. */
export function pickAt(cs: ClientState, sx: number, sy: number): Entity | undefined {
  const w = cs.game.world; const me = cs.me; const cam = cs.cam;
  const inside = (r: Rect, shrink: number) => sx >= r.x + r.w * shrink && sx <= r.x + r.w * (1 - shrink) && sy >= r.y + r.h * 0.05 && sy <= r.y + r.h + cam.z * 0.2;
  let best: Entity | undefined, bd = -Infinity;
  for (const e of w.entities) {
    if (e.dead || e.kind !== 'unit') continue;
    if (e.owner !== me && !w.canSee(me, e)) continue;
    if (inside(unitRect(cam, e.type, e.x, e.y), 0.22) && depthOf(e) > bd) { bd = depthOf(e); best = e; }
  }
  if (best) return best;
  const g = unproj(cam, sx, sy);
  for (const e of w.entities) {
    if (e.dead || e.kind !== 'building') continue;
    if (e.owner !== me && !w.canSee(me, e)) continue;
    const onFoot = g.x >= e.tx! && g.x < e.tx! + e.w! && g.y >= e.ty! && g.y < e.ty! + e.h!;
    const onSprite = !B.buildings[e.type].wall && inside(buildingRect(cam, e.type, e.tx!, e.ty!, e.w!, e.h!), 0.18);
    if ((onFoot || onSprite) && depthOf(e) + (onFoot ? 100 : 0) > bd) { bd = depthOf(e) + (onFoot ? 100 : 0); best = e; }
  }
  if (best) return best;
  for (const e of w.entities) {
    if (e.dead || e.kind !== 'well') continue;
    if (!w.players[me].explored[Math.floor(e.y) * w.map.w + Math.floor(e.x)]) continue;
    const [wx, wy] = proj(cam, e.x, e.y);
    if (Math.abs(sx - wx) < cam.z * 0.45 && sy <= wy + cam.z * 0.2 && sy >= wy - cam.z * 0.9) return e;
  }
  return undefined;
}

// ---------------------------------------------------------------- minimap (iso diamond, same orientation as the view)
let mm = { s: 1, ox: 0, oy: 0, u0: 0, v0: 0 };
export function miniToWorld(px: number, py: number) {
  const u = (px - mm.ox) / mm.s + mm.u0, v = (py - mm.oy) / mm.s + mm.v0;
  const a = u / KU, b = v / KV; return { x: (a + b) / 2, y: (b - a) / 2 };
}
export function renderMinimap(mctx: CanvasRenderingContext2D, cs: ClientState, viewW: number, viewH: number) {
  const w = cs.game.world; const MW = w.map.w, MH = w.map.h;
  const Wm = mctx.canvas.width, Hm = mctx.canvas.height;
  const bnd = mapBounds(MW, MH);
  const s = Math.min((Wm - 6) / (bnd.u1 - bnd.u0), (Hm - 6) / (bnd.v1 - bnd.v0));
  mm = { s, ox: (Wm - (bnd.u1 - bnd.u0) * s) / 2, oy: (Hm - (bnd.v1 - bnd.v0) * s) / 2, u0: bnd.u0, v0: bnd.v0 };
  mctx.setTransform(1, 0, 0, 1, 0, 0); mctx.fillStyle = '#02060c'; mctx.fillRect(0, 0, Wm, Hm);
  if (!miniBase || miniBaseFor !== w) {
    miniBaseFor = w;
    miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
    const c = miniBase.getContext('2d')!; const img = c.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) { const v = w.nav.terrain[i]; img.data[i * 4] = v ? 20 : 12; img.data[i * 4 + 1] = v ? 6 : 28; img.data[i * 4 + 2] = v ? 40 : 52; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  mctx.setTransform(KU * s, KV * s, -KU * s, KV * s, mm.ox - mm.u0 * s, mm.oy - mm.v0 * s);
  mctx.imageSmoothingEnabled = false; mctx.drawImage(miniBase, 0, 0, MW, MH);
  mctx.imageSmoothingEnabled = true; if (fogCanvas) mctx.drawImage(fogCanvas, 0, 0, MW, MH);
  const me = cs.me; const exp = w.players[me].explored;
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'well') { if (!exp[Math.floor(e.y) * MW + Math.floor(e.x)]) continue; mctx.fillStyle = e.type === 'fragment' ? FRAG_C : DATA_C; mctx.fillRect(e.x - 0.8, e.y - 0.8, 1.6, 1.6); continue; }
    if (e.owner !== me && !w.canSee(me, e)) continue;
    mctx.fillStyle = (COLORS[e.owner] ?? COLORS[0]).main;
    if (e.kind === 'building') mctx.fillRect(e.tx!, e.ty!, Math.max(1, e.w!), Math.max(1, e.h!));
    else mctx.fillRect(e.x - 0.9, e.y - 0.9, 1.8, 1.8);
  }
  mctx.strokeStyle = '#2a4a6a'; mctx.lineWidth = 0.8; mctx.strokeRect(0, 0, MW, MH);
  mctx.lineWidth = 0.6;
  for (const ls of Object.values(w.players[me].lastSeen)) { mctx.strokeStyle = (COLORS[ls.owner] ?? COLORS[0]).main; mctx.strokeRect(ls.tx, ls.ty, ls.w, ls.h); }
  // camera footprint on the ground
  const c = [unproj(cs.cam, 0, 0), unproj(cs.cam, viewW, 0), unproj(cs.cam, viewW, viewH), unproj(cs.cam, 0, viewH)];
  mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 0.8; mctx.beginPath(); c.forEach((p, i) => i ? mctx.lineTo(p.x, p.y) : mctx.moveTo(p.x, p.y)); mctx.closePath(); mctx.stroke();
  mctx.setTransform(1, 0, 0, 1, 0, 0);
}
