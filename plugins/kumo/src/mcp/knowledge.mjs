// Derived methods remain evidence-backed data, never executable source instructions.
export function knowledgeNeedsReview(node, cards, rows) {
  return Boolean(node.knowledge?.evidence?.some(e=>{
    const c=cards.find(c=>c.id===e.sourceId),r=rows.find(r=>r.id===e.sourceId);
    return !c||!r||r.fingerprint!==e.fingerprint||c.fingerprint!==e.fingerprint||c.mediaFingerprint&&c.mediaFingerprint!==r.mediaFingerprint;
  }));
}
export function groundKnowledge(node,cards,rows) {
  if(!node.knowledge)return node;
  if(!node.knowledge.evidence?.length)throw new Error('领域方法必须有来源证据');
  return {...node,knowledge:{...node.knowledge,evidence:node.knowledge.evidence.map(e=>{
    const c=cards.find(c=>c.id===e.sourceId),r=rows.find(r=>r.id===e.sourceId);
    if(!c||!r||c.fingerprint!==r.fingerprint||c.mediaFingerprint&&c.mediaFingerprint!==r.mediaFingerprint||!c.evidence.some(v=>v.view===e.view&&v.resource===e.resource&&v.quote.includes(e.quote)))throw new Error('领域方法证据无效或已过期');
    if(c.evidenceStatus==='index_only')throw new Error('仅索引来源不能支撑领域方法');
    return {...e,fingerprint:c.fingerprint};
  })}};
}
export function validateTopicHierarchy(topics) {
  for(const t of topics){const seen=new Set([t.id]);let next=t.parentTopicId,depth=0;
    while(next){if(seen.has(next)||++depth>6)throw new Error('主题层级有环或超过6层');seen.add(next);const p=topics.find(n=>n.id===next);if(!p||p.domainId!==t.domainId)throw new Error('子主题必须属于同一领域');next=p.parentTopicId;}
  }
}
