import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {configure} from '../configure-library.mjs';
import {loadConfiguration} from '../connection.mjs';

async function fixture(t){const root=await mkdtemp(path.join(os.tmpdir(),'kumo-first-run-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));return root;}
test('fresh install exposes a helpful read-only status instead of failing startup',async t=>{
 const root=await fixture(t),client=new Client({name:'first-run',version:'1'});t.after(()=>client.close());
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve(import.meta.dirname,'../server.mjs')],env:{...process.env,KUMO_MCP_CONFIG:path.join(root,'missing.json'),KUMO_LIBRARY_ROOT:'',KUMO_ALLOW_ORGANIZE:'false'},stderr:'pipe'}));
 const tools=(await client.listTools()).tools;assert.deepEqual(tools.map(x=>x.name),['connection_status']);
 const status=(await client.callTool({name:'connection_status',arguments:{}})).structuredContent;
 assert.equal(status.connected,false);assert.equal(status.state,'not_configured');assert.equal(status.canCompile,false);assert.match(status.nextStep,/资料文件夹/);
});
test('corrupt config is a disconnected state, not an empty collection',async t=>{
 const root=await fixture(t),configPath=path.join(root,'bad.json');await writeFile(configPath,'{broken');
 const result=await loadConfiguration({env:{KUMO_MCP_CONFIG:configPath},home:root,packageDir:root});assert.equal(result.error,'invalid_config');assert.equal(result.allowOrganize,false);
});
test('selected library setup validates structure, defaults to read-only, never overwrites',async t=>{
 const root=await fixture(t),libraryRoot=path.join(root,'library');await mkdir(libraryRoot);for(const part of ['inbox','archive','domains'])await mkdir(path.join(libraryRoot,part));
 const configPath=path.join(root,'user-config/config.json');await configure({root:libraryRoot,configPath});
 const result=await loadConfiguration({env:{KUMO_MCP_CONFIG:configPath},home:root});assert.equal(result.allowOrganize,false);assert.equal(result.root,libraryRoot);
 await assert.rejects(()=>configure({root:libraryRoot,configPath,allowOrganize:true}),{code:'EEXIST'});assert.equal(JSON.parse(await readFile(configPath,'utf8')).allowOrganize,false);
 await assert.rejects(()=>configure({root:'relative',configPath:path.join(root,'other.json')}));
});
test('an empty but valid new library connects without write tools',async t=>{
 const root=await fixture(t),libraryRoot=path.join(root,'library');await mkdir(libraryRoot);for(const part of ['inbox','archive','domains'])await mkdir(path.join(libraryRoot,part));
 const client=new Client({name:'empty-library',version:'1'});t.after(()=>client.close());
 await client.connect(new StdioClientTransport({command:process.execPath,args:[path.resolve(import.meta.dirname,'../server.mjs')],env:{...process.env,KUMO_MCP_CONFIG:path.join(root,'missing.json'),KUMO_LIBRARY_ROOT:libraryRoot,KUMO_ALLOW_ORGANIZE:'false'},stderr:'pipe'}));
 const status=(await client.callTool({name:'connection_status',arguments:{}})).structuredContent;assert.equal(status.connected,true);assert.equal(status.canCompile,false);
 const map=(await client.callTool({name:'wiki_map',arguments:{limit:1}})).structuredContent;assert.equal(map.totalSources,0);assert.ok(!(await client.listTools()).tools.some(x=>x.name==='save_wiki_batch'));
});
