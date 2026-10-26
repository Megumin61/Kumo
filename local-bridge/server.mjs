import http from 'node:http';
import {constants} from 'node:fs';
import {copyFile, mkdir, readFile, readdir, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicGet, checkRemoteUrl} from './remote.mjs';
import Media from '../browser-extension/media.js';
import Format from '../browser-extension/format.js';
import SourceLinks from '../browser-extension/source-links.js';
import {randomUUID} from 'node:crypto';
import {createLibrary} from './library.mjs';
import {createEvidenceLibrary} from '../plugins/kumo/src/mcp/library.mjs';
import {sourceSnapshot} from '../plugins/kumo/src/mcp/snapshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PORT = 43789;
const API_VERSION = 7;
const TEMPLATE_ROOT = path.resolve(HERE, '..', 'knowledge');
const LIBRARY_GUIDES = [
  'README.md', 'LIBRARY.md', 'SCHEMA.md', 'ORGANIZATION.md', 'platforms/README.md', 'platforms/xiaohongshu.md', 'platforms/x.md',
  'platforms/douyin.md', 'platforms/tiktok.md', 'platforms/bilibili.md', 'platforms/wechat.md',
  'platforms/youtube.md', 'platforms/generic.md'
];
const ALLOWED_FILES = new Set(['source.md', 'metadata.json', 'readable.html', 'viewport.png']);
const ALLOWED_ASSET = /^assets\/(?:image|frame)-\d{2}\.(?:jpg|jpeg|png|webp|gif|avif|img)$/i;
const ALLOWED_VIDEO = /^assets\/video-\d{2}\.(?:mp4|webm|mov|m4v)$/i;

