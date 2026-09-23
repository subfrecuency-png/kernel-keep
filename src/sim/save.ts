// Versioned save format. Saves authoritative state only; nav, spatial cells are rebuilt on load.
import { Entity, Player } from './types.ts';
import { World } from './world.ts';
import { Game, LoggedCommand } from './game.ts';
import { AIController, AIState } from './ai.ts';
import { B } from './types.ts';

export const SAVE_SCHEMA = 1;

export interface SaveFile {
  schema: number; balanceVersion: number; savedAt: string;
  seed: number; difficulty: 'easy' | 'normal'; tick: number; navVersion: number; rngState: number; nextId: number; winner: number;
  players: (Omit<Player, 'explored'> & { explored: string })[];
  visible: string[];
  entities: Entity[];
  ai: AIState[];
  log: LoggedCommand[];
}

function pack(a: Uint8Array): string { let s = ''; for (let i = 0; i < a.length; i++) s += a[i] ? '1' : '0'; return rle(s); }
function unpack(s: string, n: number): Uint8Array { const bits = unrle(s); const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = bits.charCodeAt(i) === 49 ? 1 : 0; return a; }
function rle(s: string): string { let out = ''; let i = 0; while (i < s.length) { let j = i; while (j < s.length && s[j] === s[i]) j++; out += s[i] + (j - i) + ','; i = j; } return out; }
function unrle(s: string): string { let out = ''; for (const part of s.split(',')) if (part) out += part[0].repeat(Number(part.slice(1))); return out; }

export function saveGame(g: Game): SaveFile {
  const w = g.world;
  return JSON.parse(JSON.stringify({
    schema: SAVE_SCHEMA, balanceVersion: B.version, savedAt: new Date().toISOString(),
    seed: w.seed, difficulty: w.difficulty, tick: w.tick, navVersion: w.nav.version, rngState: w.rng.state, nextId: w.nextId, winner: w.winner,
    players: w.players.map(p => ({ ...p, explored: pack(p.explored) })),
    visible: w.visible.map(pack),
    entities: w.entities.filter(e => !e.dead),
    ai: g.ais.map(a => a.s),
    log: g.log,
  }));
}

export function loadGame(s: SaveFile): Game {
  if (!s || typeof s !== 'object') throw new Error('Not a save file.');
  if (s.schema !== SAVE_SCHEMA) throw new Error(`Unsupported save schema ${s.schema} (this build reads ${SAVE_SCHEMA}).`);
  const players = s.players.map(p => ({ name: p.name, ai: p.ai })).slice(1);
  const w = new World({ seed: s.seed, players, difficulty: s.difficulty }, true);
  const n = w.map.w * w.map.h;
  w.tick = s.tick; w.rng.state = s.rngState >>> 0; w.nextId = s.nextId; w.winner = s.winner;
  w.players = s.players.map(p => ({ ...p, explored: unpack(p.explored, n) })) as Player[];
  w.visible = s.visible.map(v => unpack(v, n));
  for (const e of s.entities) {
    w.add(e);
    if (e.kind === 'building') {
      w.nav.setFootprint(e.tx!, e.ty!, e.w!, e.h!, e.id, e.owner);
      if (e.built && e.open && B.buildings[e.type].gate) w.nav.setGate(e.tx!, e.ty!, e.owner);
    }
  }
  // Units remember the nav version their path was planned at; restore it exactly so loading
  // does not trigger repaths an uninterrupted run would not do.
  w.nav.version = s.navVersion;
  const g = new Game({ seed: s.seed }, w);
  g.ais = s.ai.map(a => new AIController(a.pid, a.difficulty, a));
  g.log = s.log ?? [];
  return g;
}
