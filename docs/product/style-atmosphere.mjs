import {propAtlases} from './garden-prop-atlases.mjs';
const serif='"KaiTi","STKaiti","楷体","Georgia",serif',round='"YouYuan","幼圆","Trebuchet MS","Microsoft YaHei",sans-serif';
export const styleAtmospheres={
 'autumn-ink':{font:serif,heading:serif,edge:'pressed-leaf',props:['枫叶与钢笔','植物手记','搪瓷茶杯','采集信封'],note:'赭红、芥黄、藏蓝 · 旧手记与压叶'},
 'green-crayon':{font:serif,heading:serif,edge:'crayon-meadow',props:['线圈本','绿台灯','花信封','格纹布袋'],note:'草绿、陶粉、丁香紫 · 蜡笔文具桌'},
 'daily-doodle':{font:round,heading:round,edge:'soft-patch',props:['咖啡杯','小餐具','翻开的书','电影票'],note:'奶黄、灰蓝、浅紫 · 松弛的日常小物'},
 'woodland-seal':{font:round,heading:round,edge:'moss-stamp',props:['橡果与叶','远山小太阳','奶白小花','白鸟'],note:'燕麦、苔绿、赭黄 · 无描边的小圆章'},
 'vintage-ink':{font:serif,heading:serif,edge:'botanical-ink',props:['蝴蝶结','樱桃饮品','柠檬邮票','小白鹅'],note:'旧米纸、灰绿、褪粉 · 细墨线杂货'},
 'field-guide':{font:serif,heading:'"Comic Sans MS",'+serif,edge:'trail-map',props:['登山包','折叠地图','手电筒','相机'],note:'军绿、沙色、锈红 · 随身旅行图解'},
 'camping-pop':{font:round,heading:'"Arial Rounded MT Bold",'+round,edge:'camp-clearing',props:['帐篷','营灯','折叠椅','路牌'],note:'金黄、森林绿、海军蓝 · 厚墨线露营物件'},
 'colored-scribble':{font:serif,heading:serif,edge:'pencil-garden',props:['花边灯','条纹烤面包机','转盘电话','小动物蜡烛'],note:'朱褐、青蓝、金黄 · 留白的彩铅涂写'}
};
export function atmosphereFor(theme){return styleAtmospheres[theme]||{font:serif,heading:serif,edge:'classic',props:[],note:''};}
export function propArt(theme,index=0){const art=propAtlases[theme]?.[index%4];return art?{...art,label:styleAtmospheres[theme].props[index%4]}:null;}
