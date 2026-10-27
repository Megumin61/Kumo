// v17 · One small platform mark shared by every card (fragment, tooltip, reader, preview).
const X_PATH='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
export const XHS_LOGO=new URL('./assets/platforms/xiaohongshu-official.png',import.meta.url).href;
export const PLATFORMS={x:{name:'X'},xhs:{name:'小红书',text:'书'},bili:{name:'哔哩哔哩',text:'B'},youtube:{name:'YouTube',text:'▶'},wechat:{name:'微信公众号',text:'微'},zhihu:{name:'知乎',text:'知'}};
export function platformKey(record){
 const raw=String(record?.platform||'').toLowerCase().trim(),url=String(record?.url||'').toLowerCase();
 if(/^(x|twitter)$/.test(raw)||/^https?:\/\/(www\.|mobile\.)?(x|twitter)\.com\//.test(url))return 'x';
 if(/xiaohongshu|小红书|xhs/.test(raw)||/xiaohongshu\.com|xhslink\.com/.test(url))return 'xhs';
 if(/bilibili|哔哩/.test(raw)||/bilibili\.com|b23\.tv/.test(url))return 'bili';
 if(/youtube/.test(raw)||/youtube\.com|youtu\.be/.test(url))return 'youtube';
 if(/wechat|微信/.test(raw)||/mp\.weixin\.qq\.com/.test(url))return 'wechat';
 if(/zhihu|知乎/.test(raw)||/zhihu\.com/.test(url))return 'zhihu';
 return raw?'other':'';
}
export function platformBadge(record){
 const key=platformKey(record);if(!key||record?.kind&&record.kind!=='source')return null;
 const info=PLATFORMS[key]||{name:String(record.platform||'').trim()||'来源',text:Array.from(String(record.platform||'?').trim())[0]||'?'},node=document.createElement('span');
 node.className='plat plat-'+key;node.title=info.name;node.setAttribute('role','img');node.setAttribute('aria-label',info.name);
 if(key==='x'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',X_PATH);svg.append(p);node.append(svg);}
 else if(key==='xhs'){const img=document.createElement('img');img.className='plat-logo';img.src=XHS_LOGO;img.alt='';img.draggable=false;img.setAttribute('aria-hidden','true');node.append(img);}
 else node.textContent=info.text;
 return node;
}
