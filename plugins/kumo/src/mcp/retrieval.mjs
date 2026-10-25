import {contentKeywords} from './presentation.mjs';
import {domainContains,topicContains} from './hierarchy.mjs';
import {knowledgeNeedsReview} from './knowledge.mjs';

const array=value=>Array.isArray(value)?value:[];
export function createRetrieval({inventory,state,terms,card,legacy=async()=>[]}){
  let cached,identity,legacyIdentity;
  function build(snapshot,wiki,notes){
    const freshCards=new Map(wiki.cards.filter(item=>{const row=snapshot.byId.get(item.id);return row?.fingerprint===item.fingerprint&&(!item.mediaFingerprint||item.mediaFingerprint===row.mediaFingerprint);}).map(item=>[item.id,item]));
    const allNodes=[...wiki.domains.map(node=>({...node,kind:'domain'})),...wiki.topics.map(node=>({...node,kind:'topic'}))];
    const nodeMap=new Map(allNodes.map(node=>[node.kind+':'+node.id,node]));
    const members=new Map(allNodes.map(node=>[node.kind+':'+node.id,new Set()]));
    const staleNodes=new Set();
    for(const node of allNodes){const key=node.kind+':'+node.id,contains=item=>node.kind==='domain'?domainContains(wiki,item,node.id):topicContains(wiki,item,node.id);
      for(const item of wiki.cards)if(contains(item)){members.get(key).add(item.id);if(!freshCards.has(item.id))staleNodes.add(key);}
      if(knowledgeNeedsReview(node,wiki.cards,snapshot.rows))staleNodes.add(key);
    }
    const raw=cached?.raw||new Map(),knowledge=cached?.knowledge||new Map(),documents=new Map(),neighbors=new Map(),knowledgeFields=new Map();
    function remove(postings,id){for(const[token,hits]of postings){hits.delete(id);if(!hits.size)postings.delete(token);}}
    for(const id of cached?.documents.keys()||[])if(!snapshot.byId.has(id)){remove(raw,id);remove(knowledge,id);}
    function index(postings,id,fields){for(const [value,weight,label]of fields)for(const token of terms(value,Infinity)){
      if(!postings.has(token))postings.set(token,new Map());const previous=postings.get(token).get(id)||{weight:0,labels:new Set()};previous.weight+=weight;previous.labels.add(label);postings.get(token).set(id,previous);
    }}
    for(const row of snapshot.rows){
      const body=(row.source.match(/(?:^|\n)## 正文\r?\n([\s\S]*)/)?.[1]||row.source).split(/\n## (?:作者在评论区|图片|视频|互动数据|讨论快照|采集说明|剪藏时|选中原文)/)[0];
      const item=freshCards.get(row.id),rawSignature=row.fingerprint+(row.mediaFingerprint||'')+JSON.stringify([row.userTags,row.record]);documents.set(row.id,{row,item,body,rawSignature});
      if(cached?.documents.get(row.id)?.rawSignature!==rawSignature){remove(raw,row.id);index(raw,row.id,[[row.meta.title,6,'标题'],[body,1,'原文'],[row.mediaText||'',1,'媒体文字'],[row.notes.join('\n'),4,'用户笔记'],[row.userTags.map(tag=>tag.label).join(' '),2,'用户标签'],[JSON.stringify(row.record||{}),1,'整理索引']]);}
      knowledgeFields.set(row.id,item?[[array(item.keywords).join(' '),5,'内容关键词'],[item.summary,3,'来源卡'],[array(item.reuseWhen).join(' '),4,'适用场景'],[array(item.evidence).filter(evidence=>evidence.view==='image').map(evidence=>evidence.quote).join(' '),3,'图片观察']]:[]);
    }
    for(const node of allNodes){const key=node.kind+':'+node.id;if(staleNodes.has(key))continue;
      const fields=[[node.name,5,'概念名称'],[array(node.keywords).join(' '),5,'知识关键词'],[array(node.triggers).join(' '),4,'概念触发词'],[node.summary,2,'领域摘要'],[[...array(node.knowledge?.takeaways),...array(node.knowledge?.steps),...array(node.knowledge?.checks)].join(' '),3,'领域方法']];
      for(const id of members.get(key))if(freshCards.has(id))knowledgeFields.get(id).push(...fields);
    }
    for(const note of notes)for(const source of array(note.sources))if(documents.has(source.id))knowledgeFields.get(source.id).push([[note.domain,note.summary,...array(note.reuseWhen)].join(' '),2,'历史派生整理']);
    for(const[id,fields]of knowledgeFields){const signature=JSON.stringify(fields);documents.get(id).knowledgeSignature=signature;if(cached?.documents.get(id)?.knowledgeSignature!==signature){remove(knowledge,id);index(knowledge,id,fields);}}
    const relations=wiki.relations.filter(relation=>freshCards.has(relation.from)&&freshCards.has(relation.to));
    for(const relation of relations)for(const id of [relation.from,relation.to]){if(!neighbors.has(id))neighbors.set(id,[]);neighbors.get(id).push(relation);}
    return {snapshot,wiki,freshCards,allNodes,nodeMap,members,staleNodes,documents,raw,knowledge,relations,neighbors};
  }
  async function context(){const [snapshot,wiki,notes]=await Promise.all([inventory(),state(),legacy()]);const signature=JSON.stringify(notes);if(!cached||identity!==wiki||cached.snapshot.version!==snapshot.version||legacyIdentity!==signature){cached=build(snapshot,wiki,notes);identity=wiki;legacyIdentity=signature;}return cached;}
  function ranked(postings,words,allowed,total){const scores=new Map();for(const word of words){const hits=postings.get(word);if(!hits)continue;const rarity=Math.log(1+total/(1+hits.size));for(const[id,hit]of hits)if(allowed.has(id)){
      const value=scores.get(id)||{id,score:0,labels:new Set()};value.score+=rarity*hit.weight;hit.labels.forEach(label=>value.labels.add(label));scores.set(id,value);
    }}return [...scores.values()].sort((first,second)=>second.score-first.score||first.id.localeCompare(second.id));}
  async function search(query,{domain='',collection='',platform='',limit=8,compiledOnly=false}={}){
    const ctx=await context(),words=terms(query);if(!words.length)throw new Error('请提供具体搜索词');
    const allowed=new Set([...ctx.documents].filter(([id,{row,item}])=>(!compiledOnly||item)&&(!domain||ctx.members.get('domain:'+domain)?.has(id))&&(!collection||row.userTags.some(tag=>tag.id===collection))&&(!platform||row.meta.platform===platform)).map(([id])=>id));
    const fused=new Map();
    for(const result of [ranked(ctx.raw,words,allowed,ctx.documents.size),ranked(ctx.knowledge,words,allowed,ctx.documents.size)])result.forEach((hit,index)=>{
      const value=fused.get(hit.id)||{id:hit.id,score:0,labels:new Set()};value.score+=1/(60+index+1);hit.labels.forEach(label=>value.labels.add(label));fused.set(hit.id,value);
    });
    const normalized=query.normalize('NFKC').toLowerCase();for(const value of fused.values())if(String(ctx.documents.get(value.id).row.meta.title).normalize('NFKC').toLowerCase()===normalized)value.score+=1;
    const seeds=[...fused.values()].sort((first,second)=>second.score-first.score||first.id.localeCompare(second.id)).slice(0,8);
    for(const seed of seeds)for(const relation of ctx.neighbors.get(seed.id)||[]){const id=relation.from===seed.id?relation.to:relation.from;if(!allowed.has(id))continue;
      if(!fused.has(id))fused.set(id,{id,score:seed.score*.45,labels:new Set(['证据关系']),relatedVia:{sourceId:seed.id,type:relation.type,reason:relation.reason}});
    }
    return [...fused.values()].sort((first,second)=>second.score-first.score||first.id.localeCompare(second.id)).slice(0,Math.min(12,limit)).map(hit=>{
      const {row,item,body}=ctx.documents.get(hit.id),matchReasons=[...hit.labels];
      return {...card(row),keywords:contentKeywords(item),snippet:(item?.summary||body).slice(0,280),reuseWhen:item?.reuseWhen||[],avoidWhen:item?.avoidWhen||[],evidenceStatus:item?.evidenceStatus||(item?'limited':'uncompiled'),limitations:item?.limitations||[],matchBasis:matchReasons.join('、')+'匹配；需核验原件',matchReasons,...(hit.relatedVia?{relatedVia:hit.relatedVia}:{})};
    });
  }
  return {context,search};
}
