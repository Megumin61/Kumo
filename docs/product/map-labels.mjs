// Overview: large domains. Zoom in: smaller domains, then topics and sources.
export function labelVisible(point,zoom,selected){
 if(point.key===selected)return true;
 if(point.discovery||point.landmark)return zoom>=.5;
 const count=point.record.displayCount??point.record.count??0;
 if(!point.owner)return zoom>=.55||count>=3;
 if(point.record.kind==='topic')return zoom>=.7;
 return zoom>=1.3;
}

export function visibleMapLabels(points,zoom,selected,priority=new Set()){
 const list=[...points.values()].sort((a,b)=>Number(b.key===selected)-Number(a.key===selected)||Number(!!a.owner)-Number(!!b.owner)||(b.record.displayCount??b.record.count??0)-(a.record.displayCount??a.record.count??0)),placed=[],visible=new Set();
 for(const p of list){if(!priority.has(p.key)&&!labelVisible(p,zoom,selected))continue;const text=p.labelText||p.record.name||'',font=p.owner?11:13,w=Math.min(180,Math.max(48,Array.from(text).length*font)),x=p.x*zoom,y=(p.y+p.size/2)*zoom+18,box={left:x-w/2-5,right:x+w/2+5,top:y-13,bottom:y+6};
  if(p.key!==selected&&placed.some(b=>Math.min(box.right,b.right)>Math.max(box.left,b.left)&&Math.min(box.bottom,b.bottom)>Math.max(box.top,b.top)))continue;
  placed.push(box);visible.add(p.key);
 }
 return visible;
}
