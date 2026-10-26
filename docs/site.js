const features={
  clip:{kicker:'看到好内容，一下就存',title:'给网页留一张\n有来源的内容卡片。',description:'保存标题、作者、链接、可读取的正文与主要图片，再补一句自己的想法。GitHub 项目和 B 站视频，也可以先留下项目说明或视频线索。',points:['Windows 默认 Ctrl+Q 快速剪藏','笔记、标签、来源一起留下','文件夹或浏览器下载目录，自行选择'],condition:'基础剪藏使用浏览器扩展即可；首次保存需选择位置并授权。',image:'assets/clipper.jpg',alt:'Kumo 浏览器剪藏面板、标签和笔记',caption:'从你正在看的页面留下内容。'},
  colony:{kicker:'把内容放回一张地图',title:'每一个领域，\n都有自己的小小聚落。',description:'领域圈层、自然藤蔓、主题与收藏一起构成地图。浏览已有内容的分布，也能单独看到还在等待整理的材料。',points:['从领域看见相关主题与收藏','圈层和枝叶表达内容之间的归属','待编译材料独立收纳'],condition:'需要本地助手连接同一个资料库；编译后的主题与领域来自已连接的 AI 整理。',image:'assets/colony.jpg',alt:'Kumo 收藏聚落中的领域圈层和藤蔓连接',caption:'先看整体，再沿感兴趣的方向走进去。'},
  garden:{kicker:'沿着一条线索，继续往里走',title:'从领域到主题，\n再回到一篇具体收藏。',description:'像翻自己的手账一样展开分支。看概括、读内容、找依据，把抽象的主题重新连回原始材料。',points:['领域、主题、帖子逐层探索','右侧阅读当前节点与相关内容','植物节点与画风可以切换'],condition:'知识花园需要连接本地助手。保存成功并不代表内容已经由 AI 编译成主题知识。',image:'assets/garden.jpg',alt:'Kumo 知识花园展开领域并在右侧显示相关内容',caption:'让概括有来处，让线索可以继续被探索。'},
  ai:{kicker:'做事情的时候，把收藏用起来',title:'让已连接的 AI，\n先找找你的参考。',description:'在设计、学习或项目任务中检索相关材料，读取原文与笔记，再给出带依据的归纳。需要整理时，先预览，得到授权后再写入。',points:['按任务检索并读取保存的内容','区分原文、个人笔记和 AI 归纳','保留原件与人工标签，可继续修订'],condition:'需在兼容本地插件的桌面客户端单独安装和授权。并非仅安装浏览器扩展就能让网页版 ChatGPT 读取电脑文件。',image:'assets/ai-workflow.jpg',alt:'Kumo 产品演示中，已连接的 AI 按任务查找收藏',caption:'使用结果取决于已连接的宿主与实际读取到的资料。'}
};
const tabs=Array.from(document.querySelectorAll('[data-feature]'));
function selectFeature(button){
  const value=features[button.dataset.feature];if(!value)return;
  for(const tab of tabs){const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
  document.getElementById('feature-panel').setAttribute('aria-labelledby',button.id);
  for(const [id,key]of [['feature-kicker','kicker'],['feature-description','description'],['feature-condition','condition'],['feature-caption','caption']])document.getElementById(id).textContent=value[key];
  const title=document.getElementById('feature-title');title.replaceChildren();value.title.split('\n').forEach((line,index)=>{if(index)title.append(document.createElement('br'));title.append(document.createTextNode(line));});
  const list=document.getElementById('feature-points');list.replaceChildren(...value.points.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const image=document.getElementById('feature-image');image.src=value.image;image.alt=value.alt;
}
for(const [index,tab]of tabs.entries()){
  tab.addEventListener('click',()=>selectFeature(tab));
  tab.addEventListener('keydown',event=>{let target;if(event.key==='ArrowRight')target=tabs[(index+1)%tabs.length];if(event.key==='ArrowLeft')target=tabs[(index+tabs.length-1)%tabs.length];if(event.key==='Home')target=tabs[0];if(event.key==='End')target=tabs.at(-1);if(target){event.preventDefault();selectFeature(target);target.focus();}});
}
const styleVideo=document.getElementById('style-video');
if(matchMedia('(prefers-reduced-motion: reduce)').matches){styleVideo.autoplay=false;styleVideo.pause();}
if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(!entry.isIntersecting)styleVideo.pause();else if(!matchMedia('(prefers-reduced-motion: reduce)').matches)void styleVideo.play().catch(()=>{});},{threshold:.15});observer.observe(styleVideo);}
document.addEventListener('visibilitychange',()=>{if(document.hidden)styleVideo.pause();});
