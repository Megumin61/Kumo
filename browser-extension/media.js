(function (scope) {
  async function fetchBlobWithProgress(url, timeoutMs, onProgress, fetchImpl = fetch, maxBytes = Infinity) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {credentials: 'include', signal: controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const expected = Number(response.headers.get('content-length') || 0);
      if (expected > maxBytes) throw new Error('media_too_large');
      if (!response.body?.getReader) {
        const blob = await response.blob();
        if (blob.size > maxBytes) throw new Error('media_too_large');
        onProgress?.(blob.size, expected || blob.size);
        return blob;
      }
      const reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new Error('media_too_large');
        }
        onProgress?.(received, expected);
      }
      return new Blob(chunks, {type: response.headers.get('content-type') || ''});
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(url, timeoutMs, fetchImpl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {credentials: 'include', signal: controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  function findXVideoVariants(text, targetMediaIds = []) {
    const allowed = new Set(targetMediaIds.map(String).filter(Boolean));
    const candidates = [];
    const normalized = String(text || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&');
    const matches = normalized.match(/https?:\/\/[^"'\s\\<>]{1,2400}?\.(?:mp4|m3u8)(?:[^"'\s\\<>]{0,800})?/gi) || [];
    for (const raw of matches) {
      const decoded = raw.replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\u0026/gi, '&').replace(/&amp;/g, '&').replace(/\\+$/g, '');
      try {
        const url = new URL(decoded);
        if (url.hostname !== 'video.twimg.com' || !/\/(?:amplify_video|ext_tw_video|tweet_video)\//i.test(url.pathname)) continue;
        const mediaId = url.pathname.match(/\/(?:amplify_video|ext_tw_video)\/(\d+)/i)?.[1] || url.pathname.match(/\/tweet_video\/([a-z0-9_-]+)\.mp4$/i)?.[1];
        if (!mediaId || (allowed.size && !allowed.has(mediaId))) continue;
        const resolution = url.pathname.match(/\/(\d{2,4})x(\d{2,4})\//i);
        const direct = /\.mp4$/i.test(url.pathname);
        // X's DASH init.mp4 contains only MP4 metadata, not a playable video.
        if (direct && (/(?:^|\/)init(?:[-_.]|$)/i.test(url.pathname) || /\/vid\/avc1\/0\/0\//i.test(url.pathname))) continue;
        if (!direct && !/\.m3u8$/i.test(url.pathname)) continue;
        const score = direct ? 1000000 + (resolution ? Number(resolution[1]) * Number(resolution[2]) : 1) : 1;
        candidates.push({url: url.href, mediaId, score, kind: direct ? 'direct_file' : 'stream_manifest', type: direct ? 'video/mp4' : 'application/x-mpegURL'});
      } catch {}
    }
    const byMedia = new Map();
    for (const candidate of candidates) {
      const items = byMedia.get(candidate.mediaId) || [];
      if (!items.some(item => item.url === candidate.url)) items.push(candidate);
      byMedia.set(candidate.mediaId, items);
    }
    return [...byMedia.values()].map(items => {
      items.sort((a, b) => Number(b.kind === 'direct_file') - Number(a.kind === 'direct_file') || b.score - a.score);
      return {...items[0], alternatives: items.slice(1)};
    });
  }

  function findXPostMedia(text, sourceId) {
    if (!/^\d{1,25}$/.test(String(sourceId))) throw new Error('invalid_x_status_id');
    const normalized = String(text || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/&quot;/g, '"');
    const matches = [...normalized.matchAll(/(?:"?expanded_url"?)\s*:\s*"(https:\/\/(?:x|twitter)\.com\/[^"\s]+\/status\/(\d+)\/(?:video|photo)\/(\d+))"/g)];
    const media = [];
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      if (match[2] !== String(sourceId)) continue;
      const end = Math.min(match.index + 2200, matches[index + 1]?.index || Infinity);
      const section = normalized.slice(match.index, end);
      const url = section.match(/(?:"?media_url_https"?)\s*:\s*"(https:\/\/pbs\.twimg\.com\/[^"\s]+)"/)?.[1];
      if (!url) continue;
      const mediaId = url.match(/\/(?:amplify_video_thumb|ext_tw_video_thumb)\/(\d+)/)?.[1] || url.match(/\/tweet_video_thumb\/([a-z0-9_-]+)\./i)?.[1];
      if (!media.some(item => item.url === url)) media.push({url, mediaId: mediaId || '', order: Number(match[3]), kind: mediaId ? 'video' : 'image'});
    }
    return media.sort((a, b) => a.order - b.order);
  }

  const posterMediaId = video => video.mediaId || String(video.poster || '').match(/\/(?:amplify_video_thumb|ext_tw_video_thumb)\/(\d+)/i)?.[1] || String(video.poster || '').match(/\/tweet_video_thumb\/([a-z0-9_-]+)\./i)?.[1] || '';

  async function prepareVideos(sourceClip, {download = true, permission = true, resolveX, fetchImpl = fetch, onProgress, maxBytes = 80 * 1024 * 1024} = {}) {
    let videos = (sourceClip.videos || []).slice(0, 4).map(video => ({...video}));
    const diagnostics = [];
    if (download && permission && sourceClip.platformId === 'x' && resolveX && (!videos.length || videos.some(video => !['direct_file', 'stream_manifest'].includes(video.kind) || /\/vid\/avc1\/0\/0\/|\/init[.-]/i.test(video.url)))) {
      try {
        const ids = [...new Set(videos.map(posterMediaId).filter(Boolean))];
        const resolved = await resolveX(sourceClip.url, ids);
        diagnostics.push({stage: 'resolve', count: resolved.length});
        if (!resolved.length && videos.length) throw new Error('x_media_variant_not_found');
        const originalById = new Map(videos.map(video => [posterMediaId(video), video]));
        const resolvedIds = new Set(resolved.map(video => video.mediaId));
        videos = videos.filter(video => !resolvedIds.has(posterMediaId(video)) && !(resolved.length === 1 && !posterMediaId(video) && video.kind === 'blob'));
        videos.push(...resolved.map(video => ({...(originalById.get(video.mediaId) || {}), ...video, origin: video.origin || 'x_public_page', downloadError: undefined, sourceResolutionError: undefined})));
      } catch (error) {
        diagnostics.push({stage: 'resolve', error: error?.message || 'x_resolution_failed'});
        videos.forEach(video => { video.sourceResolutionError = error?.message || 'x_resolution_failed'; });
      }
    }
    const files = [];
    let totalBytes = 0;
    for (let index = 0; index < videos.length; index++) {
      const video = videos[index];
      if (!download) { video.downloadStatus = 'reference_only'; video.downloadError = 'user_selected_video_reference'; continue; }
      if (!permission) { video.downloadStatus = 'remote_only'; video.downloadError = 'media_download_permission_denied'; continue; }
      const variants = [video, ...(video.alternatives || [])].filter(item => ['direct_file', 'stream_manifest'].includes(item.kind) && /^https?:/i.test(item.url));
      video.attempts = [];
      for (const variant of variants) {
        try {
          const report = (received, expected) => onProgress?.({index, total: videos.length, received, expected});
          let blob = variant.kind === 'stream_manifest'
            ? await downloadHlsFmp4(variant.url, p => report(p.received, p.expected), fetchImpl)
            : await fetchBlobWithProgress(variant.url, 45000, report, fetchImpl, maxBytes - totalBytes);
          if (totalBytes + blob.size > maxBytes) throw new Error('video_too_large');
          blob = await validateVideoBlob(blob, variant.url);
          totalBytes += blob.size;
          const extension = blob.type === 'video/webm' ? 'webm' : blob.type === 'video/quicktime' ? 'mov' : 'mp4';
          Object.assign(video, {url: variant.url, kind: variant.kind, type: blob.type, localFile: `assets/video-${String(index + 1).padStart(2, '0')}.${extension}`, downloadStatus: 'saved', downloadError: undefined, bytes: blob.size});
          files.push({name: video.localFile, content: blob, type: blob.type});
          break;
        } catch (error) {
          video.attempts.push({kind: variant.kind, error: error?.message || 'video_download_failed'});
        }
      }
      if (!video.localFile) {
        video.downloadStatus = 'remote_only';
        video.downloadError = video.attempts.at(-1)?.error || video.sourceResolutionError || 'no_downloadable_video_source';
      }
    }
    const downloadedVideos = videos.filter(video => video.localFile).length;
    const warnings = (sourceClip.warnings || []).filter(warning => !/^videos_not_fully_downloaded:|^media_download_pending$/.test(warning));
    if (download && downloadedVideos < videos.length) warnings.push(`videos_not_fully_downloaded:${downloadedVideos}/${videos.length}`);
    if (download && sourceClip.platformId === 'x' && !videos.length && diagnostics.some(item => item.error)) warnings.push('x_video_discovery_failed');
    return {clip: {...sourceClip, videos, videoDiagnostics: diagnostics, stats: {...sourceClip.stats, videos: videos.length, downloadedVideos}, warnings}, files};
  }

  async function validateVideoBlob(blob, url = '') {
    if (!blob || blob.size < 2048) throw new Error('video_is_only_an_initialization_fragment');
    const type = String(blob.type || '').toLowerCase();
    if (type && !type.startsWith('video/') && type !== 'application/octet-stream') throw new Error('response_is_not_video');
    const signature = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
    const firstBox = String.fromCharCode(...signature.slice(4, 8));
    const ebml = signature[0] === 0x1a && signature[1] === 0x45 && signature[2] === 0xdf && signature[3] === 0xa3;
    if (ebml) return type === 'video/webm' ? blob : new Blob([blob], {type: 'video/webm'});
    if (!['ftyp', 'moov', 'mdat', 'wide'].includes(firstBox)) throw new Error('unsupported_or_invalid_video_format');
    let offset = 0;
    let hasFtyp = false;
    let hasMoov = false;
    let hasMedia = false;
    while (offset + 8 <= blob.size) {
      const header = new DataView(await blob.slice(offset, Math.min(offset + 16, blob.size)).arrayBuffer());
      let size = header.getUint32(0);
      const box = String.fromCharCode(...new Uint8Array(header.buffer, 4, 4));
      if (size === 1) {
        if (header.byteLength < 16) break;
        size = Number(header.getBigUint64(8));
      } else if (size === 0) size = blob.size - offset;
      if (!Number.isSafeInteger(size) || size < 8 || offset + size > blob.size) break;
      if (box === 'ftyp') hasFtyp = true;
      if (box === 'moov') hasMoov = true;
      if (box === 'mdat' && size > 8) hasMedia = true;
      offset += size;
    }
    if ((hasFtyp || type === 'video/quicktime') && hasMoov && hasMedia && offset === blob.size) return type === 'application/octet-stream' || !type ? new Blob([blob], {type: 'video/mp4'}) : blob;
    throw new Error('video_has_no_playable_media_data');
  }

  async function resolveXVideoVariants(pageUrl, targetMediaIds, fetchImpl = fetch) {
    const html = await fetchText(pageUrl, 10000, fetchImpl);
    return findXVideoVariants(html, targetMediaIds);
  }

  async function downloadHlsFmp4(manifestUrl, onProgress, fetchImpl = fetch) {
    let playlistUrl = manifestUrl;
    let playlist = await fetchText(playlistUrl, 15000, fetchImpl);
    if (playlist.includes('#EXT-X-STREAM-INF')) {
      if (/#EXT-X-MEDIA:.*TYPE=AUDIO.*URI=/i.test(playlist)) throw new Error('hls_external_audio_not_supported');
      const lines = playlist.split(/\r?\n/);
      const variants = [];
      for (let index = 0; index < lines.length; index++) {
        if (!lines[index].startsWith('#EXT-X-STREAM-INF')) continue;
        const bandwidth = Number(lines[index].match(/BANDWIDTH=(\d+)/i)?.[1] || 0);
        const uri = lines.slice(index + 1).find(line => line.trim() && !line.startsWith('#'));
        if (uri) variants.push({url: new URL(uri.trim(), playlistUrl).href, bandwidth});
      }
      const selected = variants.sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (!selected) throw new Error('hls_variant_not_found');
      playlistUrl = selected.url;
      playlist = await fetchText(playlistUrl, 15000, fetchImpl);
    }
    if (/#EXT-X-KEY:.*METHOD=(?!NONE)/i.test(playlist)) throw new Error('encrypted_hls_not_supported');
    if (!playlist.includes('#EXT-X-ENDLIST')) throw new Error('hls_live_stream_not_supported');
    if (playlist.includes('#EXT-X-BYTERANGE')) throw new Error('hls_byte_range_not_supported');
    const mapUri = playlist.match(/#EXT-X-MAP:.*URI="([^"]+)"/i)?.[1];
    const segmentUris = playlist.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));
    if (!mapUri || !segmentUris.length || segmentUris.length > 240) throw new Error('hls_fmp4_playlist_not_supported');
    const urls = [new URL(mapUri, playlistUrl).href, ...segmentUris.map(uri => new URL(uri, playlistUrl).href)];
    const blobs = new Array(urls.length);
    const receivedByIndex = new Map();
    const expectedByIndex = new Map();
    let nextIndex = 0;
    let completed = 0;
    let totalBytes = 0;
    async function worker() {
      while (nextIndex < urls.length) {
        const index = nextIndex++;
        const blob = await fetchBlobWithProgress(urls[index], 30000, (received, expected) => {
          receivedByIndex.set(index, received);
          if (expected) expectedByIndex.set(index, expected);
          onProgress?.({received: [...receivedByIndex.values()].reduce((sum, value) => sum + value, 0), expected: [...expectedByIndex.values()].reduce((sum, value) => sum + value, 0), completed, total: urls.length});
        }, fetchImpl);
        totalBytes += blob.size;
        if (totalBytes > 80 * 1024 * 1024) throw new Error('video_too_large');
        blobs[index] = blob;
        completed += 1;
        onProgress?.({received: [...receivedByIndex.values()].reduce((sum, value) => sum + value, 0), expected: [...expectedByIndex.values()].reduce((sum, value) => sum + value, 0), completed, total: urls.length});
      }
    }
    await Promise.all(Array.from({length: Math.min(4, urls.length)}, worker));
    return new Blob(blobs, {type: 'video/mp4'});
  }

  const api = {fetchBlobWithProgress, downloadHlsFmp4, findXVideoVariants, findXPostMedia, prepareVideos, resolveXVideoVariants, validateVideoBlob};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.KumoMedia = api;
})(globalThis);
