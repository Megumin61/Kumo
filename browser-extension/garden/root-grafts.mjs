const polar=(core,r,a)=>[core.x+Math.cos(a)*r,core.y+Math.sin(a)*r];
const delta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const curve=(from,c1,c2,to)=>({from,c1,c2,to,d:'M '+from.join(' ')+' C '+c1.join(' ')+' '+c2.join(' ')+' '+to.join(' ')});
// Keep each stem inside its existing angular corridor while giving it a living bow.
function vine(g,strength=1){const dx=g.to[0]-g.from[0],dy=g.to[1]-g.from[1],len=Math.hypot(dx,dy)||1,bow=Math.min(25,len*.075)*strength,nx=-dy/len,ny=dx/len;return curve(g.from,[g.c1[0]+nx*bow,g.c1[1]+ny*bow],[g.c2[0]-nx*bow*.65,g.c2[1]-ny*bow*.65],g.to);}
function leafPair(g,t=.48,scale=1){const u=1-t,x=u**3*g.from[0]+3*u*u*t*g.c1[0]+3*u*t*t*g.c2[0]+t**3*g.to[0],y=u**3*g.from[1]+3*u*u*t*g.c1[1]+3*u*t*t*g.c2[1]+t**3*g.to[1],dx=3*u*u*(g.c1[0]-g.from[0])+6*u*t*(g.c2[0]-g.c1[0])+3*t*t*(g.to[0]-g.c2[0]),dy=3*u*u*(g.c1[1]-g.from[1])+6*u*t*(g.c2[1]-g.c1[1])+3*t*t*(g.to[1]-g.c2[1]),a=Math.atan2(dy,dx),p=(f,n)=>[(x+scale*(f*Math.cos(a)-n*Math.sin(a))).toFixed(2),(y+scale*(f*Math.sin(a)+n*Math.cos(a))).toFixed(2)].join(' ');let d='';for(const s of [-1,1])d+='M '+p(0,0)+' C '+p(3,s*6)+' '+p(9,s*13)+' '+p(15,s*10)+' C '+p(13,s*3)+' '+p(4,s)+' '+p(0,0)+' Z ';return d;}
export function rootGraftGroups(core,hubs){const sorted=hubs.filter(h=>h.key!=='pending').map(h=>({key:h.key,a:Math.atan2(h.y-core.y,h.x-core.x)})).sort((a,b)=>a.a-b.a),groups=[];for(let i=0;i<sorted.length;i++){const list=[sorted[i].key];if(sorted[i+1]&&sorted[i+1].a-sorted[i].a<1.08)list.push(sorted[++i].key);groups.push(list);}return groups;}
// Shared garden stems are visual routes, not additional semantic relationships.
export function rootGraftGeometry(core,hubs,groups=rootGraftGroups(core,hubs)){
 const lookup=new Map(hubs.filter(h=>h.key!=='pending').map(h=>[h.key,h])),trunks=[],shoots=new Map();
 for(const [index,keys]of groups.entries()){const members=keys.map(k=>lookup.get(k)).filter(Boolean);if(!members.length)continue;const angles=members.map(h=>Math.atan2(h.y-core.y,h.x-core.x)),base=angles[0],a=base+angles.reduce((sum,v)=>sum+delta(v,base),0)/angles.length,min=Math.min(...members.map(h=>Math.hypot(h.x-core.x,h.y-core.y))),r=Math.min(330,min*.37),joint=polar(core,r,a),from=polar(core,142,a-.025),trunk=curve(from,polar(core,r*.63,a+.045),polar(core,r*.87,a-.04),joint);trunk.key='graft:'+index;trunk.members=keys;trunk.leaves=leafPair(trunk,.6,1.15);trunks.push(trunk);
  for(const [i,h]of members.entries()){const ah=Math.atan2(h.y-core.y,h.x-core.x),d=Math.hypot(h.x-core.x,h.y-core.y),bend=delta(ah,a),g=curve(joint,polar(core,r+(d-r)*.25,a+bend*.53),polar(core,d-(d-r)*.23,ah),[h.x,h.y]);g.leaves=leafPair(g,.33+i*.05,.85);g.graft=trunk.key;shoots.set(h.key,g);}
 }
 for(let i=0;i<trunks.length;i++){const g=trunks[i],flow=vine(g,i%2?-.9:1);Object.assign(g,flow);g.leaves=leafPair(g,.36,2.25)+leafPair(g,.73,1.8);}
 for(const [key,g]of shoots){Object.assign(g,vine(g,.85));g.leaves=leafPair(g,.3,1.9)+leafPair(g,.64,1.5);}
 for(const g of [...trunks,...shoots.values()]){const t=.54,u=1-t,lerp=(a,b)=>[a[0]*u+b[0]*t,a[1]*u+b[1]*t],a=lerp(g.from,g.c1),b=lerp(g.c1,g.c2),c=lerp(g.c2,g.to),ab=lerp(a,b),bc=lerp(b,c),start=lerp(ab,bc);g.tip=curve(start,bc,c,g.to).d;g.tipLeaves=leafPair(g,trunks.includes(g)?.73:.64,trunks.includes(g)?1.8:1.5);}
 return {trunks,shoots};
}
