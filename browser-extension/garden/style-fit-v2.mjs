import {gardenStyles} from './garden-styles.mjs';
import {paperSurface} from './paper-surfaces.mjs';
import {atmosphereFor,propArt} from './style-atmosphere.mjs';
import {catalogueArt} from './garden-catalogue.mjs';
import {artStyle} from './art.mjs';
import {mountColonyBorder} from './colony-borders.mjs';
import {growthFromCounts} from './garden-growth.mjs';
import {createBreathing} from './garden-life.mjs';
const host=document.getElementById('styles'),breath=createBreathing(),NS='http://www.w3.org/2000/svg';
const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
function art(a,size){const e=el('span');e.style.cssText=artStyle(a,size);return e;}
for(const [i,[key,style]]of Object.entries(gardenStyles).entries()){
 const medium=atmosphereFor(key),paper=paperSurface(key,style),card=el('article');card.style.cssText=`background-color:${paper.color};background-image:${paper.image};background-size:${paper.size};background-repeat:${paper.repeat};--garden-font:${medium.font};--garden-heading-font:${medium.heading};--style-accent:${style.palette[2]}`;
 card.dataset.gardenStyle=key;card.append(el('h2',style.name),el('p',medium.note));
 const nodes=el('div');nodes.className='nodes';for(const id of ['P01','P02','P03','P10'])nodes.append(art(catalogueArt(id,key),58));card.append(nodes);
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 340 165');svg.setAttribute('class','patch');for(const [x,rx,n]of [[70,48,1],[238,81,25]]){const g=document.createElementNS(NS,'g');g.setAttribute('transform','translate('+x+' 73)');mountColonyBorder(g,{theme:key,rx,ry:rx*.65,seed:key,color:style.palette[1],breathing:breath,growth:growthFromCounts(n,n)});svg.append(g);const t=document.createElementNS(NS,'text');t.setAttribute('x',x);t.setAttribute('y','152');t.setAttribute('text-anchor','middle');t.textContent=n===1?'幼苗 · 安静的一小片':'成林 · 更多枝叶与起伏';svg.append(t);}card.append(svg);
 const props=el('div');props.className='props';for(let j=0;j<4;j++){const a=propArt(key,j),span=art(a,58);span.title=a.label;props.append(span);}card.append(props,el('small',medium.props.join(' · ')));
 const details=el('details'),summary=el('summary','查看本轮参考图'),img=el('img');img.src='assets/style-studies-v2/references/reference-'+String(i+1).padStart(2,'0')+'.png';img.alt=style.name+'参考图';details.append(summary,img);card.append(details);const link=el('a','在花园里看这套风格 ↗');link.href='garden-v16.html#theme='+key;card.append(link);host.append(card);
}
addEventListener('pagehide',()=>breath.stop(),{once:true});
