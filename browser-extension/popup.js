const titleEl = document.getElementById('title');
const eyebrowEl = document.getElementById('eyebrow');
const previewEl = document.getElementById('preview');
const statusEl = document.getElementById('status');
const folderEl = document.getElementById('folder');
const noteEl = document.getElementById('note');
const saveEl = document.getElementById('save');
const changeFolderEl = document.getElementById('change-folder');
const screenshotEl = document.getElementById('include-screenshot');
const downloadImagesEl = document.getElementById('download-images');
const downloadVideoEl = document.getElementById('download-video');
// Retain the last storage profile for existing users; it is not an AI connection.
const targetEl = {value:KumoDestination.savedProfile(localStorage),disabled:false};
const locationModeEl=document.getElementById('save-location-mode');
const targetPathEl = document.getElementById('target-path');
const commentCountEl = document.getElementById('comment-count');
const savePlanTextEl = document.getElementById('save-plan-text');
const progressPanelEl = document.getElementById('progress-panel');
const progressEl = document.getElementById('progress');
const progressLabelEl = document.getElementById('progress-label');
const progressTimeEl = document.getElementById('progress-time');
const progressDetailEl = document.getElementById('progress-detail');
document.getElementById('app-version').textContent = globalThis.KumoQuickWorker?'':`v${chrome.runtime.getManifest().version}`;
const refreshSelects=new Map();
document.querySelectorAll('select:not([hidden])').forEach(control=>refreshSelects.set(control,KumoUI.select(control)));
const settingsEntry=document.getElementById('settings-open');settingsEntry.prepend(KumoUI.icon('gear'));settingsEntry.append(KumoUI.icon('chevron'));
document.querySelector('.entry-label').prepend(KumoUI.icon('bookmark')); document.getElementById('open-library').append(KumoUI.icon('chevron'));
const decorateSave=()=>{if(!saveEl.querySelector('svg'))saveEl.prepend(KumoUI.icon('sparkle'));}; decorateSave(); new MutationObserver(decorateSave).observe(saveEl,{childList:true});

const TARGETS = {
  codex: {
    id: 'codex',
    label: 'Codex',
    rootLabel: 'Codex 项目或 Git 仓库根目录',
    libraryParts: ['projects', 'kumo', 'knowledge'],
    libraryPath: 'projects/kumo/knowledge',
    guideAtRoot: true,
    guideContent: '---\nschema: kumo-library-config-v1\nlibrary_root: projects/kumo/knowledge\n---\n\n# Kumo\n\n本项目的网页剪藏位于 `projects/kumo/knowledge/inbox/`。处理 Kumo 相关请求时，优先读取 `projects/kumo/knowledge/LIBRARY.md` 和相关领域索引；原始剪藏保持不改写。\n',
    libraryReadme: '# Kumo 本地知识库\n\n- `inbox/`：未整理的原始剪藏。\n- `archive/`：已处理、保持原样的来源。\n- `domains/`：Agent 生成并可被用户修订的领域知识。\n- `LIBRARY.md`：全库导航。\n'
  },
  workbuddy: {
    id: 'workbuddy',
    label: 'WorkBuddy',
    rootLabel: 'WorkBuddy Co-work 文件夹根目录',
    libraryParts: ['Kumo', 'knowledge'],
    libraryPath: 'Kumo/knowledge',
    guideAtRoot: true,
    guideContent: '---\nschema: kumo-library-config-v1\nlibrary_root: Kumo/knowledge\n---\n\n# Kumo\n\n本 Co-work 文件夹中的网页剪藏位于 `Kumo/knowledge/inbox/`。这是用户内容区，不属于 `.wbuddy/` 或 WorkBuddy 的 `knowledge/store/` 内部状态。整理时保留原始来源，并把派生知识写入 `Kumo/knowledge/domains/`。\n',
    libraryReadme: '# Kumo for WorkBuddy\n\n这是 Co-work 文件夹中的用户资料库，不应写入 `.wbuddy/` 或 WorkBuddy 内部 `knowledge/store/`。\n\n- `inbox/`：未整理剪藏。\n- `archive/`：已处理原始来源。\n- `domains/`：派生领域知识。\n'
  },
  generic: {
    id: 'generic',
    label: '本地 Agent',
    rootLabel: 'Kumo 知识库根目录',
    libraryParts: [],
    libraryPath: '.',
    guideAtRoot: false,
    guideContent: '---\nschema: kumo-library-config-v1\nlibrary_root: .\n---\n\n# Kumo\n\n新剪藏位于 `inbox/`。Agent 应先读 `LIBRARY.md`，原始来源保持不改写，派生知识写入 `domains/`。\n',
    libraryReadme: '# Kumo 本地知识库\n\n- `inbox/`：未整理的原始剪藏。\n- `archive/`：已处理原始来源。\n- `domains/`：派生领域知识。\n'
  }
};

const CONTENT_TYPE_LABELS = {
  article: '文章',
  image_post: '图文',
  video: '视频页',
  social_post: '帖子',
  web_page: '网页'
};

