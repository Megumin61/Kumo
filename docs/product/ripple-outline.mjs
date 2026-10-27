// Border-only layers: the region fill and its actual content never get texture.
export function rippleOutlineSpecs(expression='interlaced'){
 return [
  ...(expression==='interlaced'?[{className:'outline-interweave',scale:1,shift:.065}]:[]),
  {className:'outline-green-halo',scale:1.10,shift:0},
  {className:'outline-ripple',scale:1.135,shift:.008}
 ];
}
export function mountRippleOutline(host,{rx,ry,seed,breathing,build,main=null,expression='interlaced',tilt=0,wobble=1}){
 const out=[];
 for(const spec of rippleOutlineSpecs(expression)){
  const path=host.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('class',spec.className);path.setAttribute('fill',spec.className==='outline-green-halo'?'#b8c99e':'none');if(spec.className==='outline-green-halo')path.setAttribute('fill-rule','evenodd');
  if(tilt)path.setAttribute('transform','rotate('+tilt+')');host.append(path);
  // Opposite x/y stretch lets the second contour cross the first at four edges.
  const builder=(x,y,s,t,o)=>{
   const d=build(x,y,seed,t,o);if(spec.className==='outline-green-halo')return d+' '+build(x*.935,y*.935,seed,t,o);if(!spec.shift)return d;
   // Deform coordinates (not just ellipse radii), also works with data-shaped outlines.
   let coordinate=0;return d.replace(/-?\d+(?:\.\d+)?/g,value=>{const axis=coordinate++%2,n=Number(value);return (n*(axis?1-spec.shift:1+spec.shift)+(axis?x*.008:y*.012)*Math.sin((axis?1.1:.4)+t*.04)).toFixed(2);});
  };
  if(breathing){const item=breathing.add(path,rx*spec.scale,ry*spec.scale,seed,wobble,builder);item.follow=main;out.push(item);}
  else path.setAttribute('d',builder(rx*spec.scale,ry*spec.scale,seed,0,{wobble}));
 }
 return out;
}
