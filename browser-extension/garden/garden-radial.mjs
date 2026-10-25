import {radialMemberOffsets,constrainOutwardGrowth} from './cellular-growth.mjs';
import {connectEveryMember} from './connected-regions.mjs';
import {syncContentEnvelopes} from './content-contours.mjs';
import {gardenGrowth} from './garden-growth.mjs';
import {discoverySize} from './map-presentation.mjs';
// v16.2 (Claude branch) · 收藏聚落 radiates from the Kumo core.
// Same groups, members and relations as clusterLayout; only the geometry changes:
// colonies sit on rings around the centre, and each colony's size follows its contents.
import {domainNodeSize,memberNodeSize} from './colony-appearance.mjs';
import {clusterLayout} from './layout.mjs';
import {hashSeed} from './garden-life.mjs';

const GOLDEN=2.399963,SQUASH=.8,CORE_R=190,GAP=12,REGION_REACH=1.28;

// More members enlarge a colony; growth raises its packing density gently.
export function colonyRadius(hubSize,memberSizes,density=.36){
 const largest=Math.max(20,...memberSizes),inner=(hubSize/2+largest/2+22)/SQUASH,area=memberSizes.reduce((n,s)=>n+Math.PI*(s/2+10)**2,0);
 return Math.max(inner+Math.max(28,largest/(2*SQUASH)+10),Math.sqrt(inner*inner+area/(Math.PI*density)));
}

// Seeded scattering fills the space between the hub and rim without a visible spiral.
// The caption strip under the hub stays clear.
export function memberOffsets(hub,members,R,phase=0){
 if(members.some(p=>p.record))return radialMemberOffsets(hub,members,R);
 let failedAt=0;
 for(let restart=0;restart<10;restart++){
  const out=[];
  for(let i=0;i<members.length;i++){
   const m=members[i],inner=(hub.size+m.size)/2+22,outer=R-m.size/(2*SQUASH)-8,key=(hub.key||hub.size)+':'+(m.key||i)+':'+phase+':'+restart;let found=null;
   for(let attempt=0;attempt<1200;attempt++){
    let a=scatterSeed(key+':angle:'+attempt)*Math.PI*2,u=scatterSeed(key+':radius:'+attempt);const topicIndex=m.clusterTopic?members.findIndex(p=>p.key===m.clusterTopic):-1,topic=topicIndex>=0?out[topicIndex]:null;if(m.record?.kind==='topic'&&attempt<80){const topics=members.filter(p=>p.record?.kind==='topic'),ordinal=topics.indexOf(m);a=phase+ordinal*Math.PI*2/Math.max(1,topics.length)+(scatterSeed(key+':topic-sector')-.5)*1.15;}if(m.record?.kind==='source'&&!m.clusterTopic)u=.52+u*.48;const r=Math.sqrt(inner*inner+u*Math.max(0,outer*outer-inner*inner));let o=[Math.cos(a)*r,Math.sin(a)*r*SQUASH];if(topic&&attempt<500){const siblings=members.filter(p=>p.clusterTopic===m.clusterTopic).length,near=(m.size+members[topicIndex].size)/2+14+Math.sqrt(u)*Math.min(145,22+siblings*9);o=[topic[0]+Math.cos(a)*near,topic[1]+Math.sin(a)*near];}if(Math.hypot(o[0],o[1]/SQUASH)>outer)continue;if(topic&&attempt<1000){const ownDistance=Math.hypot(o[0]-topic[0],o[1]-topic[1]);if(out.some((other,j)=>j!==topicIndex&&members[j].record?.kind==='topic'&&Math.hypot(o[0]-other[0],o[1]-other[1])+4<ownDistance))continue;}
    if(r>outer||Math.hypot(...o)<inner||captionDistance(o,hub)<m.size/2+10)continue;
    if(out.some((other,j)=>Math.hypot(o[0]-other[0],o[1]-other[1])<(m.size+members[j].size)/2+12))continue;
    found=o;break;
   }
   if(!found){failedAt=i;break;}out.push(found);
  }
  if(out.length===members.length)return out;
 }
 throw Error('Insufficient colony room for member '+failedAt);
}

