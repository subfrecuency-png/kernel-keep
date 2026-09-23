for (const n of [100,200,400]) {
  let seed=12345; const px=new Float64Array(n),py=new Float64Array(n),hp=new Int32Array(n),team=new Int32Array(n);
  for(let i=0;i<n;i++){seed=(seed*1103515245+12345)%2147483648;px[i]=(seed%6400)/100;seed=(seed*1103515245+12345)%2147483648;py[i]=(seed%6400)/100;hp[i]=100;team[i]=i%2;}
  const ticks=600,t0=performance.now();
  for(let t=0;t<ticks;t++) for(let i=0;i<n;i++){ if(hp[i]<=0)continue; let best=-1,bd=1e18;
    for(let j=0;j<n;j++){ if(team[j]===team[i]||hp[j]<=0)continue; const dx=px[j]-px[i],dy=py[j]-py[i],d=dx*dx+dy*dy; if(d<bd){bd=d;best=j;} }
    if(best>=0){ if(bd<1)hp[best]-=1; else {const l=Math.sqrt(bd);px[i]+=(px[best]-px[i])/l*0.2;py[i]+=(py[best]-py[i])/l*0.2;} } }
  console.log(`node n=${n} ms/tick=${((performance.now()-t0)/ticks).toFixed(3)}`);
}
