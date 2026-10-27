import {growthFromCounts} from './garden-growth.mjs';
// v16.3 · What the garden has grown, measured only from the library itself.
// The user does two things — 收藏 (clip) and 编译 (compile) — so every unlock is
// counted from these numbers, never from clicks inside the page.
import {gardenInsights} from './garden-insights.mjs';
export const COMPILED_OUT=['pending','stale','index_only'];
let cache=null;
export const topicCount=(model,g)=>model.topics.filter(t=>t.domainId===g.id&&t.members?.length).length;
// Which domain made an unlock happen — the new plant appears beside it.
export function originOf(model,rule){
 const domains=model.groups.filter(g=>g.kind==='domain'),newest=s=>Math.max(0,...(s.displayMembers||[]).map(k=>Date.parse(model.records.get(k)?.capturedAt)||0));
 if(!domains.length)return null;const by=f=>[...domains].sort((a,b)=>f(b)-f(a))[0].key;
 if(rule==='topics')return by(g=>topicCount(model,g));if(['biggest','bloom','growing'].includes(rule))return by(g=>g.displayCount||0);
 if(rule==='bridges'){const b=gardenInsights(model).bridges[0];return b?.from||by(g=>g.displayCount||0);}
 return by(newest);
}
export function gardenStats(model){
 if(!model)return {collected:0,compiled:0,domains:0,biggest:0,growing:0,bloom:0,bridges:0,biggestKey:null};
 if(cache?.model===model)return cache.stats;
 const domains=model.groups.filter(g=>g.kind==='domain'),sizes=domains.map(g=>g.displayCount||0),biggest=domains.reduce((a,g)=>!a||(g.displayCount||0)>(a.displayCount||0)?g:a,null);
 const stats={collected:model.sources.length,compiled:model.sources.filter(s=>s.card&&!COMPILED_OUT.includes(s.status)).length,domains:domains.length,biggest:Math.max(0,...sizes),biggestKey:biggest?.key||null,growing:sizes.filter(n=>n>=3).length,bloom:sizes.filter(n=>n>=8).length,bridges:gardenInsights(model).bridges.length,topics:Math.max(0,...domains.map(g=>topicCount(model,g)))};
 cache={model,stats};return stats;
}
// Domain stages, shared by the map, the reader and 我的领域.
export const stageOf=n=>growthFromCounts(n).name;
// Leaf variety in a colony grows with what the user clipped there: one more plant every 3 clips.
export const VARIETY_STEP=3;
export function colonyVariety(count,poolSize){const kinds=Math.max(1,Math.min(poolSize||1,1+Math.floor(count/VARIETY_STEP)));return {kinds,next:kinds>=(poolSize||1)?null:(kinds)*VARIETY_STEP-count};}
