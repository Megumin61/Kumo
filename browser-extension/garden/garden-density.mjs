export const densityKey='kumo:garden:density:v36';
const choices=[['auto','自动展开'],['overview','轻量总览'],['all','显示全部']];
export function densityMode(storage=globalThis.localStorage){let value;try{value=storage?.getItem(densityKey);}catch{}return choices.some(v=>v[0]===value)?value:'auto';}
export function setDensityMode(value,storage=globalThis.localStorage){if(!choices.some(v=>v[0]===value))return false;try{storage?.setItem(densityKey,value);return true;}catch{return false;}}
const newest=(a,b)=>(Date.parse(b.record.capturedAt)||0)-(Date.parse(a.record.capturedAt)||0)||a.key.localeCompare(b.key);
// This is display pagination. It neither deletes sources nor invents knowledge groups.
export function sourceWindow(points,{density='auto',selection=null,primary=new Set(),related=new Set(),reveal=0}={}){
 const sources=points.filter(p=>p.record.kind==='source');if(density==='all'||density==='auto'&&sources.length<=120)return null;
 const keep=new Set([...related].filter(k=>sources.some(p=>p.key===k)));let candidates=[],limit=0;
 if(!selection){const groups=new Map();for(const p of [...sources].sort(newest)){if(!groups.has(p.owner))groups.set(p.owner,[]);groups.get(p.owner).push(p);}for(const list of groups.values())for(const p of list.slice(0,2))keep.add(p.key);candidates=[...sources].sort(newest);limit=reveal;}
 else if(selection.record.kind==='source'){const parent=selection.clusterTopic||selection.parent;candidates=sources.filter(p=>p.key===selection.key||(parent&&(p.clusterTopic||p.parent)===parent)).sort(newest);keep.add(selection.key);limit=6+reveal;}
 else{candidates=sources.filter(p=>primary.has(p.key)).sort(newest);limit=(selection.record.kind==='topic'?12:18)+reveal;}
 for(const p of candidates.filter(p=>!keep.has(p.key)).slice(0,limit))keep.add(p.key);
 const hiddenCount=candidates.filter(p=>!keep.has(p.key)).length;
 return {keep,hiddenCount,hint:!selection?'总览先看领域与主题，点一片花圃逐步展开':selection.record.kind==='topic'?'先看这个主题的一批收藏，可继续展开':selection.record.kind==='source'?'正在阅读，保留同枝收藏与真实关联':'先看这片花圃的一批收藏，可继续展开'};
}
export function mountDensityPicker(host,{storage=globalThis.localStorage,onChange=()=>{}}={}){if(!host)return {sync(){}};const doc=host.ownerDocument,label=doc.createElement('label'),caption=doc.createElement('span'),select=doc.createElement('select');label.className='density-picker';caption.textContent='内容';select.setAttribute('aria-label','收藏聚落的展开密度');for(const [id,name]of choices){const option=doc.createElement('option');option.value=id;option.textContent=name;select.append(option);}const sync=()=>{select.value=densityMode(storage);};select.onchange=()=>{if(!setDensityMode(select.value,storage)){sync();return;}onChange();};label.append(caption,select);host.append(label);sync();return {sync,label};}
