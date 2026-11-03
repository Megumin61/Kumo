import {domainMetrics,ATOM_SIZE,topicDisplaySize} from './map-metrics.mjs';
import {ROOT} from './schema.mjs';
export const FIELD_PAGE_SIZE=12;
// The colony map is complete. Reader pagination never projects or filters map membership.
export function fieldView(model,{selected=ROOT}={}){
 const records=new Map([...model.records].filter(([,r])=>!r.displayOnly));
 const topics=model.topics.filter(r=>!r.displayOnly),groups=model.groups.map(g=>({...g,displayMetrics:domainMetrics(model,g),displayMembers:[...g.displayMembers]}));
 return {model:{...model,records,topics,groups},branches:[],window:{full:true,scope:ROOT,page:0,pages:1,pageSize:model.sources.length,total:model.sources.length,start:model.sources.length?1:0,end:model.sources.length,hiddenCount:0,overview:selected===ROOT,label:'全部收藏'}};
}

// Lay a visible tree out by depth. A large topic gains page branches, then leaves.
// The cost depends on mounted nodes, not on every post in the library.
export function branchMemberOffsets(hub,members){
 const byKey=new Map(members.map(p=>[p.key,p])),children=new Map(),parents=new Map();
 for(const p of members){let parent=null;if(p.record.kind==='topic'&&p.record.parentTopicId){const key='topic:'+p.record.parentTopicId;if(byKey.has(key))parent=key;}
  if(p.record.kind==='source'){const t=members.filter(t=>t.record.kind==='topic'&&t.record.members.includes(p.key)).sort((a,b)=>a.record.members.length-b.record.members.length||Number(b.record.displayOnly)-Number(a.record.displayOnly))[0];parent=t?.key||null;p.clusterTopic=parent;}
  parents.set(p.key,parent);p.parent=parent||hub.key;const key=parent||hub.key;if(!children.has(key))children.set(key,[]);children.get(key).push(p);
 }
 const sized=new Set();function size(p){if(sized.has(p.key))return p.size;sized.add(p.key);const parent=byKey.get(parents.get(p.key)),parentSize=parent?size(parent):hub.size;p.size=p.record.kind==='source'?ATOM_SIZE:Math.min(topicDisplaySize(p.record.members?.length||0),ATOM_SIZE+(parentSize-ATOM_SIZE)*.55);return p.size;}for(const p of members)size(p);
 const weights=new Map(),weight=p=>{if(weights.has(p.key))return weights.get(p.key);weights.set(p.key,1);const n=(children.get(p.key)||[]).reduce((n,c)=>n+weight(c),0)||1;weights.set(p.key,n);return n;};
 const polar=new Map(),levels=new Map(),phase=-Math.PI*.8;
 function place(parent,lo,hi,depth){const list=children.get(parent)||[],total=list.reduce((n,p)=>n+weight(p),0)||1;let edge=lo;for(const p of list){const span=(hi-lo)*weight(p)/total,a=edge+span/2;polar.set(p.key,{a,depth});if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(p);const half=Math.min(span,Math.PI*.72)/2;place(p.key,a-half,a+half,depth+1);edge+=span;}}
 place(hub.key,phase,phase+Math.PI*2,1);
 const radii=new Map();let previousR=0,previousSize=hub.size;
 for(const [depth,list]of levels){const largest=Math.max(...list.map(p=>p.size));let radius=previousR+(previousSize+largest)/2/.82+38;
  for(let i=0;i<list.length;i++)for(let j=0;j<i;j++){const a=polar.get(list[i].key).a,b=polar.get(list[j].key).a,unit=Math.hypot(Math.cos(a)-Math.cos(b),.82*(Math.sin(a)-Math.sin(b)));radius=Math.max(radius,((list[i].size+list[j].size)/2+18)/Math.max(.001,unit));}
  // Clear the domain caption locally at the first ring, without scaling the whole tree.
  if(depth===1)for(const p of list){const a=polar.get(p.key).a,half=p.size/2+10;while(Math.abs(Math.cos(a)*radius)<82+half&&Math.sin(a)*radius*.82>hub.size/2+2-half&&Math.sin(a)*radius*.82<hub.size/2+48+half)radius+=12;}
  radii.set(depth,radius);previousR=radius;previousSize=largest;
 }
 return members.map(p=>{const q=polar.get(p.key);if(!q)throw Error('Cyclic display hierarchy');const r=radii.get(q.depth);return [Math.cos(q.a)*r,Math.sin(q.a)*r*.82];});
}
