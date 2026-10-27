import {hashSeed} from './garden-life.mjs';
// A gently bowed shoot, with an asymmetric tangent and leaves resting on the curve.
export function rootStemGeometry(core,hub){
 const dx=hub.x-core.x,dy=hub.y-core.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d,nx=-uy,ny=ux,seed=hashSeed(hub.key||hub.x+':'+hub.y),start=Math.min(130,d*.18),from=[core.x+ux*start,core.y+uy*start],to=[hub.x,hub.y],reach=d-start;
 const bow=Math.min(100+seed*35,reach*(.135+seed*.045)),lead=.27+seed*.07,arrival=.30+(1-seed)*.1,c1=[from[0]+ux*reach*lead+nx*bow,from[1]+uy*reach*lead+ny*bow],c2=[to[0]-ux*reach*arrival+nx*bow*(.38+seed*.2),to[1]-uy*reach*arrival+ny*bow*(.38+seed*.2)];
 const t=.28+seed*.09,u=1-t,x=u**3*from[0]+3*u*u*t*c1[0]+3*u*t*t*c2[0]+t**3*to[0],y=u**3*from[1]+3*u*u*t*c1[1]+3*u*t*t*c2[1]+t**3*to[1],tx=3*u*u*(c1[0]-from[0])+6*u*t*(c2[0]-c1[0])+3*t*t*(to[0]-c2[0]),ty=3*u*u*(c1[1]-from[1])+6*u*t*(c2[1]-c1[1])+3*t*t*(to[1]-c2[1]),angle=Math.atan2(ty,tx),p=(f,n)=>[(x+f*Math.cos(angle)-n*Math.sin(angle)).toFixed(2),(y+f*Math.sin(angle)+n*Math.cos(angle)).toFixed(2)].join(' ');
 let leaves='';for(const side of [-1,1])leaves+='M '+p(0,0)+' C '+p(3,side*6)+' '+p(9,side*13)+' '+p(15,side*10)+' C '+p(13,side*3)+' '+p(4,side)+' '+p(0,0)+' Z ';
 return {from,to,c1,c2,d:'M '+from.join(' ')+' C '+c1.join(' ')+' '+c2.join(' ')+' '+to.join(' '),leaves};
}
