import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = root + 'tests/fixtures/video/';
const require = createRequire(import.meta.url);
const Media = require(root + 'media.js');

// Serves the fixture folder as https://cdn.test/…, including Range requests, without network access.
function cdn() {
  const requests = [];
  const aliases = {'noext/plain': 'plain.mp4', 'noext/ts': 'ts.m3u8'};
  const fetchImpl = async (url, init = {}) => {
    const parsed = new URL(url);
    requests.push(parsed.pathname);
    const path = decodeURIComponent(parsed.pathname.slice(1)), name = aliases[path] || path.replace(/^noext\//, '');
    if (!/^[\w.-]+$/.test(name) || !fs.existsSync(fixtures + name)) return new Response('', {status: 404});
    const bytes = fs.readFileSync(fixtures + name);
    const range = init.headers?.Range?.match(/bytes=(\d+)-(\d+)/);
    if (range) return new Response(bytes.subarray(Number(range[1]), Number(range[2]) + 1), {status: 206});
    return new Response(bytes, {status: 200, headers: {'content-length': String(bytes.length)}});
  };
  return {fetchImpl, requests};
}

// Minimal reader for the written MP4: track handlers and sample counts.
function tracksOf(bytes) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (at, length = 4) => String.fromCharCode(...bytes.subarray(at, at + length));
  const children = (start, end) => { const out = []; for (let at = start; at + 8 <= end;) { const size = data.getUint32(at); out.push({type: text(at + 4), start: at, end: at + size}); at += size; } return out; };
  const find = (node, type) => children(node.start + 8, node.end).find(child => child.type === type);
  const top = children(0, bytes.length), moov = top.find(box => box.type === 'moov');
  assert.deepEqual(top.map(box => box.type).filter(type => type !== 'free'), ['ftyp', 'moov', 'mdat']);
  return children(moov.start + 8, moov.end).filter(box => box.type === 'trak').map(trak => {
    const mdia = find(trak, 'mdia'), hdlr = find(mdia, 'hdlr'), stbl = find(find(mdia, 'minf'), 'stbl'), stsz = find(stbl, 'stsz'), stco = find(stbl, 'stco');
    const entry = text(find(stbl, 'stsd').start + 20);
    const samples = data.getUint32(stsz.start + 16);
    // Every chunk offset must point inside the mdat payload.
    const mdat = top.find(box => box.type === 'mdat');
    for (let index = 0; index < data.getUint32(stco.start + 12); index++) {
      const offset = data.getUint32(stco.start + 16 + index * 4);
      assert(offset >= mdat.start + 8 && offset < mdat.end);
    }
    return {handler: text(hdlr.start + 16), entry, samples};
  });
}

async function saved(videos) {
  const {fetchImpl} = cdn();
  const result = await Media.prepareVideos({platformId: 'web', url: 'https://site.test/post', videos, stats: {}, warnings: []}, {fetchImpl});
  return result;
}

async function only(video) {
  const {clip, files} = await saved([video]);
  assert.equal(clip.videos[0].downloadStatus, 'saved', JSON.stringify(clip.videos[0].attempts));
  return tracksOf(new Uint8Array(await files[0].content.arrayBuffer()));
}

test('HLS transport streams are remuxed into one playable MP4 with video and audio', async () => {
  const tracks = await only({url: 'https://cdn.test/ts.m3u8', kind: 'stream_manifest'});
  assert.deepEqual(tracks.map(track => [track.handler, track.entry]), [['vide', 'avc1'], ['soun', 'mp4a']]);
  assert.equal(tracks[0].samples, 30);
  assert(tracks[1].samples >= 40);
});

test('fragmented HLS with a separate audio rendition keeps both tracks', async () => {
  const tracks = await only({url: 'https://cdn.test/fmp4.m3u8', kind: 'stream_manifest'});
  assert.deepEqual(tracks.map(track => track.handler), ['vide', 'soun']);
  assert.equal(tracks[0].samples, 30);
});

test('byte-range playlists, AES-128 segments and DASH audio/video pairs are saved', async () => {
  assert.equal((await only({url: 'https://cdn.test/ranged.m3u8', kind: 'stream_manifest'}))[0].samples, 30);
  assert.equal((await only({url: 'https://cdn.test/aes.m3u8', kind: 'stream_manifest'}))[0].samples, 30);
  const dash = await only({url: 'https://cdn.test/dash-video.m4s', audioUrl: 'https://cdn.test/dash-audio.m4s', kind: 'dash_pair'});
  assert.deepEqual(dash.map(track => track.handler), ['vide', 'soun']);
});

test('the response decides the format: an extensionless file or manifest is still saved', async () => {
  const plain = await only({url: 'https://cdn.test/noext/plain?sig=1', kind: 'embed_or_unknown'});
  assert.equal(plain.length, 2);
  const manifest = await only({url: 'https://cdn.test/noext/ts?token=a', kind: 'embed_or_unknown'});
  assert.equal(manifest[0].samples, 30);
});

