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

test('structure loop rules: operated, training and ambient structures — checked on live buildings', () => {
  const base = { built: true, active: true };
  assert.equal(buildingClip({ type: 'compiler', ...base, built: false }, true), null, 'under construction');
  assert.equal(buildingClip({ type: 'compiler', ...base, active: false }, true), null, 'switched off');
  assert.equal(buildingClip({ type: 'rig', ...base, stall: 'paused' }, true), null, 'paused');
  assert.equal(buildingClip({ type: 'rig', ...base }, false), null, 'no operator');
  assert.equal(buildingClip({ type: 'rig', ...base }, true), 'working');
  assert.equal(buildingClip({ type: 'core', ...base }, false), 'working', 'the Core always hums');
  assert.equal(buildingClip({ type: 'node', ...base }, false), 'working');
  assert.equal(buildingClip({ type: 'grid', ...base, queue: [] }, false), null, 'idle grid');
  assert.equal(buildingClip({ type: 'tower', ...base }, false), null, 'no loop yet');
  const g = humanGame(5); const w = g.world;
  const c = instantBuilding(w, 'compiler', 1, 12, 49);
  assert.equal(buildingClip(c, w.operatorPresent(c)), null, 'unstaffed');
  cmd(g, { t: 'operate', ids: [units(w, 1, 'runner')[0].id], target: c.id }); secs(g, 6);
  assert.equal(buildingClip(c, w.operatorPresent(c)), 'working');
  const grid = instantBuilding(w, 'grid', 1, 12, 44);
  assert.equal(buildingClip(grid, w.operatorPresent(grid)), null);
  w.players[1].data = 500; w.players[1].code = 500;
  assert.ok(cmd(g, { t: 'train', building: grid.id, unit: 'ping' }).ok); secs(g, 4);
  assert.ok(grid.queue!.some(q => q.started), 'training started (a Runner walked in)');
  assert.equal(buildingClip(grid, w.operatorPresent(grid)), 'working', 'training grid animates');
});

test('shipped sheets are consistent with their atlas', () => {
  const types = ['compiler', 'rig', 'core', 'node', 'grid'];
  for (const t of types) {
    const s = JSON.parse(readFileSync(`assets/anim/${t}-working.json`, 'utf8')) as AnimSheet;
    const buf = readFileSync(`assets/anim/${t}-working.webp`);
    // VP8X canvas size (webp extended header): 24-bit little-endian width-1 / height-1 at bytes 24..29
    const W = 1 + buf.readUIntLE(24, 3), H = 1 + buf.readUIntLE(27, 3);
    const [x, y, cw, ch] = cellRect(s, s.frames - 1);
    assert.ok(x + cw <= W && y + ch <= H, `${t}: last cell ${x},${y} fits ${W}x${H}`);
    assert.equal(Math.ceil(s.frames / s.cols) * ch, H, t);
    assert.ok(s.loop && s.fps > 0 && s.type === t && s.clip === 'working', t);
    // the loop is drawn in the still's rectangle, so the aspect ratios must agree (within 2%)
    const still = JSON.parse(readFileSync('assets/art/sprites/sprites.json', 'utf8'))[t];
    assert.ok(Math.abs(cw / ch - still.w / still.h) / (still.w / still.h) < 0.02, `${t} aspect ${cw}/${ch} vs ${still.w}/${still.h}`);
  }
});

test('Runner clips: six sheets, five rendered facings each, shared pivot and standing height', () => {
  const clips = { idle: true, walk: true, harvest: true, build: true, attack: false, death: false };
  for (const [clip, loop] of Object.entries(clips)) {
    const s = JSON.parse(readFileSync(`assets/anim/runner-${clip}.json`, 'utf8')) as AnimSheet;
    const buf = readFileSync(`assets/anim/runner-${clip}.webp`);
    const W = 1 + buf.readUIntLE(24, 3), H = 1 + buf.readUIntLE(27, 3);
    assert.deepEqual(s.facings, ['s', 'se', 'e', 'ne', 'n'], clip);
    assert.equal(s.loop, loop, clip);
    assert.deepEqual(s.pivot, [64, 112]); assert.equal(s.standH, 64);
    const [x, y, cw, ch] = cellRect(s, s.frames - 1, 'n');
    assert.ok(x + cw <= W && y + ch <= H, `${clip}: last cell of the last facing fits the atlas`);
    if (clip === 'attack') assert.equal(s.fire, 4, 'attack fire frame');
  }
});
