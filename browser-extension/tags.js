(function(scope) {
  let values = [], useBridge = false, offline = false;
  const selected = new Set();
  let expanded=false,observed=false,initialized=false,unclassifiedCount=null;
  const choiceKey='kumo-last-selected-tag',recentKey='kumo-tag-save-times',unclassifiedId='__unclassified';
  let openParent='';
  function rememberChoice(id){localStorage.setItem(choiceKey,id||unclassifiedId);}
  function recordSaved(tags){
    if(useBridge||!tags?.length)return;
    const times=JSON.parse(localStorage.getItem(recentKey)||'{}');
    for(const tag of tags)times[tag.id]=new Date().toISOString();
    localStorage.setItem(recentKey,JSON.stringify(times));
  }
  function selectionLabel(){
    const label=document.querySelector('section[aria-label="用户标签"] .note-label'),tag=values.find(value=>selected.has(value.id));
    if(!label)return;
    const parent=values.find(value=>value.id===tag?.parentId);
    const name=[parent?.label,tag?.label].filter(Boolean).join(' / ')||'未分类';
    label.textContent='标签 · '+name;label.title=name;
  }
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
  function measure(){const list=document.getElementById('tag-list'),more=document.getElementById('all-tags');if(!more)return;more.hidden=!expanded&&list.scrollHeight<=list.clientHeight+2;more.setAttribute('aria-expanded',String(expanded));more.textContent=expanded?'收起标签 ↑':'展开全部 '+(values.filter(tag=>!tag.hidden&&!tag.parentId).length+1)+' ↓';}
  function revealBranchStart(list,parent,branch){
    if(!parent?.getBoundingClientRect)return;
    const viewport=list.getBoundingClientRect(),left=parent.getBoundingClientRect().left,right=branch.firstElementChild?.getBoundingClientRect().right;
    if(left<viewport.left||right>viewport.right)list.scrollLeft+=left-viewport.left-2;
  }
  async function load(connected, {bridgeExpected=false}={}) {
    useBridge = connected;
    offline=!connected&&bridgeExpected;
    let overview;
    if (connected){overview=await KumoBridge.tags();if(!overview.tags.length){await KumoUI.ensureCollections(KumoBridge);overview=await KumoBridge.tags({fresh:true});}}
    else if (!offline&&localStorage.getItem('kumo-tags') === null) localStorage.setItem('kumo-tags',JSON.stringify(KumoUI.presetCollections.map((label,index)=>({id:'kumo-preset-'+index,label}))));
    if(connected){values=overview.tags;unclassifiedCount=overview.unclassifiedCount??null;}
    else{values=JSON.parse(localStorage.getItem(offline?'kumo-bridge-tags-cache':'kumo-tags')||'[]');unclassifiedCount=null;}
    if(!connected&&!offline){
      const times=JSON.parse(localStorage.getItem(recentKey)||'{}');
      values=values.map(tag=>({...tag,latestCapturedAt:times[tag.id]}));
    }
    values=KumoBridge.orderTags(values);
    if(connected)localStorage.setItem('kumo-bridge-tags-cache',JSON.stringify(values));
    const visible=values.filter(tag=>!tag.hidden);
    for(const id of selected)if(!visible.some(tag=>tag.id===id))selected.delete(id);
    if(!initialized){
      const quick=globalThis.KumoQuickWorker;
      const choice=quick?(quick.params?.tagId||unclassifiedId):localStorage.getItem(choiceKey);
      const first=choice===unclassifiedId?null:visible.find(tag=>tag.id===choice)||(!quick?visible.find(tag=>!tag.parentId):null);
      if(first)selected.add(first.id);
      initialized=Boolean(first)||choice===unclassifiedId||Boolean(quick);
    }
    const list=document.getElementById('tag-list'),children=document.getElementById('child-tag-list');
    setupChooser(list);
    const tree=list.parentElement;
    list.replaceChildren();children.replaceChildren();
    const parentButtons=[],childButtons=[];
    let displayedGroup;
    const pick=id=>{
      initialized=true;selected.clear();if(id)selected.add(id);
      rememberChoice(id);
      document.dispatchEvent(new Event('kumo-annotation-change'));
    };
    function paintSelection(){
      for(const [button,tag,hasChildren] of [...parentButtons,...childButtons]){
        const groupSelected=hasChildren&&visible.some(child=>child.parentId===tag.id&&selected.has(child.id));
        button.setAttribute('aria-pressed',String(tag.id===unclassifiedId?!selected.size:selected.has(tag.id)||groupSelected));
        if(hasChildren)button.setAttribute('aria-expanded',String(openParent===tag.id));
      }
      selectionLabel();requestAnimationFrame(measure);
    }
    function paintBranch(){
      const group=visible.find(tag=>tag.id===openParent&&!tag.parentId);
      const related=group?visible.filter(tag=>tag.parentId===group.id):[];
      const groupId=related.length?group.id:'';
      if(displayedGroup!==groupId){
        displayedGroup=groupId;
        children.replaceChildren();childButtons.length=0;
        children.hidden=!groupId;
        if(groupId){
          children.setAttribute('aria-label',group.label+'子标签');
          related.forEach((tag,index)=>render(tag,children,{index}));
          const parent=parentButtons.find(([,tag])=>tag.id===groupId)?.[3];
          parent?.after(children);
          revealBranchStart(list,parent,children);
        }else{
          tree?.append(children);
        }
      }
      paintSelection();
    }
    function render(tag,container,{submenu=false,canRemove=true,index=0}={}){
      const button=document.createElement('button');button.type='button';button.className='chip';
      const name=document.createElement('span');name.className='tag-label';name.textContent=tag.label;
      const count=document.createElement('span');count.className='tag-count';count.textContent=tag.count??'—';
      button.append(name,count);button.dataset.tagId=tag.id;button.title=tag.label;
      if(submenu){
        button.setAttribute('aria-controls','child-tag-list');
        const arrow=document.createElement('span');arrow.className='tag-tree-chevron';arrow.textContent='›';arrow.setAttribute('aria-hidden','true');button.append(arrow);
      }
      const branch=container===children;
      const wrap=document.createElement('span');wrap.className='tag-with-delete';
      (branch?childButtons:parentButtons).push([button,tag,submenu,wrap]);
      button.onclick=()=>{
        const id=tag.id===unclassifiedId?'':tag.id;
        if(submenu)openParent=openParent===tag.id?'':tag.id;
        else if(!branch)openParent='';
        pick(id);
        if(!submenu)closeChooser();
        paintBranch();
      };
      if(branch)wrap.style.animationDelay=Math.min(index,7)*25+'ms';
      wrap.append(button);
      if(canRemove&&!submenu){
        const remove=document.createElement('button');remove.type='button';remove.className='tag-delete';remove.textContent='×';
        remove.setAttribute('aria-label','删除标签 '+tag.label);remove.disabled=offline;
        remove.onclick=async()=>{
          if(!confirm('删除“'+tag.label+'”？收藏内容保留，仅移除这个标签的归属。'))return;
          remove.disabled=true;
          try{
            if(useBridge)await KumoBridge.updateTag({action:'delete',id:tag.id});
            else{values=values.filter(t=>t.id!==tag.id);localStorage.setItem('kumo-tags',JSON.stringify(values));}
            selected.delete(tag.id);await load(useBridge,{bridgeExpected:offline});
            document.dispatchEvent(new Event('kumo-annotation-change'));
          }catch(error){remove.disabled=false;document.dispatchEvent(new CustomEvent('kumo-tags-error',{detail:error.message}));}
        };
        wrap.append(remove);
      }
      container.append(wrap);
    }
    for(const tag of visible.filter(tag=>!tag.parentId))render(tag,list,{submenu:visible.some(child=>child.parentId===tag.id)});
    render({id:unclassifiedId,label:'未分类',count:unclassifiedCount},list,{canRemove:false});
    paintBranch();
    return overview;
  }
  async function add(label) {
    if(offline)throw new Error('资料库未连接，请恢复连接后再添加标签。');
    if (!label.trim()) return;
    let tag;
    if (useBridge) tag = await KumoBridge.updateTag({action: 'add', label});
    else {
      tag = values.find(tag => tag.label === label.trim()) || {id: crypto.randomUUID(), label: label.trim()};
      if (!values.some(value => value.id === tag.id)) values.push(tag);
      localStorage.setItem('kumo-tags', JSON.stringify(values));
    }
    selected.clear(); selected.add(tag.id); initialized=true;rememberChoice(tag.id);await load(useBridge);
    document.dispatchEvent(new Event('kumo-annotation-change'));
  }
  async function select(ids){selected.clear();for(const id of ids||[])if(values.some(tag=>tag.id===id&&!tag.hidden))selected.add(id);initialized=true;await load(useBridge,{bridgeExpected:offline});}
  scope.KumoTags = {load, add, select, recordSaved, selected: () => values.filter(tag => selected.has(tag.id)).map(({id, label}) => ({id, label}))};
})(globalThis);
