import {hashSeed} from './garden-life.mjs';

// Themes own non-overlapping sectors around the whole domain. New posts stay outside
// their parent theme's radial ring, so they never grow back through the domain centre.
export function radialMemberOffsets(hub,members,R){
 const squash=.8,topics=members.filter(p=>p.record?.kind==='topic'),placed=new Map(),phase=hashSeed(hub.key+':radial-phase')*Math.PI*2,weights=topics.map(t=>Math.max(1,Math.sqrt(members.filter(p=>p.clusterTopic===t.key).length))),total=weights.reduce((a,b)=>a+b,0)||1,sectors=new Map();let edge=phase;
 const clear=(p,o)=>{const half=p.size/2+10;if(Math.hypot(...o)<(hub.size+p.size)/2+22)return false;if(Math.abs(o[0])<86+half&&o[1]>hub.size/2+4-half&&o[1]<hub.size/2+48+half)return false;const sector=sectors.get(p.clusterTopic||p.key);if(sector&&sector.width<6){const tau=Math.PI*2,a=sector.min+((Math.atan2(o[1]/squash,o[0])-sector.min)%tau+tau)%tau,pad=Math.asin(Math.min(1,(p.size*.52+7)/squash/Math.hypot(o[0],o[1]/squash)));if(a-sector.min<pad||sector.max-a<pad)return false;}return [...placed].every(([key,q])=>{const other=members.find(m=>m.key===key);return Math.hypot(o[0]-q[0],o[1]-q[1])>=(p.size+other.size)/2+13;});};
 topics.forEach((t,i)=>{const width=Math.PI*2*weights[i]/total,jitter=(scatter(t.key+':heading')-.5)*Math.min(.45,width*.28);sectors.set(t.key,{min:edge+.06,max:edge+width-.06,angle:edge+width/2+jitter,width,radius:.88+scatter(t.key+':reach')*.24});edge+=width;});
 // Place each theme close to its domain independently. A blocked caption or a
 // crowded sector should not inflate the radius of every other theme as well.
 for(const t of topics){const sector=sectors.get(t.key),preferred=sector.angle,angles=[preferred,...Array.from({length:25},(_,i)=>sector.min+(sector.max-sector.min)*(i+.5)/25)].sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred));let found;
  for(let row=0;row<38&&!found;row++)for(const a of angles){const unit=Math.hypot(Math.cos(a),squash*Math.sin(a)),r=((hub.size+t.size)/2+24+scatter(t.key+':reach')*16)/unit+row*6,o=[Math.cos(a)*r,Math.sin(a)*r*squash];if(r+t.size/squash/2+12<=R&&clear(t,o)){found=o;sector.angle=a;break;}}
  if(!found)throw Error('More room required for radial topics');placed.set(t.key,found);
 }
 for(const p of members.filter(p=>p.record?.kind!=='topic')){const sector=sectors.get(p.clusterTopic),parent=placed.get(p.clusterTopic),lo=sector?.min??phase,hi=sector?.max??phase+Math.PI*2,base=lo+(hi-lo)*(.12+scatter(p.key+':fan')*.76);let found;
  for(let row=0;row<24&&!found;row++){const radius=(parent?Math.hypot(parent[0],parent[1]/squash):hub.size/2+80)+(sector?94:0)+scatter(p.key+':length')*24+row*24;if(radius+p.size/squash/2+12>R)break;const angles=[...Array.from({length:49},(_,i)=>lo+(hi-lo)*(i+.5)/49),base].sort((a,b)=>Math.abs(a-base)-Math.abs(b-base));
   for(const a of angles){const o=[Math.cos(a)*radius,Math.sin(a)*radius*squash];if(parent&&((o[0]-parent[0])*parent[0]+(o[1]-parent[1])*parent[1]<=0||Math.hypot(...o)<Math.hypot(...parent)+40))continue;if(clear(p,o)){found=o;break;}}
  }if(!found)throw Error('More room required for radial posts');placed.set(p.key,found);
 }
 return members.map(p=>placed.get(p.key));
}

// Mix identifiers before scattering so neighbouring IDs do not form a regular fan.
function scatter(key){let h=(hashSeed(key)*4294967295)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return ((h^(h>>>16))>>>0)/4294967295;}

export function constrainOutwardGrowth(points,pinned=null){
 for(const p of points.values()){if(!p.owner||!p.clusterTopic||p.key===pinned)continue;const hub=points.get(p.owner),parent=points.get(p.clusterTopic);if(!hub||!parent)continue;const dx=parent.x-hub.x,dy=parent.y-hub.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,along=(p.x-parent.x)*ux+(p.y-parent.y)*uy;if(along<38){p.x+=ux*(38-along);p.y+=uy*(38-along);if(p.offset)p.offset=[p.x-hub.x,p.y-hub.y];}}
}

export function cellularCurve(edge,points){
 const parent=points.get(edge.from),child=points.get(edge.to),kind=child?.record.kind,seed=scatter(edge.key||edge.to),bend=kind==='topic'?.17+seed*.13:.14+seed*.12;
 if(parent?.record.kind==='topic'){const hub=points.get(parent.owner),h=hub&&Math.atan2(parent.y-hub.y,parent.x-hub.x),a=Math.atan2(child.y-parent.y,child.x-parent.x);if(h!=null){const delta=Math.atan2(Math.sin(a-h),Math.cos(a-h));return {bend,flip:delta<0?1:-1};}}
 return {bend,flip:seed>.5?1:-1};
}

export function cellSurface(index=0){return {fill:.075+(index%4)*.013,halo:.012+(index%3)*.004,stroke:.52+(index%3)*.04};}
