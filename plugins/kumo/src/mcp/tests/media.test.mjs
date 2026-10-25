import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEvidenceLibrary} from '../library.mjs';
import {runProcess} from '../media-preparation.mjs';
import {createKumoMcp} from '../tools.mjs';
import {createKumoBridge} from '../../../../../local-bridge/server.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import http from 'node:http';
const python=process.env.KUMO_PYTHON||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'kumo-media-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5}));for(const d of ['inbox/a/assets','archive','domains','annotations'])await mkdir(path.join(root,d),{recursive:true});
const id=createHash('sha256').update('inbox/a').digest('hex').slice(0,24),source='## 正文\n原始正文保留。';await writeFile(path.join(root,'inbox/a/source.md'),source);return {root,id,source};}
test('ordered image reading crops tall pages, caches, preserves originals and invalidates edited media',async t=>{
 const {root,id,source}=await fixture(t),directory=path.join(root,'inbox/a/assets');
 await runProcess(python,['-c','from PIL import Image;import sys;Image.new("RGB",(400,4000),"white").save(sys.argv[1]);Image.new("RGB",(400,400),"red").save(sys.argv[2])',path.join(directory,'image-01.png'),path.join(directory,'image-02.png')]);
 const metadata={title:'多图',url:'https://example.com/a',files:{images:['assets/image-01.png','assets/image-02.png']}};const raw=JSON.stringify(metadata);await writeFile(path.join(root,'inbox/a/metadata.json'),raw);
 const lib=await createEvidenceLibrary(root,{allowOrganize:true});t.after(()=>lib.close());const first=await lib.prepareMedia({id});assert.equal(first.status,'ready');assert.equal(first.previews[0].resource,'assets/image-01.png');assert.ok(first.previews.filter(p=>p.resource.endsWith('01.png')).length>1);assert.equal(first.previews.at(-1).resource,'assets/image-02.png');assert.ok((await lib.image(id,'prepared/'+first.sheets[0].name)).data.length>0);
 assert.equal((await lib.prepareMedia({id})).preparedAt,first.preparedAt);await assert.rejects(()=>lib.image(id,'prepared/../../source.md'));assert.equal(await readFile(path.join(root,'inbox/a/source.md'),'utf8'),source);assert.equal(await readFile(path.join(root,'inbox/a/metadata.json'),'utf8'),raw);
 await writeFile(path.join(directory,'image-02.png'),'changed');assert.equal((await lib.readPreparedMedia({id})).status,'stale');await assert.rejects(()=>lib.image(id,'prepared/'+first.sheets[0].name),/not_ready/);
});
test('silent video has timed frames, no fabricated transcript and supports validated prepared evidence',async t=>{
 const {root,id}=await fixture(t);const video=path.join(root,'inbox/a/assets/video-01.mp4');await runProcess('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc=size=160x120:rate=5','-t','2','-pix_fmt','yuv420p','-y',video]);
 await writeFile(path.join(root,'inbox/a/metadata.json'),JSON.stringify({title:'视频',url:'https://example.com/video',files:{videos:['assets/video-01.mp4']}}));const lib=await createEvidenceLibrary(root,{allowOrganize:true});t.after(()=>lib.close());const prepared=await lib.prepareMedia({id,transcribe:true});assert.equal(prepared.videos[0].transcript.status,'no_audio');assert.ok(prepared.videos[0].frames.length>=2);assert.equal(prepared.coverage.fullVideoUnderstood,false);
 const q=await lib.compilationQueue({all:true}),resource='prepared/'+prepared.previews[0].name;
 const batch={domains:[{id:'video',name:'视频',summary:'视频参考',scope:'视频',triggers:[],avoidWhen:[]}],topics:[],relations:[],cards:[{id,fingerprint:q.items[0].fingerprint,mediaFingerprint:prepared.fingerprint,domainIds:['video'],topicIds:[],summary:'测试画面',keywords:['测试'],reuseWhen:[],avoidWhen:[],evidence:[{view:'image',resource,quote:'观察到测试图形'}],inspectedImages:[resource],limitations:['抽帧观察']} ]};
 await lib.saveWiki((await lib.previewWiki(batch)).planId);assert.equal((await lib.knowledgeGraph()).compiled,1);
 batch.cards[0].mediaFingerprint='a'.repeat(64);await assert.rejects(()=>lib.previewWiki(batch),/媒体已变化/);
 await writeFile(video,'invalid');await lib.refresh();assert.equal((await lib.knowledgeGraph()).compiled,0);assert.equal((await lib.route({query:'测试'})).sources.length,0);
});
test('read-only libraries cannot start preparation',async t=>{const {root,id}=await fixture(t);await writeFile(path.join(root,'inbox/a/metadata.json'),'{}');const lib=await createEvidenceLibrary(root);t.after(()=>lib.close());await assert.rejects(()=>lib.prepareMedia({id}),/read_only/);});

