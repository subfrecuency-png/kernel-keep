// Animation clip selection (animation pilot). Presentation-only logic, but it decides what the player sees,
// so the rules are pinned here: facings mirror correctly, loops wrap, the attack fire frame lands on the shot,
// and structures animate only when they are really working.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { facing8, frameAt, attackFrame, unitClip, buildingClip, cellRect, AnimSheet } from '../src/client/animlogic.ts';
import { readFileSync } from 'node:fs';
import { humanGame, secs, instantBuilding, units, cmd } from './helpers.ts';

test('eight facings: five are drawn, the three left-hand ones mirror their right-hand twins', () => {
  const S = Math.SQRT1_2;
  const cases: [number, number, string, string, boolean][] = [
    [1, 0, 'e', 'e', false], [S, S, 'se', 'se', false], [0, 1, 's', 's', false], [-S, S, 'sw', 'se', true],
    [-1, 0, 'w', 'e', true], [-S, -S, 'nw', 'ne', true], [0, -1, 'n', 'n', false], [S, -S, 'ne', 'ne', false],
  ];
  for (const [du, dv, dir, draw, mirror] of cases) assert.deepEqual(facing8(du, dv), { dir, draw, mirror }, `${du},${dv}`);
  assert.equal(facing8(0, 0).dir, 's');
  // boundaries go to the nearer sector: 20° below the horizontal is still east
  assert.equal(facing8(Math.cos(0.35), Math.sin(0.35)).dir, 'e');
});

test('loops wrap and one-shots hold their last frame', () => {
  const loop = { frames: 8, fps: 12, loop: true }, once = { frames: 10, fps: 12, loop: false };
  assert.equal(frameAt(loop, 0), 0); assert.equal(frameAt(loop, 7 / 12 + 1e-6), 7); assert.equal(frameAt(loop, 8 / 12 + 1e-6), 0);
  assert.equal(frameAt(loop, 0, 3), 3);
  assert.equal(frameAt(once, 100), 9); assert.equal(frameAt(once, -1), 0);
});

test('attack frames follow the cooldown: fire frame exactly when the shot fires, follow-through after', () => {
  const cd = 1.2;
  assert.equal(attackFrame(0, cd), 4, 'cooldown 0 = the shot tick shows the fire frame');
  assert.equal(attackFrame(cd, cd), 5, 'straight after the shot: follow-through');
  assert.equal(attackFrame(0.8, cd), 0, 'resting between shots');
  let last = 0;
  for (let left = 0.4; left >= 0; left -= 0.01) { const f = attackFrame(left, cd); assert.ok(f >= last && f <= 4); last = f; }
  // very fast weapons still reach the fire frame
  assert.equal(attackFrame(0, 0.3), 4);
});

test('program clip rules', () => {
  assert.equal(unitClip({ dead: true }, true, true), 'death');
  assert.equal(unitClip({ order: { type: 'move' } }, true, false), 'walk');
  assert.equal(unitClip({ order: { type: 'harvest', phase: 'toDrop' }, carry: 5 }, true, false), 'carry');
  assert.equal(unitClip({ order: { type: 'harvest', phase: 'gather' } }, false, false), 'harvest');
  assert.equal(unitClip({ order: { type: 'build', phase: 'work' } }, false, false), 'build');
  assert.equal(unitClip({ order: { type: 'attack' } }, false, true), 'attack');
  assert.equal(unitClip({ order: { type: 'attack' } }, true, true), 'walk', 'chasing is walking');
  assert.equal(unitClip({ order: { type: 'idle' } }, false, false), 'idle');
});

test('structures animate only when built, powered, unpaused and staffed — checked on a live Compiler', () => {
  assert.equal(buildingClip({ built: false, active: true }, true), null);
  assert.equal(buildingClip({ built: true, active: false }, true), null);
  assert.equal(buildingClip({ built: true, active: true, stall: 'paused' }, true), null);
  assert.equal(buildingClip({ built: true, active: true }, false), null);
  const g = humanGame(5); const w = g.world;
  const c = instantBuilding(w, 'compiler', 1, 12, 49);
  assert.equal(buildingClip(c, w.operatorPresent(c)), null, 'unstaffed');
  cmd(g, { t: 'operate', ids: [units(w, 1, 'runner')[0].id], target: c.id }); secs(g, 6);
  assert.equal(buildingClip(c, w.operatorPresent(c)), 'working');
});

test('shipped sheets are consistent with their atlas', () => {
  const s = JSON.parse(readFileSync('assets/anim/compiler-working.json', 'utf8')) as AnimSheet;
  const buf = readFileSync('assets/anim/compiler-working.webp');
  // VP8X canvas size (webp extended header): 24-bit little-endian width-1 / height-1 at bytes 24..29
  const W = 1 + buf.readUIntLE(24, 3), H = 1 + buf.readUIntLE(27, 3);
  const [x, y, cw, ch] = cellRect(s, s.frames - 1);
  assert.ok(x + cw <= W && y + ch <= H, `last cell ${x},${y} fits ${W}x${H}`);
  assert.equal(Math.ceil(s.frames / s.cols) * ch, H);
  assert.ok(s.loop && s.fps > 0);
});
