(function (scope) {
  // Large videos are fine as long as data keeps arriving: the timer restarts on every chunk.
  async function fetchBlobWithProgress(url, timeoutMs, onProgress, fetchImpl = fetch, maxBytes = Infinity, {headers, signal} = {}) {
    const controller = new AbortController();
    let reader = null, stalled = false;
    const stall = () => { stalled = true; controller.abort(); reader?.cancel().catch(() => {}); };
    const cancel = () => { controller.abort(); reader?.cancel().catch(() => {}); };
    signal?.addEventListener('abort', cancel, {once: true});
    if (signal?.aborted) cancel();
    let timer = setTimeout(stall, timeoutMs);
    const touch = () => { clearTimeout(timer); timer = setTimeout(stall, timeoutMs); };
    try {
      const response = await fetchImpl(url, {credentials: 'include', signal: controller.signal, ...(headers ? {headers} : {})});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      touch();
      const expected = Number(response.headers.get('content-length') || 0);
      if (expected > maxBytes) throw new Error('video_too_large');
      if (!response.body?.getReader) {
        const blob = await response.blob();
        if (blob.size > maxBytes) throw new Error('video_too_large');
        onProgress?.(blob.size, expected || blob.size);
        return blob;
      }
      reader = response.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const {done, value} = await reader.read();
        if (stalled) throw new Error('video_download_stalled');
        if (done) break;
        touch();
        chunks.push(value);
        received += value.byteLength;
        if (received > maxBytes) {
          await reader.cancel();
          throw new Error('video_too_large');
        }
        onProgress?.(received, expected);
      }
      const blob = new Blob(chunks, {type: response.headers.get('content-type') || ''});
      blob.partial = response.status === 206;
      return blob;
    } catch (error) {
      controller.abort();
      if (reader) await reader.cancel().catch(() => {});
      if (stalled || error?.name === 'AbortError') throw new Error('video_download_stalled');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  async function fetchText(url, timeoutMs, fetchImpl, credentials = 'include') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {credentials, signal: controller.signal});
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
        if (url.hostname !== 'video.twimg.com' || !/\/(?:amplify_video|ext_tw_video|tweet_video)\//i.test(url.pathname) || /\/aud\//i.test(url.pathname)) continue;
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
    const normalized = String(text || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/&quot;/g, '"');
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

  const MAX_VIDEOS = 50;
  const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024;
  const IDLE_TIMEOUT = 60000;
  const remuxer = () => scope.KumoMp4 || (typeof require === 'function' ? require('./mp4-remux.js') : null);

  async function prepareVideos(sourceClip, {download = true, permission = true, resolveX, fetchImpl = fetch, onProgress, maxBytes = MAX_TOTAL_BYTES, maxVideoBytes = MAX_VIDEO_BYTES} = {}) {
    let videos = (sourceClip.videos || []).map(video => ({...video}));
    const diagnostics = [];
    if (download && permission && sourceClip.platformId === 'x' && resolveX && (!videos.length || videos.some(video => !['direct_file', 'stream_manifest'].includes(video.kind) || /\/vid\/avc1\/0\/0\/|\/init[.-]/i.test(video.url)))) {
      try {
        const ids = [...new Set(videos.map(posterMediaId).filter(Boolean))];
        const resolved = await resolveX(sourceClip.url, ids);
        diagnostics.push({stage: 'resolve', count: resolved.length});
        if (!resolved.length && videos.length) throw new Error('x_media_variant_not_found');
        const remaining = new Map(resolved.map(video => [video.mediaId, video]));
        // Preserve player order: caption videoIndex refers to the extracted list.
        videos = videos.map(original => {
          const match = remaining.get(posterMediaId(original)) || (resolved.length === 1 && videos.length === 1 && !posterMediaId(original) && original.kind === 'blob' ? resolved[0] : null);
          if (!match) return original;
          remaining.delete(match.mediaId);
          return {...original, ...match, origin: match.origin || 'x_public_page', downloadError: undefined, sourceResolutionError: undefined};
        });
        videos.push(...remaining.values());
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
      if (index >= MAX_VIDEOS) { video.downloadStatus = 'remote_only'; video.downloadError = 'video_count_limit'; continue; }
      const variants = videoVariants(video);
      video.attempts = [];
      for (const variant of variants) {
        try {
          const report = (received, expected) => onProgress?.({index, total: videos.length, received, expected});
          const budget = Math.min(maxVideoBytes, maxBytes - totalBytes);
          if (budget <= 0) throw new Error('video_too_large');
          let blob = await downloadVideoVariant(variant, {fetchImpl, onProgress: report, maxBytes: budget});
          if (blob.size > budget) throw new Error('video_too_large');
          blob = await validateVideoBlob(blob, variant.url);
          totalBytes += blob.size;
          const extension = blob.type === 'video/webm' ? 'webm' : blob.type === 'video/quicktime' ? 'mov' : 'mp4';
          Object.assign(video, {url: variant.url, kind: variant.kind, type: blob.type, localFile: `assets/video-${String(index + 1).padStart(2, '0')}.${extension}`, downloadStatus: 'saved', downloadError: undefined, bytes: blob.size});
          if (variant.audioUrl) video.audioUrl = variant.audioUrl;
          files.push({name: video.localFile, content: blob, type: blob.type});
          break;
        } catch (error) {
          video.attempts.push({kind: variant.kind, url: variant.url, error: error?.message || 'video_download_failed'});
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

  // Every http(s) source of a video is worth one attempt: the content decides how it is saved.
  function videoVariants(video) {
    const seen = new Set();
    return [video, ...(video.alternatives || [])].filter(item => {
      const key = `${item?.url}\n${item?.audioUrl || ''}`;
      if (!item || item.kind === 'unresolved' || item.kind === 'blob' || !/^https?:/i.test(item.url || '') || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function downloadVideoVariant(variant, {fetchImpl = fetch, onProgress, maxBytes = MAX_VIDEO_BYTES} = {}) {
    const mp4 = remuxer();
    if (variant.kind === 'dash_pair' && variant.audioUrl) {
      let received = 0;
      const part = (url, budget) => fetchBlobWithProgress(url, IDLE_TIMEOUT, value => onProgress?.(received + value, 0), fetchImpl, budget);
      const videoPart = await part(variant.url, maxBytes);
      received = videoPart.size;
      if (received >= maxBytes) throw new Error('video_too_large');
      const audioPart = await part(variant.audioUrl, maxBytes - received);
      if (!mp4) throw new Error('video_remuxer_unavailable');
      return mp4.fromFragmented([[videoPart], [audioPart]]);
    }
    if (variant.kind === 'stream_manifest' || /\.m3u8(?:$|[?#])/i.test(variant.url)) return downloadHls(variant.url, {fetchImpl, onProgress: p => onProgress?.(p.received, p.expected), maxBytes});
    const blob = await fetchBlobWithProgress(variant.url, IDLE_TIMEOUT, onProgress, fetchImpl, maxBytes);
    const format = mp4 ? await mp4.sniff(blob) : 'unknown';
    if (format === 'hls') return downloadHls(variant.url, {fetchImpl, onProgress: p => onProgress?.(p.received, p.expected), maxBytes, manifestText: await blob.text()});
    if (format === 'mpegts') return mp4.fromTransportStream([blob]);
    if (format === 'mp4' && await mp4.isFragmented(blob)) return mp4.fromFragmented([[blob]]);
    return blob;
  }

  // ---------- HLS ----------
  const attribute = (line, name) => line.match(new RegExp(`(?:^|[:,])${name}=("[^"]*"|[^,]*)`, 'i'))?.[1]?.replace(/^"|"$/g, '');
  function parseMasterPlaylist(text, baseUrl) {
    const lines = text.split(/\r?\n/), variants = [], audio = [];
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (line.startsWith('#EXT-X-MEDIA:') && /TYPE=AUDIO/i.test(line)) {
        const uri = attribute(line, 'URI');
        audio.push({group: attribute(line, 'GROUP-ID'), url: uri ? new URL(uri, baseUrl).href : '', isDefault: /DEFAULT=YES/i.test(line)});
      }
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const uri = lines.slice(index + 1).find(item => item.trim() && !item.trim().startsWith('#'));
        if (uri) variants.push({url: new URL(uri.trim(), baseUrl).href, bandwidth: Number(attribute(line, 'BANDWIDTH') || 0), codecs: attribute(line, 'CODECS') || '', audioGroup: attribute(line, 'AUDIO') || ''});
      }
    }
    // Prefer H.264 renditions: every Chromium build can play them; then the highest bitrate.
    const playable = codecs => !codecs || /avc1|avc3|mp4a/i.test(codecs) && !/hvc1|hev1|av01|dvh/i.test(codecs);
    variants.sort((a, b) => Number(playable(b.codecs)) - Number(playable(a.codecs)) || b.bandwidth - a.bandwidth);
    return {variants, audio};
  }

  function parseMediaPlaylist(text, baseUrl) {
    const lines = text.split(/\r?\n/).map(line => line.trim()), segments = [];
    let sequence = Number(text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1] || 0), key = null, map = null, nextRange = null, lastEnd = 0, discontinuity = false;
    const range = (value, previousEnd) => { const [length, offset] = String(value).split('@').map(Number); return {start: Number.isFinite(offset) ? offset : previousEnd, length}; };
    for (const line of lines) {
      if (line.startsWith('#EXT-X-KEY:')) {
        const method = (attribute(line, 'METHOD') || 'NONE').toUpperCase();
        if (method === 'NONE') key = null;
        else if (method === 'AES-128') key = {url: new URL(attribute(line, 'URI'), baseUrl).href, iv: attribute(line, 'IV') || ''};
        else throw new Error('encrypted_hls_not_supported');
      } else if (line.startsWith('#EXT-X-MAP:')) {
        const uri = attribute(line, 'URI'), byteRange = attribute(line, 'BYTERANGE');
        map = {url: new URL(uri, baseUrl).href, range: byteRange ? range(byteRange, 0) : null};
      } else if (line.startsWith('#EXT-X-BYTERANGE:')) {
        nextRange = line.slice(17);
      } else if (line.startsWith('#EXT-X-DISCONTINUITY') && !line.startsWith('#EXT-X-DISCONTINUITY-SEQUENCE')) {
        discontinuity = true;
      } else if (line && !line.startsWith('#')) {
        const url = new URL(line, baseUrl).href;
        const byteRange = nextRange ? range(nextRange, lastEnd) : null;
        if (byteRange) lastEnd = byteRange.start + byteRange.length;
        segments.push({url, range: byteRange, key, sequence, discontinuity});
        sequence++; nextRange = null; discontinuity = false;
      }
    }
    return {segments, map, ended: /#EXT-X-ENDLIST/.test(text)};
  }

  async function fetchPart(url, range, fetchImpl, onProgress, maxBytes, signal) {
    if (!range) return fetchBlobWithProgress(url, IDLE_TIMEOUT, onProgress, fetchImpl, maxBytes, {signal});
    const blob = await fetchBlobWithProgress(url, IDLE_TIMEOUT, onProgress, fetchImpl, maxBytes, {signal, headers: {Range: `bytes=${range.start}-${range.start + range.length - 1}`}});
    // A server that ignores Range returns the whole file; cut the requested piece out of it.
    const part = blob.partial || blob.size === range.length ? blob.slice(0, range.length) : blob.slice(range.start, range.start + range.length);
    if (part.size !== range.length) throw new Error('hls_truncated_range');
    return part;
  }

  async function decryptSegment(blob, segment, keys, fetchImpl, signal) {
    if (!segment.key) return blob;
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) throw new Error('hls_decryption_unavailable');
    if (!keys.has(segment.key.url)) keys.set(segment.key.url, fetchBlobWithProgress(segment.key.url, 20000, null, fetchImpl, 1024, {signal}).then(async blob => subtle.importKey('raw', await blob.arrayBuffer(), 'AES-CBC', false, ['decrypt'])));
    const key = await keys.get(segment.key.url);
    const iv = new Uint8Array(16);
    if (segment.key.iv) {
      const hex = segment.key.iv.replace(/^0x/i, '').padStart(32, '0');
      for (let index = 0; index < 16; index++) iv[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    } else new DataView(iv.buffer).setUint32(12, segment.sequence);
    return new Blob([await subtle.decrypt({name: 'AES-CBC', iv}, key, await blob.arrayBuffer())]);
  }

  async function downloadPlaylist(url, {fetchImpl, onProgress, maxBytes, state}) {
    const playlist = parseMediaPlaylist(await fetchText(url, 20000, fetchImpl), url);
    if (!playlist.ended) throw new Error('hls_live_stream_not_supported');
    if (!playlist.segments.length) throw new Error('hls_playlist_has_no_segments');
    const keys = new Map(), blobs = new Array(playlist.segments.length);
    const init = playlist.map ? await fetchPart(playlist.map.url, playlist.map.range, fetchImpl, null, maxBytes - state.done, state.controller.signal) : null;
    state.done += init?.size || 0;
    if (state.done > maxBytes) throw new Error('video_too_large');
    let next = 0;
    async function worker() {
      while (next < playlist.segments.length) {
        if (state.failed) throw new Error('hls_download_cancelled');
        const index = next++, segment = playlist.segments[index];
        let blob = await fetchPart(segment.url, segment.range, fetchImpl, received => {
          if (state.failed) throw new Error('hls_download_cancelled');
          state.receiving.set(`${url}#${index}`, received);
          if (state.done + [...state.receiving.values()].reduce((sum, value) => sum + value, 0) > maxBytes) throw new Error('video_too_large');
          state.report();
        }, maxBytes - state.done, state.controller.signal);
        blob = await decryptSegment(blob, segment, keys, fetchImpl, state.controller.signal);
        state.receiving.delete(`${url}#${index}`);
        state.done += blob.size;
        if (state.done > maxBytes) throw new Error('video_too_large');
        blobs[index] = blob;
        state.completed++;
        state.report();
      }
    }
    try { await Promise.all(Array.from({length: Math.min(4, playlist.segments.length)}, worker)); }
    catch (error) { state.failed = true; state.controller.abort(); throw error; }
    const format = init ? 'fmp4' : await remuxer().sniff(blobs[0]);
    return {format: format === 'mp4' ? 'fmp4' : format, parts: init ? [init, ...blobs] : blobs, discontinuities: playlist.segments.map((segment, index) => segment.discontinuity ? index : -1).filter(index => index >= 0)};
  }

  async function downloadHls(manifestUrl, {fetchImpl = fetch, onProgress, maxBytes = MAX_VIDEO_BYTES, manifestText} = {}) {
    const mp4 = remuxer();
    if (!mp4) throw new Error('video_remuxer_unavailable');
    const text = manifestText ?? await fetchText(manifestUrl, 20000, fetchImpl);
    let videoUrl = manifestUrl, audioUrl = '';
    if (text.includes('#EXT-X-STREAM-INF')) {
      const master = parseMasterPlaylist(text, manifestUrl);
      const selected = master.variants[0];
      if (!selected) throw new Error('hls_variant_not_found');
      videoUrl = selected.url;
      const group = master.audio.filter(item => item.group === selected.audioGroup && item.url);
      audioUrl = (group.find(item => item.isDefault) || group[0])?.url || '';
    }
    const state = {done: 0, completed: 0, controller: new AbortController(), receiving: new Map(), report() { onProgress?.({received: state.done + [...state.receiving.values()].reduce((sum, value) => sum + value, 0), expected: 0, completed: state.completed}); }};
    const options = {fetchImpl, onProgress, maxBytes, state};
    const video = videoUrl === manifestUrl && manifestText !== undefined
      ? await downloadPlaylistText(manifestUrl, text, options)
      : await downloadPlaylist(videoUrl, options);
    const audio = audioUrl ? await downloadPlaylist(audioUrl, options) : null;
    if (video.format === 'mpegts' && !audio) return mp4.fromTransportStream(video.parts, {discontinuities: video.discontinuities});
    if (video.format === 'fmp4' && (!audio || audio.format === 'fmp4')) return mp4.fromFragmented(audio ? [video.parts, audio.parts] : [video.parts]);
    if (audio) throw new Error('hls_external_audio_not_supported');
    throw new Error('hls_segment_format_not_supported');
  }
  async function downloadPlaylistText(url, text, options) {
    const fetchImpl = async (target, init) => target === url ? new Response(text, {status: 200}) : options.fetchImpl(target, init);
    return downloadPlaylist(url, {...options, fetchImpl});
  }
  // Kept for callers of the previous API.
  const downloadHlsFmp4 = (manifestUrl, onProgress, fetchImpl = fetch) => downloadHls(manifestUrl, {fetchImpl, onProgress});

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

  // The player may receive its variants after the HTML shell was delivered.
  // Read only the requested public post's own media, never quotes/recommendations.
  function findXSyndicationVideoVariants(text, sourceId, targetMediaIds = []) {
    if (!/^\d{1,25}$/.test(String(sourceId))) throw new Error('invalid_x_status_id');
    if (String(text).length > 2 * 1024 * 1024) throw new Error('x_embed_response_too_large');
    const data = JSON.parse(text);
    if (String(data?.id_str || '') !== String(sourceId)) throw new Error('x_embed_status_mismatch');
    const items = (Array.isArray(data.mediaDetails) ? data.mediaDetails : []).filter(item => {
      if (!['video', 'animated_gif'].includes(item?.type)) return false;
      const owner = String(item.expanded_url || '').match(/\/status\/(\d+)(?:\/|$)/)?.[1];
      return !owner || owner === String(sourceId);
    }).map(item => ({poster: item.media_url_https, variants: item.video_info?.variants || []}));
    if (!items.length && data.video && (!data.video.videoId?.id || String(data.video.videoId.id) === String(sourceId))) {
      items.push({poster: data.video.poster, variants: data.video.variants || []});
    }
    const allowed = new Set(targetMediaIds.map(String).filter(Boolean));
    const found = new Map();
    for (const item of items) {
      const posterId = posterMediaId(item);
      if (allowed.size && posterId && !allowed.has(posterId)) continue;
      const ids = allowed.size ? [...allowed] : posterId ? [posterId] : [];
      for (const variant of findXVideoVariants(JSON.stringify(item.variants), ids)) {
        if (!found.has(variant.mediaId)) found.set(variant.mediaId, {...variant, poster: item.poster || '', origin: 'x_syndication'});
      }
    }
    return [...found.values()];
  }

  async function resolveXVideoFromSyndication(pageUrl, targetMediaIds = [], fetchImpl = fetch) {
    const page = new URL(pageUrl);
    const id = page.pathname.match(/^\/[^/]+\/status\/(\d{1,25})(?:\/|$)/)?.[1];
    if (page.protocol !== 'https:' || !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(page.hostname) || !id || page.username || page.password || page.port) throw new Error('invalid_x_status_url');
    const endpoint = new URL('https://cdn.syndication.twimg.com/tweet-result');
    endpoint.searchParams.set('id', id);
    endpoint.searchParams.set('lang', 'en');
    endpoint.searchParams.set('token', '0');
    const text = await fetchText(endpoint.href, 10000, fetchImpl, 'omit');
    return findXSyndicationVideoVariants(text, id, targetMediaIds);
  }


  // Scope Referer to one exact media URL, and serialize competing requests across
  // popup/offscreen contexts. Release after headers: the body can keep streaming.
  function createPageMediaFetch(target, {fetchImpl = fetch, api = scope.chrome, locks = scope.navigator?.locks} = {}) {
    let page;
    try { page = new URL(target.capturedUrl || target.url); } catch { return fetchImpl; }
    if (!/^https?:$/.test(page.protocol) || page.username || page.password || !api?.declarativeNetRequest?.updateSessionRules || !api.runtime?.id || !locks?.request) return fetchImpl;
    page.search = ''; page.hash = '';
    return async (input, init = {}) => {
      const address = new URL(typeof input === 'string' ? input : input.url || input.href);
      if (!/^https?:$/.test(address.protocol) || page.protocol === 'https:' && address.protocol === 'http:') return fetchImpl(input, init);
      let hash = 2166136261;
      for (const character of address.href) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
      const id = 100000000 + (hash >>> 0) % 1000000000;
      const condition = {regexFilter: '^' + address.href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', isUrlFilterCaseSensitive: true, initiatorDomains: [api.runtime.id], resourceTypes: ['xmlhttprequest', 'media', 'other']};
      return locks.request('kumo-media-referer:' + id, {...(init.signal ? {signal: init.signal} : {})}, async () => {
        try { await api.declarativeNetRequest.updateSessionRules({removeRuleIds: [id], addRules: [{id, priority: 1, action: {type: 'modifyHeaders', requestHeaders: [{header: 'referer', operation: 'set', value: page.href}]}, condition}]}); }
        catch { return fetchImpl(input, init); }
        try { return await fetchImpl(input, init); }
        finally { await api.declarativeNetRequest.updateSessionRules({removeRuleIds: [id]}).catch(() => {}); }
      });
    };
  }

  const api = {fetchBlobWithProgress, downloadHls, downloadHlsFmp4, downloadVideoVariant, parseMasterPlaylist, parseMediaPlaylist, findXVideoVariants, findXPostMedia, prepareVideos, resolveXVideoVariants, findXSyndicationVideoVariants, resolveXVideoFromSyndication, validateVideoBlob, createPageMediaFetch, MAX_VIDEOS};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else scope.KumoMedia = api;
})(globalThis);
