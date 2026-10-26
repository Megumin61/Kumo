import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createKumoBridge} from '../server.mjs';
import {createLibrary} from '../library.mjs';

test('duplicate link refresh preserves original content, and later media repair retains access URL',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'kumo-access-'));
  const {server}=createKumoBridge({libraryRoot:root,port:0});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});});
  const base='http://127.0.0.1:'+server.address().port;
  const id='6aa2d7d10000000028001b41',url='https://www.xiaohongshu.com/explore/'+id;
  const signed=url+'?xsec_token=synthetic&xsec_source=pc_feed';
  function payload(accessUrl,version='0.8.1',body='# Original'){
    const clip={title:'Test',url,accessUrl,sourceId:id,dedupeKey:'xiaohongshu:'+id,contentHash:'deadbeef',extractorVersion:version,stats:{}};
    return {schema:'kumo-bridge-save-v1',folderName:'2026-10-25--synthetic--deadbeef',clip,files:[{name:'source.md',encoding:'utf8',content:body},{name:'metadata.json',encoding:'utf8',content:JSON.stringify(clip)}]};
  }
  const save=async p=>{const res=await fetch(base+'/clips',{method:'POST',headers:{Origin:'chrome-extension://synthetic','Content-Type':'application/json'},body:JSON.stringify(p)});assert.equal(res.status,200);return res.json();};
  const first=await save(payload(url));
  const updated=await save(payload(signed));assert.equal(updated.duplicate,true);
  const file=path.join(root,first.relativePath,'metadata.json');
  assert.equal(JSON.parse(await readFile(file,'utf8')).accessUrl,signed);
  assert.equal(await readFile(path.join(root,first.relativePath,'source.md'),'utf8'),'# Original');
  await save(payload(url,'0.8.2','# More complete'));
  assert.equal(JSON.parse(await readFile(file,'utf8')).accessUrl,signed);
  const library=createLibrary(root);
  const list=await library.list({limit:10});assert.equal(list.items[0].url,signed);assert.equal((await library.detail(list.items[0].id)).url,signed);
});
