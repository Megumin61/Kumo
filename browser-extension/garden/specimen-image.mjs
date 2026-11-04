const NS='http://www.w3.org/2000/svg';
let serial=0;
const make=(tag,attrs,host)=>{const n=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));host?.append(n);return n;};

// Each node used to draw the whole sprite sheet and clip it down to one specimen. With
// thousands of posts that clipping dominated painting, so every specimen is cut out of
// its sheet once and reused as a plain image. Placement and pixels stay the same.
const atlases=new Map(),sprites=new Map(),pending=new Set();let swapFrame=0;
function visibleRect(art){const [left,top,extent]=art.frame,[x,y,right,bottom]=art.crop;return [Math.max(left,x),Math.max(top,y),Math.min(left+extent,right),Math.min(top+extent,bottom)];}
function loadAtlas(href){if(!atlases.has(href))atlases.set(href,new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=href;}));return atlases.get(href);}
function sprite(art){
 const rect=visibleRect(art),key=art.href+'|'+rect.join(',')+'|'+art.width+'x'+art.height;let entry=sprites.get(key);if(entry)return entry;
 entry={url:null,failed:false,rect};sprites.set(key,entry);
 const [l,t,r,b]=rect,w=r-l,h=b-t;
 if(typeof document==='undefined'||!rect.every(Number.isInteger)||w<=0||h<=0){entry.failed=true;return entry;}
 loadAtlas(art.href).then(img=>{
  // Only a 1:1 sheet can be copied pixel for pixel; anything else keeps the original drawing.
  if(img.naturalWidth!==art.width||img.naturalHeight!==art.height)throw Error('scaled atlas');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,l,t,w,h,0,0,w,h);entry.url=canvas.toDataURL('image/png');schedule();
 }).catch(()=>{entry.failed=true;for(const item of pending)if(item.entry===entry)pending.delete(item);});
 return entry;
}
function schedule(){if(swapFrame||!pending.size)return;swapFrame=requestAnimationFrame(()=>{swapFrame=0;for(const item of pending){if(!item.entry.url)continue;pending.delete(item);if(item.frame.isConnected)item.frame.replaceWith(spriteImage(item.art,item.size,item.entry));}});}
function spriteImage(art,size,entry){
 const [left,top,extent]=art.frame,[l,t,r,b]=entry.rect,scale=size/extent;
 const image=make('image',{href:entry.url,x:-size/2+(l-left)*scale,y:-size/2+(t-top)*scale,width:(r-l)*scale,height:(b-t)*scale,preserveAspectRatio:'none',class:'specimen-art','data-specimen':art.index,'data-child':String(art.child),'pointer-events':'none'});
 image.style.setProperty('filter','none','important');return image;
}
function legacySpecimen(parent,art,size){
 const [left,top,extent]=art.frame,[x,y,right,bottom]=art.crop,id='kumo-sprite-'+(++serial);
 const frame=make('svg',{x:-size/2,y:-size/2,width:size,height:size,viewBox:[left,top,extent,extent].join(' '),overflow:'hidden',class:'specimen-art','data-specimen':art.index,'data-child':String(art.child),'pointer-events':'none'},parent);
 frame.style.setProperty('filter','none','important');
 const defs=make('defs',{},frame),clip=make('clipPath',{id,clipPathUnits:'userSpaceOnUse'},defs);
 make('rect',{x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)},clip);
 make('image',{href:art.href,x:0,y:0,width:art.width,height:art.height,'clip-path':'url(#'+id+')',preserveAspectRatio:'none'},frame);
 return frame;
}
export function mountSpecimen(parent,art,size){
 const entry=sprite(art);
 if(entry.url){const image=spriteImage(art,size,entry);parent.append(image);return image;}
 const frame=legacySpecimen(parent,art,size);
 if(!entry.failed){pending.add({frame,art,size,entry});schedule();}
 return frame;
}
