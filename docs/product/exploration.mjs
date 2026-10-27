import {discoverySize} from './map-presentation.mjs';
import {hashSeed} from './garden-life.mjs';
export const plantingAngle=key=>hashSeed(key+':planted')*Math.PI*2;
import {footprint,intersects} from './spacing.mjs';
import {catalogue,catalogueById,baseFamilies,ruleProgress} from './garden-catalogue.mjs';
import {gardenInsights} from './garden-insights.mjs';
import {PLANT_FAMILIES} from './garden-life.mjs';
import {originOf} from './garden-stats.mjs';

// v16.2 · Plain-language guide for every rule: where to click, how far along, what it gives.
const HOW={
 collected:{short:'继续收藏',steps:['在小红书或 X 上看到想留下的内容，点 Kumo 插件的「收藏」','新收藏会先落在「待编译」花圃里，篇数马上 +1']},
 compiled:{short:'编译收藏',steps:['在 ChatGPT 里对 Kumo 说「编译我的新收藏」','编译完回到这里点右上角刷新，篇数自动 +1']},
 domains:{short:'长出新领域',steps:['收藏一些新方向的内容','编译时，AI 会把它们归成一个新领域，地图上多出一片花圃']},
 biggest:{short:'把一片领域养大',steps:['继续收藏同一个方向的内容','编译后它们会长进同一片花圃']},
 growing:{short:'让更多领域长起来',steps:['给小领域多收藏几篇','一个领域收藏到 3 篇，就从幼苗进入生长中']},
 bloom:{short:'让领域盛开',steps:['持续收藏同一个方向','一个领域收藏到 8 篇就算盛开']},
 bridges:{short:'让领域连起来',steps:['收藏能把两个方向串起来的内容','编译时 AI 发现两边的联系，地图上会出现「N 条联系」']}
};
export const COMPILE_PROMPT='请用 Kumo 编译我的新收藏，并更新知识花园。';
export function explorationGuide(entry){
 const item=catalogueById.get(entry.familyId),how=HOW[item?.rule]||{short:entry.description,steps:[entry.description]},left=Math.max(0,(entry.rule?.target||1)-(entry.rule?.value||0));
 const plant=PLANT_FAMILIES.includes(entry.familyId);
 const benefits=[entry.reward,plant?'它会加入你的植物池：收藏聚落里的叶子开始长出这种形态。':'可以在图鉴里把它用到任意一个领域上，换掉原来的植物。'].filter(Boolean),unit={collected:'篇收藏',compiled:'篇编译',domains:'个领域',biggest:'篇',growing:'个领域',bloom:'个领域',bridges:'组联系'}[item?.rule]||'';
 return {short:how.short,steps:how.steps,left,progressText:entry.owned?'已点亮':left?`还差 ${left} ${unit}`:'条件已满足',benefits,action:item?.rule==='compiled'?'compile':item?.rule==='collected'||item?.rule==='domains'?'collect':null};
}

