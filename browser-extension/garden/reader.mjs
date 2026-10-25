import {appendSourceDetail} from './source-detail.mjs';
import {summaryLead,appendSummaryRemainder} from './summary-presentation.mjs';
import {statusNames,typeNames} from './model.mjs';
import {ROOT,roots,children,countOf} from './schema.mjs';
import {gardenInsights} from './garden-insights.mjs';
import {renderGardenHome} from './garden-home.mjs';
const byId=id=>document.getElementById(id),short=(value,length=40)=>Array.from(value||'').length>length?Array.from(value).slice(0,length).join('')+'…':value||'';
function element(tag,text='',className=''){const result=document.createElement(tag);result.textContent=text;if(className)result.className=className;return result;}
export function renderReader(model,key,onSelect,context={}){
  const record=model.records.get(key);if(!record)return;
  const body=byId('reader-body');body.replaceChildren();byId('detail-title').textContent=short(record.name,58);byId('detail-title').title=record.name;byId('detail-summary').textContent=record.kind==='source'?'':record.summary||'';
  byId('detail-kind').textContent=record.kind==='source'?'收藏内容':{brand:'知识总览',domain:'领域知识',topic:'知识主题',bundle:'双端证据汇总',relation:'已有知识联系',lens:'阅读入口',flow:'入口与领域的对应材料',pending:'待编译材料',unassigned:'归属待完善'}[record.kind]||'';
  byId('keywords').replaceChildren(...(record.kind==='source'?[]:record.keywords||[]).slice(0,3).map(keyword=>element('span',keyword)));
  if(['domain','topic'].includes(record.kind)){const summary=record.card?.summary||record.summary||'';if(summary){byId('detail-summary').textContent=summaryLead(summary);appendSummaryRemainder(body,summary);}}
  function section(title){const result=element('section','','reader-section');result.append(element('h3',title));body.append(result);return result;}
  function list(parent,items){if(!items?.length)return;const result=element('ul');for(const item of items)result.append(element('li',item));parent.append(result);}
  function recordButton(parent,key,caption='读摘要 →'){const item=model.records.get(key);if(!item)return;const button=element('button','','reader-link'),name=item.kind==='relation'?short(model.records.get(item.from)?.name,14)+' ↔ '+short(model.records.get(item.to)?.name,14):item.name;button.title=name;button.append(element('strong',short(name,40)),element('span',caption));button.addEventListener('click',()=>onSelect(key));parent.append(button);}
  function evidence(parent,relation){const detail=document.createElement('details');detail.open=record.kind==='relation';detail.append(element('summary',(typeNames[relation.type]||relation.type)+' · '+relation.reason));for(const [end,quote]of [[relation.from,relation.fromQuote],[relation.to,relation.toQuote]]){detail.append(element('blockquote',quote));recordButton(detail,end);}parent.append(detail);}
  if(key===ROOT&&context.living){renderGardenHome(model,body,onSelect,context);return;}
  if(key===ROOT){
    byId('detail-title').textContent={network:'知识花园',field:'收藏聚落',converge:'知识花园'}[context.mode]||'知识花园';byId('detail-summary').textContent='';
    if(context.mode==='field'){const grid=element('div','','metric-grid');for(const [value,label]of [[model.sources.length,'收藏'],[model.groups.length,'领域']]){const item=element('div');item.append(element('strong',String(value)),element('span',label));grid.append(item);}body.append(grid);}
    const entries=section('领域');for(const group of context.mode==='field'?model.groups:roots(model))recordButton(entries,group.key,(context.mode==='field'?group.displayCount:countOf(group))+' 篇');
    if(context.mode==='field'){const bridges=gardenInsights(model).bridges;if(bridges.length){const area=section('领域联系');for(const bridge of bridges){model.records.set(bridge.key,bridge);recordButton(area,bridge.key,bridge.relations.length+' 条联系');}}}return;
  }
  if(record.kind==='bundle'){const entries=section('关联的知识节点');recordButton(entries,record.from,'进入 →');recordButton(entries,record.to,'进入 →');const facts=section('已有联系 · '+record.relations.length+' 条');for(const relation of record.relations)evidence(facts,relation);return;}
  if(record.kind==='relation'){evidence(section('双方依据'),record);return;}
  if(record.kind==='source'){
    appendSourceDetail(body,record);
    const linked=model.relations.filter(relation=>relation.from===key||relation.to===key);
    const card=record.card;
    if(card){const use=section(record.status==='index_only'?'仅用于发现，不作为确定结论':'这篇材料提供什么');list(use,card.reuseWhen);const membership=section('知识归属');for(const owner of record.memberships)recordButton(membership,owner,'进入领域 →');for(const topic of card.topicIds||[])recordButton(membership,'topic:'+topic,'进入主题 →');
      if(record.status!=='index_only'&&card.evidence?.length){const facts=section('参考元素与事例');for(const item of card.evidence.slice(0,3)){facts.append(element('blockquote',item.quote));facts.append(element('p',item.view==='image'?'已有整理 · 图片观察':'已有整理 · 正文摘录','reader-note'));}}
      if(card.limitations?.length)list(section('仍缺少的依据'),card.limitations);
    }
    if(linked.length){const area=section('这些联系的依据');for(const relation of linked)evidence(area,relation);}
    if(linked.length){const area=document.createElement('details');area.className='reader-section quiet-related';const others=new Set(linked.map(r=>r.from===key?r.to:r.from));area.append(element('summary','相关收藏 · '+others.size));const seen=new Set();for(const relation of linked){const other=relation.from===key?relation.to:relation.from;if(seen.has(other))continue;seen.add(other);recordButton(area,other,'阅读');area.append(element('p',short(relation.reason,60),'related-reading-reason'));if(seen.size===3)break;}body.append(area);}
    const link=element('a','阅读原件与图片 ↗','original-link');link.href='http://127.0.0.1:43789/ui/library.html#item='+encodeURIComponent(record.id);link.target='_blank';link.rel='noopener noreferrer';body.append(link);return;
  }
  if(context.mode==='field'){const metric=gardenInsights(model).metrics.get(key);if(metric){const area=section('领域积累'),grid=element('div','','metric-grid');for(const [value,label]of [[metric.count,'主归属收藏'],[metric.topics,'知识主题'],[metric.internal,'内部联系'],[metric.cross,'跨领域联系']]){const item=element('div');item.append(element('strong',String(value)),element('span',label));grid.append(item);}area.append(grid);if(metric.possiblePairs)area.append(element('p','已记录内部联系：'+metric.linkedPairs+' / '+metric.possiblePairs+' 组材料对。','density-note'));}}
  if(context.mode==='field'&&context.onOpenBranch&&['domain','topic','pending','unassigned'].includes(record.kind)){const enter=element('button','在知识花园中展开 →','original-link branch-link');enter.onclick=()=>context.onOpenBranch(key);body.append(enter);}
  const knowledge=record.knowledge;if(knowledge){list(section('有哪些观点与信息'),knowledge.takeaways?.slice(0,3));list(section('可以沉淀复用的方法'),knowledge.steps?.slice(0,3));}else if(['domain','topic'].includes(record.kind))section('已有内容状态').append(element('p',record.summaryNeedsReview?'来源变化，旧方法暂不作为依据。':'已有主题摘要，尚未形成稳定的可复用方法。'));
  const next=children(model,key).filter(child=>child.kind!=='source');if(next.length){const area=section('下一层 · '+next.length+' 个');for(const item of next.slice(0,4))recordButton(area,item.key,countOf(item)+' 篇 · 展开');if(next.length>4){const detail=document.createElement('details');detail.append(element('summary','查看其余下级'));for(const item of next.slice(4))recordButton(detail,item.key,'展开 →');area.append(detail);}}
  const sources=section('参考材料 · '+(record.members?.length||0)+' 篇');for(const source of (record.members||[]).slice(0,2)){recordButton(sources,source);sources.append(element('p',model.records.get(source).summary));}


  const relations=model.relations.filter(relation=>record.members?.includes(relation.from)||record.members?.includes(relation.to));if(relations.length){const area=section('已有联系与理由');for(const relation of relations)evidence(area,relation);}
}


