import {mountColonyBorder} from './colony-borders.mjs';
import {glassify} from './glass-bubble.mjs';
import {createBreathing} from './garden-life.mjs';
import {mountCentreEmblem} from './centre-emblem.mjs';
import {setRegionExpression,regionExpression} from './appearance-remix.mjs';
import {elementArt,artStyle} from './art.mjs';
const ns='http://www.w3.org/2000/svg',breathing=createBreathing(),host=document.getElementById('examples');
const el=(tag,attrs={},parent)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent?.append(n);return n;};
function plant(svg,x,y,size,level){const f=el('foreignObject',{x:x-size/2,y:y-size/2,width:size,height:size},svg),d=document.createElement('div');d.style.cssText=artStyle(elementArt('P07',level,'paperlight'),size);f.append(d);}
for(const [expression,title,note]of [['dashed','01 · 虚线涟漪','短虚线与点线配合，一层浅绿边晕，外围轻轻呼吸。'],['interlaced','02 · 双圈交织','两条略有错位的细线交织，外缘保留浅绿波纹。']]){
 const article=document.createElement('article'),h=document.createElement('h2'),p=document.createElement('p');h.textContent=title;p.textContent=note;article.append(h,p);
 const svg=el('svg',{viewBox:'0 0 560 400',role:'img','aria-label':title+'，领域和中心标识对照'},article),core=el('g',{transform:'translate(110 100)'},svg);mountCentreEmblem(core,{svgEl:el,breathing,radius:49,imageSize:98,expression});
 const group=el('g',{class:'garden-plot',transform:'translate(300 265)'},svg);mountColonyBorder(group,{theme:'paperlight',rx:205,ry:96,seed:'domain:consumer-products',color:'#a2ad76',breathing,frosted:true,expression});glassify(svg,group,{color:'#a2ad76',expression});
 for(const[x,y]of [[188,237],[408,228],[408,305]])el('path',{d:`M300 268 Q ${x<300?216:378} ${y<260?280:271} ${x} ${y}`,fill:'none',stroke:'#9eaf82','stroke-width':1.5},svg);
 plant(svg,300,268,77,0);for(const[x,y]of [[188,237],[408,228],[408,305]])plant(svg,x,y,42,2);
 const button=document.createElement('button');button.textContent='应用「'+title.slice(5)+'」';button.dataset.expression=expression;button.onclick=()=>{if(!setRegionExpression(expression))return;sync();document.getElementById('status').textContent='已应用，打开的花园会同步更新。';window.dispatchEvent(new Event('kumo:appearance-change'));};article.append(button);host.append(article);
}
function sync(){for(const b of host.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.expression===regionExpression().id));}sync();addEventListener('pagehide',()=>breathing.stop());
