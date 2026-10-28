import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import Destination from '../destination.js';
import Duplicate from '../duplicate-check.js';

test('loaded comments default on, while an explicit later opt-out remains respected',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  assert.equal(Destination.options(storage).comments,10);
  values.set('kumo-capture-options:v1',JSON.stringify({images:true,comments:0}));
  assert.equal(Destination.options(storage).comments,10);
  Destination.saveOptions(storage,{images:true,comments:0});
  assert.equal(Destination.options(storage).comments,0);
});

test('duplicate lookup matches stable post IDs and does not merge different posts',async()=>{
  const ctx={URL};vm.runInNewContext(await readFile(new URL('../storage.js',import.meta.url),'utf8'),ctx);
  const a='6aa2d7d10000000028001b41',b='6aa2d7d10000000028001b42';
  const existing={url:`https://www.xiaohongshu.com/discovery/item/${a}?xsec_token=old`,userNote:'保留原笔记',userTags:[{id:'one'}]};
  const bridge={library:async()=>({items:[existing],total:1})};
  const clip=id=>({url:`https://www.xiaohongshu.com/explore/${id}`,dedupeKey:`xiaohongshu:${id}`,dedupeSafeUrl:true});
  assert.equal(await Duplicate.find(clip(a),bridge,ctx.KumoStorage),existing);
  assert.equal(await Duplicate.find(clip(b),bridge,ctx.KumoStorage),null);
  assert.equal(existing.userNote,'保留原笔记');assert.equal(existing.userTags[0].id,'one');
});

test('duplicate lookup handles pagination and avoids matching generic collection URLs',async()=>{
  const storage={sourceKeyFromUrl:()=>'',safeComparableUrl:url=>new URL(url).pathname!=='/'};
  const target={url:'https://example.com/post?a=1',dedupeKey:'hash:123',dedupeSafeUrl:true};
  const bridge={library:async({offset})=>offset===0?{items:[{url:'https://example.com/other'}],total:2}:{items:[{url:target.url}],total:2}};
  assert.equal((await Duplicate.find(target,bridge,storage)).url,target.url);
  const home={url:'https://example.com/',dedupeKey:'hash:123',dedupeSafeUrl:true};
  assert.equal(await Duplicate.find(home,{library:async()=>({items:[{url:home.url}],total:1})},storage),null);
});

test('recognized platforms display their local brand marks',async()=>{
  const document={createElement:()=>({})},ctx={document};
  vm.runInNewContext(await readFile(new URL('../ui.js',import.meta.url),'utf8'),ctx);
  for(const [label,brand] of [['github.com','github'],['pinterest.com','pinterest'],['B站','bilibili'],['小红书','xiaohongshu'],['X','x'],['微信公众号','wechat'],['抖音','douyin'],['TikTok','tiktok'],['YouTube','youtube']]){
    const mark={dataset:{},replaceChildren(node){this.image=node;},setAttribute(){}};
    ctx.KumoUI.platform(mark,label);assert.equal(mark.dataset.platform,brand);assert.equal(mark.dataset.appIcon,'true');assert.equal(mark.image.src,`assets/platforms/app/${brand}.jpg`);
    await readFile(new URL('../'+mark.image.src,import.meta.url));
  }
});
