import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEvidenceLibrary} from '../library.mjs';
import {createLibrary} from '../../../../../local-bridge/library.mjs';
import {createKumoMcp} from '../tools.mjs';
import {createKumoBridge} from '../../../../../local-bridge/server.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';

async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'kumo-wiki-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5}));
 for(const d of ['inbox','archive','domains','annotations'])await mkdir(path.join(root,d));
 const ids=[];for(const [i,title,body]of [['a','按钮反馈','硬边按钮提供点击反馈。'],['b','导航布局','导航层级要清晰。']]){const rel='inbox/'+i;await mkdir(path.join(root,rel));await writeFile(path.join(root,rel,'source.md'),'## 正文\n'+body+'\n## 讨论快照\n评论不能冒充正文。');await writeFile(path.join(root,rel,'metadata.json'),JSON.stringify({title,url:'https://example.com/'+i,platform:'X',userNote:' 原始笔记\n',userTags:[],files:{}}));ids.push(createHash('sha256').update(rel).digest('hex').slice(0,24));}
 return {root,ids,library:await createEvidenceLibrary(root,{allowOrganize:true}),bridge:createLibrary(root)};
}
const domain={id:'design',name:'设计',scope:'界面设计',summary:'交互反馈与导航结构',triggers:['界面','按钮','导航'],avoidWhen:['无关任务']};
const topic={...domain,id:'feedback',domainId:'design',name:'交互反馈'};

test('domain parents route and count descendant sources without altering user tags',async t=>{
 const {library,bridge,ids,root}=await fixture(t),b=await batch(library,ids);
 const tag=await bridge.updateTag({action:'add',label:'用户自己命名'});await bridge.annotate('inbox/a',{userTags:[tag]});
 const refreshed=await batch(library,ids);refreshed.domains=[{...domain,id:'product',name:'产品'}, {...domain,parentDomainId:'product'}];
 refreshed.cards[0].domainIds=['product','design'];
 await library.saveWiki((await library.previewWiki(refreshed)).planId);
 const map=await library.wikiMap();assert.equal(map.nodes.length,1);assert.equal(map.nodes[0].sourceCount,2);
 assert.equal((await library.wikiMap({parent:'product'})).nodes[0].id,'design');
 assert.equal((await library.readWiki({kind:'domain',id:'product'})).total,2);
 assert.equal((await library.route({query:'可点击控件',domain:'product'})).sources.length,2);
 assert.equal((await library.knowledgeGraph()).nodes.find(n=>n.id==='product').sourceCount,2);
 assert.equal((await bridge.list()).items.find(n=>n.id===ids[0]).userTags[0].id,tag.id);
 await assert.rejects(()=>library.previewWiki({domains:[{...domain,parentDomainId:'missing'}],topics:[],cards:[],relations:[]}),/父领域/);
 await assert.rejects(()=>library.previewWiki({domains:[{...domain,id:'product',parentDomainId:'design'}],topics:[],cards:[],relations:[]}),/有环/);
 await writeFile(path.join(root,'inbox/a/source.md'),'## 正文\n更新来源');
 assert.equal((await library.wikiMap()).nodes[0].summaryNeedsReview,true);
});

test('image evidence needs a declared source resource and methods preserve the image locator',async t=>{
 const {root,library,ids}=await fixture(t);const metaPath=path.join(root,'inbox/a/metadata.json'),meta=JSON.parse(await readFile(metaPath,'utf8'));meta.files={images:['assets/image-01.png','assets/image-02.png']};await writeFile(metaPath,JSON.stringify(meta));
 const b=await batch(library,ids);b.cards[0].evidence=[{view:'image',resource:'assets/image-01.png',quote:'测试图像观察'}];
 await assert.rejects(()=>library.previewWiki(b),/图片证据/);
 b.cards[0].inspectedImages=['assets/image-01.png'];b.domains[0]={...domain,knowledge:{takeaways:['图像中的一种编排示例'],steps:[],checks:[],openQuestions:[],evidence:[{sourceId:ids[0],...b.cards[0].evidence[0]}]}};
 await library.saveWiki((await library.previewWiki(b)).planId);
 assert.equal((await library.readWiki({kind:'domain',id:'design'})).node.knowledge.evidence[0].resource,'assets/image-01.png');
 b.domains[0].knowledge.evidence[0].resource='assets/image-02.png';await assert.rejects(()=>library.previewWiki(b),/领域方法证据/);
 b.domains[0].knowledge.evidence[0].resource='assets/image-01.png';b.cards[0].evidenceStatus='index_only';await assert.rejects(()=>library.previewWiki(b),/仅索引/);
 delete b.domains[0].knowledge;await library.saveWiki((await library.previewWiki(b)).planId);
 assert.equal((await library.knowledgeGraph()).indexOnly,1);
 assert.equal((await library.readWiki({kind:'domain',id:'design'})).cards.find(c=>c.id===ids[0]).evidenceStatus,'index_only');
 assert.equal((await library.route({query:'可点击控件'})).sources.find(c=>c.id===ids[0]).evidenceStatus,'index_only');
});