let clip = null;
let directoryHandle = null;
let activeWindowId = null;
let activeTabId = null;
let bridgeStatus = null;
let progressStartedAt = 0;
let progressTimer = null;
let frameFile = null;
let completeSaved = false;
let targetEpoch=0;
const quickSilent=Boolean(globalThis.KumoQuickWorker)||new URLSearchParams(location.search).get('silent')==='1';
const quickParam=name=>globalThis.KumoQuickWorker?.params?.[name]??new URLSearchParams(location.search).get(name);
let saveInitiated=false, quickHandled=false;
async function closeQuick() {
  if(globalThis.KumoQuickWorker){await globalThis.KumoQuickWorker.finish();return;}
  try { const current=await chrome.tabs.getCurrent(); if(current?.id)await chrome.tabs.remove(current.id); else window.close(); }
  catch(error) { console.error('无法关闭后台剪藏',error); }
}
async function revealQuick(message='收藏未完成，请打开 Kumo 重试',kind='error') {
  if(!quickSilent || quickHandled) return;
  quickHandled=true;
  try { await KumoQuickFeedback.show(activeTabId,message,kind); }
  catch(error) { console.error('无法显示收藏状态',error); if(activeTabId)await chrome.action.setBadgeText({tabId:activeTabId,text:'!'}).catch(()=>{}); }
  await closeQuick();
}
async function finishQuick(message='收藏完成') {
  if(!quickSilent || quickHandled) return;
  quickHandled=true;
  try { await KumoQuickFeedback.show(activeTabId,message); await chrome.action.setBadgeText({tabId:activeTabId,text:''}); }
  catch(error) { console.error('无法显示收藏提示',error); }
  await closeQuick();
}
for(const [id,label] of [['claude','Claude Code'],['qoder','Qoder']])TARGETS[id]={...TARGETS.generic,id,label,rootLabel:label+' 项目资料文件夹'};
const preferences=KumoDestination.options(localStorage);
screenshotEl.checked=preferences.screenshot;downloadImagesEl.checked=preferences.images;downloadVideoEl.checked=preferences.video;commentCountEl.value=String(preferences.comments);refreshSelects.get(commentCountEl)?.();
function usingBridge(){return targetEl.value==='codex'&&Boolean(bridgeStatus?.ok)&&locationModeEl.value==='auto';}
function currentProfile(){return ['directory','downloads'].includes(locationModeEl.value)?{...TARGETS.generic,label:'本地资料库'}:TARGETS[targetEl.value];}

async function followVideoJob(jobId) {
  saveEl.disabled = true;
  setStatus('正文已保存，视频正在后台下载。可以关闭插件，稍后回来查看。');
  if (!progressTimer) startProgress();
  try {
    while (true) {
      const job = await KumoBridge.videoJob(jobId);
      const labels = {queued: '准备后台下载', resolving: '正在寻找原帖视频', downloading_images: '正在后台保存图片', downloading: '正在后台下载视频', saving: '正在写入知识库'};
      if (job.finishedAt) {
        const complete = job.phase === 'complete';
        finishProgress(complete);
        completeSaved = complete;
        setStatus(complete ? `已保存，视频 ${job.downloadedVideos}/${job.videos} 已离线：${job.result.relativePath}` : `正文已保存，媒体未完整：${job.error || (job.errors || []).join('；') || '未发现可下载视频'}。可点击重试。`, complete ? 'success' : 'warning');
        saveEl.textContent = complete ? '已保存' : '重试媒体';
        saveEl.disabled = complete;
        targetEl.disabled = false;
        return;
      }
      const ratio = job.expected ? Math.min(1, job.received / job.expected) : .15;
      updateProgress(job.phase === 'saving' ? 94 : 52 + ratio * 36, labels[job.phase] || '正在处理', `${formatBytes(job.received)}${job.expected ? ` / ${formatBytes(job.expected)}` : ''} · 关闭插件后继续`);
      await new Promise(resolve => setTimeout(resolve, 600));
    }
  } catch (error) {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    void revealQuick('无法查询收藏进度，请打开 Kumo 查看','warning');
    setStatus(`无法查询后台任务：${error.message}。重新打开插件可查看；正文已保留。`, 'warning');
    saveEl.disabled = false;
    targetEl.disabled = false;
  }
}

