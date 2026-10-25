import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createKumoBridge} from '../server.mjs';
import {checkRemoteUrl} from '../remote.mjs';
import Format from '../../browser-extension/format.js';

const id = '2106678359199551489';
const url = 'https://x.com/author/status/123';
const mediaUrl = `https://video.twimg.com/ext_tw_video/${id}/pu/vid/720x360/a.mp4`;
const html = `expanded_url:"${url}/video/1",media_url_https:"https://pbs.twimg.com/ext_tw_video_thumb/${id}/pu/img/a.jpg",url:"${mediaUrl}"`;
const bytes = Buffer.alloc(4096);
bytes.writeUInt32BE(16); bytes.write('ftyp', 4);
bytes.writeUInt32BE(8, 16); bytes.write('moov', 20);
bytes.writeUInt32BE(bytes.length - 24, 24); bytes.write('mdat', 28);

function payload() {
  const clip = {schema: 'kumo-clip-v1', platformId: 'x', url, dedupeKey: 'x:123', title: 'Fixture post', extractorVersion: '0.8.0', content: 'Only the original post body.', contentHtml: '<p>Only the original post body.</p>', warnings: ['media_download_pending'], stats: {videos: 1, downloadedVideos: 0, images: 1, downloadedImages: 1}, images: [{url: 'https://pbs.twimg.com/media/a.jpg', localFile: 'assets/image-01.jpg'}], videos: [{url: 'blob:https://x.com/local', kind: 'blob', poster: `https://pbs.twimg.com/ext_tw_video_thumb/${id}/pu/img/a.jpg`}], videoContext: {positionSeconds: 4, frameFile: 'assets/frame-01.jpg'}};
  return {schema: 'kumo-x-job-v1', folderName: '2026-10-11--fixture--abcd1234', clip, note: '参考节奏', files: [
    {name: 'source.md', encoding: 'utf8', content: Format.buildMarkdown(clip)},
    {name: 'metadata.json', encoding: 'utf8', content: Format.buildMetadata(clip)},
    {name: 'assets/image-01.jpg', encoding: 'base64', content: Buffer.from('fixture-image').toString('base64')},
    {name: 'assets/frame-01.jpg', encoding: 'base64', content: Buffer.from('fixture-frame').toString('base64')}
  ]};
}

async function fixture(remoteGet, run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-job-'));
  const {server} = createKumoBridge({libraryRoot: root, remoteGet});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try { await run({root, endpoint}); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(root, {recursive: true, force: true}); }
}

async function waitJob(endpoint, id) {
  for (let index = 0; index < 100; index++) {
    const job = await fetch(`${endpoint}/x/jobs/${id}`).then(response => response.json());
    if (job.finishedAt) return job;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('job did not finish');
}

test('X background job survives after the submit request ends and writes all source layers', async () => {
  await fixture(async target => {
    if (target === url) return {bytes: Buffer.from(html), type: 'text/html'};
    assert.equal(target, mediaUrl);
    await new Promise(resolve => setTimeout(resolve, 80));
    return {bytes, type: 'video/mp4'};
  }, async ({root, endpoint}) => {
    const submitted = await fetch(`${endpoint}/x/jobs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload())}).then(response => response.json());
    assert.ok(submitted.jobId, JSON.stringify(submitted));
    const duplicate = await fetch(`${endpoint}/x/jobs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload())}).then(response => response.json());
    assert.equal(duplicate.jobId, submitted.jobId);
    const job = await waitJob(endpoint, submitted.jobId);
    assert.equal(job.phase, 'complete', JSON.stringify(job));
    assert.equal(job.downloadedVideos, 1);
    const folder = path.join(root, job.result.relativePath);
    assert.deepEqual(await readFile(path.join(folder, 'assets/video-01.mp4')), bytes);
    assert.equal(await readFile(path.join(folder, 'assets/image-01.jpg'), 'utf8'), 'fixture-image');
    assert.equal(await readFile(path.join(folder, 'assets/frame-01.jpg'), 'utf8'), 'fixture-frame');
    const source = await readFile(path.join(folder, 'source.md'), 'utf8');
    assert.match(source, /Only the original post body/);
    assert.match(source, /参考节奏/);
    assert.match(source, /4.0 秒/);
    const metadata = JSON.parse(await readFile(path.join(folder, 'metadata.json'), 'utf8'));
    assert.equal(metadata.stats.downloadedVideos, 1);
    assert.ok(!metadata.warnings.includes('media_download_pending'));
  });
});

