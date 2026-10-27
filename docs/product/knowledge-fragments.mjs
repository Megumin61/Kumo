import {sourceMetadata,sourceIntro} from './note-presentation.mjs';
export function fragmentOf(model,record){
 const captured=String(record.capturedAt||''),date=/^\d{4}-\d{2}-\d{2}/.test(captured)?captured.slice(0,10).replaceAll('-','.'):'',domain=model.records.get(record.primary)?.name||'';
 return {key:record.key,title:record.name,meta:[date,domain||sourceMetadata(record)].filter(Boolean).join(' · '),intro:sourceIntro(record)};
}
const overlaps=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
export function fragmentPlacements(points,keys,{width,height,zoom=1,pan=[0,0],visible=new Set(points.keys()),reserved=[],allowOutside=new Set()}={}){
 const pad=12,w=Math.min(width<480?150:188,width-32),h=104,obstacles=[...reserved],placed=[];
 for(const p of points.values())if(visible.has(p.key)){const x=p.x*zoom+pan[0],y=p.y*zoom+pan[1],rx=(p.preview?p.cardWidth/2:p.size/2)*zoom+8,ry=(p.preview?p.cardHeight/2:p.size/2)*zoom+8;obstacles.push({left:x-rx,right:x+rx,top:y-ry,bottom:y+ry+20});}
 for(const key of keys.slice(0,1)){const p=points.get(key);if(!p||p.record.kind!=='source')continue;let x=p.x*zoom+pan[0],y=p.y*zoom+pan[1];const external=x<0||x>width||y<0||y>height,r=p.size/2*zoom+18;if(external){if(!allowOutside.has(key))continue;x=Math.max(20,Math.min(width-20,x));y=Math.max(90,Math.min(height-90,y));}
  const candidates=[];for(const gap of [r,r+45,r+95])for(const [dx,dy]of [[gap,-h*.5],[-gap-w,-h*.5],[-w*.5,gap],[-w*.5,-gap-h]])candidates.push({x:x+dx,y:y+dy});
  for(const q of candidates){const box={left:q.x-5,right:q.x+w+5,top:q.y-5,bottom:q.y+h+5};if(box.left<pad||box.right>width-pad||box.top<pad||box.bottom>height-pad||obstacles.some(b=>overlaps(box,b)))continue;placed.push({key,x:q.x,y:q.y,width:w,height:h,anchor:[x,y],external});obstacles.push(box);break;}
 }
 return placed;
}
