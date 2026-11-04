(function(scope){
  const MAX_TRACKS=32,MAX_TRACK_BYTES=2*1024*1024,MAX_TOTAL_BYTES=8*1024*1024;
  const stamp=value=>{const ms=Math.max(0,Math.round(value*1000));return String(Math.floor(ms/3600000)).padStart(2,'0')+':'+String(Math.floor(ms/60000)%60).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+'.'+String(ms%1000).padStart(3,'0');};
  const cueText=track=>'WEBVTT\n\n'+(track.cues||[]).slice(0,2000).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>=c.start).map(c=>stamp(c.start)+' --> '+stamp(c.end)+'\n'+String(c.text||'').replaceAll('-->','→').slice(0,3000)).join('\n\n')+'\n';
  function files(tracks){return (tracks||[]).slice(0,MAX_TRACKS).filter(t=>t.cues?.length).map((track,index)=>({name:'assets/captions-'+String(index+1).padStart(2,'0')+'.vtt',type:'text/vtt;charset=utf-8',content:cueText(track)}));}
  function normalize(text){
    text=String(text).replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
    if(!text.trimStart().startsWith('WEBVTT')){
      if(!/^\s*(?:\d+\s*\n)?\d{2}:\d{2}:\d{2},\d{3}\s*-->/m.test(text))throw Error('unsupported_caption_format');
      text='WEBVTT\n\n'+text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g,'$1.$2');
    }
    if(!/(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s*-->/m.test(text))throw Error('caption_has_no_cues');
    return text;
  }
  async function readTrack(url,fetchImpl){
    const timerController=new AbortController(),timer=setTimeout(()=>timerController.abort(),15000);let reader;
    try{
      const parsed=new URL(url);if(!/^https?:$/.test(parsed.protocol)||parsed.username||parsed.password)throw Error('invalid_caption_url');
      const response=await fetchImpl(parsed.href,{credentials:'include',signal:timerController.signal});if(!response.ok)throw Error('caption_http_'+response.status);
      if(Number(response.headers.get('content-length')||0)>MAX_TRACK_BYTES)throw Error('caption_too_large');
      if(!response.body?.getReader){const text=await response.text();if(new Blob([text]).size>MAX_TRACK_BYTES)throw Error('caption_too_large');return normalize(text);}
      reader=response.body.getReader();const parts=[];let bytes=0;
      while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_TRACK_BYTES)throw Error('caption_too_large');parts.push(value);}
      return normalize(await new Blob(parts).text());
    }catch(error){timerController.abort();await reader?.cancel().catch(()=>{});throw error;}finally{clearTimeout(timer);}
  }
  async function prepare(clip,{fetchImpl=fetch,download=true,permission=true}={}){
    const records=new Map(),diagnostics=[];
    const key=t=>String(t.videoIndex??'unknown')+'|'+(t.url||t.sourceUrl||[t.language,t.kind,t.label].join('|'));
    for(const track of clip.captions||[])if(track.cues?.length)records.set(key(track),{...track,content:cueText(track),source:'loaded_cues'});
    const seen=new Set();
    for(const track of clip.captionSources||[]){
      const id=key(track);if(seen.has(id))continue;seen.add(id);
      if(seen.size>MAX_TRACKS){diagnostics.push({error:'caption_count_limit'});break;}
      if(!download||!permission){diagnostics.push({url:track.url,error:download?'caption_permission_denied':'caption_reference_only'});continue;}
      try{records.set(id,{...track,content:await readTrack(track.url,fetchImpl),source:'track_url'});}catch(error){diagnostics.push({url:track.url,error:error.message});}
    }
    const result=[],tracks=[];let total=0;
    for(const record of records.values()){
      const bytes=new Blob([record.content]).size;
      if(result.length>=MAX_TRACKS||bytes>MAX_TRACK_BYTES||total+bytes>MAX_TOTAL_BYTES){diagnostics.push({error:'caption_size_or_count_limit'});continue;}
      const name='assets/captions-'+String(result.length+1).padStart(2,'0')+'.vtt';total+=bytes;
      result.push({name,type:'text/vtt;charset=utf-8',content:record.content});
      tracks.push({file:name,videoIndex:record.videoIndex??null,language:record.language||'',label:record.label||'',source:record.source,sourceUrl:record.url||record.sourceUrl||'',truncated:!!record.truncated});
    }
    const hasVideo=!!clip.videos?.length;
    const processing={captions:{state:diagnostics.length?'partial':tracks.length?'saved':'not_available',tracks,diagnostics},translation:{state:tracks.length?'pending_ai':hasVideo?'needs_transcript':'not_applicable'},keyframes:{state:hasVideo?'pending_ai':'not_applicable'},speechTranscription:{state:tracks.length?'not_needed_for_saved_captions':hasVideo?'pending_ai_if_needed':'not_applicable'}};
    return {files:result,processing};
  }
  scope.KumoCaptions={files,prepare,normalize};if(typeof module==='object')module.exports=scope.KumoCaptions;
})(globalThis);
