import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,realpath,stat,rename} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';

export const MEDIA_VERSION='kumo-media-v1.0.0';
const digest=v=>createHash('sha256').update(v).digest('hex');
const array=v=>Array.isArray(v)?v:[];
const originalPattern=/^assets\/(?:image|frame|video)-\d{2}\.(?:jpg|jpeg|png|webp|gif|avif|mp4|webm|mov|m4v)$/i;
const derivedPattern=/^(?:preview-\d{4}|sheet-\d{3}|video-\d{2}-frame-\d{3})\.jpg$/;
const here=path.dirname(fileURLToPath(import.meta.url));
const defaultPython=process.platform==='win32'?path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'):'python3';
export function runProcess(binary,args,{timeout=180000,maxBytes=12*1024*1024}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,args,{windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
    const chunks=[],errors=[];let size=0,settled=false;
    const timer=setTimeout(()=>{child.kill();finish(new Error('media_process_timeout'));},timeout);
    function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(result);}
    child.on('error',error=>finish(new Error(error.code==='ENOENT'?'media_dependency_missing':error.message)));
    for(const [stream,buffer]of [[child.stdout,chunks],[child.stderr,errors]])stream.on('data',bytes=>{size+=bytes.length;if(size>maxBytes){child.kill();finish(new Error('media_process_output_limit'));}else buffer.push(bytes);});
    child.on('close',code=>{const stdout=Buffer.concat(chunks).toString('utf8'),stderr=Buffer.concat(errors).toString('utf8');finish(code===0?null:new Error('media_process_failed: '+stderr.slice(-1200)),{stdout,stderr});});
  });
}
async function contained(root,relative){
  const resolved=await realpath(path.join(root,relative)),local=path.relative(root,resolved);
  if(local==='..'||local.startsWith('..'+path.sep)||path.isAbsolute(local))throw new Error('media_path_outside_library');
  return resolved;
}
async function hashFile(file){const hash=createHash('sha256');for await(const bytes of createReadStream(file))hash.update(bytes);return hash.digest('hex');}
function resources(row){return [...new Set([...array(row.meta.files?.images),...array(row.meta.files?.frames),...array(row.meta.files?.videos)])];}
export async function mediaInputs(root,row,{hash=false}={}){
  const result=[];
  for(const resource of resources(row)){
    if(!originalPattern.test(resource)){result.push({resource,status:'invalid_name'});continue;}
    try{const file=await contained(root,row.relative+'/'+resource),info=await stat(file);if(!info.isFile())throw Error();
      result.push({resource,status:'available',size:info.size,mtimeMs:info.mtimeMs,...(hash?{sha256:await hashFile(file)}:{})});
    }catch(error){if(error.message==='media_path_outside_library')throw error;result.push({resource,status:'missing'});}
  }
  return result;
}
function inputStamp(inputs){return inputs.map(({resource,status,size,mtimeMs})=>({resource,status,size,mtimeMs}));}
export async function readPreparedMedia(root,row){
  try{
    const file=await contained(root,'derived/media/'+row.id+'/manifest.json');if((await stat(file)).size>4*1024*1024)throw Error('media_manifest_too_large');
    const m=JSON.parse(await readFile(file,'utf8'));
    if(m.schema!==MEDIA_VERSION||m.sourceFingerprint!==row.fingerprint)return {status:'stale',reason:'source_changed'};
    if(JSON.stringify(inputStamp(await mediaInputs(root,row)))!==JSON.stringify(inputStamp(m.inputs)))return {status:'stale',reason:'media_changed'};
    if(!/^[a-f0-9]{24}$/.test(m.id)||m.id!==row.id||!/^[a-f0-9]{64}$/.test(m.fingerprint)||!new RegExp(`^derived/media/${row.id}/[a-f0-9]{64}(?:-refresh-[a-f0-9-]{36})?$`).test(m.directory))throw Error('invalid_media_manifest');
    if(m.ocr?.items)m.ocr.items=m.ocr.items.map(item=>({...item,normalizedText:item.normalizedText||(item.text||'').replace(/(?<=[\p{Script=Han}]) +(?=[\p{Script=Han}])/gu,'')}));
    return {status:'ready',...m};
  }catch(error){if(error.code==='ENOENT')return {status:'not_prepared'};throw error;}
}
let authFailed=false;
async function transcribeAudio(file,model){
  if(authFailed)return {status:'authentication_failed'};
  if(!process.env.OPENAI_API_KEY)return {status:'not_configured'};
  const bytes=await readFile(file);if(bytes.length>24*1024*1024)return {status:'audio_too_large'};
  const base=new URL(process.env.OPENAI_BASE_URL||'https://api.openai.com/v1/');
  if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','localhost'].includes(base.hostname)))throw Error('unsafe_transcription_endpoint');
  const form=new FormData();form.append('file',new Blob([bytes],{type:'audio/mpeg'}),'audio.mp3');form.append('model',model);form.append('response_format','json');
  const response=await fetch(base.href.replace(/\/$/,'')+'/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(180000),redirect:'error'});
  if([401,403].includes(response.status)){authFailed=true;return {status:'authentication_failed'};}
  if(!response.ok)return {status:'request_failed',httpStatus:response.status};
  const data=await response.json();return {status:'completed',text:typeof data.text==='string'?data.text:'',model};
}
export function createMediaPreparation(root,{get,allowWrite=false,ffmpeg=process.env.KUMO_FFMPEG||'ffmpeg',ffprobe=process.env.KUMO_FFPROBE||'ffprobe',python=process.env.KUMO_PYTHON||defaultPython}={}){
  const running=new Map();let queue=Promise.resolve();
  async function prepare({id,transcribe=false,force=false}={}){
    if(!allowWrite)throw Error('media_preparation_read_only');
    if(!/^[a-f0-9]{24}$/.test(id))throw Error('invalid_source_id');
    if(running.has(id))return running.get(id);
    const task=queue.then(()=>build({id,transcribe,force}));queue=task.catch(()=>{});running.set(id,task);try{return await task;}finally{running.delete(id);}
  }
  async function build({id,transcribe,force}){
    const row=await get(id),cached=await readPreparedMedia(root,row);
    if(!force&&cached.status==='ready'&&(!transcribe||cached.transcriptionRequested))return cached;
    const inputs=await mediaInputs(root,row,{hash:true}),fingerprint=digest(JSON.stringify({version:MEDIA_VERSION,source:row.fingerprint,inputs,transcribe}));
    // One immutable generation per content fingerprint, with an atomic manifest pointer.
    const parent=path.join(root,'derived/media',id);await mkdir(parent,{recursive:true});await contained(root,`derived/media/${id}`);
    const generation=fingerprint+'-'+randomUUID();const temporary=path.join(parent,generation);await mkdir(temporary);await contained(root,`derived/media/${id}/${generation}`);
    const items=[],videos=[],errors=[];
    for(const input of inputs){
      if(input.status!=='available'){errors.push({resource:input.resource,error:input.status});continue;}
      const file=await contained(root,row.relative+'/'+input.resource);
      if(!input.resource.startsWith('assets/video-')){items.push({file,resource:input.resource,kind:'image'});continue;}
      const video={resource:input.resource,frames:[],transcript:{status:transcribe?'pending':'not_requested'}};
      try{
        const {stdout}=await runProcess(ffprobe,['-v','error','-show_streams','-show_format','-of','json',file]);const info=JSON.parse(stdout);
        const duration=Number(info.format?.duration||info.streams?.find(s=>s.codec_type==='video')?.duration);
        if(!Number.isFinite(duration)||duration<=0||duration>14400)throw Error('invalid_or_excessive_video_duration');
        video.duration=duration;video.hasAudio=info.streams.some(s=>s.codec_type==='audio');
        const count=Math.max(3,Math.min(24,Math.ceil(duration/5)+1));const times=Array.from({length:count},(_,i)=>Math.max(0,Math.min(duration-.05,i*duration/(count-1))));
        // Scene changes supplement evenly spaced samples; all timestamps remain explicit.
        try{const scene=await runProcess(ffmpeg,['-hide_banner','-i',file,'-vf',"select='gt(scene,0.35)',showinfo",'-frames:v','12','-an','-f','null','-'],{timeout:180000});
          for(const m of scene.stderr.matchAll(/pts_time:([\d.]+)/g)){const t=Number(m[1]);if(t<duration&&!times.some(v=>Math.abs(v-t)<.4))times.push(t);}
        }catch{video.sceneDetection='unavailable';}
        times.sort((a,b)=>a-b);const prefix=path.basename(input.resource,path.extname(input.resource));
        for(const [index,seconds]of times.entries()){
          const name=prefix+'-frame-'+String(index+1).padStart(3,'0')+'.jpg';
          try{await runProcess(ffmpeg,['-hide_banner','-loglevel','error','-ss',String(seconds),'-i',file,'-frames:v','1','-vf','scale=1600:1600:force_original_aspect_ratio=decrease','-q:v','2','-y',path.join(temporary,name)],{timeout:30000});
            await stat(path.join(temporary,name));video.frames.push({name,seconds});items.push({file:path.join(temporary,name),resource:input.resource,kind:'video_frame',seconds});
          }catch{errors.push({resource:input.resource,error:'frame_unavailable',seconds});}
        }
        video.sampling={method:'uniform_plus_scene_change',frameCount:video.frames.length,fullVideoUnderstood:false};
        if(!video.hasAudio)video.transcript={status:'no_audio'};
        else if(transcribe){
          try{const model=process.env.KUMO_TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe',segments=[];
            for(let start=0;start<duration;start+=600){const name=`${prefix}-audio-${segments.length+1}.mp3`,audio=path.join(temporary,name);
              await runProcess(ffmpeg,['-hide_banner','-loglevel','error','-ss',String(start),'-i',file,'-t','600','-vn','-ac','1','-ar','16000','-b:a','48k','-y',audio]);
              const result=await transcribeAudio(audio,model);segments.push({...result,startSeconds:start,endSeconds:Math.min(duration,start+600)});if(result.status!=='completed')break;
            }
            video.transcript={status:segments.every(s=>s.status==='completed')?'completed':segments.at(-1)?.status||'failed',segments,text:segments.filter(s=>s.status==='completed').map(s=>s.text).join('\n'),model};
          }catch(error){video.transcript={status:'failed',error:error.message.slice(0,160)};}
        }
        video.status=video.frames.length?'prepared':'failed';
      }catch(error){video.status='failed';video.error=error.message.slice(0,300);errors.push({resource:input.resource,error:video.error});}
      videos.push(video);
    }
    const job=path.join(temporary,'layout-input.json');await writeFile(job,JSON.stringify({items,output:temporary}));
    const {stdout}=await runProcess(python,[path.join(here,'media-layout.py'),job],{timeout:180000});const layout=JSON.parse(stdout);
    errors.push(...layout.failures);
    // Source and original asset changes during preparation never publish a mixed result.
    if((await get(id)).fingerprint!==row.fingerprint||JSON.stringify(inputStamp(await mediaInputs(root,row)))!==JSON.stringify(inputStamp(inputs)))throw Error('media_changed_during_preparation');
    let destination=path.join(parent,fingerprint);try{await stat(destination);destination=path.join(parent,fingerprint+'-refresh-'+randomUUID());}catch{}
    await rename(temporary,destination);
    const directory=path.relative(root,destination).split(path.sep).join('/');
    const resultFingerprint=digest(JSON.stringify({version:MEDIA_VERSION,source:row.fingerprint,inputs,layout,videos,errors}));
    const manifest={schema:MEDIA_VERSION,id,sourceFingerprint:row.fingerprint,fingerprint:resultFingerprint,directory,preparedAt:new Date().toISOString(),transcriptionRequested:transcribe,inputs,...layout,videos,errors,
      coverage:{originalImages:inputs.filter(x=>/assets\/(image|frame)-/.test(x.resource)).length,availableVideos:inputs.filter(x=>x.resource.startsWith('assets/video-')&&x.status==='available').length,previewCount:layout.previews.length,fullVideoUnderstood:false}};
    // Generation identity may include a refresh suffix; it is validated by the exact safe pattern.
    const file=path.join(parent,'manifest.json'),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(manifest,null,2));await rename(temp,file);return {status:'ready',...manifest};
  }
  async function read({id}){return readPreparedMedia(root,await get(id));}
  async function ocr({id}){
    if(!allowWrite)throw Error('media_preparation_read_only');const row=await get(id),m=await read({id});if(m.status!=='ready')throw Error('media_not_ready');
    if(m.ocr?.status==='completed')return m;
    if(process.platform!=='win32')return {...m,ocr:{status:'unavailable',reason:'windows_ocr_only'}};
    const directory=await contained(root,m.directory),request=path.join(directory,'ocr-input.json'),output=path.join(directory,'ocr.json');
    await writeFile(request,JSON.stringify({items:m.previews.map(p=>({name:p.name,resource:p.resource,file:path.join(directory,p.name)})),output}));
    try{if(m.previews.length)await runProcess('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(here,'media-ocr.ps1'),request],{timeout:300000});
      const result=m.previews.length?JSON.parse((await readFile(output,'utf8')).replace(/^\uFEFF/,'')):{engine:'Windows.Media.Ocr',items:[]};
      result.items=result.items.map(item=>({...item,normalizedText:(item.text||'').replace(/(?<=[\p{Script=Han}]) +(?=[\p{Script=Han}])/gu,'')}));
      m.ocr={status:result.items.every(i=>i.status==='completed')?'completed':'partial',...result,notice:'本地文字识别可能有错字；保留原图片定位，不能代替视觉核验。'};
    }catch(error){m.ocr={status:'failed',error:error.message.slice(0,500)};}
    const current=await read({id});
    if((await get(id)).fingerprint!==row.fingerprint||current.status!=='ready'||current.fingerprint!==m.fingerprint)throw Error('media_changed_during_preparation');
    m.fingerprint=digest(JSON.stringify({base:m.fingerprint,ocr:m.ocr}));delete m.status;const manifest=path.join(root,'derived/media',id,'manifest.json'),temp=manifest+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(m,null,2));await rename(temp,manifest);return {status:'ready',...m};
  }
  async function image({id,name}){
    if(!derivedPattern.test(name))throw Error('invalid_prepared_resource');const m=await read({id});if(m.status!=='ready')throw Error('media_not_ready');
    if(![...m.previews,...m.sheets,...m.videos.flatMap(v=>v.frames)].some(x=>x.name===name))throw Error('unlisted_prepared_resource');
    const file=await contained(root,m.directory+'/'+name);if((await stat(file)).size>8*1024*1024)throw Error('prepared_image_too_large');return {data:(await readFile(file)).toString('base64'),mimeType:'image/jpeg'};
  }
  return {prepare,read,image,ocr};
}
