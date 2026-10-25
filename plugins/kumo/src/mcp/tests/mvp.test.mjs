import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEvidenceLibrary} from '../library.mjs';
import {sourceSnapshot} from '../snapshot.mjs';

async function fixture(t,count=12){
  const root=await mkdtemp(path.join(os.tmpdir(),'kumo-mvp-'));t.after(async()=>{sourceSnapshot(root).close();await rm(root,{recursive:true,force:true,maxRetries:5});});
  for(const directory of ['inbox','archive','domains','annotations'])await mkdir(path.join(root,directory));
  const ids=[];for(let index=0;index<count;index++){
    const relative='inbox/item-'+index,id=createHash('sha256').update(relative).digest('hex').slice(0,24);ids.push(id);await mkdir(path.join(root,relative));
    await writeFile(path.join(root,relative,'source.md'),'## 正文\n'+(index===0?'导航分层提供稳定路径。':index===1?'交互反馈给出即时响应。':'共同测试材料 '+index));
    await writeFile(path.join(root,relative,'metadata.json'),JSON.stringify({title:'材料 '+index,platform:index===1?'小红书':'文章',url:'https://example.com/'+index,userNote:index===2?'键盘操作提示':'',userTags:index===11?[{id:'manual',label:'我的标签'}]:[],files:index===3?{images:['assets/image-01.png']}:{}}));
  }
  return {root,ids,library:await createEvidenceLibrary(root,{allowOrganize:true})};
}
async function compile(library,ids){
  const queue=await library.compilationQueue({all:true,limit:20});
  const domains=[{id:'design',name:'界面设计',scope:'交互设计',summary:'形成稳定路径',triggers:['界面'],avoidWhen:[]},{id:'systems',name:'系统设计',scope:'系统反馈',summary:'处理状态反馈',triggers:['系统'],avoidWhen:[]}];
  const topics=Array.from({length:10},(_,index)=>({id:'topic-'+index,domainId:'design',name:'子主题 '+index,scope:'导航',summary:'导航分层',triggers:['分层'],avoidWhen:[]}));
  const cards=queue.items.map(item=>({id:item.id,fingerprint:item.fingerprint,summary:item.id===ids[3]?'图片排版记录':'来源贡献',domainIds:[item.id===ids[1]?'systems':'design'],topicIds:item.id===ids[0]?['topic-0']:[],reuseWhen:[],avoidWhen:[],limitations:[],inspectedImages:item.id===ids[3]?['assets/image-01.png']:[],evidence:item.id===ids[3]?[{view:'image',resource:'assets/image-01.png',quote:'高对比文字'}]:[{view:'body',quote:item.id===ids[0]?'导航分层提供稳定路径。':item.id===ids[1]?'交互反馈给出即时响应。':'共同测试材料 '+ids.indexOf(item.id)}]}));
  domains[0].knowledge={takeaways:['渐进披露适用于分层导航'],steps:['只显示当前分支'],checks:['返回可恢复'],openQuestions:[],evidence:[{sourceId:ids[0],view:'body',quote:'导航分层提供稳定路径。'}]};
  const relations=[{from:ids[0],to:ids[1],type:'complements',reason:'稳定导航配合即时反馈',fromQuote:'导航分层提供稳定路径。',toQuote:'交互反馈给出即时响应。'}];
  const input={domains,topics,cards,relations};await library.saveWiki((await library.previewWiki(input)).planId);return input;
}
test('MVP fixed twelve retrieval cases include raw, notes, image observations, methods, scopes and one-hop evidence',async t=>{
  const {root,ids,library}=await fixture(t);await compile(library,ids);
  const alias=path.join(root,'selected-root');await symlink(root,alias,process.platform==='win32'?'junction':'dir');assert.equal(sourceSnapshot(alias),sourceSnapshot(root));await unlink(alias);
  const cases=[
    ['导航分层',{},ids[0]],['键盘操作',{},ids[2]],['高对比文字',{},ids[3]],['渐进披露',{},ids[0]],['只显示当前分支',{},ids[0]],
    ['材料 11',{collection:'manual'},ids[11]],['交互反馈',{platform:'小红书'},ids[1]],['材料 4',{domain:'design'},ids[4]],
    ['导航分层',{},ids[1]],['材料 11',{},ids[11]],['不存在的量子纠缠',{},null],['交互反馈',{platform:'文章'},null]
  ];
  for(const [query,filters,expected]of cases){const hits=(await library.search(query,filters)).results;if(expected)assert.ok(hits.some(hit=>hit.id===expected),query);else assert.equal(hits.length,0,query);if(filters.collection)assert.ok(hits.every(hit=>hit.collections.some(tag=>tag.id===filters.collection)));if(filters.platform)assert.ok(hits.every(hit=>hit.platform===filters.platform));}
  assert.ok((await library.search('导航分层')).results.find(hit=>hit.id===ids[1]).relatedVia);
  const before=library.indexMetrics.bodyReads;await library.search('导航分层');assert.equal(library.indexMetrics.bodyReads,before);
  await writeFile(path.join(root,'inbox/item-0/source.md'),'## 正文\n更新导航证据');sourceSnapshot(root).invalidate();
  await library.search('更新导航');assert.equal(library.indexMetrics.bodyReads,before+1);
  assert.equal((await library.search('高对比文字')).results.some(hit=>hit.id===ids[3]),true);
  assert.equal((await library.search('渐进披露')).results.some(hit=>hit.id===ids[0]),false);
});
test('focus pages children, evidence and related nodes; compilation context reports removed relations and protects sources',async t=>{
  const {root,ids,library}=await fixture(t),input=await compile(library,ids);
  const raw=await readFile(path.join(root,'inbox/item-0/source.md'),'utf8');
  const overview=await library.knowledgeFocus();assert.equal(overview.children.length,2);assert.equal(overview.sources.length,0);
  const focus=await library.knowledgeFocus({kind:'domain',id:'design'});assert.equal(focus.children.length,8);assert.equal(focus.nextOffset,8);assert.equal(focus.related.length,1);assert.equal(focus.related[0].relations[0].toQuote,'交互反馈给出即时响应。');assert.equal(focus.sources.length,0);
  const page=await library.knowledgeFocus({kind:'domain',id:'design',offset:8,sources:true});assert.equal(page.children.length,2);assert.equal(page.sources.length,10);assert.equal(page.nextSourceOffset,10);
  const topic=await library.knowledgeFocus({kind:'topic',id:'topic-0'});assert.deepEqual(topic.breadcrumbs.map(node=>node.name),['Kumo','界面设计','子主题 0']);
  const atlas=await library.knowledgeAtlas();assert.equal(atlas.nodes.length,2);assert.equal(atlas.edges.length,1);assert.ok(JSON.stringify(atlas).length<2000);
  const branches=await library.knowledgeFocus({kind:'domain',id:'design',childLimit:3});assert.equal(branches.children.length,3);assert.equal(branches.nextOffset,3);
  await assert.rejects(library.knowledgeFocus({kind:'topic',id:'missing'}),/不存在/);await assert.rejects(library.knowledgeFocus({offset:-1}),/分页/);
  const context=await library.compilationContext({ids:[ids[0]],query:'导航'});assert.ok(context.candidates.length<=6);assert.equal(context.existingRelations.length,1);
  const preview=await library.previewWiki({domains:[],topics:[],cards:[input.cards.find(item=>item.id===ids[0])],relations:[]});assert.equal(preview.removedRelations.length,1);
  const revision=(await library.wikiMap()).revision;await library.saveWiki(preview.planId);assert.equal((await library.compilationQueue()).total,0);assert.equal((await library.knowledgeFocus({kind:'domain',id:'design'})).related.length,0);assert.equal((await library.wikiMap()).revision,revision+1);assert.equal(await readFile(path.join(root,'inbox/item-0/source.md'),'utf8'),raw);
});
test('1000 fixed-length sources: cached search P95 <= 150ms, no repeated body reads', {timeout:300000},async t=>{
  const {root,library}=await fixture(t,0),body='固定长度的知识索引效率验证。'.repeat(80).slice(0,1000),memory=process.memoryUsage().heapUsed;
  for(let start=0;start<1000;start+=20)await Promise.all(Array.from({length:20},async(_,offset)=>{const index=start+offset,directory=path.join(root,'inbox','benchmark-'+index);await mkdir(directory);await Promise.all([writeFile(path.join(directory,'source.md'),'## 正文\n'+body),writeFile(path.join(directory,'metadata.json'),JSON.stringify({title:'知识索引 '+index,url:'https://example.com/'+index,userTags:[],files:{}}))]);}));
  const coldStart=performance.now();await library.search('知识索引');const coldMs=performance.now()-coldStart,reads=library.indexMetrics.bodyReads,durations=[];
  for(let iteration=0;iteration<30;iteration++){const started=performance.now();assert.equal((await library.search('知识索引')).results.length,8);durations.push(performance.now()-started);}
  durations.sort((first,second)=>first-second);const p95=durations[Math.ceil(durations.length*.95)-1];
  assert.equal(library.indexMetrics.bodyReads,reads);assert.ok(p95<=150,'P95 '+p95);
  t.diagnostic(JSON.stringify({node:process.version,sources:1000,bodyCharacters:1000,coldMs:Math.round(coldMs),p95Ms:Math.round(p95*100)/100,heapDeltaMiB:Math.round((process.memoryUsage().heapUsed-memory)/1048576),bodyReads:reads}));
});
