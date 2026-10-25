import {regionExpression} from './appearance-remix.mjs';
// The cellular concept uses quiet translucent colour and a fine frosted contour.
const HUES=['#85ad92','#aeba77','#b7ac7b','#88b0a4','#c5bc79','#92ad79','#a9bea8','#bdc18e'];
export function glassify(svg,plot,{index=0,color=null,expression}={}){
 const ink=color||HUES[index%HUES.length],view=expression||regionExpression().id;
 for(const el of plot.querySelectorAll('.garden-patch,.garden-patch-extension')){const ext=el.classList.contains('garden-patch-extension');
  el.style.setProperty('fill',ink,'important');el.style.setProperty('fill-opacity',String(view==='veins'||ext?0:.073+(index%3)*.008),'important');
  el.style.setProperty('stroke',ink,'important');el.style.setProperty('stroke-opacity',String(ext||view==='veins'?0:.68),'important');el.style.setProperty('stroke-width',ext?'0':'1.2','important');el.style.setProperty('stroke-dasharray',view==='dashed'?'5 3 1 3':'none','important');el.style.setProperty('vector-effect','non-scaling-stroke','important');}
 plot.style.filter='none';
}
