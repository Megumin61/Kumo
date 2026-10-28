(function(scope) {
  let values = [], useBridge = false, offline = false;
  const selected = new Set();
  let expanded=false,observed=false,initialized=false,unclassifiedCount=null;
  const recentKey='kumo-last-saved-tag';
  function orderTags(tags, recent) { return [...tags].sort((a,b)=>Number(b.id===recent)-Number(a.id===recent)||(Number(b.count)||0)-(Number(a.count)||0)); }
  function recordSaved(tags){if(tags?.[0]?.id)localStorage.setItem(recentKey,tags[0].id);}
  async function inferRecent(tags) {
    let offset=0, latest=null;
    const visible=new Set(tags.filter(tag=>!tag.hidden).map(tag=>tag.id));
    do {
      const page=await KumoBridge.library({offset,limit:200});
      for(const item of page.items||[]) {
        const id=item.userTags?.find(tag=>visible.has(tag.id))?.id;
        const captured=Date.parse(item.capturedAt||'');
        if(id && Number.isFinite(captured) && (!latest || captured>latest.time)) latest={id,time:captured};
      }
      const count=(page.items||[]).length; offset+=count;
      if(!count || offset>=page.total) break;
    } while(true);
    return latest?.id || null;
  }
  function selectionLabel(){const label=document.querySelector('section[aria-label="用户标签"] .note-label'),tag=values.find(value=>selected.has(value.id));if(label){label.textContent='标签 · '+(tag?.label||'未分类');label.title=tag?.label||'未分类';}}
  function closeChooser(){expanded=false;document.getElementById('tag-list').classList.remove('expanded');selectionLabel();measure();}
  function setupChooser(list){
    if(!observed){
      observed=true;
      const more=document.createElement('button');more.type='button';more.id='all-tags';more.className='text-button';
      more.setAttribute('aria-controls','tag-list');more.onclick=()=>{expanded=!expanded;list.classList.toggle('expanded',expanded);measure();};document.querySelector('.label-row').append(more);
      new ResizeObserver(measure).observe(list);
    }
    requestAnimationFrame(measure);
  }
  function measure(){const list=document.getElementById('tag-list'),more=document.getElementById('all-tags');if(!more)return;more.hidden=!expanded&&list.scrollHeight<=list.clientHeight+2;more.setAttribute('aria-expanded',String(expanded));more.textContent=expanded?'收起标签 ↑':'展开全部 '+(values.filter(tag=>!tag.hidden).length+1)+' ↓';}
  async function load(connected, {bridgeExpected=false}={}) {
    useBridge = connected;
    offline=!connected&&bridgeExpected;
    if (connected) await KumoUI.ensureCollections(KumoBridge);
    else if (!offline&&localStorage.getItem('kumo-tags') === null) localStorage.setItem('kumo-tags',JSON.stringify(KumoUI.presetCollections.map((label,index)=>({id:'kumo-preset-'+index,label}))));
    if(connected){const overview=await KumoBridge.tags();values=overview.tags;unclassifiedCount=overview.unclassifiedCount??null;}
    else{values=JSON.parse(localStorage.getItem(offline?'kumo-bridge-tags-cache':'kumo-tags')||'[]');unclassifiedCount=null;}
    let recent=localStorage.getItem(recentKey);
    if(connected&&!values.some(tag=>!tag.hidden&&tag.id===recent)){recent=await inferRecent(values).catch(()=>null);if(recent)localStorage.setItem(recentKey,recent);}
    values=orderTags(values,recent);
    if(connected)localStorage.setItem('kumo-bridge-tags-cache',JSON.stringify(values));
    for(const id of selected)if(!values.some(tag=>tag.id===id&&!tag.hidden))selected.delete(id);
    if(!initialized){selected.clear();const first=values.find(tag=>!tag.hidden);if(first){selected.add(first.id);initialized=true;}}
    const list = document.getElementById('tag-list'); list.replaceChildren();
    setupChooser(list);
    for (const tag of values.filter(tag => !tag.hidden)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'chip';
      const label=document.createElement('span');label.className='tag-label';label.textContent=tag.label;
      const count=document.createElement('span');count.className='tag-count';count.textContent=Number.isInteger(tag.count)?tag.count:'—';count.title=offline?'上次连接时的篇数':'当前标签下的收藏篇数';
      button.append(label,count);button.dataset.tagId=tag.id;button.setAttribute('aria-label',tag.label+' · '+(Number.isInteger(tag.count)?tag.count+' 篇':'篇数待连接'));
      button.setAttribute('aria-pressed', selected.has(tag.id));
      button.title = tag.label;
      button.addEventListener('click', () => { const already = selected.has(tag.id); selected.clear(); if (!already) selected.add(tag.id); list.querySelectorAll('.chip').forEach(node => node.setAttribute('aria-pressed', node === button && !already || node.dataset.unclassified === 'true' && selected.size === 0)); if(expanded)closeChooser();selectionLabel();document.dispatchEvent(new Event('kumo-annotation-change')); });
      const wrap=document.createElement('span');wrap.className='tag-with-delete';
      const remove=document.createElement('button');remove.type='button';remove.className='tag-delete';remove.textContent='×';remove.setAttribute('aria-label','删除标签 '+tag.label);remove.title='删除标签，收藏保留在未分类';remove.disabled=offline;
      remove.onclick=async()=>{if(!confirm('删除“'+tag.label+'”？收藏内容保留，仅移除这个标签的归属。'))return;remove.disabled=true;try{if(useBridge)await KumoBridge.updateTag({action:'delete',id:tag.id});else{values=values.filter(t=>t.id!==tag.id);localStorage.setItem('kumo-tags',JSON.stringify(values));}selected.delete(tag.id);await load(useBridge,{bridgeExpected:offline});document.dispatchEvent(new Event('kumo-annotation-change'));}catch(error){remove.disabled=false;document.dispatchEvent(new CustomEvent('kumo-tags-error',{detail:error.message}));}};
      wrap.append(button,remove);list.append(wrap);
    }
const unclassified=document.createElement('button');unclassified.type='button';unclassified.className='chip';unclassified.dataset.unclassified='true';unclassified.textContent='未分类';const count=document.createElement('span');count.className='tag-count';count.textContent=unclassifiedCount??'—';unclassified.append(count);unclassified.setAttribute('aria-pressed',String(selected.size===0));unclassified.onclick=()=>{initialized=true;selected.clear();list.querySelectorAll('.chip').forEach(node=>node.setAttribute('aria-pressed',String(node===unclassified)));closeChooser();document.dispatchEvent(new Event('kumo-annotation-change'));};list.append(unclassified);selectionLabel();requestAnimationFrame(measure);
  }
  async function add(label) {
    if(offline)throw new Error('资料库未连接，请恢复连接后再添加标签。');
    if (!label.trim()) return;
    let tag;
    if (useBridge) tag = (await KumoBridge.updateTag({action: 'add', label})).tag;
    else {
      tag = values.find(tag => tag.label === label.trim()) || {id: crypto.randomUUID(), label: label.trim()};
      if (!values.some(value => value.id === tag.id)) values.push(tag);
      localStorage.setItem('kumo-tags', JSON.stringify(values));
    }
    selected.clear(); selected.add(tag.id); await load(useBridge);
    document.dispatchEvent(new Event('kumo-annotation-change'));
  }
  async function select(ids){selected.clear();for(const id of ids||[])if(values.some(tag=>tag.id===id&&!tag.hidden))selected.add(id);initialized=true;await load(useBridge,{bridgeExpected:offline});}
  scope.KumoTags = {load, add, select, recordSaved, orderTags, inferRecent, selected: () => values.filter(tag => selected.has(tag.id)).map(({id, label}) => ({id, label}))};
})(globalThis);
