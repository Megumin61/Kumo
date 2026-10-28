(function(scope){
  let begin;
  const ready=new Promise(resolve=>{begin=resolve;});
  const worker={params:null,ready,finish:()=>rpc('finish'),tip:(...args)=>rpc('tip',...args)};
  scope.KumoQuickWorker=worker;
  if(!chrome.runtime.getURL)chrome.runtime.getURL=path=>new URL(path,location.href).href;
  chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
    if(message?.type!=='kumo-quick-start'||worker.params)return;
    worker.params={sourceTabId:message.tabId,sourceWindowId:message.windowId,quick:'1'};
    begin();respond({ok:true});
  });
  async function rpc(method,...args){
    const result=await chrome.runtime.sendMessage({type:'kumo-quick-rpc',method,args});
    if(!result?.ok)throw new Error(result?.error||'后台通信失败');
    return result.value;
  }
  chrome.tabs={get:(...args)=>rpc('tabs.get',...args),query:(...args)=>rpc('tabs.query',...args),captureVisibleTab:(...args)=>rpc('tabs.captureVisibleTab',...args)};
  chrome.permissions={contains:(...args)=>rpc('permissions.contains',...args)};
  chrome.commands={getAll:()=>rpc('commands.getAll')};
  chrome.action={setBadgeText:(...args)=>rpc('action.setBadgeText',...args)};
  chrome.downloads={download:(...args)=>rpc('downloads.download',...args),search:(...args)=>rpc('downloads.search',...args)};
  chrome.scripting={executeScript:options=>{const {func,...rest}=options;return rpc('scripting.executeScript',{...rest,functionName:func?.name});}};
})(globalThis);