function scatterSeed(key){let h=(hashSeed(key)*4294967295)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967295;}
function captionDistance([x,y],hub){const dx=Math.max(Math.abs(x)-86,0),dy=Math.max(hub.size/2+4-y,0,y-(hub.size/2+48));return Math.hypot(dx,dy);}
function projectMember(p,hub){let dx=p.x-hub.x,dy=p.y-hub.y,d=Math.hypot(dx,dy),minimum=(hub.size+p.size)/2+22,moved=0;if(d<minimum){if(d<.001){const a=hashSeed(p.key)*Math.PI*2;dx=Math.cos(a);dy=Math.sin(a);d=1;}p.x=hub.x+dx/d*minimum;p.y=hub.y+dy/d*minimum;moved++;}
 const x=p.x-hub.x,y=p.y-hub.y,pad=p.size/2+10,left=-86-pad,right=86+pad,top=hub.size/2+4-pad,bottom=hub.size/2+48+pad;
 if(x>left&&x<right&&y>top&&y<bottom){const exits=[{d:x-left,x:left,y},{d:right-x,x:right,y},{d:y-top,x,y:top},{d:bottom-y,x,y:bottom}].sort((a,b)=>a.d-b.d);p.x=hub.x+exits[0].x;p.y=hub.y+exits[0].y;moved++;}return moved;
}
export function relaxMembers(points,pinned=null){const members=[...points.values()].filter(p=>p.owner);for(let pass=0;pass<32;pass++){let moved=0;constrainOutwardGrowth(points,pinned);for(const p of members)moved+=projectMember(p,points.get(p.owner));for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++){const a=members[i],b=members[j];if(a.owner!==b.owner)continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=(a.size+b.size)/2+12;if(d>=min-.001)continue;if(d<.001){const angle=hashSeed(a.key+'|'+b.key)*Math.PI*2;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}const shift=min-d+.01,wa=a.key===pinned?0:b.key===pinned?1:.5,wb=1-wa;a.x-=dx/d*shift*wa;a.y-=dy/d*shift*wa;b.x+=dx/d*shift*wb;b.y+=dy/d*shift*wb;moved++;}if(!moved)break;}for(const p of members)projectMember(p,points.get(p.owner));constrainOutwardGrowth(points,pinned);return points;}

