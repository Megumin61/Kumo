import {IN_EXTENSION,PANEL_VIEW} from './garden-endpoints.mjs';
function apply(){document.body.classList.toggle('is-narrow',innerWidth<560);document.body.classList.toggle('is-map-sidebar',PANEL_VIEW);document.body.classList.toggle('in-extension',IN_EXTENSION);document.body.classList.toggle('is-collection-panel',PANEL_VIEW);}
apply();addEventListener('resize',apply);
const brand=document.querySelector('header .brand'),tools=document.querySelector('header nav')||document.querySelector('header'),reader=document.getElementById('reader');let lastSelection=null;
if(brand&&IN_EXTENSION){brand.setAttribute('href','../library.html');brand.title='我的收藏';}
if(tools&&IN_EXTENSION){const list=document.createElement('a');list.className='frame-library';list.href='../library.html';list.textContent='全部收藏';tools.prepend(list);}
document.body.classList.add('reader-open');
if(reader){const close=document.createElement('button');close.type='button';close.className='frame-reader-close';close.textContent='收起';close.setAttribute('aria-label','收起收藏详情');close.onclick=()=>{document.body.classList.remove('reader-open','atlas-detail-open');lastSelection?.focus({preventScroll:true});};reader.prepend(close);}
addEventListener('kumo:selection',event=>{if(document.body.dataset.screen!=='garden')return;lastSelection=document.activeElement;document.body.classList.add('reader-open');});
addEventListener('kumo:atlas-selection',()=>document.body.classList.add('atlas-detail-open'));
document.getElementById('reset')?.addEventListener('click',()=>document.body.classList.add('reader-open'));
addEventListener('keydown',event=>{if(event.key==='Escape'){document.body.classList.remove('reader-open','atlas-detail-open');lastSelection?.focus({preventScroll:true});}});
new MutationObserver(()=>{if(document.body.dataset.screen!=='garden')document.body.classList.remove('reader-open');if(document.body.dataset.screen!=='atlas')document.body.classList.remove('atlas-detail-open');}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
