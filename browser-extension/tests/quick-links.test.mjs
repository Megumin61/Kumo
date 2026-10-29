import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import Links from '../source-links.js';
import Shortcuts from '../shortcuts.js';
import {sourceUrl} from '../../plugins/kumo/src/mcp/source-url.mjs';

const id='6aa2d7d10000000028001b41',other='6aa2d7d10000000028001b42';
const bare='https://www.xiaohongshu.com/explore/'+id;
const signed=bare+'?xsec_token=test-token&xsec_source=pc_feed';
test('every reader resolves the same note, rejects credentials and never borrows another note token',()=>{
  for(const metadata of [
    {url:bare,capturedUrl:signed},
    {url:bare,accessUrl:signed+'&tracking=discard'},
    {url:bare,accessUrl:'https://www.xiaohongshu.com/explore/'+other+'?xsec_token=wrong'},
    {url:'javascript:alert(1)'},
    {url:'https://user:pass@example.com/private'},
    {url:'https://example.com/article?view=original'},
    {platform:'小红书',sourceId:id,capturedUrl:signed,url:'https://www.xiaohongshu.com/explore'}
  ])assert.equal(Links.sourceUrl(metadata),sourceUrl(metadata));
  assert.equal(Links.sourceUrl({url:bare,capturedUrl:signed}),signed);
  assert.equal(Links.sourceUrl({url:bare,accessUrl:'https://www.xiaohongshu.com/explore/'+other+'?xsec_token=wrong'}),bare);
  assert.equal(Links.sourceUrl({url:'https://user:pass@example.com/private'}),'');
});
test('recapture preserves same-note access and lets a newly captured signature replace the old one',()=>{
  const old={url:bare,accessUrl:signed};
  assert.equal(Links.preserveAccess({url:bare},old).accessUrl,signed);
  assert.equal(Links.preserveAccess({url:bare,accessUrl:bare+'?xsec_token=fresh'},old).accessUrl,bare+'?xsec_token=fresh');
  assert.equal(Links.preserveAccess({url:'https://www.xiaohongshu.com/explore/'+other},old).accessUrl,undefined);
});
test('shortcut settings reflect assigned/unassigned browser commands rather than a hardcoded key',async()=>{
  const nodes=new Map(['quick-shortcut','shortcut-info','open-shortcut'].map(id=>[id,{}]));
  const doc={getElementById:id=>nodes.get(id)};
  await Shortcuts.refresh({commands:{getAll:async()=>[{name:'kumo-save',shortcut:'Ctrl+Q'}]}},doc);
  assert.equal(nodes.get('quick-shortcut').textContent,'Ctrl+Q');
  await Shortcuts.refresh({commands:{getAll:async()=>[{name:'kumo-save',shortcut:''}]}},doc);
  assert.equal(nodes.get('quick-shortcut').textContent,'未分配');
  assert.match(nodes.get('shortcut-info').textContent,/被占用/);
  assert.equal(Shortcuts.shortcutPage('Mozilla Edg/140'),'edge://extensions/shortcuts');
  assert.equal(Shortcuts.shortcutPage('Mozilla Chrome/140'),'chrome://extensions/shortcuts');
});
test('quick command starts an offscreen document without opening tabs or windows',async()=>{
  for(const failStart of [false,true]){
    let handler;const popups=[],tabs=[],windows=[],badges=[],documents=[],tips=[];
    const pageUrl='https://example.com/post/1';
    const chrome={
      storage:{session:{get:async()=>({}),set:async()=>{},remove:async()=>{}}},
      scripting:{executeScript:async()=>[{result:{capturedUrl:pageUrl,url:pageUrl}}]},
      action:{setPopup:async x=>popups.push(x),enable:async()=>{},openPopup:async()=>{},setBadgeText:async x=>badges.push(x),onClicked:{addListener(){}}},
      sidePanel:{setOptions:async()=>{}},tabs:{query:async()=>{throw Error('must use event tab');},create:async x=>tabs.push(x)},
      runtime:{onInstalled:{addListener(){}},onStartup:{addListener(){}},onMessage:{addListener(){}},getURL:p=>'chrome-extension://test/'+p,getContexts:async()=>[],sendMessage:async()=>({ok:true})},
      offscreen:{createDocument:async x=>{documents.push(x);if(failStart)throw Error('unsupported');},closeDocument:async()=>{}},
      commands:{onCommand:{addListener:f=>handler=f}},windows:{create:async x=>windows.push(x)}
    };
    const context={chrome,console,URL,crypto:globalThis.crypto,setTimeout,clearTimeout,importScripts(){},readKumoPageState(){},extractKumoPage(){},captureKumoVideoFrame(){},KumoQuickFeedback:{show:async (...args)=>tips.push(args),showInPage(){}}};
    vm.runInNewContext(await readFile(new URL('../background.js',import.meta.url),'utf8'),context);
    handler('kumo-save',{id:42,windowId:7,url:pageUrl});
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(documents[0].url,'quick-host.html');
    assert.equal(tabs.length,0);assert.equal(windows.length,0);assert.equal(popups.some(x=>x.tabId===42),false);
    assert.equal(tips[0][1],'正在收藏…');if(failStart)assert.equal(tips[1][2],'error');
  }
});

