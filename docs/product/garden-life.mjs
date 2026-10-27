// v16 (Claude branch) · living layer on top of the v14 garden.
// Natural breathing bubbles, freshness, the Kumo core for 收藏聚落 and small celebrations.
// Pure helpers + a tiny animation loop; the layouts and classification stay untouched.
import {footprint,intersects} from './spacing.mjs';
import {pathTo} from './schema.mjs';

const DAY=86400000;
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

export function hashSeed(text){let h=2166136261;for(const ch of String(text)){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;}

// Organic closed outline: an ellipse whose radius is modulated by a few slow sine waves.
export function organicPath(rx,ry,seed=0,t=0,{wobble=1,points=40}={}){
 const s=typeof seed==='number'?seed:hashSeed(seed),waves=[[2,.032,s*6.28,.23],[3,.04,s*11.3,-.17],[5,.019,s*3.7,.31],[7,.009,s*9.1,-.41]],pts=[];
 for(let i=0;i<points;i++){const a=i/points*Math.PI*2;let m=1;for(const [k,amp,ph,w]of waves)m+=amp*wobble*Math.sin(k*a+ph+w*t);pts.push([Math.cos(a)*rx*m,Math.sin(a)*ry*m]);}
 const n=pts.length,f=v=>v.toFixed(1);let d=`M${f(pts[0][0])},${f(pts[0][1])}`;
 for(let i=0;i<n;i++){const p0=pts[(i-1+n)%n],p1=pts[i],p2=pts[(i+1)%n],p3=pts[(i+2)%n];d+=`C${f(p1[0]+(p2[0]-p0[0])/6)},${f(p1[1]+(p2[1]-p0[1])/6)} ${f(p2[0]-(p3[0]-p1[0])/6)},${f(p2[1]-(p3[1]-p1[1])/6)} ${f(p2[0])},${f(p2[1])}`;}
 return d+'Z';
}

// One shared loop breathes every registered bubble; hovering swells it a little.
export function createBreathing(){
 let items=[],frame=0,last=0,afterTick=()=>{};
 function render(t){for(const b of items){if(!b.el.isConnected)continue;const hovering=b.hover||b.follow?.hover,k=hovering?1.03:1;b.el.setAttribute('d',(b.pathBuilder||organicPath)(b.rx*k,b.ry*k,b.seed,t,{wobble:(b.wobble||1)*(hovering?1.8:1)}));}afterTick(t);}
 function tick(now){frame=requestAnimationFrame(tick);if(now-last<45)return;last=now;render(now/1000);}
 return {
  add(el,rx,ry,seed,wobble=1,pathBuilder=organicPath){const item={el,rx,ry,seed:hashSeed(seed),wobble,hover:false,pathBuilder};items.push(item);el.setAttribute('d',pathBuilder(rx,ry,item.seed,0,{wobble}));if(!frame&&!reduced())frame=requestAnimationFrame(tick);return item;},
  clear(){items=[];},
  onTick(fn){afterTick=typeof fn==='function'?fn:()=>{};},
  refresh(time=0){render(time);},
  stop(){cancelAnimationFrame(frame);frame=0;}
 };
}

// Region family for colouring bubbles (same split the schema uses for palettes).
export function familyClass(model,record,pathTo){const key=record?.kind==='source'?record.primary:record?.key,root=pathTo(model,key)[0];return root==='domain:ai-creation-tools'?'fam-tools':root==='domain:career-context'?'fam-career':root?'fam-product':'fam-neutral';}

// Freshness: sources captured within 3 days of the newest capture, plus the
// domains/topics that hold them. Purely date based — no reading state is inferred.
export function freshness(model,days=3){
 const times=model.sources.map(s=>Date.parse(s.capturedAt)||0),latest=Math.max(0,...times),keys=new Set(),sources=[];
 for(const s of model.sources){const t=Date.parse(s.capturedAt)||0;if(latest&&latest-t<=days*DAY){sources.push(s);keys.add(s.key);for(const m of s.memberships||[])keys.add(m);if(s.primary)keys.add(s.primary);}}
 for(const t of model.topics||[])if(t.members?.some(k=>keys.has(k)))keys.add(t.key);
 for(const k of [...keys])for(const up of pathTo(model,k))keys.add(up);
 for(const g of model.groups||[])if(g.displayMembers?.some(k=>keys.has(typeof k==='string'?k:k.key)))keys.add(g.key);
 return {keys,sources,latest};
}

// New since the last visit, remembered per browser.
const SEEN='kumo:garden:v16:seen-sources';
export function sinceLastVisit(model){
 let seen=null;try{seen=JSON.parse(localStorage.getItem(SEEN));}catch{}
 const now=model.sources.map(s=>s.key);try{localStorage.setItem(SEEN,JSON.stringify(now));}catch{}
 if(!Array.isArray(seen))return {first:true,fresh:[]};const old=new Set(seen);return {first:false,fresh:model.sources.filter(s=>!old.has(s.key))};
}

// A quiet spot for the Kumo core in 收藏聚落: as close to the middle as possible
// without covering any colony, caption or exploration pocket.
export function corePlacement(points,size=78,view=null){
 const list=[...points.values()],boxes=list.map(p=>footprint(p,10));if(!boxes.length)return {x:0,y:0};
 const b=view||{left:Math.min(...boxes.map(q=>q.left)),right:Math.max(...boxes.map(q=>q.right)),top:Math.min(...boxes.map(q=>q.top)),bottom:Math.max(...boxes.map(q=>q.bottom))},cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
 const overlap=box=>boxes.reduce((n,q)=>n+Math.max(0,Math.min(box.right,q.right)-Math.max(box.left,q.left))*Math.max(0,Math.min(box.bottom,q.bottom)-Math.max(box.top,q.top)),0);
 let best=null;
 for(let gy=0;gy<=24;gy++)for(let gx=0;gx<=24;gx++){
  const x=b.left+size/2+16+(b.right-b.left-size-32)*gx/24,y=b.top+size/2+12+(b.bottom-b.top-size-40)*gy/24,box={left:x-size/2,right:x+size/2,top:y-size/2,bottom:y+size/2+16};
  const score=overlap(box)*40+Math.hypot((x-cx)/(b.right-b.left),(y-cy)/(b.bottom-b.top))*1000;
  if(!best||score<best.score)best={x,y,score};
 }
 return {x:best.x,y:best.y};
}

// Petals scatter from a point when a landmark blooms for the first time.
export function petalBurst(layer,x,y,make){
 if(reduced()||!layer)return;const NS='http://www.w3.org/2000/svg',g=document.createElementNS(NS,'g');g.setAttribute('class','petal-burst');g.setAttribute('transform',`translate(${x} ${y})`);layer.append(g);
 const parts=Array.from({length:14},(_,i)=>{const node=make(i);g.append(node);const a=i/14*Math.PI*2+Math.random()*.4,v=2+Math.random()*2.2;return {node,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.4,x:0,y:0,r:0};});
 let f=0;const step=()=>{f++;for(const p of parts){p.x+=p.vx;p.y+=p.vy;p.vy+=.06;p.r+=7;p.node.setAttribute('transform',`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.r})`);p.node.setAttribute('opacity',String(Math.max(0,1-f/70)));}if(f<70)requestAnimationFrame(step);else g.remove();};requestAnimationFrame(step);
}

// v16.2 · Plant variety. Owned plant families form the garden's plant pool: every colony
// gets its own family (the largest colony of a region keeps the region's family), and
// leaves draw from the whole pool, so neighbours rarely look alike. Unlocking a plant
// in the atlas adds it to the pool.
export const PLANT_FAMILIES=['P01','P02','P03','P04','P05','P06','P07','P08','P09','P10','P11','F01','F02','F03','F04','F06'];
export function plantPool(isOwned){return PLANT_FAMILIES.filter(id=>isOwned(id));}
export function colonyFamilies(model,rootFamily,pool){
 const map=new Map(),roots=new Map(),used=new Set();
 for(const g of model.groups||[]){const root=pathTo(model,g.key)[0]||g.key;if(!roots.has(root))roots.set(root,[]);roots.get(root).push(g);used.add(rootFamily(root));}
 const rest=pool.filter(id=>!used.has(id));
 for(const [root,groups] of roots){groups.sort((a,b)=>(b.displayCount||0)-(a.displayCount||0)||String(a.key).localeCompare(b.key));groups.forEach((g,i)=>map.set(g.key,i===0?rootFamily(root):rest.shift()||rootFamily(root)));}
 return map;
}
export function sourceFamily(model,source,colonyFamily,pool,kinds=pool.length){
 const companions=pool.filter(id=>id!==colonyFamily),k=Math.max(1,Math.min(kinds,companions.length+1));if(k<=1||!companions.length)return colonyFamily;
 const group=model.records.get(source.primary),i=Math.max(0,group?.displayMembers?.indexOf(source.key)??0);
 // Every third leaf repeats its colony's plant so the colony still reads as one patch.
 if(i%3===0)return colonyFamily;const start=Math.floor(hashSeed(source.primary||'')*companions.length);return companions[(start+(i%(k-1)))%companions.length];
}