export function radialCollectionLayout(model,options={}){
 const graph={...clusterLayout(model,options),collection:true,radial:true},{width=830,height=450,positions=new Map()}=options;
 // Every real topic, including a single-post topic, anchors its own radial branch.
 const center={x:width*.5,y:height*.5},all=[...graph.points.values()],hubs=all.filter(p=>!p.owner);
 for(const hub of hubs){
  const members=all.filter(p=>p.owner===hub.key).sort((a,b)=>Number(b.record.kind==='topic')-Number(a.record.kind==='topic')||b.size-a.size||String(a.key).localeCompare(b.key));
  hub.size=domainNodeSize();hub.growth=gardenGrowth(model,hub.record);for(const m of members){m.size=memberNodeSize(m.record,hub.size);if(m.record.kind==='source'){const topic=members.filter(t=>t.record.kind==='topic'&&t.record.members?.includes(m.key)).sort((a,b)=>a.record.members.length-b.record.members.length||a.key.localeCompare(b.key))[0];m.clusterTopic=topic?.key||null;m.parent=m.clusterTopic||hub.key;}}
  let R=colonyRadius(hub.size,members.map(m=>m.size),hub.growth.density),offsets;for(let attempt=0;attempt<16;attempt++){try{offsets=memberOffsets(hub,members,R,hashSeed(hub.key)*6.28);break;}catch(error){if(attempt===15)throw error;R*=1.1;}}
  // Search room is not empty garden: fit the final boundary to the actual nodes.
  R=Math.max(colonyRadius(hub.size,members.map(m=>m.size),hub.growth.density),...offsets.map((o,i)=>Math.hypot(o[0],o[1]/SQUASH)+members[i].size/(2*SQUASH)+16));
  for(const edge of graph.edges){const p=members.find(m=>m.key===edge.to);if(edge.kind==='membership'&&p?.clusterTopic)edge.from=p.clusterTopic;}
  const shape=hashSeed(hub.key+':shape'),aspect=.95+shape*.1,boost=1+Math.min(.05,(hub.record.displayCount||0)*.002);hub.colonyR=R;hub.plot={rx:(R+4)*aspect*boost,ry:((R+4)*SQUASH+10)/aspect*boost,cy:0,tilt:(shape-.5)*14,flow:.9+hashSeed(hub.key+':flow')*.6};
  offsets.forEach((o,i)=>{members[i].offset=o;members[i].vx=0;members[i].vy=0;});
 }
 // Unassigned posts still need a real ownership connection; no synthetic topic.
 graph.edges=connectEveryMember(graph).edges;
 // Partners (colonies joined by a cross-domain relation) like to sit next to each other.
 const partners=new Map();for(const b of graph.bundles||[]){for(const [x,y] of [[b.from,b.to],[b.to,b.from]]){if(!partners.has(x))partners.set(x,[]);partners.get(x).push(y);}}
 const placed=[],order=[...hubs].sort((a,b)=>b.colonyR-a.colonyR);
 const reach=R=>R*REGION_REACH+12,fits=(x,y,R)=>Math.hypot(x-center.x,(y-center.y)/SQUASH)>CORE_R+reach(R)+GAP&&placed.every(q=>Math.hypot(x-q.x,(y-q.y)/SQUASH)>reach(R)+reach(q.colonyR)+GAP);
 for(const [index,hub] of order.entries()){
  let best=null;
  for(let s=0;s<72;s++){
   const angle=-Math.PI/2+s/72*Math.PI*2+index*.13;let d=CORE_R+hub.colonyR+GAP;
   while(!fits(center.x+Math.cos(angle)*d,center.y+Math.sin(angle)*d*SQUASH,hub.colonyR)&&d<2400)d+=8;
   const x=center.x+Math.cos(angle)*d,y=center.y+Math.sin(angle)*d*SQUASH;
   const near=(partners.get(hub.key)||[]).map(k=>placed.find(q=>q.key===k)).filter(Boolean);
   // Wide screens: favour the horizontal so the garden fills the canvas.
   const score=d+near.reduce((n,q)=>n+Math.hypot(x-q.x,y-q.y)*.35,0)+Math.abs(Math.sin(angle))*(width>height?40:0);
   if(!best||score<best.score)best={x,y,score};
  }
  hub.x=best.x;hub.y=best.y;placed.push(hub);
 }
 const before=new Map();for(const hub of hubs){const saved=positions.get(hub.key);if(saved){hub.x=saved[0];hub.y=saved[1];}before.set(hub.key,[hub.x,hub.y]);hub.vx=0;hub.vy=0;}
 relaxColonies(hubs,center);for(const hub of hubs)hub.home=[hub.x,hub.y];
 for(const p of all)if(p.owner){const owner=graph.points.get(p.owner),saved=positions.get(p.key),[bx,by]=before.get(owner.key)||[owner.x,owner.y];if(saved&&Math.hypot(saved[0]-bx,(saved[1]-by)/SQUASH)<owner.colonyR-p.size/2-8){p.x=saved[0]+owner.x-bx;p.y=saved[1]+owner.y-by;p.offset=[p.x-owner.x,p.y-owner.y];}else{p.x=owner.x+p.offset[0];p.y=owner.y+p.offset[1];}}
 relaxMembers(graph.points);for(const p of all)if(p.owner){const owner=graph.points.get(p.owner);p.offset=[p.x-owner.x,p.y-owner.y];}
 graph.core={x:center.x,y:center.y,radius:CORE_R,size:CORE_R*2};
 graph.reserved=[{left:center.x-CORE_R,right:center.x+CORE_R,top:center.y-CORE_R*SQUASH,bottom:center.y+CORE_R*SQUASH+16},...hubs.map(h=>({left:h.x-h.plot.rx*1.25,right:h.x+h.plot.rx*1.25,top:h.y+(h.plot.cy||0)-h.plot.ry*1.25,bottom:h.y+(h.plot.cy||0)+h.plot.ry*1.25+30}))];
 return syncContentEnvelopes(graph);
}

