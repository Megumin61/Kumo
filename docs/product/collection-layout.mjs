import {clusterLayout} from './layout.mjs';
import {addExplorationPockets} from './exploration.mjs';

// Catalogue controls preserve the established map and its natural node orbits.
export function collectionLayout(model,options={}){
 const graph={...clusterLayout(model,options),collection:true};addExplorationPockets(graph,options.discoveries,options.positions);
 for(const p of graph.points.values())if(p.discovery)model.records.set(p.key,p.record);return graph;
}