test('organize classifies before compilation, preserves manual collections and is incrementally repeatable',async t=>{
 const {root,library,bridge,ids}=await fixture(t),tag=await bridge.updateTag({action:'add',label:'用户标签'});await bridge.annotate('inbox/a',{userTags:[tag],userNote:' 用户原笔记 '});
 const raw=await readFile(path.join(root,'inbox/a/metadata.json'),'utf8');
 await library.saveWiki((await library.previewWiki(await batch(library,ids))).planId);
 const before=await library.compilationQueue({all:true});await bridge.classify({id:ids[1],label:'用户标签',reason:'适合已有标签',expectedFingerprint:before.items.find(c=>c.id===ids[1]).fingerprint});
 assert.equal((await library.compilationQueue()).total,1,'Classification invalidates previous annotation fingerprint');
 const refreshed=await batch(library,ids);await library.saveWiki((await library.previewWiki(refreshed)).planId);
 assert.equal((await library.compilationQueue()).total,0);assert.equal((await bridge.tags()).length,1);assert.equal((await library.knowledgeGraph()).compiled,2);
 assert.equal((await library.fetch(ids[0])).metadata.userNotes[0],' 用户原笔记 ');assert.equal((await bridge.list()).items.find(i=>i.id===ids[0]).userTags[0].id,tag.id);assert.equal(await readFile(path.join(root,'inbox/a/metadata.json'),'utf8'),raw);
});
async function batch(library,ids){const q=await library.compilationQueue({all:true});return {domains:[domain],topics:[topic],cards:ids.map((id,i)=>({id,fingerprint:q.items.find(s=>s.id===id).fingerprint,summary:i?'导航要匹配信息层级':'压下反馈使控件更可点击',domainIds:['design'],topicIds:['feedback'],reuseWhen:['可点击控件设计'],avoidWhen:['严肃密集表格'],evidence:[{view:'body',quote:i?'导航层级要清晰。':'硬边按钮提供点击反馈。'}],inspectedImages:[],limitations:['没有视频证据']})),relations:[]};}

test('domain methods and nested topics require fresh evidence and preserve user labels',async t=>{
 const {root,library,ids,bridge}=await fixture(t),b=await batch(library,ids);
 const label=await bridge.updateTag({action:'add',label:'用户原标签'});await bridge.annotate('inbox/a',{userTags:[label],userNote:'原笔记'});
 const updated=await batch(library,ids);updated.domains[0]={...domain,knowledge:{takeaways:['让反馈清晰可见'],steps:['检查按钮状态'],checks:['反馈可辨认'],openQuestions:['触屏效果待验证'],evidence:[{sourceId:ids[0],view:'body',quote:'硬边按钮提供点击反馈。'}]}};
 updated.topics.push({...topic,id:'button',parentTopicId:'feedback',name:'按钮反馈'});
 await library.saveWiki((await library.previewWiki(updated)).planId);
 assert.equal((await library.knowledgeGraph()).nodes.find(n=>n.id==='design').summaryNeedsReview,false);
 assert.equal((await library.readWiki({kind:'topic',id:'feedback'})).children[0].id,'button');
 assert.equal((await bridge.list()).items.find(x=>x.id===ids[0]).userTags[0].id,label.id);
 const invalid={domains:[{...updated.domains[0],knowledge:{...updated.domains[0].knowledge,evidence:[{sourceId:ids[0],view:'body',quote:'编造的领域真理'}]}}],topics:[],cards:[],relations:[]};
 await assert.rejects(()=>library.previewWiki(invalid),/证据/);
 await writeFile(path.join(root,'inbox/a/source.md'),'## 正文\n来源已改变');
 assert.equal((await library.knowledgeGraph()).nodes.find(n=>n.id==='design').summaryNeedsReview,true);
 const cycle={domains:[],cards:[],relations:[],topics:[{...topic,parentTopicId:'button'}]};
 await assert.rejects(()=>library.previewWiki(cycle),/有环/);
});

