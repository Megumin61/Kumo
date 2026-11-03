// Zoom only changes annotations; every mounted node keeps its identity and visibility.
export function scaleDetail(points,zoom,selected){const result=new Map();for(const p of points.values()){
 const kind=p.record.kind,domain=kind==='domain'||kind==='brand'||!p.owner&&!p.parent;
 result.set(p.key,{visible:true,label:domain||p.key===selected||kind!=='source'&&zoom>=.35,badge:kind!=='source'&&kind!=='brand'&&(zoom>=.3||p.key===selected)});
}return result;}
