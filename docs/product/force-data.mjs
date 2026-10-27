import {clusterLayout} from './layout.mjs';
import {nodeSize} from './schema.mjs';
export function forceData(model,{mode='field',width=850,height=520,relationType='all',showRelations=false}={}){
  if(mode==='field'){
    const layout=clusterLayout(model,{width,height}),nodes=[...layout.points.values()].map(point=>({...point,fixed:!point.owner}));
    const edges=layout.edges.filter(edge=>edge.kind==='membership');
    if(showRelations)for(const relation of model.relations)edges.push({key:relation.key,from:relation.from,to:relation.to,kind:'relation',relation});
    return {nodes,edges};
  }
  const relations=model.relations.filter(relation=>relationType==='all'||relation.type===relationType),keys=new Set(relations.flatMap(relation=>[relation.from,relation.to])),degree=new Map();
  for(const relation of relations)for(const key of [relation.from,relation.to])degree.set(key,(degree.get(key)||0)+1);
  const nodes=[...keys].map((key,index)=>{const record=model.records.get(key),angle=index/keys.size*Math.PI*2;return {key,record,size:Math.max(36,nodeSize(record))+Math.min(10,degree.get(key)*1.3),degree:degree.get(key),x:width/2+Math.cos(angle)*width*.27,y:height/2+Math.sin(angle)*height*.3};});
  return {nodes,edges:relations.map(relation=>({key:relation.key,from:relation.from,to:relation.to,kind:'relation',relation}))};
}

