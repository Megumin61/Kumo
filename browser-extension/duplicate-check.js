(function(scope){
  async function find(current,bridge,storage){
    const key=current.dedupeKey&&!current.dedupeKey.startsWith('hash:')?current.dedupeKey:storage.sourceKeyFromUrl(current.url);
    let offset=0;
    do{
      const result=await bridge.library({limit:200,offset});
      const items=result.items||[];
      const found=items.find(item=>{const other=storage.sourceKeyFromUrl(item.url);return key&&other?key===other:Boolean(current.dedupeSafeUrl&&storage.safeComparableUrl(current.url)&&current.url===item.url);});
      if(found)return found;
      offset+=items.length;
      if(!items.length||offset>=result.total)break;
    }while(true);
    return null;
  }
  scope.KumoDuplicate={find};
  if(typeof module!=='undefined')module.exports=scope.KumoDuplicate;
})(globalThis);
