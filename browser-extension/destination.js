(function(scope){
  const modes=new Set(['auto','directory','downloads']);
  const profiles=new Set(['codex','workbuddy','claude','qoder','generic']);
  function savedProfile(storage){const value=storage.getItem('kumo-target');return profiles.has(value)?value:'codex';}
  function initialMode(saved,connection){return modes.has(saved)?saved:connection?.ok?'auto':'directory';}
  function options(storage){let value={};try{value=JSON.parse(storage.getItem('kumo-capture-options:v1')||'{}')||{};}catch{}
    return {screenshot:value.screenshot===true,images:value.images!==false,video:value.video===true,comments:[0,5,10].includes(value.comments)?value.comments:0};}
  function saveOptions(storage,value){storage.setItem('kumo-capture-options:v1',JSON.stringify({screenshot:!!value.screenshot,images:!!value.images,video:!!value.video,comments:[0,5,10].includes(value.comments)?value.comments:0}));}
  scope.KumoDestination={savedProfile,initialMode,options,saveOptions};
  if(typeof module==='object')module.exports=scope.KumoDestination;
})(globalThis);
