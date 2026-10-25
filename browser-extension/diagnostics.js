async function run(){
 const button=document.getElementById('check');button.disabled=true;
 const status=document.getElementById('connection-status'),path=document.getElementById('connection-path'),next=document.getElementById('connection-next');
 status.textContent='正在检查…';path.textContent='';
 try{const result=await KumoBridge.status();
  if(!result?.ok){status.textContent='本地助手尚未连接';next.textContent='仍可使用资料文件夹保存网页。收藏列表和花园需要先连接本地助手。';return;}
  status.textContent=Number(result.apiVersion)<5?'已找到本地助手，需要更新':'本地资料库已连接';
  path.textContent=result.libraryRoot?'资料位置：'+result.libraryRoot:'';
  next.textContent=Number(result.apiVersion)<5?'请更新本地助手后再保存。':'确认浏览器和 AI 插件使用同一个资料位置。';
 }catch{status.textContent='暂时无法检查连接';next.textContent='可继续使用资料文件夹保存，稍后重新检查。';}finally{button.disabled=false;}
}
document.getElementById('check').onclick=run;void run();