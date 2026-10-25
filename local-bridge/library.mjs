import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {readFile, readdir, mkdir, writeFile, rename, realpath, stat} from 'node:fs/promises';
import {sourceSnapshot} from '../plugins/kumo/src/mcp/snapshot.mjs';
import {contentKeywords} from '../plugins/kumo/src/mcp/presentation.mjs';
import {sourceUrl} from '../plugins/kumo/src/mcp/source-url.mjs';

export const itemId = relative => createHash('sha256').update(relative).digest('hex').slice(0, 24);
const read = async file => { try { return JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')); } catch { return null; } };
async function contained(root, file) {
  const [base, resolved] = await Promise.all([realpath(root), realpath(file)]);
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('library_path_not_allowed');
  return resolved;
}
async function jsonWrite(file, data) {
  await mkdir(path.dirname(file), {recursive: true});
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(data, null, 2), 'utf8');
  await rename(temporary, file);
}

export function createLibrary(root) {
  const snapshot=sourceSnapshot(root);
  let queue = Promise.resolve();
  const locked = operation => {
    const task = queue.then(async()=>{try{return await operation();}finally{snapshot.invalidate();}}); queue = task.catch(() => {}); return task;
  };
  async function tags() {
    let data;
    try { data=JSON.parse((await readFile(path.join(root,'tags.json'),'utf8')).replace(/^\uFEFF/,'')); }
    catch(error){if(error.code!=='ENOENT')throw new Error('tags_unreadable_preserved');}
    if(data&&!Array.isArray(data.tags))throw new Error('tags_unreadable_preserved');
    const values=(data?.tags||[]).filter(tag=>tag&&typeof tag.id==='string'&&typeof tag.label==='string');
    // Project orphaned labels from existing records without rewriting the registry.
    for(const row of await inventory())for(const tag of row.events.at(-1)?.userTags??row.metadata.userTags??[])
      if(tag&&typeof tag.id==='string'&&typeof tag.label==='string'&&!values.some(t=>t.id===tag.id))values.push({...tag,recovered:true});
    return values;
  }
  async function updateTag(input) {
    return locked(async () => {
      const values = await tags();
      const label = String(input.label || '').trim();
      if (input.action === 'add') {
        if (!label || label.length > 40 || /[\x00-\x1f]/.test(label)) throw new Error('invalid_tag_label');
        const existing = values.find(tag => tag.label === label && !tag.hidden);
        if (existing) return existing;
        const tag = {id: randomUUID(), label, hidden: false}; values.push(tag);
        await jsonWrite(path.join(root, 'tags.json'), {schema: 'kumo-tags-v1', tags: values}); return tag;
      }
      const tag = values.find(tag => tag.id === input.id);
      if (!tag) throw new Error('tag_not_found');
      if (input.action === 'rename') {
        if (!label || label.length > 40 || /[\x00-\x1f]/.test(label)) throw new Error('invalid_tag_label');
        if (values.some(other => other.id !== tag.id && other.label === label && !other.hidden)) throw new Error('tag_label_exists');
        tag.label = label;
      } else if (input.action === 'hide') tag.hidden = true;
      else if (input.action === 'delete') {tag.hidden=true;tag.deletedAt=new Date().toISOString();}
      else if (input.action === 'restore') {tag.hidden=false;delete tag.deletedAt;}
      else throw new Error('invalid_tag_action');
      await jsonWrite(path.join(root, 'tags.json'), {schema: 'kumo-tags-v1', tags: values}); return tag;
    });
  }
  async function annotate(relativePath, metadata, seed = false) {
    return locked(async () => {
      const note = String(metadata?.userNote ?? '');
      const kind = metadata?.kind === 'collection' ? 'collection' : 'note';
      const file = path.join(root, 'annotations', `${itemId(relativePath)}.json`);
      const data = await read(file) || {schema: 'kumo-annotations-v1', relativePath, events: []};
      const previousTags=data.events.at(-1)?.userTags ?? (await read(path.join(root,relativePath,'metadata.json')))?.userTags ?? [];
      const userTags = (Array.isArray(metadata?.userTags)?metadata.userTags:previousTags).slice(0, 20).map(tag => ({id: String(tag.id), label: String(tag.label).slice(0, 40)}));
      if (!note && !userTags.length && kind !== 'collection') return;
      if (note.length > 100000) throw new Error('note_too_large');
      if (seed && data.events.length) return;
      const last = data.events.at(-1);
      if (last?.note === note && JSON.stringify(last.userTags) === JSON.stringify(userTags)) return;
      data.events.push({id: randomUUID(), capturedAt: metadata.capturedAt || new Date().toISOString(), note, userTags, kind});
      await jsonWrite(file, data);
    });
  }
  async function inventory() {
    return (await snapshot.read()).rows.map(row=>({id:row.id,relativePath:row.relative,metadata:row.meta,events:row.events,fingerprint:row.fingerprint}));
  }
  async function tagOverview(){
    const [values,rows]=await Promise.all([tags(),inventory()]);
    const counts=new Map();let unclassifiedCount=0;
    for(const row of rows){const ids=[...new Set((row.events.at(-1)?.userTags??row.metadata.userTags??[]).map(tag=>tag.id))].filter(id=>!values.find(tag=>tag.id===id)?.deletedAt);if(!ids.length)unclassifiedCount++;for(const id of ids)counts.set(id,(counts.get(id)||0)+1);}
    return {tags:values.map(tag=>({...tag,count:counts.get(tag.id)||0})),unclassifiedCount,total:rows.length};
  }
  async function knowledgeFor(rows){
    try{const wiki=await snapshot.file('wiki/kumo/state.json',{optional:true,json:true,max:8*1024*1024});
      const cards=new Map((wiki?.cards||[]).map(card=>[card.id,card]));
      return new Map(rows.map(row=>{const card=cards.get(row.id);return [row.id,card?.fingerprint===row.fingerprint?{contentKeywords:contentKeywords(card,wiki),contentSummary:card.summary,evidenceStatus:card.evidenceStatus||'limited',reuseWhen:card.reuseWhen||[],limitations:card.limitations||[]}:null];}));
    }catch{return new Map();}
  }
  async function list({q = '', tag = '', domain = '', offset = 0, limit = 100} = {}) {
    const [rows, allTags, organization] = await Promise.all([inventory(), tags(), read(path.join(root, 'organization.json'))]);
    const knowledgeMap=await knowledgeFor(rows);
    const domains = Array.isArray(organization?.domains) ? organization.domains : [];
    const records = Array.isArray(organization?.records) ? organization.records : [];
    let items = rows.map(row => {
      const meta = row.metadata;
      const latest = row.events.at(-1);
      const latestNote = [...row.events].reverse().find(event => event.kind !== 'collection');
      const record = records.find(value => value.sourcePath === row.relativePath);
      const userTags = (Array.isArray(latest?.userTags ?? meta.userTags) ? (latest?.userTags ?? meta.userTags) : []).filter(tag=>!allTags.find(t=>t.id===tag.id)?.deletedAt).map(tag => {
        const current = allTags.find(value => value.id === tag.id);
        return current ? {id: current.id, label: current.label} : tag;
      });
      return {id: row.id, relativePath: row.relativePath, title: meta.title, url: sourceUrl(meta), platform: meta.platform, author:typeof meta.author==='string'?meta.author:'', authorUrl:meta.authorUrl || '', excerpt:typeof meta.excerpt==='string'?meta.excerpt:'', capturedAt: meta.capturedAt,
        userNote: latestNote?.note ?? meta.userNote ?? '', userTags, contentKeywords:knowledgeMap.get(row.id)?.contentKeywords||[],contentSummary:knowledgeMap.get(row.id)?.contentSummary||'',evidenceStatus:knowledgeMap.get(row.id)?.evidenceStatus||'uncompiled', stats: meta.stats || {}, warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
        files: meta.files || {}, organization: record || null, organized: record?.status === 'organized', noteHistoryCount: row.events.length};
    });
    const collectionCounts = allTags.map(value => ({...value, count: items.filter(item => item.userTags.some(tag => tag.id === value.id)).length,
      covers: items.filter(item => item.userTags.some(tag => tag.id === value.id) && (item.files?.frames?.length || item.files?.images?.length)).slice(0, 4).map(item => ({id: item.id, title:item.title, files: item.files}))}));
    const unclassifiedCount = items.filter(item => !item.userTags.length).length;
    const unclassifiedCovers = items.filter(item => !item.userTags.length && (item.files?.frames?.length || item.files?.images?.length)).slice(0,4).map(item=>({id:item.id,title:item.title,files:item.files}));
    if (q) { const needle = q.toLocaleLowerCase(); items = items.filter(item => [item.title, item.userNote, JSON.stringify(item.organization), ...item.contentKeywords, ...item.userTags.map(t => t.label)].join(' ').toLocaleLowerCase().includes(needle)); }
    if (tag) items = items.filter(item => tag === '__unclassified' ? !item.userTags.length : item.userTags.some(t => t.id === tag));
    if (domain) items = items.filter(item => item.organization?.domainIds?.includes(domain));
    const total = items.length;
    const page = items.slice(Math.max(0, offset), Math.max(0, offset) + Math.min(200, Math.max(1, limit)));
    await Promise.all(page.map(async item=>{
      if(item.excerpt)return;
      try {
        const file=await contained(root,path.join(root,item.relativePath,'source.md'));
        if((await stat(file)).size>2*1024*1024)return;
        const source=await readFile(file,'utf8'), match=source.match(/(?:^|\n)## 正文\r?\n([\s\S]*)/);
        if(match)item.excerpt=match[1].split(/\n## /)[0].replace(/\s+/g,' ').trim().slice(0,240);
      } catch {}
    }));
    return {ok: true, total, allTotal: rows.length, unclassifiedCount, unclassifiedCovers, collectionCounts, items:page, tags: allTags, domains};
  }
  async function detail(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) throw new Error('invalid_item_id');
    const row = (await inventory()).find(item => item.id === id);
    if (!row) throw new Error('item_not_found');
    const file = await contained(root, path.join(root, row.relativePath, 'source.md'));
    const source = await readFile(file, 'utf8');
    if (source.length > 2 * 1024 * 1024) throw new Error('source_too_large');
    const allTags=await tags();
    const effectiveUserTags=(row.events.at(-1)?.userTags??row.metadata.userTags??[]).filter(t=>!allTags.find(v=>v.id===t.id)?.deletedAt).map(t=>({id:t.id,label:allTags.find(v=>v.id===t.id)?.label||t.label}));
    return {ok: true, ...row, url:sourceUrl(row.metadata), source, effectiveUserTags,contentKeywords:[],contentSummary:'',...(await knowledgeFor([row])).get(row.id)};
  }
  async function asset(id, name) {
    if (!/^assets\/(?:image|frame)-\d{2}\.(?:jpg|jpeg|png|webp|gif|avif|img)$/i.test(name) && !/^assets\/video-\d{2}\.(?:mp4|webm|mov|m4v)$/i.test(name)) throw new Error('asset_not_allowed');
    const row = (await inventory()).find(item => item.id === id);
    if (!row) throw new Error('item_not_found');
    return contained(root, path.join(root, row.relativePath, name));
  }
  async function classify({id,label,reason,expectedFingerprint}) {
    return locked(async()=>{
      if(!/^[a-f0-9]{24}$/.test(id)||!/^.{1,40}$/.test(label)||/[\x00-\x1f]/.test(label)||typeof reason!=='string'||reason.length>500)throw new Error('invalid_classification');
      const row=(await inventory()).find(r=>r.id===id);if(!row)throw new Error('item_not_found');
      const sourceFile=await contained(root,path.join(root,row.relativePath,'source.md'));
      const source=await readFile(sourceFile,'utf8');
      const fingerprint=createHash('sha256').update(source+'\n'+JSON.stringify(row.metadata)+'\n'+JSON.stringify(row.events)).digest('hex');
      if(fingerprint!==expectedFingerprint)throw new Error('classification_source_changed');
      const registry=await tags();
      if((row.events.at(-1)?.userTags??row.metadata.userTags??[]).some(t=>!registry.find(v=>v.id===t.id)?.deletedAt))throw new Error('manual_classification_preserved');
      const file=path.join(root,'annotations',id+'.json');await mkdir(path.dirname(file),{recursive:true});await contained(root,path.dirname(file));
      try{await contained(root,file);}catch(e){if(e.code!=='ENOENT')throw e;}
      const tagFile=path.join(root,'tags.json');try{await contained(root,tagFile);}catch(e){if(e.code!=='ENOENT')throw e;}
      const values=await tags();let tag=values.find(t=>t.label===label.trim()&&!t.hidden);
      if(!tag){tag={id:randomUUID(),label:label.trim(),hidden:false};values.push(tag);await jsonWrite(tagFile,{schema:'kumo-tags-v1',tags:values});}
      const data=await read(file)||{schema:'kumo-annotations-v1',relativePath:row.relativePath,events:[]};
      // Seed the original note so collection events never erase it in existing UI.
      if(!data.events.length&&typeof row.metadata.userNote==='string')data.events.push({id:randomUUID(),capturedAt:row.metadata.capturedAt||'',kind:'note',note:row.metadata.userNote,userTags:row.metadata.userTags||[]});
      data.events.push({id:randomUUID(),capturedAt:new Date().toISOString(),kind:'collection',note:'',userTags:[tag],origin:'ai-classification',reason});
      await jsonWrite(file,data);return {ok:true,saved:true,id,tag,sourceUnchanged:true};
    });
  }
  return {list, detail, asset, tags, tagOverview, updateTag, annotate, classify};
}