test('folder capture keeps access links through duplicate refresh and source repair without changing note/body text',async()=>{
  const {default:Format}=await import('../format.js');
  const missing=()=>Object.assign(new Error('missing'),{name:'NotFoundError'});
  class Directory{
    kind='directory';children=new Map();constructor(name){this.name=name;}
    async queryPermission(){return 'granted';}
    async getDirectoryHandle(name,{create=false}={}){if(!this.children.has(name)){if(!create)throw missing();this.children.set(name,new Directory(name));}return this.children.get(name);}
    async getFileHandle(name,{create=false}={}){
      if(!this.children.has(name)){
        if(!create)throw missing();
        const file={name,kind:'file',content:''};file.getFile=async()=>new Blob([file.content]);file.createWritable=async()=>({write:async value=>{file.content=await value.text();},close:async()=>{}});this.children.set(name,file);
      }return this.children.get(name);
    }
    async *values(){yield* this.children.values();}
  }
  const context={crypto:globalThis.crypto,TextEncoder,Blob,URL,KumoSourceLinks:Links};
  vm.runInNewContext(await readFile(new URL('../storage.js',import.meta.url),'utf8'),context);
  const root=new Directory('library'),profile={id:'generic',libraryParts:[],libraryReadme:'# Library',guideContent:'# Kumo'};
  const note='  保留笔记\n\n原帖回溯：[我的文字](https://example.com/note)';
  const content='正文中的 [打开原文]('+bare+') 必须原样保留。';
  function make(accessUrl,version='0.8.1'){
    const clip={url:bare,accessUrl,sourceId:id,dedupeKey:'xiaohongshu:'+id,contentHash:'deadbeef',extractorVersion:version,content,title:'Test',stats:{},warnings:[],images:[],videos:[]};
    return {clip,files:[{name:'metadata.json',content:Format.buildMetadata(clip,note)},{name:'source.md',content:Format.buildMarkdown(clip,note)},{name:'readable.html',content:Format.buildReadableHtml(clip)}]};
  }
  let capture=make(bare);await context.KumoStorage.writeClip(root,profile,'note',capture.files,capture.clip);
  capture=make(signed);const refreshed=await context.KumoStorage.writeClip(root,profile,'note',capture.files,capture.clip);assert.equal(refreshed.linksUpdated,true);
  capture=make(bare,'0.8.2');await context.KumoStorage.writeClip(root,profile,'note',capture.files,capture.clip);
  const saved=await (await root.getDirectoryHandle('inbox')).getDirectoryHandle('note');
  const metadata=JSON.parse(await (await (await saved.getFileHandle('metadata.json')).getFile()).text());
  const markdown=await (await (await saved.getFileHandle('source.md')).getFile()).text();
  const html=await (await (await saved.getFileHandle('readable.html')).getFile()).text();
  assert.equal(metadata.accessUrl,signed);assert.ok(markdown.includes('[打开原文]('+signed+')'));
  assert.ok(markdown.includes(content));assert.ok(markdown.includes(note));assert.ok(html.includes(signed.replaceAll('&','&amp;')));
});
