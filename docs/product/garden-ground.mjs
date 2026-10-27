import {identity} from './schema.mjs';
import {footprint,intersects} from './spacing.mjs';
export function gardenGround(points,limit=24){
 const all=[...points.values()];if(!all.length)return [];
 const boxes=all.map(p=>footprint(p,24)),left=Math.floor((Math.min(...boxes.map(b=>b.left))-75)/86),right=Math.ceil((Math.max(...boxes.map(b=>b.right))+75)/86),top=Math.floor((Math.min(...boxes.map(b=>b.top))-60)/86),bottom=Math.ceil((Math.max(...boxes.map(b=>b.bottom))+60)/86),spots=[];
 for(let gx=left;gx<=right;gx++)for(let gy=top;gy<=bottom;gy++){
  const seed=identity('garden-ground:'+gx+':'+gy),x=gx*86+(seed%31)-15,y=gy*86+((seed>>>7)%29)-14,box={left:x-17,right:x+17,top:y-17,bottom:y+17};
  if(seed%4||boxes.some(b=>intersects(box,b)))continue;
  spots.push({x,y,size:10+(seed%7),angle:(seed>>>12)%60-30,kind:(seed>>>5)%5,seed});
 }
 return spots.sort((a,b)=>a.seed-b.seed).slice(0,limit);
}
