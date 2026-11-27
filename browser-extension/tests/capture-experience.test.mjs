import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

class Element {
  children=[]; dataset={}; attributes={}; style={}; classList={add(){},remove(){},toggle(){}};
  detach(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);this.parentElement=null;}
  append(...nodes){for(const node of nodes){node.detach();node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){for(const child of [...this.children])child.detach();this.append(...nodes);}
  after(node){node.detach();node.parentElement=this.parentElement;this.parentElement.children.splice(this.parentElement.children.indexOf(this)+1,0,node);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,fn){this[name]=fn;}
  querySelectorAll(){return this.children.flatMap(w=>w.children?.filter(c=>c.className==='chip')||[]);}
}
async function fixture({tags,choice}={}) {
  const store=new Map(choice?[['kumo-last-selected-tag',choice]]:[]);
  const list=new Element(),children=new Element(),label=new Element(),row=new Element(),tree=new Element(); let more;
  tree.append(list,children);
  const doc={getElementById(id){return id==='tag-list'?list:id==='child-tag-list'?children:more;},querySelector(query){return query==='.label-row'?row:label;},createElement(){const el=new Element();Object.defineProperty(el,'id',{set(v){if(v==='all-tags')more=el;}});return el;},dispatchEvent(){}};
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};

  const ctx={document:doc,localStorage,KumoUI:{ensureCollections:async()=>{}},ResizeObserver:class{observe(){}},requestAnimationFrame(){},Event:class{},CustomEvent:class{},console};
  vm.createContext(ctx);
  vm.runInContext(await readFile(new URL('../bridge.js',import.meta.url),'utf8'),ctx);
  ctx.KumoBridge.tags=async()=>({tags,unclassifiedCount:1});
  vm.runInContext(await readFile(new URL('../tags.js',import.meta.url),'utf8'),ctx);
  return {api:ctx.KumoTags,list,children,store,label};
}
test('sorts every tag by latest capture and keeps the current choice on refresh',async()=>{
  const tags=[{id:'a',label:'A',count:10,latestCapturedAt:'2026-01-01'},{id:'b',label:'B',count:2,latestCapturedAt:'2026-02-01'},{id:'c',label:'C',count:5,latestCapturedAt:'2026-01-15'}];
  const f=await fixture({tags});await f.api.load(true);
  const ordered=()=>Array.from(f.list.children.slice(0,3),w=>w.children[0].dataset.tagId);
  assert.deepEqual(ordered(),['b','c','a']);
  assert.equal(f.api.selected()[0].id,'b');
  tags[2].latestCapturedAt='2026-03-01';await f.api.load(true);
  assert.deepEqual(ordered(),['c','b','a']);
  assert.equal(f.api.selected()[0].id,'b');
});
test('expands the parent before selecting a child tag',async()=>{
  const tags=[{id:'p',label:'Parent'},{id:'c',label:'Child',parentId:'p'}];
  const f=await fixture({tags});await f.api.load(true);
  assert.equal(f.children.hidden,true);
  f.list.children[0].children[0].onclick();
  assert.equal(f.children.hidden,false);
  assert.equal(f.list.children[1],f.children);
  assert.equal(f.children.children.length,1);
  f.children.children[0].children[0].onclick();
  assert.equal(f.api.selected()[0].id,'c');
  assert.equal(f.label.textContent,'标签 · Parent / Child');
});
test('deleted and hidden labels are never selected by default',async()=>{
  const f=await fixture({tags:[{id:'old',label:'Old',count:99,hidden:true},{id:'ok',label:'OK',count:1}],choice:'old'});
  await f.api.load(true);assert.equal(f.api.selected()[0].id,'ok');
});
test('a later reconnect selects the first available label after an empty initial load',async()=>{
  const tags=[];
  const f=await fixture({tags});
  await f.api.load(true);assert.equal(f.api.selected().length,0);
  tags.push({id:'later',label:'Later',count:1});
  await f.api.load(true);assert.equal(f.api.selected()[0].id,'later');
});
test('quick-save feedback animates in, fades out and removes itself',async()=>{
  let removed=false,delay,host,box,style,sparks;const classes=[];
  const make=tag=>({tag,dataset:{},classList:{add:name=>classes.push(name)},style:{},children:[],setAttribute(name,value){this[name]=value;},append(...parts){this.children.push(...parts);},attachShadow(){return {append(...nodes){if(nodes.length===2)[style,box]=nodes;else sparks=nodes[0];}};},remove(){removed=true;}});
  const document={getElementById:()=>null,createElement:make,body:{append(node){host=node;}}};
  const ctx={document,setTimeout:(fn,ms)=>{delay=ms;ctx.expire=fn;}};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  ctx.KumoQuickFeedback.showInPage(null,'收藏完成');
  assert.equal(host.id,'kumo-quick-feedback');assert.match(host.style.cssText,/left:50%/);assert.match(host.style.cssText,/bottom:9%/);
  assert.equal(box.children[0].textContent,'K');assert.equal(box.children[1].textContent,'收藏完成');assert.equal(delay,3000);
  assert.match(style.textContent,/kumo-in/);assert.match(style.textContent,/prefers-reduced-motion/);assert.match(box.style.cssText,/backdrop-filter:blur/);assert.doesNotMatch(box.style.cssText,/gradient/);assert.equal(sparks.children.length,12);assert.equal(sparks['aria-hidden'],'true');
  ctx.expire();assert.deepEqual(classes,['kumo-out']);assert.equal(delay,200);assert.equal(removed,false);
  ctx.expire();assert.equal(removed,true);
});
test('progress, warning and error tips have distinct colors and durations',async()=>{
  let box,delay;
  const make=()=>({dataset:{},style:{},children:[],setAttribute(){},append(...parts){this.children.push(...parts);},attachShadow(){return {append(...nodes){if(nodes.length===2)box=nodes[1];}};},remove(){}});
  const ctx={document:{getElementById:()=>null,createElement:make,body:{append(){}}},setTimeout:(_fn,ms)=>{delay=ms;}};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  for(const [kind,color,time] of [['progress','#688b5b',3000],['warning','#907037',4500],['error','#995a4d',4500]]){
    ctx.KumoQuickFeedback.showInPage(null,'提示',kind);assert.ok(box.style.cssText.includes(color));assert.equal(delay,time);
  }
});
test('tip appears without waiting for logo decoding',async()=>{
  const calls=[];
  const ctx={crypto:{randomUUID:()=> 'token'},chrome:{runtime:{getURL:x=>x},scripting:{executeScript:async input=>calls.push(input)}},fetch:()=>new Promise(()=>{})};
  vm.runInNewContext(await readFile(new URL('../quick-feedback.js',import.meta.url),'utf8'),ctx);
  await ctx.KumoQuickFeedback.show(7,'正在收藏…','progress');
  assert.equal(calls.length,1);assert.equal(calls[0].args[0],null);assert.equal(calls[0].args[1],'正在收藏…');
});
