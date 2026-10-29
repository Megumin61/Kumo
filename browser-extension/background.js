importScripts('page-state.js','extractor.js','video-focus.js','quick-feedback.js','page-entry.js');
const quickFunctions={readKumoPageState,extractKumoPage,captureKumoVideoFrame,showInPage:KumoQuickFeedback.showInPage,
  fetchXPage:async expectedUrl=>{if(new URL(location.href).pathname!==new URL(expectedUrl).pathname)throw new Error('active_tab_changed');const response=await fetch(location.href,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`x_page_http_${response.status}`);return (await response.text()).slice(0,6*1024*1024);}};
const quickJobs=new Map();let nextQuickNumber=0,recentQuickResults=[],hostOperation=Promise.resolve(),savedState=Promise.resolve();
const pageEntryTabs=new Set();
const quickReady=(async()=>{
  const saved=await chrome.storage.session.get(['kumo-quick-jobs','kumo-quick-sequence','kumo-quick-results']);
  nextQuickNumber=saved['kumo-quick-sequence']||0;recentQuickResults=saved['kumo-quick-results']||[];
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  if(contexts.some(context=>context.documentUrl===chrome.runtime.getURL('quick-host.html'))){
    for(const job of saved['kumo-quick-jobs']||[]){quickJobs.set(job.id,job);nextQuickNumber=Math.max(nextQuickNumber,job.number);}
  }else await chrome.storage.session.remove('kumo-quick-jobs');
})().catch(console.error);
function persistQuickJobs(){const state={'kumo-quick-jobs':[...quickJobs.values()].map(job=>({...job})),'kumo-quick-sequence':nextQuickNumber,'kumo-quick-results':[...recentQuickResults]};savedState=savedState.catch(()=>{}).then(()=>chrome.storage.session.set(state));return savedState;}
function withQuickHost(action){const result=hostOperation.catch(()=>{}).then(action);hostOperation=result;return result;}
async function ensureQuickHost(){return withQuickHost(async()=>{
  const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
  if(!contexts.length)await chrome.offscreen.createDocument({url:'quick-host.html',reasons:['BLOBS','LOCAL_STORAGE','IFRAME_SCRIPTING'],justification:'同时处理用户触发的多个收藏任务，生成媒体文件并读取保存设置'});
});}
async function updateQuickBadge(){const text=quickJobs.size>1?String(quickJobs.size):'';await chrome.action.setBadgeText({text}).catch(()=>{});await Promise.all([...new Set([...quickJobs.values()].map(job=>job.tabId))].map(tabId=>chrome.action.setBadgeText({tabId,text}).catch(()=>{})));}
function recordQuickResult(job,message,kind){job.outcome=kind;const label=kind==='success'?(message==='收藏完成'?'已完成':'已收藏'):kind==='warning'?(/授权|保存位置/.test(message)?'待授权':'需留意'):'失败';recentQuickResults=[{id:job.id,number:job.number,label},...recentQuickResults.filter(value=>value.id!==job.id)].slice(0,5);}
async function quickTip(tabId,message,kind='success',job=null){
  const task=job?{pending:[...quickJobs.values()].filter(value=>value.id!==job.id&&!value.outcome).length,quiet:Boolean(job.concurrent)}:null;
  try{await KumoQuickFeedback.show(tabId,message,kind,task);}catch{if(kind!=='progress')await chrome.action.setBadgeText({tabId,text:'!'}).catch(()=>{});}
  if(pageEntryTabs.has(tabId)){
    try{const [result]=await chrome.scripting.executeScript({target:{tabId},func:setKumoPageEntryStatus,args:[message,kind]});if(!result?.result)pageEntryTabs.delete(tabId);}catch{pageEntryTabs.delete(tabId);}
  }
}
async function releaseQuickJob(id){
  const job=quickJobs.get(id);if(!job)return;
  quickJobs.delete(id);await persistQuickJobs();await updateQuickBadge();
  await chrome.action.setBadgeText({tabId:job.tabId,text:quickJobs.size>1?String(quickJobs.size):''}).catch(()=>{});
  await withQuickHost(async()=>{
    await chrome.runtime.sendMessage({type:'kumo-quick-release',jobId:id}).catch(()=>{});
    if(!quickJobs.size)await chrome.offscreen.closeDocument().catch(()=>{});
  });
}
async function startQuick(tab){
  await quickReady;
  const url=new URL(tab.url);url.hash='';
  const duplicate=[...quickJobs.values()].find(job=>job.tabId===tab.id&&job.url===url.href);
  if(duplicate){await quickTip(tab.id,'这条正在收藏，请稍候','progress',duplicate);return;}
  const job={id:crypto.randomUUID(),number:++nextQuickNumber,tabId:tab.id,windowId:tab.windowId,url:url.href,state:'preparing'};
  quickJobs.set(job.id,job);if(quickJobs.size>1)for(const value of quickJobs.values())value.concurrent=true;void persistQuickJobs().catch(console.error);void updateQuickBadge();
  const tip=quickTip(tab.id,'正在收藏…','progress',job);
  // Capture now, before any worker queue, so navigation cannot replace a queued post.
  const snapshot=(async()=>{
    const [state]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:readKumoPageState}).catch(()=>[]);
    const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:extractKumoPage,args:[state?.result||{}]});
    const clip=result?.result;if(!clip)throw Error('没有从当前页面读到内容');
    const captured=new URL(clip.capturedUrl||clip.url);
    if(captured.origin!==url.origin||captured.pathname!==url.pathname||captured.search!==url.search)throw Error('网页已切换，请在目标帖子重试');
    const [frame]=clip.videos?.length||clip.contentType==='video'?await chrome.scripting.executeScript({target:{tabId:tab.id},func:captureKumoVideoFrame,args:[clip.sourceId,clip.platformId,clip.videos]}).catch(()=>[]):[];
    return {tab:{id:tab.id,windowId:tab.windowId,url:tab.url},clip,frame:frame?.result};
  })();
  // Attach a handler immediately while the offscreen host is being created.
  void snapshot.catch(()=>{});
  try{
    await ensureQuickHost();
    const accepted=await chrome.runtime.sendMessage({type:'kumo-quick-enqueue',job});
    if(!accepted?.ok)throw Error('后台收藏任务未就绪');
    const captured=await snapshot;await tip;
    const started=await chrome.runtime.sendMessage({type:'kumo-quick-snapshot',jobId:job.id,snapshot:captured});
    if(!started?.ok)throw Error('后台收藏任务未开始');
  }catch(error){console.error('无法启动后台收藏',error);recordQuickResult(job,error.message,'error');await quickTip(tab.id,error.message||'收藏未开始，请重试','error',job);await releaseQuickJob(job.id);}
}
// Restore the toolbar action after reload/update; never change site permissions.
async function restoreAction() {
  await chrome.action.setPopup({popup:'popup.html'});
  await chrome.action.enable();
  await chrome.sidePanel.setOptions({path:'library.html',enabled:true});
}
chrome.runtime.onInstalled.addListener(()=>{void restoreAction().catch(console.error);});
chrome.runtime.onStartup.addListener(()=>{void restoreAction().catch(console.error);});
void restoreAction().catch(console.error);

