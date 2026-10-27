import {hashSeed} from './garden-life.mjs';
import {regionIdentity,regionWave} from './region-identity.mjs';
import {regionExpression} from './appearance-remix.mjs';
import {mountRippleOutline} from './ripple-outline.mjs';
import {envelopeAt,smoothClosedPath} from './content-contours.mjs';
// Quiet paper boundaries, with a different silhouette and line treatment per medium.
export const borderProfiles={
 'autumn-ink':{kind:'ink',shape:'leaf',fill:0.11,halo:0.032,stroke:0.35,width:1.1,extent:1.18,trace:true},
 'green-crayon':{kind:'crayon',shape:'soft',fill:0.115,halo:0.035,stroke:0.34,width:1.5,extent:1.19,trace:true},
 'daily-doodle':{kind:'doodle',shape:'cloud',fill:0.11,halo:0.03,stroke:0.32,width:1.2,extent:1.18},
 'woodland-seal':{kind:'seal',shape:'seal',fill:0.16,halo:0.038,stroke:0.32,width:1.1,extent:1.16,trace:true},
 'vintage-ink':{kind:'vintage',shape:'leaf',fill:0.105,halo:0.03,stroke:0.35,width:1.05,extent:1.18,trace:true},
 'field-guide':{kind:'guide',shape:'soft',fill:0.1,halo:0.028,stroke:0.4,width:1.15,extent:1.18,trace:true},
 'camping-pop':{kind:'pop',shape:'rounded',fill:0.105,halo:0.032,stroke:0.38,width:1.8,extent:1.17},
 'colored-scribble':{kind:'scribble',shape:'soft',fill:0.105,halo:0.032,stroke:0.35,width:1.1,extent:1.2,trace:true},
 paperlight:{kind:'wash',shape:'soft',fill:0.1,halo:0.038,stroke:0.3,width:1,extent:1.2},
 gardenprint:{kind:'print',shape:'rounded',fill:0.12,halo:0.035,stroke:0.35,width:1.15,extent:1.18,trace:true},
 pencilpaper:{kind:'pencil',shape:'soft',fill:0.105,halo:0.032,stroke:0.34,width:1.1,extent:1.2,trace:true}
};
const profileOf=theme=>borderProfiles[theme]||borderProfiles['green-crayon'];
export function colonyBorderPath(theme,rx,ry,seed=0,time=0,{wobble=1,envelope=null}={}){
 const {shape}=profileOf(theme),identity=regionIdentity(seed),phase=(typeof seed==='number'?seed:hashSeed(seed))*Math.PI*2,timePhase=time*.065,pts=[];
 for(let i=0;i<64;i++){
  const a=i/64*Math.PI*2,c=Math.cos(a),s=Math.sin(a);
  const broad=.075*Math.sin(2*a+phase+timePhase)+.05*Math.cos(3*a-phase*.7+timePhase*.6)+.022*Math.sin(5*a+phase*.4-timePhase*.7);
  const base=shape==='seal'?broad*.8:shape==='cloud'?broad*.85+.022*Math.cos(6*a+phase):shape==='leaf'?broad+.025*Math.sin(a+phase):broad,wave=identity?base*.2+regionWave(identity,a,time):base;
  const r=(identity?1.035:1.01)+Math.max(-.1,Math.min(identity?.kind==='leaf'?.095:.12,wave*wobble)),power=identity?.kind==='terrace'?.92:identity?.kind==='leaf'?1.08:shape==='rounded'?.95:1;
  if(envelope){const needed=envelopeAt(envelope,a),scale=Math.sqrt(rx*ry/(envelope.rx*envelope.ry)),flow=1+.009*Math.sin(a*3+phase+time*.07),reach=needed*scale*flow;pts.push([c*reach,s*reach]);}
  else pts.push([Math.sign(c)*Math.abs(c)**power*rx*r,Math.sign(s)*Math.abs(s)**power*ry*r]);
 }
 if(envelope)return smoothClosedPath(pts);
 const f=n=>n.toFixed(2);let path='M'+pts[0].map(f).join(',');
 for(let i=0;i<pts.length;i++){const a=pts[(i+63)%64],b=pts[i],c=pts[(i+1)%64],d=pts[(i+2)%64];path+='C'+[b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6,c[0],c[1]].map(f).join(',');}
 return path+'Z';
}
export function borderLayerSpecs(theme,rx,ry){const p=profileOf(theme);return [
 {className:'garden-patch-extension',rx:rx*p.extent,ry:ry*p.extent},
 {className:'garden-patch',rx:rx*1.035,ry:ry*1.035},
 ...(p.trace?[{className:'colony-border-trace',rx:rx*1.065,ry:ry*1.045}]:[])
 ];}
export function mountColonyBorder(host,{theme,rx,ry,seed=0,color,breathing,tilt=0,growth=null,subcolony=false,frosted=false,expression:chosenExpression,envelope=null}){
 const p=profileOf(theme),identity=!subcolony&&regionIdentity(seed);host.classList.add('colony-border','border-'+p.kind);if(subcolony)host.classList.add('topic-ground');if(identity)host.setAttribute('data-terrain',identity.kind);
 if(color)host.style.setProperty('--colony-color',color);
 for(const name of ['fill','halo','stroke','width'])host.style.setProperty('--colony-'+name,String(p[name]));
 host.setAttribute('data-growth',String(growth?.level||1));let main;
 for(const layer of borderLayerSpecs(theme,rx,ry)){
  const path=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class',layer.className);if(tilt)path.setAttribute('transform','rotate('+tilt+')');host.append(path);
  const build=(x,y,s,t,options)=>colonyBorderPath(theme,x,y,seed,t,{...options,envelope});
  if(breathing){const item=breathing.add(path,layer.rx,layer.ry,seed,growth?.complexity||1,build);if(layer.className==='garden-patch')main=item;}
  else path.setAttribute('d',build(layer.rx,layer.ry,seed,0,{wobble:growth?.complexity||1}));
 }
 if(frosted&&!subcolony){const expression=chosenExpression||regionExpression().id;host.setAttribute('data-outline',expression);mountRippleOutline(host,{rx:rx*1.035,ry:ry*1.035,seed,breathing,main,expression,tilt,wobble:growth?.complexity||1,build:(x,y,s,t,o)=>colonyBorderPath(theme,x,y,seed,t,{...o,envelope})});}
 // Planted edge marks are decorative; they never count as knowledge nodes.
 if(!subcolony&&!identity)for(let i=0;i<(growth?.edgeSprouts||3);i++){
  const h=hashSeed(seed+':rim:'+i),a=h*Math.PI*2,x=Math.cos(a)*rx*(.95+h*.08),y=Math.sin(a)*ry*(.95+h*.08),mark=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
  mark.setAttribute('class','habitat-edge-mark');mark.setAttribute('transform','translate('+x.toFixed(1)+' '+y.toFixed(1)+') rotate('+(a*180/Math.PI+90).toFixed(1)+') scale('+(.7+h*.45)+')');
  mark.setAttribute('d',p.kind==='seal'||p.kind==='doodle'?'M -3 0 C -8 -6 -8 -12 -3 -13 C 1 -11 2 -5 -3 0 Z M 3 5 C 2 -1 7 -7 11 -5 C 12 0 8 5 3 5 Z':'M 0 8 Q 2 -2 0 -12 M 0 1 Q -11 -1 -8 -8 Q -2 -8 0 1 M 1 -4 Q 9 -5 9 -12 Q 2 -13 1 -4');host.append(mark);
 }
 return main;
}
