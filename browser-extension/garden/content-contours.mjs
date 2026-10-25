import {cellularCurve} from './cellular-growth.mjs';
const TAU=Math.PI*2;
const blurKernel=Array.from({length:29},(_,i)=>Math.exp(-.5*((i-14)/5.5)**2)),blurSum=blurKernel.reduce((a,b)=>a+b,0),liftKernel=Array.from({length:65},(_,i)=>Math.exp(-.5*(i/7.5)**2));
// Periodic Gaussian smoothing removes the cusps made by taking a hard maximum.
// Broad, smooth lifts preserve coverage without bringing those corners back.
export function softenEnvelope(required){const n=required.length,out=required.map((_,i)=>blurKernel.reduce((sum,w,j)=>sum+w*required[(i+j-14+n)%n],0)/blurSum+10);
 for(let pass=0;pass<24;pass++){let deficit=0,index=0;for(let i=0;i<n;i++)if(required[i]+10-out[i]>deficit){deficit=required[i]+10-out[i];index=i;}if(deficit<.01)break;for(let i=0;i<n;i++){const d=Math.min(Math.abs(i-index),n-Math.abs(i-index));out[i]+=deficit*(liftKernel[d]??Math.exp(-.5*(d/7.5)**2));}}
 return out;
}
export function smoothClosedPath(points){const n=points.length,blend=(a,b,c)=>[(a[0]+4*b[0]+c[0])/6,(a[1]+4*b[1]+c[1])/6],f=p=>p.map(v=>v.toFixed(2)).join(',');let d='M'+f(blend(points[n-1],points[0],points[1]));
 for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n],c=points[(i+2)%n],c1=[(2*a[0]+b[0])/3,(2*a[1]+b[1])/3],c2=[(a[0]+2*b[0])/3,(a[1]+2*b[1])/3];d+='C'+f(c1)+','+f(c2)+','+f(blend(a,b,c));}return d+'Z';}
// A radial envelope of the real nodes and their branches, in the domain's coordinates.
export function contentEnvelope(hub,members,edges=[],points=new Map()){
 const rx=hub.plot.rx*1.035,ry=hub.plot.ry*1.035,tilt=-(hub.plot.tilt||0)*Math.PI/180,c=Math.cos(tilt),s=Math.sin(tilt),discs=[];
 const put=(x,y,r)=>{const dx=x-hub.x,dy=y-hub.y;discs.push({x:dx*c-dy*s,y:dx*s+dy*c,r});};
 put(hub.x,hub.y,hub.size/2+30);
 // The label under the central domain remains part of its content footprint.
 for(const x of [-72,0,72])put(hub.x+x,hub.y+hub.size/2+29,30);
 for(const p of members)put(p.x,p.y,p.size/2+31);
 for(const e of edges){const a=points.get(e.from),b=points.get(e.to);if(!a||!b||b.owner!==hub.key||e.kind!=='membership')continue;const {bend,flip}=cellularCurve(e,points),cx=(a.x+b.x)/2-(b.y-a.y)*bend*flip,cy=(a.y+b.y)/2+(b.x-a.x)*bend*flip;for(let j=1;j<8;j++){const t=j/8,u=1-t;put(u*u*a.x+2*u*t*cx+t*t*b.x,u*u*a.y+2*u*t*cy+t*t*b.y,16);}}
 const samples=128,required=[];
 for(let i=0;i<samples;i++){const a=i/samples*TAU,dx=Math.cos(a),dy=Math.sin(a);let r=hub.size/2+30;for(const d of discs){const along=d.x*dx+d.y*dy,perp=d.x*dy-d.y*dx;if(Math.abs(perp)>d.r)continue;r=Math.max(r,along+Math.sqrt(Math.max(0,d.r*d.r-perp*perp)));}required.push(r);}
 // Broaden dense lobes instead of drawing a separate bump around every post.
 const radii=softenEnvelope(required);
 return {rx,ry,radii,required};
}
export function envelopeAt(envelope,a){if(!envelope?.radii?.length)return null;const n=envelope.radii.length,t=((a%TAU)+TAU)%TAU/TAU*n,i=Math.floor(t),f=t-i;return envelope.radii[i%n]*(1-f)+envelope.radii[(i+1)%n]*f;}
export function syncContentEnvelopes(layout){const all=[...layout.points.values()];for(const hub of all.filter(p=>!p.owner&&p.plot&&!p.discovery)){const next=contentEnvelope(hub,all.filter(p=>p.owner===hub.key),layout.edges,layout.points);if(hub.plot.envelope)Object.assign(hub.plot.envelope,next);else hub.plot.envelope=next;}return layout;}
