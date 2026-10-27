import {paperSurface} from './paper-surfaces.mjs';
import {atmosphereFor} from './style-atmosphere.mjs';
import {borderProfiles} from './colony-borders.mjs';
import {styleAtlases} from './garden-style-atlases.mjs';
export const gardenStyles={
  "autumn-ink": {
    "name": "秋日墨线手记",
    "description": "略抖的深褐黑墨线、扁平赭红芥黄深蓝填色、少量排线；轮廓有叙事感",
    "mood": "安静、旧书、秋日采集",
    "paper": "assets/garden-styles-v1/autumn-ink/paper.png",
    "palette": [
      "#f5f0e4",
      "#7e291e",
      "#d1b765",
      "#24354a"
    ]
  },
  "green-crayon": {
    "name": "绿调蜡笔文具",
    "description": "蜡笔干涂露纸、软而碎的边缘，绿色为主、薰衣草紫和陶粉点睛；几乎无外描边",
    "mood": "亲切、日常、桌边文具店",
    "paper": "assets/garden-styles-v1/green-crayon/paper-v2.png",
    "palette": [
      "#f0ead9",
      "#69aa70",
      "#8c79c7",
      "#ce9280"
    ]
  },
  "daily-doodle": {
    "name": "奶油日常涂鸦",
    "description": "圆钝简形、不规则色块、稀疏灰褐点线，轻微偏移的手画线，奶黄灰蓝薰衣草",
    "mood": "轻松、俏皮、没有压力",
    "paper": "assets/garden-styles-v1/daily-doodle/paper-v2.png",
    "palette": [
      "#f6efdf",
      "#f2d984",
      "#96b8be",
      "#acb7df"
    ]
  },
  "woodland-seal": {
    "name": "森林奶油印章",
    "description": "无黑描边的极简平涂小物，略不圆的柔和圆章背衬，赭黄苔绿奶白",
    "mood": "温柔、收藏册、稳定而治愈",
    "paper": "assets/garden-styles-v1/woodland-seal/paper.png",
    "palette": [
      "#fffcf4",
      "#ece7b9",
      "#a6ab70",
      "#c68e40"
    ]
  },
  "vintage-ink": {
    "name": "复古杂货墨线",
    "description": "细而不匀的黑墨轮廓、低饱和暖色、水粉薄涂留纸，线条带小缺口；旧文具贴纸感",
    "mood": "怀旧、有趣、旧书店杂货架",
    "paper": "assets/garden-styles-v1/vintage-ink/paper.png",
    "palette": [
      "#efe8d6",
      "#e2b94b",
      "#8ea480",
      "#cc9290"
    ]
  },
  "field-guide": {
    "name": "户外图解手帐",
    "description": "中等粗黑手绘轮廓、简化几何、少量内部结构线、军绿土黄铁锈红；实用图解感",
    "mood": "探索、行动、随身旅行手册",
    "paper": "assets/garden-styles-v1/field-guide/paper.png",
    "palette": [
      "#fffefa",
      "#84927c",
      "#c3aa83",
      "#d66a62"
    ]
  },
  "camping-pop": {
    "name": "露营漫画贴纸",
    "description": "粗黑圆角描边、高饱和黄橙森林绿海军蓝、厚实轮廓、小表情、轮廓外少量白边",
    "mood": "活泼、友好、第一眼有记忆点",
    "paper": "assets/garden-styles-v1/camping-pop/paper.png",
    "palette": [
      "#fffefa",
      "#f4b720",
      "#2c8050",
      "#2a5871"
    ]
  },
  "colored-scribble": {
    "name": "彩铅奇想手记",
    "description": "红棕、青蓝、金黄彩铅多色轮廓，疏松排线、套色轻错位、空隙露纸，奇趣但清楚",
    "mood": "想象力、童趣、私人收藏笔记",
    "paper": "assets/garden-styles-v1/colored-scribble/paper.png",
    "palette": [
      "#f4f2df",
      "#b6572f",
      "#419ba5",
      "#e5bd3f"
    ]
  }
};
export const legacyGardenStyles={
 paperlight:{name:'纸光花园',description:'经典水彩植物与柔和纸纹',mood:'经典 · 柔和、自然、水彩',paper:'assets/garden-styles-v1/green-crayon/paper-v2.png',palette:['#f3eddf','#a8b88c','#baaa77','#a9bcc2']},
 gardenprint:{name:'套色花园',description:'经典套色印刷植物',mood:'经典 · 套色、清晰、纸本',paper:'assets/garden-styles-v1/autumn-ink/paper.png',palette:['#f5f0e4','#a4b3a2','#c8ae6f','#c5a295']},
 pencilpaper:{name:'彩铅纸贴',description:'经典彩铅纸贴植物',mood:'经典 · 彩铅、轻盈、手作',paper:'assets/garden-styles-v1/colored-scribble/paper.png',palette:['#f4f2df','#a8b184','#bb9c77','#9fbbb4']}
};
export const availableGardenStyles={...legacyGardenStyles,...gardenStyles};
export const colonyStyleProfiles=Object.fromEntries(Object.entries(borderProfiles).map(([key,p])=>[key,[p.fill,p.halo,p.stroke,p.width]]));
export function colonyColorFor(theme,id){const style=availableGardenStyles[normalizeGardenStyle(theme)];let hash=2166136261;for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;const ink=style.palette[1+hash%3],paper=style.palette[0],mix=.14+((hash>>>4)%4)*.045;const rgb=[1,3,5].map(i=>Math.round(parseInt(ink.slice(i,i+2),16)*(1-mix)+parseInt(paper.slice(i,i+2),16)*mix));return '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');}
export const DEFAULT_GARDEN_STYLE='green-crayon';
const aliases={garden:'green-crayon',paper:'autumn-ink',collage:'vintage-ink','spring-gouache':'green-crayon'};
export const isGardenStyle=value=>Object.hasOwn(gardenStyles,value);
export function normalizeGardenStyle(value){return Object.hasOwn(availableGardenStyles,value)?value:aliases[value]||DEFAULT_GARDEN_STYLE;}
export function gardenStyleArt(id,level=0,theme=DEFAULT_GARDEN_STYLE){const key=normalizeGardenStyle(theme),actual=Math.max(0,Math.min(2,Math.trunc(Number(level)||0))),art=styleAtlases[key]?.[id]?.[actual];if(!art)throw Error('Missing garden node: '+key+'/'+id+'/'+actual);return {...art,style:key,level:actual,child:actual>0};}
export function applyGardenStyle(theme,body=typeof document==='undefined'?null:document.body){const key=normalizeGardenStyle(theme),style=availableGardenStyles[key];if(body){body.dataset.scheme=key;body.dataset.gardenStyle=key;delete body.dataset.bg;const surface=paperSurface(key,style);body.style.setProperty('--style-paper-image',surface.image);body.style.setProperty('--style-paper',surface.color);body.style.setProperty('--style-paper-size',surface.size);body.style.setProperty('--style-paper-repeat',surface.repeat);body.style.setProperty('--style-accent',style.palette[2]);body.style.setProperty('--style-ink','#694b36');const atmosphere=atmosphereFor(key);body.style.setProperty('--garden-font',atmosphere.font);body.style.setProperty('--garden-heading-font',atmosphere.heading);body.dataset.habitat=atmosphere.edge;const heading=typeof document==='undefined'?null:document.querySelector('.preview-heading p');if(heading)heading.textContent=atmosphere.note||style.mood;const profile=colonyStyleProfiles[key];for(const [i,name]of ['fill','halo','stroke','width'].entries())body.style.setProperty('--colony-'+name,String(profile[i]));for(const [index,family]of ['product','tools','career','neutral'].entries()){const color=style.palette[1+index%3];body.style.setProperty('--fam-'+family,color);body.style.setProperty('--fam-'+family+'-ink',color);}}return key;}
export function populateStyleOptions(select){if(!select)return;select.replaceChildren(...Object.entries(availableGardenStyles).map(([key,style])=>{const option=document.createElement('option');option.value=key;option.textContent=style.name;return option;}));}

