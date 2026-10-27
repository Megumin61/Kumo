import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {buildModel}=await import('../browser-extension/garden/model.mjs');
const {children,ROOT}=await import('../browser-extension/garden/schema.mjs');
const manifest=JSON.parse(await readFile(path.join(root,'docs/product/source-manifest.json'),'utf8'));
for(const row of manifest.files){for(const dir of ['browser-extension/garden','docs/product'])assert.equal(createHash('sha256').update(await readFile(path.join(root,dir,row.file))).digest('hex'),row.sha256,'Production/demo drift: '+row.file);}
const payload=JSON.parse(await readFile(path.join(root,'docs/product/knowledge.json'),'utf8'));
assert.equal(payload.demo,true);const model=buildModel(payload);assert.equal(model.sources.length,57);assert.equal(model.topics.length,18);assert.equal(model.totals.pending,3);
assert.equal(children(model,ROOT).filter(x=>x.kind==='domain').length,6);
for(const domain of model.groups.filter(g=>g.kind==='domain')){assert.equal(children(model,domain.key).length,3);for(const t of children(model,domain.key))assert.equal(children(model,t.key).length,3);}
for(const s of payload.sources){assert.match(s.author,/示例/);assert.match(s.url,/^sample\.html\?id=[a-f0-9]{24}$/);assert.ok(s.content);}
const endpoints=await readFile(path.join(root,'docs/product/garden-endpoints.mjs'),'utf8');assert.ok(!endpoints.includes('43789'));assert.ok(endpoints.includes("KNOWLEDGE_URL='./knowledge.json'"));
console.log(JSON.stringify({identicalProductFiles:manifest.files.length,sources:model.sources.length,topics:model.topics.length,pending:model.totals.pending,result:'pass'}));
