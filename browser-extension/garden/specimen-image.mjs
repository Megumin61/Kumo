const NS='http://www.w3.org/2000/svg';
let serial=0;
export function mountSpecimen(parent,art,size){
 const make=(tag,attrs,host)=>{const n=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))n.setAttribute(key,String(value));host.append(n);return n;};
 const [left,top,extent]=art.frame,[x,y,right,bottom]=art.crop,id='kumo-sprite-'+(++serial);
 const frame=make('svg',{x:-size/2,y:-size/2,width:size,height:size,viewBox:[left,top,extent,extent].join(' '),overflow:'hidden',class:'specimen-art','data-specimen':art.index,'data-child':String(art.child),'pointer-events':'none'},parent);
 frame.style.setProperty('filter','none','important');
 const defs=make('defs',{},frame),clip=make('clipPath',{id,clipPathUnits:'userSpaceOnUse'},defs);
 make('rect',{x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)},clip);
 make('image',{href:art.href,x:0,y:0,width:art.width,height:art.height,'clip-path':'url(#'+id+')',preserveAspectRatio:'none'},frame);
 return frame;
}
