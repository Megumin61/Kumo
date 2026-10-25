import {hashSeed} from './garden-life.mjs';
export const logoKey='kumo:garden:center-logo:v41';
export const regionKey='kumo:garden:region-expression:v34';
export const regionExpressions=[{id:'interlaced',name:'双圈交织',note:'两条错位细线相交，外围有浅绿波纹，内部留白'},{id:'dashed',name:'虚线涟漪',note:'细腻虚线围合，外围一层轻波纹，内部留白'}];
export function regionExpression(storage=globalThis.localStorage){let id;try{id=storage?.getItem(regionKey);}catch{}return regionExpressions.find(v=>v.id===id)||regionExpressions[0];}
export function setRegionExpression(id,storage=globalThis.localStorage){if(!regionExpressions.some(v=>v.id===id))return false;try{storage?.setItem(regionKey,id);return true;}catch{return false;}}
export const logoVariants=[{id:'yellow-kumo',name:'亮色标识 · 绿底黄蕉',official:true,href:'assets/brand-release/primary.png'},{id:'green-rubber',name:'浅色标识 · 绿蕉黄胶',official:true,href:'assets/brand-release/light.png'}];
export function centreLogo(storage=globalThis.localStorage){let id;try{id=storage?.getItem(logoKey);}catch{}return logoVariants.find(v=>v.id===id)||logoVariants.find(v=>v.id==='yellow-kumo');}
export function setCentreLogo(id,storage=globalThis.localStorage){if(!logoVariants.some(v=>v.id===id))return false;try{storage?.setItem(logoKey,id);return true;}catch{return false;}}
export function remixNodeAssignments(records,before,families,seed){const pool=[...new Set(families)],out={};if(pool.length<2)return out;for(const r of [...records].filter(r=>['domain','topic','source','pending','unassigned'].includes(r.kind)).sort((a,b)=>a.key.localeCompare(b.key))){const choices=pool.filter(id=>id!==before.get(r.key));out[r.key]=choices[Math.floor(hashSeed(r.key+':'+seed)*choices.length)];}return out;}