function setStatus(message, kind = '') {
  statusEl.title = message;
  statusEl.textContent = message;
  statusEl.className = kind;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function updateSavePlan() {
  if (!clip) return;
  const commentLimit = Number(commentCountEl.value || 0);
  const comments = Math.min(commentLimit, clip.comments?.length || 0);
  const parts = [`正文 ${clip.stats.characters} 字`, `${clip.stats.images} 张图片`];
  if (clip.stats.videos) parts.push(`${clip.stats.videos} 个视频来源`);
  if (clip.author) parts.push('作者身份');
  if (Object.keys(clip.socialMetrics || {}).length) parts.push('互动数据快照');
  if (clip.authorFollowups?.length) parts.push(`${clip.authorFollowups.length} 条作者补充`);
  if (commentLimit) parts.push(`${comments} 条已加载评论`);
  savePlanTextEl.textContent = parts.join('、');
}

function mediaResult(clip) {
  const imageTotal = clip.images?.length || 0;
  const videoTotal = clip.videos?.length || 0;
  const imageSaved = Number(clip.stats.downloadedImages || 0);
  const videoSaved = Number(clip.stats.downloadedVideos || 0);
  const incomplete = (downloadImagesEl.checked && imageSaved < imageTotal) || (downloadVideoEl.checked && videoSaved < videoTotal);
  return {
    incomplete,
    detail: incomplete ? `图片 ${imageSaved}/${imageTotal}、视频 ${videoSaved}/${videoTotal} 已离线；其余保留原链接，可再次点击重试。` : ''
  };
}

function startProgress() {
  if (progressTimer) clearInterval(progressTimer);
  progressStartedAt = Date.now();
  progressPanelEl.hidden = false;
  progressLabelEl.textContent = '准备保存';
  progressDetailEl.textContent = '';
  progressEl.value = 2;
  progressTimer = setInterval(() => {
    progressTimeEl.textContent = `${Math.max(0, Math.round((Date.now() - progressStartedAt) / 1000))} 秒`;
  }, 500);
}

function updateProgress(value, label, detail = '') {
  progressEl.value = Math.max(0, Math.min(100, value));
  progressLabelEl.textContent = label;
  progressDetailEl.textContent = detail;
}

function finishProgress(complete = true) {
  if(saveInitiated && complete) KumoTags.recordSaved(clip?.userTags);
  if(quickSilent && saveInitiated) { if(complete) void finishQuick(); else void revealQuick('正文已保存，部分媒体未完成','warning'); }
  if (progressTimer) clearInterval(progressTimer);
  progressTimer = null;
  progressTimeEl.textContent = `${Math.max(0, Math.round((Date.now() - progressStartedAt) / 1000))} 秒`;
  progressEl.value = 100;
  progressLabelEl.textContent = complete ? '保存完成' : '正文已保存，媒体待补全';
  progressDetailEl.textContent = complete ? '正文、笔记与来源已写入' : '可重试媒体，已保存内容不会丢失';
  progressPanelEl.hidden = true;
  if(usingBridge())void KumoTags.load(true).catch(()=>{});
  if (usingBridge()) void KumoBridge.library({limit:1}).then(result=>{const count=document.getElementById('saved-count');count.textContent=result.allTotal??result.total;count.hidden=false;}).catch(()=>{});
}

const fetchBlobWithProgress = (...args) => KumoMedia.fetchBlobWithProgress(...args);

function updateFolder(handle) {
  const profile = currentProfile();
  const destination = profile.libraryPath === '.' ? 'inbox' : `${profile.libraryPath}/inbox`;
  document.getElementById('use-connected').hidden=!(bridgeStatus?.ok&&!usingBridge());
  if(!usingBridge())document.getElementById('saved-count').hidden=true;
  if(locationModeEl.value==='downloads'){targetPathEl.textContent='下载目录 / Kumo-Inbox / '+profile.id;changeFolderEl.textContent='更改文件夹';return;}
  if (usingBridge()) {
    targetPathEl.textContent = `已连接本地资料库：${bridgeStatus.libraryRoot}`;
    folderEl.textContent = '保存到已连接的本地资料库';
    changeFolderEl.textContent = '改用其他文件夹';
    return;
  }
  targetPathEl.textContent = handle ? `${handle.name}/${destination}` : '选择一个保存收藏的资料文件夹。';
  folderEl.textContent = handle ? `保存位置：${handle.name} → ${destination}` : '首次保存时选一个资料文件夹，之后会记住。';
  changeFolderEl.textContent = handle ? '更换保存文件夹' : '选择保存文件夹';
}

async function loadPage() {
  try {
    if(globalThis.KumoQuickWorker)await globalThis.KumoQuickWorker.ready;
    const sourceId=String(quickParam('sourceTabId')||'');
    const tab=sourceId && /^\d+$/.test(sourceId) ? await chrome.tabs.get(Number(sourceId)) : (await chrome.tabs.query({active: true, currentWindow: true}))[0];
    if (!tab?.id || !/^https?:/i.test(tab.url || '')) throw new Error('请从网页点击 Kumo 图标，或按 Alt+Shift+K 打开。');
    activeWindowId = tab.windowId;
    activeTabId = tab.id;
    const [stateResult] = await chrome.scripting.executeScript({target: {tabId: tab.id}, world: 'MAIN', func: readKumoPageState}).catch(() => []);
    const result = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: extractKumoPage, args: [stateResult?.result || {}]});
    clip = result?.[0]?.result;
    if (!clip) throw new Error('没有从当前页面读到内容。');
    if (clip.videos?.length || clip.contentType === 'video') {
      document.getElementById('video-focus').hidden = false;
      const [frameResult] = await chrome.scripting.executeScript({target: {tabId: tab.id}, func: captureKumoVideoFrame, args: [clip.sourceId, clip.platformId, clip.videos]}).catch(() => []);
      const frame = frameResult?.result || {frameStatus: 'unavailable', frameError: 'frame_capture_failed'};
      const {dataUrl, ...context} = frame;
      clip.videoContext = context;
      if (dataUrl) {
        frameFile = {name: 'assets/frame-01.jpg', content: await (await fetch(dataUrl)).blob(), type: 'image/jpeg'};
        clip.videoContext.frameFile = frameFile.name;
      }
      document.getElementById('video-position').textContent = `${Number.isFinite(frame.positionSeconds) ? `当前观看时刻 ${frame.positionSeconds.toFixed(1)} 秒` : '尚未读到播放时刻'}${frameFile ? ' · 已保留这一帧' : ' · 可用视口截图补充画面'}；不代表看过完整视频。`;
    }
    eyebrowEl.textContent = clip.author || '';
    KumoUI.platform(document.getElementById('platform-mark'), clip.platform);
    const thumbnail = document.getElementById('page-thumbnail');
    const candidate = clip.videoContext?.frameFile && frameFile ? URL.createObjectURL(frameFile.content) : (clip.videos?.[0]?.poster || clip.videos?.[0]?.thumbnail || clip.images?.[0]?.url || clip.images?.[0]?.src);
    if (candidate && /^(https?:|blob:)/i.test(candidate)) { thumbnail.hidden = false; thumbnail.src = candidate; const kind=document.getElementById('page-media-kind');kind.textContent=clip.videos?.length?'▶':'▧';kind.setAttribute('aria-label',clip.videos?.length?'视频预览':'图片预览');kind.hidden=false;thumbnail.onerror = () => { thumbnail.hidden = true;kind.hidden=true; }; }
    clip.displayTitle=KumoUI.displayTitle(clip);titleEl.textContent = clip.displayTitle;titleEl.title=clip.title;
    const selection = clip.selection ? ` · 已保留选中原文 ${clip.selection.text.length} 字` : '';
    const typeLabel = CONTENT_TYPE_LABELS[clip.contentType] || '网页';
    const videos = clip.stats.videos ? ` · 视频 ${clip.stats.videos} 个` : '';
    const gallery = clip.stats.expectedGalleryMedia ? ` · 图集 ${clip.stats.foundGalleryMedia}/${clip.stats.expectedGalleryMedia}` : '';
    const comments=commentCountEl.value==='0'?'':` · 已加载评论 ${clip.comments?.length||0} 条`;
    previewEl.textContent = `${typeLabel} · 正文 ${clip.stats.characters} 字 · 图片 ${clip.stats.images} 张${videos}${gallery}${comments}${selection}`;
    updateSavePlan();
    setStatus(clip.warnings.length ? '内容可能不完整' : '准备保存', clip.warnings.length ? 'warning' : '');
    await loadTarget();
    saveEl.disabled = false;
    if(usingBridge()&&bridgeStatus?.capabilities?.includes('library_browser')){
      let existing;
      try{existing=await KumoDuplicate.find(clip,KumoBridge,KumoStorage);}catch(error){setStatus('检查收藏状态失败，请检查本地资料库连接。','warning');saveEl.disabled=true;void revealQuick('无法检查收藏，请检查资料库连接','warning');return;}
      if(existing){
        if(quickParam('quick')==='1'){setStatus('已经收藏，无需重复保存。','success');void finishQuick('已经收藏过');return;}
        await KumoTags.select((existing.userTags||[]).map(tag=>tag.id));
        noteEl.value=existing.userNote||'';document.getElementById('note-count').textContent=noteEl.value.length;
        completeSaved=true;saveEl.textContent='已收藏';saveEl.disabled=true;
        setStatus('已经收藏，可修改笔记或标签。','success');return;
      }
    }
    const previousJob = [...(bridgeStatus?.activeJobs || [])].reverse().find(job => job.url === clip.url);
    if (previousJob&&usingBridge()&&quickParam('quick')!=='1') void followVideoJob(previousJob.id);
    else if(quickParam('quick')==='1'){
      const ready=usingBridge()||locationModeEl.value==='downloads'||directoryHandle&&await directoryHandle.queryPermission({mode:'readwrite'})==='granted';
      if(!ready){setStatus('先设置保存文件夹，再使用一键剪藏。','warning');saveOptions.hidden=false;void revealQuick('请先打开 Kumo 设置保存位置','warning');return;}
      const media=usingBridge()&&clip.platformId==='x'?[]:[...(downloadImagesEl.checked?clip.images||[]:[]),...(downloadVideoEl.checked?clip.videos||[]:[])];
      const origins=[...new Set(media.map(m=>{try{return new URL(m.url).origin+'/*';}catch{return '';}}).filter(v=>/^https?:/.test(v)))];
      if(origins.length&&!await chrome.permissions.contains({origins})){setStatus('首次保存此来源需授权媒体读取，请点击嚼一嚼确认。','warning');void revealQuick('请打开 Kumo 授权后收藏','warning');return;}
      void save();
    }
  } catch (error) {
    void revealQuick('无法读取当前网页，请打开 Kumo 重试');
    eyebrowEl.textContent = '无法读取';
    setStatus(error.message || String(error), 'error');
    await loadTarget().catch(()=>{});
  }
}

