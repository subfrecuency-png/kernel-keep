// Canvas 2.5D renderer. Reads world state; never mutates it.
import { B, Entity } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import { ClientState, COLORS } from './state.ts';
import { canPlace } from '../sim/commands.ts';

let fogCanvas: HTMLCanvasElement | null = null;
let fogCtx: CanvasRenderingContext2D | null = null;
let fogImg: ImageData | null = null;
let miniBase: HTMLCanvasElement | null = null;

const DATA_C = '#7cc7ff', FRAG_C = '#c59bff';

export function render(ctx: CanvasRenderingContext2D, cs: ClientState, W: number, H: number) {
  const w = cs.game.world;
  const { cam } = cs; const z = cam.z;
  const me = cs.me;
  const vis = w.visible[me], exp = w.players[me].explored;
  const MW = w.map.w, MH = w.map.h;
  const S = (x: number, y: number): [number, number] => [(x - cam.x) * z, (y - cam.y) * z];
  const rf = cs.settings.reducedFlash;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#010204'; ctx.fillRect(0, 0, W, H);

  // ---------- terrain ----------
  const tx0 = Math.max(0, Math.floor(cam.x)), ty0 = Math.max(0, Math.floor(cam.y));
  const tx1 = Math.min(MW - 1, Math.floor(cam.x + W / z)), ty1 = Math.min(MH - 1, Math.floor(cam.y + H / z));
  {
    const [ox, oy] = S(0, 0);
    ctx.fillStyle = '#060c18'; ctx.fillRect(ox, oy, MW * z, MH * z);
    // void
    ctx.fillStyle = '#000000';
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) if (w.nav.terrain[y * MW + x]) { const [sx, sy] = S(x, y); ctx.fillRect(sx, sy, z + 0.5, z + 0.5); }
    // lattice lines
    ctx.lineWidth = 1;
    for (let x = tx0; x <= tx1 + 1; x++) {
      ctx.strokeStyle = x % 8 === 0 ? '#16305a' : '#0c1a31';
      const [sx] = S(x, 0); ctx.beginPath(); ctx.moveTo(Math.round(sx) + 0.5, Math.max(0, oy)); ctx.lineTo(Math.round(sx) + 0.5, Math.min(H, oy + MH * z)); ctx.stroke();
    }
    for (let y = ty0; y <= ty1 + 1; y++) {
      ctx.strokeStyle = y % 8 === 0 ? '#16305a' : '#0c1a31';
      const [, sy] = S(0, y); ctx.beginPath(); ctx.moveTo(Math.max(0, ox), Math.round(sy) + 0.5); ctx.lineTo(Math.min(W, ox + MW * z), Math.round(sy) + 0.5); ctx.stroke();
    }
    // void edges
    ctx.strokeStyle = '#7b3fe0'; ctx.lineWidth = Math.max(1, z * 0.08);
    ctx.beginPath();
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      if (!w.nav.terrain[y * MW + x]) continue;
      const [sx, sy] = S(x, y);
      if (x > 0 && !w.nav.terrain[y * MW + x - 1]) { ctx.moveTo(sx, sy); ctx.lineTo(sx, sy + z); }
      if (x < MW - 1 && !w.nav.terrain[y * MW + x + 1]) { ctx.moveTo(sx + z, sy); ctx.lineTo(sx + z, sy + z); }
      if (y > 0 && !w.nav.terrain[(y - 1) * MW + x]) { ctx.moveTo(sx, sy); ctx.lineTo(sx + z, sy); }
      if (y < MH - 1 && !w.nav.terrain[(y + 1) * MW + x]) { ctx.moveTo(sx, sy + z); ctx.lineTo(sx + z, sy + z); }
    }
    ctx.stroke();
  }

  const t = cs.time;
  // ---------- wells ----------
  for (const e of w.entities) {
    if (e.kind !== 'well' || e.dead) continue;
    if (!exp[Math.floor(e.y) * MW + Math.floor(e.x)]) continue;
    const [sx, sy] = S(e.x, e.y);
    if (sx < -z || sy < -z || sx > W + z || sy > H + z) continue;
    const frac = e.amount! / e.initial!;
    const r = z * (e.type === 'fragment' ? 0.28 : 0.42);
    const pulse = rf ? 1 : 0.85 + 0.15 * Math.sin(t * 2 + e.id);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = (e.type === 'fragment' ? FRAG_C : DATA_C) + '22';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = e.type === 'fragment' ? FRAG_C : DATA_C; ctx.lineWidth = Math.max(1.5, z * 0.07);
    ctx.globalAlpha = pulse;
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.stroke();
    ctx.fillStyle = e.type === 'fragment' ? FRAG_C : DATA_C;
    ctx.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff88'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.35, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac); ctx.stroke();
    ctx.restore();
  }

  // ---------- buildings ----------
  const selB: Entity[] = [];
  for (const e of w.entities) {
    if (e.kind !== 'building' || e.dead) continue;
    const mine = e.owner === me;
    if (!mine && !w.canSee(me, e)) continue; // drawn from memory below
    drawBuilding(ctx, cs, w, e, S, z, 1);
    if (cs.sel.has(e.id)) selB.push(e);
  }
  // remembered enemy structures
  for (const [key, ls] of Object.entries(w.players[me].lastSeen)) {
    const id = Number(key); const e = w.byId.get(id);
    if (e && !e.dead && w.canSee(me, e)) continue;
    const ghost: Entity = { id, kind: 'building', type: ls.type, owner: ls.owner, x: ls.tx + ls.w / 2, y: ls.ty + ls.h / 2, tx: ls.tx, ty: ls.ty, w: ls.w, h: ls.h, hp: 1, maxHp: 1, built: true, active: false };
    drawBuilding(ctx, cs, w, ghost, S, z, 0.45);
  }

  // ---------- units ----------
  for (const e of w.entities) {
    if (e.kind !== 'unit' || e.dead) continue;
    if (e.owner !== me && !w.canSee(me, e)) continue;
    const p = cs.prev.get(e.id);
    const x = p ? p.x + (e.x - p.x) * cs.alpha : e.x, y = p ? p.y + (e.y - p.y) * cs.alpha : e.y;
    const dx = p ? e.x - p.x : 0, dy = p ? e.y - p.y : 0;
    drawUnit(ctx, cs, e, x, y, dx, dy, S, z);
  }

  // ---------- fog ----------
  if (!fogCanvas) { fogCanvas = document.createElement('canvas'); fogCanvas.width = MW; fogCanvas.height = MH; fogCtx = fogCanvas.getContext('2d')!; fogImg = fogCtx.createImageData(MW, MH); }
  const d = fogImg!.data;
  for (let i = 0; i < MW * MH; i++) { d[i * 4] = 1; d[i * 4 + 1] = 3; d[i * 4 + 2] = 8; d[i * 4 + 3] = vis[i] ? 0 : exp[i] ? 150 : 255; }
  fogCtx!.putImageData(fogImg!, 0, 0);
  ctx.imageSmoothingEnabled = true;
  { const [ox, oy] = S(0, 0); ctx.drawImage(fogCanvas, ox, oy, MW * z, MH * z); }

  // ---------- selection outlines (above fog so they stay readable) ----------
  for (const b of selB) {
    const [sx, sy] = S(b.tx!, b.ty!);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.strokeRect(sx + 1, sy + 1, b.w! * z - 2, b.h! * z - 2); ctx.setLineDash([]);
    if (b.rally && b.owner === me) {
      const [rx, ry] = S(b.rally.x, b.rally.y);
      ctx.strokeStyle = '#ffffff66'; ctx.beginPath(); ctx.moveTo(sx + b.w! * z / 2, sy + b.h! * z / 2); ctx.lineTo(rx, ry); ctx.stroke();
      ctx.fillStyle = COLORS[me].main; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx, ry - z * 0.8); ctx.lineTo(rx + z * 0.45, ry - z * 0.6); ctx.lineTo(rx, ry - z * 0.4); ctx.fill();
    }
  }

  // ---------- effects ----------
  for (const f of cs.fx) {
    const k = f.t / f.life; const a = 1 - k;
    const [sx, sy] = S(f.x, f.y);
    ctx.globalAlpha = Math.max(0, a);
    if (f.kind === 'beam' || f.kind === 'siege' || f.kind === 'heal') {
      const [ex, ey] = S(f.x2!, f.y2!);
      ctx.strokeStyle = f.color; ctx.lineWidth = f.kind === 'siege' ? Math.max(2, z * 0.18) : Math.max(1.2, z * 0.07);
      if (f.kind === 'heal') ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke(); ctx.setLineDash([]);
      if (f.kind === 'siege') { ctx.beginPath(); ctx.arc(ex, ey, z * 0.3 + k * z * 0.6, 0, Math.PI * 2); ctx.stroke(); }
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, z * (0.4 + k * 1.2), 0, Math.PI * 2); ctx.stroke();
    } else if (f.kind === 'burst') {
      ctx.strokeStyle = f.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, z * (0.2 + k * 0.9), 0, Math.PI * 2); ctx.stroke();
      for (let s = 0; s < 6; s++) { const an = s * 1.047 + f.x; const r1 = z * (0.2 + k * 1.1); ctx.fillStyle = f.color; ctx.fillRect(sx + Math.cos(an) * r1 - 2, sy + Math.sin(an) * r1 - 2, 4, 4); }
    } else if (f.kind === 'text') {
      ctx.fillStyle = f.color; ctx.font = `600 ${Math.max(10, z * 0.42)}px ui-monospace,monospace`; ctx.textAlign = 'center';
      ctx.fillText(f.text!, sx, sy - k * z * 1.2);
    } else if (f.kind === 'marker') {
      ctx.strokeStyle = f.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, z * (0.7 - k * 0.5), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- placement ghost ----------
  if (cs.placing) drawPlacement(ctx, cs, w, S, z);

  // ---------- drag box ----------
  if (cs.box) {
    const { x0, y0, x1, y1 } = cs.box;
    ctx.strokeStyle = '#9ff3ff'; ctx.lineWidth = 1; ctx.fillStyle = '#3ee6ff18';
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.strokeRect(Math.min(x0, x1) + 0.5, Math.min(y0, y1) + 0.5, Math.abs(x1 - x0), Math.abs(y1 - y0));
  }
  if (cs.mode === 'attackMove' && cs.mouse.inView) {
    ctx.strokeStyle = '#ff4f6d'; ctx.lineWidth = 2;
    const { sx, sy } = cs.mouse; ctx.beginPath(); ctx.arc(sx, sy, 10, 0, Math.PI * 2); ctx.moveTo(sx - 15, sy); ctx.lineTo(sx + 15, sy); ctx.moveTo(sx, sy - 15); ctx.lineTo(sx, sy + 15); ctx.stroke();
  }
}

