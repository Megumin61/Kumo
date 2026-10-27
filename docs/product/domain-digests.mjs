// Summaries come only from the connected user's current library.
export const digests = Object.freeze({});
export function digestOf(key, model) {
  const record = model?.records?.get(key);
  if (!record || !['domain', 'topic'].includes(record.kind)) return null;
  return {covers:record.summary || '', tags:record.keywords || [],
    views:(record.knowledge?.takeaways || []).map(text=>({title:'',text})),
    links:'', essence:record.knowledge?.steps || []};
}
