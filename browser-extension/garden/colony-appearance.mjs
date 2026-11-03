import {hashSeed} from './garden-life.mjs';
import {availableGardenStyles,normalizeGardenStyle} from './garden-styles.mjs';

// Distinct, muted inks: all colonies in the same map receive different swatches
// before a swatch is reused. Their paper tint still follows the selected style.
const inks=['#d27e69','#85b577','#dbb85d','#79abc9','#b897ce','#6ebeb3','#dfa777','#adbb7c'];
const blend=(a,b,t)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
export function colonyColorsFor(theme,ids){
 const style=availableGardenStyles[normalizeGardenStyle(theme)],paper=style.palette[0];
 const tint=theme==='camping-pop'?.03:theme==='daily-doodle'||theme==='woodland-seal'?.12:.07;
 const palette=['#7da88d','#a8b66e','#b5a36c','#80aaa0','#c2b66a','#89a66d','#a5b9a1','#b5bd84','#9ba572','#8bb39a','#aea47d','#9db5ae'];
 const swatches=palette.map((ink,i)=>blend(ink,paper,Math.min(.32,tint+(i%2)*.025)));
 return new Map([...new Set(ids)].sort().map((id,i)=>[id,blend(swatches[i%swatches.length],paper,Math.min(.6,Math.floor(i/swatches.length)*.14))]));
}

// Domain symbols stay equal. Contents grow the surrounding ground, not the symbol.
export function domainNodeSize(view='field'){return view==='converge'?176:224;}
export function memberNodeSize(record,domainSize=164){
 const variation=hashSeed(record.key||record.id||record.name||'member');
 return record.kind==='topic'?108+variation*4:88+variation*6;
}
export function colonyRayRadius(h,angle){if(!h.plot)return h.size/2;const {rx,ry,cy=0}=h.plot,c=Math.cos(angle),s=Math.sin(angle),a=(c/rx)**2+(s/ry)**2,b=-2*cy*s/ry**2,d=(cy/ry)**2-1;return (-b+Math.sqrt(Math.max(0,b*b-4*a*d)))/(2*a);}

function contentBounds(layout,hub){
 const envelope=hub.plot?.envelope,pts=[];
 if(envelope?.radii?.length){const tilt=(hub.plot.tilt||0)*Math.PI/180,c=Math.cos(tilt),s=Math.sin(tilt);envelope.radii.forEach((r,i)=>{const a=i/envelope.radii.length*Math.PI*2,x=Math.cos(a)*r*1.08,y=Math.sin(a)*r*1.08;pts.push([hub.x+x*c-y*s,hub.y+(hub.plot.cy||0)+x*s+y*c]);});}
 for(const p of layout.points.values())if(p.key===hub.key||p.owner===hub.key)pts.push([p.x-p.size/2-30,p.y-p.size/2-20],[p.x+p.size/2+30,p.y+p.size/2+48]);
 return {left:Math.min(...pts.map(p=>p[0])),right:Math.max(...pts.map(p=>p[0])),top:Math.min(...pts.map(p=>p[1])),bottom:Math.max(...pts.map(p=>p[1]))};
}
export function fieldCameraFrame(layout,{width,height,selected,panel=false}){
 const point=layout.points.get(selected),hub=point?(point.owner?layout.points.get(point.owner):point):null;
 const focus=hub?.colonyR?hub:null;
 const boxes=layout.displayWindow?(focus?[contentBounds(layout,focus)]:[...layout.points.values()].filter(p=>!p.owner&&p.plot).map(h=>contentBounds(layout,h))):focus?[{left:focus.x-focus.plot.rx*1.25,right:focus.x+focus.plot.rx*1.25,top:focus.y+(focus.plot.cy||0)-focus.plot.ry*1.25,bottom:focus.y+(focus.plot.cy||0)+focus.plot.ry*1.25+30}]:layout.reserved;
 if(!boxes?.length)return null;
 const left=Math.min(...boxes.map(b=>b.left)),right=Math.max(...boxes.map(b=>b.right)),top=Math.min(...boxes.map(b=>b.top)),bottom=Math.max(...boxes.map(b=>b.bottom));
 const usableHeight=focus?height*.94:height,zoom=Math.min(focus?1.2:1,(width-36)/Math.max(1,right-left),(usableHeight-36)/Math.max(1,bottom-top));
 return {zoom:Math.max(.025,zoom),center:{x:(left+right)/2,y:(top+bottom)/2},screenY:usableHeight/2};
}