test('failed public resolution retains source and reports partial instead of false success', async () => {
  await fixture(async () => { throw new Error('remote_http_403'); }, async ({root, endpoint}) => {
    const submitted = await fetch(`${endpoint}/x/jobs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload())}).then(response => response.json());
    const job = await waitJob(endpoint, submitted.jobId);
    assert.equal(job.phase, 'partial');
    assert.equal(job.downloadedVideos, 0);
    assert.ok(job.errors.includes('remote_http_403'));
    const source = await readFile(path.join(root, job.result.relativePath, 'source.md'), 'utf8');
    assert.match(source, /Only the original post body/);
    assert.match(source, /remote_http_403/);
  });
});

test('video repair keeps an older offline image even when it is absent from the new DOM', async () => {
  await fixture(async target => target === url ? {bytes: Buffer.from(html), type: 'text/html'} : {bytes, type: 'video/mp4'}, async ({root, endpoint}) => {
    const original = payload();
    const saved = await fetch(`${endpoint}/clips`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...original, schema: 'kumo-bridge-save-v1'})}).then(response => response.json());
    assert.ok(saved.ok);
    const newer = payload();
    newer.clip.images = [];
    newer.clip.stats.images = 0;
    newer.clip.stats.downloadedImages = 0;
    newer.files = newer.files.filter(file => file.name !== 'assets/image-01.jpg');
    newer.files.find(file => file.name === 'metadata.json').content = Format.buildMetadata(newer.clip);
    const submitted = await fetch(`${endpoint}/x/jobs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(newer)}).then(response => response.json());
    const job = await waitJob(endpoint, submitted.jobId);
    assert.equal(job.phase, 'complete', JSON.stringify(job));
    const folder = path.join(root, job.result.relativePath);
    const metadata = JSON.parse(await readFile(path.join(folder, 'metadata.json'), 'utf8'));
    assert.equal(metadata.stats.downloadedImages, 1);
    assert.equal(metadata.stats.downloadedVideos, 1);
    assert.equal(await readFile(path.join(folder, 'assets/image-01.jpg'), 'utf8'), 'fixture-image');
  });
});

test('bridge does not become an arbitrary remote fetch proxy', async () => {
  for (const target of ['http://video.twimg.com/x.mp4', 'https://127.0.0.1/x', 'https://video.twimg.com.evil.test/x', 'https://user:pass@video.twimg.com/a', 'https://video.twimg.com:444/a']) {
    assert.throws(() => checkRemoteUrl(target, ['video.twimg.com']), /remote_url_not_allowed/);
  }
  await fixture(async () => { throw new Error('must not request'); }, async ({endpoint}) => {
    const rejected = await fetch(`${endpoint}/x/media?url=${encodeURIComponent('https://example.com/video.mp4')}`);
    assert.equal(rejected.status, 400);
    const origin = await fetch(`${endpoint}/x/resolve`, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'https://unrelated.test'}, body: JSON.stringify({url})});
    assert.equal(origin.status, 403);
  });
});

test('X images found in the target DOM are downloaded by the background job too', async () => {
  const photo = 'https://pbs.twimg.com/media/a.jpg';
  await fixture(async target => {
    if (target === url) return {bytes: Buffer.from(html), type: 'text/html'};
    if (target.startsWith(photo)) return {bytes: Buffer.from('real-image-placeholder'), type: 'image/jpeg'};
    return {bytes, type: 'video/mp4'};
  }, async ({root, endpoint}) => {
    const input = payload();
    input.clip.images = [{url: photo}];
    input.clip.stats.downloadedImages = 0;
    input.files = input.files.filter(file => file.name !== 'assets/image-01.jpg');
    input.files.find(file => file.name === 'metadata.json').content = Format.buildMetadata(input.clip);
    const submitted = await fetch(`${endpoint}/x/jobs`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(input)}).then(response => response.json());
    const job = await waitJob(endpoint, submitted.jobId);
    assert.equal(job.phase, 'complete', JSON.stringify(job));
    const saved = JSON.parse(await readFile(path.join(root, job.result.relativePath, 'metadata.json'), 'utf8'));
    assert.equal(saved.stats.downloadedImages, 1);
    assert.equal(await readFile(path.join(root, job.result.relativePath, saved.images[0].localFile), 'utf8'), 'real-image-placeholder');
  });
});
