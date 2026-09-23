// Tile navigation grid + A*. Derived state: rebuilt from terrain + buildings, never saved.
// Passability is per player because Access Gates let their owner through when open.

export interface PathResult { tiles: number[]; partial: boolean; breach: boolean }

export class Nav {
  w: number; h: number;
  terrain: Uint8Array;
  block: Int32Array;      // building id occupying the tile (0 = none)
  blockOwner: Int8Array;  // owner of that building
  gate: Int8Array;        // owner id if an open, built gate occupies the tile
  version = 0;
  /** Node expansions spent this tick (per-tick pathfinding budget, reset by the game loop). */
  spent = 0;
  // A* scratch
  private g: Float64Array; private came: Int32Array; private stamp: Int32Array; private closed: Int32Array; private gen = 0;
  private heapI: Int32Array; private heapF: Float64Array; private heapN = 0;

  constructor(w: number, h: number, terrain: Uint8Array) {
    this.w = w; this.h = h; this.terrain = terrain;
    const n = w * h;
    this.block = new Int32Array(n); this.blockOwner = new Int8Array(n); this.gate = new Int8Array(n);
    this.g = new Float64Array(n); this.came = new Int32Array(n); this.stamp = new Int32Array(n); this.closed = new Int32Array(n);
    this.heapI = new Int32Array(n * 8 + 16); this.heapF = new Float64Array(n * 8 + 16);
  }

  inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  idx(x: number, y: number) { return y * this.w + x; }

  passable(i: number, player: number): boolean {
    if (this.terrain[i] !== 0) return false;
    if (this.block[i] === 0) return true;
    return this.gate[i] === player && player !== 0;
  }
  passableXY(x: number, y: number, player: number) { return this.inBounds(x, y) && this.passable(this.idx(x, y), player); }

  setFootprint(tx: number, ty: number, w: number, h: number, id: number, owner: number) {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) {
      const i = this.idx(x, y); this.block[i] = id; this.blockOwner[i] = id ? owner : 0; if (!id) this.gate[i] = 0;
    }
    this.version++;
  }
  setGate(tx: number, ty: number, owner: number) { this.gate[this.idx(tx, ty)] = owner; this.version++; }

  // ---- A* over 8-connected tiles, no corner cutting. ----
  private push(i: number, f: number) {
    let n = this.heapN++; this.heapI[n] = i; this.heapF[n] = f;
    while (n > 0) { const p = (n - 1) >> 1; if (this.heapF[p] <= this.heapF[n]) break; this.swap(n, p); n = p; }
  }
  private pop(): number {
    const top = this.heapI[0]; this.heapN--;
    if (this.heapN > 0) {
      this.heapI[0] = this.heapI[this.heapN]; this.heapF[0] = this.heapF[this.heapN];
      let n = 0;
      for (;;) {
        const l = 2 * n + 1, r = l + 1; let m = n;
        if (l < this.heapN && this.heapF[l] < this.heapF[m]) m = l;
        if (r < this.heapN && this.heapF[r] < this.heapF[m]) m = r;
        if (m === n) break; this.swap(n, m); n = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number) {
    const ti = this.heapI[a]; this.heapI[a] = this.heapI[b]; this.heapI[b] = ti;
    const tf = this.heapF[a]; this.heapF[a] = this.heapF[b]; this.heapF[b] = tf;
  }

  /**
   * Find a path from tile (sx,sy) to any passable tile inside goal rect [x0..x1]x[y0..y1].
   * If unreachable, returns a path to the reachable tile closest to the goal (partial=true).
   * breach=true lets the search cross enemy structures at extra cost (siege routing).
   */
  findPath(sx: number, sy: number, goal: number[], player: number, breach = false): PathResult {
    const [x0, y0, x1, y1] = goal;
    const w = this.w;
    const gen = ++this.gen;
    this.heapN = 0;
    const start = this.idx(sx, sy);
    const sgn = player === 2 ? -1 : 1;
    const hfn = (x: number, y: number) => {
      const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
      const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
      return Math.max(dx, dy) + 0.41421356 * Math.min(dx, dy);
    };
    const inGoal = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    this.g[start] = 0; this.stamp[start] = gen; this.came[start] = -1;
    this.push(start, 1.15 * hfn(sx, sy));
    let best = start, bestH = hfn(sx, sy), bestG = 0;
    let found = -1;
    let usedBreach = false;
    const cost = (i: number): number => {
      if (this.terrain[i] !== 0) return -1;
      if (this.block[i] === 0 || this.gate[i] === player) return 0;
      if (breach && this.blockOwner[i] !== player && this.blockOwner[i] !== 0) return 6; // chew through
      return -1;
    };
    while (this.heapN > 0) {
      const cur = this.pop();
      if (this.closed[cur] === gen) continue;
      this.closed[cur] = gen;
      this.spent++;
      const cx = cur % w, cy = (cur - cx) / w;
      if (inGoal(cx, cy) && (cur === start || cost(cur) === 0)) { found = cur; break; }
      const hc = hfn(cx, cy);
      if (hc < bestH || (hc === bestH && this.g[cur] < bestG)) { bestH = hc; best = cur; bestG = this.g[cur]; }
      for (let d = 0; d < 8; d++) {
        // Player 2 expands neighbours in the point-mirrored order so equal-cost ties resolve symmetrically.
        const dx = DX[d] * sgn, dy = DY[d] * sgn;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= this.h) continue;
        const ni = ny * w + nx;
        const c = cost(ni);
        if (c < 0) continue;
        if (dx !== 0 && dy !== 0) { // no corner cutting
          if (cost(cy * w + nx) !== 0 || cost(ny * w + cx) !== 0) continue;
        }
        const ng = this.g[cur] + (dx !== 0 && dy !== 0 ? 1.41421356 : 1) + c;
        if (this.stamp[ni] !== gen || ng < this.g[ni]) {
          this.stamp[ni] = gen; this.g[ni] = ng; this.came[ni] = cur;
          this.push(ni, ng + 1.15 * hfn(nx, ny)); // mildly weighted A*: fewer expansions, near-optimal paths
        }
      }
    }
    const end = found >= 0 ? found : best;
    const tiles: number[] = [];
    for (let i = end; i !== -1 && i !== start; i = this.came[i]) {
      tiles.push(i);
      if (this.block[i] !== 0 && this.gate[i] !== player) usedBreach = true;
    }
    tiles.reverse();
    return { tiles, partial: found < 0, breach: usedBreach };
  }

  /** Nearest passable tile to (x,y) by ring search, or -1. */
  nearestPassable(x: number, y: number, player: number, maxR = 8): number {
    const cx = Math.floor(x), cy = Math.floor(y);
    if (this.passableXY(cx, cy, player)) return this.idx(cx, cy);
    for (let r = 1; r <= maxR; r++) {
      let bestI = -1, bestD = 1e9;
      const sgn = player === 2 ? -1 : 1; // mirrored scan order for player 2 (symmetric tie-breaks)
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const xx = cx + i * sgn, yy = cy + j * sgn;
        if (Math.max(Math.abs(xx - cx), Math.abs(yy - cy)) !== r) continue;
        if (!this.passableXY(xx, yy, player)) continue;
        const ddx = xx + 0.5 - x, ddy = yy + 0.5 - y; const d = ddx * ddx + ddy * ddy;
        if (d < bestD - 1e-9) { bestD = d; bestI = this.idx(xx, yy); } // epsilon: float noise must not break mirrored ties
      }
      if (bestI >= 0) return bestI;
    }
    return -1;
  }
}

const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];