test('optional transcription defaults off, handles audio and records authentication failure using a localhost fixture',async t=>{
 const {root,id}=await fixture(t),video=path.join(root,'inbox/a/assets/video-01.mp4');await runProcess('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=blue:size=160x120:rate=5','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','1','-pix_fmt','yuv420p','-c:a','aac','-y',video]);await writeFile(path.join(root,'inbox/a/metadata.json'),JSON.stringify({title:'合成音频视频',files:{videos:['assets/video-01.mp4']}}));
 let calls=0,fail=false;const server=http.createServer(async(req,res)=>{assert.equal(req.url,'/v1/audio/transcriptions');assert.equal(req.headers.authorization,'Bearer fixture-local-only');let length=0;for await(const part of req)length+=part.length;assert.ok(length>100);calls++;res.writeHead(fail?401:200,{'Content-Type':'application/json'});res.end(JSON.stringify(fail?{error:'fixture rejection'}:{text:'本地测试文字稿'}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const previousKey=process.env.OPENAI_API_KEY,previousBase=process.env.OPENAI_BASE_URL;process.env.OPENAI_API_KEY='fixture-local-only';process.env.OPENAI_BASE_URL='http://127.0.0.1:'+server.address().port+'/v1/';t.after(()=>{if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;if(previousBase===undefined)delete process.env.OPENAI_BASE_URL;else process.env.OPENAI_BASE_URL=previousBase;});
 const lib=await createEvidenceLibrary(root,{allowOrganize:true});t.after(()=>lib.close());const local=await lib.prepareMedia({id});assert.equal(local.videos[0].transcript.status,'not_requested');assert.equal(calls,0);
 const transcribed=await lib.prepareMedia({id,transcribe:true});assert.equal(transcribed.videos[0].transcript.text,'本地测试文字稿');assert.equal(transcribed.videos[0].transcript.status,'completed');assert.equal(calls,1);assert.equal(transcribed.videos[0].transcript.segments[0].startSeconds,0);
 const card={id,fingerprint:(await lib.compilationQueue()).items[0].fingerprint,mediaFingerprint:transcribed.fingerprint,domainIds:['audio'],topicIds:[],summary:'测试文字稿',reuseWhen:[],avoidWhen:[],limitations:[],evidence:[{view:'transcript',quote:'本地测试文字稿'}],inspectedImages:[]};await lib.saveWiki((await lib.previewWiki({domains:[{id:'audio',name:'音频',scope:'音频',summary:'音频',triggers:[],avoidWhen:[]}],topics:[],cards:[card],relations:[]})).planId);
 fail=true;const rejected=await lib.prepareMedia({id,transcribe:true,force:true});assert.equal(rejected.videos[0].transcript.status,'authentication_failed');assert.equal((await lib.knowledgeGraph()).compiled,0);
});

test('local OCR evidence is searchable, versioned and cannot impersonate body evidence',{skip:process.platform!=='win32'},async t=>{
 const {root,id}=await fixture(t),file=path.join(root,'inbox/a/assets/image-01.png');
 await runProcess(python,['-c','from PIL import Image,ImageDraw,ImageFont;import sys;im=Image.new("RGB",(1200,300),"white");ImageDraw.Draw(im).text((40,80),"KUMO EVIDENCE",font=ImageFont.truetype("C:/Windows/Fonts/arial.ttf",64),fill="black");im.save(sys.argv[1])',file]);
 await writeFile(path.join(root,'inbox/a/metadata.json'),JSON.stringify({title:'图片文字',files:{images:['assets/image-01.png']}}));const lib=await createEvidenceLibrary(root,{allowOrganize:true});t.after(()=>lib.close());
 const prepared=await lib.prepareMedia({id,ocr:true}),item=prepared.ocr.items.find(i=>i.text.includes('EVIDENCE'));assert.equal(prepared.ocr.status,'completed');assert.ok(item);
 await lib.refresh();assert.equal((await lib.search('EVIDENCE')).results[0].id,id);
 const card={id,fingerprint:(await lib.compilationQueue()).items[0].fingerprint,mediaFingerprint:prepared.fingerprint,domainIds:['text'],topicIds:[],summary:'图片中的标题文字',reuseWhen:[],avoidWhen:[],limitations:[],evidence:[{view:'ocr',resource:'prepared/'+item.name,quote:'EVIDENCE'}],inspectedImages:[]};
 const batch={domains:[{id:'text',name:'文字',scope:'图片文字',summary:'图片文字',triggers:[],avoidWhen:[]}],topics:[],relations:[],cards:[card]};await lib.saveWiki((await lib.previewWiki(batch)).planId);
 card.evidence[0].view='body';await assert.rejects(()=>lib.previewWiki(batch),/证据摘录/);
});

test('MCP exposes preparation only to writers; bridge jobs return cached media and reject invalid flags',async t=>{
 const {root,id}=await fixture(t);await writeFile(path.join(root,'inbox/a/metadata.json'),'{}');const lib=await createEvidenceLibrary(root,{allowOrganize:true});t.after(()=>lib.close());
 for(const canWrite of [false,true]){const server=createKumoMcp(lib,{canWrite}),client=new Client({name:'media-test',version:'1'}),[a,b]=InMemoryTransport.createLinkedPair();await server.connect(a);await client.connect(b);const names=(await client.listTools()).tools;assert.equal(names.some(t=>t.name==='prepare_media'),canWrite);if(canWrite){const result=await client.callTool({name:'prepare_media',arguments:{id}});assert.equal(result.structuredContent.status,'ready');}await client.close();}
 const {server}=createKumoBridge({libraryRoot:root});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const url='http://127.0.0.1:'+server.address().port;
 const invalid=await fetch(url+'/media/prepare',{method:'POST',body:JSON.stringify({id,ocr:'false'})});assert.ok(invalid.status>=400);
 const response=await fetch(url+'/media/prepare',{method:'POST',body:JSON.stringify({id})});assert.equal(response.status,202);const job=await response.json();let status;
 for(let i=0;i<60;i++){status=await(await fetch(url+'/media/jobs/'+job.jobId)).json();if(status.finishedAt)break;await new Promise(r=>setTimeout(r,50));}assert.equal(status.phase,'completed');assert.equal((await(await fetch(url+'/media/'+id)).json()).status,'ready');
});
