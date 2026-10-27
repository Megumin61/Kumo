import {gardenInsights} from './garden-insights.mjs';
import {freshness} from './garden-life.mjs';
export function collectionOpportunities(model){
 const {bridges,needsReading,unlinked}=gardenInsights(model);
 return {bridges,pending:needsReading,unlinked,domains:[...model.groups].sort((a,b)=>b.displayCount-a.displayCount)};
}
export function opportunityFocus(model,lens){
 const info=collectionOpportunities(model),keys=new Set();if(lens==='all')return keys;if(lens==='fresh')return freshness(model).keys;
 const sources=lens==='pending'?info.pending.map(r=>r.key):info.bridges.flatMap(b=>b.relations.flatMap(r=>[r.from,r.to]));
 for(const key of sources){keys.add(key);keys.add(model.records.get(key)?.primary);}
 for(const r of model.topics)if(r.members?.some(k=>keys.has(k)))keys.add(r.key);
 return keys;
}
