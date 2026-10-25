const platforms={x:'X',twitter:'X',xiaohongshu:'小红书',bilibili:'哔哩哔哩',youtube:'YouTube',wechat:'微信公众号',zhihu:'知乎'};
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():'';
export function sourceMetadata(record){
 const raw=clean(record.platform),platform=platforms[raw.toLowerCase()]||raw;
 const a=record.author??record.card?.source?.author,author=clean(typeof a==='object'?a?.name||a?.displayName:a);
 return [platform,!/^(unknown|未记录作者|示例作者)$/i.test(author)?author:''].filter(Boolean).join(' · ');
}
export function sourceIntro(record){
 const text=clean(record.card?.summary||record.description||record.excerpt||record.abstract||(record.kind!=='source'?record.summary:''));
 if(!text)return '';
 const sentence=text.match(/^.*?[。！？!?](?:\s|$)?/u)?.[0]||text;
 return sentence.length>90?sentence.slice(0,89)+'…':sentence;
}
export const recentCollectionHint='最近一批收藏：距最新一次收藏时间 3 天内的内容';

// Values are screen pixels. Badge and dot keep a fixed size ratio at every zoom.
export function nodeAdornmentMetrics(size,zoom=1){
 const screenSize=size*Math.max(.05,zoom),badgeRadius=Math.max(9.5,Math.min(16,screenSize*.12));
 return {badgeRadius,fontSize:Math.max(11,Math.min(17,badgeRadius*1.15)),dotRadius:badgeRadius*.43,haloRadius:badgeRadius*.76};
}
