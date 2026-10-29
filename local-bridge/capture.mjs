import {createHash} from 'node:crypto';
import Format from '../browser-extension/format.js';
import {itemId} from './library.mjs';

const MEDIA_DOMAINS=['xhscdn.com','xiaohongshu.com','xhsimg.com','xlimg.net','pinimg.com','hdslb.com','biliimg.com','twimg.com','ytimg.com','googlevideo.com','qpic.cn','qlogo.cn','douyincdn.com','douyinpic.com','byteimg.com','ibytedtos.com','tiktokcdn.com','githubusercontent.com','githubassets.com'];
export function captureMediaUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||!MEDIA_DOMAINS.some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain)))throw Error('unsupported_media_host');
  return url;
}
function sourceUrl(value){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('invalid_source_url');return url.href;}
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function normalize(input,sourceKey){
  if(input?.schema!=='kumo-clip-v1'||typeof input.content!=='string'||input.content.length>2_000_000)throw Error('expected_kumo_page_snapshot');
  const url=sourceUrl(input.url),capturedUrl=sourceUrl(input.capturedUrl||url),stable=sourceKey(capturedUrl)||sourceKey(url);
  if(/(^|\.)xiaohongshu\.com$/.test(new URL(capturedUrl).hostname)&&!stable.startsWith('xiaohongshu:'))throw Error('open_an_individual_post_first');
  const images=(input.images||[]).slice(0,99).map(image=>({url:sourceUrl(image.url||image.src),alt:String(image.alt||'').slice(0,1000)}));
  const videos=(input.videos||[]).slice(0,20).map(video=>({url:String(video.url||''),poster:video.poster?sourceUrl(video.poster):'',kind:String(video.kind||''),origin:String(video.origin||'')}));
  if(!input.content.trim()&&!images.length&&!videos.length)throw Error('page_has_no_post_content');
  const contentHash=createHash('sha256').update(url+'\n'+input.content).digest('hex').slice(0,8),capturedAt=new Date().toISOString();
  return {...input,url,capturedUrl,accessUrl:sourceUrl(input.accessUrl||url),contentHash,capturedAt,id:capturedAt.slice(0,10)+'-'+contentHash,
    title:String(input.title||'未命名网页').slice(0,300),dedupeKey:stable||'url:'+url,dedupeSafeUrl:true,
    platformId:stable?stable.split(':')[0]:String(input.platformId||'generic'),sourceId:stable?stable.split(':')[1]:'',
    contentHtml:input.content.split(/\n+/).filter(Boolean).map(line=>'<p>'+escape(line)+'</p>').join(''),
    selection:null,images,videos,videoContext:undefined,files:undefined,userNote:undefined,userTags:[],
    comments:(input.comments||[]).slice(0,200),authorFollowups:(input.authorFollowups||[]).slice(0,100),
    warnings:[...new Set((input.warnings||[]).filter(value=>typeof value==='string'))],
    stats:{characters:input.content.length,images:images.length,videos:videos.length,comments:(input.comments||[]).slice(0,200).length,expectedGalleryMedia:input.stats?.expectedGalleryMedia||null,foundGalleryMedia:input.stats?.foundGalleryMedia||null,downloadedImages:0,downloadedVideos:0}};
}
export function createPageCapture({library,findExisting,persist,sourceKey,remoteGet}){
  const locks=new Map();
  async function capture(input){
    const clip=normalize(input?.clip,sourceKey);
    if(input.expectedUrl){const expected=sourceUrl(input.expectedUrl),key=sourceKey(expected);if(key?key!==clip.dedupeKey:new URL(expected).href!==clip.capturedUrl)throw Error('page_changed_before_capture');}
    const prior=locks.get(clip.dedupeKey)||Promise.resolve();
    const pending=prior.catch(()=>{}).then(()=>save(input,clip));locks.set(clip.dedupeKey,pending);
    try{return await pending;}finally{if(locks.get(clip.dedupeKey)===pending)locks.delete(clip.dedupeKey);}
  }
  async function save(input,clip){
    const existing=await findExisting(clip);
    if(existing)return {ok:true,status:'duplicate',duplicate:true,id:itemId(existing.relativePath),relativePath:existing.relativePath,url:clip.url,verified:true};
    const tag=String(input.tag||'').trim();
    if(tag&&tag!=='未分类'&&tag!=='__unclassified'){
      const matches=(await library.tags()).filter(value=>!value.hidden&&(value.id===tag||value.label===tag));
      if(matches.length!==1)throw Error(matches.length?'ambiguous_tag_use_id':'tag_not_found_use_tags_command');
      clip.userTags=matches.map(({id,label})=>({id,label}));
    }
    const note=String(input.note??'');if(note.length>30000)throw Error('note_too_long');
    const assets=[],errors=[],deadline=Date.now()+150000;let totalBytes=0;
    async function download(item,index,kind){
      try{
        if(Date.now()>=deadline)throw Error('capture_media_time_limit');
        const url=captureMediaUrl(item.url),limit=kind==='image'?12*1024*1024:80*1024*1024;
        const result=await remoteGet(url.href,{hosts:[url.hostname],maxBytes:limit,timeout:kind==='image'?20000:45000});
        const type=result.type.split(';')[0].toLowerCase();
        const ext=kind==='image'?({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif','image/avif':'avif'})[type]:({'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'})[type];
        if(!ext)throw Error('unexpected_media_type');
        if(totalBytes+result.bytes.length>120*1024*1024)throw Error('capture_media_size_limit');totalBytes+=result.bytes.length;
        item.localFile='assets/'+kind+'-'+String(index+1).padStart(2,'0')+'.'+ext;item.downloadState='saved';
        assets.push({name:item.localFile,encoding:'base64',type,content:result.bytes.toString('base64')});
      }catch(error){item.downloadState='failed';item.downloadError=error.message;errors.push({kind,index:index+1,url:item.url,error:error.message});}
    }
    const targets=[...(input.images===false?[]:clip.images.map((item,index)=>({item,index,kind:'image'}))),...(input.video===true?clip.videos.map((item,index)=>({item,index,kind:'video'})):[])];
    let cursor=0;
    await Promise.all(Array.from({length:Math.min(2,targets.length)},async()=>{while(cursor<targets.length){const target=targets[cursor++];await download(target.item,target.index,target.kind);}}));
    clip.stats.downloadedImages=clip.images.filter(item=>item.localFile).length;clip.stats.downloadedVideos=clip.videos.filter(item=>item.localFile).length;
    if(errors.length)clip.warnings.push('automation_media_download_incomplete');
    if(input.images===false&&clip.images.length)clip.warnings.push('automation_images_not_requested');
    if(input.video!==true&&clip.videos.length)clip.warnings.push('automation_video_not_requested');
    const folderName=clip.capturedAt.slice(0,10)+'--'+Format.slug(clip.title)+'--'+clip.contentHash;
    const files=[{name:'source.md',encoding:'utf8',type:'text/markdown',content:Format.buildMarkdown(clip,note,false)},{name:'metadata.json',encoding:'utf8',type:'application/json',content:Format.buildMetadata(clip,note,false)},{name:'readable.html',encoding:'utf8',type:'text/html',content:Format.buildReadableHtml(clip)},...assets];
    const result=await persist({schema:'kumo-bridge-save-v1',folderName,clip,files});
    const verified=await findExisting(clip);if(!verified)throw Error('saved_clip_verification_failed');
    const partial=errors.length||clip.warnings.some(value=>/gallery_incomplete|note_body_not_found|target_post_not_found/.test(value));
    return {ok:true,status:result.duplicate?'duplicate':partial?'partial':'saved',duplicate:Boolean(result.duplicate),verified:true,id:itemId(result.relativePath),relativePath:result.relativePath,url:clip.url,userTags:result.duplicate?undefined:clip.userTags,media:{images:clip.stats.downloadedImages,videos:clip.stats.downloadedVideos},comments:clip.comments.length,warnings:clip.warnings,errors};
  }
  return {capture};
}
