import {useEffect,useRef,useState,useSyncExternalStore,type CSSProperties} from 'react';
import {createFixtureBridge,shortageSeconds} from './fixture';
import {roles,structures} from './catalog';
import {loadPreferences,savePreferences,type Preferences} from './preferences';
import type {Scenario} from './contracts';
import {World} from './World';
const bridge=createFixtureBridge();
const scenarios:{id:Scenario;name:string}[]=[{id:'stable',name:'Stable'},{id:'code-low',name:'Code shortage'},{id:'brownout',name:'Brownout'},{id:'suspended',name:'Suspended'}];
const asset=(name:string)=>`assets/${name}.png`;
function MiniMap(){return <svg className="minimap" viewBox="0 0 200 122" role="img" aria-label="Sample minimap, friendly squares, hostile triangles, illustrated fog">
 <rect width="200" height="122" fill="#061019"/><path d="M8 26L70 6 190 33 190 101 127 119 8 82Z" fill="#143344"/>
 <path d="M108 0L92 55 117 125" fill="none" stroke="#060e18" strokeWidth="18"/><path d="M70 69L137 51" stroke="#55757f" strokeWidth="5"/>
 {[ [42,40],[62,54],[32,63],[77,81],[51,87] ].map(([x,y],i)=><rect key={i} x={x} y={y} width="6" height="6" fill="#53d9ec"/>)}
 {[ [153,42],[165,58],[139,67] ].map(([x,y],i)=><path key={i} d={`M${x} ${y-4}l5 9h-10z`} fill="#f17c90"/>)}
 <path d="M125 0H200V37L173 56 138 23Z" fill="#04090ee6"/><rect x="24" y="34" width="79" height="57" fill="none" stroke="#e7fcff"/>
 </svg>;}
