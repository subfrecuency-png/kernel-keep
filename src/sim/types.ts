// Core simulation types. Everything here is plain data so it can be saved as JSON.
import balanceJson from '../data/balance.json' with { type: 'json' };

export interface Cost { data?: number; code?: number; hash?: number }

export interface AttackDef {
  dmg: number; cd: number; range: number; minRange?: number;
  vsUnits?: number; vsHardened?: number; siege?: boolean;
}
export interface UnitDef {
  name: string; role: string; cost: Cost; time: number; trainedAt: string; needsRunner: boolean;
  upkeep: number; mem: number; hp: number; armor: number; speed: number; sight: number; radius: number;
  attack?: AttackDef; heal?: { amt: number; cd: number; range: number }; autoAttack: boolean;
}
export interface BuildingDef {
  name: string; desc: string; w: number; h: number; cost: Cost; build: number; hp: number;
  hardened?: boolean; sight: number;
  provides?: { compute?: number; memory?: number; dataCap?: number; codeCap?: number };
  dropoff?: boolean; trains?: string[]; buildable?: boolean; operator?: boolean;
  cycle?: { time: number; in: Cost; out: Cost };
  compute?: number; computeWhileTraining?: boolean; mining?: boolean;
  wall?: boolean; gate?: boolean; attack?: AttackDef; hotkey?: string;
}
export interface Balance {
  version: number; tickRate: number; map: { w: number; h: number };
  start: { data: number; code: number; hash: number; runners: number };
  economy: {
    upkeepCycleSec: number; coreCodeTrickle: number; hashCap: number;
    rations: Record<Ration, { mult: number; stability: number; label: string }>;
    stabilityBase: number; stabilityStart: number; starvationPenalty: number; stabilityRatePerSec: number;
    crashThreshold: number; crashIntervalSec: number; workSpeedMin: number; workSpeedMax: number;
    lowCodeWarnSec: number; miningBaseRate: number; miningFalloff: number; carry: number; harvestTimeSec: number;
    repairHpPerSec: number; repairHpPerData: number; salvageFraction: number; demolishRefund: number; maxQueue: number;
  };
  fork: { cost: Cost; cooldownSec: number; durationSec: number; maxUnits: number; hpFraction: number; computeSurge: number };
  veterancy: { killsPerRank: number[]; bonusPerRank: number };
  units: Record<string, UnitDef>;
  buildings: Record<string, BuildingDef>;
  ai: Record<string, { firstAttackSec: number; firstWave: number; waveGrowth: number; waveIntervalSec: number }>;
}

export const B = balanceJson as unknown as Balance;
export const TICK_HZ = B.tickRate;
export const DT = 1 / TICK_HZ;

export type Ration = 'lean' | 'standard' | 'surplus';
export type OrderType = 'idle' | 'move' | 'attackMove' | 'attack' | 'harvest' | 'build' | 'repair' | 'operate' | 'hold';

export interface Order {
  type: OrderType;
  x?: number; y?: number;      // destination (tiles, float)
  target?: number;             // entity id
  phase?: 'toWell' | 'gather' | 'toDrop' | 'go' | 'work';
  timer?: number;
}

export interface QueueItem { unit: string; progress: number; started: boolean; paid: Cost; consumedRunner: boolean; blocked?: boolean }

export type Kind = 'unit' | 'building' | 'well';

export interface Entity {
  id: number; kind: Kind; type: string; owner: number;
  x: number; y: number;           // center in tile units
  hp: number; maxHp: number;
  dead?: boolean;
  // ---- unit ----
  order?: Order;
  path?: number[]; pathI?: number; pathPartial?: boolean; pathBreach?: boolean; pathGoal?: number[]; // goal rect x0,y0,x1,y1
  repathT?: number; stuckT?: number; navVer?: number; stuckN?: number; lastX?: number; lastY?: number;
  cd?: number; carry?: number; kills?: number; rank?: number;
  engaged?: number;                // current combat target id
  suspended?: boolean; crashed?: boolean;
  forkOf?: number; expires?: number;
  repairAcc?: number;
  // ---- building ----
  tx?: number; ty?: number; w?: number; h?: number;
  built?: boolean; progress?: number;
  operator?: number; active?: boolean; open?: boolean;
  queue?: QueueItem[]; rally?: { x: number; y: number };
  timer?: number; stall?: string;
  // ---- well ----
  amount?: number; initial?: number;
}

export interface Alert { tick: number; kind: string; text: string; x?: number; y?: number; severity: 'info' | 'warn' | 'danger' }

export interface PlayerStats {
  dataHarvested: number; codeProduced: number; codeConsumed: number; hashMined: number;
  unitsTrained: number; unitsLost: number; buildingsLost: number; kills: number; crashes: number;
}

export interface Player {
  id: number; name: string; ai: boolean;
  data: number; code: number; hash: number;
  ration: Ration; stability: number; unmet: number; crashT: number;
  forkReadyTick: number; surgeUntil: number;
  defeated: boolean;
  stats: PlayerStats;
  alerts: Alert[];
  explored: Uint8Array;             // saved as string
  lastSeen: Record<number, { type: string; tx: number; ty: number; w: number; h: number; owner: number }>;
}

export type SimEvent =
  | { t: 'shot'; from: number; to: number; x1: number; y1: number; x2: number; y2: number; owner: number; siege?: boolean; heal?: boolean }
  | { t: 'death'; id: number; x: number; y: number; owner: number; kind: Kind; type: string }
  | { t: 'built'; id: number; owner: number; type: string }
  | { t: 'spawn'; id: number; owner: number; type: string }
  | { t: 'deposit'; id: number; owner: number; x: number; y: number }
  | { t: 'produce'; id: number; owner: number; res: 'code' | 'hash' }
  | { t: 'alert'; owner: number; alert: Alert };

export interface CommandBase { player: number }
export type Command = CommandBase & (
  | { t: 'move'; ids: number[]; x: number; y: number }
  | { t: 'attackMove'; ids: number[]; x: number; y: number }
  | { t: 'attack'; ids: number[]; target: number }
  | { t: 'stop'; ids: number[] }
  | { t: 'hold'; ids: number[] }
  | { t: 'harvest'; ids: number[]; target: number }
  | { t: 'place'; building: string; tx: number; ty: number; ids: number[] }
  | { t: 'assist'; ids: number[]; target: number }
  | { t: 'repair'; ids: number[]; target: number }
  | { t: 'operate'; ids: number[]; target: number }
  | { t: 'train'; building: number; unit: string }
  | { t: 'cancelTrain'; building: number; index: number }
  | { t: 'cancelBuild'; building: number }
  | { t: 'demolish'; building: number }
  | { t: 'toggleActive'; building: number }
  | { t: 'gate'; building: number; open: boolean }
  | { t: 'rally'; building: number; x: number; y: number }
  | { t: 'ration'; level: Ration }
  | { t: 'suspend'; ids: number[]; on: boolean }
  | { t: 'decompile'; ids: number[] }
  | { t: 'fork'; ids: number[] }
);

export interface CommandResult { ok: boolean; reason?: string }
