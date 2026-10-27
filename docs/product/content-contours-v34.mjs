import {KNOWLEDGE_URL} from './garden-endpoints.mjs';
import {buildModel} from './model.mjs';
import {radialCollectionLayout} from './garden-radial.mjs';
import {mountColonyBorder} from './colony-borders.mjs';
import {glassify} from './glass-bubble.mjs';
import {createBreathing} from './garden-life.mjs';
import {elementArt,artStyle} from './art.mjs';
import {colonyColorsFor} from './colony-appearance.mjs';
import {mountCentreEmblem} from './centre-emblem.mjs';
import {cellularCurve} from './cellular-growth.mjs';
const ns='http://www.w3.org/2000/svg',breathing=createBreathing(),host=document.getElementById('examples'),el=(tag,attrs={},parent)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent?.append(n);return n;};
const core=el('svg',{viewBox:'-200 -185 400 370',role:'img','aria-label':'花园中心标识与交织边缘'},document.getElementById('core'));mountCentreEmblem(core,{svgEl:el,breathing});
try{const response=await fetch(KNOWLEDGE_URL);if(!response.ok)throw Error('数据暂不可用');const model=buildModel(await response.json()),g=radialCollectionLayout(model),all=[...g.points.values()],hubs=all.filter(p=>!p.owner).sort((a,b)=>b.record.displayCount-a.record.displayCount).slice(0,3),colors=colonyColorsFor('paperlight',hubs.map(h=>h.key));
 for(const [i,hub]of hubs.entries()){const article=document.createElement('article'),title=document.createElement('h2'),caption=document.createElement('p');title.textContent=hub.record.name;caption.textContent=hub.growth.count+' 篇收藏 · 边界向真实内容伸展';article.append(title,caption);const reach=Math.max(...hub.plot.envelope.radii)*1.16+30,svg=el('svg',{viewBox:[-reach,-reach,reach*2,reach*2].join(' '),role:'img','aria-label':hub.record.name+'的真实内容包络'},article),plot=el('g',{class:'garden-plot'},svg);mountColonyBorder(plot,{theme:'paperlight',rx:hub.plot.rx,ry:hub.plot.ry,seed:hub.key,tilt:hub.plot.tilt,color:colors.get(hub.key),breathing,frosted:true,envelope:hub.plot.envelope});glassify(svg,plot,{index:i,color:colors.get(hub.key)});
  for(const e of g.edges){const a=g.points.get(e.from),b=g.points.get(e.to);if(b?.owner!==hub.key||e.kind!=='membership')continue;const {bend,flip}=cellularCurve(e,g.points);el('path',{d:`M ${a.x-hub.x} ${a.y-hub.y} Q ${(a.x+b.x)/2-hub.x-(b.y-a.y)*bend*flip} ${(a.y+b.y)/2-hub.y+(b.x-a.x)*bend*flip} ${b.x-hub.x} ${b.y-hub.y}`,fill:'none',stroke:'#9fb38a','stroke-width':3},svg);}
  for(const p of [hub,...all.filter(p=>p.owner===hub.key)]){const x=p.x-hub.x,y=p.y-hub.y,size=p.size,frame=el('foreignObject',{x:x-size/2,y:y-size/2,width:size,height:size},svg),bitmap=document.createElement('div');bitmap.style.cssText=artStyle(elementArt('P0'+(i+1),p===hub?0:p.record.kind==='topic'?1:2,'paperlight'),size);frame.append(bitmap);}host.append(article);
 }
}catch(error){document.getElementById('status').textContent='暂时无法读取收藏，请确认 Kumo 桥接正在运行。';}
addEventListener('pagehide',()=>breathing.stop());