async function chooseFolder() {
  targetEl.disabled=true;
  try {
    const profile = {...TARGETS[targetEl.value],libraryParts:[],libraryPath:'.',guideAtRoot:false,guideContent:TARGETS.generic.guideContent};
    const picked = await KumoStorage.pickDirectory(profile.id);
    if (!picked) {
      updateFolder(null);
      setStatus('此浏览器不支持文件夹授权，请在保存位置选择“浏览器下载目录”。', 'warning');
      return null;
    }
    await KumoStorage.initializeLibrary(picked, profile);
    directoryHandle = picked;
    locationModeEl.value='directory';localStorage.setItem('kumo-location-'+targetEl.value,'directory');completeSaved=false;
    await KumoTags.load(false);
    updateFolder(directoryHandle);
    setStatus('保存目录已设置。', 'success');
    return directoryHandle;
  } catch (error) {
    if (error?.name === 'AbortError') return undefined;
    setStatus(error.message || String(error), 'error');
    return null;
  } finally {targetEl.disabled=false;}
}

async function screenshotBlob() {
  if (!screenshotEl.checked || typeof activeWindowId !== 'number') return null;
  try {
    if(quickSilent){const [visible]=await chrome.tabs.query({active:true,windowId:activeWindowId});if(visible?.id!==activeTabId)return null;}
    const dataUrl = await chrome.tabs.captureVisibleTab(activeWindowId, {format: 'png'});
    return await (await fetch(dataUrl)).blob();
  } catch {
    return null;
  }
}

function imageExtension(blob, url) {
  const byType = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif'};
  if (byType[blob.type]) return byType[blob.type];
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match && /^(jpe?g|png|webp|gif|avif)$/i.test(match[1])) return match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch {}
  return 'img';
}

