import {contentKeywords} from './presentation.mjs';
export function createNavigation({context,card}){
  function key(node){return node.kind+':'+node.id;}
  function parent(node){return node.kind==='domain'?(node.parentDomainId?'domain:'+node.parentDomainId:'root'):(node.parentTopicId?'topic:'+node.parentTopicId:'domain:'+node.domainId);}
  async function atlas(){
    const ctx=await context(),domains=ctx.allNodes.filter(node=>node.kind==='domain');
    const nodes=domains.map(node=>({kind:node.kind,id:node.id,name:node.name,parentId:node.parentDomainId?'domain:'+node.parentDomainId:'root:',sourceCount:[...(ctx.members.get(key(node))||[])].filter(id=>ctx.freshCards.has(id)).length}));
    const edges=new Map();
    for(const relation of ctx.relations){
      const from=ctx.freshCards.get(relation.from),to=ctx.freshCards.get(relation.to);
      if(from.evidenceStatus==='index_only'||to.evidenceStatus==='index_only')continue;
      for(const fromId of from.domainIds)for(const toId of to.domainIds){if(fromId===toId)continue;
        const ends=[fromId,toId].sort(),edgeKey=ends.join(':');
        if(!edges.has(edgeKey))edges.set(edgeKey,{from:'domain:'+ends[0],to:'domain:'+ends[1],count:0,types:[]});
        const edge=edges.get(edgeKey);edge.count++;if(!edge.types.includes(relation.type))edge.types.push(relation.type);
      }
    }
    return {revision:ctx.wiki.revision,nodes,edges:[...edges.values()].slice(0,150),edgeTotal:edges.size};
  }
  async function focus({kind='root',id='',offset=0,relatedOffset=0,sourceOffset=0,sources=false,childLimit=8}={}){
    if(![3,8].includes(childLimit))throw new Error('无效分支数量');
    const ctx=await context(),center=kind==='root'?{kind:'root',id:'',name:'Kumo',summary:'从收藏中积累知识，让不同领域的经验彼此连接。'}:ctx.nodeMap.get(kind+':'+id);
    if(!center)throw new Error('知识节点不存在');
    const compact=node=>({kind:node.kind,id:node.id,name:node.name,summary:node.summary,sourceCount:node.kind==='root'?ctx.snapshot.rows.length:[...(ctx.members.get(key(node))||[])].filter(sourceId=>ctx.freshCards.has(sourceId)).length,summaryNeedsReview:ctx.staleNodes.has(key(node))});
    const centerKey=kind==='root'?'root':key(center),breadcrumbs=[];let ancestor=center;
    while(ancestor&&ancestor.kind!=='root'){breadcrumbs.unshift(compact(ancestor));const previous=parent(ancestor);ancestor=previous==='root'?null:ctx.nodeMap.get(previous);}
    breadcrumbs.unshift({kind:'root',id:'',name:'Kumo'});
    const children=ctx.allNodes.filter(node=>parent(node)===centerKey);
    const ids=kind==='root'?new Set(ctx.freshCards.keys()):ctx.members.get(centerKey)||new Set();
    const related=new Map();
    if(kind!=='root')for(const relation of ctx.relations){if([relation.from,relation.to].some(id=>ctx.freshCards.get(id).evidenceStatus==='index_only'))continue;const hasFrom=ids.has(relation.from),hasTo=ids.has(relation.to);if(hasFrom===hasTo)continue;
      const targetId=hasFrom?relation.to:relation.from,source=ctx.freshCards.get(targetId);
      const candidates=[...source.topicIds.map(value=>ctx.nodeMap.get('topic:'+value)),...source.domainIds.map(value=>ctx.nodeMap.get('domain:'+value))].filter(Boolean);
      const target=candidates.find(node=>!ids.has(targetId)&&!breadcrumbs.some(crumb=>crumb.kind===node.kind&&crumb.id===node.id));if(!target)continue;
      const targetKey=key(target);if(!related.has(targetKey))related.set(targetKey,{node:compact(target),relations:[]});
      if(related.get(targetKey).relations.length<3)related.get(targetKey).relations.push({...relation,fromSource:card(ctx.snapshot.byId.get(relation.from)),toSource:card(ctx.snapshot.byId.get(relation.to)),fromEvidence:ctx.freshCards.get(relation.from).evidence.find(evidence=>evidence.quote.includes(relation.fromQuote)),toEvidence:ctx.freshCards.get(relation.to).evidence.find(evidence=>evidence.quote.includes(relation.toQuote))});
    }
    const sourceCards=[...ids].map(sourceId=>ctx.freshCards.get(sourceId)).filter(Boolean),relatedValues=[...related.values()];
    const paginate=(value,size,total)=>{if(!Number.isInteger(value)||value<0||value>100000)throw new Error('无效分页');return {start:value,next:value+size<total?value+size:null};};
    const childPage=paginate(offset,childLimit,children.length),relationPage=paginate(relatedOffset,3,relatedValues.length),sourcePage=paginate(sourceOffset,10,sourceCards.length);
    return {revision:ctx.wiki.revision,total:ctx.snapshot.rows.length,compiled:ctx.freshCards.size,pending:ctx.snapshot.rows.length-ctx.freshCards.size,indexOnly:[...ctx.freshCards.values()].filter(item=>item.evidenceStatus==='index_only').length,
      center:{...compact(center),keywords:contentKeywords(center),knowledge:center.knowledge,avoidWhen:center.avoidWhen||[]},breadcrumbs,
      children:children.slice(childPage.start,childPage.start+childLimit).map(compact),childTotal:children.length,nextOffset:childPage.next,
      related:relatedValues.slice(relationPage.start,relationPage.start+3),relatedTotal:relatedValues.length,nextRelatedOffset:relationPage.next,
      references:kind==='root'||ctx.staleNodes.has(centerKey)?[]:sourceCards.filter(item=>item.evidenceStatus!=='index_only').slice(0,3).map(item=>({...card(ctx.snapshot.byId.get(item.id)),summary:item.summary,keywords:contentKeywords(item,ctx.wiki),reuseWhen:item.reuseWhen||[],evidenceStatus:item.evidenceStatus||'limited'})),
      sources:sources?sourceCards.slice(sourcePage.start,sourcePage.start+10).map(item=>({...card(ctx.snapshot.byId.get(item.id)),keywords:contentKeywords(item,ctx.wiki),summary:item.summary,evidenceStatus:item.evidenceStatus||'limited',limitations:item.limitations})):[],sourceTotal:sourceCards.length,nextSourceOffset:sources?sourcePage.next:null,warnings:ctx.snapshot.warnings};
  }
  return {focus,atlas};
}
