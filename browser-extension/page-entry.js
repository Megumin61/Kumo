function getKumoPageEntryState(){return Boolean(document.getElementById('kumo-page-entry'));}
function setKumoPageEntryStatus(message,kind='progress'){
  const host=document.getElementById('kumo-page-entry');
  if(!host?.__kumoStatus)return false;
  host.__kumoStatus(message,kind);return true;
}
function toggleKumoPageEntry(enabled){
  document.getElementById('kumo-page-entry')?.remove();
  if(!enabled)return false;
  const host=document.createElement('div');host.id='kumo-page-entry';
  host.style.cssText='all:initial;position:fixed;right:20px;bottom:24px;z-index:2147483647;max-width:calc(100vw - 40px);';
  const shadow=host.attachShadow({mode:'open'}),style=document.createElement('style');
  style.textContent=':host{color-scheme:light}*{box-sizing:border-box}.entry{display:flex;align-items:center;gap:6px}button{font:600 14px/1.4 system-ui,"Microsoft YaHei",sans-serif;cursor:pointer}#kumo-page-save{border:1px solid #ffffff88;border-radius:999px;background:#58794d;color:#fffdf5;padding:10px 16px;box-shadow:0 4px 14px #27371f26}#kumo-page-save:hover{background:#496b40}#kumo-page-save:disabled{opacity:.7;cursor:wait}.close{display:grid;place-items:center;width:25px;height:25px;padding:0;border:1px solid #d9ddc7;border-radius:50%;background:#fffdf3;color:#526b43}button:focus-visible{outline:2px solid #e7bf62;outline-offset:3px}.status{display:block;max-width:270px;margin:6px 0 0;padding:4px 9px;background:#fffdf3;color:#526b43;border-radius:8px;font:12px/1.5 system-ui,"Microsoft YaHei",sans-serif;overflow-wrap:anywhere}.status:empty{display:none}.status[data-kind=error],.status[data-kind=warning]{color:#8a5a2c}';
  const row=document.createElement('div');row.className='entry';
  const save=document.createElement('button');save.id='kumo-page-save';save.type='button';save.textContent='Kumo · 嚼一嚼';save.setAttribute('aria-label','Kumo 保存当前帖子');
  const close=document.createElement('button');close.type='button';close.className='close';close.textContent='×';close.setAttribute('aria-label','关闭 Kumo 页面入口');close.onclick=()=>host.remove();
  const status=document.createElement('span');status.className='status';status.setAttribute('role','status');
  host.__kumoStatus=(message,kind)=>{status.textContent=message;status.dataset.kind=kind;save.dataset.kumoStatus=kind==='success'?(message==='已经收藏过'?'duplicate':'saved'):kind==='error'?'failed':kind;};
  save.onclick=async()=>{
    save.disabled=true;save.textContent='开始收藏…';host.__kumoStatus('正在收藏…','progress');
    try{const result=await chrome.runtime.sendMessage({type:'kumo-page-save'});if(!result?.ok)throw Error(result?.error||'收藏未开始，请打开插件重试');}
    catch(error){host.__kumoStatus(error.message||'收藏未开始，请打开插件重试','error');}
    finally{save.disabled=false;save.textContent='Kumo · 嚼一嚼';}
  };
  row.append(save,close);shadow.append(style,row,status);(document.body||document.documentElement).append(host);
  return true;
}
