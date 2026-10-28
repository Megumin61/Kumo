(function(scope) {
  const validAsset = name => /^assets\/(?:image|frame)-\d{2}\.(?:jpg|jpeg|png|webp|gif|avif|img)$/i.test(name || '');
  const contentKeywords = values => [...new Set((Array.isArray(values)?values:[]).filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()))].slice(0,3);
  function platform(mark, name = '网页') {
    const value = String(name); const lower = value.toLowerCase();
    const brand=lower.includes('github')?'github':lower.includes('pinterest')?'pinterest':lower.includes('b站')||lower.includes('bilibili')?'bilibili':lower.includes('小红书')||lower.includes('xiaohongshu')?'xiaohongshu':/^(x|twitter)$/i.test(value)?'x':lower.includes('公众号')||lower.includes('wechat')?'wechat':lower.includes('抖音')||lower.includes('douyin')?'douyin':lower.includes('tiktok')?'tiktok':lower.includes('youtube')?'youtube':'';
    if(brand){const img=document.createElement('img');img.alt='';img.src='assets/platforms/app/'+brand+'.jpg';mark.replaceChildren(img);mark.dataset.platform=brand;mark.dataset.appIcon='true';mark.setAttribute('aria-label',value);return;}
    delete mark.dataset.appIcon;
    mark.textContent = '↗';
    mark.dataset.platform = /^(x|twitter)$/i.test(value) ? 'x' : lower.includes('小红书') ? 'xhs' : 'other'; mark.setAttribute('aria-label', value);
  }
  function timeGroup(value, now = new Date()) {
    const date = new Date(value); if (!Number.isFinite(date.getTime())) return '日期未知';
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7);
    if (date >= today && date < new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)) return '今天';
    if (date >= monday && date < today) return '本周';
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  }
  function preview(item) { return [item.previewAsset, ...(item.files?.frames || []), ...(item.files?.images || [])].find(validAsset) || ''; }
  function icon(name) {
    // Native extension popups wait for their load event before showing. External
    // SVG <use> references can leave that event pending in Edge; inline paths
    // keep icons synchronous, including the select component's private calls.
    const shapes = {
      chevron: [['path',{d:'m9 5 7 7-7 7'}]], down: [['path',{d:'m5 9 7 7 7-7'}]],
      back: [['path',{d:'m15 5-7 7 7 7'}]], close: [['path',{d:'m6 6 12 12M18 6 6 18'}]],
      bookmark: [['path',{d:'M6 3h12v18l-6-5-6 5z'}]],
      gear: [['path',{d:'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2'}],['circle',{cx:12,cy:12,r:7}],['circle',{cx:12,cy:12,r:3}]],
      sparkle: [['path',{d:'M12 2c-1 7-3 9-10 10 7 1 9 3 10 10 1-7 3-9 10-10-7-1-9-3-10-10z',fill:'currentColor',stroke:'none'}]],
      plus: [['path',{d:'M12 5v14M5 12h14'}]], external: [['path',{d:'M14 3h7v7M21 3 11 13M10 5H4v15h15v-6'}]],
      search: [['circle',{cx:10,cy:10,r:6}],['path',{d:'m15 15 6 6'}]],
      video: [['path',{d:'M4 5h16v14H4z'}],['path',{d:'m10 9 5 3-5 3z',fill:'currentColor',stroke:'none'}]],
      image: [['path',{d:'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4'}],['circle',{cx:15,cy:8,r:1}]]
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.classList.add('icon'); svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('aria-hidden','true'); svg.setAttribute('focusable','false');
    for (const [tag, attributes] of shapes[name] || []) {
      const node = document.createElementNS(svg.namespaceURI,tag);
      for (const [key,value] of Object.entries(attributes)) node.setAttribute(key,String(value));
      svg.append(node);
    }
    return svg;
  }
  function select(control) {
    if (control.dataset.styled) return; control.dataset.styled='true'; control.tabIndex=-1; control.setAttribute('aria-hidden','true');
    const wrapper=document.createElement('div'), button=document.createElement('button'), menu=document.createElement('div');
    wrapper.className='custom-select'; button.type='button'; button.className='select-trigger'; button.setAttribute('aria-label',control.getAttribute('aria-label') || '筛选'); button.setAttribute('aria-haspopup','listbox'); button.setAttribute('aria-expanded','false');
    menu.className='select-menu'; menu.id=control.id+'-menu'; menu.setAttribute('role','listbox'); menu.hidden=true; button.setAttribute('aria-controls',menu.id);
    control.before(wrapper); wrapper.append(control,button,menu);
    const close=()=>{menu.hidden=true;button.setAttribute('aria-expanded','false');};
    const paint=()=>{button.replaceChildren(document.createTextNode(control.selectedOptions[0]?.textContent || ''),icon('down'));button.disabled=control.disabled;menu.replaceChildren();for(const option of control.options){const item=document.createElement('button');item.type='button';item.className='select-option';item.textContent=option.textContent;item.dataset.value=option.value;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.disabled=option.disabled;item.onclick=()=>{control.value=option.value;control.dispatchEvent(new Event('change',{bubbles:true}));close();button.focus();};menu.append(item);}};
    const positionMenu=()=>{if(!control.closest('#save-options'))return;const rect=button.getBoundingClientRect();menu.style.position='fixed';menu.style.right='auto';menu.style.minWidth='0';menu.style.width=Math.max(rect.width,170)+'px';menu.style.left=Math.max(8,Math.min(rect.left,innerWidth-Math.max(rect.width,170)-8))+'px';menu.style.zIndex='40';const height=Math.min(240,control.options.length*38+12);menu.style.top=Math.max(8,Math.min(rect.bottom+5,innerHeight-height-8))+'px';};
    button.onclick=()=>{const open=menu.hidden;close();if(open){paint();positionMenu();menu.hidden=false;button.setAttribute('aria-expanded','true');}};
    wrapper.addEventListener('keydown',e=>{if(e.key==='Escape'){close();button.focus();e.preventDefault();}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();menu.hidden=false;button.setAttribute('aria-expanded','true');const items=[...menu.querySelectorAll('button:not(:disabled)')],index=items.indexOf(document.activeElement);items[(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
    document.addEventListener('pointerdown',e=>{if(!wrapper.contains(e.target))close();});control.addEventListener('change',paint);new MutationObserver(paint).observe(control,{childList:true,subtree:true,attributes:true});paint();return paint;
  }
  function relativeDate(value, now = new Date()) {
    const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
    const days = Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate())-new Date(date.getFullYear(),date.getMonth(),date.getDate()))/86400000);
    return days === 0 ? '今天' : days === 1 ? '昨天' : days > 1 && days < 8 ? `${days} 天前` : `${date.getMonth()+1}/${date.getDate()}`;
  }
  const presetCollections = ['设计参考','产品思考','视频灵感'];
  function displayTitle(item) {
    const raw=String(item.displayTitle||item.title||'').trim();
    if(!/^(x|twitter)$/i.test(item.platform||''))return raw||'未命名内容';
    const cleaned=raw.replace(/^.*?\s+on\s+X:\s*["“]?/i,'').replace(/["”]\s*$/,'').replace(/\s*\/?\s*[|–—-]?\s*(?:on X|\/ X)$/i,'');
    const text=(cleaned || String(item.excerpt||item.content||'')).replace(/https?:\/\/\S+/g,'').replace(/\s+/g,' ').trim();
    const chars=Array.from(text);return chars.length>52?chars.slice(0,52).join('').trimEnd()+'…':text||'X 帖子';
  }
  async function ensureCollections(bridge) {
    const result = await bridge.tags();
    if (!result.tags.length) for (const label of presetCollections) await bridge.updateTag({action:'add',label});
  }
  scope.KumoUI = {platform, contentKeywords, timeGroup, relativeDate, displayTitle, presetCollections, ensureCollections, preview, validAsset, icon, select};
  if (typeof module !== 'undefined') module.exports = scope.KumoUI;
})(globalThis);
