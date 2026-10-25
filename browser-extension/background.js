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
chrome.commands.onCommand.addListener(command=>{if(command==='kumo-open'||command==='kumo-save')void openCapture(undefined,command==='kumo-save').catch(console.error);});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type === 'kumo-health') respond({ok: true, version: chrome.runtime.getManifest().version});
});