test('deleting a label is reflected in MCP and does not delete source cards or files',async t=>{
 const {library,bridge,ids}=await fixture(t),tag=await bridge.updateTag({action:'add',label:'待删除'});
 await bridge.annotate('inbox/a',{userTags:[tag],userNote:'笔记'});
 await library.saveWiki((await library.previewWiki(await batch(library,ids))).planId);
 await bridge.updateTag({action:'delete',id:tag.id});
 assert.equal((await library.fetch(ids[0])).metadata.collections.length,0);
 assert.equal((await library.list()).total,2);assert.equal((await library.knowledgeGraph()).compiled,2);
 await bridge.updateTag({action:'restore',id:tag.id});assert.equal((await library.fetch(ids[0])).metadata.collections[0].id,tag.id);
});
test('bootstrap, hierarchy, scoped routing, queue resume and persisted Wiki reopen',async t=>{const {library,root,ids}=await fixture(t);assert.equal((await library.wikiMap()).initialized,false);
 const b=await batch(library,ids),p=await library.previewWiki(b);assert.equal((await library.wikiMap()).compiled,0);await library.saveWiki(p.planId);
 assert.equal((await library.wikiMap()).compiled,2);assert.equal((await library.wikiMap({parent:'design'})).nodes[0].id,'feedback');assert.equal((await library.compilationQueue()).total,0);
 assert.equal((await library.readWiki({kind:'domain',id:'design'})).cards.length,2);assert.equal((await library.route({query:'可点击控件'})).sources.length,2);assert.equal((await library.route({query:'量子力学'})).sources.length,0);
 assert.equal((await library.search('可点击控件',{platform:'不存在'})).results.length,0);
 const reopened=await createEvidenceLibrary(root);assert.equal((await reopened.wikiMap()).revision,1);await assert.rejects(()=>reopened.saveWiki(p.planId),/未启用/);
 assert.match(await readFile(path.join(root,'inbox/a/source.md'),'utf8'),/硬边按钮/);
});
test('changed source invalidates cards, routes and summaries; compilation queue exposes it',async t=>{const {library,root,ids}=await fixture(t),p=await library.previewWiki(await batch(library,ids));await library.saveWiki(p.planId);
 await writeFile(path.join(root,'inbox/a/source.md'),'## 正文\n新内容');assert.equal((await library.compilationQueue()).total,1);assert.equal((await library.readWiki({kind:'card',id:ids[0]})).stale,true);assert.equal((await library.readWiki({kind:'domain',id:'design'})).summaryNeedsReview,true);assert.ok(!(await library.route({query:'压下反馈'})).sources.some(s=>s.id===ids[0]));
});
test('unsupported quotations, cross-view quotes, unknown nodes and fabricated links are rejected',async t=>{const {library,ids}=await fixture(t);let b=await batch(library,ids);b.cards[0].evidence[0].quote='伪造事实';await assert.rejects(()=>library.previewWiki(b),/证据/);
 b=await batch(library,ids);b.cards[0].evidence[0].quote='评论不能冒充正文。';await assert.rejects(()=>library.previewWiki(b),/证据/);
 b=await batch(library,ids);b.cards[0].domainIds=['missing'];await assert.rejects(()=>library.previewWiki(b),/领域/);
 b=await batch(library,ids);b.relations=[{from:ids[0],to:ids[1],type:'complements',reason:'二者组合',fromQuote:'伪造',toQuote:'导航层级要清晰。'}];await assert.rejects(()=>library.previewWiki(b),/关联必须/);
});
test('relations are navigable and recompilation invalidates prior endpoint links',async t=>{const {library,ids}=await fixture(t),b=await batch(library,ids);b.relations=[{from:ids[0],to:ids[1],type:'complements',reason:'控件反馈与导航层级解决不同交互问题',fromQuote:'硬边按钮提供点击反馈。',toQuote:'导航层级要清晰。'}];await library.saveWiki((await library.previewWiki(b)).planId);assert.equal((await library.readWiki({kind:'topic',id:'feedback'})).relations.length,1);
 const next=await batch(library,ids);await library.saveWiki((await library.previewWiki({...next,cards:next.cards.slice(0,1)})).planId);assert.equal((await library.readWiki({kind:'topic',id:'feedback'})).relations.length,0);
});
test('optimistic revisions and fingerprints prevent stale publication',async t=>{const {library,root,ids}=await fixture(t),b=await batch(library,ids),a=await library.previewWiki(b),other=await library.previewWiki(b);await library.saveWiki(a.planId);await assert.rejects(()=>library.saveWiki(other.planId),/Wiki 已更新/);
 const p=await library.previewWiki(await batch(library,ids));await writeFile(path.join(root,'inbox/a/source.md'),'changed');await assert.rejects(()=>library.saveWiki(p.planId),/来源已变化/);
});
test('classification preserves raw packages and notes, reuses tags and refuses stale/manual changes',async t=>{const {library,root,ids,bridge}=await fixture(t),q=await library.compilationQueue();const source=await readFile(path.join(root,'inbox/a/source.md'),'utf8');
 const r=await bridge.classify({id:ids[0],label:'设计参考',reason:'按钮方法',expectedFingerprint:q.items.find(x=>x.id===ids[0]).fingerprint});assert.equal(r.tag.label,'设计参考');assert.equal((await bridge.list()).items.find(x=>x.id===ids[0]).userNote,' 原始笔记\n');
 assert.equal(await readFile(path.join(root,'inbox/a/source.md'),'utf8'),source);await assert.rejects(()=>library.previewClassification({id:ids[0],label:'另一类',reason:'不应替换'}),/人手分类/);
 const latest=await library.compilationQueue({all:true});const second=await bridge.classify({id:ids[1],label:'设计参考',reason:'导航方法',expectedFingerprint:latest.items.find(x=>x.id===ids[1]).fingerprint});assert.equal(second.tag.id,r.tag.id);
 await assert.rejects(()=>bridge.classify({id:ids[0],label:'新类',reason:'过期',expectedFingerprint:q.items[0].fingerprint}),/changed/);
});
test('classification connector validates same library and updated bridge',async t=>{const {library,root,ids,bridge}=await fixture(t);const server=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.url==='/status')return res.end(JSON.stringify({service:'kumo-local-bridge',libraryRoot:root,capabilities:['ai_classification']}));let raw='';for await(const c of req)raw+=c;try{res.end(JSON.stringify(await bridge.classify(JSON.parse(raw))));}catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.message}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const connected=await createEvidenceLibrary(root,{allowOrganize:true,bridgeUrl:'http://127.0.0.1:'+server.address().port});const p=await connected.previewClassification({id:ids[0],label:'设计参考',reason:'按钮反馈'});assert.equal((await connected.saveClassification(p.planId)).saved,true);
 assert.equal((await library.collections()).tags[0].count,1);
});
test('real MCP discovery exposes bounded Wiki schema and hides all save tools in read-only mode',async t=>{const {library,ids}=await fixture(t);const server=createKumoMcp(library,{canWrite:true}),client=new Client({name:'wiki-test',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);t.after(()=>client.close());
 const tools=(await client.listTools()).tools;assert.equal(tools.find(t=>t.name==='save_wiki_batch').annotations.readOnlyHint,false);assert.equal(tools.find(t=>t.name==='route_wiki').annotations.readOnlyHint,true);
 const p=await client.callTool({name:'preview_wiki_batch',arguments:await batch(library,ids)});assert.equal(p.isError,undefined);const saved=await client.callTool({name:'save_wiki_batch',arguments:{planId:p.structuredContent.planId}});assert.equal(saved.structuredContent.saved,true);
 const invalid=await client.callTool({name:'preview_wiki_batch',arguments:{domains:[],topics:[],cards:[],relations:[]}});assert.equal(invalid.isError,true);
});
test('real local bridge integrates classification with visible collection list and rejects another root',async t=>{const {root,ids}=await fixture(t),{server}=createKumoBridge({libraryRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const bridgeUrl='http://127.0.0.1:'+server.address().port;
 const connected=await createEvidenceLibrary(root,{allowOrganize:true,bridgeUrl});const p=await connected.previewClassification({id:ids[0],label:'设计参考',reason:'按钮证据'});assert.equal((await connected.saveClassification(p.planId)).saved,true);
 const visible=await (await fetch(bridgeUrl+'/library')).json();assert.equal(visible.collectionCounts[0].count,1);assert.equal(visible.items.find(i=>i.id===ids[0]).userNote,' 原始笔记\n');
 const other=await fixture(t);const mismatch=await createEvidenceLibrary(other.root,{allowOrganize:true,bridgeUrl});const wrong=await mismatch.previewClassification({id:other.ids[0],label:'设计参考',reason:'不得写错库'});await assert.rejects(()=>mismatch.saveClassification(wrong.planId),/同一资料库/);
});
test('Wiki junction cannot redirect publication outside the authorized root',async t=>{const {root,library,ids}=await fixture(t),outside=await mkdtemp(path.join(os.tmpdir(),'kumo-wiki-outside-'));t.after(()=>rm(outside,{recursive:true,force:true,maxRetries:5}));const p=await library.previewWiki(await batch(library,ids));await symlink(outside,path.join(root,'wiki'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(()=>library.saveWiki(p.planId),/授权库/);
});
