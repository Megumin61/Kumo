import {addRelatedPeeks} from './related-peeks.mjs';
import {ROOT,roots,branchPage,nodeSize,aggregateRelations,children,pathTo} from './schema.mjs';
import {previewSize} from './preview-layout.mjs';
import {separate} from './spacing.mjs';
export function veinLayout(model,{path=[],page=0,width=830,height=610,positions=new Map(),selected=null,showRelations=false}={}){
 const displaySize=r=>{const depth=Math.max(1,pathTo(model,r.key).length);return r.kind==='brand'?268:['domain','pending','unassigned'].includes(r.kind)?Math.max(108,176*.82**(depth-1)):r.kind==='topic'?Math.max(104,136*.86**Math.max(0,depth-2)):96;};
 const navigation=branchPage(model,path,page),points=new Map(),edges=[],current=navigation.current,centerY=height*.45;
 function put(record,x,y,parent){if(points.has(record.key))return points.get(record.key);const cached=positions.get(record.key),p={key:record.key,record,size:displaySize(record),x:cached?.[0]??x,y:cached?.[1]??y,parent};points.set(record.key,p);if(parent)edges.push({key:'vein:'+record.key,from:parent,to:record.key,kind:'hierarchy'});return p;}
 put(model.records.get(ROOT),100,centerY);
 const spacing=records=>Math.max(128,...records.map(r=>r.kind==='source'?128:displaySize(r)+76));
 const root=points.get(ROOT),top=roots(model),rootStep=spacing(top);top.forEach((r,i,all)=>put(r,root.x+280,root.y+(i-(all.length-1)/2)*rootStep,ROOT));
 for(let depth=0;depth<navigation.path.length-1;depth++){
  const parent=points.get(navigation.path[depth]),next=navigation.path[depth+1],branches=children(model,parent.key).filter(r=>r.kind!=='source'),start=Math.floor(Math.max(0,branches.findIndex(r=>r.key===next))/3)*3,siblings=branches.slice(start,start+3);
  siblings.forEach((r,i)=>put(r,parent.x+300,parent.y+(i-(siblings.length-1)/2)*spacing(siblings),parent.key));
  if(!points.has(next))put(model.records.get(next),parent.x+300,parent.y,parent.key);
 }
 if(current!==ROOT){
  const anchor=points.get(current),items=navigation.items,step=spacing(items);
  items.forEach((r,i)=>{const p=put(r,anchor.x+300,anchor.y+(i-(items.length-1)/2)*step,current);p.x=anchor.x+300;p.y=anchor.y+(i-(items.length-1)/2)*step;if(r.kind==='source')Object.assign(p,{preview:true,cardWidth:previewSize.width,cardHeight:previewSize.height,size:96});});
  navigation.previews=items.some(r=>r.kind==='source');navigation.symmetric=true;navigation.direction='right';separate(points,new Set([current,...items.map(r=>r.key)]));
 }else separate(points,new Set([ROOT]));
 const bundles=showRelations?aggregateRelations(model,[...points.values()].map(p=>p.record)):[];for(const bundle of bundles)edges.push({key:bundle.key,from:bundle.from,to:bundle.to,kind:'relation',record:bundle});const graph={points,edges,bundles,navigation,guides:[]};return showRelations?addRelatedPeeks(graph,model,selected||current):graph;
}
