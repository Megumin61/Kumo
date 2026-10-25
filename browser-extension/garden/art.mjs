import {atlasMetadata} from './atlas-metadata.mjs';
import {readSelection,sourceForElement,readTexture} from './element-library.mjs';
import {referenceAtlas} from './reference-atlas.mjs';
import {nodeAtlases} from './node-atlases.mjs';
import {prototypeAtlases,prototypeStyles,prototypeFamilies} from './prototype-atlases.mjs';
import {referenceGeometry} from './reference-geometry.mjs';
import {referenceSupplements,supplementFamilies} from './reference-supplements.mjs';
import {pathTo} from './schema.mjs';
import {isGardenStyle,gardenStyleArt} from './garden-styles.mjs';
export {prototypeStyles};
export const schemes={paper:{name:'纸本林野',atlas:'woodland-hierarchy-v2',names:['松树','花盘','篝火','蘑菇','橡果','叶片']},collage:{name:'纸本拾光',atlas:'collage-hierarchy-v2',names:['松树','花盘','篝火','蘑菇','橡果','叶片']},botanicals:{name:'纸本花草 · 原版',atlas:'paper',names:['花盘','三叶草','银杏','阔叶','蕨芽','铃花']},stones:{name:'河石节点',names:['青苔卵石','青瓷扁石','暖砂三角石','缺口白石','浅苔梯石','赤陶心石']},trails:{name:'林间拾趣 · 原版',names:['森林','背包','篝火','蘑菇','橡果','贝壳']}};
export const specimenNames=(scheme,index)=>[schemes[scheme]?.names[index%6]||'花盘','层级形态'];
const families={'product-experience':0,'interface-design':0,'consumer-products':1,'ai-creation-tools':3,'agent-tooling':3,'ai-animation':2,'ai-game-prototyping':5,'career-context':4,'career-development':4,'industry-observations':5};
export function specimenFor(model,record){const root=familyRoot(model,record);return families[root.replace('domain:','')]??0;}
export const artLevel=(record,view)=>record.kind==='source'?2:view==='field'&&['domain','pending','unassigned'].includes(record.kind)?0:record.kind==='topic'||record.parentDomainId?1:0;
export function spriteCrop(atlas,index){const [left,top,right,bottom]=atlas.bounds[index],previous=atlas.bounds[index-3],next=atlas.bounds[index+3];let upper=Math.max(0,top-3),lower=Math.min(atlas.height,bottom+3);if(previous&&previous[3]+3>upper)upper=Math.max(upper,Math.ceil((previous[3]+top)/2)+2);if(next&&next[1]-3<lower)lower=Math.min(lower,Math.floor((bottom+next[1])/2)-2);return [Math.max(0,left-3),upper,Math.min(atlas.width,right+3),lower];}
export function artFrame(scheme,index,level=0){const theme=schemes[scheme]?scheme:'paper',atlas=atlasMetadata[theme],actualLevel=Math.max(0,Math.min(2,Number(level))),slot=(index%6)*3+actualLevel,frame=atlas.frames[slot];return {href:'assets/'+(schemes[theme].atlas||theme)+'-atlas.png',frame,crop:spriteCrop(atlas,slot),width:atlas.width,height:atlas.height,index:index%6,level:actualLevel,child:actualLevel>0};}
export function artStyle(art,size){const [left,top,extent]=art.frame,scale=size/extent,[x,y,right,bottom]=art.crop,insets=[y-top,left+extent-right,top+extent-bottom,x-left].map(value=>Math.max(0,value)*scale+'px');return 'display:block;width:'+size+'px;height:'+size+'px;background-image:url("'+art.href+'");background-repeat:no-repeat;background-size:'+art.width*scale+'px '+art.height*scale+'px;background-position:'+(-left*scale)+'px '+(-top*scale)+'px;clip-path:inset('+insets.join(' ')+');pointer-events:none;'+(art.mask?'mask-image:url("'+art.mask+'");mask-size:100% 100%;mask-repeat:no-repeat;':'');}
export function elementArt(id,level=0,texture='paper'){
 if(isGardenStyle(texture))return gardenStyleArt(id,level,texture);
 if(prototypeStyles[texture])return prototypeArt(id,level,texture);
 const source=sourceForElement(id,level,texture);if(!source)return null;
 if(source.atlas){const atlas=nodeAtlases[source.atlas],slot=source.index*3+source.level;return {href:'assets/'+source.atlas+'-atlas.png',frame:atlas.frames[slot],crop:spriteCrop(atlas,slot),width:atlas.width,height:atlas.height,index:source.index,level:source.level,child:source.level>0};}
 if(source.reference){const frame=referenceAtlas.frames[source.index*2+source.level],[x,y,w,h]=frame;return {href:'assets/garden-specimens-reference.png',frame,crop:[x,y,x+w,y+h],width:referenceAtlas.width,height:referenceAtlas.height,index:source.index,level:source.level,child:source.level>0};}
 return artFrame(source.theme,source.index,source.level);
}
export function recordArt(model,record,scheme,view){
 if(isGardenStyle(scheme))return gardenStyleArt(recordElementId(model,record),artLevel(record,view),scheme);
 if(prototypeStyles[scheme])return prototypeArt(recordElementId(model,record),artLevel(record,view),scheme);
 if(scheme==='garden')return elementArt(recordElementId(model,record),artLevel(record,view),readTexture());
 const row=specimenFor(model,record),level=artLevel(record,view);if(['paper','collage'].includes(scheme)&&[3,4].includes(row))return elementArt(row===3?'F02':'F03',level,scheme);return artFrame(scheme,row,level);
}
export function familyRoot(model,record){const key=record.kind==='source'?record.primary:record.key;return pathTo(model,key)[0]||key;}
export function recordElementId(model,record){const chosen=readSelection(),root=familyRoot(model,record),known={'domain:product-experience':0,'domain:ai-creation-tools':1,'domain:career-context':2,pending:3,unassigned:4},fallback=[...model.records.values()].filter(r=>r.kind==='domain'&&!r.parentDomainId).map(r=>r.key).sort(),index=known[root]??Math.max(0,fallback.indexOf(root));return chosen[index%chosen.length];}
export function prototypeArt(id,level=0,theme='paperlight'){
 const family=prototypeFamilies.indexOf(id);if(family<0)throw Error('Unknown node family: '+id);const actualLevel=Math.max(0,Math.min(2,Number(level))),master=referenceGeometry[theme],original=master.forms[id]?.[actualLevel];
 if(original)return {...original,href:master.href,width:master.width,height:master.height,index:family,level:actualLevel,child:actualLevel>0,style:theme};
 const local=supplementFamilies.indexOf(id),atlas=referenceSupplements[theme],slot=local*2+actualLevel-1;if(local<0||actualLevel===0)throw Error('Missing reference form: '+theme+'/'+id+'/'+level);
 const [left,top,right,bottom]=atlas.bounds[slot];
 return {href:'assets/reference-locked-v6/'+theme+'-supplement.png',frame:atlas.frames[slot],crop:[Math.max(0,left-2),Math.max(0,top-2),Math.min(atlas.width,right+2),Math.min(atlas.height,bottom+2)],width:atlas.width,height:atlas.height,index:family,level:actualLevel,child:actualLevel>0,style:theme,source:'reference-supplement'};
}
const prepared=new Map();
export function prepareSymbols(scheme){const theme=schemes[scheme]?scheme:'paper';if(!prepared.has(theme))prepared.set(theme,new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const atlas=atlasMetadata[theme];resolve(atlas.frames.map(([x,y,w,h],index)=>{const canvas=document.createElement('canvas');canvas.width=192;canvas.height=192;const [left,top,right,bottom]=spriteCrop(atlas,index),scale=192/w;canvas.getContext('2d').drawImage(image,left,top,right-left,bottom-top,(left-x)*scale,(top-y)*scale,(right-left)*scale,(bottom-top)*scale);return 'image://'+canvas.toDataURL('image/png');}));};image.onerror=()=>{prepared.delete(theme);reject(Error('节点素材读取失败'));};image.src='assets/'+(schemes[theme].atlas||theme)+'-atlas.png';}));return prepared.get(theme);}
