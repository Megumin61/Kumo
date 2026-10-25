import {colonyRayRadius} from './colony-appearance.mjs';
// v20 · 主题碎片：从每个领域的藤蔓上长出来的小节点。
// 数量取决于这个领域收了多少、你解锁了多少花种、回访了几天；最近收藏的刚发芽，旧的已开花。
import {coverPath} from './cover.mjs';
import {sourceMetadata,sourceIntro} from './note-presentation.mjs';
import {platformBadge} from './platform-icon.mjs';
import {hashSeed} from './garden-life.mjs';
const PROGRESS_KEY='kumo:garden:collection-progress:v12',FIRST_KEY='kumo:garden:first-seen:v19';
const clip=(text,n=64)=>{const t=String(text||'').replace(/\s+/g,' ').trim();return t.length>n?t.slice(0,n-1)+'…':t;};
const first=text=>clip(String(text||'').split(/[。！？\n]/)[0],70);
function readNotes(){try{const n=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}').notes||{};return Object.entries(n).map(([k,v])=>[k,typeof v==='string'?v:v?.text||v?.body||'']).filter(([,v])=>v.trim());}catch{return [];}}
const pointOf=r=>first(r?.knowledge?.takeaways?.[0]||r?.summary)||'';
export function buildDomainFragments(model){
 const out=new Map(),records=model.records,domains=new Map();
 for(const r of records.values())if(r.kind==='domain'){domains.set(r.id,r);out.set(r.key,[]);}
 const domainOfTopic=t=>domains.get(t.domainId),used=new Set(),pick=ids=>{const list=(ids||[]).map(k=>records.get(k)).filter(s=>s?.kind==='source'&&!used.has(s.key));return list.find(s=>coverPath(s))||list[0];};
 const noteOwner=r=>{const owner=records.get(r.primary);return r.kind==='topic'?domainOfTopic(r):r.kind==='domain'?r:owner?.kind==='domain'?owner:domainOfTopic(owner||{});};
 for(const [k,text] of readNotes()){const r=records.get(k);if(!r)continue;const d=noteOwner(r);if(!d||!out.has(d.key))continue;const source=r.kind==='source'?r:pick(r.members);if(source)out.get(d.key).push({id:'note:'+k,kind:'note',label:'你写过的话',domainKey:d.key,domainName:d.name,topicName:r.kind==='topic'?r.name:'',source,point:clip(text,80)});}
 const topics=[...records.values()].filter(r=>r.kind==='topic'&&(r.members?.length||0)>=2).sort((a,b)=>(b.members.length-a.members.length)||a.key.localeCompare(b.key));
 for(const t of topics){const d=domainOfTopic(t);if(!d||!out.has(d.key))continue;const source=pick(t.members);if(!source)continue;used.add(source.key);
  out.get(d.key).push({id:'topic:'+t.key,kind:'topic',label:'主题碎片',domainKey:d.key,topicKey:t.key,domainName:d.name,topicName:t.name+' · '+t.members.length+' 篇',source,point:pointOf(t)||pointOf(source)||first(sourceIntro(source))});}
 const sources=[...records.values()].filter(r=>r.kind==='source'&&!used.has(r.key)).sort((a,b)=>hashSeed(a.key)-hashSeed(b.key));
 for(const s of sources){const t=records.get(s.primary),d=t?.kind==='topic'?domainOfTopic(t):t?.kind==='domain'?t:null;if(!d||!out.has(d.key))continue;out.get(d.key).push({id:'source:'+s.key,kind:'source',label:'收藏碎片',domainKey:d.key,topicKey:t.kind==='topic'?t.key:'',domainName:d.name,topicName:t.kind==='topic'?t.name:'',source:s,point:pointOf(s)||first(sourceIntro(s))});}
 return out;
}
export function daysSinceFirstVisit(){try{let t=Number(localStorage.getItem(FIRST_KEY));if(!t){t=Date.now();localStorage.setItem(FIRST_KEY,String(t));}return Math.floor((Date.now()-t)/864e5);}catch{return 0;}}
// Keep each node quiet: one small fragment, or two for a fuller branch.
export function fragmentQuota({count,avail}){return Math.max(0,Math.min(avail,2,count>=8?2:1));}
export function stageOf(f){const t=Date.parse(f.source?.capturedAt||'');return t&&Date.now()-t<3*864e5?'sprout':'bloom';}
// 卡片内容：来源、所属领域、收藏时间、收藏内容、核心观点
export function describeFragment(f){
 const r=f.source,captured=String(r.capturedAt||''),date=/^\d{4}-\d{2}-\d{2}/.test(captured)?captured.slice(0,10):'';
 return {label:f.label,title:r.name,cover:coverPath(r),badge:platformBadge(r),meta:[date,sourceMetadata(r)].filter(Boolean).join(' · '),point:f.point,pointLabel:f.kind==='topic'?'主题要点':(r.knowledge?.takeaways?.[0]?'核心观点':'内容摘要'),trail:f.domainName+(f.topicName?' › '+f.topicName:''),readKey:r.key};
}
const NS='http://www.w3.org/2000/svg';
const node=(name,attrs,parent)=>{const e=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));parent?.append(e);return e;};
export function drawBud(parent,{stage='bloom'}={}){
 const g=node('g',{class:'frag-bud grow-in '+stage,tabindex:0,role:'button','aria-label':'主题碎片：点开看一句'},parent);
 node('circle',{cx:0,cy:-14,r:24,fill:'transparent'},g);
 node('circle',{class:'bud-glow',cx:0,cy:-16,r:15},g);
 node('path',{class:'bud-stem',d:'M0 12 Q-3 0 0 -9',fill:'none'},g);
 node('path',{class:'bud-leaf',d:'M0 6 C -9 4 -10 -3 -9 -5 C -3 -5 0 -1 0 6 Z'},g);
 node('path',{class:'bud-leaf',d:'M0 3 C 8 2 10 -4 9 -6 C 3 -6 0 -2 0 3 Z'},g);
 if(stage==='sprout'){node('ellipse',{class:'bud-petal',cx:0,cy:-15,rx:3.6,ry:6.4},g);node('path',{class:'bud-leaf',d:'M-4 -14 Q 0 -8 4 -14'},g);}
 else{for(let i=0;i<5;i++)node('ellipse',{class:'bud-petal',cx:0,cy:-22,rx:4,ry:6.2,transform:`rotate(${i*72} 0 -16)`},g);node('circle',{class:'bud-core',cx:0,cy:-16,r:3.4},g);}
 return g;
}
// 位置：沿着领域的"外侧"，避开别的节点和别的领域；每个节点用一小段藤蔓接回领域。
export function placeFragmentNodes(layout,plan){
 const pts=[...layout.points.values()],hubs=pts.filter(p=>p.plot&&!p.owner),out=[];
 const root=pts.find(p=>p.record.kind==='brand')||layout.core||{x:pts.reduce((n,p)=>n+p.x,0)/Math.max(1,pts.length),y:pts.reduce((n,p)=>n+p.y,0)/Math.max(1,pts.length)};
 const rim=(h,a)=>colonyRayRadius(h,a);
 const clear=(x,y,self)=>pts.every(p=>p===self||p.record.kind==='brand'&&false||Math.hypot(p.x-x,p.y-y)>(p.owner?p.size/2+30:p.size/2+40))&&hubs.every(h=>{if(h===self)return true;const dx=(x-h.x)/(h.plot.rx*1.1),dy=(y-h.y-(h.plot.cy||0))/(h.plot.ry*1.1);return dx*dx+dy*dy>1;})&&Math.hypot(x-root.x,y-root.y)>(root.size||120)/2+40;
 for(const {point:h,frags} of plan){
  const base=Math.atan2(h.y-root.y,h.x-root.x),offsets=[1.15,-1.15,1.75,-1.75,.65,-.65,2.4,-2.4,3.1,0];
  frags.forEach((f,i)=>{let spot=null;
   for(let k=0;k<offsets.length&&!spot;k++){const a=base+offsets[(k+i*2)%offsets.length];
    for(const extra of [0,26,52,80]){const r=rim(h,a)+(h.plot?44:h.size/2*0+56)+extra,x=h.x+Math.cos(a)*r,y=h.y+Math.sin(a)*r;
     if(clear(x,y,h)&&out.every(o=>Math.hypot(o.x-x,o.y-y)>64)){const ar=rim(h,a)*(h.plot?.94:.9);spot={x,y,anchor:[h.x+Math.cos(a)*ar,h.y+Math.sin(a)*ar],frag:f,domainKey:h.key,stage:stageOf(f)};break;}}}
   if(spot)out.push(spot);});
 }
 return out;
}
// 卡片：简约、叶形，样子跟原来的悬浮卡一致。
export function mountFragmentCard(host,{onRead}){
 let card=null,items=[],index=0,pinned=false,timer=null;
 const close=()=>{clearTimeout(timer);timer=null;card?.remove();card=null;pinned=false;};
 const leave=()=>{clearTimeout(timer);if(!pinned)timer=setTimeout(close,240);};
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
 const render=()=>{const item=items[index];if(!item){close();return;}const d=item.data();
  if(!card){card=el('div','fragment-pop');card.addEventListener('pointerdown',e=>e.stopPropagation());card.addEventListener('pointerenter',()=>clearTimeout(timer));card.addEventListener('pointerleave',leave);host.append(card);}
  card.replaceChildren();
  const top=el('div','fp-top'),flag=el('span','fp-flag','✿ '+d.label),x=el('button','fp-x','×');x.type='button';x.setAttribute('aria-label','关闭');x.onclick=close;top.append(flag,x);
  const body=el('div','fp-body');
  if(d.cover){const img=el('img','fp-cover');img.alt='';img.src=d.cover;img.draggable=false;img.onerror=()=>img.remove();body.append(img);}
  const copy=el('div','fp-copy'),title=el('strong','fp-title',d.title),meta=el('div','fp-meta');if(d.badge)meta.append(d.badge);meta.append(el('small','',d.meta));copy.append(title,meta);body.append(copy);
  const point=d.point?el('p','fp-point'):null;if(point)point.append(el('b','',d.pointLabel+' '),document.createTextNode(d.point));
  const foot=el('div','fp-foot'),trail=el('small','fp-trail',d.trail),next=el('button','','✦ 再讲一个'),read=el('button','quiet','看出处');next.type=read.type='button';
  next.hidden=items.length<2;next.onclick=()=>{pinned=true;index=(index+1)%items.length;render();};read.onclick=()=>{close();onRead(d.readKey);};
  foot.append(trail,next,read);card.append(top,body,...(point?[point]:[]),foot);
  const box=host.getBoundingClientRect(),[ax,ay]=item.xy(),w=card.offsetWidth||300,h=card.offsetHeight||190,left=Math.max(8,Math.min(box.width-w-8,ax-w/2)),y=ay-h-24<8?Math.min(box.height-h-8,ay+26):ay-h-24;
  card.style.left=left+'px';card.style.top=y+'px';};
 const outside=e=>{if(card&&!card.contains(e.target))close();},escape=e=>{if(e.key==='Escape')close();};
 host.addEventListener('pointerdown',outside);addEventListener('keydown',escape);
 return {open(list,start,{pin=true}={}){clearTimeout(timer);pinned=pin;items=list;index=start%Math.max(1,list.length);if(card){card.remove();card=null;}render();},leave,close,dispose(){close();host.removeEventListener('pointerdown',outside);removeEventListener('keydown',escape);}};
}
