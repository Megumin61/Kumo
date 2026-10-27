import {coverPath} from './cover.mjs';
import {recordArt,artStyle} from './art.mjs';
const el=(tag,text='',cls='')=>{const node=document.createElement(tag);node.textContent=text;node.className=cls;return node;};
export function collectionCard(model,record,theme,onSelect,{compact=false}={}){
 const button=el('button','','collection-card'+(compact?' compact':''));button.dataset.source=record.key;button.setAttribute('aria-label','阅读收藏：'+record.name);
 const media=el('div','','card-media'),cover=coverPath(record),fallback=el('div','','card-glyph');fallback.style.cssText=artStyle(recordArt(model,record,theme),54);media.append(fallback);
 if(cover){const image=el('img');image.src=cover;image.alt='';image.draggable=false;image.loading='lazy';image.addEventListener('error',()=>image.remove());media.append(image);}
 const copy=el('div','','card-copy');copy.append(el('small',[record.platform,record.author].filter(Boolean).join(' · ')),el('strong',record.name),el('p',record.summary));button.append(media,copy);button.addEventListener('click',()=>onSelect(record.key));return button;
}
