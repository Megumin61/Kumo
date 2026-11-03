// Local spring dynamics. Cost follows one colony, not repeated global collision passes.
export function stepColonyDrag(points,{owner,pinned=null,reduced=false}={}){
 const hub=points.get(owner),changed=new Set();if(!hub)return {energy:0,changed};
 const members=[...points.values()].filter(p=>p.owner===owner),held=points.get(pinned);let energy=0;
 if(hub.key!==pinned){const home=hub.home||[hub.x,hub.y],tug=(held?.owner===owner)? .018:0;
  const fx=(home[0]-hub.x)*.06+(tug?(held.x-hub.x-held.offset[0])*tug:0),fy=(home[1]-hub.y)*.06+(tug?(held.y-hub.y-held.offset[1])*tug:0);
  hub.vx=((hub.vx||0)+fx)*.74;hub.vy=((hub.vy||0)+fy)*.74;hub.x+=hub.vx;hub.y+=hub.vy;if(Math.abs(hub.vx)+Math.abs(hub.vy)>.001)changed.add(hub.key);energy+=Math.abs(hub.vx)+Math.abs(hub.vy);
 }
 const cell=Math.max(48,...members.map(p=>p.size+12)),grid=new Map();
 for(const p of members){const key=Math.floor(p.x/cell)+','+Math.floor(p.y/cell);if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);}
 for(const p of members){if(p.key===pinned)continue;const tx=hub.x+p.offset[0],ty=hub.y+p.offset[1];let fx=(tx-p.x)*.14,fy=(ty-p.y)*.14;
  const cx=Math.floor(p.x/cell),cy=Math.floor(p.y/cell);for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const q of grid.get(x+','+y)||[]){if(q===p)continue;let dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy);const min=(p.size+q.size)/2+6;if(d<min){if(d<.001){dx=p.key<q.key?-1:1;dy=.5;d=Math.hypot(dx,dy);}const k=(min-d)*.12;fx+=dx/d*k;fy+=dy/d*k;}}
  if(reduced){p.x=tx;p.y=ty;p.vx=0;p.vy=0;}else{p.vx=((p.vx||0)+fx)*.72;p.vy=((p.vy||0)+fy)*.72;p.x+=p.vx;p.y+=p.vy;}
  if(Math.abs(p.vx)+Math.abs(p.vy)>.001||Math.abs(tx-p.x)+Math.abs(ty-p.y)>.001||reduced)changed.add(p.key);energy+=Math.abs(p.vx)+Math.abs(p.vy);
 }
 return {energy,changed};
}
