const httpUrl=value=>{
  try{const parsed=new URL(value);return /^https?:$/.test(parsed.protocol)&&!parsed.username&&!parsed.password?parsed:null;}catch{return null;}
};
const noteId=parsed=>parsed&&/(^|\.)xiaohongshu\.com$/i.test(parsed.hostname)?parsed.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f0-9]{24})\/?$/i)?.[1].toLowerCase()||'':'';

export function sourceUrl(metadata={}){
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
