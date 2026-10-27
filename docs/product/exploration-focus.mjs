import {ROOT} from './schema.mjs';
import {sourceWindow} from './garden-density.mjs';
const newest=(a,b)=>(Date.parse(b.record.capturedAt)||0)-(Date.parse(a.record.capturedAt)||0)||a.key.localeCompare(b.key);
export function actualRelated(layout,keys,limit=3){
 const own=new Set(keys),scores=new Map();for(const e of layout.edges){const relations=e.relation?[e.relation]:e.record?.relations||[];for(const r of relations)for(const [a,b]of [[r.from,r.to],[r.to,r.from]])if(own.has(a)&&!own.has(b)&&layout.points.has(b))scores.set(b,(scores.get(b)||0)+1);}
 return [...scores].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([key])=>key);
}
export function explorationFocus(layout,selected=ROOT,{mode='field',hover=null,reveal=0,lens='all',lensKeys=null,density='auto'}={}){
 const all=[...layout.points.values()],point=layout.points.get(selected),selection=point&&!point.discovery&&point.record.kind!=='brand'?point:null,visible=new Set(),primary=new Set(),related=new Set(),label=new Set(),soft=new Set();let scope=[],memories=[],hiddenCount=0;
 const add=(p,main=false)=>{if(!p)return;visible.add(p.key);if(main)primary.add(p.key);};
 if(mode!=='field'){
  const current=layout.navigation?.current||ROOT,active=new Set([ROOT,...layout.navigation?.path||[],...layout.navigation?.items?.map(r=>r.key)||[]]);
  for(const p of all){add(p,active.has(p.key)||current===ROOT&&!p.discovery&&!p.relatedPeek);if(p.relatedPeek){related.add(p.key);label.add(p.key);}}
  if(selection?.record.kind==='source'){primary.clear();for(const k of [ROOT,...layout.navigation?.path||[],selection.key])primary.add(k);for(const k of actualRelated(layout,[selection.key],2))related.add(k);}
  for(const p of all)if(primary.has(p.key))label.add(p.key);
  return finish(current===ROOT?'点一个领域，沿叶脉慢慢展开':'沿主线继续；旁枝只展示当前层级的碎片');
 }
 const hubs=all.filter(p=>!p.owner&&!p.discovery),owner=selection?(selection.owner||selection.key):null,content=all.filter(p=>p.owner&&!p.discovery&&p.record.kind!=='brand');
 for(const hub of hubs){add(hub,!selection||hub.key===owner);label.add(hub.key);}
 // v17: every domain, topic and post stays on the map. Selecting something only brings it forward.
 if(!selection){for(const p of content)add(p,true);memories=[];}
 else if(selection.record.kind==='source'){
  const parent=layout.points.get(selection.clusterTopic||selection.parent);add(parent,true);
  for(const p of content){add(p,p.key===selection.key||p.key===parent?.key);if(p.owner===owner&&p.key!==selection.key)soft.add(p.key);}
  for(const k of actualRelated(layout,[selection.key],3)){const p=layout.points.get(k);add(p);related.add(k);soft.delete(k);add(layout.points.get(p.owner));}
  {const par=layout.points.get(selection.parent);memories=(selection.loneTopic||par?.record?.kind==='topic'&&(par.record.members?.length||0)<=1)?[selection.key]:[];}
 }else{
  const isTopic=selection.record.kind==='topic',members=new Set(selection.record.members||selection.record.displayMembers||[]);
  for(const p of content){const inDomain=p.owner===owner,inFocus=inDomain&&(isTopic?p.key===selection.key||members.has(p.key):true);add(p,inFocus);if(inDomain&&!inFocus)soft.add(p.key);if(inFocus&&p.record.kind==='topic')label.add(p.key);}
  add(selection,true);label.add(selection.key);
  const own=content.filter(p=>p.record.kind==='source'&&primary.has(p.key)).map(p=>p.key);
  for(const k of actualRelated(layout,own,2)){const p=layout.points.get(k);if(primary.has(k))continue;add(p);related.add(k);add(layout.points.get(p.owner));}
  memories=[];
 }
 for(const p of all.filter(p=>p.discovery))add(p,p.key===selected);
 // Posts are only named when selected or related; the overview names domains and topics.
 for(const p of all)if(visible.has(p.key)&&(primary.has(p.key)||related.has(p.key))&&((p.record.kind!=='source'&&(selection||p.record.kind!=='topic'))||p.key===selected||related.has(p.key)))label.add(p.key);
 return finish(!selection?'点一片花圃，聚焦看里面的内容':selection.record.kind==='source'?'正在读这篇收藏；主题和所属领域保留在旁边':selection.record.kind==='topic'?'这个主题收着的帖子；点一篇继续读':'这片花圃的全部主题和帖子；点一篇继续读');
 function finish(hint){
  if(mode==='field'){const window=sourceWindow(all,{density,selection,primary,related,reveal});if(window){for(const p of all)if(p.record.kind==='source'&&!window.keep.has(p.key)){visible.delete(p.key);primary.delete(p.key);related.delete(p.key);label.delete(p.key);}hiddenCount=window.hiddenCount;memories=memories.filter(k=>visible.has(k));hint=window.hint;}}
  const hovering=hover&&layout.points.get(hover),hoverOwner=hovering&&!hovering.discovery&&hovering.record.kind!=='brand'?(hovering.owner||hovering.key):null,states=new Map(),hoverTopic=hovering&&hovering.owner&&hovering.record.kind==='topic'?hovering:null,hoverMembers=new Set(hoverTopic?.record.members||[]);if(hoverTopic&&!selection)for(const k of hoverMembers)if(visible.has(k))label.add(k);
  for(const p of all){let opacity=1,role=primary.has(p.key)?'primary':related.has(p.key)?'related':'context';if(related.has(p.key))opacity=.85;else if(!primary.has(p.key))opacity=mode==='field'?(selection?(soft.has(p.key)?.55:selection.record.kind==='source'?.16:.2):.62):.24;
   if(p.discovery)opacity=p.key===selected?1:.58;
   
   if(selection&&hovering&&p.key===hover)opacity=1;
   if(lens!=='all'&&lensKeys&&!lensKeys.has(p.key)&&!p.discovery)opacity*=.35;
   
   states.set(p.key,{visible:visible.has(p.key),opacity,role,label:label.has(p.key)});
  }
  return {nodes:states,visible,primary,related,labels:label,memoryKeys:memories,hiddenCount,hint};
 }
}
