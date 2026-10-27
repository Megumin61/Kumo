const features={
  clip:{kicker:'看到好内容，一下就存',title:'给网页留一张\n有来源的内容卡片。',description:'保存标题、作者、链接、可读取的正文与主要图片，再补一句自己的想法。GitHub 项目和 B 站视频，也可以先留下项目说明或视频线索。',points:['Windows 默认 Ctrl+Q 快速剪藏','笔记、标签、来源一起留下','文件夹或浏览器下载目录，自行选择'],condition:'基础剪藏使用浏览器扩展即可；首次保存需选择位置并授权。',image:'assets/clipper.jpg',alt:'Kumo 浏览器剪藏面板、标签和笔记',caption:'从你正在看的页面留下内容。'},
  colony:{kicker:'把内容放回一张地图',title:'每一个领域，\n都有自己的小小聚落。',description:'领域圈层、自然藤蔓、主题与收藏一起构成地图。浏览已有内容的分布，也能单独看到还在等待整理的材料。',points:['从领域看见相关主题与收藏','圈层和枝叶表达内容之间的归属','待编译材料独立收纳'],condition:'需要本地助手连接同一个资料库；编译后的主题与领域来自已连接的 AI 整理。',image:'assets/colony.jpg',alt:'Kumo 收藏聚落中的领域圈层和藤蔓连接',caption:'先看整体，再沿感兴趣的方向走进去。'},
  garden:{kicker:'沿着一条线索，继续往里走',title:'从领域到主题，\n再回到一篇具体收藏。',description:'像翻自己的手账一样展开分支。看概括、读内容、找依据，把抽象的主题重新连回原始材料。',points:['领域、主题、帖子逐层探索','右侧阅读当前节点与相关内容','植物节点与画风可以切换'],condition:'知识花园需要连接本地助手。保存成功并不代表内容已经由 AI 编译成主题知识。',image:'assets/garden.jpg',alt:'Kumo 知识花园展开领域并在右侧显示相关内容',caption:'让概括有来处，让线索可以继续被探索。'},
  ai:{kicker:'做事情的时候，把收藏用起来',title:'让已连接的 AI，\n先找找你的参考。',description:'在设计、学习或项目任务中检索相关材料，读取原文与笔记，再给出带依据的归纳。你可以明确要求检索、归纳或整理；整理结果会保留来源与人工标签。',points:['按任务检索并读取保存的内容','区分原文、个人笔记和 AI 归纳','保留原件与人工标签，可继续修订'],condition:'需在兼容本地插件的桌面客户端单独安装和授权。并非仅安装浏览器扩展就能让网页版 ChatGPT 读取电脑文件。',image:'assets/ai-workflow.jpg',alt:'Kumo 产品演示中，已连接的 AI 按任务查找收藏',caption:'使用结果取决于已连接的宿主与实际读取到的资料。'}
};
const tabs=Array.from(document.querySelectorAll('[data-feature]'));
function selectFeature(button){
  const value=features[button.dataset.feature];if(!value)return;
  for(const tab of tabs){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
  document.getElementById('feature-panel').setAttribute('aria-labelledby',button.id);
  for(const [id,key]of [['feature-kicker','kicker'],['feature-description','description'],['feature-condition','condition'],['feature-caption','caption']])document.getElementById(id).textContent=value[key];
  const title=document.getElementById('feature-title');title.replaceChildren();value.title.split('\n').forEach((line,index)=>{if(index)title.append(document.createElement('br'));title.append(document.createTextNode(line));});
  const list=document.getElementById('feature-points');list.replaceChildren(...value.points.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const image=document.getElementById('feature-image');image.src=value.image;image.alt=value.alt;
}
for(const [index,tab]of tabs.entries()){
  tab.addEventListener('click',()=>selectFeature(tab));
  tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=tabs[(index+1)%tabs.length];if(event.key==='ArrowLeft')target=tabs[(index+tabs.length-1)%tabs.length];if(event.key==='Home')target=tabs[0];if(event.key==='End')target=tabs.at(-1);if(target){event.preventDefault();selectFeature(target);target.focus();}});
}


