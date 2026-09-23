import type { HudSnapshot, PresentationBridge, PresentationIntent, Resource, Scenario } from './contracts';
const data: Record<Scenario,{code:number;rate:number;compute:number;stability:number;suspended:number}> = {
  stable:{code:480,rate:6,compute:72,stability:94,suspended:0},
  'code-low':{code:80,rate:-4,compute:72,stability:54,suspended:0},
  brownout:{code:180,rate:-2,compute:112,stability:62,suspended:0},
  suspended:{code:0,rate:0,compute:68,stability:18,suspended:6}
};
function resources(scenario: Scenario): readonly Resource[] {
  const s=data[scenario];return [
    {id:'data',name:'Data',amount:1240,rate:12,glyph:'◇',color:'cyan'},
    {id:'code',name:'Code',amount:s.code,rate:s.rate,glyph:'⌘',color:'amber'},
    {id:'hash',name:'Hash',amount:360,rate:3,glyph:'⬡',color:'mint'},
    {id:'compute',name:'Compute',amount:s.compute,capacity:100,glyph:'▦',color:'cyan'},
    {id:'memory',name:'Memory',amount:48,capacity:64,glyph:'▥',color:'violet'}
  ];
}
const freeze = (s:HudSnapshot):HudSnapshot => Object.freeze({...s,resources:Object.freeze(s.resources.map(r=>Object.freeze({...r}))),intents:Object.freeze([...s.intents])});
export function createFixtureBridge():PresentationBridge {
  let state=freeze({revision:0,mode:'fixture',scenario:'stable',selected:'Bulwark',resources:resources('stable'),stability:94,suspended:0,gateOpen:true,scenePaused:false,intents:[]});
  const listeners = new Set<()=>void>();
  return {
    getSnapshot:()=>state,
    subscribe:(listener)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
    dispatch:(intent:PresentationIntent)=>{
      let patch:Partial<HudSnapshot>={};
      switch(intent.type){
        case 'select':patch={selected:intent.role};break;
        case 'scenario':patch={scenario:intent.scenario,resources:resources(intent.scenario),stability:data[intent.scenario].stability,suspended:data[intent.scenario].suspended};break;
        case 'pause-scene':patch={scenePaused:!state.scenePaused};break;
        case 'preview-gate':patch={gateOpen:!state.gateOpen};break;
        case 'preview-order':patch={intents:[`Preview: ${intent.order} · no game command sent`,...state.intents].slice(0,5)};break;
      }
      state=freeze({...state,...patch,revision:state.revision+1});
      listeners.forEach(listener=>listener());
    }
  };
}
export function shortageSeconds(stock:number,netRate:number):number|null {
  return Number.isFinite(stock)&&Number.isFinite(netRate)&&stock>=0&&netRate<0?Math.ceil(stock/-netRate):null;
}
