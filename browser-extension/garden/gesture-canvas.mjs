import {scaleDetail} from './scale-detail.mjs';
// Keep the accessible SVG at rest. During a camera gesture, draw the bounded
// scene on one canvas so the browser need not repaint hundreds of SVG layers.
export function createGestureCanvas(host){
 const canvas=document.createElement('canvas');canvas.className='garden-gesture-canvas';canvas.setAttribute('aria-hidden','true');canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:none;z-index:1';host.append(canvas);
 const ctx=canvas.getContext('2d'),images=new Map();let scene=null;
 const picture=href=>{if(!href)return null;if(!images.has(href)){const img=new Image();img.decoding='async';img.src=href;images.set(href,img);img.decode().then(()=>createImageBitmap(img)).then(bitmap=>{if(images.get(href)===img)img.bitmap=bitmap;else bitmap.close();}).catch(()=>{});}return images.get(href);};
 function capture({svg,layout,model,nodeArt,states,labels,width,height,selected}){
  const paths=[];
  for(const el of svg.querySelectorAll('.garden-beds .garden-patch,.garden-edges .garden-edge,.garden-edges .vine-leaves,.core-trunk,.core-root,.core-root-leaves')){
   const d=el.getAttribute('d');if(!d||el.closest('[data-topic-patch]'))continue;const plot=el.closest('[data-patch]'),hub=plot&&layout.points.get(plot.dataset.patch),edge=el.closest('[data-edge]');
   paths.push({path:new Path2D(d),hub:hub?.key,edge:edge?.dataset.edge,fill:el.matches('.vine-leaves,.garden-edge.vine,.core-root-leaves'),outline:!!hub});
  }
  const logo=svg.querySelector('.centre-emblem image')?.getAttribute('href');picture(logo);
  for(const art of nodeArt.values()){picture(art.href);if(art.mask)picture(art.mask);}
  scene={paths,layout,model,nodeArt,states,labels,width,height,logo,selected};
  const ratio=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
 }
 function paint({zoom,pan}){
  if(!ctx||!scene)return false;const {layout,nodeArt,states,labels,width,height,paths,logo,selected}=scene,ratio=canvas.width/width;
  const detail=scaleDetail(layout.points,zoom,selected);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.save();ctx.translate(...pan);ctx.scale(zoom,zoom);
  for(const p of paths){const hub=p.hub&&layout.points.get(p.hub);ctx.save();ctx.globalAlpha=hub?(states.get(hub.key)?.opacity||.2):.65;ctx.fillStyle='#86a56e';ctx.strokeStyle='#78965e';
   if(hub){ctx.translate(hub.x,hub.y+(hub.plot.cy||0));ctx.rotate((hub.plot.tilt||0)*Math.PI/180);ctx.globalAlpha*=.07;ctx.fill(p.path);ctx.globalAlpha=states.get(hub.key)?.opacity??1;ctx.lineWidth=1/zoom;ctx.stroke(p.path);}
   else if(p.fill)ctx.fill(p.path);else{ctx.lineWidth=2/zoom;ctx.stroke(p.path);}ctx.restore();
  }
  if(layout.core){const c=layout.core;ctx.fillStyle='#557345';ctx.beginPath();ctx.arc(c.x,c.y,176,0,Math.PI*2);ctx.fill();const image=picture(logo);if(image?.complete&&image.naturalWidth)ctx.drawImage(image.bitmap||image,c.x-156,c.y-156,312,312);}
  for(const p of layout.points.values()){
   const state=states.get(p.key);if(state?.visible===false||!detail.get(p.key)?.visible)continue;ctx.save();ctx.globalAlpha=state?.opacity??1;const art=nodeArt.get(p.key),img=art&&picture(art.href),size=p.size*1.05;
   if(img?.complete&&img.naturalWidth&&!art.mask){const [left,top,extent]=art.frame,[x,y,right,bottom]=art.crop,l=Math.max(left,x),t=Math.max(top,y),r=Math.min(left+extent,right),b=Math.min(top+extent,bottom),scale=size/extent;if(r>l&&b>t)ctx.drawImage(img.bitmap||img,l,t,r-l,b-t,p.x-size/2+(l-left)*scale,p.y-size/2+(t-top)*scale,(r-l)*scale,(b-t)*scale);}
   else{ctx.fillStyle='#6e9762';ctx.beginPath();ctx.arc(p.x,p.y,p.size*.24,0,Math.PI*2);ctx.fill();}
   ctx.fillStyle='#547944';ctx.beginPath();ctx.arc(p.x,p.y,(p.owner?2.2:3)/zoom,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.restore();ctx.font='11px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const p of layout.points.values()){
   const state=states.get(p.key);if(state?.visible===false||!detail.get(p.key)?.visible)continue;const x=p.x*zoom+pan[0],y=p.y*zoom+pan[1];if(x<-160||x>width+160||y<-60||y>height+60)continue;ctx.globalAlpha=state?.opacity??1;
   if(detail.get(p.key)?.badge){const count=p.record.displayCount??p.record.count??p.record.members?.length??0;ctx.fillStyle='#faf6e8';ctx.beginPath();ctx.arc(x+p.size*zoom*.4,y+p.size*zoom*.36,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#625b40';ctx.fillText(String(count),x+p.size*zoom*.4,y+p.size*zoom*.36);}
   if(detail.get(p.key)?.label&&(!p.owner||labels?.has(p.key))){let name=p.record.name;if(name.length>(p.owner?12:9))name=name.slice(0,p.owner?11:8)+'…';ctx.fillStyle='#4c7443';ctx.fillText(name,x,y+p.size*zoom/2+18);}
  }
  ctx.globalAlpha=1;canvas.style.display='block';return true;
 }
 return {capture,paint,hide(){canvas.style.display='none';},dispose(){canvas.remove();for(const img of images.values())img.bitmap?.close();images.clear();scene=null;}};
}