function Mark(){return <span className="brand-mark" aria-hidden="true">⌘</span>;}
export default function App(){
 const state=useSyncExternalStore(bridge.subscribe,bridge.getSnapshot);
 const [view,setView]=useState<'menu'|'hud'|'art'>('menu');
 const [tab,setTab]=useState<'Programs'|'Structures'|'Economy'>('Programs');
 const [prefs,setPrefs]=useState<Preferences>(loadPreferences);
 const [settings,setSettings]=useState(false);const dialog=useRef<HTMLDialogElement>(null);
 const [notice,setNotice]=useState('');const [structure,setStructure]=useState('Compiler');
 const [systemReduced,setSystemReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const [installPrompt,setInstallPrompt]=useState<(Event&{prompt:()=>Promise<void>})|null>(null);
 const reduced=prefs.reducedMotion||systemReduced;
 const selected=roles.find(r=>r.name===state.selected)!;
 const intent=(order:string)=>bridge.dispatch({type:'preview-order',order});
 useEffect(()=>{if(!savePreferences(prefs))setNotice('Preferences work for this session; browser storage is unavailable.');},[prefs]);
 useEffect(()=>{const mq=matchMedia('(prefers-reduced-motion: reduce)');const change=()=>setSystemReduced(mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
 useEffect(()=>{const receive=(event:Event)=>{event.preventDefault();setInstallPrompt(event as Event&{prompt:()=>Promise<void>});};window.addEventListener('beforeinstallprompt',receive);return()=>window.removeEventListener('beforeinstallprompt',receive);},[]);
 useEffect(()=>{if(settings)dialog.current?.showModal();else dialog.current?.close();},[settings]);
 useEffect(()=>{function key(e:KeyboardEvent){const t=e.target as HTMLElement;if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||settings||['INPUT','SELECT','TEXTAREA','BUTTON'].includes(t.tagName)||t.isContentEditable)return;if(e.code===prefs.pauseKey&&view==='hud'){e.preventDefault();bridge.dispatch({type:'pause-scene'});}}
 window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[settings,prefs.pauseKey,view]);
 const update=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setPrefs(p=>({...p,[key]:value}));
 const code=state.resources.find(r=>r.id==='code')!;const seconds=shortageSeconds(code.amount,code.rate||0);
 return <div className={`app ${reduced?'reduced':''}`} style={{'--ui-scale':prefs.scale/100} as CSSProperties}>
  <header className="topbar"><button className="brand" onClick={()=>setView('menu')} aria-label="Kernel Keep home"><Mark/><span>KERNEL <b>KEEP</b></span></button>
   <nav aria-label="Views"><button aria-current={view==='menu'?'page':undefined} onClick={()=>setView('menu')}>Overview</button><button aria-current={view==='hud'?'page':undefined} onClick={()=>setView('hud')}>HUD lab</button><button aria-current={view==='art'?'page':undefined} onClick={()=>setView('art')}>Art codex</button></nav>
   <span className="lab-tag">UI LAB <span>• SAMPLE DATA</span></span><button className="settings-button" onClick={()=>setSettings(true)}>Settings</button>
  </header>
  {view==='menu'&&<main className="menu" style={{backgroundImage:`linear-gradient(90deg,#05111beb,transparent 85%),url(${asset('kernel-menu-background')})`}}>
   <div className="menu-copy"><p className="eyebrow">A CIVILIZATION WRITTEN IN CODE</p><h1>Build the keep.<br/><em>Command the kernel.</em></h1><p className="lead">Feed your programs. Fortify the divide.<br/>Give your digital civilization a fighting chance.</p>
    <div className="menu-actions"><button className="primary" onClick={()=>setView('hud')}>Explore the HUD <span>↗</span></button><button onClick={()=>setView('art')}>Open the art codex</button></div>
    <p className="lab-description">Interactive interface study · original game not connected.<br/>Explore four economy states, six roles, and ten structures.</p>
   </div>
   <div className="menu-footer"><span><i className="status-dot"/> LOCAL-FIRST PRESENTATION</span><span>MERIDIAN DIVIDE · DESIGN REVISION 0.2</span>{installPrompt&&<button onClick={async()=>{await installPrompt.prompt();setInstallPrompt(null);}}>Install UI lab</button>}</div>
  </main>}
  {view==='hud'&&<main className="hud">
   <section className="resources" aria-label="Sample resources">{state.resources.map(r=><div className={`resource ${r.color}`} key={r.id} title={r.capacity===undefined?'Sample stock and net rate':'Sample used or requested capacity / supplied capacity'}>
    <span className="resource-icon">{r.glyph}</span><div><small>{r.name}</small><strong>{r.amount.toLocaleString()}{r.capacity!==undefined&&<span className="capacity"> / {r.capacity}</span>}</strong></div>
    <span className={`rate ${(r.rate??0)<0?'negative':''}`}>{r.rate===undefined?(r.amount>r.capacity!?'OVERLOAD':'CAPACITY'):`${r.rate>=0?'+':''}${r.rate}/s`}</span>
   </div>)}<button onClick={()=>bridge.dispatch({type:'pause-scene'})} aria-label={state.scenePaused?'Resume scene animation':'Pause scene animation'}>{state.scenePaused?'▶':'Ⅱ'}</button></section>
   <div className="scene-toolbar"><span className="map-title">MERIDIAN DIVIDE <small> / SCENARIO PREVIEW</small></span><label>Sample state <select aria-label="Sample state" value={state.scenario} onChange={e=>bridge.dispatch({type:'scenario',scenario:e.target.value as Scenario})}>{scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
   <section className="battlefield" aria-label="Battlefield presentation">
    <World snapshot={state} reduced={reduced} shapes={prefs.shapes} onSelect={role=>bridge.dispatch({type:'select',role})}/>
    <aside className="objective panel"><p className="eyebrow">FORTIFY THE DIVIDE</p><h2>Keep the programs running.</h2><p><span className="check">✓</span> Establish a Code supply</p><p><span className="check">✓</span> Train the first formation</p><p><span className="objective-ring"/> Secure the access gate</p><small>Illustrated objectives, not saved progress.</small></aside>
    <aside className={`health-panel panel ${state.scenario==='stable'?'':'warning'}`}><div className="panel-title">System stability <strong>{state.stability}%</strong></div><div className="meter"><span style={{width:`${state.stability}%`}}/></div>
     {state.scenario==='stable'&&<><h3>Population supplied</h3><p>Code reserve is growing in this sample.</p></>}
     {state.scenario==='code-low'&&<><h3>△ Code low · {seconds}s reserve</h3><p>Inspect Compilers and rations before programs crash. Estimate assumes the displayed net rate stays constant.</p><button onClick={()=>{setTab('Structures');setStructure('Compiler');}}>Inspect Compiler</button></>}
     {state.scenario==='brownout'&&<><h3>△ Compute brownout</h3><p>112 requested / 100 supplied. Inspect demand and restore capacity.</p><button onClick={()=>setTab('Economy')}>Inspect capacity</button></>}
     {state.scenario==='suspended'&&<><h3>△ {state.suspended} programs suspended</h3><p>Restore Code supply, then verify the engine's recovery rule.</p><button onClick={()=>{setTab('Structures');setStructure('Compiler');}}>Inspect supply</button></>}
    </aside>
    <div className="gate-control"><button onClick={()=>bridge.dispatch({type:'preview-gate'})}>Gate: {state.gateOpen?'open':'closed'} <span>↔</span></button><small>Visual toggle only</small></div>
    {state.scenePaused&&<span className="pause-banner">SCENE ANIMATION PAUSED</span>}
   </section>
   <section className="bottom-hud">
    <div className="map-panel panel"><div className="panel-title">Sector view <span>N ↑</span></div><MiniMap/><div className="map-legend">■ Friendly <span>▲ Rival</span></div></div>
    <div className="selection-panel panel"><div className="portrait" style={{backgroundImage:`url(${asset('kernel-six-roles')})`,backgroundSize:'300% 200%',backgroundPosition:`${(roles.indexOf(selected)%3)*50}% ${roles.indexOf(selected)>2?'100%':'0%'}`}}/><div><p className="eyebrow">SELECTED PROGRAM</p><h2>{selected.name}</h2><p>{selected.role}</p><div className="meter"><span style={{width:'86%'}}/></div><small>Sample portrait · illustrative health</small></div></div>
    <div className="catalog panel"><div className="tabs" role="tablist" aria-label="Inspection categories">{(['Programs','Structures','Economy'] as const).map(t=><button key={t} role="tab" aria-selected={tab===t} onClick={()=>setTab(t)}>{t}</button>)}</div>
     {tab==='Programs'&&<div className="role-grid">{roles.map((r,i)=><button className={state.selected===r.name?'selected':''} key={r.name} onClick={()=>bridge.dispatch({type:'select',role:r.name})} aria-label={`Select ${r.name}`}><span className="unit-glyph">{r.glyph}</span><strong>{r.name}</strong><small>{r.role} · {i+1}</small></button>)}</div>}
     {tab==='Structures'&&<div className="structure-grid">{structures.map(s=><button className={structure===s.name?'selected':''} key={s.name} onClick={()=>setStructure(s.name)}><span>{s.glyph}</span>{s.name}</button>)}</div>}
     {tab==='Economy'&&<div className="economy-detail"><div><strong>Shared Compute</strong><span>Demand / supply <b>{state.resources[3].amount} / 100</b></span><p>Brownout is a capacity shortfall. Allocation sliders were removed because the supplied build summary does not establish them.</p></div><div><strong>Code & stability</strong><span>Net Code <b>{code.rate!>=0?'+':''}{code.rate}/s</b></span><p>Stability, rations and crash recovery must use engine-owned values and rules.</p></div></div>}
    </div>
   </section>
   <section className="detail-row"><p>{tab==='Structures'?structures.find(s=>s.name===structure)?.description:selected.description}</p><div className="commands">{['Move','Attack','Hold','Fork'].map(order=><button key={order} title="Record a preview intent; does not affect a game" onClick={()=>intent(`${order} / ${state.selected}`)}>{order}</button>)}</div></section>
   <div className="intent-log" role="status">{state.intents[0]||'Select a role, switch economy states, or preview a command. Sample values are not balance specifications.'}</div>
  </main>}
  {view==='art'&&<main className="art-view"><div className="section-heading"><p className="eyebrow">THE VISUAL LANGUAGE</p><h1>Kernel Keep art codex.</h1><p>Reconciled to the six roles and ten structures in the supplied prototype summary.<br/>Concept sheets need separate production exports before becoming battlefield sprites.</p></div>
   <figure><img src={asset('kernel-six-roles')} alt="Kernel Keep concept sheet: Runner, Ping, Bulwark, Lancer, Patcher, Breaker"/><figcaption>01 / Program silhouettes · six roles</figcaption></figure>
   <figure><img src={asset('kernel-ten-structures')} alt="Kernel Keep concept sheet of ten building types"/><figcaption>02 / Fortress architecture · ten structures</figcaption></figure>
  </main>}
  <dialog ref={dialog} onCancel={()=>setSettings(false)} onClose={()=>setSettings(false)} aria-labelledby="settings-title"><div className="dialog-title"><div><p className="eyebrow">LOCAL PREFERENCES</p><h2 id="settings-title">Make the interface yours.</h2></div><button autoFocus onClick={()=>setSettings(false)} aria-label="Close settings">×</button></div>
   <label className="setting">UI text scale <output>{prefs.scale}%</output><input aria-label="UI text scale" type="range" min="90" max="125" value={prefs.scale} onChange={e=>update('scale',Number(e.target.value))}/></label>
   <label className="setting inline">Reduced motion & flashing<input type="checkbox" checked={prefs.reducedMotion} onChange={e=>update('reducedMotion',e.target.checked)}/></label>
   <label className="setting inline">Show program number markers<input type="checkbox" checked={prefs.shapes} onChange={e=>update('shapes',e.target.checked)}/></label>
   <label className="setting inline">Pause animation key<select value={prefs.pauseKey} onChange={e=>update('pauseKey',e.target.value)}><option value="Space">Space</option><option value="KeyP">P</option></select></label>
   <p className="setting-note">System reduced-motion preferences are also respected. These preferences belong to the UI lab and do not overwrite game saves.</p>
   <button className="primary" onClick={()=>setSettings(false)}>Done</button>
  </dialog>
  {notice&&<div className="storage-notice" role="status">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss storage notice">×</button></div>}
 </div>;
}
