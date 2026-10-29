import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export const DEFAULT_BRIDGE='http://127.0.0.1:43789';
export const AUTOMATION_BRIDGE='http://127.0.0.1:43791';
let detectedBridge;
function bridgeUrl(value=DEFAULT_BRIDGE){const url=new URL(value);if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Kumo automation requires a local loopback bridge URL');return url.origin;}
async function findCaptureBridge(){
  if(detectedBridge)return detectedBridge;
  const probe=async url=>{try{const result=await fetch(url+'/status',{signal:AbortSignal.timeout(3000)});return result.ok?await result.json():null;}catch{return null;}};
  const primary=await probe(DEFAULT_BRIDGE);
  if(primary?.service==='kumo-local-bridge'&&primary.capabilities?.includes('page_capture'))return detectedBridge=DEFAULT_BRIDGE;
  const automation=await probe(AUTOMATION_BRIDGE);
  if(automation?.service==='kumo-local-bridge'&&automation.capabilities?.includes('page_capture')&&(!primary||primary.libraryRoot===automation.libraryRoot))return detectedBridge=AUTOMATION_BRIDGE;
  throw Error('Start the updated Kumo automation helper for the same local library; see docs/AUTOMATION.md');
}
export async function callBridge(path,{bridge,body,timeout=300000}={}){
  const origin=bridge?bridgeUrl(bridge):await findCaptureBridge();
  const response=await fetch(origin+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  const data=await response.json();if(!response.ok||data.ok===false)throw Error(data.error||'Kumo HTTP '+response.status);return data;
}
export async function extractionScript(){
  const [state,extractor]=await Promise.all(['page-state.js','extractor.js'].map(name=>readFile(new URL('../browser-extension/'+name,import.meta.url),'utf8')));
  return '(() => {\n'+state+'\n'+extractor+'\nreturn extractKumoPage(readKumoPageState());\n})()';
}
export async function saveSnapshot(snapshot,{bridge,tag='',note='',images=true,video=false,expectedUrl}={}){
  return callBridge('/capture',{bridge,body:{clip:snapshot.clip||snapshot,tag,note,images,video,expectedUrl}});
}
// Works with an already authorized Playwright-style Page. Does not launch a browser.
export async function capturePage(page,options={}){
  const expectedUrl=options.expectedUrl||page.url();
  const clip=await page.evaluate(await extractionScript());
  return saveSnapshot(clip,{...options,expectedUrl});
}
export async function captureUrls(page,entries,{preparePage,onResult,stopOnError=false,...options}={}){
  if(!Array.isArray(entries))throw Error('Pass the explicitly authorized post URL list');
  const results=[];
  for(let index=0;index<entries.length;index++){
    const entry=typeof entries[index]==='string'?{url:entries[index]}:entries[index];let result;
    try{
      const url=new URL(entry.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw Error('Invalid post URL');
      await page.goto(url.href,{waitUntil:'domcontentloaded'});
      if(preparePage)await preparePage(page,entry);
      result={index:index+1,inputUrl:url.href,...await capturePage(page,{...options,expectedUrl:url.href,tag:entry.tag??options.tag,note:entry.note??options.note})};
    }catch(error){result={index:index+1,inputUrl:entry?.url,status:'failed',error:error.message};}
    results.push(result);if(onResult)await onResult(result);
    if(result.status==='failed'&&stopOnError)break;
  }
  return {results,summary:results.reduce((counts,value)=>{counts[value.status]=(counts[value.status]||0)+1;return counts;},{}),planned:entries.length,attempted:results.length};
}
export async function installPageEntry(page,options={}){
  const expectedUrl=page.url(),binding='__kumo_capture_'+randomUUID().replaceAll('-','');let enabled=true;
  const onNavigation=frame=>{if(frame===page.mainFrame())enabled=false;};
  page.on('framenavigated',onNavigation);
  const disposable=await page.exposeBinding(binding,async({frame})=>{
    if(!enabled||frame!==page.mainFrame()||page.url()!==expectedUrl)throw Error('Kumo page entry expired; install it again on the intended post');
    // Read the current page ourselves; never trust a payload supplied by page scripts.
    return capturePage(page,options);
  });
  await page.evaluate(({binding,tag})=>{
    document.getElementById('kumo-agent-entry')?.remove();
    const host=document.createElement('div');host.id='kumo-agent-entry';host.style.cssText='position:fixed;right:20px;bottom:24px;z-index:2147483647;';
    const shadow=host.attachShadow({mode:'open'}),button=document.createElement('button'),result=document.createElement('div');
    button.type='button';button.id='kumo-agent-save';button.textContent='Kumo · 收藏到'+(tag||'未分类');button.setAttribute('aria-label','Kumo 保存当前帖子');
    button.style.cssText='border:1px solid #ffffff88;border-radius:24px;background:#58794d;color:#fffdf5;padding:11px 17px;font:600 14px/1.4 system-ui;cursor:pointer;box-shadow:0 4px 14px #27371f26;';
    result.setAttribute('role','status');result.style.cssText='max-width:280px;margin-top:7px;padding:0 8px;color:#344b35;background:#fffdf3;border-radius:8px;font:12px/1.5 system-ui;';
    button.onclick=async()=>{button.disabled=true;result.textContent='正在收藏…';try{const saved=await window[binding]();result.textContent=({saved:'收藏完成',duplicate:'已经收藏过',partial:'正文已保存，部分媒体未完成'})[saved.status]||'请查看保存结果';button.dataset.kumoStatus=saved.status;button.dataset.kumoSavedId=saved.id||'';}catch(error){result.textContent='保存失败：'+error.message;button.dataset.kumoStatus='failed';}finally{button.disabled=false;}};
    shadow.append(button,result);(document.body||document.documentElement).append(host);
  },{binding,tag:options.tag||''});
  return {remove:async()=>{enabled=false;page.off('framenavigated',onNavigation);await page.evaluate(()=>document.getElementById('kumo-agent-entry')?.remove()).catch(()=>{});await disposable?.dispose?.();}};
}
