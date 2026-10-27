import {ROOT} from './schema.mjs';
import {footprint,intersects} from './spacing.mjs';
export function addRelatedPeeks(graph,model,selected){
 const current=graph.points.get(selected)||graph.points.get(graph.navigation.current);if(!current||current.key===ROOT||current.discovery)return graph;
 const own=new Set(current.record.kind==='source'?[current.key]:current.record.members||current.record.displayMembers||[]),pairs=[];
 for(const relation of model.relations)for(const [from,to]of [[relation.from,relation.to],[relation.to,relation.from]])if(own.has(from)&&!own.has(to)&&!graph.points.has(to)&&!pairs.some(p=>p.to===to))pairs.push({from,to,relation});
 const occupied=[...graph.points.values()].map(p=>footprint(p,16));let placed=0;
 for(const {to,relation}of pairs){if(placed>=2)break;const record=model.records.get(to);if(!record)continue;const p={key:to,record,relatedPeek:true,preview:true,size:86,cardWidth:184,cardHeight:76};let found=false;
  for(const [dx,dy]of [[80,155],[80,-155],[110,260],[110,-260],[310,330],[310,-330],[390,140],[390,-140]]){p.x=current.x+dx;p.y=current.y+dy;const box=footprint(p,12);if(occupied.some(b=>intersects(b,box)))continue;occupied.push(box);found=true;break;}
  if(!found)continue;graph.points.set(to,p);graph.edges.push({key:relation.key,from:current.key,to,kind:'related-peek',relation});placed++;
 }
 return graph;
}
