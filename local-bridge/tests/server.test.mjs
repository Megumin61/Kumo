import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createKumoBridge} from '../server.mjs';

test('bridge saves once and rejects a duplicate canonical URL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-bridge-'));
  const {server} = createKumoBridge({libraryRoot: root, port: 0});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/clips`;
  const payload = {
    schema: 'kumo-bridge-save-v1',
    folderName: '2026-10-10--example--deadbeef',
    clip: {url: 'https://example.com/item', contentHash: 'deadbeef', dedupeSafeUrl: true},
    files: [
      {name: 'source.md', encoding: 'utf8', content: '# Example'},
      {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify({url: 'https://example.com/item', contentHash: 'deadbeef', stats: {images: 1, downloadedImages: 1}})},
      {name: 'assets/image-01.jpg', encoding: 'base64', content: Buffer.from('image-bytes').toString('base64')},
      {name: 'assets/video-01.mp4', encoding: 'base64', content: Buffer.from('video-bytes').toString('base64')}
    ]
  };
  try {
    const status = await fetch(`http://127.0.0.1:${address.port}/status`, {headers: {Origin: 'chrome-extension://abcdefghijklmnop'}}).then(value => value.json());
    assert.equal(status.apiVersion, 7);
    for(const capability of ['nested_assets','video_assets','platform_guides','repair_incomplete_clips','x_public_media','x_video_jobs','library_browser','user_annotations','local_library_ui','ai_classification','knowledge_map','reversible_tag_delete'])assert.ok(status.capabilities.includes(capability));
    const first = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(value => value.json());
    assert.equal(first.duplicate, false, JSON.stringify(first));
    assert.equal(await readFile(path.join(root, first.relativePath, 'source.md'), 'utf8'), '# Example');
    assert.equal(await readFile(path.join(root, first.relativePath, 'assets', 'image-01.jpg'), 'utf8'), 'image-bytes');
    assert.equal(await readFile(path.join(root, first.relativePath, 'assets', 'video-01.mp4'), 'utf8'), 'video-bytes');
    payload.folderName = '2026-10-11--same-url--feedface';
    payload.clip.contentHash = 'feedface';
    const second = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(value => value.json());
    assert.equal(second.duplicate, true);
    assert.equal(second.relativePath, first.relativePath);
    payload.files.push({name: 'assets/image-02.jpg', encoding: 'base64', content: Buffer.from('second-image').toString('base64')});
    payload.files.find(file => file.name === 'metadata.json').content = JSON.stringify({url: 'https://example.com/item', contentHash: 'feedface', stats: {images: 2, downloadedImages: 2}});
    const repaired = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(value => value.json());
    assert.equal(repaired.repaired, true);
    assert.equal(repaired.duplicate, false);
    assert.equal(await readFile(path.join(root, repaired.relativePath, 'assets', 'image-02.jpg'), 'utf8'), 'second-image');
    payload.files = payload.files.filter(file => file.name !== 'assets/image-02.jpg');
    payload.files.find(file => file.name === 'metadata.json').content = JSON.stringify({url: 'https://example.com/item', contentHash: 'feedface', extractorVersion: '9.0.0', stats: {images: 1, downloadedImages: 1}});
    const lessComplete = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(value => value.json());
    assert.equal(lessComplete.duplicate, true);
    assert.equal(await readFile(path.join(root, repaired.relativePath, 'assets', 'image-02.jpg'), 'utf8'), 'second-image');
    const xGuide = path.join(root, 'platforms', 'x.md');
    await writeFile(xGuide, '# User edited guide\n');
    await fetch(`http://127.0.0.1:${address.port}/status`, {headers: {Origin: 'chrome-extension://abcdefghijklmnop'}});
    assert.equal(await readFile(xGuide, 'utf8'), '# User edited guide\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test('collection URL does not make different Xiaohongshu notes duplicates', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-dedupe-'));
  const {server} = createKumoBridge({libraryRoot: root, port: 0});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const endpoint = `http://127.0.0.1:${address.port}/clips`;
  const makePayload = (id, hash) => ({
    schema: 'kumo-bridge-save-v1',
    folderName: `2026-10-11--note-${id}--${hash}`,
    clip: {
      url: 'https://www.xiaohongshu.com/explore',
      capturedUrl: `https://www.xiaohongshu.com/explore/${id}?xsec_token=temporary`,
      contentHash: hash,
      dedupeKey: `xiaohongshu:${id}`,
      dedupeSafeUrl: false
    },
    files: [
      {name: 'source.md', encoding: 'utf8', content: `# ${id}`},
      {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify({url: 'https://www.xiaohongshu.com/explore', capturedUrl: `https://www.xiaohongshu.com/explore/${id}`, contentHash: hash, dedupeKey: `xiaohongshu:${id}`})}
    ]
  });
  try {
    const first = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(makePayload('6abd2082000000001400365b', '11111111'))}).then(value => value.json());
    const second = await fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(makePayload('6aaa60210000000026014202', '22222222'))}).then(value => value.json());
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, false);
    assert.notEqual(first.relativePath, second.relativePath);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test('a core-first save is settled even when every media download fails', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-pending-'));
  const {server} = createKumoBridge({libraryRoot: root, port: 0});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/clips`;
  const metadata = {url: 'https://x.com/author/status/123', dedupeKey: 'x:123', extractorVersion: '0.7.5', stats: {videos: 1, downloadedVideos: 0}, warnings: ['media_download_pending']};
  const payload = {
    schema: 'kumo-bridge-save-v1',
    folderName: '2026-10-11--post--12345678',
    clip: {url: metadata.url, dedupeKey: metadata.dedupeKey},
    files: [
      {name: 'source.md', encoding: 'utf8', content: '# Post'},
      {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify(metadata)}
    ]
  };
  const submit = () => fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(response => response.json());
  try {
    const initial = await submit();
    assert.equal(initial.duplicate, false);
    metadata.warnings = ['videos_not_fully_downloaded:0/1'];
    payload.files[1].content = JSON.stringify(metadata);
    const settled = await submit();
    assert.equal(settled.repaired, true);
    const saved = JSON.parse(await readFile(path.join(root, settled.relativePath, 'metadata.json'), 'utf8'));
    assert.deepEqual(saved.warnings, metadata.warnings);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});

test('a newer capture replaces a falsely saved X video initialization fragment', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-x-init-'));
  const {server} = createKumoBridge({libraryRoot: root, port: 0});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}/clips`;
  const folderName = '2026-10-11--x-video--78294bd4';
  const url = 'https://x.com/Li665508Li/status/2108914422991540460';
  const base = {url, dedupeKey: 'x:2108914422991540460', videos: [{url: 'https://video.twimg.com/init.mp4', localFile: 'assets/video-01.mp4', downloadStatus: 'saved'}], stats: {videos: 1, downloadedVideos: 1}, extractorVersion: '0.7.5'};
  const payload = {
    schema: 'kumo-bridge-save-v1', folderName, clip: {url, dedupeKey: base.dedupeKey},
    files: [
      {name: 'source.md', encoding: 'utf8', content: '# Old'},
      {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify(base)},
      {name: 'assets/video-01.mp4', encoding: 'base64', content: Buffer.alloc(897).toString('base64')}
    ]
  };
  const submit = () => fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'chrome-extension://abcdefghijklmnop'}, body: JSON.stringify(payload)}).then(response => response.json());
  try {
    assert.equal((await submit()).duplicate, false);
    payload.files = [
      {name: 'source.md', encoding: 'utf8', content: '# Corrected'},
      {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify({...base, videos: [{url: 'https://video.twimg.com/manifest.m3u8', downloadStatus: 'remote_only'}], stats: {videos: 1, downloadedVideos: 0}, extractorVersion: '0.7.6'})}
    ];
    assert.equal((await submit()).repaired, true);
    await assert.rejects(stat(path.join(root, 'inbox', folderName, 'assets', 'video-01.mp4')));
    const saved = JSON.parse(await readFile(path.join(root, 'inbox', folderName, 'metadata.json'), 'utf8'));
    assert.equal(saved.stats.downloadedVideos, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, {recursive: true, force: true});
  }
});