function glyph(ctx: CanvasRenderingContext2D, type: string, cx: number, cy: number, s: number, color: string, e: Entity, t: number, rf: boolean, w: World) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(1.2, s * 0.08);
  const op = e.built && e.active && (e.kind === 'building') && w.operatorPresent(e);
  switch (type) {
    case 'core': {
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.42); ctx.lineTo(cx + s * 0.42, cy); ctx.lineTo(cx, cy + s * 0.42); ctx.lineTo(cx - s * 0.42, cy); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.26); ctx.lineTo(cx + s * 0.26, cy); ctx.lineTo(cx, cy + s * 0.26); ctx.lineTo(cx - s * 0.26, cy); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, s * (rf ? 0.1 : 0.09 + 0.02 * Math.sin(t * 3)), 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'cache': for (let i = -1; i <= 1; i++) ctx.fillRect(cx - s * 0.28, cy + i * s * 0.18 - s * 0.05, s * 0.56, s * 0.1); break;
    case 'compiler': {
      const rot = op && !rf ? t * 2 : 0;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.stroke();
      for (let k = 0; k < 6; k++) { const a = rot + k * Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26); ctx.lineTo(cx + Math.cos(a) * s * 0.38, cy + Math.sin(a) * s * 0.38); ctx.stroke(); }
      ctx.font = `700 ${s * 0.22}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('{}', cx, cy + 1); ctx.textBaseline = 'alphabetic';
      break;
    }
    case 'rig': {
      const h = op && !rf ? 0.6 + 0.4 * Math.abs(Math.sin(t * 5 + e.id)) : 0.6;
      for (let i = 0; i < 4; i++) { const bh = s * 0.5 * (i % 2 ? h : 1.6 - h); ctx.fillRect(cx - s * 0.3 + i * s * 0.16, cy + s * 0.25 - bh, s * 0.1, bh); }
      ctx.font = `700 ${s * 0.2}px ui-monospace,monospace`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffcf5a'; ctx.fillText('#', cx, cy - s * 0.28);
      break;
    }
    case 'node': {
      ctx.strokeRect(cx - s * 0.2, cy - s * 0.2, s * 0.4, s * 0.4);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s * 0.12, cy - s * 0.2); ctx.lineTo(cx + i * s * 0.12, cy - s * 0.32); ctx.moveTo(cx + i * s * 0.12, cy + s * 0.2); ctx.lineTo(cx + i * s * 0.12, cy + s * 0.32); ctx.moveTo(cx - s * 0.2, cy + i * s * 0.12); ctx.lineTo(cx - s * 0.32, cy + i * s * 0.12); ctx.moveTo(cx + s * 0.2, cy + i * s * 0.12); ctx.lineTo(cx + s * 0.32, cy + i * s * 0.12); ctx.stroke(); }
      break;
    }
    case 'bank': { ctx.strokeRect(cx - s * 0.34, cy - s * 0.14, s * 0.68, s * 0.28); for (let i = 0; i < 4; i++) ctx.fillRect(cx - s * 0.28 + i * s * 0.155, cy - s * 0.08, s * 0.1, s * 0.16); break; }
    case 'grid': {
      const training = e.queue && e.queue.length && e.queue[0].started;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { ctx.globalAlpha = training && !rf ? 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + i + j * 2)) : 1; ctx.fillRect(cx + i * s * 0.22 - s * 0.05, cy + j * s * 0.22 - s * 0.05, s * 0.1, s * 0.1); }
      ctx.globalAlpha = 1; ctx.strokeRect(cx - s * 0.36, cy - s * 0.36, s * 0.72, s * 0.72);
      break;
    }
    case 'tower': { ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, s * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(cx - s * 0.36, cy); ctx.lineTo(cx + s * 0.36, cy); ctx.moveTo(cx, cy - s * 0.36); ctx.lineTo(cx, cy + s * 0.36); ctx.stroke(); break; }
    case 'wall': { ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy - s * 0.12); ctx.lineTo(cx + s * 0.3, cy - s * 0.12); ctx.moveTo(cx - s * 0.3, cy + s * 0.12); ctx.lineTo(cx + s * 0.3, cy + s * 0.12); ctx.stroke(); break; }
    case 'gate': {
      if (e.open) { ctx.beginPath(); ctx.moveTo(cx - s * 0.3, cy); ctx.lineTo(cx - s * 0.1, cy - s * 0.15); ctx.moveTo(cx - s * 0.3, cy); ctx.lineTo(cx - s * 0.1, cy + s * 0.15); ctx.moveTo(cx + s * 0.3, cy); ctx.lineTo(cx + s * 0.1, cy - s * 0.15); ctx.moveTo(cx + s * 0.3, cy); ctx.lineTo(cx + s * 0.1, cy + s * 0.15); ctx.stroke(); }
      else for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx + i * s * 0.16, cy - s * 0.3); ctx.lineTo(cx + i * s * 0.16, cy + s * 0.3); ctx.stroke(); }
      break;
    }
  }
}

function drawBuilding(ctx: CanvasRenderingContext2D, cs: ClientState, w: World, e: Entity, S: (x: number, y: number) => [number, number], z: number, alpha: number) {
  const [sx, sy] = S(e.tx!, e.ty!);
  const W = e.w! * z, H = e.h! * z;
  if (sx > ctx.canvas.width + z || sy > ctx.canvas.height + z * 3 || sx + W < -z || sy + H < -z * 3) return;
  const c = COLORS[e.owner] ?? COLORS[0];
  const bd = B.buildings[e.type];
  const lift = z * (bd.wall ? 0.3 : bd.gate ? 0.34 : e.type === 'core' ? 0.75 : bd.attack ? 0.65 : 0.4);
  const ins = z * (bd.wall || bd.gate ? 0.04 : 0.1);
  const building = !e.built;
  ctx.globalAlpha = alpha * (building ? 0.6 : 1);
  // shadow + body
  ctx.fillStyle = '#00000088'; ctx.fillRect(sx + ins + 3, sy + ins + 3, W - 2 * ins, H - 2 * ins);
  ctx.fillStyle = c.mid; ctx.fillRect(sx + ins, sy + ins, W - 2 * ins, H - 2 * ins);
  const topY = sy + ins - lift;
  ctx.fillStyle = c.dark; ctx.fillRect(sx + ins, topY, W - 2 * ins, H - 2 * ins);
  ctx.strokeStyle = c.main; ctx.lineWidth = Math.max(1.5, z * 0.07);
  if (building) ctx.setLineDash([5, 4]);
  ctx.strokeRect(sx + ins, topY, W - 2 * ins, H - 2 * ins);
  ctx.setLineDash([]);
  // enemy hatch: ownership readable without colour
  if (e.owner !== cs.me && e.owner !== 0) {
    ctx.save(); ctx.beginPath(); ctx.rect(sx + ins, topY, W - 2 * ins, H - 2 * ins); ctx.clip();
    ctx.strokeStyle = c.main + '55'; ctx.lineWidth = 1;
    for (let k = -H; k < W; k += Math.max(6, z * 0.3)) { ctx.beginPath(); ctx.moveTo(sx + k, topY + H); ctx.lineTo(sx + k + H, topY); ctx.stroke(); }
    ctx.restore();
  }
  glyph(ctx, e.type, sx + W / 2, topY + (H - 2 * ins) / 2 + ins * 0, Math.min(W, H), c.main, e, cs.time, cs.settings.reducedFlash, w);
  ctx.globalAlpha = 1;
  if (alpha < 1) return;
  // bars
  const barW = Math.min(W - 4, Math.max(24, W * 0.8));
  if (building) {
    const f = e.progress! / bd.build;
    bar(ctx, sx + (W - barW) / 2, topY - 7, barW, 4, f, '#ffd24a');
  } else if (e.hp < e.maxHp || cs.sel.has(e.id)) {
    bar(ctx, sx + (W - barW) / 2, topY - 7, barW, 4, e.hp / e.maxHp, hpColor(e.hp / e.maxHp));
  }
  // training progress
  if (e.queue && e.queue.length && e.queue[0].started) bar(ctx, sx + (W - barW) / 2, sy + H - 6, barW, 3, e.queue[0].progress / B.units[e.queue[0].unit].time, '#3ee6ff');
  // stall indicator for own buildings
  if (e.owner === cs.me && e.stall && e.stall !== 'operatorWalking') {
    const sev = e.stall === 'paused' ? '#7f95b8' : '#ffd24a';
    ctx.fillStyle = sev; ctx.font = `700 ${Math.max(11, z * 0.45)}px system-ui,sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(e.stall === 'paused' ? '⏸' : '!', sx + W - z * 0.25, topY + z * 0.2);
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, cs: ClientState, e: Entity, x: number, y: number, dx: number, dy: number, S: (x: number, y: number) => [number, number], z: number) {
  const [sx, sy] = S(x, y);
  if (sx < -z || sy < -z || sx > ctx.canvas.width + z || sy > ctx.canvas.height + z) return;
  const ud = B.units[e.type];
  const c = COLORS[e.owner] ?? COLORS[0];
  const r = Math.max(4, ud.radius * z);
  const mine = e.owner === cs.me;
  ctx.save();
  ctx.translate(sx, sy);
  if (e.forkOf) { ctx.globalAlpha = 0.75; }
  const fill = e.suspended ? '#39404d' : c.dark;
  const stroke = e.suspended ? '#8a93a5' : c.main;
  // ownership ring: circle = yours, diamond = enemy
  ctx.strokeStyle = stroke + '99'; ctx.lineWidth = 1.5;
  if (mine) { ctx.beginPath(); ctx.arc(0, 0, r + 3, 0, Math.PI * 2); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(0, -r - 4); ctx.lineTo(r + 4, 0); ctx.lineTo(0, r + 4); ctx.lineTo(-r - 4, 0); ctx.closePath(); ctx.stroke(); }
  if (cs.sel.has(e.id)) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke(); }
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, z * 0.07);
  if (e.forkOf) ctx.setLineDash([3, 3]);
  const ang = Math.abs(dx) + Math.abs(dy) > 1e-4 ? Math.atan2(dy, dx) : -Math.PI / 2;
  ctx.beginPath();
  switch (e.type) {
    case 'runner': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'ping': { for (let k = 0; k < 3; k++) { const a = ang + k * 2.094; const rr = k === 0 ? r * 1.25 : r * 0.9; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); break; }
    case 'bulwark': ctx.rect(-r, -r, 2 * r, 2 * r); break;
    case 'lancer': ctx.moveTo(0, -r * 1.15); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.15); ctx.lineTo(-r, 0); ctx.closePath(); break;
    case 'patcher': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'breaker': for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); break;
  }
  ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
  // inner marks
  ctx.strokeStyle = stroke; ctx.fillStyle = stroke; ctx.lineWidth = Math.max(1.2, z * 0.05);
  if (e.type === 'patcher') { ctx.beginPath(); ctx.moveTo(-r * 0.55, 0); ctx.lineTo(r * 0.55, 0); ctx.moveTo(0, -r * 0.55); ctx.lineTo(0, r * 0.55); ctx.stroke(); }
  if (e.type === 'lancer') { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * r * 1.6, Math.sin(ang) * r * 1.6); ctx.stroke(); }
  if (e.type === 'breaker') { ctx.beginPath(); ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2); ctx.fill(); }
  if (e.type === 'bulwark') { ctx.strokeRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9); }
  if (e.type === 'runner' && (e.carry ?? 0) > 0) { ctx.fillStyle = DATA_C; ctx.fillRect(r * 0.3, -r * 1.3, r * 0.8, r * 0.8); }
  if (e.type === 'runner' && e.order?.type === 'operate' && e.order.phase === 'work') { ctx.fillStyle = '#ffffff'; ctx.fillRect(-1.5, -1.5, 3, 3); }
  if (e.suspended) { ctx.fillStyle = '#cfd6e4'; ctx.font = `700 ${Math.max(9, r)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(e.crashed ? '!z' : 'z', 0, -r - 5); }
  // rank chevrons
  for (let k = 0; k < (e.rank ?? 0); k++) { ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-4, -r - 6 - k * 4); ctx.lineTo(0, -r - 9 - k * 4); ctx.lineTo(4, -r - 6 - k * 4); ctx.stroke(); }
  ctx.restore();
  if (e.hp < e.maxHp || cs.sel.has(e.id)) { const bw = Math.max(16, r * 2.4); bar(ctx, sx - bw / 2, sy + r + 4, bw, 3, e.hp / e.maxHp, hpColor(e.hp / e.maxHp)); }
  if (e.forkOf && e.expires !== undefined) {
    const left = Math.max(0, (e.expires - cs.game.world.tick) / (B.fork.durationSec * B.tickRate));
    ctx.strokeStyle = '#c59bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, r + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke();
  }
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

function drawPlacement(ctx: CanvasRenderingContext2D, cs: ClientState, w: World, S: (x: number, y: number) => [number, number], z: number) {
  const p = cs.placing!;
  const d = B.buildings[p.type];
  const tiles = p.dragStart && d.wall ? wallLine(p.dragStart, { tx: p.tx, ty: p.ty }) : [{ tx: p.tx, ty: p.ty }];
  let dataLeft = w.players[cs.me].data;
  for (const t of tiles) {
    let r = canPlace(w, cs.me, p.type, t.tx, t.ty);
    if (r.ok && (d.cost.data ?? 0) > dataLeft) r = { ok: false, reason: 'Not enough Data for the whole line' };
    if (r.ok) dataLeft -= d.cost.data ?? 0;
    const [sx, sy] = S(t.tx, t.ty);
    ctx.fillStyle = r.ok ? '#6dffa833' : '#ff4f6d44'; ctx.strokeStyle = r.ok ? '#6dffa8' : '#ff4f6d'; ctx.lineWidth = 2;
    ctx.fillRect(sx, sy, d.w * z, d.h * z); ctx.strokeRect(sx + 1, sy + 1, d.w * z - 2, d.h * z - 2);
    if (d.attack) { ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.arc(sx + d.w * z / 2, sy + d.h * z / 2, d.attack.range * z, 0, Math.PI * 2); ctx.stroke(); }
  }
  const first = canPlace(w, cs.me, p.type, p.tx, p.ty);
  p.ok = first.ok; p.reason = first.reason;
  const [sx, sy] = S(p.tx, p.ty);
  ctx.font = '600 13px system-ui,sans-serif'; ctx.textAlign = 'left';
  const label = `${d.name}${d.wall ? ' — drag for a line' : ''}${first.ok ? '' : ' · ' + first.reason}`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = '#000000cc'; ctx.fillRect(sx, sy - 22, tw + 10, 18);
  ctx.fillStyle = first.ok ? '#d8ffe8' : '#ffc3cd'; ctx.fillText(label, sx + 5, sy - 8);
}

// ---------------- minimap ----------------
export function renderMinimap(mctx: CanvasRenderingContext2D, cs: ClientState, viewW: number, viewH: number) {
  const w = cs.game.world; const MW = w.map.w, MH = w.map.h;
  const Wm = mctx.canvas.width, Hm = mctx.canvas.height; const kx = Wm / MW, ky = Hm / MH;
  if (!miniBase) {
    miniBase = document.createElement('canvas'); miniBase.width = MW; miniBase.height = MH;
    const c = miniBase.getContext('2d')!; const img = c.createImageData(MW, MH);
    for (let i = 0; i < MW * MH; i++) { const v = w.nav.terrain[i]; img.data[i * 4] = v ? 0 : 10; img.data[i * 4 + 1] = v ? 0 : 22; img.data[i * 4 + 2] = v ? 0 : 44; img.data[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
  }
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(miniBase, 0, 0, Wm, Hm);
  mctx.imageSmoothingEnabled = true;
  if (fogCanvas) mctx.drawImage(fogCanvas, 0, 0, Wm, Hm);
  const me = cs.me; const exp = w.players[me].explored;
  for (const e of w.entities) {
    if (e.dead) continue;
    if (e.kind === 'well') { if (!exp[Math.floor(e.y) * MW + Math.floor(e.x)]) continue; mctx.fillStyle = e.type === 'fragment' ? FRAG_C : DATA_C; mctx.fillRect(e.x * kx - 1.5, e.y * ky - 1.5, 3, 3); continue; }
    if (e.owner !== me && !w.canSee(me, e)) continue;
    mctx.fillStyle = (COLORS[e.owner] ?? COLORS[0]).main;
    if (e.kind === 'building') mctx.fillRect(e.tx! * kx, e.ty! * ky, Math.max(2, e.w! * kx), Math.max(2, e.h! * ky));
    else mctx.fillRect(e.x * kx - 1.5, e.y * ky - 1.5, 3, 3);
  }
  for (const ls of Object.values(w.players[me].lastSeen)) { mctx.strokeStyle = (COLORS[ls.owner] ?? COLORS[0]).main; mctx.strokeRect(ls.tx * kx, ls.ty * ky, ls.w * kx, ls.h * ky); }
  mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1;
  mctx.strokeRect(cs.cam.x * kx, cs.cam.y * ky, viewW / cs.cam.z * kx, viewH / cs.cam.z * ky);
}
