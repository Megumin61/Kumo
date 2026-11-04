// Run in MAIN world: extension isolated worlds cannot read page bootstrap state.
// Return only the current item's public content; never export account state.
function readKumoPageState() {
  const url = new URL(location.href);
  const xId = /(^|\.)(x|twitter)\.com$/.test(url.hostname) && url.pathname.match(/^\/[^/]+\/status\/(\d+)/)?.[1];
  if (xId) {
    // New X status shells serialize public post records inside JS string literals.
    // Parse strings as JSON data only; never execute page scripts or collect account state.
    const queue=[],records=new Map();let selected;
    for(const script of document.querySelectorAll('script')) {
      const text=script.textContent||'';if(text.length>8*1024*1024||!text.includes('media_entities2')&&!text.includes('full_text'))continue;
      try{queue.push(JSON.parse(text));}catch{}
      for(const match of text.matchAll(/"(?:\\.|[^"\\])*"/g)){if(match[0].length<50)continue;try{const value=JSON.parse(match[0]);if(typeof value==='string'&&value.startsWith('{'))queue.push(JSON.parse(value));}catch{}}
    }
    for(let index=0;index<queue.length&&index<12000;index++){
      let item=queue[index];if(!item||typeof item!=='object')continue;
      if(item.rest_id&&typeof item.legacy?.full_text==='string'&&!item.details){
        const legacy=item.legacy,u=item.core?.user_results?.result||{},profile=u.core||u.legacy||{};
        item={...item,details:{full_text:legacy.full_text,created_at_ms:Date.parse(legacy.created_at)||undefined},counts:{favorite_count:legacy.favorite_count,reply_count:legacy.reply_count,bookmark_count:legacy.bookmark_count},media_entities2:legacy.extended_entities?.media||[],url_entities:legacy.entities?.urls||[],core:{...item.core,user_results:{result:{core:{name:profile.name,screen_name:profile.screen_name},avatar:{image_url:u.avatar?.image_url||u.legacy?.profile_image_url_https||''}}}}};
      }
      if(item.rest_id&&typeof item.details?.full_text==='string')records.set(String(item.rest_id),item);
      if(String(item.rest_id)===xId&&typeof item.details?.full_text==='string'){
        const media=(item.media_entities2||[]).filter(m=>String(m.expanded_url||'').match(/\/status\/(\d+)\//)?.[1]===xId),images=[],videos=[];
        for(const m of media){if(m.type==='photo')images.push({url:m.media_url_https,origin:'target_page_state'});else{const variants=(m.video_info?.variants||[]).filter(v=>v.content_type==='video/mp4'&&!/\/aud\/|\/0\/0\/|\/init[.-]/.test(v.url||'')).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0));if(variants[0])videos.push({url:variants[0].url,poster:m.media_url_https,kind:'direct_file',type:'video/mp4',mediaId:m.id_str,origin:'target_page_state'});}}
        selected={item,core:{description:item.details.full_text,images,videos}};
      }
      queue.push(...Object.values(item).filter(v=>v&&typeof v==='object'));
    }
    if(selected){
      const authorOf=p=>p.core?.user_results?.result||{},mainAuthor=authorOf(selected.item).core?.screen_name;
      const comments=[...records.values()].filter(p=>String(p.reply_to_results?.rest_id||p.legacy?.in_reply_to_status_id_str||'')===xId).slice(0,5).map((p,i)=>{
        const u=authorOf(p),handle=u.core?.screen_name||'',text=(p.url_entities||[]).reduce((s,e)=>s.replaceAll(e.url,e.expanded_url||e.url),p.details.full_text),media=(p.media_entities2||[]).map(m=>({url:m.media_url_https,kind:m.type==='photo'?'image':'video',videoUrl:(m.video_info?.variants||[]).filter(v=>v.content_type==='video/mp4'&&!/\/aud\/|\/0\/0\//.test(v.url||'')).sort((a,b)=>(b.bitrate||0)-(a.bitrate||0))[0]?.url||''}));
        return {sourceId:String(p.rest_id),replyToId:xId,url:'https://x.com/'+handle+'/status/'+p.rest_id,author:u.core?.name||handle,handle,authorUrl:'https://x.com/'+handle,avatar:u.avatar?.image_url||'',text,likes:{value:p.counts?.favorite_count||0,raw:String(p.counts?.favorite_count||0)},replyCount:p.counts?.reply_count||0,bookmarks:p.counts?.bookmark_count||0,capturedAt:new Date().toISOString(),publishedAt:p.details.created_at_ms?new Date(p.details.created_at_ms).toISOString():'',captureOrder:i+1,source:'public_reply_order',isAuthor:handle===mainAuthor,media};
      });
      return {sourceId:xId,core:selected.core,comments,authorFollowups:comments.filter(c=>c.isAuthor),discussionCoverage:{limit:5,captured:comments.length,order:'returned_page_order',complete:false}};
    }
    return {};
  }
  const http = value => {
    try { const parsed = new URL(value, location.href); return /^https?:$/.test(parsed.protocol) ? parsed.href : ''; }
    catch { return ''; }
  };
  const jsonScript = id => {
    try { const text = document.getElementById(id)?.textContent || ''; return JSON.parse(text.startsWith('%') ? decodeURIComponent(text) : text); }
    catch { return {}; }
  };
  const tiktokId = url.pathname.match(/\/video\/(\d+)/)?.[1];
  if (/(^|\.)tiktok\.com$/.test(url.hostname) && tiktokId) {
    const data = jsonScript('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    const item = data.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct || jsonScript('SIGI_STATE').ItemModule?.[tiktokId];
    if (String(item?.id) !== tiktokId) return {};
    const images = (item.imagePost?.images || []).map((image, index) => ({url: http(image.imageURL?.urlList?.[0]), order: index + 1, origin: 'target_page_state'})).filter(image => image.url);
    const videoUrl = http(item.video?.playAddr);
    return {sourceId: tiktokId, core: {description: String(item.desc || ''), images, videos: videoUrl ? [{url: videoUrl, type: 'video/mp4', poster: http(item.video?.cover), origin: 'target_page_state'}] : []}};
  }
  const biliId = url.pathname.match(/\/video\/(BV[a-z0-9]+)/i)?.[1];
  if (/(^|\.)bilibili\.com$/.test(url.hostname) && biliId) {
    const data = window.__INITIAL_STATE__?.videoData;
    if (data?.bvid !== biliId) return {};
    const play = window.__playinfo__?.data || {}, durl = play.durl || [];
    let videos = durl.length === 1 && http(durl[0].url) ? [{url: http(durl[0].url), type: 'video/mp4', poster: http(data.pic), origin: 'target_page_state', alternatives: (durl[0].backup_url || durl[0].backupUrl || []).map(url => ({url: http(url), kind: 'direct_file'})).filter(item => item.url)}] : [];
    // Most Bilibili pages stream DASH: one H.264 video track and one AAC track, saved together as one MP4.
    if (!videos.length && play.dash) {
      const urls = item => [item?.baseUrl || item?.base_url, ...(item?.backupUrl || item?.backup_url || [])].map(http).filter(Boolean);
      const avc = (play.dash.video || []).filter(item => item.codecid === 7 || /^avc/i.test(item.codecs || ''));
      const video = (avc.length ? avc : play.dash.video || []).slice().sort((a, b) => (b.id || 0) - (a.id || 0) || (b.bandwidth || 0) - (a.bandwidth || 0))[0];
      const audio = (play.dash.audio || []).filter(item => /mp4a/i.test(item.codecs || '') || !item.codecs).sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
      const videoUrls = urls(video), audioUrls = urls(audio);
      if (videoUrls.length && audioUrls.length) { const pairs=videoUrls.flatMap(url=>audioUrls.map(audioUrl=>({url,audioUrl,kind:'dash_pair'}))).slice(0,24); videos=[{...pairs[0],type:'video/mp4',poster:http(data.pic),origin:'target_page_state',alternatives:pairs.slice(1)}]; }
    }
    return {sourceId: biliId, core: {title: String(data.title || ''), description: String(data.desc || ''), images: [], videos}};
  }
  const douyinId = url.pathname.match(/\/(?:video|note)\/(\d+)/)?.[1];
  if (/(^|\.)douyin\.com$/.test(url.hostname) && douyinId) {
    const queue = [{value: jsonScript('RENDER_DATA'), depth: 0}];
    let item;
    for (let index = 0; index < queue.length && index < 3000; index++) {
      const {value, depth} = queue[index];
      if (!value || typeof value !== 'object') continue;
      if (String(value.aweme_id || value.awemeId || '') === douyinId) { item = value; break; }
      if (depth < 12) Object.values(value).forEach(child => { if (child && typeof child === 'object') queue.push({value: child, depth: depth + 1}); });
    }
    if (!item) return {};
    const images = (item.images || []).map((image, index) => ({url: http(image.url_list?.[0] || image.urlList?.[0]), order: index + 1, origin: 'target_page_state'})).filter(image => image.url);
    const video = item.video || {};
    const mirrors = [...(video.play_addr_h264?.url_list || []), ...(video.play_addr?.url_list || video.playAddr?.urlList || []), ...((video.bit_rate || video.bitRateList || []).flatMap(rate => rate.play_addr?.url_list || rate.playAddr?.urlList || []))].map(http).filter(Boolean);
    const videoUrl = mirrors[0];
    return {sourceId: douyinId, core: {description: String(item.desc || ''), images, videos: videoUrl ? [{url: videoUrl, type: 'video/mp4', poster: http(video.cover?.url_list?.[0]), origin: 'target_page_state', alternatives: [...new Set(mirrors.slice(1))].map(url => ({url, kind: 'direct_file'}))}] : []}};
  }
  const id = url.pathname.match(/\/(?:explore|discovery\/item)\/([a-z0-9]+)/i)?.[1];
  if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname) || !id) return {};
  const state = window.__INITIAL_STATE__ || {};
  const map = state.note?.noteDetailMap || state.noteDetailMap || {};
  const entry = map[id] || Object.values(map).find(value => String(value?.note?.noteId || value?.noteId || '') === id);
  const note = entry?.note || entry;
  if (!note || String(note.noteId || id) !== id) return {};
  const images = (note.imageList || []).map((image, index) => {
    const infos = image.infoList || [];
    const best = infos.find(item => /WB_DFT|ORIGINAL/i.test(item.imageScene || '')) || infos.find(item => /WB_PRV/i.test(item.imageScene || '')) || infos[0];
    return {url: http(image.urlDefault || best?.url || image.url || image.urlPre), alt: '', width: Number(image.width || 0), height: Number(image.height || 0), order: index + 1, origin: 'note_image_list'};
  }).filter(image => image.url);
  // H.264 plays in every Chromium build; H.265/AV1 streams stay as fallbacks.
  const pickStream = (streams, poster) => {
    const ordered = [...['h264', 'h265', 'h266', 'av1'].map(codec => streams?.[codec]), ...Object.entries(streams || {}).filter(([codec]) => !['h264', 'h265', 'h266', 'av1'].includes(codec)).map(([, items]) => items)];
    const candidates = ordered.flatMap(items => (Array.isArray(items) ? items : []).slice().sort((a, b) => Number(b.width || 0) * Number(b.height || 0) - Number(a.width || 0) * Number(a.height || 0)))
      .flatMap(item => [item.masterUrl || item.url, ...(item.backupUrls || [])].map(url => ({url: http(url), width: Number(item.width || 0), height: Number(item.height || 0)})))
      .filter((item, index, list) => item.url && list.findIndex(other => other.url === item.url) === index);
    if (!candidates.length) return null;
    return {...candidates[0], type: 'video/mp4', poster, alternatives: candidates.slice(1).map(item => ({url: item.url, kind: 'direct_file'}))};
  };
  const videos = [pickStream(note.video?.media?.stream, images[0]?.url || '')].filter(Boolean);
  (note.imageList || []).forEach((image, index) => {
    const live = image.livePhoto || image.live_photo ? pickStream(image.stream || image.livePhotoStream || {}, images[index]?.url || '') : null;
    if (live) videos.push({...live, livePhoto: true, order: index + 1});
  });
  return {sourceId: id, xhsNote: {accessToken: String(note.xsecToken || note.xsec_token || ''), title: String(note.title || ''), desc: String(note.desc || ''), expectedImages: (note.imageList || []).length, images, videos}};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {readKumoPageState};
