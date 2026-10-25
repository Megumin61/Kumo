import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createLibrary, itemId} from '../library.mjs';
import {createKumoBridge} from '../server.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kumo-library-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const relative = 'inbox/2026-10-11--example--deadbeef';
  await mkdir(path.join(root, relative, 'assets'), {recursive: true});
  await writeFile(path.join(root, relative, 'source.md'), '# Original evidence');
  await writeFile(path.join(root, relative, 'metadata.json'), JSON.stringify({title: 'Example', url: 'https://example.com/item', capturedAt: '2026-10-11', userNote: '  原始笔记\n\n第二行  ', files: {images: ['assets/image-01.jpg']}}));
  await writeFile(path.join(root, relative, 'assets/image-01.jpg'), 'image');
  return {root, relative, library: createLibrary(root)};
}
test('tag rename and hiding retain associations; notes remain verbatim and append-only', async t => {
  const {root, relative, library} = await fixture(t);
  const tag = await library.updateTag({action: 'add', label: '方法'});
  await library.annotate(relative, {userNote: '  新笔记\r\n\n  不折叠  ', userTags: [tag]});
  await library.updateTag({action: 'rename', id: tag.id, label: '任务方法'});
  await library.updateTag({action: 'hide', id: tag.id});
  const list = await library.list({tag: tag.id});
  assert.equal(list.total, 1); assert.equal(list.tags[0].label, '任务方法'); assert.equal(list.tags[0].hidden, true);
  assert.equal(list.items[0].userTags[0].label, '任务方法');
  assert.equal(list.items[0].userNote, '  新笔记\r\n\n  不折叠  ');
  await library.annotate(relative, {userNote: '下一次心得'});
  const detail = await library.detail(itemId(relative));
  assert.equal(detail.events.length, 2); assert.equal(detail.events[0].note, '  新笔记\r\n\n  不折叠  ');
  assert.equal(await readFile(path.join(root, relative, 'source.md'), 'utf8'), '# Original evidence');
});
test('one source can serve multiple task domains without moving or copying', async t => {
  const {root, relative, library} = await fixture(t);
  await writeFile(path.join(root, 'organization.json'), JSON.stringify({domains: [{id: 'a', name: 'A'}, {id: 'b', name: 'B'}], records: [{sourcePath: relative, domainIds: ['a', 'b'], reuseWhen: ['评估方法'], status: 'organized'}]}));
  assert.equal((await library.list({domain: 'a'})).total, 1);
  assert.equal((await library.list({domain: 'b'})).total, 1);
  assert.equal((await library.list({q: '评估方法'})).items[0].organized, true);
  assert.equal((await library.list({q: '不存在'})).total, 0);
  await assert.rejects(() => library.asset(itemId(relative), '../../secret'));
  await assert.rejects(() => library.detail('../secret'));
  assert.equal(await readFile(await library.asset(itemId(relative), 'assets/image-01.jpg'), 'utf8'), 'image');
});

test('tag deletion is reversible, moves membership to unclassified and preserves raw notes',async t=>{
  const {root,relative,library}=await fixture(t),tag=await library.updateTag({action:'add',label:'用户标签'});
  await library.annotate(relative,{userTags:[tag],userNote:'个人笔记'});
  const source=await readFile(path.join(root,relative,'source.md'),'utf8'),metadata=await readFile(path.join(root,relative,'metadata.json'),'utf8');
  await library.annotate(relative,{userNote:'追加时没有传标签'});
  assert.equal((await library.list({tag:tag.id})).total,1);
  const events=await readFile(path.join(root,'annotations',itemId(relative)+'.json'),'utf8');
  await library.updateTag({action:'delete',id:tag.id});
  assert.equal((await library.list()).allTotal,1);assert.equal((await library.list({tag:'__unclassified'})).total,1);
  assert.deepEqual((await library.detail(itemId(relative))).effectiveUserTags,[]);
  assert.equal(await readFile(path.join(root,'annotations',itemId(relative)+'.json'),'utf8'),events);
  await library.updateTag({action:'restore',id:tag.id});assert.equal((await library.list({tag:tag.id})).total,1);
  assert.equal(await readFile(path.join(root,relative,'source.md'),'utf8'),source);assert.equal(await readFile(path.join(root,relative,'metadata.json'),'utf8'),metadata);
});

test('orphan labels are recovered read-only; corrupt tag registry is never replaced with defaults',async t=>{
  const {root,relative,library}=await fixture(t);
  await library.annotate(relative,{userNote:'笔记',userTags:[{id:'user-id',label:'原标签'}]});
  assert.equal((await library.tags())[0].label,'原标签');
  await assert.rejects(()=>readFile(path.join(root,'tags.json')),/ENOENT/);
  await writeFile(path.join(root,'tags.json'),'{broken');
  await assert.rejects(()=>library.updateTag({action:'add',label:'不能覆盖'}),/preserved/);
  assert.equal(await readFile(path.join(root,'tags.json'),'utf8'),'{broken');
});
test('HTTP duplicate capture preserves new note; sidebar endpoints expose only scoped content', async t => {
  const {root, relative} = await fixture(t);
  const {server} = createKumoBridge({libraryRoot: root});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  const payload = {schema: 'kumo-bridge-save-v1', folderName: '2026-10-11--repeat--feedface', clip: {url: 'https://example.com/item', dedupeSafeUrl: true}, files: [{name: 'source.md', encoding: 'utf8', content: '# Would overwrite'}, {name: 'metadata.json', encoding: 'utf8', content: JSON.stringify({url: 'https://example.com/item', userNote: '追加\n\n  空格 '})}]};
  const saved = await fetch(endpoint + '/clips', {method: 'POST', body: JSON.stringify(payload)}).then(r => r.json());
  assert.equal(saved.duplicate, true);
  const list = await fetch(endpoint + '/library').then(r => r.json());
  assert.equal(list.total, 1); assert.equal(list.items[0].userNote, '追加\n\n  空格 ');
  const detail = await fetch(endpoint + '/library/items/' + itemId(relative)).then(r => r.json());
  assert.equal(detail.events.length, 2); assert.equal(detail.source, '# Original evidence');
  assert.equal(await fetch(endpoint + '/library/items/' + itemId(relative) + '/assets/image-01.jpg').then(r => r.text()), 'image');
});
