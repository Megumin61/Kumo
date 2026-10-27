// v20 · 藤蔓：一条由粗渐细的实心曲线。父节点一端粗，子节点一端细，带一点点自然的弯。
export function vinePolygon(from,to,{w0=6,w1=1.6,bend=.14,seg=16,flip=1}={}){
 const dx=to[0]-from[0],dy=to[1]-from[1],d=Math.hypot(dx,dy)||1,nx=-dy/d*flip,ny=dx/d*flip,c=[(from[0]+to[0])/2+nx*d*bend,(from[1]+to[1])/2+ny*d*bend];
 const left=[],right=[];
 for(let i=0;i<=seg;i++){const t=i/seg,u=1-t,x=u*u*from[0]+2*u*t*c[0]+t*t*to[0],y=u*u*from[1]+2*u*t*c[1]+t*t*to[1],tx=2*u*(c[0]-from[0])+2*t*(to[0]-c[0]),ty=2*u*(c[1]-from[1])+2*t*(to[1]-c[1]),tl=Math.hypot(tx,ty)||1,w=(w0+(w1-w0)*Math.pow(t,.8))/2,px=-ty/tl*w,py=tx/tl*w;left.push([x+px,y+py]);right.push([x-px,y-py]);}
 const pts=[...left,...right.reverse()];return 'M '+pts.map(p=>p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' L ')+' Z';
}

// Matched leaf pairs share one stem joint and mirror across the tangent.
export function vineLeaves(from,to,{bend=.14,flip=1,scale=1,count=2,maxSize=18}={}){
 const dx=to[0]-from[0],dy=to[1]-from[1],d=Math.hypot(dx,dy)||1,c=[(from[0]+to[0])/2-dy*flip*bend,(from[1]+to[1])/2+dx*flip*bend],pairs=Math.max(0,Math.min(2,Math.floor(count/2))),size=Math.min(maxSize,5+d*scale/20);let out='';
 for(let i=0;i<pairs;i++){const t=(i+1)/(pairs+1),u=1-t,x=u*u*from[0]+2*u*t*c[0]+t*t*to[0],y=u*u*from[1]+2*u*t*c[1]+t*t*to[1],tx=2*u*(c[0]-from[0])+2*t*(to[0]-c[0]),ty=2*u*(c[1]-from[1])+2*t*(to[1]-c[1]),len=Math.hypot(tx,ty)||1,ca=tx/len,sa=ty/len;
  const P=(f,n)=>[(x+(f*ca-n*sa)*size/15).toFixed(1),(y+(f*sa+n*ca)*size/15).toFixed(1)];
  for(const side of [-1,1]){const base=P(0,0);out+='M '+base+' C '+P(3,side*6)+' '+P(9,side*14)+' '+P(15,side*12)+' C '+P(14,side*3)+' '+P(6,side)+' '+base+' Z ';}
 }return out;
}
