export const previewSize={width:178,height:96};
export function placePreviews(points,metadata,width,positions=new Map()){
 const items=metadata.items.filter(r=>r.kind==='source');if(!items.length)return;
 const parent=points.get(metadata.current),mixed=items.length!==metadata.items.length;
 items.forEach((record,index)=>{const point=points.get(record.key),cached=positions.get(record.key);Object.assign(point,{preview:true,cardWidth:previewSize.width,cardHeight:previewSize.height,size:96,x:cached?.[0]??parent.x+(mixed?370:240),y:cached?.[1]??parent.y+(index-(items.length-1)/2)*130});});
 metadata.previews=true;
}
