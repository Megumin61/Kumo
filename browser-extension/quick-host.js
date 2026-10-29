// A single offscreen document owns independent worker frames and limits media work.
const jobs=new Map(),MAX_WORKERS=3;
function notify(job,state){void chrome.runtime.sendMessage({type:'kumo-quick-state',jobId:job.id,state}).catch(console.error);}
function pump(){
  let running=[...jobs.values()].filter(job=>job.frame).length;
  for(const job of jobs.values()){
    if(running>=MAX_WORKERS)break;
    if(!job.snapshot||job.frame)continue;
    const frame=document.createElement('iframe');job.frame=frame;running++;
    frame.title='后台收藏第 '+job.number+' 条';
    frame.onload=()=>frame.contentWindow.postMessage({type:'kumo-quick-start',jobId:job.id,tabId:job.tabId,windowId:job.windowId,tagId:job.tagId,snapshot:job.snapshot},location.origin);
    frame.src='quick-worker.html?job='+encodeURIComponent(job.id);
    document.body.append(frame);notify(job,'saving');
  }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(message?.type==='kumo-quick-enqueue'){
    const job=message.job;
    if(!jobs.has(job.id))jobs.set(job.id,{...job,tagId:localStorage.getItem('kumo-last-selected-tag')||localStorage.getItem('kumo-last-saved-tag')||'__unclassified'});
    respond({ok:true});
  }else if(message?.type==='kumo-quick-snapshot'){
    const job=jobs.get(message.jobId);
    if(!job){respond({ok:false});return;}
    job.snapshot=message.snapshot;notify(job,'queued');pump();respond({ok:true});
  }else if(message?.type==='kumo-quick-release'){
    const job=jobs.get(message.jobId);job?.frame?.remove();jobs.delete(message.jobId);pump();respond({ok:true});
  }
});
