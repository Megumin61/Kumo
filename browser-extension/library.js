const byId = id => document.getElementById(id);
const el = (tag, text = '', className = '') => { const node = document.createElement(tag); node.textContent = text; node.className = className; return node; };
const status = text => { byId('library-status').textContent = text; };
const safeUrl = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };
let offset = 0, epoch = 0, filter = '', directory = location.hash === '#collections', currentDetail = null, trigger = null, collections = [], records = [], number = 0;
const positions = new Map();
let detailReturnPosition=0;
let disconnected=false;
function closeDetail(){byId('detail').hidden=true;document.body.classList.remove('reading');detailEpoch++;byId('assets').querySelectorAll('video').forEach(v=>{v.pause();v.removeAttribute('src');v.load();});window.scrollTo(0,detailReturnPosition);trigger?.focus({preventScroll:true});}
function detailView(view){byId('article-body').hidden=view!=='body';byId('comments-view').hidden=view!=='comments';document.querySelectorAll('#detail-tabs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));}
function renderDiscussion(container,values,empty){container.replaceChildren();if(!values.length){container.append(el('p',empty,'muted'));return;}for(const value of values.slice(0,100)){const card=el('article','','discussion-card');const name=typeof value.author==='string'?value.author.trim():'';if(name&&!/^(未记录作者|示例作者|unknown)$/i.test(name)){const author=el('strong',name),url=safeUrl(value.authorUrl);if(url){const link=el('a',name);link.href=url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);}else card.append(author);}if(value.likes?.raw)card.append(el('span',value.likes.raw+' 赞','muted'));card.append(el('p',value.text||value.content||''));container.append(card);}}
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
  const image = el('img', '', className); image.alt = item.title || '媒体预览'; image.loading = 'lazy'; image.src = KumoBridge.asset(item.id, name); image.onerror = () => {const parent=image.parentElement;image.remove();if(parent?.classList.contains('folder-cover')){parent.dataset.tiles=String(parent.querySelectorAll('img').length);if(!parent.querySelector('img'))parent.replaceChildren(KumoUI.icon('bookmark'));}else if(parent?.classList.contains('thumb-wrap')){const count=parent.querySelectorAll('img').length;if(!count)parent.remove();else{parent.dataset.tiles=String(count);if(count===1)parent.classList.remove('thumb-collage');}}}; return image;
}
function resourceText(item) {
  const s = item.stats || {}; const images = Number(s.images || 0), videos = Number(s.videos || 0);
  return [images ? '图片 ' + images : '', videos ? '视频 ' + videos : ''].filter(Boolean).join('\n') || '文字';
}
function paintNavigation(result) {
  collections = (result.collectionCounts || result.tags || []).filter(x => !x.hidden);
  document.body.classList.toggle('directory',directory); byId('brand-header').hidden=!directory;
  byId('view-title').textContent = directory ? '我的收藏' : filter ? collections.find(t => t.id === filter)?.label || '未分类' : '我的收藏';
  byId('collections-toggle').textContent = directory ? '全部收藏 ›' : '我的合集 ›';
  byId('collection-filters').replaceChildren();
  if (!directory) for (const c of [{id:'',label:'全部',count:result.allTotal}, ...collections, {id:'__unclassified',label:'未分类',count:result.unclassifiedCount}]) {
    const b = el('button', c.label + (c.count != null ? ' ' + c.count : ''), 'chip'); b.title = c.label; b.type = 'button'; b.setAttribute('aria-pressed', String(filter === c.id));
    b.onclick = () => { remember(); filter = c.id; void load(); };
    if(c.id&&c.id!=='__unclassified'){const wrap=el('span','','tag-with-delete'),remove=el('button','×','tag-delete');remove.type='button';remove.setAttribute('aria-label','删除标签 '+c.label);remove.onclick=()=>deleteCollection(c);wrap.append(b,remove);byId('collection-filters').append(wrap);}else byId('collection-filters').append(b);
  }
  byId('folders').hidden = !directory; byId('items').hidden = directory; byId('more').hidden = directory || offset >= result.total;
  if (directory) {
    if(byId('folders').contains(byId('collection-form')))byId('folders').before(byId('collection-form'));
    byId('folders').replaceChildren();
    const all = el('button', '', 'folder all-folder'), allCover=el('span','','folder-cover'), allLabel=el('span','','folder-label'); allCover.append(KumoUI.icon('bookmark'));allLabel.append(el('strong','全部收藏'),el('span',result.total+' 条内容'));all.append(allCover,allLabel,KumoUI.icon('chevron'));
    all.onclick = () => { remember(); directory = false; filter = ''; void load(); }; byId('folders').append(all);
    const heading = el('div','','row folder-heading'); heading.append(el('h2','我的合集')); const add = el('button','+ 新合集','chip dashed'); add.onclick = () => { byId('collection-form').hidden = false; document.querySelector('#folders .folder-heading').after(byId('collection-form')); byId('collection-name').focus(); }; heading.append(add); byId('folders').append(heading);
    for (const c of [...collections, {id:'__unclassified',label:'未分类',count:result.unclassifiedCount || 0,covers:result.unclassifiedCovers || []}]) {
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
    row.append(input,rename,hide); byId('manage-tags').append(row);
  }
}
async function load(reset = true) {
  const requestId = ++epoch;
  try {
    const result = await KumoBridge.library({q:directory?'':byId('search').value,tag:directory?'':filter,domain:directory?'':byId('domain-filter').value,offset:reset||directory?0:offset,limit:40});
    if (requestId !== epoch) return;
    disconnected=false;byId('connection-help').hidden=true;
    if(reset){offset=0;number=0;records=[];byId('items').replaceChildren();}
    for (const item of result.items) {
      records.push(item);++number;
      const b = el('button','','card'); b.type = 'button'; b.dataset.item = item.id;
      const thumb=imageFor(item,'thumb');
      if(thumb){const wrap=el('span','','thumb-wrap');wrap.append(thumb);if(item.stats?.videos)wrap.append(el('span','▶','play'));b.append(wrap);}
      const body = el('span','','card-body');const heading=el('span',KumoUI.displayTitle(item),'card-title');heading.title=item.title||'';body.append(heading);
      const meta = el('span','','card-meta'), mark = el('span','','platform-mark'); KumoUI.platform(mark,item.platform || '网页'); meta.append(mark,document.createTextNode(item.author||'')); body.append(meta);
      const tagRow=el('span','','card-tags');for(const keyword of KumoUI.contentKeywords(item.contentKeywords))tagRow.append(el('span',keyword,'card-tag content-keyword'));tagRow.setAttribute('aria-label','AI 内容关键词');if(tagRow.children.length)body.append(tagRow);
      if(item.contentSummary)body.append(el('span','摘要 · '+item.contentSummary,'card-note content-summary'));
      if (item.userNote || !item.contentSummary&&item.excerpt) body.append(el('span',item.userNote || item.excerpt,'card-note'));
      const incomplete = (item.warnings || []).some(x => /pending|incomplete|not_found|not_fully_downloaded|download_failed/.test(x));
      if (incomplete) body.append(el('span','媒体待补全','cover-errors'));
      const resources=el('span','','resources');resources.title=resourceText(item).replaceAll('\n',' · ');resources.setAttribute('aria-label',resources.title);
      if(item.stats?.videos){const badge=el('span','','resource-badge');badge.append(KumoUI.icon('video'),el('span',String(item.stats.videos)));resources.append(badge);}
      if(item.stats?.images){const badge=el('span','','resource-badge');badge.append(KumoUI.icon('image'),el('span',String(item.stats.images)));resources.append(badge);}
      const arrow=KumoUI.icon('chevron');arrow.classList.add('card-arrow');
      b.append(body,arrow,resources,el('span',KumoUI.relativeDate(item.capturedAt),'card-date')); b.onclick = () => { trigger = b; void show(item.id); }; byId('items').append(b);
    }
    offset += result.items.length; paintNavigation(result);
    status(result.total ? '' : '暂无匹配内容');
    if (reset&&!document.body.classList.contains('reading')) window.scrollTo(0,positions.get(directory ? 'directory' : filter) || 0);
  } catch(e) { if(requestId!==epoch)return;disconnected=true;byId('connection-help').hidden=false;status('资料库尚未连接或暂时不可用。已保存的收藏不会因此清空，可点击“刷新连接”重试。'); }
}
async function deleteCollection(c){if(!confirm('删除“'+c.label+'”？收藏保留，仅移除该标签的归属。可在管理标签中撤销。'))return;try{await KumoBridge.updateTag({action:'delete',id:c.id});if(filter===c.id)filter='';await load();}catch(e){status('删除失败：'+e.message);}}
byId('retry-library').onclick=()=>void load();
setInterval(()=>{if(disconnected&&!document.hidden)void load();},15000);
let detailEpoch = 0;
async function show(id) {
  const requestId = ++detailEpoch;
  try {
    const result = await KumoBridge.item(id); if (requestId !== detailEpoch) return;
    currentDetail = result; const meta = result.metadata; byId('detail-title').textContent = KumoUI.displayTitle(meta);byId('detail-title').title=meta.title||'';
    const mark=el('span','','platform-mark');KumoUI.platform(mark,meta.platform||'网页');byId('detail-meta').replaceChildren(mark,document.createTextNode([meta.author,KumoUI.relativeDate(meta.capturedAt)].filter(Boolean).join(' · ')));
    const tags = result.effectiveUserTags ?? result.events?.at(-1)?.userTags ?? meta.userTags ?? [];
    const url = safeUrl(KumoSourceLinks.sourceUrl({...meta,url:meta.url||result.url})); byId('original').hidden = !url; if (url) byId('original').href = url; else byId('original').removeAttribute('href');
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
    collectionSelect.replaceChildren(new Option('未分类',''),...collections.map(c=>new Option(c.label,c.id))); collectionSelect.value = tags[0]?.id || '';
    byId('collection-control').hidden=true;byId('change-collection').setAttribute('aria-expanded','false');
    const notes = (result.events || []).filter(e=>e.kind !== 'collection').map(e=>e.note).filter(note=>note !== ''); byId('note-history').textContent = notes.length ? notes.join('\n\n────────\n\n') : meta.userNote || '暂无笔记';
    byId('assets').replaceChildren(); const files = meta.files || {};
    const imageCount=[...(files.frames||[]),...(files.images||[])].filter(KumoUI.validAsset).length;
    byId('assets').classList.toggle('media-masonry',imageCount>1);
    byId('assets').style.columnCount=imageCount>1?String(Math.min(4,imageCount)):'';
    byId('media-caption').textContent=resourceText({stats:meta.stats}).replaceAll('\n',' · ')+(meta.stats?.characters?' · '+meta.stats.characters+' 字':'');
    for (const name of [...(files.frames || []), ...(files.images || []), ...(files.videos || [])]) {
      if (!KumoUI.validAsset(name) && !/^assets\/video-\d{2}\.(mp4|webm|mov|m4v)$/i.test(name)) continue;
      const video = name.startsWith('assets/video-'), media = el(video?'video':'img');
      if (video) { media.controls = true; media.preload = 'metadata'; const poster = KumoUI.preview({files}); if (poster) media.poster = KumoBridge.asset(id,poster); }
      else { media.alt = '保存的媒体 ' + name; media.loading = 'lazy'; }
      media.src = KumoBridge.asset(id,name); media.onerror = () => { media.remove(); byId('detail-status').textContent = '该本地媒体读取失败，原帖链接仍可回溯。'; }; byId('assets').append(media);
      if (video) byId('assets').append(el('p','本地视频 · ' + name.split('.').at(-1).toUpperCase()));
    }
    if (!files.videos?.length && meta.stats?.videos) byId('assets').append(el('p','视频尚未离线保存，请查看原帖或重新剪藏补全。','cover-errors'));
    byId('detail-status').textContent = ''; byId('note-editor').hidden = true; byId('new-note').value = '';
    if(byId('detail').hidden){detailReturnPosition=window.scrollY;byId('detail').hidden=false;document.body.classList.add('reading');detailView('body');window.scrollTo(0,0);}byId('back').focus({preventScroll:true});
  } catch(e) { status('无法读取内容：' + e.message); }
}
byId('back').onclick = closeDetail;
byId('settings').onclick=()=>byId('settings-dialog').showModal();byId('settings-close').onclick=()=>byId('settings-dialog').close();byId('list-back').onclick=()=>{remember();directory=true;filter='';void load();};
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
byId('refresh').onclick = () => load(); byId('more').onclick = () => load(false); byId('domain-filter').onchange = () => load();
let debounce; byId('search').oninput = () => { clearTimeout(debounce); debounce = setTimeout(()=>load(),200); };
byId('organize').onclick = async () => {
  try { const connection = await KumoBridge.status(); if (!connection?.libraryRoot) throw new Error('请先连接知识库');
    await navigator.clipboard.writeText('使用 Kumo Skill 整理知识库：' + connection.libraryRoot + '。先读 ORGANIZATION.md、LIBRARY.md 和 organization.json，按任务建立领域索引，原件与笔记保留；不要把收藏当长期偏好或把视频存在当完整理解。');
    status('整理指令已复制；请粘贴到 Codex 执行，没有自动调用模型。');
  } catch(e) { status('未能复制：' + e.message); }
};
void KumoUI.ensureCollections(KumoBridge).catch(()=>{}).then(async()=>{await load();const match=location.hash.match(/^#item=([a-f0-9]{24})$/);if(match)await show(match[1]);});

