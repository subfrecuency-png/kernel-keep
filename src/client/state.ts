// Client-side (presentation) state. Nothing here is authoritative; the Game/World is.
import { Game } from '../sim/game.ts';
import { Settings } from './settings.ts';

export interface Fx { kind: 'beam' | 'heal' | 'siege' | 'ring' | 'burst' | 'text' | 'marker'; x: number; y: number; x2?: number; y2?: number; t: number; life: number; color: string; text?: string }

export interface Placement { type: string; tx: number; ty: number; ok: boolean; reason?: string; dragStart?: { tx: number; ty: number } }

export interface ClientState {
  game: Game;
  me: number;
  cam: { x: number; y: number; z: number };
  sel: Set<number>;
  groups: Record<string, number[]>;
  prev: Map<number, { x: number; y: number }>;
  alpha: number;
  placing?: Placement;
  mode?: 'attackMove';
  box?: { x0: number; y0: number; x1: number; y1: number };
  mouse: { sx: number; sy: number; wx: number; wy: number; inView: boolean };
  fx: Fx[];
  settings: Settings;
  paused: boolean;
  speed: number;
  showPerf: boolean;
  fps: number;
  time: number;
  hudDirty: boolean;
  lastAlert?: { x: number; y: number };
  over: boolean;
}

export const COLORS: Record<number, { main: string; dark: string; mid: string; glow: string }> = {
  0: { main: '#9fb3d1', dark: '#1a2233', mid: '#3a4a66', glow: '#9fb3d155' },
  1: { main: '#3ee6ff', dark: '#06303d', mid: '#0f6b82', glow: '#3ee6ff55' },
  2: { main: '#ff7a2f', dark: '#3d1a08', mid: '#8a3a12', glow: '#ff7a2f55' },
};
