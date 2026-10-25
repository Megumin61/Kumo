export const ROOT='kumo:root';
export const palette={product:{fill:'#9eaf82',line:'#8c9d72',soft:'#dce4cf'},tools:{fill:'#c3bd7c',line:'#aba35d',soft:'#eee6bb'},career:{fill:'#aab89b',line:'#95a580',soft:'#e2e7d9'},neutral:{fill:'#b5bea6',line:'#9eaa8d',soft:'#e8ebdf'}};
export const countOf=record=>record?.count??record?.members?.length??0;
export function roots(model){return [...model.records.values()].filter(record=>record.kind==='domain'&&!record.parentDomainId||['pending','unassigned'].includes(record.kind)&&countOf(record)>0).sort((first,second)=>countOf(second)-countOf(first));}
export function pathTo(model,key){const path=[],seen=new Set();let record=model.records.get(key);if(record?.kind==='source')record=model.records.get(record.primary);while(record&&!seen.has(record.key)&&record.key!==ROOT){seen.add(record.key);path.unshift(record.key);record=model.records.get(record.parentTopicId?'topic:'+record.parentTopicId:record.kind==='topic'?'domain:'+record.domainId:record.parentDomainId?'domain:'+record.parentDomainId:null);}return path;}
export function children(model,key){
  if(key===ROOT)return roots(model);
  const record=model.records.get(key);if(!record)return [];
  let branches=[];
  if(record.kind==='domain'){branches=[...model.records.values()].filter(item=>item.kind==='domain'&&item.parentDomainId===record.id);if(!branches.length)branches=model.topics.filter(item=>item.domainId===record.id&&!item.parentTopicId&&item.members.length);}
  if(record.kind==='topic')branches=model.topics.filter(item=>item.parentTopicId===record.id&&item.members.length);
  branches.sort((first,second)=>countOf(second)-countOf(first));
  const covered=new Set(branches.flatMap(branch=>branch.members||[])),direct=(record.members||[]).filter(key=>!covered.has(key)).map(key=>model.records.get(key)).filter(Boolean);
  return [...branches,...direct];
}
export function ownerFor(model,key){return [...model.records.values()].filter(record=>['domain','topic','pending','unassigned'].includes(record.kind)&&record.members?.includes(key)&&children(model,record.key).some(child=>child.key===key)).sort((first,second)=>pathTo(model,second.key).length-pathTo(model,first.key).length)[0];}
export const pageSize=items=>items.some(item=>item.kind!=='source')?3:4;
export function branchPage(model,path=[],page=0){const normalized=path.length?pathTo(model,path.at(-1)):[],current=normalized.at(-1)||ROOT,items=current===ROOT?[]:children(model,current),limit=pageSize(items),offset=Math.max(0,Math.min(Math.floor(page/limit)*limit,Math.max(0,Math.floor((items.length-1)/limit)*limit)));return {path:normalized,current,page:offset,limit,total:items.length,items:items.slice(offset,offset+limit)};}
export function brandRecord(model){return {key:ROOT,kind:'brand',name:'Kumo',members:model.sources.map(source=>source.key),count:model.sources.length,keywords:[],summary:''};}
export function family(model,record){const key=record?.kind==='source'?record.primary:record?.key,root=pathTo(model,key)[0];return root==='domain:ai-creation-tools'?'tools':root==='domain:career-context'?'career':root?'product':'neutral';}
export function nodeSize(record,mode='network'){
  if(record.kind==='brand')return 54;
  if(record.kind==='source')return mode==='field'?24:30;
  if(record.kind==='lens')return 38;
  const count=Math.max(1,countOf(record));
  if(record.kind==='topic')return Math.min(72,20+12*Math.sqrt(count));
  return Math.min(mode==='field'?168:140,24+26*Math.sqrt(count));
}
export function countLabel(record,metric=countOf(record)){return ['source','brand'].includes(record.kind)||metric<1||record.kind==='topic'&&metric===1?'':String(metric);}
export function nodeTypography(record,size){return {count:Math.max(9,Math.min(25,Math.round(size*.21))),stroke:Math.max(1.1,Math.min(2.4,size*.018)),name:Math.max(12,Math.min(16,12+size*.025))};}
export const identity=value=>Array.from(String(value)).reduce((result,character)=>(Math.imul(result,31)+character.charCodeAt(0))>>>0,7);
export function appearance(model,record){const colors=palette[family(model,record)],depth=pathTo(model,record.key).length;return {...colors,depth,fill:depth===1?colors.fill:depth===2?colors.soft:'#f1eed8',ink:depth===1?'#344b31':depth===2?'#536545':'#776842'};}
export function outline(radius,theme='petal',level='domain',variant=0){
  const points=[],lobes=level==='topic'?3:level==='main'?6:5;
  for(let index=0;index<60;index++){const angle=index/60*Math.PI*2,phase=(variant%13)*.41,profile=theme==='seed'?.88+.07*Math.cos(angle*(variant%2?3:4)+phase)+.04*Math.sin(angle*2+phase):.84+.15*Math.cos(lobes*angle-Math.PI/2);points.push([Math.cos(angle)*radius*profile*(theme==='seed'&&variant%3===1?1.05:1),Math.sin(angle)*radius*profile*(theme==='seed'&&variant%3===1?.86:1)]);}
  const mid=(first,second)=>first.map((value,index)=>(value+second[index])/2),format=point=>point.map(value=>value.toFixed(2)).join(' ');let path='M '+format(mid(points.at(-1),points[0]));
  for(let index=0;index<points.length;index++)path+=' Q '+format(points[index])+' '+format(mid(points[index],points[(index+1)%points.length]));return path+' Z';
}
export function glyph(model,record,theme='petal'){const colors=appearance(model,record),level=record.kind==='topic'?'topic':record.parentDomainId?'domain':'main',radius=48;return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-52 -52 104 104"><defs><linearGradient id="wash" x2=".8" y2="1"><stop stop-color="'+colors.soft+'"/><stop offset="1" stop-color="'+colors.fill+'"/></linearGradient></defs><path d="'+outline(radius,theme,level,identity(record.key))+'" fill="url(#wash)" stroke="'+colors.line+'" stroke-width="1.1"/>'+(theme==='petal'?'<path d="'+outline(35,'petal',level)+'" fill="none" stroke="'+colors.line+'" opacity=".3"/><circle r="22" fill="#fafbf5"/>':'')+'</svg>';}
export function aggregateRelations(model,records){
  const visible=new Map(records.map(record=>[record.key,record])),bundles=new Map(),resolve=source=>{if(visible.has(source))return source;return records.filter(record=>record.kind!=='brand'&&record.members?.includes(source)).sort((first,second)=>pathTo(model,second.key).length-pathTo(model,first.key).length)[0]?.key;};
  for(const relation of model.relations){const from=resolve(relation.from),to=resolve(relation.to);if(!from||!to||from===to)continue;const ends=[from,to].sort(),key='visible:'+ends.join('--');if(!bundles.has(key))bundles.set(key,{key,kind:'bundle',from:ends[0],to:ends[1],relations:[],keywords:[]});const bundle=bundles.get(key);if(!bundle.relations.some(item=>item.key===relation.key))bundle.relations.push(relation);}
  for(const bundle of bundles.values()){bundle.name=visible.get(bundle.from).name+' ↔ '+visible.get(bundle.to).name;bundle.summary=bundle.relations.length+' 条已有双端证据，展开可读双方材料及联系理由。';}return [...bundles.values()];
}

