// Growth reflects real library input, never visits or decorative clicks.
const stages=[{at:0,name:'幼苗'},{at:3,name:'生长中'},{at:8,name:'盛开'},{at:20,name:'成林'},{at:50,name:'繁盛'},{at:100,name:'丰茂'}];
export function growthFromCounts(count=0,compiled=0,topics=0){
 const n=Math.max(0,Number(count)||0),index=stages.findLastIndex(s=>n>=s.at),stage=stages[index],next=stages[index+1]?.at??null;
 return {level:index+1,name:stage.name,count:n,compiled:Math.min(n,Math.max(0,compiled)),topics,next,remaining:next===null?0:next-n,progress:next===null?1:(n-stage.at)/(next-stage.at),density:Math.min(.44,.28+Math.log2(n+1)*.026),edgeSprouts:2+index*2+Math.min(3,Math.floor(compiled/8)),complexity:1+index*.12};
}
export function gardenGrowth(model,record=null){
 const members=record?new Set(record.displayMembers||record.members||[]):null,sources=members?model.sources.filter(s=>members.has(s.key)):model.sources;
 const topics=record?model.topics.filter(t=>t.domainId===record.id&&t.members?.length).length:model.topics.filter(t=>t.members?.length).length;
 return growthFromCounts(sources.length,sources.filter(s=>s.card&&!['pending','stale','index_only'].includes(s.status)).length,topics);
}
