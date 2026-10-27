import {centreLogo,regionExpression} from './appearance-remix.mjs';
import {organicPath} from './garden-life.mjs';
import {mountRippleOutline} from './ripple-outline.mjs';
let serial=0;
export function mountCentreEmblem(host,{svgEl,breathing,radius=143,imageSize=280,storage,expression:choice}){
 const expression=(choice||regionExpression(storage).id)==='dashed'?'dashed':'interlaced';
 host.classList.add('centre-emblem');host.setAttribute('data-outline',expression);
 const chosen=centreLogo(storage),r=Math.max(radius*1.07,chosen.original?0:imageSize*.64),build=(x,y,s,t,o)=>organicPath(x,y,'centre-emblem',t,{...o,wobble:.38}),main=svgEl('path',{class:'emblem-main',fill:'none'},host);
 const item=breathing?.add(main,r,r*.98,'centre-emblem',.38,build);if(!breathing)main.setAttribute('d',build(r,r*.98,0,0,{}));
 mountRippleOutline(host,{rx:r,ry:r*.98,seed:'centre-emblem',breathing,build,main:item,expression,wobble:.38});
 const defs=svgEl('defs',{},host),id='centre-emblem-'+(++serial),clip=svgEl('clipPath',{id},defs);
 svgEl('circle',{r:chosen.original?radius:imageSize/2},clip);
 const logoSize=chosen.original?imageSize*.62:imageSize,logo=svgEl('svg',{x:-logoSize/2,y:-logoSize/2,width:logoSize,height:logoSize,viewBox:chosen.original?'70.5 70.5 48 48':'0 0 100 100',overflow:'hidden','clip-path':'url(#'+id+')'},host);
 // The clip belongs to the host coordinates; clip the outer group, not the nested viewBox.
 logo.removeAttribute('clip-path');const clipped=svgEl('g',{'clip-path':'url(#'+id+')'},host);clipped.append(logo);
 svgEl('image',chosen.original?{href:chosen.href,width:1410,height:1115}:{href:chosen.href,width:100,height:100},logo);
 return {chosen,main,rings:host.querySelectorAll('.outline-interweave,.outline-green-halo,.outline-ripple')};
}
