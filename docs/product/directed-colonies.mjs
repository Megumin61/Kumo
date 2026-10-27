import {hashSeed} from './garden-life.mjs';

// Each theme owns an angular sector. Children stay beyond its root and grow upward.
export function upwardMemberOffsets(hub,members,R){
 const topics=members.filter(p=>p.record?.kind==='topic'),placed=new Map(),squash=.8;
 const clear=(p,o)=>Math.hypot(...o)>=(hub.size+p.size)/2+22&&[...placed].every(([key,q])=>{const other=members.find(m=>m.key===key);return Math.hypot(o[0]-q[0],o[1]-q[1])>=(p.size+other.size)/2+13;});
 const minAngle=-Math.PI+.25,span=Math.PI-.5,weights=topics.map(t=>Math.max(1,Math.sqrt(members.filter(p=>p.clusterTopic===t.key).length))),total=weights.reduce((a,b)=>a+b,0)||1;
 const sectors=new Map();let edge=minAngle;
 topics.forEach((t,i)=>{const width=span*weights[i]/total,angle=edge+width/2;sectors.set(t.key,{min:edge+.035,max:edge+width-.035,angle});edge+=width;});
 let topicR=hub.size/2+100;
 for(const t of topics){const a=sectors.get(t.key).angle;topicR=Math.max(topicR,((hub.size+t.size)/2+23)/Math.hypot(Math.cos(a),Math.sin(a)*squash));for(const q of topics){if(t===q)continue;const b=sectors.get(q.key).angle,d=Math.hypot(Math.cos(a)-Math.cos(b),squash*(Math.sin(a)-Math.sin(b)));topicR=Math.max(topicR,((t.size+q.size)/2+14)/d);}}
 topics.forEach(t=>{const angle=sectors.get(t.key).angle,o=[Math.cos(angle)*topicR,Math.sin(angle)*topicR*squash];if(topicR+t.size/squash/2+12>R||!clear(t,o))throw Error('More room required for upward topics');placed.set(t.key,o);});
 for(const p of members.filter(p=>p.record?.kind!=='topic')){const sector=sectors.get(p.clusterTopic),parent=placed.get(p.clusterTopic),lo=sector?.min??minAngle,hi=sector?.max??minAngle+span,base=sector?.angle??lo+hashSeed(p.key)*(hi-lo);let found;
  for(let row=0;row<12&&!found;row++){const radius=(sector?topicR:Math.max(hub.size/2+120,topicR))+(sector?112:0)+row*48;if(radius+p.size/squash/2+12>R)break;const angles=[base,...Array.from({length:21},(_,i)=>lo+(hi-lo)*(i+.5)/21)].sort((a,b)=>Math.abs(a-base)-Math.abs(b-base));
   for(const angle of angles){const o=[Math.cos(angle)*radius,Math.sin(angle)*radius*squash];if(parent&&o[1]>parent[1]-18)continue;if(clear(p,o)){found=o;break;}}
  }if(!found)throw Error('More room required for upward posts');placed.set(p.key,found);
 }
 return members.map(p=>placed.get(p.key));
}
export function constrainUpwardGrowth(points,pinned=null){
 for(const kind of ['topic','source'])for(const p of points.values()){if(!p.owner||p.record.kind!==kind||p.key===pinned)continue;const parent=points.get(p.clusterTopic||p.owner);if(parent&&p.y>parent.y-18)p.y=parent.y-18;}
}

// Structural stems are drawn under the artwork, all the way between node centres.
export function centerEndpoints(first,last){return {from:[first.x,first.y],to:[last.x,last.y]};}

export function domainPreview(model,record){
 const members=(record.displayMembers||record.members||[]).map(k=>model.records.get(k)).filter(s=>s?.kind==='source').sort((a,b)=>(Date.parse(b.capturedAt)||0)-(Date.parse(a.capturedAt)||0)),topics=model.topics.filter(t=>t.domainId===record.id&&t.members?.length);
 return {...record,previewLabel:members.length+' 篇收藏 · '+topics.length+' 个主题',previewIntro:record.summary||'',previewSources:members.slice(0,3).map(s=>({key:s.key,title:s.name,record:s}))};
}
