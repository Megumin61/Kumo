import {ROOT} from './schema.mjs';
import {gardenInsights} from './garden-insights.mjs';
export function habitats(model,width,height,positions=new Map()){
 const owners=new Map(model.groups.map(g=>[g.key,g.key])),find=k=>owners.get(k)===k?k:find(owners.get(k));
 for(const b of gardenInsights(model).bridges)owners.set(find(b.from),find(b.to));
 const sets=new Map();for(const g of model.groups){const id=find(g.key);if(!sets.has(id))sets.set(id,[]);sets.get(id).push(g);}
 const components=[...sets.values()].sort((a,b)=>b.reduce((n,g)=>n+g.displayCount,0)-a.reduce((n,g)=>n+g.displayCount,0)),wide=width>=760,coords=new Map(),connected=components.filter(c=>c.length>1),single=components.filter(c=>c.length===1),pairSlots=wide?[[.35,.19],[.64,.61]]:[[.5,.15],[.5,.68]],singleSlots=wide?[[.83,.12],[.13,.49],[.22,.86],[.82,.88]]:[[.78,.4],[.22,.42],[.22,.87],[.78,.9]];
 connected.forEach((c,i)=>{const slot=pairSlots[i]||[.5,.5],cx=slot[0]*width,cy=slot[1]*height,dx=Math.min(120,width*.23);c.forEach((g,j)=>{const angle=c.length===2?(j===0?Math.PI:0):j*Math.PI*2/c.length,delta=c.length===2?[j===0?-dx:dx,j===0?-50:50]:[Math.cos(angle)*170,Math.sin(angle)*170];coords.set(g.key,{x:cx+delta[0],y:cy+delta[1]});});});
 single.forEach((c,i)=>{const slot=singleSlots[i]||[.5,.3+i*.15];coords.set(c[0].key,{x:slot[0]*width,y:slot[1]*height});});
 const componentOf=new Map(components.flatMap((c,i)=>c.map(g=>[g.key,i]))),keys=[...coords.keys()];
 for(let pass=0;pass<90;pass++)for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++){const a=coords.get(keys[i]),b=coords.get(keys[j]),dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,minimum=keys[i]===ROOT||keys[j]===ROOT?182:componentOf.get(keys[i])===componentOf.get(keys[j])?258:285;if(d<minimum){const shift=(minimum-d)*.51;a.x-=dx/d*shift;a.y-=dy/d*shift;b.x+=dx/d*shift;b.y+=dy/d*shift;}}
 for(const [key,p]of coords){const saved=positions.get(key);if(saved){p.x=saved[0];p.y=saved[1];}}
 return {coords,components:components.filter(c=>c.length>1).map((c,i)=>({key:'habitat:'+i,members:c.map(g=>g.key)}))};
}