test('every video on a page is attempted, not only the first four, and mirrors are tried in order', async () => {
  const videos = Array.from({length: 7}, () => ({url: 'https://cdn.test/plain.mp4', kind: 'direct_file'}));
  videos.push({url: 'https://cdn.test/missing.mp4', kind: 'direct_file', alternatives: [{url: 'https://cdn.test/also-missing.m3u8', kind: 'stream_manifest'}, {url: 'https://cdn.test/plain.mp4?mirror=2', kind: 'direct_file'}]});
  videos.push({url: 'blob:https://site.test/1', kind: 'blob', alternatives: [{url: 'https://cdn.test/ts.m3u8', kind: 'stream_manifest'}]});
  const {clip, files} = await saved(videos);
  assert.equal(clip.stats.downloadedVideos, 9);
  assert.equal(files.length, 9);
  assert.deepEqual(files.map(file => file.name).slice(-2), ['assets/video-08.mp4', 'assets/video-09.mp4']);
  assert.equal(clip.videos[7].url, 'https://cdn.test/plain.mp4?mirror=2');
  assert.deepEqual(clip.videos[7].attempts.map(attempt => attempt.error), ['HTTP 404', 'HTTP 404']);
  assert.deepEqual(clip.warnings, []);
});

test('a stalled download is abandoned after the idle timeout instead of a fixed total time', async () => {
  let reads = 0;
  const stream = new ReadableStream({pull(controller) { reads++; if (reads < 4) controller.enqueue(new Uint8Array(1000)); else return new Promise(() => {}); }});
  const fetchImpl = async () => new Response(stream, {status: 200});
  await assert.rejects(Media.fetchBlobWithProgress('https://cdn.test/slow', 60, null, fetchImpl), /video_download_stalled/);
  assert.equal(reads, 4);
});

test('a video over the per-video limit fails cleanly while the others are kept', async () => {
  const {fetchImpl} = cdn();
  const {clip} = await Media.prepareVideos({platformId: 'web', url: 'https://site.test', videos: [{url: 'https://cdn.test/plain.mp4', kind: 'direct_file'}, {url: 'https://cdn.test/dash-video.m4s', kind: 'direct_file'}], stats: {}, warnings: []}, {fetchImpl, maxVideoBytes: 30000});
  assert.deepEqual(clip.videos.map(video => video.downloadStatus), ['remote_only', 'saved']);
  assert.equal(clip.videos[0].downloadError, 'video_too_large');
});

function pageState(href, globals) {
  const context = vm.createContext({URL, location: new URL(href), window: globals, document: {getElementById: () => null, querySelectorAll: () => []}, ...globals});
  vm.runInContext(fs.readFileSync(root + 'page-state.js', 'utf8'), context);
  return context.readKumoPageState();
}

test('Xiaohongshu prefers the H.264 stream, keeps backups and saves live-photo clips', () => {
  const state = pageState('https://www.xiaohongshu.com/explore/abc123', {__INITIAL_STATE__: {note: {noteDetailMap: {abc123: {note: {noteId: 'abc123', title: 't', desc: 'd',
    imageList: [{urlDefault: 'https://img.test/1.jpg'}, {urlDefault: 'https://img.test/2.jpg', livePhoto: true, stream: {h264: [{masterUrl: 'https://v.test/live.mp4', backupUrls: ['https://v2.test/live.mp4']}]}}],
    video: {media: {stream: {h265: [{masterUrl: 'https://v.test/hevc.mp4', width: 1920, height: 1080}], h264: [{masterUrl: 'https://v.test/avc.mp4', width: 1280, height: 720, backupUrls: ['https://v2.test/avc.mp4']}]}}}}}}}}});
  const videos = state.xhsNote.videos;
  assert.equal(videos[0].url, 'https://v.test/avc.mp4');
  assert.deepEqual(Array.from(videos[0].alternatives, item => item.url), ['https://v2.test/avc.mp4', 'https://v.test/hevc.mp4']);
  assert.equal(videos[1].url, 'https://v.test/live.mp4');
  assert.equal(videos[1].livePhoto, true);
  assert.equal(videos[1].poster, 'https://img.test/2.jpg');
});

test('Bilibili DASH pages become one H.264 video + audio pair', () => {
  const state = pageState('https://www.bilibili.com/video/BV1xx411c7mD', {__INITIAL_STATE__: {videoData: {bvid: 'BV1xx411c7mD', title: 't', desc: 'd', pic: 'https://i.test/p.jpg'}},
    __playinfo__: {data: {dash: {video: [{id: 120, codecid: 12, codecs: 'hev1', baseUrl: 'https://cdn.test/hevc.m4s'}, {id: 80, codecid: 7, codecs: 'avc1.640032', baseUrl: 'https://cdn.test/avc.m4s', backupUrl: ['https://bak.test/avc.m4s']}], audio: [{codecs: 'mp4a.40.2', bandwidth: 1, baseUrl: 'https://cdn.test/a1.m4s'}, {codecs: 'mp4a.40.2', bandwidth: 9, baseUrl: 'https://cdn.test/a9.m4s'}]}}}});
  const [video] = state.core.videos;
  assert.equal(video.kind, 'dash_pair');
  assert.equal(video.url, 'https://cdn.test/avc.m4s');
  assert.equal(video.audioUrl, 'https://cdn.test/a9.m4s');
  assert.equal(video.alternatives[0].url, 'https://bak.test/avc.m4s');
});

test('videos are saved by default, and an explicit later choice to skip them is kept', () => {
  const Destination = require(root + 'destination.js');
  const store = values => ({data: new Map(Object.entries(values)), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, value); }});
  assert.equal(Destination.options(store({})).video, true);
  assert.equal(Destination.options(store({'kumo-capture-options:v1': JSON.stringify({video: false, images: true, comments: 10})})).video, true);
  const storage = store({});
  Destination.saveOptions(storage, {images: true, video: false, comments: 10});
  assert.equal(Destination.options(storage).video, false);
  Destination.saveOptions(storage, {images: true, video: true, comments: 10});
  assert.equal(Destination.options(storage).video, true);
});
