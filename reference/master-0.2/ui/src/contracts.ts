/** Proposed presentation contract, NOT an API discovered in prototype 0.1. */
export type Scenario = 'stable' | 'code-low' | 'brownout' | 'suspended';
export type Role = 'Runner' | 'Ping' | 'Bulwark' | 'Lancer' | 'Patcher' | 'Breaker';
export type Structure = 'Core' | 'Data Cache' | 'Compiler' | 'Mining Rig' | 'Compute Node' | 'Memory Bank' | 'Training Grid' | 'Firewall' | 'Access Gate' | 'Sentry Tower';
export type Resource = Readonly<{ id: string; name: string; amount: number; rate?: number; capacity?: number; glyph: string; color: string }>;
export type HudSnapshot = Readonly<{
  revision: number; mode: 'fixture'; scenario: Scenario; selected: Role;
  resources: readonly Resource[]; stability: number; suspended: number;
  gateOpen: boolean; scenePaused: boolean; intents: readonly string[];
}>;
export type PresentationIntent =
  | { type: 'select'; role: Role }
  | { type: 'scenario'; scenario: Scenario }
  | { type: 'pause-scene' }
  | { type: 'preview-order'; order: string }
  | { type: 'preview-gate' };
export interface PresentationBridge {
  getSnapshot(): HudSnapshot;
  subscribe(listener: () => void): () => void;
  dispatch(intent: PresentationIntent): void;
}
// When integrating: add engine-owned command IDs, validated results, tick IDs,
// visibility-filtered entities, queue IDs and renderer lifecycle to an adapter.
// Never import this fixture's resource values as actual balance definitions.
