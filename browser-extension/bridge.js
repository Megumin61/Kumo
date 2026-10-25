(function (scope) {
  const ORIGIN = typeof location !== 'undefined' && location.protocol === 'http:' && location.hostname === '127.0.0.1' ? location.origin : 'http://127.0.0.1:43789';

  async function request(path, options = {}, timeout = 900) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(`${ORIGIN}${path}`, {...options, signal: controller.signal});
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Kumo bridge returned ${response.status}`);
      return body;
    } finally {
      clearTimeout(timer);
    }
  }

  async function status() {
    try {
      return await request('/status', {}, 3000);
    } catch {
      return null;
    }
  }

  async function encodeFile(file) {
    if (file.content instanceof Blob) {
      const bytes = new Uint8Array(await file.content.arrayBuffer());
      let binary = '';
      const chunkSize = 0x8000;
      for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
      }
      return {name: file.name, type: file.type, encoding: 'base64', content: btoa(binary)};
    }
    return {name: file.name, type: file.type, encoding: 'utf8', content: String(file.content)};
  }

  async function save(folderName, files, clip) {
    try {
      return await request('/clips', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({schema: 'kumo-bridge-save-v1', folderName, clip: {url: clip.url, capturedUrl: clip.capturedUrl, contentHash: clip.contentHash, dedupeKey: clip.dedupeKey, dedupeSafeUrl: clip.dedupeSafeUrl}, files: await Promise.all(files.map(encodeFile))})
      }, 180000);
    } catch (error) {
      if (error?.message === 'invalid_files') throw new Error('Kumo 本地桥接版本过旧，尚不支持图片素材目录。请重启本地桥接后再保存。');
      throw error;
    }
  }

  async function annotate(clip, note, userTags) {
    return request('/annotations', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({clip: {url: clip.url, contentHash: clip.contentHash, dedupeKey: clip.dedupeKey, dedupeSafeUrl: clip.dedupeSafeUrl}, note, userTags})}, 10000);
  }

  async function resolveX(url, mediaIds) {
    const result = await request('/x/resolve', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({url, mediaIds})
    }, 30000);
    return result.videos || [];
  }

  function fetchXMedia(url, options) {
    return fetch(`${ORIGIN}/x/media?url=${encodeURIComponent(url)}`, options);
  }

  async function startVideoJob(folderName, clip, files, note = '', downloadImages = true) {
    return request('/x/jobs', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({schema: 'kumo-x-job-v1', folderName, clip, note, downloadImages, files: await Promise.all(files.map(encodeFile))})
    }, 30000);
  }

  const videoJob = id => request(`/x/jobs/${encodeURIComponent(id)}`, {}, 5000);

  const library = filters => request(`/library?${new URLSearchParams(filters || {})}`, {}, 10000);
  const item = id => request(`/library/items/${encodeURIComponent(id)}`, {}, 10000);
  const asset = (id, name) => `${ORIGIN}/library/items/${encodeURIComponent(id)}/${name}`;
  const tags = () => request('/tags', {}, 5000);
  const updateTag = input => request('/tags', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)}, 5000);
  const setCollection = (clip, collectionId) => request('/annotations', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({clip, kind:'collection', collectionId})},10000);
  const knowledge=()=>request('/knowledge',{},30000);
  const knowledgeFocus=options=>request('/knowledge/focus?'+new URLSearchParams(options||{}),{},30000);
  const knowledgeAtlas=()=>request('/knowledge/atlas',{},30000);
  scope.KumoBridge = {status, save, annotate, setCollection, resolveX, fetchXMedia, startVideoJob, videoJob, library, item, asset, tags, updateTag,knowledge,knowledgeFocus,knowledgeAtlas};
})(globalThis);
