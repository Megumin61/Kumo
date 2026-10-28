importScripts('page-state.js','extractor.js','video-focus.js','quick-feedback.js');
const quickFunctions={readKumoPageState,extractKumoPage,captureKumoVideoFrame,showInPage:KumoQuickFeedback.showInPage,
  fetchXPage:async expectedUrl=>{if(new URL(location.href).pathname!==new URL(expectedUrl).pathname)throw new Error('active_tab_changed');const response=await fetch(location.href,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`x_page_http_${response.status}`);return (await response.text()).slice(0,6*1024*1024);}};
let quickStarting=false;
async function quickTip(tabId,message,kind){try{await KumoQuickFeedback.show(tabId,message,kind);}catch{if(kind!=='progress')await chrome.action.setBadgeText({tabId,text:'!'}).catch(()=>{});}}
async function startQuick(tab){
  if(quickStarting){await quickTip(tab.id,'正在收藏，请稍候','progress');return;}
  quickStarting=true;
  try{
    const tip=quickTip(tab.id,'开始收藏…','progress');
    if((await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']})).length){await tip;await quickTip(tab.id,'正在收藏，请稍候','progress');return;}
    await tip;
    await chrome.offscreen.createDocument({url:'quick-worker.html',reasons:['BLOBS','LOCAL_STORAGE'],justification:'在后台生成收藏文件并读取已保存的收藏设置'});
    await chrome.runtime.sendMessage({type:'kumo-quick-start',tabId:tab.id,windowId:tab.windowId});
  }catch(error){console.error('无法启动后台收藏',error);await quickTip(tab.id,'收藏未开始，请打开 Kumo 重试','error');try{await chrome.offscreen.closeDocument();}catch{}}
  finally{quickStarting=false;}
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
  if(quick)await chrome.action.setPopup({tabId:tab.id,popup:'popup.html?quick=1&sourceTabId='+tab.id+'&sourceWindowId='+tab.windowId});
  let timer;
  const opened=await Promise.race([
    Promise.resolve().then(()=>chrome.action.openPopup({windowId:tab.windowId})).then(()=>true).catch(()=>false),
    new Promise(resolve=>{timer=setTimeout(()=>resolve(false),2000);})
  ]);
  clearTimeout(timer);
  if(quick)await chrome.action.setPopup({tabId:tab.id,popup:'popup.html'});
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
  if(message?.type==='kumo-quick-rpc'&&sender.url===chrome.runtime.getURL('quick-worker.html')){
    (async()=>{const {method,args=[]}=message;switch(method){
      case 'tabs.get':return chrome.tabs.get(...args);
      case 'tabs.query':return chrome.tabs.query(...args);
      case 'tabs.captureVisibleTab':return chrome.tabs.captureVisibleTab(...args);
      case 'permissions.contains':return chrome.permissions.contains(...args);
      case 'commands.getAll':return chrome.commands.getAll();
      case 'action.setBadgeText':return chrome.action.setBadgeText(...args);
      case 'tip':return quickTip(...args);
      case 'downloads.download':return chrome.downloads.download(...args);
      case 'downloads.search':return chrome.downloads.search(...args);
      case 'scripting.executeScript':{const [input]=args,func=quickFunctions[input.functionName];if(!func)throw Error('unsupported_injected_function');const {functionName,...options}=input;return chrome.scripting.executeScript({...options,func});}
      case 'finish':setTimeout(()=>void chrome.offscreen.closeDocument().catch(()=>{}),100);return true;
      default:throw Error('unsupported_quick_operation');
    }})().then(value=>respond({ok:true,value})).catch(error=>respond({ok:false,error:error.message}));return true;
  }
});