// Livelier physics for the radial garden.
// · members follow their hub on a soft spring with inertia, so they trail and settle;
// · colonies push each other away while one is dragged, then ease back home;
// · dragging a single leaf tugs its hub a little, and its siblings make room.
export function stepGarden(points,pinned=null,core=null){
 let energy=0;const list=[...points.values()],hubs=list.filter(p=>!p.owner&&p.colonyR),drag=pinned?points.get(pinned):null;
 for(const hub of hubs){
  if(hub.key===pinned)continue;const f=hub.home?[(hub.home[0]-hub.x)*.035,(hub.home[1]-hub.y)*.035]:[0,0];
  for(const other of hubs){if(other===hub)continue;const dx=hub.x-other.x,dy=(hub.y-other.y)/SQUASH,d=Math.hypot(dx,dy)||1,min=(hub.colonyR+other.colonyR)*REGION_REACH+GAP+8;if(d<min){const k=(min-d)*(other.key===pinned?.26:.16);f[0]+=dx/d*k;f[1]+=dy/d*k*SQUASH;}}
  if(core){const dx=hub.x-core.x,dy=(hub.y-core.y)/SQUASH,d=Math.hypot(dx,dy)||1,min=CORE_R+hub.colonyR*REGION_REACH+GAP;if(d<min){f[0]+=dx/d*(min-d)*.2;f[1]+=dy/d*(min-d)*.2*SQUASH;}}
  if(drag?.owner===hub.key){f[0]+=(drag.x-hub.x-drag.offset[0])*.035;f[1]+=(drag.y-hub.y-drag.offset[1])*.035;}
  hub.vx=((hub.vx||0)+f[0])*.8;hub.vy=((hub.vy||0)+f[1])*.8;hub.x+=hub.vx;hub.y+=hub.vy;energy+=Math.abs(hub.vx)+Math.abs(hub.vy);
 }
 for(const p of list){
  if(!p.owner||p.key===pinned)continue;const owner=points.get(p.owner),target=[owner.x+p.offset[0],owner.y+p.offset[1]],f=[(target[0]-p.x)*.09,(target[1]-p.y)*.09];
  for(const other of list){if(other===p||other.owner!==p.owner)continue;const dx=p.x-other.x,dy=p.y-other.y,d=Math.hypot(dx,dy)||1,sep=(p.size+other.size)/2+5;if(d<sep){const k=(sep-d)*(other.key===pinned?.3:.15);f[0]+=dx/d*k;f[1]+=dy/d*k;}}
  p.vx=((p.vx||0)+f[0])*.86;p.vy=((p.vy||0)+f[1])*.86;p.x+=p.vx;p.y+=p.vy;energy+=Math.abs(p.vx)+Math.abs(p.vy);
 }
 relaxMembers(points,pinned);return energy;
}

// Exploration landmarks sit on the garden's outer edge, in the direction of the place
// they point to, so they never cover a colony and are always inside the framed view.
export function radialPockets(graph,entries=[]){
 if(!graph.radial||!entries.length)return graph;const c=graph.core,hubs=[...graph.points.values()].filter(p=>!p.owner&&p.colonyR),taken=[];
 const clear=(x,y)=>Math.hypot(x-c.x,(y-c.y)/SQUASH)>CORE_R+70&&hubs.every(h=>Math.hypot(x-h.x,(y-h.y)/SQUASH)>h.colonyR*REGION_REACH+24+54)&&taken.every(q=>Math.hypot(x-q[0],y-q[1])>150);
 for(const [i,record] of entries.entries()){
  const base=hashSeed(record.key+':planted')*Math.PI*2;let best=null;
  for(const turn of [0,.18,-.18,.36,-.36,.6,-.6,.9,-.9,1.3,-1.3,1.8,-1.8,2.4,-2.4,3.1]){const a=base+turn;for(let d=CORE_R+90;d<1800;d+=14){const x=c.x+Math.cos(a)*d,y=c.y+Math.sin(a)*d*SQUASH;if(clear(x,y)){const score=d+Math.abs(turn)*160;if(!best||score<best.score)best={x,y,score};break;}}}
  if(!best)continue;taken.push([best.x,best.y]);
  graph.points.set(record.key,{key:record.key,record,x:best.x,y:best.y,size:discoverySize(graph,record),discovery:true,owned:record.owned,labelText:record.owned||!record.rule?record.name:'盲盒 · '+(record.guide?.progressText||record.rule.value+'/'+record.rule.target)});
 }
 return graph;
}

// Saved or dropped positions may overlap; push colonies (and the core) apart until clear.
export function relaxColonies(hubs,core){
 for(let pass=0;pass<160;pass++){let moved=false;
  for(let i=0;i<hubs.length;i++){const a=hubs[i];
   const cdx=a.x-core.x,cdy=(a.y-core.y)/SQUASH,cd=Math.hypot(cdx,cdy)||1,cmin=CORE_R+a.colonyR*REGION_REACH+GAP;if(cd<cmin){a.x+=cdx/cd*(cmin-cd)*.6;a.y+=cdy/cd*(cmin-cd)*.6*SQUASH;moved=true;}
   for(let j=i+1;j<hubs.length;j++){const b=hubs[j],dx=b.x-a.x,dy=(b.y-a.y)/SQUASH,d=Math.hypot(dx,dy)||1,min=(a.colonyR+b.colonyR)*REGION_REACH+GAP+8;if(d<min){const k=(min-d)/2*.6;a.x-=dx/d*k;a.y-=dy/d*k*SQUASH;b.x+=dx/d*k;b.y+=dy/d*k*SQUASH;moved=true;}}
  }
  if(!moved)break;}
 return hubs;
}
