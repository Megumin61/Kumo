import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {webcrypto,createHash} from 'node:crypto';
function fsFixture(seed){const values=new Map(Object.entries(seed));const error=()=>Object.assign(Error('missing'),{name:'NotFoundError'});function dir(prefix=''){return {kind:'directory',name:prefix.split('/').filter(Boolean).at(-1)||'library',queryPermission:async()=> 'granted',getDirectoryHandle:async(name,{create=false}={})=>{const key=prefix+name+'/';if(!create&&![...values.keys()].some(v=>v.startsWith(key)))throw error();return dir(key);},getFileHandle:async(name,{create=false}={})=>{const key=prefix+name;if(!create&&!values.has(key))throw error();return {getFile:async()=>new Blob([values.get(key)]),createWritable:async()=>({write:async v=>values.set(key,typeof v==='string'?v:await v.text()),close:async()=>{},abort:async()=>{}})};},async *values(){const seen=new Set();for(const key of values.keys())if(key.startsWith(prefix)){const next=key.slice(prefix.length).split('/')[0];if(seen.has(next))continue;seen.add(next);if(key.slice(prefix.length).includes('/'))yield dir(prefix+next+'/');}}};}return {root:dir(),values};}
async function fixture(){const relative='inbox/example',id=createHash('sha256').update(relative).digest('hex').slice(0,24),meta={id:'capture-identifier',title:'Example',url:'https://example.com/post',dedupeKey:'url:example',userNote:'  original\n note  ',userTags:[],files:{images:['assets/image-01.jpg']},capturedAt:'2026-11-02'},source='## 正文\nExample',fingerprint=createHash('sha256').update(source+'\n'+JSON.stringify(meta)+'\n[]').digest('hex');
 const f=fsFixture({[relative+'/metadata.json']:JSON.stringify(meta),[relative+'/source.md']:source,[relative+'/assets/image-01.jpg']:'image','tags.json':JSON.stringify({tags:[{id:'one',label:'First'}]}),'wiki/kumo/state.json':JSON.stringify({revision:1,domains:[{id:'design',name:'Design'}],topics:[],cards:[{id,fingerprint,domainIds:['design'],topicIds:[],summary:'Concrete contribution',source:{title:'Example'}}],relations:[]})});
 const c={crypto:webcrypto,URL,Blob,TextEncoder,console,localStorage:{getItem:()=>null,setItem:()=>{}},fetch:()=>{throw Error('HTTP must not run');},KumoStorage:{ensurePermission:async(h)=>await h.queryPermission({mode:'readwrite'})==='granted',getHandle:async()=>f.root,setHandle:async()=>{},sourceKeyFromUrl:()=>''},addEventListener:()=>{},dispatchEvent:()=>{},document:{querySelectorAll:()=>[]},CustomEvent:class{}};vm.createContext(c);vm.runInContext(await readFile(new URL('../bridge.js',import.meta.url),'utf8'),c);return {...f,api:c.KumoBridge,id,meta};}
test('file transport lists, searches, renders knowledge and reads media without HTTP',async()=>{const f=await fixture();assert.equal((await f.api.status()).transport,'filesystem');const result=await f.api.library({q:'Example'});assert.equal(result.total,1);assert.equal(result.items[0].contentSummary,'Concrete contribution');assert.equal((await f.api.knowledge()).compiled,1);assert.equal((await f.api.assetBlob(f.id,'assets/image-01.jpg')).size,5);await assert.rejects(f.api.assetBlob(f.id,'../metadata.json'));});
test('file notes and collection changes preserve original files and stale compiled cards',async()=>{const f=await fixture(),before=f.values.get('inbox/example/metadata.json');await f.api.annotate(f.meta,' new\n note ',[]);assert.equal(f.values.get('inbox/example/metadata.json'),before);let detail=await f.api.item(f.id);assert.equal(detail.events[0].note,'  original\n note  ');assert.equal(detail.events[1].note,' new\n note ');assert.equal(detail.events[1].kind,'note');assert.equal((await f.api.knowledge()).compiled,0);await f.api.setCollection(f.meta,'one');detail=await f.api.item(f.id);assert.equal(detail.effectiveUserTags[0].id,'one');assert.equal(detail.events.at(-1).kind,'collection');await f.api.updateTag({action:'delete',id:'one'});assert.equal((await f.api.item(f.id)).effectiveUserTags.length,0);assert.equal(f.values.get('inbox/example/metadata.json'),before);});

test('parent tags include child captures and sort by actual newest timestamp rather than count',async()=>{
 const f=await fixture();
 f.values.set('tags.json',JSON.stringify({tags:[{id:'one',label:'Older'},{id:'group',label:'Group'},{id:'child',label:'Child',parentId:'group'}]}));
 const clips=[
  ['old-a','2026-11-03T01:20:00+08:00','one'],
  ['old-b','2026-11-01T10:00:00Z','one'],
  ['newer','2026-11-02T20:00:00Z','child'],
 ];
 for(const [slug,capturedAt,id] of clips){
  f.values.set('inbox/'+slug+'/metadata.json',JSON.stringify({title:slug,capturedAt,userTags:[{id,label:slug}]}));
  f.values.set('inbox/'+slug+'/source.md',slug);
 }
 const result=await f.api.library();
 assert.deepEqual(Array.from(result.items,i=>i.title),['newer','old-a','Example','old-b']);
 const groups=result.collectionCounts.filter(t=>!t.parentId);
 assert.deepEqual(Array.from(groups,t=>[t.id,t.count]),[['group',1],['one',2]]);
 assert.deepEqual(Array.from((await f.api.library({tag:'group'})).items,i=>i.title),['newer']);
 assert.deepEqual(Array.from((await f.api.library({tag:'child'})).items,i=>i.title),['newer']);
});

test('missing media has its own error and leaves the original capture available',async()=>{
 const f=await fixture(),path='inbox/example/assets/image-01.jpg';
 f.values.delete(path);
 await assert.rejects(f.api.assetBlob(f.id,'assets/image-01.jpg'),{code:'KUMO_MEDIA_MISSING'});
 assert.equal((await f.api.lookup(f.meta)).item.missingMedia,true);
 assert.match((await f.api.item(f.id)).source,/Example/);
});
