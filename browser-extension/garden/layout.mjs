import {ROOT,roots,branchPage,nodeSize,aggregateRelations,children} from './schema.mjs';
import {gardenInsights} from './garden-insights.mjs';
import {placePreviews} from './preview-layout.mjs';
import {separate} from './spacing.mjs';
import {habitats} from './habitats.mjs';
export function rectangles(point){if(point.preview)return [{left:point.x-point.cardWidth/2-8,right:point.x+point.cardWidth/2+8,top:point.y-point.cardHeight/2-8,bottom:point.y+point.cardHeight/2+8}];const radius=point.size/2;return [{left:point.x-radius-6,right:point.x+radius+6,top:point.y-radius-6,bottom:point.y+radius+6},...(['source'].includes(point.record.kind)?[]:[{left:point.x-80,right:point.x+80,top:point.y+radius+5,bottom:point.y+radius+48}])];}
export function overlaps(first,second){return rectangles(first).some(own=>rectangles(second).some(other=>Math.min(own.right,other.right)>Math.max(own.left,other.left)&&Math.min(own.bottom,other.bottom)>Math.max(own.top,other.top)));}
function nearby(record,parent,angle,index,total,occupied){
  const size=nodeSize(record),span=total>3?2.5:2.12,base=angle+(index-(total-1)/2)*span/Math.max(1,total-1),distance=record.kind==='source'?100:130,candidates=[];
  for(let ring=0;ring<7;ring++)for(const turn of [0,.16,-.16,.32,-.32,.5,-.5]){const direction=base+turn,radius=distance+ring*13,point={record,size,x:parent.x+Math.cos(direction)*radius,y:parent.y+Math.sin(direction)*radius};let score=ring*8+Math.abs(turn)*14;for(const other of occupied)if(overlaps(point,other))score+=1000;candidates.push({point,score});if(score<1)return point;}
  return candidates.sort((first,second)=>first.score-second.score)[0].point;
}
export function knowledgeLayout(model,{path=[],page=0,width=830,height=450,positions=new Map()}={}){
  const metadata=branchPage(model,path,page),points=new Map(),edges=[],center=[width*.48,height*.46];
  function put(record,position,parent){const saved=positions.get(record.key),size=nodeSize(record);points.set(record.key,{key:record.key,record,size,x:saved?.[0]??position[0],y:saved?.[1]??position[1],parent});if(parent)edges.push({key:'hierarchy:'+record.key,from:parent,to:record.key,kind:'hierarchy'});}
  put(model.records.get(ROOT),center);roots(model).forEach((record,index)=>{const angle=(roots(model).length===3?[ -55,185,75 ][index]:-60+index*360/roots(model).length)*Math.PI/180;put(record,[center[0]+Math.cos(angle)*Math.max(68,Math.min(160,(width-158)/2,(height-140)/2)),center[1]+Math.sin(angle)*Math.max(68,Math.min(160,(width-158)/2,(height-140)/2))],ROOT);});
  function add(record,parent,index,total){if(points.has(record.key))return;const origin=points.get(parent),grandparent=points.get(origin.parent)||points.get(ROOT),angle=Math.atan2(origin.y-grandparent.y,origin.x-grandparent.x),saved=positions.get(record.key);let point=saved&&Math.hypot(saved[0]-origin.x,saved[1]-origin.y)<226?{record,size:nodeSize(record),x:saved[0],y:saved[1]}:null;if(!point||[...points.values()].some(other=>overlaps(point,other)))point=nearby(record,origin,angle,index,total,[...points.values()]);put(record,[point.x,point.y],parent);points.set(record.key,{...points.get(record.key),x:point.x,y:point.y});}
  for(let depth=1;depth<metadata.path.length;depth++)add(model.records.get(metadata.path[depth]),metadata.path[depth-1],1,3);
  metadata.items.forEach((record,index)=>add(record,metadata.current,index,metadata.items.length));
  placePreviews(points,metadata,width,positions);
  separate(points,new Set([metadata.current]));
  const focus=new Set([metadata.current,...metadata.items.map(record=>record.key)]),bundles=aggregateRelations(model,[...points.values()].map(point=>point.record)).filter(bundle=>metadata.path.length>1?focus.has(bundle.from)&&focus.has(bundle.to):!metadata.path.length||focus.has(bundle.from)||focus.has(bundle.to));
  for(const bundle of bundles)edges.push({key:bundle.key,from:bundle.from,to:bundle.to,kind:'relation',record:bundle});
  return {points,edges,bundles,navigation:metadata,guides:[]};
}
export function branchKeys(points,key){const result=new Set([key]);let changed=true;while(changed){changed=false;for(const point of points.values())if(result.has(point.parent)&&!result.has(point.key)){result.add(point.key);changed=true;}}return result;}
export function moveBranch(points,key,delta){const selected=branchKeys(points,key),result=new Map([...points].map(([id,point])=>[id,{...point}]));for(const id of selected){const point=result.get(id);if(point){point.x+=delta[0];point.y+=delta[1];}}return result;}
export function moveOnly(points,key,delta){const result=new Map([...points].map(([id,point])=>[id,{...point}])),point=result.get(key);if(point){point.x+=delta[0];point.y+=delta[1];}return result;}
export function descendantKeys(model,key){const result=new Set(),pending=[key];while(pending.length){const current=pending.pop();for(const record of children(model,current))if(!result.has(record.key)){result.add(record.key);pending.push(record.key);}}return result;}
export const clusterColumns=width=>width>=760?4:width>=540?3:2;
export function clusterLayout(model,{width=830,height=450,positions=new Map(),showRelations=true}={}){
  const points=new Map(),edges=[],groups=model.groups,organic=habitats(model,width,height,positions);
  for(const [groupIndex,group]of groups.entries()){
    const slot=organic.coords.get(group.key),saved=positions.get(group.key),hub={key:group.key,record:group,size:nodeSize({...group,count:group.displayCount},'field'),x:saved?.[0]??slot.x,y:saved?.[1]??slot.y};points.set(group.key,hub);
    const topics=model.topics.filter(topic=>topic.domainId===group.id&&topic.members.length),records=[...topics,...group.displayMembers.map(key=>model.records.get(key))],phase=groupIndex*.71;
    records.forEach((record,index)=>{const angle=phase+index*2.399963,minimum=hub.size/2+12,spread=12+Math.sqrt(records.length)*3,radius=minimum+Math.sqrt((index+.5)/Math.max(1,records.length))*spread,offset=[Math.cos(angle)*radius,Math.sin(angle)*radius];if(Math.abs(offset[0])<86&&offset[1]>hub.size/2+2&&offset[1]<hub.size/2+66)offset[0]=(index%2?1:-1)*(88+(index%2)*4);const cached=positions.get(record.key),point={key:record.key,record,size:nodeSize(record,'field'),owner:group.key,parent:group.key,offset:[...offset],x:cached?.[0]??hub.x+offset[0],y:cached?.[1]??hub.y+offset[1],vx:0,vy:0};if(cached)point.offset=[cached[0]-hub.x,cached[1]-hub.y];points.set(record.key,point);edges.push({key:'membership:'+record.key,from:group.key,to:record.key,kind:'membership'});});
  }
  const insights=gardenInsights(model),bundles=showRelations?insights.bridges:[];for(const bundle of bundles)edges.push({key:bundle.key,from:bundle.from,to:bundle.to,kind:'relation',record:bundle});
  if(showRelations)for(const relation of model.relations)if(points.has(relation.from)&&points.has(relation.to))edges.push({key:relation.key,from:relation.from,to:relation.to,kind:model.records.get(relation.from).primary===model.records.get(relation.to).primary?'internal-relation':'source-relation',relation});
  return {points,edges,bundles,metrics:insights.metrics,guides:showRelations?organic.components:[],navigation:null};
}
export function stepCluster(points,pinned=null){
  let energy=0;for(const point of points.values()){if(!point.owner||point.key===pinned)continue;const owner=points.get(point.owner),target=[owner.x+point.offset[0],owner.y+point.offset[1]],force=[(target[0]-point.x)*.18,(target[1]-point.y)*.18];for(const other of points.values()){if(other===point||other.owner!==point.owner)continue;const delta=[point.x-other.x,point.y-other.y],distance=Math.hypot(...delta)||1,separation=(point.size+other.size)/2+4;if(distance<separation)for(let axis=0;axis<2;axis++)force[axis]+=delta[axis]/distance*(separation-distance)*.15;}point.vx=(point.vx+force[0])*.81;point.vy=(point.vy+force[1])*.81;point.x+=point.vx;point.y+=point.vy;energy+=Math.abs(point.vx)+Math.abs(point.vy);}
  return energy;
}
export function convergenceLayout(model,{width=830,height=450,positions=new Map()}={}){
  const points=new Map(),edges=[],lenses=readingLenses(model),center=[width*.45,height*.48];
  points.set(ROOT,{key:ROOT,record:model.records.get(ROOT),size:54,x:positions.get(ROOT)?.[0]??center[0],y:positions.get(ROOT)?.[1]??center[1]});
  lenses.forEach((record,index)=>{model.records.set(record.key,record);const cached=positions.get(record.key);points.set(record.key,{key:record.key,record,size:nodeSize(record),x:cached?.[0]??width*.15,y:cached?.[1]??height*(.18+index*.64/Math.max(1,lenses.length-1)),metric:record.count});});
  [...model.groups].sort((first,second)=>second.displayCount-first.displayCount).forEach((group,index)=>{const cached=positions.get(group.key);points.set(group.key,{key:group.key,record:group,size:nodeSize(group,'converge'),x:cached?.[0]??width*.69,y:cached?.[1]??height*(.09+index*.8/Math.max(1,model.groups.length-1)),metric:group.displayCount});
    for(const lens of lenses){const members=lens.members.filter(key=>group.displayMembers.includes(key));if(!members.length)continue;const key='flow:'+lens.key+':'+group.key,record={key,kind:'flow',name:lens.name+' → '+group.name,members,count:members.length,keywords:[],summary:members.length+' 篇收藏由「'+lens.name+'」进入「'+group.name+'」。这是阅读入口与主归属的对应，不是额外生成的知识关系。'};model.records.set(key,record);edges.push({key,from:lens.key,to:group.key,kind:'provenance',members,flow:record});}
  });
  return {points,edges,bundles:[],guides:[],navigation:null};
}
export function readingLenses(model){
  const linked=new Set(model.relations.flatMap(relation=>[relation.from,relation.to])),definitions=[['compare','联系对照','已有双端证据，可对照阅读双方材料。'],['reuse','用途线索','已有来源卡用途提示，但不在双端联系入口中；用途提示不等于已验证方法。'],['read','摘要阅读','已有新鲜来源卡摘要，尚无用途提示或双端联系。'],['review','等待补全','缺少新鲜来源卡，或处于仅索引、待编译、已过期状态；不能用于确定结论。']],members=new Map(definitions.map(([key])=>[key,[]]));
  for(const source of model.sources){const category=!source.card||['index_only','pending','stale'].includes(source.status)?'review':linked.has(source.key)?'compare':source.card.reuseWhen?.length?'reuse':'read';members.get(category).push(source.key);}
  return definitions.map(([id,name,summary])=>({key:'lens:'+id,kind:'lens',name,summary:summary+' 此视图按“待补全→联系→用途→摘要”的优先规则互斥分组，每篇只出现一次。',members:members.get(id),count:members.get(id).length,keywords:[]})).filter(record=>record.count);
}





