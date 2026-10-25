// Stable AI taxonomy only. Never reads or changes user-visible tags.
export function descendants(nodes,id,parentKey){
  const ids=new Set([id]);let changed=true;
  while(changed){changed=false;for(const n of nodes)if(ids.has(n[parentKey])&&!ids.has(n.id)){ids.add(n.id);changed=true;}}
  return ids;
}
export function domainContains(state,card,id){return card.domainIds.some(v=>descendants(state.domains,id,'parentDomainId').has(v));}
export function topicContains(state,card,id){return card.topicIds.some(v=>descendants(state.topics,id,'parentTopicId').has(v));}
export function validateDomainHierarchy(domains){
  for(const n of domains){let id=n.parentDomainId,depth=0;const seen=new Set([n.id]);while(id){if(seen.has(id)||++depth>4)throw new Error('领域层级有环或超过4层');seen.add(id);const parent=domains.find(v=>v.id===id);if(!parent)throw new Error('父领域不存在');id=parent.parentDomainId;}}
}
