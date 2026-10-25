import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {generateKeyPair,SignJWT} from 'jose';
import {createEvidenceLibrary} from '../library.mjs';
import {createHttpServer} from '../server.mjs';
import {oauthAuth} from '../auth.mjs';

async function fixture(t,{allowOrganize=false}={}){
 const root=await mkdtemp(path.join(os.tmpdir(),'kumo-mcp-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5}));
 for(const d of ['inbox','archive','domains','annotations'])await mkdir(path.join(root,d));
 const relative='inbox/a',id=createHash('sha256').update(relative).digest('hex').slice(0,24);await mkdir(path.join(root,relative,'assets'),{recursive:true});
 const source='# 保存的来源\n## 正文\n按钮使用黄色硬边阴影，点击时向下移动。\n'+'保留上下文。'.repeat(2000)+'\n## 讨论快照\n这不是正文。';
 await writeFile(path.join(root,relative,'source.md'),source);await writeFile(path.join(root,relative,'metadata.json'),JSON.stringify({title:'纸卡界面',url:'https://example.com/reference',platform:'X',author:'真实作者',userNote:'  只喜欢按钮\n',userTags:[{id:'design',label:'设计参考'}],comments:[{author:'读者',text:'这是评论'}],files:{images:['assets/image-01.png']},stats:{images:1}}));
 await writeFile(path.join(root,relative,'assets/image-01.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64'));
 await writeFile(path.join(root,'annotations',id+'.json'),JSON.stringify({events:[{note:'  后来的用户笔记\n',userTags:[{id:'design',label:'设计参考'}]}]}));
 return {root,id,source,library:await createEvidenceLibrary(root,{allowOrganize})};
}
test('search recalls body and notes, fetch preserves source, views and pagination are distinct',async t=>{
 const {library,id,source}=await fixture(t);
 assert.equal((await library.search('黄色硬边阴影')).results[0].id,id);
 assert.equal((await library.search('后来的用户笔记')).results[0].id,id);
 assert.equal((await library.search('量子力学')).results.length,0);
 const full=await library.fetch(id);assert.equal(full.text,source);assert.equal(full.url,'https://example.com/reference');assert.equal(full.metadata.userNotes[0],'  后来的用户笔记\n');
 const body=await library.readView({id,view:'body',offset:0,limit:100});assert.equal(body.nextOffset,100);assert.doesNotMatch(body.text,/这是评论/);
 const comments=await library.readView({id,view:'comments',offset:0,limit:1000});assert.match(comments.text,/这是评论/);
 assert.equal((await library.image(id,'assets/image-01.png')).mimeType,'image/png');
 await assert.rejects(()=>library.image(id,'../../secret.png'));
});
test('organization is preview first, read-only denied, enabled commit preserves originals and becomes searchable',async t=>{
 const {library,id,root,source}=await fixture(t,{allowOrganize:true});
 const input={domain:'低打扰交互',summary:'反馈及时又保持克制。',sources:[id],reuseWhen:['等待体验设计'],avoidWhen:['不能推断整体审美']};
 const plan=await library.preview(input);assert.equal(plan.canSave,true);
 const saved=await library.commit(plan.planId);assert.equal(saved.sourceUnchanged,true);assert.equal(await readFile(path.join(root,'inbox/a/source.md'),'utf8'),source);
 assert.equal((await library.search('等待体验')).results[0].id,id);
 await assert.rejects(()=>library.commit(plan.planId));
 const readOnly=await createEvidenceLibrary(root);const p=await readOnly.preview(input);await assert.rejects(()=>readOnly.commit(p.planId),/未启用/);
 const stale=await library.preview(input);await writeFile(path.join(root,'inbox/a/source.md'),'changed');await assert.rejects(()=>library.commit(stale.planId),/来源已变化/);
});
test('source symlinks outside root are not read',async t=>{
 const {root,library}=await fixture(t),outside=await mkdtemp(path.join(os.tmpdir(),'kumo-outside-'));t.after(()=>rm(outside,{recursive:true,force:true,maxRetries:5}));
 await writeFile(path.join(outside,'metadata.json'),JSON.stringify({title:'SECRET'}));await writeFile(path.join(outside,'source.md'),'private');
 await symlink(outside,path.join(root,'inbox','escape'),process.platform==='win32'?'junction':'dir');assert.equal((await library.list()).total,1);
 assert.equal((await library.search('SECRET')).results.length,0);
});
test('real HTTP MCP client: auth, discovery, canonical search/fetch, images, writing policy',async t=>{
 const {library,id}=await fixture(t,{allowOrganize:true}),token='fixture-only-secret-'.repeat(3),server=await createHttpServer(library,{token,allowOrganize:true,port:0});t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 assert.equal((await fetch(origin+'/mcp',{method:'POST'})).status,401);
 assert.equal((await fetch(origin+'/mcp',{method:'POST',headers:{authorization:'Bearer '+token,origin:'https://evil.invalid'}})).status,403);
 const client=new Client({name:'kumo-test',version:'1'});t.after(()=>client.close());await client.connect(new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+token}}}));
 const tools=await client.listTools();assert.equal(tools.tools.find(t=>t.name==='search').annotations.readOnlyHint,true);assert.equal(tools.tools.find(t=>t.name==='save_organization').annotations.readOnlyHint,false);
 const search=await client.callTool({name:'search',arguments:{query:'黄色阴影'}});assert.equal(search.structuredContent.results[0].id,id);
 assert.deepEqual(JSON.parse(search.content[0].text),search.structuredContent);
 const fetched=await client.callTool({name:'fetch',arguments:{id}});assert.match(fetched.structuredContent.text,/按钮/);
 const picture=await client.callTool({name:'read_image',arguments:{id,name:'assets/image-01.png'}});assert.equal(picture.content[0].type,'image');
 const invalid=await client.callTool({name:'fetch',arguments:{id:'../secret'}});assert.equal(invalid.isError,true);
 const proposal=await client.callTool({name:'preview_organization',arguments:{domain:'界面',summary:'用在按钮反馈中',sources:[id],reuseWhen:['反馈'],avoidWhen:[]}});
 const saved=await client.callTool({name:'save_organization',arguments:{planId:proposal.structuredContent.planId}});assert.equal(saved.structuredContent.saved,true);
});
test('OAuth checks issuer, audience, subject, expiry and independent write scope',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('RS256'),config={issuer:'https://auth.example.com',resource:'https://kumo.example.com/mcp',subject:'owner',jwksUri:'https://auth.example.com/jwks'};
 const verify=oauthAuth(config,publicKey);
 const token=await new SignJWT({scope:'kumo:read'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience(config.resource).setSubject('owner').setExpirationTime('2m').sign(privateKey);
 assert.equal((await verify('Bearer '+token)).canWrite,false);
 const other=await new SignJWT({scope:'kumo:read kumo:organize'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience('wrong').setSubject('owner').setExpirationTime('2m').sign(privateKey);await assert.rejects(()=>verify('Bearer '+other));
 const stranger=await new SignJWT({scope:'kumo:read'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience(config.resource).setSubject('stranger').setExpirationTime('2m').sign(privateKey);await assert.rejects(()=>verify('Bearer '+stranger));
 const expired=await new SignJWT({scope:'kumo:read'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience(config.resource).setSubject('owner').setExpirationTime(Math.floor(Date.now()/1000)-60).sign(privateKey);await assert.rejects(()=>verify('Bearer '+expired));
 const write=await new SignJWT({scope:'kumo:read kumo:organize'}).setProtectedHeader({alg:'RS256'}).setIssuer(config.issuer).setAudience(config.resource).setSubject('owner').setExpirationTime('2m').sign(privateKey);assert.equal((await verify('Bearer '+write)).canWrite,true);
});
test('packaged stdio server connects with a real MCP client and omits write tool by default',async t=>{
 const {root,id,library}=await fixture(t),client=new Client({name:'stdio-test',version:'1'});t.after(async()=>{await client.close();library.close();if(process.platform==='win32'&&!process.stdin.listenerCount('data'))process.stdin.unref?.();});
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve(import.meta.dirname,'../server.mjs')],env:{...process.env,KUMO_LIBRARY_ROOT:root,KUMO_ALLOW_ORGANIZE:'false'},stderr:'pipe'}));
 assert.ok(!(await client.listTools()).tools.some(t=>t.name==='save_organization'));
 const fetched=await client.callTool({name:'fetch',arguments:{id}});assert.equal(fetched.structuredContent.id,id);
});
