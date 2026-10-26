// Run in MAIN world: extension isolated worlds cannot read page bootstrap state.
// Return only the current item's public content; never export account state.
function readKumoPageState() {
  const url = new URL(location.href);
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
    const durl = window.__playinfo__?.data?.durl || [];
    return {sourceId: biliId, core: {title: String(data.title || ''), description: String(data.desc || ''), images: [], videos: durl.length === 1 && http(durl[0].url) ? [{url: http(durl[0].url), type: 'video/mp4', poster: http(data.pic), origin: 'target_page_state'}] : []}};
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
    const videoUrl = http(video.play_addr?.url_list?.[0] || video.playAddr?.urlList?.[0]);
    return {sourceId: douyinId, core: {description: String(item.desc || ''), images, videos: videoUrl ? [{url: videoUrl, type: 'video/mp4', poster: http(video.cover?.url_list?.[0]), origin: 'target_page_state'}] : []}};
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
  const streams = note.video?.media?.stream || {};
  const videos = Object.values(streams).flatMap(items => Array.isArray(items) ? items : []).map(item => ({
    url: http(item.masterUrl || item.url), type: 'video/mp4', poster: images[0]?.url || '', width: Number(item.width || 0), height: Number(item.height || 0)
  })).filter(video => video.url).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 1);
  return {sourceId: id, xhsNote: {accessToken: String(note.xsecToken || note.xsec_token || ''), title: String(note.title || ''), desc: String(note.desc || ''), expectedImages: (note.imageList || []).length, images, videos}};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {readKumoPageState};
