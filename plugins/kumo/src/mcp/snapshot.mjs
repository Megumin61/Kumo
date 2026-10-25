import path from 'node:path';
import {watch,realpathSync} from 'node:fs';
import {readFile,readdir,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readPreparedMedia} from './media-preparation.mjs';

const pools=new Map();
const hash=value=>createHash('sha256').update(value).digest('hex');
const array=value=>Array.isArray(value)?value:[];
export function sourceSnapshot(root){
  root=path.resolve(root);
  try{root=realpathSync(root);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(pools.has(root))return pools.get(root);
  let generation=0,loaded=-1,checked=0,current,refreshing,version=0,idleTimer;
  const files=new Map(),metrics={bodyReads:0,fileReads:0,scans:0};
  const observers=new Map();
  function observe(relative){if(observers.has(relative))return;try{const resolved=realpathSync(path.join(root,relative)),local=path.relative(root,resolved);if(local==='..'||local.startsWith('..'+path.sep)||path.isAbsolute(local))return;const observer=watch(resolved,{persistent:false},()=>{generation++;});observer.unref();observer.on('error',()=>{generation++;observer.close();observers.delete(relative);});observers.set(relative,observer);}catch{}}
  for(const relative of ['', 'inbox','archive','annotations','wiki','wiki/kumo','domains/kumo-plugin'])observe(relative);
  async function file(relative,{optional=false,json=false,force=false,max=2*1024*1024}={}){
    const target=path.join(root,relative);
    let info,resolved;
    try{resolved=await realpath(target);info=await stat(resolved);}catch(error){if(optional&&error.code==='ENOENT'){files.delete(relative);return null;}throw error;}
    const local=path.relative(root,resolved);
    if(local==='..'||local.startsWith('..'+path.sep)||path.isAbsolute(local))throw new Error('路径不在授权库内');
    if(!info.isFile()||info.size>max)throw new Error('来源文件无效或过大');
    const signature=[info.mtimeMs,info.ctimeMs,info.size,resolved].join(':');
    let cached=files.get(relative);
    if(force||cached?.signature!==signature){
      const content=await readFile(resolved,'utf8');metrics.fileReads++;if(relative.endsWith('/source.md'))metrics.bodyReads++;
      cached={signature,content};files.set(relative,cached);
    }
    if(!json)return cached.content;
    if(!('parsed' in cached))cached.parsed=JSON.parse(cached.content.replace(/^\uFEFF/,''));
    return cached.parsed;
  }
  async function scan(force){
    const started=generation;metrics.scans++;
    const [tags,organization]=await Promise.all([file('tags.json',{optional:true,json:true,force}),file('organization.json',{optional:true,json:true,force})]);
    const tagMap=new Map(array(tags?.tags).map(tag=>[tag.id,tag]));
    const records=new Map(array(organization?.records).map(record=>[record.sourcePath,record]));
    const entries=[];
    for(const area of ['inbox','archive']){
      const children=await readdir(path.join(root,area),{withFileTypes:true}).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
      for(const entry of children)if(entry.isDirectory()&&!entry.name.includes('.partial-'))entries.push(area+'/'+entry.name);
    }
    const directories=new Set(['','inbox','archive','annotations','wiki','wiki/kumo','domains/kumo-plugin',...entries]);
    for(const [directory,observer]of observers)if(!directories.has(directory)){observer.close();observers.delete(directory);}
    directories.forEach(observe);
    const rows=[],warnings=[],alive=new Set(['tags.json','organization.json','wiki/kumo/state.json']);
    let cursor=0;
    async function worker(){while(cursor<entries.length){const relative=entries[cursor++],id=hash(relative).slice(0,24);
      const names=[relative+'/metadata.json',relative+'/source.md','annotations/'+id+'.json'];names.forEach(name=>alive.add(name));
      try{
        const [meta,source,annotation]=await Promise.all([file(names[0],{json:true,force}),file(names[1],{force}),file(names[2],{optional:true,json:true,force})]);
        const events=array(annotation?.events),userTags=array(events.at(-1)?.userTags??meta.userTags).filter(tag=>!tagMap.get(tag.id)?.deletedAt).map(tag=>({id:String(tag.id||''),label:tagMap.get(tag.id)?.label||String(tag.label||'')}));
        const notes=events.filter(event=>event?.kind!=='collection').map(event=>typeof event.note==='string'?event.note:'');if(!notes.length&&typeof meta.userNote==='string')notes.push(meta.userNote);
        const fingerprint=hash(source+'\n'+JSON.stringify(meta)+'\n'+JSON.stringify(events));
        const row={id,relative,meta,source,userTags,notes,events,record:records.get(relative),fingerprint};
        const prepared=await readPreparedMedia(root,row);row.mediaFingerprint=prepared.status==='ready'?prepared.fingerprint:null;
        row.mediaText=prepared.status==='ready'?[...(prepared.ocr?.items||[]).filter(i=>i.status==='completed').map(i=>i.normalizedText||i.text),...prepared.videos.filter(v=>v.transcript.status==='completed').map(v=>v.transcript.text)].join('\n'):'';
        observe('derived/media/'+id);
        rows.push(row);
      }catch{warnings.push({id,error:'来源缺失、无效、过大或越界，已跳过'});}
    }}
    await Promise.all(Array.from({length:Math.min(12,entries.length)},worker));
    for(const key of files.keys())if(!alive.has(key))files.delete(key);
    rows.sort((first,second)=>String(second.meta.capturedAt||'').localeCompare(String(first.meta.capturedAt||''))||first.id.localeCompare(second.id));
    const signature=hash(JSON.stringify(rows.map(row=>[row.id,row.fingerprint,row.mediaFingerprint,row.userTags,row.record]))+JSON.stringify(warnings));
    if(current?.signature!==signature)version++;
    current={rows,warnings,byId:new Map(rows.map(row=>[row.id,row])),version,signature};loaded=started;checked=Date.now();return current;
  }
  async function read({force=false}={}){
    clearTimeout(idleTimer);idleTimer=setTimeout(()=>{for(const observer of observers.values())observer.close();observers.clear();},2000);idleTimer.unref();
    if(!force&&current&&loaded===generation){
      if(Date.now()-checked>=2000&&!refreshing){refreshing=scan(false).catch(error=>{current={...current,warnings:[...current.warnings,{error:'后台校验失败，请刷新连接：'+error.message}]};return current;}).finally(()=>{refreshing=null;});}
      return current;
    }
    if(refreshing){await refreshing;if(force)return read({force:true});}
    refreshing=scan(force);try{return await refreshing;}finally{refreshing=null;}
  }
  const api={read,file,invalidate:()=>{generation++;},metrics,close:()=>{clearTimeout(idleTimer);for(const observer of observers.values())observer.close();pools.delete(root);}};
  pools.set(root,api);return api;
}
