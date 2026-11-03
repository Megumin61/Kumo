import {pathTo} from './schema.mjs';
export function domainMetrics(model,record){
 const ids=new Set(record.displayMembers||record.members||[]),topics=model.topics.filter(t=>t.members.some(k=>ids.has(k))),count=record.displayCount??record.count??ids.size;
 return {count,topics:topics.length,depth:Math.max(1,...topics.map(t=>pathTo(model,t.key).length))+1};
}
export const domainDisplaySize=count=>156+10*Math.sqrt(Math.max(0,count));
export const topicDisplaySize=count=>90+5*Math.sqrt(Math.max(0,count));
export const domainDisplayExtent=({count,topics,depth})=>220+35*Math.sqrt(count)+18*Math.sqrt(topics)+20*Math.max(0,depth-2);

// A shared hierarchy scale: every child is smaller; all atomic posts are equal.
export const ATOM_SIZE=36;
export function hierarchyDisplaySize(model,record){
 if(record.kind==='source')return ATOM_SIZE;
 if(record.kind==='brand')return 460;
 const chain=pathTo(model,record.key).map(k=>model.records.get(k)).filter(Boolean);
 // Display-only branches are absent from the original taxonomy.
 if(!chain.length||chain.at(-1)?.key!==record.key)chain.push(record);
 let size=460;
 for(const node of chain){const cap=node.kind==='topic'?topicDisplaySize(node.members?.length||0):domainDisplaySize(node.displayCount??node.count??node.members?.length??0);size=Math.min(cap,ATOM_SIZE+(size-ATOM_SIZE)*.55);}
 return size;
}
