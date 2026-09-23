import type { Role, Structure } from './contracts';
export const roles: readonly { name: Role; glyph: string; role: string; description: string }[] = [
  {name:'Runner',glyph:'◇',role:'Worker',description:'Carry Data and support construction. Worker/miner duties share this role.'},
  {name:'Ping',glyph:'⌁',role:'Scout',description:'A light silhouette for reconnaissance. Actual speed and vision come from the engine.'},
  {name:'Bulwark',glyph:'⬡',role:'Frontline',description:'A broad shield silhouette for a defensive frontline program.'},
  {name:'Lancer',glyph:'↗',role:'Ranged',description:'A narrow ranged attacker with a long precision weapon.'},
  {name:'Patcher',glyph:'✚',role:'Support',description:'A repair program with bright white panels and an articulated tool.'},
  {name:'Breaker',glyph:'▰',role:'Siege',description:'A wide, low siege platform with an amber heavy weapon.'}
];
export const structures: readonly {name: Structure; glyph:string; description:string}[] = [
  {name:'Core',glyph:'⬡',description:'The central keep and visual anchor of the settlement.'},
  {name:'Data Cache',glyph:'◇',description:'A delivery and storage landmark. Verify exact delivery rules in the prototype.'},
  {name:'Compiler',glyph:'⌘',description:'Produces the Code that sustains programs.'},
  {name:'Mining Rig',glyph:'⛏',description:'Produces fictional match-local Hash.'},
  {name:'Compute Node',glyph:'▦',description:'A distinct infrastructure silhouette for shared Compute capacity.'},
  {name:'Memory Bank',glyph:'▥',description:'A tall stacked silhouette for population capacity.'},
  {name:'Training Grid',glyph:'▤',description:'The army training facility.'},
  {name:'Firewall',glyph:'▰',description:'Solid modular defensive wall, separate from the access gate.'},
  {name:'Access Gate',glyph:'Π',description:'An animated gate with visually distinct open and closed states.'},
  {name:'Sentry Tower',glyph:'⌖',description:'A turret landmark for fortress defense.'}
];
