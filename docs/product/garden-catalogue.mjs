import {elements} from './element-library.mjs';
import {elementArt} from './art.mjs';
import {landmarkAtlas} from './landmark-atlas.mjs';
import {cleanFireForms} from './catalogue-clean-frames.mjs';
import {isGardenStyle,gardenStyleArt} from './garden-styles.mjs';
export const baseFamilies=['P01','P02','P03','P04','P07','P10','F02','F03'];
const names={P01:'向日花',P02:'三叶草',P03:'银杏叶',P04:'青叶',P06:'风铃草',P10:'蕨叶',F01:'松树',F02:'蘑菇',F03:'橡果',F05:'篝火'};
const specials=[{id:'X01',name:'栀子花',purpose:'开在最新长出的领域旁',rule:'domains',target:8,special:true},{id:'X02',name:'木桥',purpose:'回到相互联系的两个领域',rule:'bridges',target:2,special:true},{id:'X03',name:'书签叶',purpose:'夹在编译好的收藏里',rule:'compiled',target:40,special:true}];
// v16.3: unlocks follow only what the user clips (收藏) and compiles (编译).
const conditions={P05:['collected',20],P06:['domains',5],P08:['compiled',20],P09:['bridges',1],P11:['growing',3],F01:['biggest',10],F04:['collected',50],F05:['compiled',30],F06:['domains',8],G01:['collected',80],G02:['topics',4],G03:['collected',60],G04:['bloom',2],G05:['bridges',3],G06:['domains',10],G07:['biggest',20],G08:['collected',120],G09:['bloom',3],G10:['bridges',5],G11:['compiled',100],G12:['topics',6],G13:['collected',200],G14:['domains',12],G15:['bridges',8],G16:['bloom',5]};
let statsProvider=()=>({});export function setStatsProvider(fn){statsProvider=fn;}
export const catalogue=[...elements.map(e=>({...e,name:names[e.id]||e.name,purpose:e.id==='F05'?'回到收下的主题小结':'为知识领域与子主题选择统一形态',special:e.id==='F05',rule:baseFamilies.includes(e.id)?'base':conditions[e.id][0],target:baseFamilies.includes(e.id)?0:conditions[e.id][1]})),...specials];
export const catalogueById=new Map(catalogue.map(e=>[e.id,e]));
export const progressKey='kumo:garden:collection-progress:v12';
export function emptyProgress(){return {visited:[],links:[],notes:{},sourceVisits:{},assignments:{},nodeAssignments:{},summaries:[],pinned:[],recent:[],unlocked:[...baseFamilies],origins:{},seen:[...baseFamilies]};}
export function normalizeProgress(raw){
 const p=emptyProgress();if(!raw||typeof raw!=='object')return p;
 const strings=value=>[...new Set(Array.isArray(value)?value.filter(k=>typeof k==='string'):[])];
 p.visited=strings(raw.visited);p.links=strings(raw.links);
 p.notes=raw.notes&&typeof raw.notes==='object'&&!Array.isArray(raw.notes)?Object.fromEntries(Object.entries(raw.notes).filter(([,v])=>typeof v==='string'&&v.trim())):{};
 p.sourceVisits=raw.sourceVisits&&typeof raw.sourceVisits==='object'?Object.fromEntries(Object.entries(raw.sourceVisits).filter(([k,v])=>k.startsWith('source:')&&Number.isFinite(v)&&v>0)):{};
 p.assignments=raw.assignments&&typeof raw.assignments==='object'?Object.fromEntries(Object.entries(raw.assignments).filter(([k,v])=>k.startsWith('domain:')&&catalogueById.has(v))):{};
 p.nodeAssignments=raw.nodeAssignments&&typeof raw.nodeAssignments==='object'?Object.fromEntries(Object.entries(raw.nodeAssignments).filter(([k,v])=>(/^(domain|topic|source):/.test(k)||['pending','unassigned'].includes(k))&&catalogueById.has(v))):{};
 p.summaries=strings(raw.summaries).filter(k=>/^(domain|topic):/.test(k));p.pinned=strings(raw.pinned).filter(k=>/^(domain|topic|source):/.test(k));p.recent=strings(raw.recent).filter(k=>/^(domain|topic|source):/.test(k)).slice(0,8);
 p.unlocked=[...new Set([...baseFamilies,...strings(raw.unlocked)].filter(id=>catalogueById.has(id)))];
 p.origins=raw.origins&&typeof raw.origins==='object'?Object.fromEntries(Object.entries(raw.origins).filter(([k,v])=>catalogueById.has(k)&&typeof v==='string')):{};p.seen=Array.isArray(raw.seen)?[...new Set([...baseFamilies,...strings(raw.seen)])]:[...p.unlocked];return p;
}
export function ruleProgress(item,p){const st=statsProvider()||{},values={base:1,visit:p.visited.length,link:p.links.length,summary:(p.summaries||[]).length,pin:(p.pinned||[]).length,read:Object.keys(p.sourceVisits).length,revisit:Object.values(p.sourceVisits).filter(v=>v>=2).length,collected:st.collected||0,compiled:st.compiled||0,domains:st.domains||0,biggest:st.biggest||0,growing:st.growing||0,bloom:st.bloom||0,bridges:st.bridges||0,topics:st.topics||0},value=values[item.rule]||0,t=item.target,labels={base:'基础植物，一开始就有',visit:`探索 ${t} 个领域`,link:`保存 ${t} 条已有联系`,summary:`收下 ${t} 份主题小结`,pin:`常看 ${t} 个知识节点`,read:`打开 ${t} 篇收藏`,revisit:`回访 ${t} 篇读过的收藏`,collected:`一共收藏 ${t} 篇`,compiled:`编译好 ${t} 篇收藏`,domains:`长出 ${t} 个领域`,biggest:`有一个领域收藏到 ${t} 篇`,growing:`${t} 个领域收藏到 3 篇以上`,bloom:`${t} 个领域收藏到 8 篇以上（盛开）`,bridges:`编译出 ${t} 组跨领域联系`,topics:`有一个领域分出 ${t} 个主题`};return {value:Math.min(value,t||1),target:t||1,met:item.rule==='base'||value>=t,label:labels[item.rule]};}
export function reconcileProgress(progress){const p=normalizeProgress(progress),fresh=[];for(const item of catalogue)if(!p.unlocked.includes(item.id)&&ruleProgress(item,p).met){p.unlocked.push(item.id);fresh.push(item.id);}return {progress:p,fresh};}
export function catalogueArt(id,theme='paperlight',level=0){if(isGardenStyle(theme))return gardenStyleArt(id,level,theme);if(id==='F05'&&cleanFireForms[theme])return cleanFireForms[theme][Math.max(0,Math.min(2,level))];if(!landmarkAtlas.forms[id])return elementArt(id,level,theme);const a=landmarkAtlas.forms[id][theme]||landmarkAtlas.forms[id].paperlight;return {...a,href:landmarkAtlas.href,width:landmarkAtlas.width,height:landmarkAtlas.height,index:33+['X01','X02','X03'].indexOf(id),level,child:level>0};}
export const defaultDomainFamilies={'domain:interface-design':'P01','domain:agent-tooling':'P02','domain:ai-animation':'P03','domain:career-development':'F03','domain:consumer-products':'P07','domain:ai-game-prototyping':'P10','domain:industry-observations':'F03',pending:'P04',unassigned:'P04','domain:product-experience':'P01','domain:ai-creation-tools':'P02','domain:career-context':'F03'};
