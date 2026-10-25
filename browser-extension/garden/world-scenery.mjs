import {identity} from './schema.mjs';
import {footprint,intersects} from './spacing.mjs';

// World-space anchors: the same coordinate always has the same ornament.
export function sceneryPockets(points,bounds,{level=1}={}){
 const boxes=[...points.values()].map(p=>footprint(p,34)),spots=[],step=240;
 for(let gx=Math.floor(bounds.left/step)-1;gx<=Math.ceil(bounds.right/step)+1;gx++)for(let gy=Math.floor(bounds.top/step)-1;gy<=Math.ceil(bounds.bottom/step)+1;gy++){
  const key=`ground:${gx}:${gy}`,seed=identity(key);if(seed%5)continue;
  const x=gx*step+45+(seed>>>5)%130,y=gy*step+45+(seed>>>13)%130;
  if(x<bounds.left-50||x>bounds.right+50||y<bounds.top-50||y>bounds.bottom+50)continue;
  const box={left:x-42,right:x+42,top:y-43,bottom:y+43};
  if(boxes.some(b=>intersects(box,b)))continue;
  spots.push({key,x,y,kind:(seed>>>9)%3,size:44+(seed>>>17)%12,angle:(seed>>>20)%36-18,seed});
 }
 return spots.sort((a,b)=>a.seed-b.seed).slice(0,Math.min(12,5+level));
}
