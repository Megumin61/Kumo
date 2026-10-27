import {coverPath} from './cover.mjs';
import {sourceMetadata} from './note-presentation.mjs';
import {platformBadge} from './platform-icon.mjs';
import {summaryParagraphs} from './summary-presentation.mjs';
const node=(tag,text='',className='')=>{const n=document.createElement(tag);n.textContent=text;n.className=className;return n;};
export function appendSourceDetail(host,record){
 const card=node('article','','source-detail-card'),cover=coverPath(record);
 if(cover){const image=node('img','','source-detail-cover');image.src=cover;image.alt=record.name+'的收藏封面';image.loading='lazy';image.addEventListener('error',()=>image.remove());card.append(image);}
 const meta=node('div','','source-detail-meta'),byline=node('span','','source-detail-byline'),badge=platformBadge(record);if(badge)byline.append(badge);byline.append(document.createTextNode(sourceMetadata(record)||'收藏来源'));meta.append(byline);
 const day=String(record.capturedAt||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(day)){const time=node('time',day);time.dateTime=day;meta.append(time);}card.append(meta);host.append(card);
 const intro=node('section','','reader-section source-detail-intro');intro.append(node('h3','帖子介绍'));const paragraphs=summaryParagraphs(record.card?.summary||record.summary||record.description||record.excerpt||'暂无介绍，可先打开原件阅读。');for(const text of paragraphs)intro.append(node('p',text));host.append(intro);
 const tags=[...new Set((record.keywords?.length?record.keywords:record.card?.keywords)||[])].filter(Boolean);if(tags.length){const section=node('section','','reader-section source-detail-tags');section.append(node('h3','内容标签'));const row=node('div','','source-tag-list');for(const t of tags)row.append(node('span',String(t)));section.append(row);host.append(section);}
 return {card,intro};
}