function response(res, status, body, origin = '') {
  if (/^chrome-extension:\/\/[a-z]+$/i.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

function allowedOrigin(req) {
  const origin = req.headers.origin || '';
  return !origin || /^chrome-extension:\/\/[a-z]+$/i.test(origin) || origin === `http://127.0.0.1:${req.socket.localPort}`;
}

async function readJson(file) {
  try {
    return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
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

async function findExisting(libraryRoot, clip) {
  for (const area of ['inbox', 'archive']) {
    const directory = path.join(libraryRoot, area);
    const entries = await readdir(directory, {withFileTypes: true}).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metadata = await readJson(path.join(directory, entry.name, 'metadata.json'));
      if (!metadata) continue;
      const existingKey = metadata.dedupeKey || sourceKeyFromUrl(metadata.capturedUrl || metadata.url);
      const incomingKey = clip.dedupeKey || sourceKeyFromUrl(clip.capturedUrl || clip.url);
      const sameStableItem = incomingKey && existingKey && incomingKey === existingKey;
      const sameSafeUrl = clip.dedupeSafeUrl && safeComparableUrl(clip.url) && metadata.url === clip.url;
      const hashFallback = (!incomingKey || String(incomingKey).startsWith('hash:')) && metadata.contentHash === clip.contentHash;
      if (sameStableItem || sameSafeUrl || hashFallback) {
        return {area, folderName: entry.name, relativePath: `${area}/${entry.name}`, metadata};
      }
    }
  }
  return null;
}

function validFolderName(value) {
  return typeof value === 'string' && value.length > 5 && value.length <= 180 && !/[<>:"/\\|?*\x00-\x1f]/.test(value) && value !== '.' && value !== '..';
}

async function readBody(req, limit = 190 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('payload_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function ensureLibrary(libraryRoot) {
  for (const name of ['inbox', 'archive', 'domains']) await mkdir(path.join(libraryRoot, name), {recursive: true});
  for (const relative of LIBRARY_GUIDES) {
    const destination = path.join(libraryRoot, ...relative.split('/'));
    await mkdir(path.dirname(destination), {recursive: true});
    await copyFile(path.join(TEMPLATE_ROOT, ...relative.split('/')), destination, constants.COPYFILE_EXCL).catch(error => {
      if (!['ENOENT', 'EEXIST'].includes(error?.code)) throw error;
    });
  }
}

async function saveClip(libraryRoot, payload, library) {
  if (payload?.schema !== 'kumo-bridge-save-v1' || !validFolderName(payload.folderName) || !payload.clip?.url || !Array.isArray(payload.files)) {
    throw new Error('invalid_payload');
  }
  if (!payload.files.length || payload.files.some(file => !(ALLOWED_FILES.has(file.name) || ALLOWED_ASSET.test(file.name) || ALLOWED_VIDEO.test(file.name)) || !['utf8', 'base64'].includes(file.encoding))) {
    throw new Error('invalid_files');
  }
  const names = new Set(payload.files.map(file => file.name));
  if (!names.has('source.md') || !names.has('metadata.json')) throw new Error('missing_required_files');
  await ensureLibrary(libraryRoot);
  const existing = await findExisting(libraryRoot, payload.clip);
  const annotationMetadata = payload.files.find(file => file.name === 'metadata.json');
  if (library && annotationMetadata?.encoding === 'utf8') {
    if (existing?.metadata?.userNote || existing?.metadata?.userTags?.length) await library.annotate(existing.relativePath, existing.metadata, true);
    await library.annotate(existing?.relativePath || `inbox/${payload.folderName}`, JSON.parse(annotationMetadata.content));
  }
  if (existing) {
    const incomingFile = payload.files.find(file => file.name === 'metadata.json');
    const incoming = incomingFile?.encoding === 'utf8' ? JSON.parse(incomingFile.content) : null;
    const previousStats = {...(existing.metadata?.stats || {})};
    let accessLinkUpdated=false;
    if(incoming){
      const merged=SourceLinks.preserveAccess(incoming,existing.metadata);
      if(merged.accessUrl)incomingFile.content=JSON.stringify(merged,null,2);
      for(const file of payload.files)if(['source.md','readable.html'].includes(file.name)&&file.encoding==='utf8')file.content=SourceLinks.rewriteGeneratedLinks(file.name,file.content,merged);
      const newAccess=SourceLinks.hasAccessUrl(incoming)&&SourceLinks.sourceUrl(incoming)!==SourceLinks.sourceUrl(existing.metadata);
      accessLinkUpdated=newAccess;
      if(newAccess)await writeFile(path.join(libraryRoot,existing.area,existing.folderName,'metadata.json'),JSON.stringify({...existing.metadata,accessUrl:SourceLinks.sourceUrl(incoming)},null,2),'utf8');
    }
    const recordedVideos = (existing.metadata?.videos || []).filter(video => video.localFile && ALLOWED_VIDEO.test(video.localFile));
    if (recordedVideos.length) {
      const sizes = await Promise.all(recordedVideos.map(async video => {
        const file = path.join(libraryRoot, existing.area, existing.folderName, ...video.localFile.split('/'));
        return (await stat(file).catch(() => null))?.size || 0;
      }));
      // Old X captures could save a DASH init fragment as a complete MP4.
      previousStats.downloadedVideos = sizes.filter(size => size >= 2048).length;
    }
    const incomingStats = incoming?.stats || {};
    const mediaCounts = ['downloadedImages', 'downloadedVideos'];
    const losesSavedMedia = mediaCounts.some(key => Number(incomingStats[key] || 0) < Number(previousStats[key] || 0));
    const moreComplete = !losesSavedMedia && ['images', 'downloadedImages', 'videos', 'downloadedVideos', 'foundGalleryMedia']
      .some(key => Number(incomingStats[key] || 0) > Number(previousStats[key] || 0));
    const versionParts = value => String(value || '0').split('.').map(part => Number(part) || 0);
    const compareVersions = (left, right) => {
      const a = versionParts(left);
      const b = versionParts(right);
      for (let index = 0; index < Math.max(a.length, b.length); index++) {
        if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
      }
      return 0;
    };
    const newerExtractor = !losesSavedMedia && compareVersions(incoming?.extractorVersion, existing.metadata?.extractorVersion) > 0;
    const settlesPending = !losesSavedMedia && existing.metadata?.warnings?.includes('media_download_pending') && !incoming?.warnings?.includes('media_download_pending');
    if (!moreComplete && !newerExtractor && !settlesPending) {
      const {metadata, ...result} = existing;
      return {ok: true, duplicate: true, repaired: false, linksUpdated:accessLinkUpdated, ...result};
    }
    const existingDirectory = path.join(libraryRoot, existing.area, existing.folderName);
    for (const file of payload.files) {
      const data = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : String(file.content);
      const destination = path.join(existingDirectory, ...file.name.split('/'));
      await mkdir(path.dirname(destination), {recursive: true});
      await writeFile(destination, data, file.encoding === 'base64' ? undefined : 'utf8');
    }
    const incomingNames = new Set(payload.files.map(file => file.name));
    const assetDirectory = path.join(existingDirectory, 'assets');
    const oldAssets = await readdir(assetDirectory, {withFileTypes: true}).catch(() => []);
    for (const entry of oldAssets) {
      const relative = `assets/${entry.name}`;
      if (entry.isFile() && (ALLOWED_ASSET.test(relative) || ALLOWED_VIDEO.test(relative)) && !incomingNames.has(relative)) {
        await rm(path.join(assetDirectory, entry.name), {force: true});
      }
    }
    const {metadata, ...result} = existing;
    return {ok: true, duplicate: false, repaired: true, ...result};
  }

  const finalDirectory = path.join(libraryRoot, 'inbox', payload.folderName);
  const tempDirectory = `${finalDirectory}.partial-${process.pid}-${Date.now()}`;
  await mkdir(tempDirectory, {recursive: false});
  try {
    for (const file of payload.files) {
      const data = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : String(file.content);
      const destination = path.join(tempDirectory, ...file.name.split('/'));
      await mkdir(path.dirname(destination), {recursive: true});
      await writeFile(destination, data, file.encoding === 'base64' ? undefined : 'utf8');
    }
    await rename(tempDirectory, finalDirectory);
  } catch (error) {
    await rm(tempDirectory, {recursive: true, force: true});
    if (error?.code === 'EEXIST') {
      return {ok: true, duplicate: true, area: 'inbox', folderName: payload.folderName, relativePath: `inbox/${payload.folderName}`};
    }
    throw error;
  }
  return {ok: true, duplicate: false, area: 'inbox', folderName: payload.folderName, relativePath: `inbox/${payload.folderName}`};
}

export function createKumoBridge({libraryRoot, port = DEFAULT_PORT, remoteGet = publicGet} = {}) {
  if (!libraryRoot || !path.isAbsolute(libraryRoot)) throw new Error('KUMO libraryRoot must be an absolute path.');
  const resolvedRoot = path.resolve(libraryRoot);
  const library = createLibrary(resolvedRoot);
  let evidenceLibrary;
  const evidence=()=>evidenceLibrary??=createEvidenceLibrary(resolvedRoot);
  const jobs = new Map();
  const mediaJobs = new Map();
  let mediaLibrary;
  const writableMedia=()=>mediaLibrary??=createEvidenceLibrary(resolvedRoot,{allowOrganize:true});
  async function runMediaJob(job,input){
    try{job.phase='preparing';job.result=await(await writableMedia()).prepareMedia(input);job.phase='completed';}
    catch(error){job.phase='failed';job.error=error.message||'media_preparation_failed';}
    finally{job.finishedAt=new Date().toISOString();}
  }
  async function resolveX(payload) {
    const url = checkRemoteUrl(payload.url, ['x.com', 'twitter.com']);
    const match = url.pathname.match(/^\/([^/]+)\/status\/(\d{1,25})(?:\/|$)/);
    if (!match) throw new Error('invalid_x_post_url');
    const ids = payload.mediaIds || [];
    if (!Array.isArray(ids) || ids.length > 4 || ids.some(id => !/^[a-z0-9_-]{1,64}$/i.test(String(id)))) throw new Error('invalid_media_ids');
    const publicUrl = `https://x.com/${match[1]}/status/${match[2]}`;
    const page = await remoteGet(publicUrl, {hosts: ['x.com', 'twitter.com'], maxBytes: 6 * 1024 * 1024, timeout: 20000});
    const html = page.bytes.toString('utf8');
    const postMedia = Media.findXPostMedia(html, match[2]);
    const targetIds = ids.length ? ids : postMedia.filter(item => item.mediaId).map(item => item.mediaId);
    const videos = targetIds.length ? Media.findXVideoVariants(html, targetIds).map(video => ({...video, poster: postMedia.find(item => item.mediaId === video.mediaId)?.url || '', origin: 'x_public_bridge'})) : [];
    return {ok: true, sourceId: match[2], videos, images: postMedia.filter(item => item.kind === 'image'), diagnostics: {pageBytes: page.bytes.length, targetMediaIds: targetIds, foundVideos: videos.length}};
  }
  function mediaUrl(value) {
    const url = checkRemoteUrl(value, ['video.twimg.com']);
    if (!/^\/(?:amplify_video|ext_tw_video|tweet_video)\//.test(url.pathname) || !/\.(?:mp4|m3u8|m4s|ts)$/.test(url.pathname)) throw new Error('invalid_x_media_url');
    return url;
  }
  async function runVideoJob(job, payload) {
    try {
      job.phase = 'resolving';
      const sourceClip = {...payload.clip, images: [...(payload.clip.images || [])], warnings: [...(payload.clip.warnings || [])]};
      const mediaIdOf = item => item.mediaId || String(item.poster || item.url || '').match(/\/(?:amplify_video_thumb|ext_tw_video_thumb|amplify_video|ext_tw_video)\/(\d+)/)?.[1] || String(item.poster || item.url || '').match(/\/(?:tweet_video_thumb|tweet_video)\/([a-z0-9_-]+)\./i)?.[1] || '';
      let discovered;
      let discoveryError;
      try { discovered = await resolveX({url: sourceClip.url, mediaIds: [...new Set((sourceClip.videos || []).map(mediaIdOf).filter(Boolean))]}); }
      catch (error) { discoveryError = error; }
      let imageBytes = 0;
      for (const image of payload.downloadImages === false ? [] : [...sourceClip.images, ...(discovered?.images || [])]) {
        const sameImage = sourceClip.images.find(item => new URL(item.url).pathname === new URL(image.url).pathname);
        if (sameImage?.localFile) continue;
        const entry = sameImage || {...image, origin: 'x_public_bridge'};
        if (!sameImage) sourceClip.images.push(entry);
        try {
          job.phase = 'downloading_images';
          const url = checkRemoteUrl(entry.url, ['pbs.twimg.com']);
          if (!url.pathname.startsWith('/media/')) throw new Error('invalid_x_image_url');
          url.searchParams.set('name', 'orig');
          const result = await remoteGet(url.href, {hosts: ['pbs.twimg.com'], maxBytes: 20 * 1024 * 1024, timeout: 20000, onProgress: (received, expected) => { job.received = received; job.expected = expected; }});
          if (!result.type.startsWith('image/') || imageBytes + result.bytes.length > 40 * 1024 * 1024) throw new Error('invalid_or_oversized_image');
          imageBytes += result.bytes.length;
          const extension = result.type.includes('png') ? 'png' : result.type.includes('webp') ? 'webp' : result.type.includes('gif') ? 'gif' : 'jpg';
          let name;
          for (let index = 1; index <= 99; index++) {
            const candidate = `assets/image-${String(index).padStart(2, '0')}.${extension}`;
            if (!payload.files.some(file => file.name === candidate)) { name = candidate; break; }
          }
          if (!name) throw new Error('too_many_images');
          Object.assign(entry, {localFile: name, downloadStatus: 'saved', bytes: result.bytes.length, downloadError: undefined});
          payload.files.push({name, encoding: 'base64', content: result.bytes.toString('base64')});
        } catch (error) { entry.downloadStatus = 'remote_only'; entry.downloadError = error.message; }
      }
      sourceClip.stats = {...sourceClip.stats, images: sourceClip.images.length, downloadedImages: sourceClip.images.filter(image => image.localFile).length};
      const prepared = await Media.prepareVideos(sourceClip, {
        resolveX: async () => { if (discoveryError) throw discoveryError; return discovered.videos; },
        fetchImpl: async url => {
          job.phase = 'downloading';
          const result = await remoteGet(mediaUrl(url).href, {hosts: ['video.twimg.com'], maxBytes: 80 * 1024 * 1024, onProgress: (received, expected) => { job.received = received; job.expected = expected; }});
          return new Response(result.bytes, {headers: {'Content-Type': result.type, 'Content-Length': result.bytes.length}});
        },
        onProgress: progress => { job.progress = progress; }
      });
      job.phase = 'saving';
      const clip = prepared.clip;
      const files = payload.files.filter(file => !['source.md', 'metadata.json', 'readable.html'].includes(file.name) && !ALLOWED_VIDEO.test(file.name));
      for (const file of prepared.files) files.push({name: file.name, encoding: 'base64', content: Buffer.from(await file.content.arrayBuffer()).toString('base64')});
      const existing = await findExisting(resolvedRoot, clip);
      if (existing) {
        // Repairing a video must not be blocked merely because the browser did
        // not rediscover an image saved on a previous visit. Retain valid assets
        // and regenerate the source manifest from the actual combined package.
        for (const [field, matcher] of [['images', ALLOWED_ASSET], ['videos', ALLOWED_VIDEO]]) {
          clip[field] ||= [];
          for (const previous of existing.metadata[field] || []) {
            if (!previous.localFile || !matcher.test(previous.localFile)) continue;
            const current = clip[field].find(item => item.url === previous.url || (field === 'videos' && mediaIdOf(item) && mediaIdOf(item) === mediaIdOf(previous)));
            if (current?.localFile) continue;
            const bytes = await readFile(path.join(resolvedRoot, existing.area, existing.folderName, ...previous.localFile.split('/'))).catch(() => null);
            if (!bytes?.length) continue;
            if (field === 'videos') {
              if (!/^https:\/\/video\.twimg\.com\//.test(previous.url || '')) continue;
              try { await Media.validateVideoBlob(new Blob([bytes], {type: previous.type || 'video/mp4'}), previous.url); } catch { continue; }
            }
            let name = previous.localFile;
            if (files.some(file => file.name === name)) {
              const extension = path.extname(name);
              const prefix = field === 'videos' ? 'video' : 'image';
              for (let index = 1; index <= 99; index++) {
                const candidate = `assets/${prefix}-${String(index).padStart(2, '0')}${extension}`;
                if (!files.some(file => file.name === candidate)) { name = candidate; break; }
              }
            }
            const retained = {...previous, localFile: name, downloadStatus: 'saved', retainedFromPreviousCapture: true};
            if (current) Object.assign(current, retained); else clip[field].push(retained);
            files.push({name, encoding: 'base64', content: bytes.toString('base64')});
          }
        }
      }
      clip.images ||= [];
      clip.stats = {...clip.stats, images: clip.images.length, downloadedImages: clip.images.filter(image => image.localFile).length, videos: clip.videos.length, downloadedVideos: clip.videos.filter(video => video.localFile).length};
      clip.warnings = clip.warnings.filter(value => !/^images_not_fully_downloaded:|^videos_not_fully_downloaded:/.test(value));
      if (payload.downloadImages !== false && clip.stats.downloadedImages < clip.stats.images) clip.warnings.push(`images_not_fully_downloaded:${clip.stats.downloadedImages}/${clip.stats.images}`);
      if (clip.stats.downloadedVideos < clip.stats.videos) clip.warnings.push(`videos_not_fully_downloaded:${clip.stats.downloadedVideos}/${clip.stats.videos}`);
      const screenshot = files.some(file => file.name === 'viewport.png');
      files.push(
        {name: 'source.md', encoding: 'utf8', content: Format.buildMarkdown(clip, payload.note, screenshot)},
        {name: 'metadata.json', encoding: 'utf8', content: Format.buildMetadata(clip, payload.note, screenshot)},
        {name: 'readable.html', encoding: 'utf8', content: Format.buildReadableHtml(clip)}
      );
      job.result = await saveClip(resolvedRoot, {schema: 'kumo-bridge-save-v1', folderName: payload.folderName, clip, files}, library);
      const savedMetadata = await readJson(path.join(resolvedRoot, ...job.result.relativePath.split('/'), 'metadata.json'));
      job.downloadedVideos = Number(savedMetadata?.stats?.downloadedVideos || 0);
      job.videos = Number(savedMetadata?.stats?.videos || 0);
      job.errors = clip.videos.filter(video => video.downloadStatus !== 'saved').map(video => video.downloadError);
      if (payload.downloadImages !== false) job.errors.push(...clip.images.filter(image => !image.localFile).map(image => image.downloadError || 'image_not_saved'));
      job.diagnostics = clip.videoDiagnostics;
      job.phase = job.errors.length || job.downloadedVideos < clip.stats.videos || clip.warnings.includes('x_video_discovery_failed') ? 'partial' : 'complete';
    } catch (error) {
      job.phase = 'failed';
      job.error = error.message || 'video_job_failed';
    } finally {
      job.finishedAt = new Date().toISOString();
    }
  }
  const server = http.createServer(async (req, res) => {
    if(req.method==='POST')res.once('finish',()=>sourceSnapshot(resolvedRoot).invalidate());
    const origin = req.headers.origin || '';
    if (!allowedOrigin(req)) return response(res, 403, {error: 'origin_not_allowed'}, origin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.statusCode = 204;
      return res.end();
    }
    try {
      if (req.method === 'GET' && req.url.startsWith('/ui/')) {
        const name = req.url.slice(4).split('?')[0];
        const allowed = {'knowledge.html':'text/html','knowledge.js':'text/javascript','knowledge-scene.js':'text/javascript','knowledge.css':'text/css','library.html':'text/html', 'library.js':'text/javascript', 'library.css':'text/css', 'library-refinements.css':'text/css', 'common.css':'text/css', 'logo.css':'text/css', 'assets/kumo-design-reference.png':'image/png', 'assets/kumo-logo-reference.png':'image/png', 'assets/kumo-logo.svg':'image/svg+xml', 'assets/icons.svg':'image/svg+xml', 'bridge.js':'text/javascript', 'ui.js':'text/javascript'};
        allowed['source-links.js']='text/javascript';
        allowed['knowledge-focus.js']='text/javascript';
        allowed['knowledge-atlas.js']='text/javascript';allowed['knowledge-atlas.css']='text/css';
        allowed['knowledge-garden.css']='text/css';
        const uiTypes={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.webp':'image/webp','.gif':'image/gif','.avif':'image/avif','.woff2':'font/woff2'};
        const extraRoot=['forest-journal.css','help.html','help.css'];
        if((extraRoot.includes(name)||/^(?:garden|assets)\//.test(name))&&!name.split(/[\\/]/).some(part=>part==='..'||part.startsWith('.'))&&!name.includes('%')&&uiTypes[path.extname(name)]){
          const base=await realpath(path.join(HERE,'..','browser-extension')),candidate=await realpath(path.join(base,name)),relative=path.relative(base,candidate);
          if(!relative.startsWith('..')&&!path.isAbsolute(relative))allowed[name]=uiTypes[path.extname(name)];
        }
        if (!Object.hasOwn(allowed, name)) return response(res, 404, {error:'not_found'}, origin);
        res.setHeader('Content-Type', allowed[name] + '; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; frame-ancestors 'none'");
        return res.end(await readFile(path.join(HERE, '..', 'browser-extension', name)));
      }
      if (req.method === 'GET' && req.url === '/status') {
        await ensureLibrary(resolvedRoot);
return response(res, 200, {ok: true, service: 'kumo-local-bridge', apiVersion: API_VERSION, bridgeVersion: '0.17.1', capabilities: ['nested_assets', 'video_assets', 'platform_guides', 'repair_incomplete_clips', 'x_public_media', 'x_video_jobs', 'library_browser', 'user_annotations', 'local_library_ui','ai_classification','knowledge_map','knowledge_focus','knowledge_atlas','content_keywords','incremental_index','reversible_tag_delete','media_preparation'], activeJobs: [...jobs.values(),...mediaJobs.values()].slice(-10), libraryRoot: resolvedRoot}, origin);
      }
      if(req.method==='POST'&&req.url==='/media/prepare'){
        const input=await readBody(req,4000);
        if(!input||typeof input!=='object'||Array.isArray(input)||!/^[a-f0-9]{24}$/.test(input.id)||Object.keys(input).some(key=>!['id','ocr','force','transcribe'].includes(key)))throw Error('invalid_media_request');
        for(const flag of ['ocr','force','transcribe'])if(input[flag]!==undefined&&typeof input[flag]!=='boolean')throw Error('invalid_media_flag');
        if(input.transcribe)throw Error('transcription_requires_explicit_AI_provider_configuration');
        const active=[...mediaJobs.values()].find(job=>job.sourceId===input.id&&!job.finishedAt);
        if(active)return response(res,202,{ok:true,jobId:active.id,existing:true},origin);
        if([...mediaJobs.values()].filter(job=>!job.finishedAt).length>=2)throw Error('media_queue_busy');
        // Validate source membership before accepting a job. No arbitrary paths or URLs.
        await(await evidence()).readPreparedMedia({id:input.id});
        const job={id:randomUUID(),sourceId:input.id,kind:'media',phase:'queued',startedAt:new Date().toISOString()};
        mediaJobs.set(job.id,job);
        for(const [id,previous]of mediaJobs)if(mediaJobs.size>30&&previous.finishedAt)mediaJobs.delete(id);
        response(res,202,{ok:true,jobId:job.id},origin);void runMediaJob(job,input);return;
      }
      if(req.method==='GET'&&/^\/media\/jobs\/[a-f0-9-]+$/.test(req.url)){
        const job=mediaJobs.get(req.url.split('/').at(-1));return response(res,job?200:404,job||{error:'media_job_not_found'},origin);
      }
      if(req.method==='GET'&&/^\/media\/[a-f0-9]{24}$/.test(req.url))return response(res,200,await(await evidence()).readPreparedMedia({id:req.url.split('/').at(-1)}),origin);
      if(req.method==='GET'&&req.url.startsWith('/api/cover?')){const q=new URL(req.url,'http://127.0.0.1').searchParams;const file=await library.asset(q.get('id'),q.get('name'));res.setHeader('Content-Type',({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif'})[path.extname(file)]||'application/octet-stream');return res.end(await readFile(file));}
      if(req.method==='GET'&&req.url==='/knowledge/atlas')return response(res,200,{ok:true,...await (await evidence()).knowledgeAtlas()},origin);
      if(req.method==='GET'&&req.url.startsWith('/knowledge/focus')){
        const params=new URL(req.url,'http://127.0.0.1').searchParams,knowledge=await evidence();
        if(params.get('refresh')==='true')await knowledge.refresh();
        const kind=params.get('kind')||'root';if(!['root','domain','topic'].includes(kind))throw new Error('无效知识类型');
        return response(res,200,{ok:true,...await knowledge.knowledgeFocus({kind,id:params.get('id')||'',offset:Number(params.get('offset')||0),relatedOffset:Number(params.get('relatedOffset')||0),sourceOffset:Number(params.get('sourceOffset')||0),sources:params.get('sources')==='true',childLimit:Number(params.get('childLimit')||8)})},origin);
      }
      if(req.method==='GET'&&req.url==='/knowledge')return response(res,200,{ok:true,...await (await evidence()).knowledgeGraph()},origin);
      if (req.method === 'GET' && (req.url === '/library' || req.url.startsWith('/library?'))) {
        const params = new URL(req.url, 'http://127.0.0.1').searchParams;
        res.setHeader('Cache-Control', 'no-store');
        return response(res, 200, await library.list({q: (params.get('q') || '').slice(0, 200), tag: params.get('tag') || '', domain: params.get('domain') || '', offset: Number(params.get('offset')) || 0, limit: Number(params.get('limit')) || 100}), origin);
      }
      if (req.method === 'GET' && /^\/library\/items\/[a-f0-9]{24}\/assets\//.test(req.url)) {
        const [, id, name] = req.url.match(/^\/library\/items\/([a-f0-9]{24})\/(.+)$/);
        const file = await library.asset(id, name);
        const bytes = await readFile(file);
        if (/^chrome-extension:\/\/[a-z]+$/i.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        const types = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.m4v': 'video/mp4'};
        res.setHeader('Content-Type', types[path.extname(name).toLowerCase()] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 200; return res.end(bytes);
      }
      if (req.method === 'GET' && req.url.startsWith('/library/items/')) {
        res.setHeader('Cache-Control', 'no-store');
        return response(res, 200, await library.detail(req.url.slice('/library/items/'.length)), origin);
      }
      if (req.method === 'GET' && req.url === '/tags') {
        return response(res, 200, {ok: true, ...await library.tagOverview()}, origin);
      }
      if(req.method==='POST'&&req.url==='/classification')return response(res,200,await library.classify(await readBody(req,4000)),origin);
      if (req.method === 'POST' && req.url === '/tags') {
        return response(res, 200, {ok: true, tag: await library.updateTag(await readBody(req, 4000))}, origin);
      }
      if (req.method === 'POST' && req.url === '/annotations') {
        const payload = await readBody(req, 200000);
        const existing = await findExisting(resolvedRoot, payload.clip || {});
        if (!existing) throw new Error('saved_item_not_found');
        await library.annotate(existing.relativePath, existing.metadata, true);
        if (payload.kind === 'collection') {
          const tags = await library.tags();
          const selected = payload.collectionId ? tags.find(tag => tag.id === payload.collectionId && !tag.hidden) : null;
          if (payload.collectionId && !selected) throw new Error('collection_not_found');
          await library.annotate(existing.relativePath, {kind:'collection', userNote:'', userTags:selected ? [selected] : [], capturedAt:new Date().toISOString()});
        } else await library.annotate(existing.relativePath, {userNote: payload.note, userTags: payload.userTags, capturedAt: new Date().toISOString()});
        return response(res, 200, {ok: true, relativePath: existing.relativePath}, origin);
      }
      if (req.method === 'POST' && req.url === '/x/resolve') {
        const payload = await readBody(req, 16000);
        return response(res, 200, await resolveX(payload), origin);
      }
      if (req.method === 'GET' && req.url.startsWith('/x/media?')) {
        const url = mediaUrl(new URL(req.url, 'http://127.0.0.1').searchParams.get('url'));
        const media = await remoteGet(url.href, {hosts: ['video.twimg.com'], maxBytes: 80 * 1024 * 1024});
        if (/^chrome-extension:\/\/[a-z]+$/i.test(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Content-Type', media.type);
        res.setHeader('Content-Length', media.bytes.length);
        res.setHeader('Cache-Control', 'no-store');
        res.statusCode = 200;
        return res.end(media.bytes);
      }
      if (req.method === 'POST' && req.url === '/x/jobs') {
        const payload = await readBody(req, 65 * 1024 * 1024);
        if (payload.schema !== 'kumo-x-job-v1' || payload.clip?.platformId !== 'x' || !validFolderName(payload.folderName) || !Array.isArray(payload.files)) throw new Error('invalid_video_job');
        const url = checkRemoteUrl(payload.clip.url, ['x.com', 'twitter.com']);
        if (!/^\/[^/]+\/status\/\d{1,25}(?:\/|$)/.test(url.pathname)) throw new Error('invalid_x_post_url');
        const active = [...jobs.values()].find(job => job.url === payload.clip.url && !job.finishedAt);
        if (active) return response(res, 202, {ok: true, jobId: active.id, existing: true}, origin);
        if ([...jobs.values()].filter(job => !job.finishedAt).length >= 2) throw new Error('video_queue_busy');
        await saveClip(resolvedRoot, {schema: 'kumo-bridge-save-v1', folderName: payload.folderName, clip: payload.clip, files: payload.files}, library);
        const job = {id: randomUUID(), url: payload.clip.url, phase: 'queued', startedAt: new Date().toISOString(), received: 0, expected: 0};
        jobs.set(job.id, job);
        for (const [id, previous] of jobs) { if (jobs.size > 30 && previous.finishedAt) jobs.delete(id); }
        response(res, 202, {ok: true, jobId: job.id}, origin);
        void runVideoJob(job, payload);
        return;
      }
      if (req.method === 'GET' && /^\/x\/jobs\/[a-f0-9-]+$/.test(req.url)) {
        const job = jobs.get(req.url.split('/').at(-1));
        return response(res, job ? 200 : 404, job || {error: 'video_job_not_found'}, origin);
      }
      if (req.method === 'POST' && req.url === '/clips') {
        const result = await saveClip(resolvedRoot, await readBody(req), library);
        return response(res, 200, result, origin);
      }
      return response(res, 404, {error: 'not_found'}, origin);
    } catch (error) {
      return response(res, error.message === 'payload_too_large' ? 413 : 400, {error: error.message || 'save_failed'}, origin);
    }
  });
  server.once('close',()=>{sourceSnapshot(resolvedRoot).close();void evidenceLibrary?.then(lib=>lib.close());void mediaLibrary?.then(lib=>lib.close());});
  return {server, port, libraryRoot: resolvedRoot};
}

async function loadConfig() {
  const configured = process.env.KUMO_LIBRARY_ROOT;
  if (configured) return {libraryRoot: configured, port: Number(process.env.KUMO_BRIDGE_PORT || DEFAULT_PORT)};
  const config = await readJson(process.env.KUMO_BRIDGE_CONFIG || path.join(HERE, 'local-config.json'));
  if (!config?.libraryRoot) throw new Error('Missing local-config.json. Run configure-and-start.ps1 first.');
  return {libraryRoot: config.libraryRoot, port: Number(config.port || DEFAULT_PORT)};
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const config = await loadConfig();
  const {server} = createKumoBridge(config);
  server.listen(config.port, '127.0.0.1', () => {
    console.log(`Kumo local bridge: http://127.0.0.1:${config.port}`);
    console.log(`Library: ${path.resolve(config.libraryRoot)}`);
  });
}


