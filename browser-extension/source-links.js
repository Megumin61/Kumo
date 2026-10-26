(function(scope){
const httpUrl=value=>{
  try{const parsed=new URL(value);return /^https?:$/.test(parsed.protocol)&&!parsed.username&&!parsed.password?parsed:null;}catch{return null;}
};
const noteId=parsed=>parsed&&/(^|\.)xiaohongshu\.com$/i.test(parsed.hostname)?parsed.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f0-9]{24})\/?$/i)?.[1].toLowerCase()||'':'';

function sourceUrl(metadata={}){
  const canonical=httpUrl(metadata.url),captured=httpUrl(metadata.capturedUrl),access=httpUrl(metadata.accessUrl);
  const isNote=noteId(canonical)||noteId(captured)||/(?:小红书|xiaohongshu)/i.test(metadata.platform||metadata.platformId||'')||canonical&&/(^|\.)xiaohongshu\.com$/i.test(canonical.hostname);
  if(!isNote)return canonical?.href||'';
  const expected=/^[a-f0-9]{24}$/i.test(metadata.sourceId||'')?metadata.sourceId.toLowerCase():noteId(canonical)||noteId(captured);
  if(!expected)return '';
  for(const candidate of [access,captured,canonical]){
    if(noteId(candidate)!==expected||!candidate.searchParams.get('xsec_token'))continue;
    const target=new URL('https://www.xiaohongshu.com'+candidate.pathname);
    for(const key of ['xsec_token','xsec_source'])if(candidate.searchParams.has(key))target.searchParams.set(key,candidate.searchParams.get(key));
    return target.href;
  }
  return 'https://www.xiaohongshu.com/explore/'+expected;
}

function hasAccessUrl(metadata={}) {
  const value=httpUrl(sourceUrl(metadata));
  return Boolean(noteId(value)&&value.searchParams.get('xsec_token'));
}
function preserveAccess(incoming={},previous={}) {
  if(hasAccessUrl(incoming))return {...incoming,accessUrl:sourceUrl(incoming)};
  const oldUrl=httpUrl(sourceUrl(previous)), current=httpUrl(sourceUrl(incoming));
  return hasAccessUrl(previous)&&noteId(oldUrl)===noteId(current)
    ? {...incoming,accessUrl:oldUrl.href} : incoming;
}

// Update only formatter-owned navigation, never the captured body or verbatim notes.
function rewriteGeneratedLinks(name,content,metadata){
  if(typeof content!=='string'||!hasAccessUrl(metadata))return content;
  const link=sourceUrl(metadata);
  if(name==='source.md'){
    const body=content.indexOf('\n## 正文'),boundary=body<0?content.length:body;
    const head=content.slice(0,boundary).replace(/^access_url: .*$/m,'access_url: '+JSON.stringify(link)).replace(/^(> [^\r\n]*\[打开原文\]\()[^\r\n)]*\)/m,(_m,prefix)=>prefix+link+')');
    let tail=content.slice(boundary);const explanation=tail.lastIndexOf('\n## 采集说明');
    if(explanation>=0)tail=tail.slice(0,explanation)+tail.slice(explanation).replace(/^(原帖回溯：\[[^\r\n]*\]\()[^\r\n)]*\)/m,(_m,prefix)=>prefix+link+')');
    return head+tail;
  }
  if(name==='readable.html'){
    const htmlLink=link.replaceAll('&','&amp;').replaceAll('"','&quot;');
    content=content.replace(/(<body><p><a href=")[^"]*(">打开原始页面<\/a>)/,(_m,start,end)=>start+htmlLink+end);
    const footer=content.lastIndexOf('<h2>回溯</h2>');
    if(footer>=0)content=content.slice(0,footer)+content.slice(footer).replace(/(<p><a href=")[^"]*(">打开原帖<\/a>)/,(_m,start,end)=>start+htmlLink+end);
  }
  return content;
}
const api={sourceUrl,hasAccessUrl,preserveAccess,rewriteGeneratedLinks};
scope.KumoSourceLinks=api;
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
