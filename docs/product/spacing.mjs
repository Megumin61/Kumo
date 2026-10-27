export function footprint(p,padding=10){
 if(p.preview)return {left:p.x-p.cardWidth/2-padding,right:p.x+p.cardWidth/2+padding,top:p.y-p.cardHeight/2-padding,bottom:p.y+p.cardHeight/2+padding};
 const r=p.size/2,label=p.record.kind==='source'?45:Math.max(80,Array.from(p.record.name||'').length*8.5);
 return {left:p.x-Math.max(r,label)-padding,right:p.x+Math.max(r,label)+padding,top:p.y-r-padding,bottom:p.y+r+48+padding};
}
export function intersects(a,b){return Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top);}
export function separate(points,fixed=new Set()){
 const items=[...points.values()];for(let pass=0;pass<220;pass++){let moved=false;
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],pa=fixed.has(a.key),pb=fixed.has(b.key);if(pa&&pb)continue;const aa=footprint(a),bb=footprint(b);if(!intersects(aa,bb))continue;const dx=aa.left<bb.left?aa.right-bb.left:bb.right-aa.left,dy=aa.top<bb.top?aa.bottom-bb.top:bb.bottom-aa.top,axis=dx<dy?'x':'y',distance=(axis==='x'?dx:dy)+1,sign=a[axis]<=b[axis]?-1:1;if(!pa)a[axis]+=sign*distance*(pb?1:.5);if(!pb)b[axis]-=sign*distance*(pa?1:.5);moved=true;}
 if(!moved)break;}return points;
}