async function requestImageOrigins(images) {
  const origins = [...new Set(images.map(image => {
    try {
      const url = new URL(image.url);
      return /^(https?):$/.test(url.protocol) ? `${url.origin}/*` : '';
    } catch { return ''; }
  }).filter(Boolean))];
  if (!origins.length) return true;
  if(await chrome.permissions.contains({origins}))return true;
  return chrome.permissions.request({origins});
}

async function prepareImageFiles(sourceClip, onProgress, mediaPermissionGranted) {
  const images = (sourceClip.images || []).slice(0, 30).map(image => ({...image}));
  if (!downloadImagesEl.checked || !images.length) {
    return {clip: {...sourceClip, images, stats: {...sourceClip.stats, downloadedImages: 0}}, files: []};
  }
  if (!mediaPermissionGranted) {
    images.forEach(image => { image.downloadStatus = 'remote_only'; image.downloadError = 'media_download_permission_denied'; });
    return {
      clip: {...sourceClip, images, stats: {...sourceClip.stats, downloadedImages: 0}, warnings: [...sourceClip.warnings, 'image_download_permission_denied']},
      files: []
    };
  }

  const files = [];
  let nextIndex = 0;
  let totalBytes = 0;
  let completed = 0;
  const receivedByIndex = new Map();
  const expectedByIndex = new Map();
  const maximumTotalBytes = 40 * 1024 * 1024;
  async function worker() {
    while (nextIndex < images.length) {
      const index = nextIndex++;
      const image = images[index];
      try {
        const blob = await fetchBlobWithProgress(image.url, 15000, (received, expected) => {
          receivedByIndex.set(index, received);
          if (expected) expectedByIndex.set(index, expected);
          onProgress?.({completed, total: images.length, received: [...receivedByIndex.values()].reduce((sum, value) => sum + value, 0), expected: [...expectedByIndex.values()].reduce((sum, value) => sum + value, 0)});
        }, undefined, 20 * 1024 * 1024);
        if (!blob.type.startsWith('image/') || !blob.size || blob.size > 20 * 1024 * 1024 || totalBytes + blob.size > maximumTotalBytes) throw new Error('invalid_or_oversized_image');
        totalBytes += blob.size;
        const localFile = `assets/image-${String(index + 1).padStart(2, '0')}.${imageExtension(blob, image.url)}`;
        image.localFile = localFile;
        image.downloadStatus = 'saved';
        image.bytes = blob.size;
        files.push({name: localFile, content: blob, type: blob.type || 'application/octet-stream'});
      } catch (error) {
        image.downloadStatus = 'remote_only';
        image.downloadError = error?.message || 'download_failed';
      } finally {
        completed += 1;
        onProgress?.({completed, total: images.length, received: [...receivedByIndex.values()].reduce((sum, value) => sum + value, 0), expected: [...expectedByIndex.values()].reduce((sum, value) => sum + value, 0)});
      }
    }
  }
  await Promise.all(Array.from({length: Math.min(4, images.length)}, worker));
  const downloadedImages = images.filter(image => image.localFile).length;
  const warnings = [...sourceClip.warnings];
  if (downloadedImages < images.length) warnings.push(`images_not_fully_downloaded:${downloadedImages}/${images.length}`);
  return {clip: {...sourceClip, images, stats: {...sourceClip.stats, downloadedImages}, warnings}, files};
}

async function prepareVideoFiles(sourceClip, onProgress, mediaPermissionGranted) {
  const useBridge = sourceClip.platformId === 'x' && Number(bridgeStatus?.apiVersion) >= 6;
  return KumoMedia.prepareVideos(sourceClip, {
    download: downloadVideoEl.checked,
    permission: mediaPermissionGranted || useBridge,
    onProgress,
    fetchImpl: useBridge ? KumoBridge.fetchXMedia : fetch,
    resolveX: async (url, mediaIds) => {
      const errors = [];
      if (useBridge) {
        try { return await KumoBridge.resolveX(url, mediaIds); }
        catch (error) { errors.push(`bridge:${error.message}`); }
      }
      try {
        const videos = await resolveXVideoFromCurrentPage(url, mediaIds);
        if (videos.length) return videos;
        errors.push('tab:no_variants');
      } catch (error) { errors.push(`tab:${error.message}`); }
      try {
        const videos = await KumoMedia.resolveXVideoVariants(url, mediaIds);
        if (videos.length) return videos;
        errors.push('extension:no_variants');
      } catch (error) { errors.push(`extension:${error.message}`); }
      throw new Error(`x_resolution_failed (${errors.join('; ')})`);
    }
  });
}

