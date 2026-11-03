(function(scope){
 function openMap({navigate=url=>scope.location.assign(url),chromeApi=scope.chrome}={}){
  const url=chromeApi?.runtime?.getURL?chromeApi.runtime.getURL('garden/index.html?panel=1'):new URL('garden/index.html?panel=1',scope.location.href).href;
  // Navigate inside the existing native side panel; its width belongs to the browser.
  return navigate(url);
 }
 scope.KumoMapEntry={openMap};if(typeof module==='object')module.exports={openMap};
 scope.document?.querySelectorAll('[data-open-knowledge-map]').forEach(link=>{link.title='在侧边栏中打开知识地图';link.addEventListener('click',event=>{event.preventDefault();openMap();});});
})(globalThis);
