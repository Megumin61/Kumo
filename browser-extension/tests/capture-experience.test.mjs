import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

class Element {
  children=[]; dataset={}; attributes={}; style={}; classList={add(){},remove(){},toggle(){}};
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,fn){this[name]=fn;}
  querySelectorAll(){return this.children.flatMap(w=>w.children?.filter(c=>c.className==='chip')||[]);}
}
async function fixture({tags,items,recent}={}) {
  const store=new Map(recent?[['kumo-last-saved-tag',recent]]:[]);
  const list=new Element(),label=new Element(),row=new Element(); let more;
  const doc={getElementById(id){return id==='tag-list'?list:more;},querySelector(query){return query==='.label-row'?row:label;},createElement(){const el=new Element();Object.defineProperty(el,'id',{set(v){if(v==='all-tags')more=el;}});return el;},dispatchEvent(){}};
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const bridge={tags:async()=>({tags,unclassifiedCount:1}),library:async()=>({items,total:items.length})};
  const ctx={document:doc,localStorage,KumoBridge:bridge,KumoUI:{ensureCollections:async()=>{}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},Event:class{},CustomEvent:class{},console};
  vm.runInNewContext(await readFile(new URL('../tags.js',import.meta.url),'utf8'),ctx);
  return {api:ctx.KumoTags,list,store,label};
}
test('most recent saved tag goes first, then usage count, and it is selected by default',async()=>{
  const tags=[{id:'a',label:'A',count:10},{id:'b',label:'B',count:2},{id:'c',label:'C',count:5}];
  const f=await fixture({tags,items:[],recent:'b'});await f.api.load(true);
  assert.deepEqual(Array.from(f.list.children.slice(0,3),w=>w.children[0].dataset.tagId),['b','a','c']);
  assert.equal(f.list.children[0].children[0].attributes['aria-pressed'],'true');
  assert.equal(f.api.selected()[0].id,'b');
  f.api.recordSaved([{id:'c'}]);await f.api.load(true);
  assert.deepEqual(Array.from(f.list.children.slice(0,3),w=>w.children[0].dataset.tagId),['c','a','b']);
  assert.equal(f.api.selected()[0].id,'b','refresh does not silently change the current choice');
});
test('on first use infer the newest tagged capture; fall back to count when no recent capture exists',async()=>{
  const tags=[{id:'a',label:'A',count:10},{id:'b',label:'B',count:2}];
  const f=await fixture({tags,items:[{capturedAt:'2026-01-01',userTags:[{id:'a'}]},{capturedAt:'2026-02-01',userTags:[{id:'b'}]}]});
  await f.api.load(true);assert.equal(f.api.selected()[0].id,'b');assert.equal(f.store.get('kumo-last-saved-tag'),'b');
  const g=await fixture({tags,items:[]});await g.api.load(true);assert.equal(g.api.selected()[0].id,'a');
});
test('deleted and hidden labels are never selected by default',async()=>{
  const f=await fixture({tags:[{id:'old',label:'Old',count:99,hidden:true},{id:'ok',label:'OK',count:1}],items:[],recent:'old'});
  await f.api.load(true);assert.equal(f.api.selected()[0].id,'ok');
});
test('a later reconnect selects the first available label after an empty initial load',async()=>{
  const tags=[];
  const f=await fixture({tags,items:[]});
  await f.api.load(true);assert.equal(f.api.selected().length,0);
  tags.push({id:'later',label:'Later',count:1});
  await f.api.load(true);assert.equal(f.api.selected()[0].id,'later');
});
test('quick-save feedback animates in, fades out and removes itself',async()=>{
  let removed=false,delay,host,box,style;const classes=[];
  const make=tag=>({tag,dataset:{},classList:{add:name=>classes.push(name)},style:{},children:[],setAttribute(name,value){this[name]=value;},append(...parts){this.children.push(...parts);},attachShadow(){return {append(css,node){style=css;box=node;}};},remove(){removed=true;}});
  const document={getElementById:()=>null,createElement:make,body:{append(node){host=node;}}};
  const ctx={document,setTimeout:(fn,ms)=>{delay=ms;ctx.expire=fn;}};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  ctx.KumoQuickFeedback.showInPage(null,'收藏完成');
  assert.equal(host.id,'kumo-quick-feedback');assert.match(host.style.cssText,/left:50%/);assert.match(host.style.cssText,/bottom:9%/);
  assert.equal(box.children[0].textContent,'K');assert.equal(box.children[1].textContent,'收藏完成');assert.equal(delay,1800);
  assert.match(style.textContent,/kumo-in/);assert.match(style.textContent,/prefers-reduced-motion/);
  ctx.expire();assert.deepEqual(classes,['kumo-out']);assert.equal(delay,200);assert.equal(removed,false);
  ctx.expire();assert.equal(removed,true);
});
test('progress, warning and error tips have distinct colors and durations',async()=>{
  let box,delay;
  const make=()=>({dataset:{},style:{},children:[],setAttribute(){},append(...parts){this.children.push(...parts);},attachShadow(){return {append(_css,node){box=node;}};},remove(){}});
  const ctx={document:{getElementById:()=>null,createElement:make,body:{append(){}}},setTimeout:(_fn,ms)=>{delay=ms;}};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  for(const [kind,color,time] of [['progress','#4c6572',3000],['warning','#8c6c34',4500],['error','#985648',4500]]){
    ctx.KumoQuickFeedback.showInPage(null,'提示',kind);assert.ok(box.style.cssText.includes(color));assert.equal(delay,time);
  }
});
test('tip appears without waiting for logo decoding',async()=>{
  const calls=[];
  const ctx={crypto:{randomUUID:()=> 'token'},chrome:{runtime:{getURL:x=>x},scripting:{executeScript:async input=>calls.push(input)}},fetch:()=>new Promise(()=>{})};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  await ctx.KumoQuickFeedback.show(7,'开始收藏…','progress');
  assert.equal(calls.length,1);assert.equal(calls[0].args[0],null);assert.equal(calls[0].args[1],'开始收藏…');
});
