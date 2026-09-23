export type Preferences={schema:1;scale:number;reducedMotion:boolean;shapes:boolean;pauseKey:string};
export const DEFAULTS:Preferences={schema:1,scale:100,reducedMotion:false,shapes:true,pauseKey:'Space'};
export function parsePreferences(input:unknown):Preferences {
  if(typeof input!=='object'||input===null) return {...DEFAULTS};
  const p=input as Record<string,unknown>;
  if(p.schema!==1)return {...DEFAULTS};
  return {schema:1,scale:typeof p.scale==='number'&&Number.isFinite(p.scale)?Math.min(125,Math.max(90,Math.round(p.scale))):100,
    reducedMotion:typeof p.reducedMotion==='boolean'?p.reducedMotion:false,
    shapes:typeof p.shapes==='boolean'?p.shapes:true,
    pauseKey:typeof p.pauseKey==='string'&&['Space','KeyP'].includes(p.pauseKey)?p.pauseKey:'Space'};
}
export function loadPreferences():Preferences{try{return parsePreferences(JSON.parse(localStorage.getItem('kernel-keep-ui-lab-prefs-v1')||'null'));}catch{return {...DEFAULTS};}}
export function savePreferences(p:Preferences):boolean{try{localStorage.setItem('kernel-keep-ui-lab-prefs-v1',JSON.stringify(p));return true;}catch{return false;}}
