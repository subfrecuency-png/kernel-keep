import {useEffect,useRef} from 'react';
import type {HudSnapshot,Role} from './contracts';
import {roles} from './catalog';
type Props={snapshot:HudSnapshot;reduced:boolean;shapes:boolean;onSelect:(r:Role)=>void};
/** Presentation-only Canvas diorama. No economics, combat, fog simulation or engine state. */
export function World({snapshot,reduced,shapes,onSelect}:Props){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current!;const c=canvas.getContext('2d')!;let frame=0;let time=0;let last=0;let w=1,h=1;const dpr=Math.min(window.devicePixelRatio||1,2);
  const resize=()=>{const box=canvas.getBoundingClientRect();w=box.width;h=box.height;canvas.width=w*dpr;canvas.height=h*dpr;};
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);resize();last=0;draw(0);});observer.observe(canvas);resize();
  const points=(p:number[][],fill:string,stroke?:string)=>{c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
  const iso=(x:number,y:number,z=0):[number,number]=>[w*.5+(x-y)*w*.027,h*.18+(x+y)*h*.021-z*h*.048];
  function box(x:number,y:number,size:number,height:number,color:string){
   const a=iso(x,y),b=iso(x+size,y),d=iso(x,y+size),e=iso(x+size,y+size);const at=iso(x,y,height),bt=iso(x+size,y,height),dt=iso(x,y+size,height),et=iso(x+size,y+size,height);
   points([d,e,et,dt],'#081d29',color+'60');points([e,b,bt,et],'#0b2e40',color+'90');points([at,bt,et,dt],'#173446',color);
   c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(e[0],e[1]);c.lineTo(et[0],et[1]);c.stroke();
   return [at,bt,dt,et];
  }
  function draw(now:number){
   const active=!reduced&&!snapshot.scenePaused&&!document.hidden;if(active&&last)time+=Math.min(50,now-last);last=now;
   c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
   const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#0b1b2a');bg.addColorStop(.5,'#0b2534');bg.addColorStop(1,'#040d19');c.fillStyle=bg;c.fillRect(0,0,w,h);
   for(let x=-3;x<23;x++)for(let y=-3;y<23;y++){
    if(x===14&&y>2&&y<20&&y!==10&&y!==11)continue;
    points([iso(x,y),iso(x+1,y),iso(x+1,y+1),iso(x,y+1)],(x+y)%2?'#102432':'#0d202d','#1b3947');
   }
   c.strokeStyle='#33d6ec40';c.lineWidth=2;for(const lane of [4,9,13]){c.beginPath();const a=iso(lane,0),b=iso(lane,19);c.moveTo(...a);c.lineTo(...b);c.stroke();}
   const buildings=[[3,5,2.4,4.3,'#5ce5f1'],[3,10,1.7,1.6,'#55dbea'],[7,6,1.8,2,'#edb66d'],[8,10,1.3,1.6,'#51d9f1'],[4,14,1.5,2.6,'#a390fa'],[10,4,1.5,1.1,'#e5ae62']] as const;
   for(const [x,y,s,z,color]of buildings){box(x,y,s,z,color);box(x+.25,y+.25,s-.5,.3+z,color);const [gx,gy]=iso(x+s/2,y+s/2,z+.7);c.shadowColor=color;c.shadowBlur=reduced?0:14;c.fillStyle=color;c.fillRect(gx-4,gy-6,8,10);c.shadowBlur=0;}
   for(let y=3;y<16;y++){if(y===10||y===11)continue;box(12,y,.65,1.25,'#37adc9');}
   box(12,9.5,.9,2.1,'#65d9f1');box(12,12,.9,2.1,'#65d9f1');if(!snapshot.gateOpen)box(12,10.3,1.4,1.5,'#e6b35f');
   for(let i=0;i<6;i++){
    const [ux,uy]=iso(8+(i%3)*1.1,13+Math.floor(i/3)*1.15);const selected=snapshot.selected===roles[i].name;
    c.strokeStyle=selected?'#a3f4ff':'#388ba0';c.lineWidth=selected?2:1;c.beginPath();c.ellipse(ux,uy+4,13,6,0,0,Math.PI*2);c.stroke();
    points([[ux,uy-17],[ux+7,uy-9],[ux+5,uy+3],[ux-5,uy+3],[ux-7,uy-9]],'#bcdfeb','#59daf3');c.fillStyle='#52deef';c.fillRect(ux-3,uy-15,6,3);
    c.fillStyle='#86e6c5';c.fillRect(ux-10,uy-25,20,2);if(shapes){c.font='10px sans-serif';c.fillStyle='#d5f5ff';c.fillText(String(i+1),ux-3,uy+20);}
   }
   for(let i=0;i<11;i++){const [x,y]=iso(17+(i%3)*.8,7+Math.floor(i/3)*.8);points([[x,y-9],[x+6,y+4],[x-6,y+4]],'#d16c7f','#ff7890');}
   for(let i=0;i<6;i++){const t=(time*.00005+i/6)%1;const [x,y]=iso(4+t*6,9);c.fillStyle='#6eeaff';c.fillRect(x-3,y-4,6,6);}
   const [cx,cy]=iso(14,10.5);c.strokeStyle='#55daf655';c.setLineDash([4,5]);c.beginPath();c.ellipse(cx,cy,48,22,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
   const fog=c.createLinearGradient(w*.65,0,w,0);fog.addColorStop(0,'transparent');fog.addColorStop(1,'#06111bdd');c.fillStyle=fog;c.fillRect(0,0,w,h);
   c.font='11px monospace';c.fillStyle='#769dab';c.fillText('MERIDIAN DIVIDE / PRESENTATION DIORAMA',24,h-18);
   if(active)frame=requestAnimationFrame(draw);
  }
  function visibility(){cancelAnimationFrame(frame);last=0;draw(0);}document.addEventListener('visibilitychange',visibility);draw(0);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);};
 },[snapshot.selected,snapshot.gateOpen,snapshot.scenePaused,reduced,shapes]);
 return <canvas ref={ref} aria-label="Illustrative battlefield. Select programs using the buttons below." onClick={e=>{
  const b=e.currentTarget.getBoundingClientRect();const mx=e.clientX-b.left,my=e.clientY-b.top;
  let nearest=-1,best=26;
  for(let i=0;i<6;i++){const x=8+(i%3)*1.1,y=13+Math.floor(i/3)*1.15;const sx=b.width*.5+(x-y)*b.width*.027,sy=b.height*.18+(x+y)*b.height*.021;const d=Math.hypot(mx-sx,my-(sy-7));if(d<best){best=d;nearest=i;}}
  if(nearest>=0)onSelect(roles[nearest].name);
 }}/>;
}