async function resolveXVideoFromCurrentPage(pageUrl, mediaIds) {
  if (!activeTabId) throw new Error('active_tab_not_found');
  const [result] = await chrome.scripting.executeScript({
    target: {tabId: activeTabId},
    world: 'MAIN',
    args: [pageUrl],
    func: async function fetchXPage(expectedUrl) {
      if (new URL(location.href).pathname !== new URL(expectedUrl).pathname) throw new Error('active_tab_changed');
      const response = await fetch(location.href, {credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`x_page_http_${response.status}`);
      const html = await response.text();
      return html.slice(0, 6 * 1024 * 1024);
    }
  });
  const ids = mediaIds.length ? mediaIds : KumoMedia.findXPostMedia(result?.result || '', new URL(pageUrl).pathname.match(/\/status\/(\d+)/)?.[1]).map(item => item.mediaId).filter(Boolean);
  return ids.length ? KumoMedia.findXVideoVariants(result?.result || '', ids) : [];
}

async function save() {
  if (!clip) return;
  saveInitiated=true;
  if(!usingBridge()&&!directoryHandle&&locationModeEl.value!=='downloads'){
    if(locationModeEl.value==='auto'){setStatus('本地资料库未连接。可选择资料文件夹继续保存。','warning');saveOptions.hidden=false;void revealQuick();return;}
    const picked=await chooseFolder();if(!picked)return;
  }
  if(!usingBridge()&&directoryHandle&&locationModeEl.value!=='downloads'&&!await KumoStorage.ensurePermission(directoryHandle)){setStatus('目录授权已失效，请在保存设置中重新选择。','warning');saveOptions.hidden=false;void revealQuick();return;}
  const note = noteEl.value;
  noteEl.disabled = true;
  clip.userTags = KumoTags.selected();
  clip.videoIntent = document.getElementById('video-intent').value;
  saveEl.disabled = true;
  setStatus('正在保存…');
  startProgress();
  try {
    if (completeSaved && usingBridge() && Number(bridgeStatus?.apiVersion) >= 7) {
      const result = await KumoBridge.annotate(clip, note, clip.userTags);
      setStatus(`笔记与标签已保存：${result.relativePath}。原内容和媒体未改动，也没有重新下载。`, 'success');
      saveEl.textContent = '已保存'; saveEl.disabled = true; finishProgress();
      return;
    }
    const useXJob = usingBridge() && Number(bridgeStatus?.apiVersion) >= 6 && clip.platformId === 'x' && downloadVideoEl.checked;
    const mediaTargets = [];
    if (downloadImagesEl.checked && !useXJob) mediaTargets.push(...(clip.images || []));
    if (downloadVideoEl.checked && !(usingBridge() && clip.platformId === 'x' && Number(bridgeStatus?.apiVersion) >= 6)) {
      mediaTargets.push(...(clip.videos || []).filter(video => /^https?:/i.test(video.url)));
      if (clip.platformId === 'x' && (clip.videos || []).some(video => video.kind === 'blob')) {
        mediaTargets.push({url: clip.capturedUrl || clip.url}, {url: 'https://video.twimg.com/'});
      }
    }
    const mediaPermissionGranted = await requestImageOrigins(mediaTargets);
    let profile = currentProfile();
    targetEl.disabled = true;
    const folderName = `${clip.capturedAt.slice(0, 10)}--${KumoFormat.slug(clip.title)}--${clip.contentHash}`;
    if (usingBridge()) {
      if (Number(bridgeStatus.apiVersion || 1) < 5) throw new Error('Kumo 本地桥接版本过旧。请重新运行本地桥接启动脚本后再保存。');
      const commentLimit = Number(commentCountEl.value || 0);
      const coreClip = {
        ...clip,
        comments: (clip.comments || []).slice(0, commentLimit),
        targetAgent: profile.id,
        libraryPath: profile.libraryPath,
        stats: {...clip.stats, downloadedImages: 0, downloadedVideos: 0},
        warnings: [...clip.warnings, 'media_download_pending']
      };
      updateProgress(3, '正在保存正文与来源', '媒体随后下载，关闭弹窗仍可保留正文');
      await KumoBridge.save(folderName, [
        {name: 'source.md', content: KumoFormat.buildMarkdown(coreClip, note, false), type: 'text/markdown;charset=utf-8'},
        {name: 'metadata.json', content: KumoFormat.buildMetadata(coreClip, note, false), type: 'application/json;charset=utf-8'},
        {name: 'readable.html', content: KumoFormat.buildReadableHtml(coreClip), type: 'text/html;charset=utf-8'}
      ], coreClip);
    }
    updateProgress(5, '核心内容已读取，正在处理图片', `共发现 ${clip.stats.images} 张图片`);
    const preparedImages = useXJob ? {clip: {...clip, images: (clip.images || []).map(image => ({...image})), stats: {...clip.stats, downloadedImages: 0}}, files: []} : await prepareImageFiles(clip, progress => {
      const ratio = progress.total ? progress.completed / progress.total : 1;
      const bytes = progress.received ? ` · 已读取 ${formatBytes(progress.received)}${progress.expected ? ` / ${formatBytes(progress.expected)}` : ''}` : '';
      updateProgress(5 + ratio * 45, `正在处理图片 ${progress.completed}/${progress.total}`, `${bytes.replace(/^ · /, '')}`);
    }, mediaPermissionGranted);
    if (useXJob) {
      const screenshot = await screenshotBlob();
      const coreClip = {...preparedImages.clip, comments: (clip.comments || []).slice(0, Number(commentCountEl.value || 0)), targetAgent: profile.id, libraryPath: profile.libraryPath, warnings: [...preparedImages.clip.warnings, 'media_download_pending']};
      const files = [
        {name: 'source.md', content: KumoFormat.buildMarkdown(coreClip, note, Boolean(screenshot)), type: 'text/markdown'},
        {name: 'metadata.json', content: KumoFormat.buildMetadata(coreClip, note, Boolean(screenshot)), type: 'application/json'},
        {name: 'readable.html', content: KumoFormat.buildReadableHtml(coreClip), type: 'text/html'},
        ...preparedImages.files,
        ...(frameFile ? [frameFile] : [])
      ];
      if (screenshot) files.push({name: 'viewport.png', content: screenshot, type: 'image/png'});
      const result = await KumoBridge.startVideoJob(folderName, coreClip, files, note, downloadImagesEl.checked);
      await followVideoJob(result.jobId);
      return;
    }
    updateProgress(52, '图片处理完成，正在处理视频', `共发现 ${clip.stats.videos} 个视频来源`);
    const prepared = await prepareVideoFiles(preparedImages.clip, progress => {
      const fraction = progress.expected ? Math.min(1, progress.received / progress.expected) : .25;
      updateProgress(52 + ((progress.index + fraction) / Math.max(1, progress.total)) * 30, `正在处理视频 ${progress.index + 1}/${progress.total}`, `${formatBytes(progress.received)}${progress.expected ? ` / ${formatBytes(progress.expected)}` : '，总大小未知'}`);
    }, mediaPermissionGranted);
    updateProgress(84, '正在整理内容包', '生成正文、溯源信息与媒体清单');
    const screenshot = await screenshotBlob();
    const commentLimit = Number(commentCountEl.value || 0);
    const targetedClip = {...prepared.clip, comments: (prepared.clip.comments || []).slice(0, commentLimit), targetAgent: profile.id, libraryPath: profile.libraryPath};
    const mediaOutcome = mediaResult(targetedClip);
    const markdown = KumoFormat.buildMarkdown(targetedClip, note, Boolean(screenshot));
    const metadata = KumoFormat.buildMetadata(targetedClip, note, Boolean(screenshot));
    const readableHtml = KumoFormat.buildReadableHtml(targetedClip);
    const files = [
      {name: 'source.md', content: markdown, type: 'text/markdown;charset=utf-8'},
      {name: 'metadata.json', content: metadata, type: 'application/json;charset=utf-8'},
      {name: 'readable.html', content: readableHtml, type: 'text/html;charset=utf-8'}
    ];
    const assetFiles = [...preparedImages.files, ...prepared.files, ...(frameFile ? [frameFile] : [])];
    files.push(...assetFiles);
    if (screenshot) files.push({name: 'viewport.png', content: screenshot, type: 'image/png'});

    if (usingBridge()) {
      if (prepared.files.length && Number(bridgeStatus.apiVersion || 1) < 3) {
        throw new Error('Kumo 本地桥接版本过旧。请重新运行启动脚本，再保存这条视频内容。');
      }
      if (preparedImages.files.length && Number(bridgeStatus.apiVersion || 1) < 2) {
        throw new Error('Kumo 本地桥接版本过旧。请重新运行启动脚本，再保存这条多图帖子。');
      }
      updateProgress(90, '正在写入本地资料库', `${files.length} 个文件`);
      const result = await KumoBridge.save(folderName, files, targetedClip);
      if (result.repaired) {
        setStatus(`${mediaOutcome.incomplete ? '已更新，媒体仍有缺失' : '已补全原有剪藏'}：${result.relativePath}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : '已补全';
      } else if (result.duplicate) {
        setStatus(`${result.linksUpdated ? '已更新原文链接' : '这条内容已经存在'}：${result.relativePath}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : result.linksUpdated ? '链接已更新' : '已存在';
      } else {
        setStatus(`${mediaOutcome.incomplete ? '已保存正文，媒体未完整' : '已保存到本地资料库'}：${result.relativePath}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : '已保存';
      }
      finishProgress(!mediaOutcome.incomplete);
      completeSaved = !mediaOutcome.incomplete;
      targetEl.disabled = false;
      saveEl.disabled = !mediaOutcome.incomplete;
      return;
    }

    if (!directoryHandle && locationModeEl.value!=='downloads' && typeof window.showDirectoryPicker === 'function') {
      const picked = await chooseFolder();
      if (picked === undefined) {
        setStatus('已取消保存。');
        saveEl.disabled = false;
        targetEl.disabled = false;
        return;
      }
      directoryHandle = picked;
      profile=currentProfile();
    }
    if (directoryHandle && locationModeEl.value!=='downloads' && !(await KumoStorage.ensurePermission(directoryHandle))) {
      throw new Error('保存目录权限已失效，请重新选择目录。');
    }

    if (directoryHandle && locationModeEl.value!=='downloads') {
      updateProgress(90, '正在写入本地知识库', `${files.length} 个文件`);
      const result = await KumoStorage.writeClip(directoryHandle, profile, folderName, files, targetedClip);
      const destination = profile.libraryPath === '.' ? `inbox/${folderName}` : `${profile.libraryPath}/inbox/${folderName}`;
      if (result.repaired) {
        setStatus(`${mediaOutcome.incomplete ? '已更新，媒体仍有缺失' : '已补全原有剪藏'}：${result.area}/${result.folderName}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : '已补全';
      } else if (result.duplicate) {
        setStatus(`${result.linksUpdated ? '已更新原文链接' : '这条内容已经存在'}：${result.area}/${result.folderName}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : result.linksUpdated ? '链接已更新' : '已存在';
      } else {
        setStatus(`${mediaOutcome.incomplete ? '已保存正文，媒体未完整' : `已保存给 ${profile.label}`}：${directoryHandle.name}/${destination}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
        saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : '已保存';
      }
    } else {
      updateProgress(90, '正在写入下载目录', `${files.length} 个文件`);
      for (const file of files) await KumoStorage.downloadFile(`Kumo-Inbox/${profile.id}/${folderName}/${file.name}`, file.content, file.type,{waitForCompletion:quickSilent});
      setStatus(`${mediaOutcome.incomplete ? '已保存正文，媒体未完整' : '已保存到下载内容'}：Kumo-Inbox/${profile.id}/${folderName}${mediaOutcome.detail ? `。${mediaOutcome.detail}` : ''}`, mediaOutcome.incomplete ? 'warning' : 'success');
      saveEl.textContent = mediaOutcome.incomplete ? '重试媒体' : '已保存';
    }
    finishProgress(!mediaOutcome.incomplete);
    targetEl.disabled = false;
    saveEl.disabled = !mediaOutcome.incomplete;
  } catch (error) {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    void revealQuick();
    if (error?.name === 'AbortError') setStatus('已取消保存。');
    else setStatus(error.message || String(error), 'error');
    saveEl.disabled = false;
    targetEl.disabled = false;
  } finally {
    noteEl.disabled = false;
  }
}

async function loadTarget() {
  const requestId=++targetEpoch,requestedTarget=targetEl.value;
  saveEl.disabled=true;directoryHandle=null;bridgeStatus=null;
  completeSaved = false;
  localStorage.setItem('kumo-target',requestedTarget);
  const savedMode=localStorage.getItem('kumo-location-'+requestedTarget);
  const [connection,handle]=await Promise.all([KumoBridge.status(),KumoStorage.getHandle(requestedTarget).catch(()=>null)]);
  if(requestId!==targetEpoch)return;
  bridgeStatus=connection;directoryHandle=handle;
  locationModeEl.value=KumoDestination.initialMode(savedMode,requestedTarget==='codex'?connection:null);
  refreshSelects.get(locationModeEl)?.();
  updateFolder(directoryHandle);
  const bridgeExpected=requestedTarget==='codex'&&locationModeEl.value==='auto';
  await KumoTags.load(usingBridge() && Boolean(bridgeStatus?.capabilities?.includes('library_browser')),{bridgeExpected}).catch(error => setStatus('标签暂时无法读取：'+error.message,'warning'));
  if (usingBridge()) {
    const result=await KumoBridge.library({limit:1}).catch(()=>null); if(result){const count=document.getElementById('saved-count');count.textContent=result.allTotal??result.total;count.hidden=false;}
  } else {
    document.getElementById('saved-count').hidden=true;
  }
  if(requestId!==targetEpoch)return;
  saveEl.disabled=!clip;saveEl.textContent=!usingBridge()&&!directoryHandle&&locationModeEl.value==='directory'?'选择文件夹并保存':'嚼一嚼';
  if(bridgeExpected&&!connection)setStatus('本地资料库未连接，原收藏和标签仍在。恢复服务后点击“我的收藏”刷新。','warning');
}
document.addEventListener('kumo-tags-error',event=>setStatus(event.detail,'error'));

const tagForm=document.getElementById('tag-form'), tagInput=document.getElementById('tag-input'), addTag=document.getElementById('add-tag');let committingTag=false;
function closeTag(){tagForm.hidden=true;addTag.hidden=false;tagInput.value='';}
async function commitTag(){if(committingTag||tagForm.hidden)return;if(!tagInput.value.trim()){closeTag();return;}committingTag=true;tagInput.disabled=true;try{await KumoTags.add(tagInput.value);closeTag();}catch(error){setStatus(error.message,'error');}finally{committingTag=false;tagInput.disabled=false;}}
tagForm.addEventListener('submit',event=>{event.preventDefault();void commitTag();});
tagInput.addEventListener('blur',()=>void commitTag());
addTag.onclick=()=>{addTag.hidden=true;tagForm.hidden=false;tagInput.focus();};
tagInput.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeTag();addTag.focus();}if(event.key==='Enter'&&event.isComposing)event.preventDefault();});
noteEl.addEventListener('input',()=>{document.getElementById('note-count').textContent=noteEl.value.length;});
document.getElementById('open-library').addEventListener('click', () => {
  // Side panel must be opened synchronously within the user's click gesture.
  void KumoPanel.open(activeWindowId,{onOpened:()=>window.close(),onUnavailable:message=>setStatus(message,'warning')});
});

changeFolderEl.addEventListener('click', chooseFolder);
saveEl.addEventListener('click', save);
document.getElementById('use-connected').onclick=()=>{targetEl.value='codex';localStorage.setItem('kumo-target','codex');localStorage.setItem('kumo-location-codex','auto');void loadTarget();};
locationModeEl.addEventListener('change',()=>{if(locationModeEl.value==='auto'){targetEl.value='codex';localStorage.setItem('kumo-target','codex');}localStorage.setItem('kumo-location-'+targetEl.value,locationModeEl.value);void loadTarget();});
for(const control of [screenshotEl,downloadImagesEl,downloadVideoEl,commentCountEl])control.addEventListener('change',()=>KumoDestination.saveOptions(localStorage,{screenshot:screenshotEl.checked,images:downloadImagesEl.checked,video:downloadVideoEl.checked,comments:Number(commentCountEl.value)}));
commentCountEl.addEventListener('change', updateSavePlan);
function annotationChanged() {
  if (clip && !noteEl.disabled && !progressTimer) { saveEl.disabled = false; saveEl.textContent = '嚼一嚼'; }
}
noteEl.addEventListener('input', annotationChanged);
document.addEventListener('kumo-annotation-change', annotationChanged);
const saveOptions=document.getElementById('save-options');
const refreshShortcuts=KumoShortcuts.mount();
settingsEntry.onclick=()=>{void refreshShortcuts();saveOptions.hidden=false;document.getElementById('settings-back').focus();};
document.getElementById('destination-open').onclick=settingsEntry.onclick;
document.getElementById('settings-back').onclick=()=>{saveOptions.hidden=true;settingsEntry.focus();};
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!saveOptions.hidden){saveOptions.hidden=true;settingsEntry.focus();}if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.isComposing&&saveOptions.hidden&&!saveEl.disabled){event.preventDefault();saveEl.click();}});
loadPage();
