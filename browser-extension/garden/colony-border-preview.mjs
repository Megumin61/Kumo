import {mountColonyBorder} from './colony-borders.mjs';
export function colonyBorderPreview(theme,makeArt,color){
 const host=document.createElement('span');host.className='style-card-samples colony-style-swatch';host.setAttribute('aria-hidden','true');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 144 106');svg.setAttribute('width','144');svg.setAttribute('height','106');
 const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('transform','translate(72 53)');svg.append(g);mountColonyBorder(g,{theme,rx:52,ry:35,seed:.31,color});host.append(svg);
 for(const [id,size,level,cls]of [['P01',59,0,'swatch-main'],['P02',25,2,'swatch-leaf-a'],['P03',27,1,'swatch-leaf-b']]){const node=makeArt(id,size,theme,level);node.classList.add(cls);host.append(node);}
 return host;
}
