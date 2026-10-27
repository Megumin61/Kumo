// Integration around the unmodified product UI; no alternative graph renderer.
const q=new URL(location.href).searchParams;
if(q.get('embed')==='1')document.documentElement.classList.add('demo-embedded');
const parentOrigin=location.origin;
function notify(){if(parent!==window)parent.postMessage({type:'kumo-demo-state',style:document.body.dataset.scheme,view:document.getElementById('tab-converge')?.getAttribute('aria-selected')==='true'?'garden':'colony'},parentOrigin);}
const badge=document.createElement('div');badge.className='public-demo-notice';badge.textContent='官网体验 · 示例资料';badge.title='使用产品的真实界面与交互，内容为虚构示例。外观与笔记仅保存在这个网站的浏览器中。';document.body.append(badge);
addEventListener('message',e=>{if(e.origin!==parentOrigin||e.source!==parent||!e.data||e.data.type!=='kumo-demo-control')return;
 if(e.data.style){const select=document.getElementById('theme');if([...select.options].some(o=>o.value===e.data.style)){select.value=e.data.style;select.dispatchEvent(new Event('change'));}}
 if(['garden','colony'].includes(e.data.view)){document.getElementById('surface-back')?.click();document.getElementById(e.data.view==='garden'?'tab-converge':'tab-field')?.click();}
 if(e.data.screen==='appearance')document.getElementById('open-appearance')?.click();
});
// The production reader links to the local library; public demos link to fixture text.
function adaptLinks(){document.querySelectorAll('a[href*="127.0.0.1:43789"]').forEach(a=>{const raw=new URL(a.href);const id=new URLSearchParams(raw.hash.slice(1)).get('item');if(id&&/^[a-f0-9]{24}$/.test(id)){a.href='sample.html?id='+id;a.textContent='阅读示例原件 ↗';}else{a.removeAttribute('href');a.textContent='此入口需要本地资料库';}});}
const observer=new MutationObserver(()=>{adaptLinks();notify();});
observer.observe(document.getElementById('reader'),{childList:true,subtree:true});
new MutationObserver(notify).observe(document.body,{attributes:true,attributeFilter:['data-scheme','data-screen']});
for(const id of ['tab-converge','tab-field'])new MutationObserver(notify).observe(document.getElementById(id),{attributes:true,attributeFilter:['aria-selected']});
addEventListener('load',()=>{adaptLinks();notify();});
