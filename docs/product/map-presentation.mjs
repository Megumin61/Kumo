import {ROOT} from './schema.mjs';
import {typeNames} from './model.mjs';
import {nodeAdornmentMetrics} from './note-presentation.mjs';

export function relationshipLabel(edge){
 const relations=edge.record?.relations||(edge.relation?[edge.relation]:[]),types=[...new Set(relations.map(r=>typeNames[r.type]||r.type||'知识联系'))];
 return types.slice(0,2).join(' / ')+(relations.length>1?' · '+relations.length:'');
}
export function relationshipStates(layout,selected,mode){
 const points=layout.points,selectedEdge=layout.edges.find(e=>e.key===selected),focus=points.get(selected)||points.get(selectedEdge?.from),members=new Set(focus?.record.members||focus?.record.displayMembers||[]);if(focus)members.add(focus.key);
 const shallow=!focus||selected===ROOT,states=new Map(),candidates=[];let structural=0;
 for(const edge of layout.edges){
  if(edge.kind==='hierarchy'){
   const path=new Set([ROOT,...layout.navigation?.path||[],...layout.navigation?.items?.map(r=>r.key)||[]]);
   states.set(edge.key,{visible:true,opacity:shallow||path.has(edge.from)&&path.has(edge.to)?.9:.22,label:false});continue;
  }
  if(edge.kind==='membership'){
   const relevant=!shallow&&(edge.from===selected||edge.to===selected||members.has(edge.to));
   states.set(edge.key,{visible:relevant&&structural++<5,opacity:relevant?.34:0,label:false});continue;
  }
  const relevant=!shallow&&(edge.key===selected||edge.from===selected||edge.to===selected||members.has(edge.from)||members.has(edge.to)||edge.record?.relations?.some(r=>members.has(r.from)||members.has(r.to)));
  const overview=!!edge.record&&shallow;
  candidates.push({edge,relevant,overview,weight:edge.record?.relations?.length||1});
 }
 candidates.sort((a,b)=>Number(b.edge.key===selected)-Number(a.edge.key===selected)||Number(b.relevant)-Number(a.relevant)||b.weight-a.weight||a.edge.key.localeCompare(b.edge.key));
 let shown=0,labelled=0;
 for(const c of candidates){const eligible=c.relevant||c.overview,limit=shallow?3:5,visible=eligible&&shown<limit;if(visible)shown++;const label=visible&&c.relevant&&labelled++<2;states.set(c.edge.key,{visible,opacity:c.relevant?.58:mode==='field'?.3:.24,label});}
 return states;
}

export function relationEndpoints(first,last,{zoom=1,fromBadge=false,toBadge=false}={}){
 function center(p,badge){return badge?[p.x+p.size*.4,p.y+p.size*.36]:[p.x,p.y];}
 const a=center(first,fromBadge),b=center(last,toBadge);
 const end=(p,here,there,badge)=>{const dx=there[0]-here[0],dy=there[1]-here[1],d=Math.hypot(dx,dy)||1,r=badge?nodeAdornmentMetrics(p.size,zoom).badgeRadius/zoom:p.size*.43;return [here[0]+dx/d*r,here[1]+dy/d*r];};
 return {from:end(first,a,b,fromBadge),to:end(last,b,a,toBadge)};
}

export function sceneExploration(entries,{depth=0,requestedKey=null,focusKey=null}={}){
 if(depth>=2)return [];
 const owned=entries.filter(e=>e.owned).sort((a,b)=>Number(b.key===requestedKey)-Number(a.key===requestedKey)||Number(b.targetKey===focusKey)-Number(a.targetKey===focusKey));
 return [...owned.slice(0,depth?2:1),...entries.filter(e=>!e.owned&&e.key===requestedKey).slice(0,1)];
}
export function discoverySize(graph,record){
 const visible=[...graph.points.values()].filter(p=>!p.discovery&&!p.context&&p.record.kind!=='brand'),topics=visible.filter(p=>p.record.kind==='topic'),baseline=topics.length?Math.min(...topics.map(p=>p.size)):Math.min(112,...visible.map(p=>p.size));
 return record.owned?Math.max(48,Math.min(70,baseline*.62)):Math.max(38,Math.min(54,baseline*.48));
}
