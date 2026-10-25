export function gardenInsights(model){
  const linked=new Set(model.relations.flatMap(relation=>[relation.from,relation.to]));
  const metrics=new Map(model.groups.map(group=>{const internal=model.relations.filter(r=>model.records.get(r.from).primary===group.key&&model.records.get(r.to).primary===group.key),cross=model.relations.filter(r=>model.records.get(r.from).primary!==model.records.get(r.to).primary&&(model.records.get(r.from).primary===group.key||model.records.get(r.to).primary===group.key)),pairs=new Set(internal.map(r=>[r.from,r.to].sort().join('|'))),count=group.displayMembers.length;return [group.key,{count,topics:model.topics.filter(t=>t.domainId===group.id&&t.members.length).length,internal:internal.length,cross:cross.length,linkedPairs:pairs.size,possiblePairs:count*(count-1)/2,radius:42+Math.sqrt(count)*18}];}));
  const bridges=new Map();
  for(const relation of model.relations){const from=model.records.get(relation.from).primary,to=model.records.get(relation.to).primary;if(from===to)continue;const ends=[from,to].sort(),key='garden-bridge:'+ends.join('--');if(!bridges.has(key))bridges.set(key,{key,kind:'bundle',from:ends[0],to:ends[1],relations:[],keywords:[],name:model.records.get(ends[0]).name+' ↔ '+model.records.get(ends[1]).name});bridges.get(key).relations.push(relation);}
  for(const bridge of bridges.values())bridge.summary=bridge.relations.length+' 条已有材料联系连接这两片花圃；按每篇材料的主归属统计。';
  const needsReading=model.sources.filter(s=>!s.card||['pending','stale','index_only'].includes(s.status)),unlinked=model.sources.filter(s=>s.card&&!['pending','stale','index_only'].includes(s.status)&&!linked.has(s.key));
  return {metrics,bridges:[...bridges.values()],linked,needsReading,unlinked};
}
export function terminalSources(model,items){return items.length&&items.every(item=>item.kind==='source')?items:[];}
