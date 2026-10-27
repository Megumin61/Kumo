// Only the inter-domain roots are masked. Internal topic/post branches stay visible.
export function mountRootMask({svgEl,container,roots,hubs,core,breathing,bubbleOf,id}){
 const defs=svgEl('defs',{},container),mask=svgEl('mask',{id,maskUnits:'userSpaceOnUse',style:'mask-type:luminance'},defs),cutouts=[],background=svgEl('rect',{fill:'white'},mask);
 for(const hub of hubs){const main=bubbleOf.get('patch:'+hub.key);if(!main)continue;const path=svgEl('path',{fill:'black',stroke:'black','stroke-width':1,'data-root-cutout':hub.key},mask),item=breathing.add(path,main.rx,main.ry,hub.key,main.wobble,main.pathBuilder);item.follow=main;cutouts.push({hub,path,main});}
 roots.setAttribute('mask','url(#'+id+')');
 const sync=()=>{for(const {hub,path,main}of cutouts){path.setAttribute('transform','translate('+hub.x+' '+(hub.y+(hub.plot?.cy||0))+') rotate('+(hub.plot?.tilt||0)+')');const d=main.el?.getAttribute?.('d');if(d)path.setAttribute('d',d);}
  const cx=core?.x??hubs[0]?.x??0,cy=core?.y??hubs[0]?.y??0,left=Math.min(cx,...hubs.map(h=>h.x-(h.plot?.rx||h.size||200)*1.4))-80,right=Math.max(cx,...hubs.map(h=>h.x+(h.plot?.rx||h.size||200)*1.4))+80,top=Math.min(cy,...hubs.map(h=>h.y-(h.plot?.ry||h.size||200)*1.4))-80,bottom=Math.max(cy,...hubs.map(h=>h.y+(h.plot?.ry||h.size||200)*1.4))+80;
  for(const el of [mask,background])for(const [k,v]of Object.entries({x:left,y:top,width:right-left,height:bottom-top}))el.setAttribute(k,v);
 };sync();return {sync,cutouts};
}
