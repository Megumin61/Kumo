(function(scope){
  function open(windowId,{chromeApi=scope.chrome,onUnavailable=()=>{},onOpened=()=>{}}={}){
    const panel=chromeApi?.sidePanel;
    if(!panel?.open||!panel?.setOptions||!Number.isInteger(windowId)){onUnavailable('当前浏览器未能打开收藏侧栏，请使用浏览器工具栏中的 Kumo 侧栏入口。');return Promise.resolve(false);}
    try{
      // Do not await configuration before open: the browser requires the click gesture.
      // Reassert the list path even if the previous panel was navigating the garden.
      const configured=panel.setOptions({path:'library.html',enabled:true});
      const opened=panel.open({windowId});
      return Promise.all([configured,opened]).then(()=>{onOpened();return true;},()=>{onUnavailable('收藏侧栏未能打开，请使用浏览器工具栏中的 Kumo 侧栏入口。');return false;});
    }catch{onUnavailable('收藏侧栏未能打开，请使用浏览器工具栏中的 Kumo 侧栏入口。');return Promise.resolve(false);}
  }
  scope.KumoPanel={open};if(typeof module==='object')module.exports={open};
})(globalThis);
