const byId = id => document.getElementById(id);
const el = (tag, text = '', className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
const status = text => { byId('library-status').textContent = text; };
const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
let offset = 0, epoch = 0, filter = '', directory = location.hash === '#collections', currentDetail = null, trigger = null, collections = [], records = [], number = 0;
const positions = new Map();
let detailReturnPosition=0;
let disconnected=false;
let navigationKey='';
function closeDetail(){byId('detail').hidden=true;document.body.classList.remove('reading');detailEpoch++;byId('assets').querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});window.scrollTo(0,detailReturnPosition);trigger?.focus({preventScroll:true});}
function detailView(view){byId('article-body').hidden=view!=='body';byId('comments-view').hidden=view!=='comments';document.querySelectorAll('#detail-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));}
function renderDiscussion(container,values,empty){container.replaceChildren();if(!values.length){container.append(el('p',empty,'muted'));return;}for(const value of values.slice(0,5)){
 const card=el('article','','discussion-card'),avatar=el('span',(value.author||'?').slice(0,1),'discussion-avatar'),body=el('div','','discussion-body'),head=el('div','','discussion-head');
 if(safeUrl(value.avatar)){const img=el('img');img.src=safeUrl(value.avatar);img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.addEventListener('error',()=>avatar.replaceChildren(document.createTextNode((value.author||value.handle||'?').slice(0,1))),{once:true});avatar.replaceChildren(img);}const author=el('a',value.author||value.handle||'未记录用户');const profile=safeUrl(value.authorUrl);if(profile){author.href=profile;author.target='_blank';author.rel='noopener noreferrer';}head.append(author);if(value.handle)head.append(el('span','@'+value.handle,'muted'));if(value.isAuthor)head.append(el('span','作者','discussion-author'));body.append(head);
 if(value.replyToId)body.append(el('div','回复原帖','discussion-reply'));body.append(el('p',value.text||value.content||''));
 const media=el('div','','discussion-media');for(const item of value.media||[]){const url=safeUrl(typeof item==='string'?item:item.url);if(!url)continue;if(item.kind==='video'&&safeUrl(item.videoUrl)){const video=el('video');video.src=safeUrl(item.videoUrl);video.poster=url;video.controls=true;video.preload='none';media.append(video);}else{const link=el('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';const img=el('img');img.src=url;img.alt='评论配图';img.loading='lazy';img.referrerPolicy='no-referrer';link.append(img);media.append(link);}}if(media.children.length)body.append(media);
 const footer=el('div','','discussion-footer');footer.append(el('span','♡ '+(value.likes?.raw??value.likes?.value??'—')),el('span','回复 '+(value.replyCount??'—')));if(value.publishedAt)footer.append(el('span',new Date(value.publishedAt).toLocaleDateString()));if(safeUrl(value.url)){const original=el('a','查看原回复');original.href=safeUrl(value.url);original.target='_blank';original.rel='noopener noreferrer';footer.append(original);}body.append(footer);card.append(avatar,body);container.append(card);
 }container.append(el('p','保存时页面可读取的前 5 条回复；顺序与数量不代表全部或全站热评。媒体按原地址预览，未下载的媒体需联网。','discussion-coverage'));}

document.querySelectorAll('#detail-tabs button').forEach(b=>b.onclick=()=>detailView(b.dataset.view));
const membership = el('div','','row'), collectionSelect = el('select'), assign = el('button','确认','quiet');
collectionSelect.id = 'detail-collection-select'; collectionSelect.setAttribute('aria-label','所属合集'); assign.id = 'assign-collection';
membership.append(collectionSelect,assign); byId('collection-control').append(membership); KumoUI.select(collectionSelect);
byId('change-collection').onclick=()=>{const open=byId('collection-control').hidden;byId('collection-control').hidden=!open;byId('change-collection').setAttribute('aria-expanded',String(open));if(open)byId('collection-control').querySelector('.select-trigger').focus();};
byId('list-back').prepend(KumoUI.icon('back'));byId('settings').append(KumoUI.icon('gear'));byId('settings-close').append(KumoUI.icon('close'));byId('back').prepend(KumoUI.icon('back'));byId('original').prepend(KumoUI.icon('external'));
function renderBody(source) {
  const match=source.match(/(?:^|\n)## 正文\r?\n([\s\S]*)/);
  const body=(match?match[1].split(/\n## (?:作者在评论区或帖子串中的补充|图片|视频|互动数据快照|讨论快照|采集说明|剪藏时的当前视口|选中原文)(?:\s|（|$)/)[0]:source.replace(/^# [^\n]*\n/,'')).trim();
  const container=byId('source');container.replaceChildren();
  for(const line of body.split(/\r?\n/)){if(!line.trim())continue; const heading=line.match(/^(#{1,6})\s+(.+)$/),node=el(heading?'h2':'p');const text=heading?heading[2]:line;let start=0;const links=/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;for(const m of text.matchAll(links)){node.append(document.createTextNode(text.slice(start,m.index)));const a=el('a',m[1]);a.href=safeUrl(m[2]);a.target='_blank';a.rel='noopener noreferrer';node.append(a);start=m.index+m[0].length;}node.append(document.createTextNode(text.slice(start)));container.append(node);}
  if(!body)container.append(el('p','暂无正文'));
}
function remember() { if(!document.body.classList.contains('reading'))positions.set(directory ? 'directory' : filter, window.scrollY); }
function imageFor(item, className, assetName = '') {
  const name = assetName || KumoUI.preview(item); if (!KumoUI.validAsset(name)) return null;
  const image = el('img', '', className); image.alt = item.title || '媒体预览'; image.loading = 'lazy'; image.decoding='async';if(KumoBridge.bindAsset)KumoBridge.bindAsset(image,item.id,name);else image.src=KumoBridge.asset(item.id,name); image.onerror = () => {const parent=image.parentElement;image.remove();if(parent?.classList.contains('folder-cover')){parent.dataset.tiles=String(parent.querySelectorAll('img').length);if(!parent.querySelector('img'))parent.replaceChildren(KumoUI.icon('bookmark'));}else if(parent?.classList.contains('thumb-wrap')){const count=parent.querySelectorAll('img').length;if(!count)parent.remove();else{parent.dataset.tiles=String(count);if(count===1)parent.classList.remove('thumb-collage');}}}; return image;
}
function resourceText(item) {
  const s = item.stats || {}; const images = Number(s.images || 0), videos = Number(s.videos || 0);
  return [images ? '图片 ' + images : '', videos ? '视频 ' + videos : ''].filter(Boolean).join('\n') || '文字';
}
let collapsedCollectionGroup='';
function paintCollectionFilters(result){
  const tree=byId('collection-tag-tree'),parents=byId('collection-filters'),children=byId('child-collection-filters');
  tree.hidden=directory;
  if(directory)return;
  const activeGroup=collections.find(tag=>tag.id===filter)?.parentId||filter;
  const related=activeGroup===collapsedCollectionGroup?[]:collections.filter(tag=>tag.parentId&&tag.parentId===activeGroup);
  function render(container,tags){
    const inBranch=container===children;
    const entries=tags.map(tag=>({...tag,hasChildren:!inBranch&&Boolean(tag.id)&&collections.some(child=>child.parentId===tag.id)}));
    const key=JSON.stringify(entries.map(({id,label,count,hasChildren})=>[id,label,count,hasChildren]));
    if(container.dataset.entryKey!==key){
      container.dataset.entryKey=key;
      container.replaceChildren(...entries.map(({id,label,count,hasChildren},index)=>{
        const button=el('button',label+(count!=null?' '+count:''),'chip');
        button.title=label;button.type='button';button.dataset.collectionFilter=id;
        if(hasChildren){
          button.setAttribute('aria-controls',children.id);
          const arrow=el('span','›','tag-tree-chevron');arrow.setAttribute('aria-hidden','true');button.append(arrow);
        }
        if(inBranch)button.style.animationDelay=Math.min(index,7)*25+'ms';
        button.onclick=()=>{
          remember();
          collapsedCollectionGroup=hasChildren&&button.getAttribute('aria-expanded')==='true'?id:'';
          filter=id;paintCollectionFilters(result);void load();
        };
        return button;
      }));
    }
    Array.from(container.children).filter(button=>button!==children).forEach((button,index)=>{
      const {id,hasChildren}=entries[index];
      const inGroup=hasChildren&&activeGroup===id;
      const open=inGroup&&related.length>0;
      button.setAttribute('aria-pressed',String(filter===id||inGroup));
      if(hasChildren)button.setAttribute('aria-expanded',String(open));
    });
  }
  render(parents,[{id:'',label:'全部',count:result.allTotal},...collections.filter(tag=>!tag.parentId),{id:'__unclassified',label:'未分类',count:result.unclassifiedCount}]);
  const wasHidden=children.hidden;
  children.hidden=!related.length;
  if(!related.length){if(children.parentElement!==tree)tree.append(children);return;}
  const group=collections.find(tag=>tag.id===activeGroup);
  const parent=Array.from(parents.children).find(button=>button.dataset.collectionFilter===activeGroup);
  const changed=children.dataset.groupId!==activeGroup||children.previousElementSibling!==parent;
  children.dataset.groupId=activeGroup;
  children.setAttribute('aria-label',group.label+'子标签');
  render(children,related);
  if(changed)parent.after(children);
  if(changed||wasHidden){
    const viewport=parents.getBoundingClientRect(),left=parent.getBoundingClientRect().left,right=children.firstElementChild.getBoundingClientRect().right;
    if(left<viewport.left||right>viewport.right)parents.scrollLeft+=left-viewport.left-2;
  }
}
function paintNavigation(result) {
  collections = (result.collectionCounts || result.tags || []).filter(x => !x.hidden);
  document.body.classList.toggle('directory',directory); byId('brand-header').hidden=!directory;
  byId('view-title').textContent = directory ? '我的收藏' : filter ? collections.find(t => t.id === filter)?.label || '未分类' : '我的收藏';
  byId('collections-toggle').textContent = directory ? '全部收藏 ›' : '我的合集 ›';
  paintCollectionFilters(result);
  const nextKey=JSON.stringify([directory,result.allTotal,result.unclassifiedCount,result.collectionCounts||result.tags,result.domains,result.tags]);
  byId('folders').hidden=!directory;byId('items').hidden=directory;byId('more').hidden=directory||offset>=result.total;
  if(nextKey===navigationKey)return;navigationKey=nextKey;
  if (directory) {
    if(byId('folders').contains(byId('collection-form')))byId('folders').before(byId('collection-form'));
    byId('folders').replaceChildren();
    const all = el('button', '', 'folder all-folder'), allCover=el('span','','folder-cover'), allLabel=el('span','','folder-label'); allCover.append(KumoUI.icon('bookmark'));allLabel.append(el('strong','全部收藏'),el('span',result.total+' 条内容'));all.append(allCover,allLabel,KumoUI.icon('chevron'));
    all.onclick = () => { remember(); directory = false; filter = ''; void load(); }; byId('folders').append(all);
    const heading = el('div','','row folder-heading'); heading.append(el('h2','我的合集')); const add = el('button','+ 新合集','chip dashed'); add.onclick = () => { byId('collection-form').hidden = false; document.querySelector('#folders .folder-heading').after(byId('collection-form')); byId('collection-name').focus(); }; heading.append(add); byId('folders').append(heading);
    for (const c of [...collections.filter(t=>!t.parentId), {id:'__unclassified',label:'未分类',count:result.unclassifiedCount || 0,covers:result.unclassifiedCovers || []}]) {
      const b = el('button','','folder'), cover = el('span','','folder-cover'), label = el('span','','folder-label');
      const candidates=[],seen=new Set();
      const addCover=(item,name)=>{const key=item.id+'/'+name;if(KumoUI.validAsset(name)&&!seen.has(key)){seen.add(key);candidates.push({item,name});}};
      for(const item of c.covers || [])addCover(item,KumoUI.preview(item));
      for(const item of c.covers || [])for(const name of [...(item.files?.images||[]),...(item.files?.frames||[])])addCover(item,name);
      for (const {item,name} of candidates.slice(0,4)) { const image = imageFor(item,'',name); if (image) cover.append(image); }
      const tiles=cover.querySelectorAll('img').length;cover.dataset.tiles=String(tiles);
      if(!tiles)cover.append(KumoUI.icon('bookmark'));
      label.append(el('strong',c.label), el('span', (c.count || 0) + ' 条内容')); b.append(cover,label,KumoUI.icon('chevron'));
      b.onclick = () => { remember(); directory = false; filter = c.id; void load(); }; byId('folders').append(b);
    }
  }
  const domain = byId('domain-filter'), chosen = domain.value; domain.replaceChildren(new Option('全部领域',''), ...(result.domains || []).map(d => new Option(d.name || d.label,d.id))); domain.value = chosen;
  byId('manage-tags').replaceChildren();
  for (const c of result.tags || []) {
    const row = el('div','','manage-row'), input = el('input'); input.value = c.label; input.maxLength = 40; input.setAttribute('aria-label','合集名称');
    const rename = el('button','改名','quiet'), hide = el('button',c.deletedAt ? '撤销删除' : c.hidden ? '恢复' : '删除','quiet');
    rename.onclick = async () => { try { await KumoBridge.updateTag({action:'rename',id:c.id,label:input.value}); await load(); } catch(e) { status(e.message); } };
    hide.onclick = async () => { if(!c.hidden)return deleteCollection(c);try { await KumoBridge.updateTag({action:'restore',id:c.id}); await load(); } catch(e) { status(e.message); } };
    const hasChildren=(result.tags||[]).some(t=>t.parentId===c.id);
    const parent=el('select');parent.setAttribute('aria-label',c.label+'的上级标签');
    parent.append(new Option('一级标签',''),...collections.filter(t=>!t.parentId&&t.id!==c.id).map(t=>new Option(t.label,t.id)));
    parent.value=c.parentId||'';parent.disabled=c.hidden||hasChildren;
    parent.onchange=async()=>{
      parent.disabled=true;
      try{await KumoBridge.updateTag({action:'parent',id:c.id,parentId:parent.value});await load();}
      catch(e){parent.value=c.parentId||'';byId('tag-settings-status').textContent=e.message;}
      finally{parent.disabled=c.hidden||hasChildren;}
    };
    row.append(input,rename,hide,parent); byId('manage-tags').append(row);
  }
}
async function load(reset = true) {
  const requestId = ++epoch;
  try {
    const result = await KumoBridge.library({q:directory?'':byId('search').value,tag:directory?'':filter,domain:directory?'':byId('domain-filter').value,offset:reset||directory?0:offset,limit:directory?1:40});
    if (requestId !== epoch) return;
    disconnected=false;byId('connection-help').hidden=true;
    if(reset){offset=0;number=0;records=[];byId('items').replaceChildren();}
    const cards=document.createDocumentFragment();
    for (const item of directory?[]:result.items) {
      records.push(item);++number;
      const b = el('article','','card');b.tabIndex=0;b.setAttribute('role','button');b.setAttribute('aria-label','查看收藏：'+KumoUI.displayTitle(item));b.dataset.item = item.id;
      const thumb=imageFor(item,'thumb');
      if(thumb){const wrap=el('span','','thumb-wrap');wrap.append(thumb);if(item.stats?.videos)wrap.append(el('span','▶','play'));b.append(wrap);}
      const body = el('span','','card-body'),headingRow=el('span','','card-heading');const heading=el('span',KumoUI.displayTitle(item),'card-title');heading.title=item.title||'';headingRow.append(heading);
      const source=safeUrl(KumoSourceLinks.sourceUrl(item));if(source){const link=el('a','','source-icon');link.href=source;link.target='_blank';link.rel='noopener noreferrer';link.title='打开原文';link.setAttribute('aria-label','打开原文：'+KumoUI.displayTitle(item));link.append(KumoUI.icon('external'));link.onclick=event=>event.stopPropagation();headingRow.append(link);}body.append(headingRow);
      const meta = el('span','','card-meta'), mark = el('span','','platform-mark'); KumoUI.platform(mark,item.platform || '网页'); meta.append(mark,document.createTextNode(item.author||'')); body.append(meta);
      const tagRow=el('span','','card-tags');for(const keyword of KumoUI.contentKeywords(item.contentKeywords))tagRow.append(el('span',keyword,'card-tag content-keyword'));tagRow.setAttribute('aria-label','AI 内容关键词');if(tagRow.children.length)body.append(tagRow);
      if(item.contentSummary)body.append(el('span','摘要 · '+item.contentSummary,'card-note content-summary'));
      if (item.userNote || !item.contentSummary&&item.excerpt) body.append(el('span',item.userNote || item.excerpt,'card-note'));
      const incomplete = item.missingMedia||(item.warnings || []).some(x => /^(?:media_download_pending|(?:images|videos)_not_fully_downloaded)/.test(x));
      if (incomplete) body.append(el('span','媒体待补全','cover-errors'));
      const resources=el('span','','resources');resources.title=resourceText(item).replaceAll('\n',' · ');resources.setAttribute('aria-label',resources.title);
      if(item.stats?.videos){const badge=el('span','','resource-badge');badge.append(KumoUI.icon('video'),el('span',String(item.stats.videos)));resources.append(badge);}
      if(item.stats?.images){const badge=el('span','','resource-badge');badge.append(KumoUI.icon('image'),el('span',String(item.stats.images)));resources.append(badge);}
      const arrow=KumoUI.icon('chevron');arrow.classList.add('card-arrow');
      b.append(body,arrow,resources,el('span',KumoUI.relativeDate(item.capturedAt),'card-date'));const open=()=>{trigger=b;void show(item.id);};b.onclick=event=>{if(!event.target.closest('a'))open();};b.onkeydown=event=>{if(event.target===b&&['Enter',' '].includes(event.key)){event.preventDefault();open();}};cards.append(b);
    }
    byId('items').append(cards);
    offset += result.items.length; paintNavigation(result);
    status(result.cachedOnly?'本地索引 · '+new Date(result.savedAt).toLocaleString():result.warnings?.length?'有 '+result.warnings.length+' 个收藏目录缺少可读文件。':result.total?'':'暂无匹配内容');byId('library-status').title=result.cachedOnly?'当前展示上次保存在此浏览器中的收藏；在设置中恢复权限后可同步文件夹变化。':'';
    if (reset&&!document.body.classList.contains('reading')) window.scrollTo(0,positions.get(directory ? 'directory' : filter) || 0);
  } catch(e) { if(requestId!==epoch)return;disconnected=true;byId('connection-help').hidden=false;const first=e.code==='KUMO_NOT_CONFIGURED';byId('setup-title').textContent=first?'选择你的收藏位置':'暂时无法读取收藏';byId('setup-description').textContent=first?'首次选定文件夹后，Kumo 会记住位置，之后直接打开收藏。':e.message||'请在设置中检查资料库权限。';byId('retry-library').textContent=first?'开始使用':'打开设置';status(''); }
}
async function deleteCollection(c){if(!confirm('删除“'+c.label+'”？收藏保留，仅移除该标签的归属。可在管理标签中撤销。'))return;try{await KumoBridge.updateTag({action:'delete',id:c.id});if(filter===c.id)filter='';await load();}catch(e){status('删除失败：'+e.message);}}
function refreshLibrary(){KumoBridge.invalidateCache();navigationKey='';return load();}
byId('retry-library').onclick=()=>KumoStorage.openConnection();
async function locationSettings(){try{const info=await KumoStorage.connectionState();byId('library-location').textContent=info.known?'已保存位置：'+info.name+(info.write==='granted'?' · 可以同步':' · 使用本地索引，授权后可同步'):'尚未选择收藏位置';byId('restore-library-access').hidden=info.write==='granted';}catch(e){byId('library-location').textContent=e.message;}}
byId('library-settings-toggle').onclick=()=>{void locationSettings();byId('settings-dialog').showModal();};
byId('sync-library-now').onclick=async()=>{const info=await KumoStorage.connectionState();if(info.read!=='granted'){await KumoStorage.openConnection();return;}await refreshLibrary();await locationSettings();};
byId('restore-library-access').onclick=()=>KumoStorage.openConnection();byId('change-library-location').onclick=()=>KumoStorage.openConnection({change:true});
window.addEventListener('storage',event=>{if(event.key==='kumo-directory-revision')void refreshLibrary();});
window.addEventListener('kumo:library-updated',()=>void load());

let detailEpoch = 0;
async function show(id) {
  const requestId = ++detailEpoch;
  try {
    const result = await KumoBridge.item(id); if (requestId !== detailEpoch) return;
    currentDetail = result; const meta = result.metadata; byId('detail-title').textContent = KumoUI.displayTitle(meta);byId('detail-title').title=meta.title||'';
    const mark=el('span','','platform-mark');KumoUI.platform(mark,meta.platform||'网页');byId('detail-meta').replaceChildren(mark,document.createTextNode([meta.author,KumoUI.relativeDate(meta.capturedAt)].filter(Boolean).join(' · ')));
    const tags = result.effectiveUserTags ?? result.events?.at(-1)?.userTags ?? meta.userTags ?? [];
    const url = safeUrl(KumoSourceLinks.sourceUrl({...meta,url:meta.url||result.url})); byId('original').hidden = !url; if (url) byId('original').href = url; else byId('original').removeAttribute('href');
    const title=byId('detail-title');if(url){const link=el('a',KumoUI.displayTitle(meta),'detail-title-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.title='打开原文';title.replaceChildren(link);}
    const topLink=byId('detail-original');topLink.hidden=!url;if(url)topLink.href=url;else topLink.removeAttribute('href');
    byId('original-hint').hidden=!/xiaohongshu\.com\/(?:explore|discovery\/item)\//.test(url)||KumoSourceLinks.hasAccessUrl(meta);
    renderBody(result.source);
    const discussion=[...(Array.isArray(meta.comments)?meta.comments:[]),...(Array.isArray(meta.authorFollowups)?meta.authorFollowups:[])].filter(Boolean);
    const seen=new Set(),comments=discussion.filter(value=>{const key=[value.author||'',value.text||value.content||''].join('\n');if(seen.has(key))return false;seen.add(key);return true;});
    renderDiscussion(byId('comments-list'),comments,'本次未保存评论。');
    document.querySelector('[data-view="comments"]').textContent='评论 '+comments.length;
    byId('detail-tags').replaceChildren(...tags.map(t=>el('span',collections.find(c=>c.id===t.id)?.label||t.label)));
    for(const keyword of KumoUI.contentKeywords(result.contentKeywords))byId('detail-tags').append(el('span','# '+keyword,'content-keyword'));
    byId('compiled-summary').replaceChildren();
    byId('compiled-summary').append(el('h2','内容概括'),el('p',result.contentSummary||'尚未整理摘要；正文、评论和笔记可直接阅读。'));
    if(result.contentSummary){byId('compiled-summary').append(el('small',result.evidenceStatus==='index_only'?'AI 派生摘要 · 仅用于发现，不作为知识依据':'AI 派生摘要 · 请结合原件判断'));if(result.reuseWhen?.length)byId('compiled-summary').append(el('p','可参考：'+result.reuseWhen.slice(0,2).join('；')));}
    const labelFor=c=>[collections.find(t=>t.id===c.parentId)?.label,c.label].filter(Boolean).join(' / ');
    collectionSelect.replaceChildren(new Option('未分类',''),...collections.map(c=>new Option(labelFor(c),c.id)));collectionSelect.value=tags[0]?.id||'';
    byId('collection-control').hidden=true;byId('change-collection').setAttribute('aria-expanded','false');
    const notes = (result.events || []).filter(e=>e.kind !== 'collection').map(e=>e.note).filter(note=>note !== ''); byId('note-history').textContent = notes.length ? notes.join('\n\n────────\n\n') : meta.userNote || '暂无笔记';
    byId('assets').replaceChildren(); const files = meta.files || {};
    const imageCount=[...(files.frames||[]),...(files.images||[])].filter(KumoUI.validAsset).length;
    byId('assets').classList.toggle('media-masonry',imageCount>1);
    byId('assets').style.columnCount=imageCount>1?String(Math.min(4,imageCount)):'';
    byId('media-caption').textContent=resourceText({stats:meta.stats}).replaceAll('\n',' · ')+(meta.stats?.characters?' · '+meta.stats.characters+' 字':'');
    byId('detail-status').textContent='';byId('note-editor').hidden=true;byId('new-note').value='';
    const retry=byId('repair-item-media');
    retry.hidden=!(meta.stats?.videos||meta.stats?.images||files.videos?.length||files.images?.length);
    retry.onclick=()=>repair(id,retry,byId('detail-status'));
    if(byId('detail').hidden){detailReturnPosition=window.scrollY;byId('detail').hidden=false;document.body.classList.add('reading');detailView('body');window.scrollTo(0,0);}
    byId('back').focus({preventScroll:true});
    for(const name of [...(files.frames||[]),...(files.images||[]),...(files.videos||[])]){
      const video=/^assets\/video-\d{2,}\.(?:mp4|webm|mov|m4v)$/i.test(name);
      if(!video&&!KumoUI.validAsset(name))continue;
      const media=el(video?'video':'img');
      const unavailable=()=>{
        if(requestId!==detailEpoch)return;
        if(video)media.replaceWith(el('p','此视频文件目前缺失或无法播放。','cover-errors'));
        else media.remove();
        const message=byId('detail-status');
        if(!message.textContent)message.textContent='部分附件不可用。正文、笔记与原文入口可以继续查看。';
      };
      media.onerror=unavailable;
      if(video){
        media.controls=true;media.preload='none';
        const poster=KumoUI.preview({files});if(poster)media.poster=KumoBridge.asset(id,poster);
        void KumoBridge.assetURL(id,name).then(url=>{if(requestId===detailEpoch)media.src=url;},unavailable);
      }else{
        media.alt='保存的媒体 '+name;media.loading='lazy';KumoBridge.bindAsset(media,id,name);
      }
      byId('assets').append(media);
    }
    if(!files.videos?.length&&meta.stats?.videos)byId('assets').append(el('p','视频尚未离线保存，可重试媒体或打开原文。','cover-errors'));
  } catch(e) { status('无法读取内容：' + e.message); }
}
let repairing=false;
async function repair(id,button,message){
  if(repairing)return;
  repairing=true;button.disabled=true;
  message.textContent='正在核对本地附件…';
  try{
    const stats=await KumoBridge.repairMedia(id,{onProgress:value=>{
      message.textContent='已检查 '+value.processed+' / '+value.total+'，补齐 '+value.recovered+' 个附件。';
    }});
    await load();
    if(id&&currentDetail?.id===id&&!byId('detail').hidden)await show(id);
    message.textContent=stats.total?'已补齐 '+stats.recovered+' 个附件，另有 '+stats.remaining+' 个暂时无法恢复。'+(stats.blocked?'其中 '+stats.blocked+' 个未能通过浏览器跨站读取。':''):'此范围内没有待补齐的附件。';
  }catch(error){message.textContent='未能补齐媒体：'+error.message;}
  finally{repairing=false;button.disabled=false;}
}
byId('repair-library-media').onclick=()=>repair(null,byId('repair-library-media'),byId('repair-library-status'));
byId('back').onclick = closeDetail;
byId('settings').onclick=()=>{void locationSettings();byId('settings-dialog').showModal();};byId('settings-close').onclick=()=>byId('settings-dialog').close();byId('list-back').onclick=()=>{remember();directory=true;filter='';void load();};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!byId('detail').hidden&&!byId('settings-dialog').open)closeDetail();});
byId('edit-note').onclick = () => { byId('note-editor').hidden = false; byId('new-note').focus(); };
assign.onclick = async () => {
  if (!currentDetail) return; assign.disabled = true;
  try { const id = currentDetail.id; await KumoBridge.setCollection(currentDetail.metadata,collectionSelect.value); await show(id); remember(); await load(); trigger = byId('items').querySelector(`[data-item="${id}"]`) || byId('collections-toggle'); byId('detail-status').textContent = '合集已更新，原件与笔记未变动。'; }
  catch(e) { byId('detail-status').textContent = '更新失败：' + e.message; } finally { assign.disabled = false; }
};
byId('note-editor').onsubmit = async event => {
  event.preventDefault(); const note = byId('new-note').value; if (!note || !currentDetail) return;
  const meta = currentDetail.metadata, tags = currentDetail.effectiveUserTags ?? currentDetail.events?.at(-1)?.userTags ?? meta.userTags ?? [];
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { await KumoBridge.annotate(meta,note,tags); await show(currentDetail.id); const body = trigger?.querySelector('.card-body'); if (body) { const preview = body.querySelector('.card-note') || body.appendChild(el('span','','card-note')); preview.textContent = note; } byId('detail-status').textContent = '笔记已原样追加，旧笔记与原件保留。'; } catch(e) { byId('detail-status').textContent = '追加失败：' + e.message; } finally { button.disabled = false; }
};
byId('collections-toggle').onclick = () => { remember(); directory = !directory; filter = ''; void load(); };
byId('collection-form').onsubmit = async event => {
  event.preventDefault(); const label = byId('collection-name').value.trim(); if (!label) return;
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  try { await KumoBridge.updateTag({action:'add',label}); byId('collection-form').hidden = true; byId('collection-name').value = ''; await load(); } catch(e) { status(e.message); } finally { button.disabled = false; }
};
byId('refresh').onclick = () => refreshLibrary(); byId('more').onclick = () => load(false); byId('domain-filter').onchange = () => load();
let debounce; byId('search').oninput = () => { clearTimeout(debounce); debounce = setTimeout(()=>load(),200); };
byId('organize').onclick = async () => {
  try { const connection = await KumoBridge.status(); if (!connection?.libraryRoot) throw new Error('请先连接知识库');
    await navigator.clipboard.writeText('使用 Kumo AI 端插件或直接按 KUMO.md 整理资料库：' + connection.libraryRoot + '。先读 KUMO.md、LIBRARY.md 和相关主题，核对待编译材料；原件与笔记保留；不要把收藏当长期偏好或把视频存在当完整理解。');
    status('整理指令已复制；请粘贴到 Codex 执行，没有自动调用模型。');
  } catch(e) { status('未能复制：' + e.message); }
};
byId('detail-original').append(KumoUI.icon('external'));
void (async()=>{await load();if(!disconnected&&!collections.length){await KumoUI.ensureCollections(KumoBridge).catch(()=>{});await refreshLibrary();}const match=location.hash.match(/^#item=([a-f0-9]{24})$/);if(match)await show(match[1]);})();

