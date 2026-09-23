// Player settings: key bindings, UI scale, reduced flashing, audio. Stored per browser; safe if storage is unavailable.
export interface Settings {
  uiScale: number; reducedFlash: boolean; edgeScroll: boolean; volume: number; muted: boolean; showHints: boolean;
  keys: Record<string, string>;
}

export const ACTIONS: { id: string; label: string; def: string }[] = [
  { id: 'attackMove', label: 'Attack-move (then click)', def: 'a' },
  { id: 'stop', label: 'Stop', def: 's' },
  { id: 'hold', label: 'Hold position', def: 'h' },
  { id: 'fork', label: 'Fork (commander power)', def: 'f' },
  { id: 'suspend', label: 'Suspend / Resume', def: 'z' },
  { id: 'toggle', label: 'Building on/off, gate open/close', def: 'o' },
  { id: 'decompile', label: 'Decompile / Demolish / Cancel', def: 'Delete' },
  { id: 'pause', label: 'Pause', def: 'p' },
  { id: 'idleRunner', label: 'Select idle Runner', def: '.' },
  { id: 'centerCore', label: 'Centre on Core', def: 'Home' },
  { id: 'lastAlert', label: 'Jump to last alert', def: ' ' },
  { id: 'camUp', label: 'Camera up', def: 'ArrowUp' },
  { id: 'camDown', label: 'Camera down', def: 'ArrowDown' },
  { id: 'camLeft', label: 'Camera left', def: 'ArrowLeft' },
  { id: 'camRight', label: 'Camera right', def: 'ArrowRight' },
  { id: 'build_compiler', label: 'Build Compiler', def: 'c' },
  { id: 'build_rig', label: 'Build Mining Rig', def: 'm' },
  { id: 'build_node', label: 'Build Compute Node', def: 'n' },
  { id: 'build_bank', label: 'Build Memory Bank', def: 'k' },
  { id: 'build_cache', label: 'Build Data Cache', def: 'd' },
  { id: 'build_grid', label: 'Build Training Grid', def: 't' },
  { id: 'build_tower', label: 'Build Sentry Tower', def: 'r' },
  { id: 'build_wall', label: 'Build Firewall (drag)', def: 'w' },
  { id: 'build_gate', label: 'Build Access Gate', def: 'g' },
  { id: 'train1', label: 'Train slot 1 (Runner / Ping)', def: 'q' },
  { id: 'train2', label: 'Train slot 2 (Bulwark)', def: 'w' },
  { id: 'train3', label: 'Train slot 3 (Lancer)', def: 'e' },
  { id: 'train4', label: 'Train slot 4 (Patcher)', def: 'r' },
  { id: 'train5', label: 'Train slot 5 (Breaker)', def: 't' },
  { id: 'perf', label: 'Performance overlay', def: 'F3' },
];

const KEY = 'kernelkeep.settings.v1';

export function defaultSettings(): Settings {
  const keys: Record<string, string> = {};
  for (const a of ACTIONS) keys[a.id] = a.def;
  return { uiScale: 1, reducedFlash: false, edgeScroll: true, volume: 0.5, muted: false, showHints: true, keys };
}

export function loadSettings(): Settings {
  const d = defaultSettings();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    return { ...d, ...s, keys: { ...d.keys, ...(s.keys ?? {}) } };
  } catch { return d; }
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

export function keyName(k: string) { return k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k; }
