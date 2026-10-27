export const viewInfo={
  field:{number:'01 / CLUSTER FIELD',title:'把一个领域放在中心，看收藏如何分布',description:'每个小点是一篇真实收藏，实线表示编译归属；中心领域展开，其他领域保留为卫星群落。待编译资料独立呈现。'},
  converge:{number:'02 / RADIAL CONVERGENCE',title:'从一圈材料，汇聚到已有的知识领域',description:'外圈每点一篇收藏，曲线追踪已有归属；待编译节点仅表示状态。编号对应原件，不是评分或相似度。'},
  network:{number:'03 / KNOWLEDGE NETWORK',title:'只让有依据的联系，成为知识之间的连线',description:'细线是归属，橄榄实线是双端证据联系，麦金虚线是领域汇总。点击材料读摘要，点击连线读双方依据。'}
};
export const typeNames={supports:'支持',contradicts:'分歧',example:'案例',prerequisite:'前置',complements:'互补'};
export const statusNames={pending:'待编译',stale:'来源变化 · 待重编译',index_only:'仅建索引',limited:'已编译 · 有限证据',verified:'已编译'};
export function settleNetwork(points,edges,pinned=null){
  const particles=[...points.values()].map(point=>({...point,position:[...point.position],anchor:[...point.position],velocity:[0,0],force:[0,0]})),lookup=new Map(particles.map(point=>[point.key,point]));
  const iterations=particles.length<150?96:Math.max(12,Math.floor(9000/particles.length));
  for(let step=0;step<iterations;step++){
    for(const point of particles)point.force=[(point.anchor[0]-point.position[0])*(point.radius>15?.025:.004),(point.anchor[1]-point.position[1])*(point.radius>15?.025:.004)];
    for(let firstIndex=0;firstIndex<particles.length;firstIndex++)for(let secondIndex=firstIndex+1;secondIndex<particles.length;secondIndex++){
      const first=particles[firstIndex],second=particles[secondIndex],delta=[second.position[0]-first.position[0],second.position[1]-first.position[1]],distance=Math.max(1,Math.hypot(...delta));
      const repulsion=(first.radius+second.radius+12)*22/Math.max(120,distance*distance);
      for(let axis=0;axis<2;axis++){const force=delta[axis]/distance*repulsion;first.force[axis]-=force;second.force[axis]+=force;}
    }
    for(const edge of edges){const first=lookup.get(edge.from),second=lookup.get(edge.to);if(!first||!second)continue;const delta=second.position.map((value,index)=>value-first.position[index]),distance=Math.max(1,Math.hypot(...delta));
      const target=edge.kind==='membership'?65+first.radius:edge.kind==='backbone'?215:150,strength=edge.kind==='membership'?.009:edge.kind==='backbone'?.002:.0015;
      for(let axis=0;axis<2;axis++){const force=delta[axis]/distance*(distance-target)*strength;first.force[axis]+=force;second.force[axis]-=force;}
    }
    for(const point of particles){if(point.key===pinned)continue;for(let axis=0;axis<2;axis++){point.velocity[axis]=(point.velocity[axis]+point.force[axis])*.76;point.position[axis]+=Math.max(-4,Math.min(4,point.velocity[axis]));point.position[axis]=Math.max(35,Math.min(axis===0?925:605,point.position[axis]));}}
  }
  return new Map(particles.map(point=>[point.key,{key:point.key,position:point.position,radius:point.radius}]));
}
export const polar=(center,radius,angle)=>[center[0]+radius*Math.cos(angle*Math.PI/180),center[1]+radius*Math.sin(angle*Math.PI/180)];
const hash=value=>{let result=2166136261;for(const character of value)result=Math.imul(result^character.charCodeAt(0),16777619);return (result>>>0)/4294967295;};
export function displayTitle(item){
  const raw=String(item.displayTitle||item.title||'').trim();if(!/^(x|twitter)$/i.test(item.platform||''))return raw||'未命名内容';
  const cleaned=raw.replace(/^.*?\s+on\s+X:\s*["“]?/i,'').replace(/["”]\s*$/,'').replace(/\s*\/?\s*[|–—-]?\s*(?:on X|\/ X)$/i,'').replace(/["”]\s*$/,'');
  const text=(cleaned||String(item.excerpt||item.content||'')).replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim(),characters=Array.from(text);
  return characters.length>52?characters.slice(0,52).join('').trimEnd()+'…':text||'X 帖子';
}
export function buildModel(payload){
  if(!Array.isArray(payload.sources)||!Array.isArray(payload.nodes)||!Array.isArray(payload.cards))throw Error('知识接口缺少必要字段');
  const sourceIds=new Set(payload.sources.map(source=>source.id));if(sourceIds.size!==payload.sources.length||payload.total!==sourceIds.size)throw Error('收藏计数不一致，请刷新重试');
  const domainNodes=payload.nodes.filter(node=>node.kind==='domain'),domainMap=new Map(domainNodes.map(node=>[node.id,node]));
  const cards=new Map(payload.cards.filter(card=>!card.stale&&sourceIds.has(card.id)).map(card=>[card.id,card]));
  const staleIds=new Set(payload.cards.filter(card=>card.stale).map(card=>card.id));
  const descendantOf=(child,ancestor)=>{const visited=new Set();let current=child;while(current&&!visited.has(current)){if(current===ancestor)return true;visited.add(current);current=domainMap.get(current)?.parentDomainId;}return false;};
  const leafAssignments=card=>(card?.domainIds||[]).filter(id=>domainMap.has(id)&&!(card.domainIds||[]).some(other=>other!==id&&descendantOf(other,id)));
  const usedIds=new Set([...cards.values()].flatMap(leafAssignments));
  const groups=domainNodes.filter(node=>usedIds.has(node.id)).map(node=>({...node,key:'domain:'+node.id,kind:'domain',summary:node.summaryNeedsReview?'来源已有变化，领域内容待重新核验。':node.summary||node.scope||'',knowledge:node.summaryNeedsReview?null:node.knowledge,keywords:(node.keywords||[]).slice(0,3),members:[],displayMembers:[]}));
  const pending={id:'pending',key:'pending',kind:'pending',name:'待编译',summary:'已收藏但尚无新鲜编译卡的材料。保留真实帖子和人工标签，不根据标签猜测知识归属。',keywords:[],members:[],displayMembers:[]};
  const unassigned={...pending,id:'unassigned',key:'unassigned',kind:'unassigned',name:'已编译未归域',members:[],displayMembers:[],summary:'已有编译卡，但没有可用的领域归属。'};
  const groupMap=new Map([...groups,pending,unassigned].map(group=>[group.key,group]));
  const sources=payload.sources.map((source,index)=>{
    const card=cards.get(source.id),assignments=leafAssignments(card).map(id=>'domain:'+id);
    const primary=card?(assignments[0]||'unassigned'):'pending';
    const status=card?(card.evidenceStatus==='index_only'?'index_only':card.evidenceStatus==='limited'?'limited':'verified'):staleIds.has(source.id)?'stale':'pending';
    const record={...source,key:'source:'+source.id,kind:'source',name:displayTitle(source),number:String(index+1).padStart(2,'0'),status,card,primary,memberships:card?(assignments.length?assignments:['unassigned']):['pending'],keywords:card?(card.keywords||[]).slice(0,3):[],summary:card?.summary||'这篇内容已收藏，尚未生成新鲜摘要。请先阅读原件，不把它当作已经编译的知识。'};
    for(const groupId of record.memberships)groupMap.get(groupId).members.push(record.key);
    groupMap.get(primary).displayMembers.push(record.key);return record;
  });
  const activeGroups=[...groups,pending,unassigned].filter(group=>group.members.length).sort((first,second)=>second.displayMembers.length-first.displayMembers.length||first.id.localeCompare(second.id));
  for(const group of activeGroups){group.count=group.members.length;group.displayCount=group.displayMembers.length;}
  const records=new Map([...activeGroups,...sources].map(record=>[record.key,record]));
  for(const domain of domainNodes){const key='domain:'+domain.id;if(!records.has(key)){
    const members=sources.filter(source=>source.card?.domainIds?.some(id=>descendantOf(id,domain.id))).map(source=>source.key);
    records.set(key,{...domain,key,members,count:members.length,keywords:(domain.keywords||[]).slice(0,3),knowledge:domain.summaryNeedsReview?null:domain.knowledge,summary:domain.summaryNeedsReview?'来源已变化，领域知识待重新核验。':domain.summary||''});
  }}
  const relations=(payload.relations||[]).filter(relation=>{
    const first=cards.get(relation.from),second=cards.get(relation.to);
    return first&&second&&relation.from!==relation.to&&first.evidenceStatus!=='index_only'&&second.evidenceStatus!=='index_only'&&relation.fromQuote?.trim()&&relation.toQuote?.trim()&&relation.reason?.trim();
  }).map(relation=>({...relation,key:'relation:'+relation.from+':'+relation.to+':'+relation.type,from:'source:'+relation.from,to:'source:'+relation.to}));
  const bundleMap=new Map();
  for(const relation of relations)for(const from of records.get(relation.from).memberships)for(const to of records.get(relation.to).memberships){
    if(from===to)continue;const ends=[from,to].sort(),key='bundle:'+ends.join('--');
    if(!bundleMap.has(key))bundleMap.set(key,{key,from:ends[0],to:ends[1],kind:'bundle',relations:[],keywords:[]});
    const bundle=bundleMap.get(key);if(!bundle.relations.some(item=>item.key===relation.key))bundle.relations.push(relation);
  }
  const bundles=[...bundleMap.values()];for(const bundle of bundles){bundle.name=records.get(bundle.from).name+' ↔ '+records.get(bundle.to).name;bundle.summary='已有 '+bundle.relations.length+' 条来源级证据关系汇聚于这两个领域。领域归属本身不自动等于知识联系。';records.set(bundle.key,bundle);}
  const topicNodes=payload.nodes.filter(node=>node.kind==='topic'),topicMap=new Map(topicNodes.map(node=>[node.id,node]));
  const topicContains=(child,ancestor)=>{const visited=new Set();let current=child;while(current&&!visited.has(current)){if(current===ancestor)return true;visited.add(current);current=topicMap.get(current)?.parentTopicId;}return false;};
  const topics=topicNodes.map(node=>({...node,key:'topic:'+node.id,knowledge:node.summaryNeedsReview?null:node.knowledge,summary:node.summaryNeedsReview?'来源已变化，主题知识待重新核验。':node.summary||'',keywords:(node.keywords||[]).slice(0,3),members:sources.filter(source=>source.card?.topicIds?.some(id=>topicContains(id,node.id))).map(source=>source.key)}));
  for(const topic of topics)records.set(topic.key,topic);
  for(const relation of relations)records.set(relation.key,{...relation,kind:'relation',name:(typeNames[relation.type]||relation.type)+' · 知识联系',summary:relation.reason,keywords:[]});
  const totals={total:sources.length,compiled:cards.size,pending:sources.length-cards.size,indexOnly:sources.filter(source=>source.status==='index_only').length,relations:relations.length,domains:groups.length,domainTotal:domainNodes.length,topics:topics.length,revision:payload.revision};
  return {sources,groups:activeGroups,records,relations,bundles,topics,totals,cards,defaultFocus:activeGroups.find(group=>group.kind==='domain')?.key||activeGroups[0]?.key||null,descendantOf};
}
export function relatedKeys(model,key,mode){
  const record=model.records.get(key),result=new Set([key]);if(!record)return result;
  if(record.kind==='relation')return new Set([key,record.from,record.to,...model.records.get(record.from).memberships,...model.records.get(record.to).memberships]);
  if(record.kind==='bundle')return new Set([key,record.from,record.to,...record.relations.flatMap(relation=>[relation.from,relation.to])]);
  if(record.kind==='source'){for(const group of record.memberships)result.add(group);if(mode==='network')for(const relation of model.relations){if(relation.from===key)result.add(relation.to);if(relation.to===key)result.add(relation.from);}}
  else{for(const source of record.members){result.add(source);for(const group of model.records.get(source).memberships)result.add(group);}if(mode==='network')for(const relation of model.relations){if(record.members.includes(relation.from)||record.members.includes(relation.to)){result.add(relation.from);result.add(relation.to);for(const group of [...model.records.get(relation.from).memberships,...model.records.get(relation.to).memberships])result.add(group);}}}
  return result;
}
export function makeLayout(model,mode,focus=model.defaultFocus){
  if(!viewInfo[mode])throw Error('未知视图');
  const points=new Map(),labels=[],edges=[],guides=[];
  const put=(key,position,radius)=>points.set(key,{key,position,radius});
  const add=(from,to,kind,extra={})=>edges.push({key:kind+':'+from+'--'+to+(extra.relation?':'+extra.relation.key:''),from,to,kind,...extra});
  if(mode==='field'){
    const main=model.groups.find(group=>group.key===focus)||model.groups[0],others=model.groups.filter(group=>group!==main);
    const center=[345,300];if(main)put(main.key,center,Math.min(48,22+Math.sqrt(main.count)*3));
    const slots=[[100,120],[720,115],[820,295],[705,505],[185,510],[95,350],[555,90],[490,540],[805,420]];
    others.forEach((group,index)=>put(group.key,slots[index%slots.length],Math.min(28,14+Math.sqrt(group.count)*2.5)));
    for(const group of model.groups){
      const origin=points.get(group.key).position,isMain=group===main,count=group.displayMembers.length;
      group.displayMembers.forEach((key,index)=>{
        const angle=index*137.508+hash(group.key)*360,radius=(isMain?42:18)+Math.sqrt((index+.6)/Math.max(1,count))*(isMain?135:45);
        const evidenceCount=stateEvidenceCount(model,key);put(key,polar(origin,radius,angle),isMain?3.3+Math.min(1.8,Math.sqrt(evidenceCount)*.7):2.5+Math.min(.9,Math.sqrt(evidenceCount)*.35));
      });
      const offset=isMain?205:85;labels.push({key:group.key,text:group.name+' · '+group.count,x:origin[0],y:Math.min(595,origin[1]+offset),kind:'domain',anchor:'middle'});
    }
  }else if(mode==='converge'){
    const center=[450,300],radius=210,total=Math.max(1,model.sources.length);let cursor=0;
    for(const group of model.groups){
      const mid=-90+(cursor+group.displayCount/2)/total*360;
      put(group.key,polar(center,82,mid),Math.min(28,12+Math.sqrt(group.count)*1.6));
      const label=polar(center,285,mid);labels.push({key:group.key,text:group.name+' · '+group.count,x:label[0],y:label[1],kind:'domain',anchor:label[0]<390?'end':label[0]>510?'start':'middle'});
      group.displayMembers.forEach((key,index)=>{
        const angle=-90+(cursor+index)/total*360;put(key,polar(center,radius,angle),3.2);
        const position=polar(center,radius+15,angle),flip=angle>90&&angle<270;
        labels.push({key,text:model.records.get(key).number,x:position[0],y:position[1],angle:flip?angle+180:angle,anchor:flip?'end':'start',kind:'code'});
      });cursor+=group.displayCount;
      guides.push({from:points.get(group.key).position,to:polar(center,258,mid)});
    }
  }else{
    const centers=[[315,240],[610,220],[625,445],[325,465],[140,340],[490,335],[420,100],[795,420],[785,135]];
    model.groups.forEach((group,index)=>{
      const center=centers[index%centers.length];put(group.key,center,Math.min(40,19+Math.sqrt(group.count)*3.2));
      group.displayMembers.forEach((key,sourceIndex)=>{
        const angle=sourceIndex*137.508+index*41,radius=48+Math.sqrt((sourceIndex+1)/Math.max(1,group.displayCount))*64;
        const degree=model.relations.filter(relation=>relation.from===key||relation.to===key).length;put(key,polar(center,radius,angle),3.4+Math.sqrt(degree)*1.5);
      });
      labels.push({key:group.key,text:group.name,x:center[0],y:center[1]+points.get(group.key).radius+22,kind:'domain',anchor:'middle'});
      labels.push({key:group.key,text:String(group.count)+' 篇',x:center[0],y:center[1]+points.get(group.key).radius+47,kind:'count',anchor:'middle'});
    });
  }
  for(const source of model.sources)for(const group of source.memberships)add(group,source.key,'membership',{secondary:group!==source.primary});
  if(mode!=='converge'){
    if(mode==='network')for(const relation of model.relations)add(relation.from,relation.to,'evidence',{relation});
    for(const bundle of model.bundles)add(bundle.from,bundle.to,mode==='network'?'backbone':'bundle',{relations:bundle.relations,bundleKey:bundle.key});
  }
  if(mode==='network'){
    const settled=settleNetwork(points,edges);for(const label of labels){const before=points.get(label.key),after=settled.get(label.key);if(before&&after){label.x+=after.position[0]-before.position[0];label.y+=after.position[1]-before.position[1];}}return {points:settled,labels,edges,guides};
  }
  return {points,labels,edges,guides};
}
export function edgePath(edge,points,mode){
  const first=points.get(edge.from)?.position,last=points.get(edge.to)?.position;if(!first||!last)return '';
  if(mode==='converge'){const center=[450,300];return `M${last.join(' ')} C${center[0]+(last[0]-center[0])*.42} ${center[1]+(last[1]-center[1])*.42} ${center[0]+(first[0]-center[0])*.3} ${center[1]+(first[1]-center[1])*.3} ${first.join(' ')}`;}
  if(edge.kind==='bundle'||edge.kind==='backbone')return `M${first.join(' ')} Q${(first[0]+last[0])/2} ${(first[1]+last[1])/2-35} ${last.join(' ')}`;
  return `M${first.join(' ')} L${last.join(' ')}`;
}
function stateEvidenceCount(model,key){return model.records.get(key).card?.evidence?.length||0;}
