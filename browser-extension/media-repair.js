(function(scope){
  const knownCDN=/(?:^|\.)(?:xhscdn\.com|twimg\.com|githubusercontent\.com|githubassets\.com)$/i;
  const videoTypes={'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov','video/x-m4v':'m4v'};
  const imageTypes={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'};
  function sourceURL(value){
    const url=new URL(value);
    if(!/^https?:$/.test(url.protocol)||!knownCDN.test(url.hostname)||url.username||url.password||url.port)throw Error('source_unavailable');
    return url;
  }
  async function restore(meta,kind,entry){
    const deadline=AbortSignal.timeout(22000);
    const fetchFromCDN=async(input,init={})=>{
      const original=sourceURL(input);
      const secure=new URL(original);
      secure.protocol='https:';
      const granted=await chrome.permissions.contains({origins:[original.origin+'/*']});
      const fallBack=original.protocol==='http:'&&granted;
      const signal=AbortSignal.any([deadline,...(init.signal?[init.signal]:[])]);
      const request=(url,requestSignal)=>fetch(url.href,{...init,credentials:'omit',redirect:'error',signal:requestSignal});
      try{
        const response=await request(secure,fallBack?AbortSignal.any([signal,AbortSignal.timeout(9000)]):signal);
        if(response.ok||!fallBack)return response;
        void response.body?.cancel().catch(()=>{});
      }catch(error){
        if(!fallBack||signal.aborted){
          if(!granted&&!signal.aborted)throw Error('browser_blocked');
          throw error;
        }
      }
      return request(original,signal);
    };
    const fetchImpl=KumoMedia.createPageMediaFetch(meta,{fetchImpl:fetchFromCDN});
    if(kind==='images'){
      const blob=await KumoMedia.fetchBlobWithProgress(sourceURL(entry.url).href,15000,undefined,fetchImpl,20*1024*1024);
      const extension=imageTypes[blob.type];
      if(!extension||!blob.size)throw Error('invalid_image');
      return {blob,extension};
    }
    let failure=Error('source_unavailable');
    let alternatives=[entry,...(Array.isArray(entry.alternatives)?entry.alternatives:[])];
    if(meta.platformId==='x'&&entry.kind==='blob'){
      const mediaId=entry.mediaId||String(entry.poster||'').match(/\/(?:amplify_video_thumb|ext_tw_video_thumb)\/(\d+)/i)?.[1];
      if(mediaId) alternatives=await KumoMedia.resolveXVideoFromSyndication(meta.url,[mediaId],fetchImpl);
    }
    const seen=new Set();
    for(const variant of alternatives){
      if(deadline.aborted)break;
      try{
        const url=sourceURL(variant.url).href;
        if(seen.has(url))continue;
        seen.add(url);
        const downloaded=await KumoMedia.downloadVideoVariant({...variant,url},{fetchImpl});
        const blob=await KumoMedia.validateVideoBlob(downloaded,url);
        if(!videoTypes[blob.type])throw Error('invalid_video');
        return {blob,extension:videoTypes[blob.type]};
      }catch(error){failure=error;}
    }
    throw failure;
  }
  scope.KumoMediaRepair={restore};
})(globalThis);
