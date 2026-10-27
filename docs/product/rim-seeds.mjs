import {hashSeed} from './garden-life.mjs';
import {rimAnchor} from './rim-fragments.mjs';
// Decorative seeds, never added to the user's knowledge records or counts.
export function rimSeedSpots(layout,{theme='paperlight',limit=6,occupied=[]}={}){
 const all=[...layout.points.values()],hubs=all.filter(p=>!p.owner&&p.plot&&!p.discovery),out=[];
 for(const hub of [...hubs].sort((a,b)=>hashSeed(a.key+':seed')-hashSeed(b.key+':seed'))){
  const base=Math.atan2(hub.y-layout.core.y,hub.x-layout.core.x);
  for(const turn of [.4,-.5,.9,-1.05,1.4,-1.6,2.1]){const angle=base+turn,anchor=rimAnchor(hub,angle,theme),lift=30,x=anchor[0]+Math.cos(angle)*lift,y=anchor[1]+Math.sin(angle)*lift;
   if(all.some(p=>Math.hypot(x-p.x,y-p.y)<p.size/2+48)||occupied.some(p=>Math.hypot(x-p.x,y-p.y)<88)||out.some(p=>Math.hypot(x-p.x,y-p.y)<100)||hubs.some(h=>h!==hub&&Math.hypot((x-h.x)/h.plot.rx,(y-h.y)/h.plot.ry)<1.3))continue;
   out.push({key:hub.key+':rim-seed',domainKey:hub.key,angle,lift,x,y,anchor,size:32,family:['P04','P10','P06','P09','P11','F03'][out.length%6]});break;
  }
  if(out.length>=limit)break;
 }
 return out;
}
