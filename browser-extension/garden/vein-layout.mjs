import {ROOT,roots,children,countOf,pathTo} from './schema.mjs';
import {hierarchyDisplaySize} from './map-metrics.mjs';
const PAGE=12,newest=(a,b)=>(Date.parse(b.capturedAt)||0)-(Date.parse(a.capturedAt)||0)||a.key.localeCompare(b.key);

// Keep several branches open together. Only the active topic mounts post cards;
// other branches retain their real hierarchy, counts and chronological page buds.
export function veinLayout(model,{path=[],page=0,width=830,height=610,expanded,selected=ROOT}={}){
 const open=new Set(expanded||[ROOT,...roots(model).map(r=>r.key)]);for(const k of path.slice(0,-1))open.add(k);
 for(const [k,r]of model.records)if(r.displayOnly)model.records.delete(k);
 const current=path.at(-1)||ROOT,active=model.records.get(current),points=new Map(),edges=[],childMap=new Map(),seen=new Set(),pageIndex=Math.max(0,Math.floor(page/PAGE));
 const activeTopic=active?.kind==='topic'?active:null;
 function branches(r){
  if(!open.has(r.key))return [];
  let list=children(model,r.key).filter(c=>c.kind!=='source');
  if(r.kind==='topic'&&!list.length){const sources=r.members.map(k=>model.records.get(k)).filter(s=>s?.kind==='source').sort(newest),pages=Math.ceil(sources.length/PAGE),index=Math.min(pageIndex,Math.max(0,pages-1));
   if(pages>1){const start=Math.max(0,Math.min(index-5,pages-12));list=Array.from({length:Math.min(12,pages-start)},(_,i)=>{const n=start+i,members=sources.slice(n*PAGE,(n+1)*PAGE).map(s=>s.key),key='topic:tree-page:'+r.id+':'+n,record={id:key.slice(6),key,kind:'topic',displayOnly:true,displayView:'tree',branchOf:r.key,pageIndex:n,parentTopicId:r.id,domainId:r.domainId,name:'第'+(n+1)+'枝 · '+(n*PAGE+1)+'–'+(n*PAGE+members.length),members,count:members.length,keywords:[]};model.records.set(key,record);if(activeTopic?.key===r.key&&n===index)childMap.set(key,members.map(k=>model.records.get(k)));return record;});}
   else if(activeTopic?.key===r.key)list=sources;
  }
  if(!list.length&&r.kind!=='topic'&&r.key===current)list=children(model,r.key).filter(c=>c.kind==='source').sort(newest).slice(pageIndex*PAGE,(pageIndex+1)*PAGE);
  return list;
 }
 const top=roots(model);childMap.set(ROOT,top);
 function discover(r,depth=0){if(seen.has(r.key)||depth>20)return;seen.add(r.key);if(!childMap.has(r.key))childMap.set(r.key,branches(r));for(const c of childMap.get(r.key))discover(c,depth+1);}
 for(const r of top)discover(r);
 const size=r=>hierarchyDisplaySize(model,r);
 const heights=new Map();function measure(r){if(heights.has(r.key))return heights.get(r.key);heights.set(r.key,size(r)+58);const cs=childMap.get(r.key)||[],h=Math.max(size(r)+58,cs.length&&cs.every(c=>c.kind==='source')?Math.ceil(cs.length/3)*154+30:cs.reduce((n,c)=>n+measure(c),0)+(cs.length-1)*22);heights.set(r.key,h);return h;}
 const sides=new Map(),load={left:0,right:0};for(const r of [...top].sort((a,b)=>countOf(b)-countOf(a))){const side=load.left<=load.right?'left':'right';sides.set(r.key,side);load[side]+=measure(r)+48;}
 const put=(r,x,y,parent,side)=>{const p={key:r.key,record:r,size:size(r),x,y,parent,side};if(r.kind==='source')Object.assign(p,{preview:true,cardWidth:176,cardHeight:116});points.set(r.key,p);if(parent)edges.push({key:'vein:'+r.key,from:parent,to:r.key,kind:'hierarchy'});return p;};
 const root=put(model.records.get(ROOT),width/2,height/2,null,null);
 function arrange(r,x,y,parent,side){const p=put(r,x,y,parent,side),cs=childMap.get(r.key)||[],sign=side==='left'?-1:1,total=cs.reduce((n,c)=>n+measure(c),0)+(cs.length-1)*22;let cursor=y-total/2;
  if(cs.length&&cs.every(c=>c.kind==='source')){const columns=Math.min(3,cs.length),rows=Math.ceil(cs.length/columns);cs.forEach((c,i)=>put(c,x+sign*(250+(i%columns)*212),y+(Math.floor(i/columns)-(rows-1)/2)*154,r.key,side));return;}
  for(const c of cs){const h=measure(c),distance=Math.max(245,(size(r)+size(c))/2+110);arrange(c,x+sign*distance,cursor+h/2,r.key,side);cursor+=h+22;}
 }
 for(const side of ['left','right']){const list=top.filter(r=>sides.get(r.key)===side),total=list.reduce((n,r)=>n+measure(r),0)+(list.length-1)*48;let cursor=root.y-total/2;for(const r of list){const h=measure(r);arrange(r,root.x+(side==='left'?-1:1)*(root.size/2+size(r)/2+140),cursor+h/2,ROOT,side);cursor+=h+48;}}
 const focusKeys=new Set([current]);for(const p of points.values()){let parent=p.parent;const visited=new Set();while(parent&&!visited.has(parent)){visited.add(parent);if(parent===current){focusKeys.add(p.key);break;}parent=points.get(parent)?.parent;}}
 if(activeTopic){for(const k of [...focusKeys]){const p=points.get(k);if(p?.record.displayOnly&&!childMap.get(k)?.length)focusKeys.delete(k);}}
 const total=activeTopic?activeTopic.members.length:active?children(model,current).length:top.length,limit=activeTopic?PAGE:Math.max(1,total),offset=activeTopic?Math.min(pageIndex,Math.max(0,Math.ceil(total/PAGE)-1))*PAGE:0;
 const navigation={tree:true,path:pathTo(model,current),current,page:offset,limit,total,items:(childMap.get(current)||[]),focusKeys:[...focusKeys].filter(k=>points.has(k)),expanded:[...open],direction:'both'};
 return {points,edges,bundles:[],navigation,guides:[]};
}
