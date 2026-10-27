import {ROOT} from './schema.mjs';
import {hashSeed} from './garden-life.mjs';
import {stageOf} from './fragment-buds.mjs';

// A branch gets its own two fragments. Ancestor and sibling fragments never leak in.
export function scopedFragmentPlan(layout,byDomain,selected=ROOT,{mode='converge'}={}){
 const all=[...byDomain.values()].flat(),chosen=layout.points.get(selected),current=mode==='field'?selected:layout.navigation?.current||ROOT;
 if(chosen?.record.kind==='source')return [];
 const isRoot=current===ROOT||!layout.points.has(current),candidates=isRoot?[...layout.points.values()].filter(p=>!p.owner&&!p.discovery&&!p.relatedPeek&&p.record.kind==='domain').sort((a,b)=>(b.record.displayCount||b.record.members?.length||0)-(a.record.displayCount||a.record.members?.length||0)).slice(0,mode==='field'?5:3):[layout.points.get(current)];
 return candidates.map(point=>{const r=point.record,members=new Set(r.displayMembers||r.members||[]);let list=(r.kind==='domain'&&byDomain.get(r.key)?.length?byDomain.get(r.key):all).filter(f=>r.kind==='topic'?(f.topicKey===r.key||members.has(f.source.key)):f.domainKey===r.key||members.has(f.source.key));
  if(r.kind==='topic')list.sort((a,b)=>Number(b.topicKey===r.key)-Number(a.topicKey===r.key));const unique=new Set();list=list.filter(f=>{if(unique.has(f.source.key))return false;unique.add(f.source.key);return true;});return {point,frags:list.slice(0,isRoot?1:2)};
 }).filter(p=>p.frags.length);
}
export function hierarchySamples(layout){return layout.edges.filter(e=>e.kind==='hierarchy').flatMap(e=>{
 const a=layout.points.get(e.from),b=layout.points.get(e.to);if(!a||!b)return [];const x1=a.x+(b.x-a.x)*.55,x2=a.x+(b.x-a.x)*.5;return Array.from({length:33},(_,i)=>{const t=i/32,u=1-t;return [u**3*a.x+3*u*u*t*x1+3*u*t*t*x2+t**3*b.x,u**3*a.y+3*u*u*t*a.y+3*u*t*t*b.y+t**3*b.y];});
 });}
// Side shoots leave perpendicular to the incoming stem and avoid both nodes and veins.
export function outwardFragmentSpots(layout,plan){
 const points=[...layout.points.values()],stems=hierarchySamples(layout),out=[];
 for(const {point:h,frags}of plan){const parent=layout.points.get(h.parent),dx=parent?h.x-parent.x:1,dy=parent?h.y-parent.y:0,base=Math.atan2(dy,dx)+Math.PI/2,preferred=hashSeed(h.key+':side')>.5?1:-1;
  for(const [i,frag]of frags.entries()){let found=null;
   for(const extra of [0,36,76,122,174]){for(const turn of [0,.22,-.22,.45,-.45,.7,-.7,1,-1]){for(const side of [preferred*(i%2?-1:1),-preferred*(i%2?-1:1)]){
    const angle=base+(side<0?Math.PI:0)+turn,growthReach=Math.min(44,Math.sqrt(h.record.displayCount||h.record.members?.length||0)*7),r=h.size/2+86+growthReach+extra,x=h.x+Math.cos(angle)*r,y=h.y+Math.sin(angle)*r,ar=h.size*.43,anchor=[h.x+Math.cos(angle)*ar,h.y+Math.sin(angle)*ar],flip=side,ex=x-anchor[0],ey=y-anchor[1],c=[(x+anchor[0])/2-ey*.14*flip,(y+anchor[1])/2+ex*.14*flip];
    const curve=Array.from({length:25},(_,j)=>{const t=j/24,u=1-t;return [u*u*anchor[0]+2*u*t*c[0]+t*t*x,u*u*anchor[1]+2*u*t*c[1]+t*t*y];});
    const nodeClear=points.every(p=>p===h||Math.abs(x-p.x)>(p.preview?p.cardWidth/2:p.size/2)+36||Math.abs(y-p.y)>(p.preview?p.cardHeight/2:p.size/2)+42);
    const clear=nodeClear&&out.every(s=>Math.hypot(s.x-x,s.y-y)>88)&&curve.every(([px,py])=>points.every(p=>p===h||Math.hypot(px-p.x,py-p.y)>p.size/2+17)&&stems.every(([sx,sy])=>Math.hypot(sx-h.x,sy-h.y)<h.size/2+20||Math.hypot(px-sx,py-sy)>19));
    if(clear){found={x,y,anchor,frag,domainKey:h.key,stage:stageOf(frag),flip};break;}
   }if(found)break;}if(found)break;}
   if(found)out.push(found);
  }
 }
 return out;
}

export function structuralEdge(edge,points){
 if(edge.kind==='hierarchy')return true;if(edge.kind!=='membership')return false;
 const from=points.get(edge.from)?.record.kind,to=points.get(edge.to)?.record.kind;
 return (['domain','pending','unassigned'].includes(from)&&(to==='topic'||to==='source'&&!points.get(edge.to).clusterTopic))||(from==='topic'&&to==='source');
}
