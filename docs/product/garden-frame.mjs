import {IN_EXTENSION,PANEL_VIEW} from './garden-endpoints.mjs';
const narrow=()=>innerWidth<560;
function apply(){document.body.classList.toggle('is-narrow',narrow());document.body.classList.toggle('in-extension',IN_EXTENSION);document.body.classList.toggle('is-collection-panel',PANEL_VIEW);}
apply();addEventListener('resize',apply);
const brand=document.querySelector('header .brand'),tools=document.querySelector('header nav')||document.querySelector('header'),reader=document.getElementById('reader');
if(brand&&IN_EXTENSION){brand.setAttribute('href','../library.html');brand.title='我的收藏';}
if(tools){
 if(IN_EXTENSION){const list=document.createElement('a');list.className='frame-library';list.href='../library.html';list.textContent='全部收藏';list.title='以列表查看收藏、笔记与合集';tools.prepend(list);}
 const wide=document.createElement('button');wide.type='button';wide.className='frame-landscape';wide.textContent='展开 ↗';wide.title='在标签页里打开完整花园';
 wide.onclick=()=>{const url=new URL(IN_EXTENSION?chrome.runtime.getURL('garden/index.html'):location.href);url.searchParams.delete('panel');url.searchParams.delete('screen');url.hash=location.hash;if(IN_EXTENSION&&chrome.tabs?.create)chrome.tabs.create({url:url.href});else open(url.href,'_blank','noopener');};tools.append(wide);
}
if(PANEL_VIEW){
 let lastSelection=null;
 if(reader){const close=document.createElement('button');close.type='button';close.className='frame-reader-close';close.textContent='收起';close.setAttribute('aria-label','收起收藏详情');close.onclick=()=>{document.body.classList.remove('reader-open');document.body.classList.remove('atlas-detail-open');lastSelection?.focus({preventScroll:true});};reader.prepend(close);reader.setAttribute('tabindex','-1');}
 const hint=document.createElement('p');hint.className='frame-map-hint';hint.textContent='点开一个领域，看看里面的收藏';document.getElementById('garden-surface')?.append(hint);
 addEventListener('kumo:selection',event=>{if(document.body.dataset.screen!=='garden')return;lastSelection=document.activeElement;if(event.detail.kind==='brand'){document.body.classList.remove('reader-open');return;}document.body.classList.add('reader-open');if(narrow())reader?.focus({preventScroll:true});});
 addEventListener('kumo:atlas-selection',()=>{document.body.classList.add('atlas-detail-open');if(narrow())reader?.focus({preventScroll:true});});
 document.getElementById('reset')?.addEventListener('click',()=>document.body.classList.remove('reader-open'));
 addEventListener('keydown',event=>{if(event.key==='Escape'&&(document.body.classList.contains('reader-open')||document.body.classList.contains('atlas-detail-open'))){document.body.classList.remove('reader-open');document.body.classList.remove('atlas-detail-open');lastSelection?.focus({preventScroll:true});}});
 new MutationObserver(()=>{if(document.body.dataset.screen!=='garden')document.body.classList.remove('reader-open');if(document.body.dataset.screen!=='atlas')document.body.classList.remove('atlas-detail-open');}).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
}else{
 const pill=document.createElement('button');pill.type='button';pill.className='frame-reader-pill';pill.textContent='查看介绍 ↓';pill.hidden=true;document.body.append(pill);pill.onclick=()=>{pill.hidden=true;reader?.scrollIntoView({behavior:'smooth',block:'start'});};
 let down=null;document.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];},true);
 document.addEventListener('click',e=>{if(!narrow()||!reader||!e.target.closest?.('.garden-node,.domain-caption,.garden-core'))return;if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])>6)return;if(reader.getBoundingClientRect().top>innerHeight*.7)setTimeout(()=>{pill.hidden=false;clearTimeout(pill._t);pill._t=setTimeout(()=>pill.hidden=true,5000);},250);},true);
 addEventListener('scroll',()=>{if(reader&&reader.getBoundingClientRect().top<innerHeight*.6)pill.hidden=true;},{passive:true});
}
