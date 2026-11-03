(function(){
 const byId=id=>document.getElementById(id);let handle=null,busy=false;
 function setBusy(value){busy=value;for(const id of ['restore','choose','change'])byId(id).disabled=value;}
 async function inspect(){
  handle=await KumoStorage.getHandle('library');const permissions=await KumoStorage.connectionState(),granted=permissions.write==='granted';
  byId('folder-name').textContent=handle?'已记住：'+handle.name:'还没有连接资料文件夹';
  byId('restore').hidden=!handle||granted;byId('choose').hidden=!!handle;byId('connected').hidden=!granted;byId('persistent-hint').hidden=granted;
  byId('connection-status').textContent=granted?'原文件夹可以直接使用，无需重新选择。':handle?'原文件夹已保存，点击下方按钮恢复访问权限。':'选择一次，Kumo 会保存文件夹记录。';
  return permissions;
 }
 async function restore(){if(busy||!handle)return;setBusy(true);try{
  // Invoked directly from a click in a regular extension tab, not the short-lived action popup.
  const permission=await handle.requestPermission({mode:'readwrite'});
  if(permission!=='granted')throw Error('尚未获得访问权限。原文件夹仍然保留，可以再次恢复授权。');
  await KumoBridge.connect();byId('connection-status').textContent='正在准备收藏…';await KumoBridge.library({limit:1});await inspect();
 }catch(error){byId('connection-status').textContent=error.message||'授权未完成，请重试。';}finally{setBusy(false);}}
 async function choose(){if(busy)return;setBusy(true);try{
  const picked=await KumoStorage.pickDirectory('library');if(!picked)return;
  await KumoStorage.initializeLibrary(picked,{libraryParts:[],guideAtRoot:false,guideContent:'# Kumo 资料库\n\n先读 LIBRARY.md，原始资料与用户笔记保持。\n',libraryReadme:'# Kumo 本地资料库\n\n收藏保存在 inbox/，原始来源保持。\n'});
  await KumoBridge.connect({handle:picked});byId('connection-status').textContent='正在准备收藏，首次读取需要一点时间…';await KumoBridge.library({limit:1});location.replace('library.html');
 }catch(error){if(error.name!=='AbortError')byId('connection-status').textContent=error.message||'选择未完成，请重试。';}finally{setBusy(false);}}
 byId('restore').onclick=restore;byId('choose').onclick=choose;byId('change').onclick=choose;
 if(new URL(location.href).searchParams.get('change')==='1')byId('change').closest('details').open=true;
 inspect().catch(error=>{byId('connection-status').textContent='无法读取已保存的目录记录：'+error.message;});
})();
