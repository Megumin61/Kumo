// Small, quiet ground patches reveal real topic clusters within a domain.
export function topicHabitats(points){
 const all=[...points.values()],out=[];
 for(const topic of all.filter(p=>p.record.kind==='topic'&&p.owner)){
  const members=all.filter(p=>p.owner===topic.owner&&p.clusterTopic===topic.key);if(!members.length)continue;
  const group=[topic,...members],left=Math.min(...group.map(p=>p.x-p.size*.5)),right=Math.max(...group.map(p=>p.x+p.size*.5)),top=Math.min(...group.map(p=>p.y-p.size*.5)),bottom=Math.max(...group.map(p=>p.y+p.size*.5));
  const x=(left+right)/2,y=(top+bottom)/2,hull=convexHull(group.flatMap(p=>Array.from({length:20},(_,i)=>{const a=i/20*Math.PI*2,r=p.size*.52+4;return [p.x+Math.cos(a)*r-x,p.y+Math.sin(a)*r-y];})));
  out.push({key:topic.key,owner:topic.owner,x,y,rx:(right-left)/2+9,ry:(bottom-top)/2+9,hull,members:members.map(p=>p.key)});
 }
 return out;
}

function convexHull(points){const sorted=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]),half=values=>{const out=[];for(const p of values){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}return out;};return [...half(sorted).slice(0,-1),...half([...sorted].reverse()).slice(0,-1)];}
export function topicBoundaryPath(region){const p=region.hull;if(!p?.length)return '';const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2],f=a=>a.map(v=>v.toFixed(2)).join(' ');let d='M '+f(mid(p.at(-1),p[0]));for(let i=0;i<p.length;i++)d+=' Q '+f(p[i])+' '+f(mid(p[i],p[(i+1)%p.length]));return d+' Z';}

// Topic headers stay on the screen, clear of node artwork and one another.
export function topicLabelPlacements(points,regions,{states,zoom=1,pan=[0,0],width,height}={}){
 const placed=[],boxes=[{left:0,right:width,top:0,bottom:62}];
 const intersect=(a,b)=>Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);
 for(const p of points.values())if(states.get(p.key)?.visible){const x=p.x*zoom+pan[0],y=p.y*zoom+pan[1],rx=p.size*zoom/2+9;boxes.push({left:x-rx,right:x+rx,top:y-rx,bottom:y+rx+23});}
 for(const r of regions){const s=states.get(r.key),record=points.get(r.key).record;if(!s?.visible||s.opacity<=.25||zoom<.42&&s.role!=='primary')continue;const x=r.x*zoom+pan[0],y=r.y*zoom+pan[1],rx=r.rx*zoom,ry=r.ry*zoom,w=Math.min(198,(Math.min(12,Array.from(record.name).length)+7)*11+16),h=22;
  for(const [cx,cy]of [[x,y-ry],[x-30,y-ry-25],[x+30,y-ry-25],[x,y+ry+15],[x-rx,y],[x+rx,y]]){const box={left:cx-w/2-4,right:cx+w/2+4,top:cy-h/2-3,bottom:cy+h/2+3};if(box.left<12||box.right>width-12||box.top<12||box.bottom>height-60||boxes.some(b=>intersect(box,b)))continue;placed.push({key:r.key,x:cx,y:cy,width:w,box});boxes.push(box);break;}
 }
 return placed;
}
