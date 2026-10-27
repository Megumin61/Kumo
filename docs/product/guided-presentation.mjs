import {ROOT} from './schema.mjs';
import {explorationFocus} from './exploration-focus.mjs';
import {topicHabitats,topicLabelPlacements} from './topic-habitats.mjs';
import {fragmentOf,fragmentPlacements} from './knowledge-fragments.mjs';
import {coverPath} from './cover.mjs';
import {platformBadge} from './platform-icon.mjs';
import {sourceMetadata} from './note-presentation.mjs';
const NS='http://www.w3.org/2000/svg';
function svgEl(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));parent?.append(n);return n;}
function el(tag,cls,text=''){const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;}
// A leaf-vein tether: one main stem with two short side veins, instead of an evenly dashed line.
function veinPath(anchor,end){const [ax,ay]=anchor,[ex,ey]=end,cx=ax,cy=ey,pt=t=>[(1-t)**2*ax+2*(1-t)*t*cx+t*t*ex,(1-t)**2*ay+2*(1-t)*t*cy+t*t*ey],tan=t=>[2*(1-t)*(cx-ax)+2*t*(ex-cx),2*(1-t)*(cy-ay)+2*t*(ey-cy)];let d='M '+ax+' '+ay+' Q '+cx+' '+cy+' '+ex+' '+ey;for(const [t,side]of [[.36,1],[.64,-1]]){const [x,y]=pt(t),[tx,ty]=tan(t),len=Math.hypot(tx,ty)||1,ux=tx/len,uy=ty/len,angle=side*.72,bx=ux*Math.cos(angle)-uy*Math.sin(angle),by=ux*Math.sin(angle)+uy*Math.cos(angle);d+=' M '+x.toFixed(1)+' '+y.toFixed(1)+' l '+(bx*10).toFixed(1)+' '+(by*10).toFixed(1);}return d;}
const short=(s,n)=>Array.from(s||'').slice(0,n).join('')+(Array.from(s||'').length>n?'…':'');
export function createGuidedPresentation({host,svg,beds,badges,mode,getView,onSelect,onChange,panel=false}){
 const layer=svgEl('g',{class:'knowledge-fragments'},svg),memoryEls=new Map(),topicLabels=new Map(),bar=el('div','map-exploration-bar'),hint=el('span','exploration-instruction'),more=el('button','exploration-more'),back=el('button','exploration-overview','回到总览');
 more.type=back.type='button';bar.append(hint,more,back);host.append(bar);let reveal=0,stamp='',current=null,topicLabelBoxes=[];
 more.onclick=()=>{reveal+=4;onChange();};back.onclick=()=>onSelect(ROOT);
 function reset(){layer.replaceChildren();memoryEls.clear();topicLabels.clear();}
 function refresh(){
  const v=getView();if(!v.layout)return null;const next=v.selected+'|'+v.config.lens+'|'+v.config.density;if(stamp!==next){stamp=next;reveal=0;}
  current=explorationFocus(v.layout,v.selected,{mode,hover:v.hover,reveal,lens:v.config.lens,lensKeys:v.config.focus,density:v.config.density});
  for(const [key,node]of v.nodeEls){const s=current.nodes.get(key);if(!s)continue;node.style.visibility=s.visible?'visible':'hidden';node.style.opacity=String(s.opacity);node.style.pointerEvents=s.visible?'auto':'none';node.setAttribute('tabindex',s.visible?'0':'-1');node.setAttribute('aria-hidden',String(!s.visible));node.dataset.explorationRole=s.role;}
  if(hint.textContent!==current.hint)hint.textContent=current.hint;more.hidden=!current.hiddenCount;const moreText='再展开一些 · 还有 '+current.hiddenCount+' 个节点';if(more.textContent!==moreText)more.textContent=moreText;back.hidden=v.selected===ROOT;
  for(const caption of badges.querySelectorAll('[data-domain-label]')){const s=current.nodes.get(caption.dataset.domainLabel);caption.style.visibility=s?.visible?'visible':'hidden';caption.style.opacity=String(s?.opacity??0);caption.setAttribute('aria-hidden',String(!s?.visible));}
  for(const plot of beds.querySelectorAll('[data-patch]')){const s=current.nodes.get(plot.dataset.patch);plot.style.visibility=s?.visible?'visible':'hidden';plot.style.opacity=String(v.selected===ROOT?1:s?.role==='primary'?1:s?.role==='related'?.5:.12);}
  paintTopics(v);paintMemories(v);return current;
 }
 function paintTopics(v){const regions=topicHabitats(v.layout.points),placements=topicLabelPlacements(v.layout.points,regions,{states:current.nodes,zoom:v.zoom,pan:v.pan,width:v.width,height:panel&&v.selected!==ROOT?v.height*.52:v.height}),positions=new Map(placements.map(p=>[p.key,p]));topicLabelBoxes=placements.map(p=>p.box);for(const region of regions){
  const s=current.nodes.get(region.key),point=v.layout.points.get(region.key),plot=beds.querySelector('[data-topic-patch="'+CSS.escape(region.key)+'"]');if(plot){plot.style.visibility=s?.visible?'visible':'hidden';plot.style.opacity=s?.role==='primary'?'1':'.5';plot.classList.toggle('topic-in-focus',s?.role==='primary');}
  let label=topicLabels.get(region.key);if(!label){label=svgEl('g',{class:'topic-region-label','data-key':region.key,'data-topic-region':region.key,role:'button',tabindex:0},badges);svgEl('rect',{x:-60,y:-10,width:120,height:22,rx:11},label);svgEl('text',{'text-anchor':'middle',y:5},label);label.addEventListener('click',()=>onSelect(region.key));label.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect(region.key);}});topicLabels.set(region.key,label);}
  const position=positions.get(region.key),showing=!!position&&v.selected!==ROOT&&s?.role==='primary';label.style.visibility=showing?'visible':'hidden';label.setAttribute('tabindex',showing?'0':'-1');label.style.opacity=String(s?.opacity??0);label.setAttribute('aria-hidden',String(!showing));const count=point.record.members?.length||0,text=short(point.record.name,12)+' · '+count+' 篇';label.querySelector('text').textContent=text;const w=position?.width||120;label.querySelector('rect').setAttribute('x',-w/2);label.querySelector('rect').setAttribute('width',w);if(position)label.setAttribute('transform','translate('+((position.x-v.pan[0])/v.zoom)+' '+((position.y-v.pan[1])/v.zoom)+') scale('+1/v.zoom+')');label.setAttribute('aria-label',point.record.name+'，'+count+' 篇收藏，展开主题');
 }}
 function paintMemories(v){
  const available=panel&&v.selected!==ROOT?v.height*.52:v.height,reserved=[...topicLabelBoxes,{left:0,right:v.width,top:0,bottom:62},{left:v.width-150,right:v.width,top:available-70,bottom:available},{left:0,right:300,top:available-56,bottom:available}],placements=mode==='field'?fragmentPlacements(v.layout.points,current.memoryKeys,{width:v.width,height:available,zoom:v.zoom,pan:v.pan,visible:current.visible,reserved,allowOutside:current.related}):[];
  const shown=new Set(placements.map(p=>p.key));for(const [key,n]of memoryEls)n.style.visibility=shown.has(key)?'visible':'hidden';
  for(const p of placements){let group=memoryEls.get(p.key);if(!group){const record=v.layout.points.get(p.key).record,data=fragmentOf(v.model,record);group=svgEl('g',{class:'memory-card','data-key':p.key,role:'button',tabindex:0,'aria-label':'阅读：'+data.title},layer);svgEl('path',{class:'fragment-tether'},group);svgEl('circle',{class:'fragment-bud',r:3.4},group);const frame=svgEl('foreignObject',{class:'fragment-frame',width:p.width,height:p.height},group),card=el('div','knowledge-fragment'),head=el('div','fragment-head'),badge=platformBadge(record);if(badge)head.append(badge);head.append(el('small','fragment-source',sourceMetadata(record)||data.meta),el('em','fragment-flag'));const title=el('strong','fragment-title',data.title),meta=el('small','fragment-meta',data.meta),intro=el('p','fragment-intro',data.intro);card.append(head,title,meta,intro);const cover=coverPath(record);if(cover){const img=el('img','fragment-cover');img.src=cover;img.alt='';img.draggable=false;img.onerror=()=>img.remove();card.append(img);}frame.append(card);group.addEventListener('click',e=>{e.stopPropagation();onSelect(p.key);});group.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();onSelect(p.key);}});memoryEls.set(p.key,group);}
   group.querySelector('.fragment-flag').textContent=p.external?'相关收藏':'你点的这篇';group.style.visibility='visible';group.setAttribute('tabindex','0');group.querySelector('foreignObject').setAttribute('x',p.x);group.querySelector('foreignObject').setAttribute('y',p.y);const endX=p.anchor[0]<p.x?p.x:p.anchor[0]>p.x+p.width?p.x+p.width:Math.max(p.x+8,Math.min(p.x+p.width-8,p.anchor[0])),endY=Math.max(p.y+8,Math.min(p.y+p.height-8,p.anchor[1]));group.querySelector('path').setAttribute('d',veinPath(p.anchor,[endX,endY]));const bud=group.querySelector('.fragment-bud');bud.setAttribute('cx',p.anchor[0]);bud.setAttribute('cy',p.anchor[1]);
  }
  for(const [key,g]of memoryEls)if(!shown.has(key))g.setAttribute('tabindex','-1');
 }
 return {refresh,reset,get current(){return current;},dispose(){bar.remove();layer.remove();}};
}
