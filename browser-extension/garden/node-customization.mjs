import {pathTo} from './schema.mjs';
export const customizableKey=key=>/^(domain|topic|source):/.test(key)||['pending','unassigned'].includes(key);
export function assignedFamily(model,record,progress){
 const exact=progress.nodeAssignments?.[record.key];if(progress.unlocked.includes(exact))return exact;
 const branch=[...pathTo(model,record.kind==='source'?record.primary:record.key)].reverse();
 for(const key of branch){const family=progress.assignments[key];if(progress.unlocked.includes(family))return family;}
 return null;
}
export function assignNodeFamily(model,progress,key,family,{scope='node'}={}){
 const record=model.records.get(key);if(!record||!customizableKey(key)||!progress.unlocked.includes(family))return false;
 if(scope==='colony'&&record.kind==='domain'){
  progress.assignments[key]=family;
  for(const child of Object.keys(progress.nodeAssignments||{})){const r=model.records.get(child);if(r&&pathTo(model,r.kind==='source'?r.primary:r.key).includes(key))delete progress.nodeAssignments[child];}
 }else{progress.nodeAssignments||={};progress.nodeAssignments[key]=family;}
 return true;
}
