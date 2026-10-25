import {elements,elementGroups,defaultElements,byElementId,sanitizeSelection,selectionKey,draftKey,readSelection,textureKey,readTexture} from './element-library.mjs';
import {elementArt,artStyle,prototypeStyles} from './art.mjs';
const byId=id=>document.getElementById(id),el=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
const requestedStyle=new URLSearchParams(location.search).get('style');
let selected=new Set(readSelection()),filter='all',texture=prototypeStyles[requestedStyle]?requestedStyle:readTexture(),sameSize=false;
try{const draft=JSON.parse(localStorage.getItem(draftKey));if(Array.isArray(draft))selected=new Set(sanitizeSelection(draft));}catch{}
function picture(art,size,label){const n=el('div');n.style.cssText=artStyle(art,size);n.setAttribute('role','img');n.setAttribute('aria-label',label);return n;}
function selectedList(){return elements.filter(e=>selected.has(e.id));}
function updateSelection(){
 const list=selectedList();byId('selection-count').textContent='已选 '+list.length+' 个元素';byId('selection-chips').replaceChildren(...list.map(e=>el('span',e.id+' '+e.name)));byId('preview').disabled=!list.length;
 byId('selection-text').value='Kumo · 花园元素清单\n'+list.map(e=>e.id+' · '+e.name+' / '+elementGroups.find(g=>g.id===e.group).name).join('\n');
 for(const card of document.querySelectorAll('.element-card'))card.classList.toggle('selected',selected.has(card.dataset.element));
 try{localStorage.setItem(draftKey,JSON.stringify([...selected]));}catch{}
}
function render(){
 const host=byId('element-sections');host.replaceChildren();
 for(const group of elementGroups){if(filter!=='all'&&filter!==group.id)continue;const section=el('section','','element-section');section.id=group.id;section.append(el('h2',group.name),el('p',group.description));const grid=el('div','','element-grid');
  for(const item of elements.filter(e=>e.group===group.id)){const card=el('article','','element-card');card.dataset.element=item.id;const label=el('label'),checkbox=el('input');checkbox.type='checkbox';checkbox.checked=selected.has(item.id);checkbox.setAttribute('aria-label',item.id+' '+item.name);checkbox.onchange=()=>{checkbox.checked?selected.add(item.id):selected.delete(item.id);byId('feedback').textContent='';updateSelection();};label.append(checkbox,el('span',item.id,'element-number'),el('span',item.name));card.append(label);
   const forms=el('div','','element-forms');(sameSize?[64,64,64]:[96,48,28]).forEach((size,level)=>{const form=el('figure','','element-level');form.append(picture(elementArt(item.id,level,texture),size,item.name+' '+['领域','主题','材料'][level]),el('figcaption',['领域','主题','材料'][level]));forms.append(form);});card.append(forms,el('p',item.note,'element-note'));
   if(item.complex)card.append(el('span','细节较多 · 仅作参考','element-warning'));
   grid.append(card);
  }section.append(grid);host.append(section);
 }updateSelection();
}
for(const button of document.querySelectorAll('[data-filter]'))button.onclick=()=>{filter=button.dataset.filter;for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b===button));render();};
byId('texture').value=texture;byId('texture').onchange=()=>{texture=byId('texture').value;try{localStorage.setItem(textureKey,texture);}catch{}render();};byId('recommend').onclick=()=>{selected=new Set(defaultElements);render();byId('feedback').textContent='已恢复花草为主的建议清单，仍可继续勾选。';};byId('clear').onclick=()=>{selected.clear();render();};
byId('copy').onclick=async()=>{try{await navigator.clipboard.writeText(byId('selection-text').value);byId('feedback').textContent='清单已复制，可以发给我。';}catch{document.querySelector('.selection-text').open=true;byId('selection-text').focus();byId('selection-text').select();byId('feedback').textContent='文字清单已展开，可直接复制。';}};
byId('same-size').onchange=()=>{sameSize=byId('same-size').checked;render();};
byId('preview').onclick=()=>{if(!selected.size)return;try{localStorage.setItem(selectionKey,JSON.stringify(selectedList().map(e=>e.id)));}catch{}location.href='./#theme='+(prototypeStyles[texture]?texture:'garden');};for(const button of document.querySelectorAll('[data-filter]')){const count=button.querySelector('span');if(count)count.textContent=button.dataset.filter==='all'?elements.length:elements.filter(e=>e.group===button.dataset.filter).length;}render();
