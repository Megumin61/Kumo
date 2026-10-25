export function contentKeywords(card){
  const labels=Array.isArray(card?.keywords)?card.keywords:[];
  return [...new Set(labels.filter(value=>typeof value==='string'&&value.trim()).map(value=>value.trim()))].slice(0,3);
}
