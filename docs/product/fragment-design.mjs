import {hashSeed} from './garden-life.mjs';

// Stable across refreshes; exhaust the available silhouettes before reusing one.
export function fragmentMotifs(fragments,families){
 const free=[...new Set(families)],all=[...free],out=new Map();
 for(const f of fragments){if(!free.length)free.push(...all);if(!free.length)break;const id=free.splice(Math.floor(hashSeed(f.id)*free.length)%free.length,1)[0];out.set(f.id,{id,level:Math.floor(hashSeed(f.id+':form')*3)%3,angle:(hashSeed(f.id+':tilt')-.5)*14});}
 return out;
}
export function fragmentPositions(mode,storage=globalThis.localStorage){
 const key='kumo:garden:fragment-positions:v24:'+mode;let values={};
 try{const raw=JSON.parse(storage?.getItem(key)||'{}');for(const [k,v]of Object.entries(raw||{}))if(Array.isArray(v)&&v.length===2&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<100000))values[k]=v;}catch{}
 return {get:id=>values[id],set(id,pos){if(!Array.isArray(pos)||!pos.every(Number.isFinite))return;values[id]=pos;try{storage?.setItem(key,JSON.stringify(values));}catch{}},clear(){values={};try{storage?.removeItem(key);}catch{}}};
}
// Uses the caller's coordinate system: world units for buds, world offsets for cards.
export function bindFragmentDrag(element,{getPosition,setPosition,toPoint=e=>[e.clientX,e.clientY],savePosition=()=>{},onActivate=()=>{}}){
 let drag=null,suppressClick=false;
 element.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.stopPropagation();suppressClick=false;const start=toPoint(e);drag={id:e.pointerId,start,before:[...getPosition()],client:[e.clientX,e.clientY],moved:false};element.setPointerCapture(e.pointerId);});
 element.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;e.stopPropagation();if(Math.hypot(e.clientX-drag.client[0],e.clientY-drag.client[1])>5)drag.moved=true;if(!drag.moved)return;const p=toPoint(e);setPosition([drag.before[0]+p[0]-drag.start[0],drag.before[1]+p[1]-drag.start[1]]);element.classList.add('dragging');});
 const finish=(e,cancel)=>{if(!drag||drag.id!==e.pointerId)return;e.stopPropagation();const last=drag;drag=null;if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);element.classList.remove('dragging');if(cancel)setPosition(last.before);else if(last.moved)savePosition(getPosition());suppressClick=last.moved||cancel;};
 element.addEventListener('pointerup',e=>finish(e,false));element.addEventListener('pointercancel',e=>finish(e,true));
 element.addEventListener('click',e=>{e.stopPropagation();if(suppressClick){suppressClick=false;e.preventDefault();return;}onActivate();});
 element.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onActivate();}const d={ArrowLeft:[-12,0],ArrowRight:[12,0],ArrowUp:[0,-12],ArrowDown:[0,12]}[e.key];if(d){e.preventDefault();const p=getPosition();setPosition([p[0]+d[0],p[1]+d[1]]);savePosition(getPosition());}});
}