export function excerpt(text,limit=66){const value=String(text||'').trim().replace(/\s+/g,' '),first=value.match(/^.*?[。！？](?:[”」])?/)?.[0]||value;return Array.from(first).length>limit?Array.from(first).slice(0,limit-1).join('')+'…':first;}
export function compactSummary(record){
 const valid=!record?.summaryNeedsReview,knowledge=valid?record?.knowledge:null,brief=value=>{const first=String(value).split(/[，；]/)[0];return excerpt(first.length>=18?first:value,48);},points=(knowledge?.takeaways||[]).filter(v=>typeof v==='string'&&v.trim()).slice(0,2).map(brief),method=excerpt((knowledge?.steps||[]).find(v=>typeof v==='string'&&v.trim()),54),intro=String(record?.summary||'').split(/[：:；;]/)[0];
 return {intro:excerpt(intro.length>=14?intro:record?.summary,48),points,method,available:valid&&!!(points.length||method),needsReview:!!record?.summaryNeedsReview};
}
// v16: eight landmarks. Each unlock rule is the matching atlas rule (garden-catalogue),
// so the map, the reader and the atlas always agree. Forms: seed → sprout → bloom.
export const explorationDefinitions=[
 {id:'seed',familyId:'X01',name:'领域花种',reward:'栀子花开在最新长出的领域旁，提醒你这里刚开辟。'},
 {id:'summary',familyId:'F05',name:'主题篝火',reward:'篝火边留着各主题的自动小结，打开领域先看要点。'},
 {id:'return',familyId:'X03',name:'书签叶',reward:'书签叶夹在编译好的收藏里，点开直接看它的要点。'},
 {id:'pine',familyId:'F01',name:'林间松树',reward:'最大的那片领域旁长出松树。'},
 {id:'butterfly',familyId:'G05',name:'蝶翼',reward:'蝴蝶停在联系最多的花圃上，提示哪两片值得一起读。'},
 {id:'bell',familyId:'G06',name:'风铃花',reward:'风铃花挂在领域入口，轻轻摇动。'},
 {id:'stone',familyId:'G03',name:'溪石',reward:'溪石铺在花园小路上。'}
];
// v16.4: the map shows what has grown (beside the domain it grew from) plus at most two blind-box seeds.
export const MAP_LIMIT={locked:2,owned:5};
export function mapEntries(entries){const locked=entries.filter(e=>!e.owned).slice(0,MAP_LIMIT.locked),owned=entries.filter(e=>e.owned).slice(0,MAP_LIMIT.owned);return [...locked,...owned];}
export function visibleObstacle(point,padding=12){if(!point.owner)return footprint(point,padding);const r=point.size/2+padding;return {left:point.x-r,right:point.x+r,top:point.y-r,bottom:point.y+r};}
export function explorationEntries(model,progress){
 const domains=model.groups.filter(g=>g.kind==='domain'),recent=(progress.recent||[]).map(k=>model.records.get(k)).filter(Boolean);
 const known=new Set(explorationDefinitions.map(e=>e.familyId)),planted=catalogue.filter(item=>progress.unlocked.includes(item.id)&&!baseFamilies.includes(item.id)&&!known.has(item.id)).map(item=>({id:'planted-'+item.id,familyId:item.id,name:item.name,reward:'由你的收藏与编译种下，可以在图鉴中应用到知识节点。'}));
 return [...explorationDefinitions,...planted].map(e=>{
  const item=catalogueById.get(e.familyId),rule=ruleProgress(item,progress);let target=null;
  if(item.rule==='biggest'||item.rule==='bloom'||item.rule==='growing'){const sorted=[...domains].sort((a,b)=>(b.displayCount||0)-(a.displayCount||0));target=item.rule==='biggest'?sorted[0]:item.rule==='growing'?sorted.find(d=>(d.displayCount||0)<3)||sorted[0]:sorted.find(d=>(d.displayCount||0)<8)||sorted[0];}
  if(item.rule==='bridges'){const bridges=gardenInsights(model).bridges;if(bridges[0]){model.records.set(bridges[0].key,bridges[0]);target=bridges[0];}}
  if(item.rule==='collected'||item.rule==='compiled')target=model.groups.find(g=>g.kind==='pending')||null;
  {const home=progress.unlocked.includes(e.familyId)?(progress.origins||{})[e.familyId]:originOf(model,item.rule);if(home&&model.records.has(home)&&(item.rule!=='bridges'||progress.unlocked.includes(e.familyId)))target=model.records.get(home);}
  const owned=progress.unlocked.includes(e.familyId),stage=owned?'bloom':rule.value>0?'sprout':'seed';
  const entry={...e,description:rule.label,key:'explore:'+e.id,kind:'discovery',count:0,keywords:[],summary:rule.label,rule,owned,stage,stageLevel:{bloom:0,sprout:1,seed:2}[stage],ratio:Math.min(1,rule.value/(rule.target||1)),targetKey:target?.key};entry.guide=explorationGuide(entry);return entry;
 }).sort((a,b)=>Number(a.owned)-Number(b.owned)||b.ratio-a.ratio);
}

// Exploration pockets use existing empty world space. They never push content
// outward or participate in the knowledge graph's counts and relation edges.
export function addExplorationPockets(graph,entries=[],positions=new Map(),viewport=null){
 if(!entries.length||!graph.points.size)return graph;
 const original=[...graph.points.values()].filter(p=>!p.discovery),boxes=original.map(p=>footprint(p,10)),bounds=viewport||{left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))},occupied=[...original.map(p=>visibleObstacle(p)),...(graph.reserved||[])];
 for(const [i,record]of entries.entries()){
  const size=discoverySize(graph,record),candidates=[],cached=positions.get(record.key);
  if(cached)candidates.push({x:cached[0],y:cached[1],score:-1000});
  for(let y=0;y<19;y++)for(let x=0;x<17;x++){
   const px=bounds.left+90+(bounds.right-bounds.left-180)*x/16,py=bounds.top+62+(bounds.bottom-bounds.top-170)*y/18;
   const target=original.find(p=>p.key===record.targetKey),distance=target?Math.hypot(px-target.x,py-target.y):0;
   candidates.push({x:px,y:py,score:distance*.15+Math.hypot(px-((bounds.left+bounds.right)/2+Math.cos(plantingAngle(record.key))*(bounds.right-bounds.left-180)/2),py-((bounds.top+bounds.bottom)/2+Math.sin(plantingAngle(record.key))*(bounds.bottom-bounds.top-150)/2))});
  }
  if(!viewport)for(let ring=1;ring<=3;ring++)for(let step=0;step<28;step++){const a=plantingAngle(record.key)+step*Math.PI*2/28,cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2;candidates.push({x:cx+Math.cos(a)*((bounds.right-bounds.left)/2+ring*100),y:cy+Math.sin(a)*((bounds.bottom-bounds.top)/2+ring*90),score:300+ring*120+step*3});}
  for(const p of candidates.sort((a,b)=>a.score-b.score)){
   const point={...p,key:record.key,record,size,discovery:true,owned:record.owned,labelText:record.owned||!record.rule?record.name:'盲盒 · '+(record.guide?.progressText||record.rule.value+'/'+record.rule.target)},box=footprint(point,12);
   if(viewport&&(box.left<bounds.left||box.right>bounds.right||box.top<bounds.top||box.bottom>bounds.bottom)||occupied.some(b=>intersects(b,box)))continue;
   graph.points.set(record.key,point);occupied.push(box);break;
  }
 }
 return graph;
}
