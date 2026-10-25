import {collectionOpportunities} from './collection-opportunities.mjs';
import {statusNames} from './model.mjs';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function renderGardenHome(model,host,onSelect,{lens='all',onLens}){
 const info=collectionOpportunities(model);
 document.getElementById('detail-kind').textContent='我的积累';
 document.getElementById('detail-title').textContent=lens==='bridges'?'领域间的联系':lens==='pending'?'待整理的收藏':'从哪里继续';
 document.getElementById('detail-summary').textContent=lens==='bridges'?'每条联系都可以查看双方材料及理由。':lens==='pending'?[...new Set(info.pending.map(r=>r.status))].map(status=>(statusNames[status]||status)+' '+info.pending.filter(r=>r.status===status).length+' 篇').join(' · '):'';
 function link(parent,record,caption){const b=el('button','','reader-link');b.append(el('strong',record.name),el('span',caption));b.onclick=()=>onSelect(record.key);parent.append(b);}
 if(lens==='bridges'){
  for(const b of info.bridges){model.records.set(b.key,b);link(host,b,`${b.relations.length} 条`);}
  if(!info.bridges.length)host.append(el('p','还没有记录跨领域联系。','home-empty'));return;
 }
 if(lens==='pending'){
  for(const r of info.pending)link(host,r,statusNames[r.status]||'待整理');
  if(!info.pending.length)host.append(el('p','当前收藏都有可用的整理记录。','home-empty'));return;
 }
 const total=el('p',`${model.sources.length} 篇收藏 · ${model.groups.length} 个领域`,'home-total');host.append(total);
 for(const [key,title,count,caption]of [['bridges','看看领域间的联系',info.bridges.length,'组已有联系'],['pending','继续整理一篇',info.pending.length,'篇待完善']]){
  const b=el('button','','home-opportunity');b.append(el('strong',title),el('span',`${count} ${caption}  ↗`));b.onclick=()=>onLens(key);host.append(b);
 }
 const heading=el('h3','我的领域','home-heading');host.append(heading);
 for(const d of info.domains)link(host,d,`${d.displayCount} 篇`);
}
