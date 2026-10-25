(function (scope) {
  const DB_NAME = 'kumo-clipper';
  const STORE_NAME = 'handles';
  const ROOT_KEY_PREFIX = 'root-directory:';
  const SCHEMA_GUIDE = '# Kumo 内容包规范\n\n每条剪藏都是可独立理解和溯源的内容包。AI 先读 `source.md` 的内容清单与正文，需要视觉或视频证据时读取 `assets/`，核验时打开 `source_url`。`metadata.json` 保存稳定 ID、去重键、媒体状态与质量提示。评论、推荐、广告和导航不属于当前内容。\n';
  const PLATFORM_GUIDES = {
    'README.md': '# 平台内容说明\n\n各平台最终输出同一种内容包；本目录记录稳定标识、核心内容和主动排除项。\n',
    'xiaohongshu.md': '# 小红书内容结构\n\n稳定标识是 `/explore/{note_id}`。保存标题、作者、正文、话题、发布时间和图集/视频；排除评论、推荐流、头像与操作控件。\n',
    'x.md': '# X 内容结构\n\n稳定标识是帖子 ID。保存目标帖正文、作者、时间和媒体；排除回复列表、趋势与推荐帖子。\n',
    'douyin.md': '# 抖音内容结构\n\n稳定标识是视频或图文 ID。保存文案、作者、话题、封面及媒体；排除评论、推荐流和商品区。\n',
    'tiktok.md': '# TikTok 内容结构\n\n稳定标识是视频 ID。保存文案、作者、话题、封面及视频来源；排除评论和推荐流。\n',
    'bilibili.md': '# B站内容结构\n\n稳定标识是 BV 号。保存标题、UP 主、简介、封面和已展开字幕；评论、推荐与弹幕列表不属于当前内容。\n',
    'wechat.md': '# 微信公众号内容结构\n\n稳定标识由 `__biz + mid + idx` 组成。保存标题、作者、发布时间、连续正文与正文图片；排除推荐、留言、广告和关注引导。\n',
    'youtube.md': '# YouTube 内容结构\n\n稳定标识是视频 ID。保存标题、频道、简介、章节、封面和已展开字幕；排除评论、推荐与播放列表侧栏。\n',
    'generic.md': '# 通用网页内容结构\n\n使用具体内容页的规范 URL。保存标题、作者、时间、连续正文和主要媒体；首页、搜索页、评论、推荐、广告与导航不属于当前内容。\n'
  };

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getHandle(profileId = 'generic') {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(`${ROOT_KEY_PREFIX}${profileId}`);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function setHandle(profileId, handle) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(handle, `${ROOT_KEY_PREFIX}${profileId}`);
      transaction.oncomplete = () => resolve(handle);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async function pickDirectory(profileId = 'generic') {
    if (typeof window.showDirectoryPicker !== 'function') return null;
    const handle = await window.showDirectoryPicker({mode: 'readwrite', id: `kumo-${profileId}`});
    await setHandle(profileId, handle);
    return handle;
  }

  async function ensurePermission(handle) {
    if (!handle) return false;
    const options = {mode: 'readwrite'};
    if ((await handle.queryPermission(options)) === 'granted') return true;
    return (await handle.requestPermission(options)) === 'granted';
  }

  async function writeFile(directory, name, content, type) {
    const parts = String(name).split('/');
    if (!parts.length || parts.some(part => !part || part === '.' || part === '..' || /[\\:*?"<>|]/.test(part))) throw new Error('无效的素材文件名。');
    const fileName = parts.pop();
    const targetDirectory = await ensureDirectory(directory, parts);
    const fileHandle = await targetDirectory.getFileHandle(fileName, {create: true});
    const writable = await fileHandle.createWritable();
    await writable.write(content instanceof Blob ? content : new Blob([content], {type}));
    await writable.close();
  }

  async function ensureDirectory(root, parts) {
    let current = root;
    for (const part of parts) current = await current.getDirectoryHandle(part, {create: true});
    return current;
  }

  async function writeIfMissing(directory, name, content, type = 'text/markdown;charset=utf-8') {
    try {
      await directory.getFileHandle(name);
      return false;
    } catch (error) {
      if (error?.name !== 'NotFoundError') throw error;
      await writeFile(directory, name, content, type);
      return true;
    }
  }

  async function initializeLibrary(root, profile) {
    if (!(await ensurePermission(root))) throw new Error('没有获得保存目录的写入权限。');
    const library = await ensureDirectory(root, profile.libraryParts);
    await ensureDirectory(library, ['inbox']);
    await ensureDirectory(library, ['archive']);
    await ensureDirectory(library, ['domains']);
    await writeIfMissing(library, 'README.md', profile.libraryReadme);
    await writeIfMissing(library, 'LIBRARY.md', '# Kumo Library\n\n当前还没有已整理领域。新剪藏进入 `inbox/`，Agent 保持原始目录稳定，把派生理解放入 `domains/`，整理状态放入 `organization.json`。\n');
    await writeIfMissing(library, 'SCHEMA.md', SCHEMA_GUIDE);
    const platforms = await ensureDirectory(library, ['platforms']);
    for (const [name, content] of Object.entries(PLATFORM_GUIDES)) await writeIfMissing(platforms, name, content);
    const guideDirectory = profile.guideAtRoot ? root : library;
    await writeIfMissing(guideDirectory, 'KUMO.md', profile.guideContent);
    return library;
  }

  async function readMetadata(directory) {
    try {
      const handle = await directory.getFileHandle('metadata.json');
      return JSON.parse(await (await handle.getFile()).text());
    } catch {
      return null;
    }
  }

  function sourceKeyFromUrl(value) {
    try {
      const url = new URL(value);
      let match = url.pathname.match(/^\/(?:explore|discovery\/item)\/([a-z0-9]+)/i);
      if (/(^|\.)xiaohongshu\.com$/.test(url.hostname) && match) return `xiaohongshu:${match[1]}`;
      match = url.pathname.match(/^\/[^/]+\/status\/(\d+)/i);
      if (/(^|\.)(x|twitter)\.com$/.test(url.hostname) && match) return `x:${match[1]}`;
      match = url.pathname.match(/^\/(?:video|note)\/(\d+)/i);
      if (/(^|\.)douyin\.com$/.test(url.hostname) && match) return `douyin:${match[1]}`;
      match = url.pathname.match(/^\/@[^/]+\/video\/(\d+)/i);
      if (/(^|\.)tiktok\.com$/.test(url.hostname) && match) return `tiktok:${match[1]}`;
      match = url.pathname.match(/^\/video\/(BV[a-z0-9]+)/i);
      if (/(^|\.)bilibili\.com$/.test(url.hostname) && match) return `bilibili:${match[1]}`;
      const youtubeId = url.hostname === 'youtu.be' ? url.pathname.split('/').filter(Boolean)[0] : url.searchParams.get('v') || url.pathname.match(/^\/shorts\/([^/]+)/)?.[1];
      if (/(^|\.)(youtube\.com|youtu\.be)$/.test(url.hostname) && youtubeId) return `youtube:${youtubeId}`;
    } catch {}
    return '';
  }

  function safeComparableUrl(value) {
    try {
      const url = new URL(value);
      return !new Set(['/', '/explore', '/home', '/search', '/feed', '/foryou']).has(url.pathname.replace(/\/$/, '') || '/');
    } catch { return false; }
  }

  async function findExistingClip(library, clip) {
    for (const areaName of ['inbox', 'archive']) {
      const area = await library.getDirectoryHandle(areaName, {create: true});
      for await (const entry of area.values()) {
        if (entry.kind !== 'directory') continue;
        const metadata = await readMetadata(entry);
        if (!metadata) continue;
        const existingKey = metadata.dedupeKey || sourceKeyFromUrl(metadata.capturedUrl || metadata.url);
        const incomingKey = clip.dedupeKey || sourceKeyFromUrl(clip.capturedUrl || clip.url);
        const sameStableItem = incomingKey && existingKey && incomingKey === existingKey;
        const sameSafeUrl = clip.dedupeSafeUrl && safeComparableUrl(clip.url) && metadata.url === clip.url;
        const hashFallback = (!incomingKey || String(incomingKey).startsWith('hash:')) && metadata.contentHash === clip.contentHash;
        if (sameStableItem || sameSafeUrl || hashFallback) {
          return {area: areaName, folderName: entry.name, metadata};
        }
      }
    }
    return null;
  }

  async function writeClip(root, profile, folderName, files, clip) {
    const library = await initializeLibrary(root, profile);
    const existing = await findExistingClip(library, clip);
    const incomingFile = files.find(file => file.name === 'metadata.json');
    if (incomingFile) {
      const incoming = JSON.parse(typeof incomingFile.content === 'string' ? incomingFile.content : await incomingFile.content.text());
      const relative = existing ? `${existing.area}/${existing.folderName}` : `inbox/${folderName}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(relative));
      const id = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
      const directory = await ensureDirectory(library, ['annotations']);
      let ledger = {schema: 'kumo-annotations-v1', relativePath: relative, events: []};
      try { ledger = JSON.parse(await (await (await directory.getFileHandle(`${id}.json`)).getFile()).text()); } catch {}
      const append = metadata => {
        const note = String(metadata?.userNote ?? ''), userTags = metadata?.userTags || [];
        if (!note && !userTags.length) return;
        const last = ledger.events.at(-1);
        if (last?.note === note && JSON.stringify(last.userTags) === JSON.stringify(userTags)) return;
        ledger.events.push({id: crypto.randomUUID(), capturedAt: metadata.capturedAt, note, userTags});
      };
      if (!ledger.events.length && existing) append(existing.metadata);
      append(incoming);
      if (ledger.events.length) await writeFile(directory, `${id}.json`, JSON.stringify(ledger, null, 2), 'application/json');
    }
    if (existing) {
      const previous = existing.metadata || {};
      const incomingStats = clip.stats || {};
      const previousStats = previous.stats || {};
      const losesSavedMedia = ['downloadedImages', 'downloadedVideos'].some(key => Number(incomingStats[key] || 0) < Number(previousStats[key] || 0));
      const gainsMedia = ['images', 'downloadedImages', 'videos', 'downloadedVideos', 'foundGalleryMedia'].some(key => Number(incomingStats[key] || 0) > Number(previousStats[key] || 0));
      const parts = value => String(value || '0').split('.').map(part => Number(part) || 0);
      const currentVersion = parts(clip.extractorVersion);
      const previousVersion = parts(previous.extractorVersion);
      let newerExtractor = false;
      for (let index = 0; index < Math.max(currentVersion.length, previousVersion.length); index++) {
        if ((currentVersion[index] || 0) !== (previousVersion[index] || 0)) {
          newerExtractor = (currentVersion[index] || 0) > (previousVersion[index] || 0);
          break;
        }
      }
      if (losesSavedMedia || (!gainsMedia && !newerExtractor)) return {duplicate: true, ...existing};
      const area = await library.getDirectoryHandle(existing.area);
      const directory = await area.getDirectoryHandle(existing.folderName);
      for (const file of files) await writeFile(directory, file.name, file.content, file.type);
      return {duplicate: false, repaired: true, ...existing};
    }
    const inbox = await library.getDirectoryHandle('inbox', {create: true});
    const directory = await inbox.getDirectoryHandle(folderName, {create: true});
    for (const file of files) await writeFile(directory, file.name, file.content, file.type);
    return {duplicate: false, area: 'inbox', folderName};
  }

  async function downloadFile(path, content, type) {
    const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], {type}));
    try {
      await chrome.downloads.download({url, filename: path, saveAs: false, conflictAction: 'uniquify'});
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  }

  scope.KumoStorage = {getHandle, pickDirectory, ensurePermission, initializeLibrary, writeClip, downloadFile};
})(globalThis);