async function openCapture(tab, quick = false) {
  if (!tab?.id) [tab]=await chrome.tabs.query({active:true,lastFocusedWindow:true});
  if (!tab?.id) throw new Error('没有可用的网页标签');
  if (quick) {
    await startQuick(tab);return;
  }
  await restoreAction();
  let timer;
  const opened=await Promise.race([
    Promise.resolve().then(()=>chrome.action.openPopup({windowId:tab.windowId})).then(()=>true).catch(()=>false),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(false),2000);})
  ]);
  clearTimeout(timer);
  if (!opened) {
    const contexts=typeof chrome.runtime.getContexts==='function' ? await chrome.runtime.getContexts({contextTypes:['POPUP']}).catch(()=>[]) : [];
    if (contexts.length) return;
    await chrome.windows.create({type:'popup',url:chrome.runtime.getURL('popup.html')+'?sourceTabId='+tab.id+'&sourceWindowId='+tab.windowId+(quick?'&quick=1':''),width:444,height:680});
  }
}
// onClicked is a recovery path if the browser has lost the registered popup.
chrome.action.onClicked.addListener(tab=>{void openCapture(tab).catch(console.error);});
chrome.commands.onCommand.addListener((command,tab)=>{if(command==='kumo-open'||command==='kumo-save')void openCapture(tab,command==='kumo-save').catch(console.error);});

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type === 'kumo-health') respond({ok: true, version: chrome.runtime.getManifest().version});
  if(message?.type==='kumo-page-save'&&sender.id===chrome.runtime.id&&sender.tab?.id&&sender.frameId===0){
    pageEntryTabs.add(sender.tab.id);
    (async()=>{const tab=await chrome.tabs.get(sender.tab.id);await startQuick(tab);return {ok:true};})().then(respond).catch(error=>respond({ok:false,error:error.message}));return true;
  }
  if(message?.type==='kumo-quick-state'&&sender.url===chrome.runtime.getURL('quick-host.html')){
    (async()=>{await quickReady;const job=quickJobs.get(message.jobId);if(!job)return;job.state=message.state;await persistQuickJobs();await quickTip(job.tabId,message.state==='queued'?'已加入收藏队列':'正在收藏…','progress',job);})().catch(console.error);return;
  }
  if(message?.type==='kumo-quick-rpc'&&sender.url?.split('?')[0]===chrome.runtime.getURL('quick-worker.html')&&new URL(sender.url).searchParams.get('job')===message.jobId){
    (async()=>{await quickReady;const job=quickJobs.get(message.jobId);if(!job)throw Error('收藏任务已结束');const {method,args=[]}=message;switch(method){
      case 'tabs.get':return chrome.tabs.get(...args);
      case 'tabs.query':return chrome.tabs.query(...args);
      case 'tabs.captureVisibleTab':return chrome.tabs.captureVisibleTab(...args);
      case 'permissions.contains':return chrome.permissions.contains(...args);
      case 'commands.getAll':return chrome.commands.getAll();
      case 'action.setBadgeText':return updateQuickBadge();
      case 'tip':{const [,text,kind='success']=args;if(kind!=='progress'){recordQuickResult(job,text,kind);await persistQuickJobs();}return quickTip(job.tabId,text,kind,job);}
      case 'authorize':{const [active]=await chrome.tabs.query({active:true,windowId:job.windowId});if(active?.id!==job.tabId)return false;try{const currentUrl=new URL(active.url);currentUrl.hash='';if(currentUrl.href!==job.url)return false;await chrome.action.openPopup({windowId:job.windowId});return true;}catch{return false;}}
      case 'downloads.download':return chrome.downloads.download(...args);
      case 'downloads.search':return chrome.downloads.search(...args);
      case 'scripting.executeScript':{const [input]=args,func=quickFunctions[input.functionName];if(!func||input.target?.tabId!==job.tabId)throw Error('unsupported_injected_function');const {functionName,...options}=input;return chrome.scripting.executeScript({...options,func});}
      case 'finish':setTimeout(()=>void releaseQuickJob(job.id).catch(console.error),100);return true;
      default:throw Error('unsupported_quick_operation');
    }})().then(value=>respond({ok:true,value})).catch(error=>respond({ok:false,error:error.message}));return true;
  }
});
