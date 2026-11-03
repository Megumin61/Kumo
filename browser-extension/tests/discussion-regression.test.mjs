import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
const base=fileURLToPath(new URL('../',import.meta.url)),require=createRequire(import.meta.url),Format=require(base+'format.js');
test('X keeps at most five direct replies with attribution and media, excluding unrelated and nested replies',async()=>{
 const user=handle=>({user_results:{result:{core:{screen_name:handle,name:handle},avatar:{image_url:'https://pbs.twimg.com/avatar.jpg'}}}});
 const main={rest_id:'123',details:{full_text:'main'},core:user('owner')};
 const replies=Array.from({length:6},(_,i)=>({rest_id:String(200+i),reply_to_results:{rest_id:'123'},core:user(i===0?'owner':'reader'+i),details:{full_text:'reply '+i},counts:{favorite_count:10+i,reply_count:2},media_entities2:[{type:'photo',media_url_https:'https://pbs.twimg.com/media/reply.jpg'}]}));
 const data={main,replies,unrelated:{rest_id:'999',details:{full_text:'unrelated'},reply_to_results:{rest_id:'888'}},nested:{rest_id:'998',details:{full_text:'nested'},reply_to_results:{rest_id:'200'}}};
 const context={URL,location:new URL('https://x.com/owner/status/123'),document:{querySelectorAll:()=>[{textContent:JSON.stringify(data)}]}};vm.createContext(context);vm.runInContext(await readFile(base+'page-state.js','utf8'),context);
 const r=context.readKumoPageState();assert.equal(r.comments.length,5);assert.equal(r.comments[0].author,'owner');assert.equal(r.comments[0].likes.value,10);assert.equal(r.comments[0].media[0].url,'https://pbs.twimg.com/media/reply.jpg');assert.equal(r.authorFollowups.length,1);assert.equal(r.discussionCoverage.complete,false);assert(r.comments.every(c=>c.replyToId==='123'));
});
test('saved Markdown and HTML preserve object-based author media and coverage',()=>{
 const clip={title:'test',url:'https://x.com/owner/status/123',content:'main',authorFollowups:[{text:'reply',media:[{kind:'image',url:'https://pbs.twimg.com/media/photo.jpg'},{kind:'video',url:'https://pbs.twimg.com/media/poster.jpg',videoUrl:'https://video.twimg.com/clip.mp4'}]}],comments:[{author:'owner',text:'reply',likes:{raw:'10'}}],discussionCoverage:{limit:5,captured:1,complete:false}};
 for(const rendered of [Format.buildMarkdown(clip),Format.buildReadableHtml(clip)]){assert(!rendered.includes('[object Object]'));assert(rendered.includes('https://pbs.twimg.com/media/photo.jpg'));assert(rendered.includes('https://video.twimg.com/clip.mp4'));assert(rendered.includes('前 5 条'));}
 assert.equal(JSON.parse(Format.buildMetadata(clip)).discussionCoverage.captured,1);
});

test('legacy serialized X records preserve direct reply identity and counts',async()=>{
 const records=[{rest_id:'123',legacy:{full_text:'legacy main'},core:{user_results:{result:{legacy:{screen_name:'owner',name:'Owner'}}}}},{rest_id:'456',legacy:{full_text:'legacy reply',in_reply_to_status_id_str:'123',favorite_count:7,reply_count:1},core:{user_results:{result:{legacy:{screen_name:'reader',name:'Reader'}}}}}];
 const c={URL,location:new URL('https://x.com/owner/status/123'),document:{querySelectorAll:()=>[{textContent:JSON.stringify(records)}]}};vm.createContext(c);vm.runInContext(await readFile(base+'page-state.js','utf8'),c);const r=c.readKumoPageState();assert.equal(r.core.description,'legacy main');assert.equal(r.comments[0].handle,'reader');assert.equal(r.comments[0].likes.value,7);assert.equal(r.comments[0].replyToId,'123');
});
