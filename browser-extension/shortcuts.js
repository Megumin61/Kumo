(function(scope){
  const shortcutPage=agent=>/Edg\//.test(agent)?'edge://extensions/shortcuts':'chrome://extensions/shortcuts';
  async function refresh(api,doc){
    const key=doc.getElementById('quick-shortcut'),info=doc.getElementById('shortcut-info');
    try{
      const commands=await api.commands.getAll(),quick=commands.find(x=>x.name==='kumo-save'),open=commands.find(x=>x.name==='kumo-open');
      key.textContent=quick?.shortcut||'未分配';
      info.textContent=quick?.shortcut?'在网页按 '+quick.shortcut+'，直接剪藏到已选位置。首次保存或新增媒体授权需要点击确认。':'尚未分配快捷键，或按键被占用。点击“修改快捷键”，为 Kumo 的“一键剪藏当前网页”设置 Ctrl+Q 或其他按键。';
      doc.getElementById('open-shortcut').textContent=(open?.shortcut||'未分配')+' 打开面板 · Ctrl+Enter 在面板内保存';
    }catch{key.textContent='暂不可读取';info.textContent='请在浏览器扩展快捷键设置中查看和修改。';}
  }
  function mount(api=scope.chrome,doc=scope.document,win=scope.window){
    const update=()=>refresh(api,doc);
    doc.getElementById('edit-shortcut').onclick=async()=>{
      try{await api.tabs.create({url:shortcutPage(scope.navigator.userAgent)});}
      catch{doc.getElementById('shortcut-info').textContent='请在浏览器的扩展管理中打开“键盘快捷键”，为 Kumo 设置按键。';}
    };
    win.addEventListener('focus',update);
    doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)void update();});
    void update();return update;
  }
  const api={shortcutPage,refresh,mount};scope.KumoShortcuts=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