import {styles} from './style-data.js';
const $=id=>document.getElementById(id),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const families=['P01','P02','P03','P04','P05','P06'];
const state={style:'green-crayon'};
let currentStyle=styles.find(s=>s.id===state.style),styleTimer=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;
const art=(f,v=0)=>currentStyle.nodes[f+'-'+v];
const frame=$('product-frame');let frameReady=false;
function sendToGarden(data){if(frameReady)frame.contentWindow.postMessage({type:'kumo-demo-control',...data},location.origin);}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==frame.contentWindow||e.data?.type!=='kumo-demo-state')return;
 if(!frameReady){frameReady=true;$('product-loading').hidden=true;sendToGarden({style:state.style});}
 else if(e.data.style&&e.data.style!==state.style&&styles.some(s=>s.id===e.data.style))setStyle(e.data.style,false);
 document.querySelectorAll('[data-product-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.productView===e.data.view)));
});
document.querySelectorAll('[data-product-view]').forEach(b=>b.addEventListener('click',()=>sendToGarden({view:b.dataset.productView})));
$('product-appearance').addEventListener('click',()=>sendToGarden({screen:'appearance'}));
$('focus-product').addEventListener('click',()=>{const active=document.body.classList.toggle('product-focused');$('focus-product').textContent=active?'退出沉浸体验 ×':'沉浸体验 ⛶';$('focus-product').setAttribute('aria-pressed',String(active));});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('product-focused'))$('focus-product').click();});
// The production panel mode provides its own compact reader on narrow screens.
if(matchMedia('(max-width: 700px)').matches){const u=new URL(frame.src);u.searchParams.set('panel','1');frame.src=u.href;}
const journal=document.querySelector('.hero-journal');
if(matchMedia('(hover:hover)').matches&&!reduced.matches){journal.addEventListener('pointermove',e=>{if(paused)return;const r=journal.getBoundingClientRect();journal.style.setProperty('--tilt-x',((e.clientY-r.top)/r.height-.5)*-5+'deg');journal.style.setProperty('--tilt-y',((e.clientX-r.left)/r.width-.5)*6+'deg');});journal.addEventListener('pointerleave',()=>{journal.style.setProperty('--tilt-x','0deg');journal.style.setProperty('--tilt-y','0deg');});}
function setStyle(id,send=true){currentStyle=styles.find(s=>s.id===id)||styles[0];state.style=currentStyle.id;$('demo-style').value=state.style;document.querySelectorAll('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.style===state.style)));$('style-stage').style.backgroundImage=`url('${currentStyle.paper}')`;$('selected-style-title').textContent=currentStyle.name;$('selected-style-mood').textContent=currentStyle.mood;$('selected-style-index').textContent=String(styles.indexOf(currentStyle)+1).padStart(2,'0')+' / 11';$('style-specimens').innerHTML=families.slice(0,4).map(f=>`<img src="${art(f)}" width="140" height="140" alt="${esc(currentStyle.name)}植物节点">`).join('');$('style-colors').innerHTML=currentStyle.palette.map(c=>`<span style="background:${c}" title="${c}"></span>`).join('');if(send)sendToGarden({style:state.style});}
$('demo-style').innerHTML=styles.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');$('demo-style').addEventListener('change',e=>{stopStyleAuto();setStyle(e.target.value);});$('style-grid').innerHTML=styles.map((s,i)=>`<button class="style-choice" data-style="${s.id}" aria-pressed="false"><span class="style-choice-name">${esc(s.name)}</span><small>${String(i+1).padStart(2,'0')} / GARDEN STYLE</small><span class="style-choice-art">${families.slice(0,4).map(f=>`<img src="${s.nodes[f+'-0']}" width="64" height="64" alt="" loading="lazy">`).join('')}</span></button>`).join('');$('style-grid').addEventListener('click',e=>{const b=e.target.closest('[data-style]');if(b){stopStyleAuto();setStyle(b.dataset.style);}});
function stopStyleAuto(){clearInterval(styleTimer);styleTimer=null;$('style-auto').setAttribute('aria-pressed','false');$('style-auto').textContent='▷ 自动换一套';}
$('style-auto').addEventListener('click',()=>{if(styleTimer){stopStyleAuto();return;}$('style-auto').setAttribute('aria-pressed','true');$('style-auto').textContent='Ⅱ 暂停换装';styleTimer=setInterval(()=>{if(!document.hidden&&!paused)setStyle(styles[(styles.indexOf(currentStyle)+1)%styles.length].id);},3500);});
const installTabs=[...document.querySelectorAll('[data-install]')];function installTab(tab){installTabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;$('install-'+b.dataset.install).hidden=!active;});}installTabs.forEach((b,i)=>{b.addEventListener('click',()=>installTab(b));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?installTabs.length-1:(i+1)%installTabs.length;installTab(installTabs[next]);installTabs[next].focus();}});});$('copy-install').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('codex plugin marketplace add Megumin61/Kumo');$('copy-install').textContent='已复制';}catch{$('copy-install').textContent='请选中复制';}});
const loops=[...document.querySelectorAll('video[data-loop]')];const visible=new Set();function updateMotion(){document.body.classList.toggle('motion-paused',paused);$('motion-toggle').setAttribute('aria-pressed',String(paused));$('motion-toggle').textContent=paused?'▷ 播放动效':'Ⅱ 暂停动效';for(const v of loops)if(paused||document.hidden||!visible.has(v))v.pause();else void v.play().catch(()=>{});if(paused)stopStyleAuto();}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const e of entries)e.isIntersecting?visible.add(e.target):visible.delete(e.target);updateMotion();},{threshold:.18});loops.forEach(v=>observer.observe(v));}else loops.forEach(v=>visible.add(v));$('motion-toggle').addEventListener('click',()=>{paused=!paused;updateMotion();});reduced.addEventListener('change',()=>{paused=reduced.matches;updateMotion();});document.addEventListener('visibilitychange',updateMotion);
let scrollPending=false;window.addEventListener('scroll',()=>{if(!scrollPending){scrollPending=true;requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('.reading-progress').style.transform=`scaleX(${max?scrollY/max:0})`;scrollPending=false;});}},{passive:true});
document.querySelectorAll('.why-notes article,.motion-card,.use-grid article').forEach(e=>e.setAttribute('data-reveal',''));if('IntersectionObserver'in window&&!reduced.matches){document.body.classList.add('reveal-ready');const reveal=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){e.target.classList.add('revealed');reveal.unobserve(e.target);}},{threshold:.1});document.querySelectorAll('[data-reveal]').forEach(e=>reveal.observe(e));}
setStyle(state.style);updateMotion();
