// Structural ownership is kept separate from optional knowledge relations.
export function connectEveryMember(graph){
 const edges=[...graph.points.values()].filter(p=>p.owner).map(p=>({key:'membership:'+p.key,from:p.clusterTopic||p.owner,to:p.key,kind:'membership'}));
 return {...graph,edges:[...edges,...graph.edges.filter(e=>e.kind!=='membership')]};
}
export function connectionAudit(graph){
 const incoming=new Map(),invalid=[];for(const e of graph.edges.filter(e=>e.kind==='membership')){if(!graph.points.has(e.from)||!graph.points.has(e.to))invalid.push(e.key);incoming.set(e.to,(incoming.get(e.to)||0)+1);}
 const disconnected=[...graph.points.values()].filter(p=>p.owner&&(incoming.get(p.key)!==1)).map(p=>p.key);return {invalid,disconnected};
}
// A deliberately subtle marker with a constant screen size at every zoom level.
export function centreDotRadius(point,zoom=1){return (point.owner?2.2:3)/Math.max(.08,zoom);}
