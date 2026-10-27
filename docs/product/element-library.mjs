export const selectionKey='kumo:garden:chosen-elements:v1';
export const textureKey='kumo:garden:forest-texture:v1';
export const draftKey='kumo:garden:element-draft:v1';
const paperNames=['花盘','三叶草','银杏','阔叶','蕨芽','铃花'];
const paperNotes=['复层花盘 → 单层花盘 → 简单花形','三叶 → 两叶 → 一叶','单片扇形叶','单片阔叶，保留浅色叶心','枝叶较多，保留作参考','单朵垂钟花苞'];
const forest=[['单棵松树',0,'多层树冠 → 双层树冠 → 简单树冠'],['单朵蘑菇',3,'菌褶与厚菌盖 → 简化菌盖 → 菌盖与柄'],['单颗橡果',4,'帽纹与果身切面 → 少量帽纹 → 帽与果身'],['单片叶子',5,'叶缘与侧脉 → 平滑叶片 → 叶形轮廓'],['篝火',2,'火焰与交叉木柴 → 火焰与单根木柴 → 单簇火焰'],['层瓣野花',1,'复层花瓣 → 单层花瓣 → 简单花形']];
const reference=[['野花','带萼五瓣 → 无萼五瓣 → 三瓣'],['花器','三叶花器 → 单叶花器 → 空花器'],['溪石','凹口石 → 三角石 → 卵石'],['银杏','五裂扇叶 → 三裂扇叶 → 单扇叶'],['蝶翼','四翼 → 双翼 → 单翼'],['风铃花','三瓣开铃 → 双瓣窄铃 → 闭合花苞'],['浮叶','缺口圆叶 → 半折叶 → 叶片切瓣'],['小瓶','双叶耳 → 单叶耳 → 无耳小瓶'],['苜蓿','四叶 → 两叶 → 一叶'],['晶石','六角晶石 → 菱形 → 三角晶片'],['蜗牛','蜗牛 → 螺壳 → 卷壳'],['蒴果','三尖开荚 → 双尖果杯 → 闭合种子'],['叠石','三石 → 两石 → 单石'],['海葵花','八瓣 → 五瓣 → 三瓣'],['小甲虫','展翅 → 合翅 → 单片叶翅'],['多肉','多圈莲座 → 五叶莲座 → 三叶芽']];
const extraFlowers=[['波斯菊','八瓣 → 五瓣 → 三瓣'],['郁金香','开杯三尖 → 窄杯双尖 → 闭合花苞'],['蒲公英','圆形绒球 → 半扇绒球 → 三叉种伞'],['羽蕨','五对羽叶 → 两对羽叶 → 单片叶'],['圆叶枝','三对圆叶 → 两叶 → 一叶']];
export const elementGroups=[{id:'paper',name:'花草主系列',description:'保留花盘，新增五类花草；三叶草改为三叶、两叶、一叶。'},{id:'forest',name:'林间补充 · 三级形态',description:'篝火与松树保留；蘑菇按生长形态变化，橡果按果实与种子变化。'},{id:'reference',name:'花园标本 · 纸本统一版',description:'16类标本统一为轻水彩纸本质感，每类均有三级结构映射。'}];
export const elements=[...paperNames.map((name,index)=>({id:'P'+String(index+1).padStart(2,'0'),name,group:'paper',theme:'botanicals',index,note:paperNotes[index],complex:index===4,...(index===1?{atlas:'botanical-v3',index:0}:{} )})),...extraFlowers.map(([name,note],index)=>({id:'P'+String(index+7).padStart(2,'0'),name,group:'paper',atlas:'botanical-v3',index:index+1,note})),...forest.map(([name,index,note],i)=>({id:'F'+String(i+1).padStart(2,'0'),name,group:'forest',theme:'paper',index,note,...(i===1?{atlas:'specimens-c-v3',index:4,note:'平展伞盖长柄 → 圆盖短柄 → 无柄菌球'}:i===2?{atlas:'specimens-c-v3',index:5,note:'带帽长果 → 无帽椭圆果仁 → 圆种子'}:{})})),...reference.map(([name,note],index)=>({id:'G'+String(index+1).padStart(2,'0'),name,group:'reference',atlas:['specimens-a-v3','specimens-b-v3','specimens-c-v3'][Math.floor(index/6)],index:index%6,note}))];
export const defaultElements=['P01','P02','P03','P04','P06','F01','F02','F03'];
export const byElementId=new Map(elements.map(e=>[e.id,e]));
export function sanitizeSelection(value){return Array.isArray(value)?[...new Set(value.filter(id=>byElementId.has(id)))]:[];}
export function readSelection(storage=typeof localStorage==='undefined'?null:localStorage){try{const raw=storage?.getItem(selectionKey);if(raw!==null&&raw!==undefined){const ids=sanitizeSelection(JSON.parse(raw));if(ids.length)return ids;}}catch{}return [...defaultElements];}
export function sourceForElement(id,level=0,texture='paper'){
 const item=byElementId.get(id);if(!item)return null;
 if(item.atlas)return {atlas:item.atlas,index:item.index,level:Math.max(0,Math.min(2,Number(level)))};
 return {theme:item.group==='forest'?texture:item.theme,index:item.index,level:item.level??level};
}

export function readTexture(storage=typeof localStorage==='undefined'?null:localStorage){try{const value=storage?.getItem(textureKey);return ['collage','paperlight','gardenprint','pencilpaper'].includes(value)?value:'paper';}catch{return 'paper';}}
