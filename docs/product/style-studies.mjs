const root='assets/style-studies-v1/';
const byId=id=>document.getElementById(id);
const nodeNames=['花盘','三叶草','银杏','松树','蘑菇','橡果'];
const positions=[[24,29],[52,25],[78,32],[28,68],[55,64],[79,72]];
let styles=[],active=null,view='garden';
function setView(value){view=value;byId('canvas').dataset.view=value;for(const b of document.querySelectorAll('[data-view]'))if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.view===value));byId('canvas-detail').textContent=value==='paper'?'空白纸张 · 给知识留出呼吸空间':value==='sheet'?'花盘 / 三叶草 / 银杏 / 松树 / 蘑菇 / 橡果':'六种素材 · 同套纸张与画法';}
function selectStyle(s){
 active=s;history.replaceState(null,'','#style='+s.id);try{localStorage.setItem('kumo:style-studies:v1',s.id);}catch{}
 for(const b of byId('directions').children)b.setAttribute('aria-pressed',String(b.dataset.id===s.id));
 byId('ref-number').textContent=s.id+' / 09';byId('style-title').textContent=s.id+' · '+s.name;byId('mood').textContent=s.mood;
 byId('reference-image').src=root+s.reference;byId('reference-link').href=root+s.reference;byId('reference-read').textContent=s.read;
 byId('palette').replaceChildren(...s.palette.map(c=>{const n=document.createElement('span');n.className='swatch';n.style.background=c;n.title=c;return n;}));
 byId('paper-note').textContent=s.background;byId('node-note').textContent=s.adapt;byId('avoid-note').textContent='纸张、节点、标签与连线共同维持“'+s.mood+'”的感觉。'+s.avoid;
 byId('canvas').style.backgroundImage=`url("${root+s.backgroundAsset}")`;byId('canvas').style.setProperty('--line',s.palette[2]);
 byId('sheet').src=root+s.nodeAsset;byId('download-paper').href=root+s.backgroundAsset;byId('download-nodes').href=root+s.nodeAsset;
 byId('try-garden').href='garden-v16.html#theme=paperlight&bg=study-'+s.id;byId('try-garden').title='只在现有花园试用这张背景，节点仍保留原版';
 byId('node-caption').textContent='点击植物，看这套画法保留了什么。';
 byId('sample-nodes').replaceChildren(...nodeNames.map((name,i)=>{const n=document.createElement('button');n.type='button';n.className='sample-node';n.style.left=positions[i][0]+'%';n.style.top=positions[i][1]+'%';n.setAttribute('aria-label',name+'，'+s.name+'样张');const art=document.createElement('span');art.className='sprite';art.style.backgroundImage=`url("${root+s.nodeAsset}")`;art.style.backgroundPosition=[['0%','50%','100%'][i%3],i<3?'0%':'100%'].join(' ');const label=document.createElement('span');label.className='node-label';label.textContent=name;const sub=document.createElement('small');sub.textContent='节点画法样张';n.append(art,label,sub);n.onclick=()=>{byId('node-caption').textContent=name+' · '+s.nodes;};return n;}));
 setView(view);
}
for(const button of document.querySelectorAll('button[data-view]'))button.onclick=()=>setView(button.dataset.view);
try{
 const response=await fetch(root+'styles.json');if(!response.ok)throw Error('风格目录读取失败');styles=await response.json();
 for(const s of styles){const button=document.createElement('button');button.type='button';button.className='direction';button.dataset.id=s.id;button.setAttribute('aria-pressed','false');const preview=document.createElement('div');preview.className='direction-art';preview.style.backgroundImage=`url("${root+s.backgroundAsset}")`;const img=document.createElement('img');img.src=root+s.nodeAsset;img.alt='';img.loading='lazy';preview.append(img);const label=document.createElement('span');label.className='direction-label';const num=document.createElement('small');num.textContent=s.id;label.append(num,document.createTextNode(s.name));button.append(preview,label);button.onclick=()=>selectStyle(s);byId('directions').append(button);}
 let saved;try{saved=localStorage.getItem('kumo:style-studies:v1');}catch{}const requested=new URLSearchParams(location.hash.slice(1)).get('style')||saved||'03';selectStyle(styles.find(s=>s.id===requested)||styles[2]);
 document.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.closest('input,textarea'))return;e.preventDefault();const i=styles.indexOf(active);selectStyle(styles[(i+(e.key==='ArrowRight'?1:-1)+styles.length)%styles.length]);});
}catch(error){byId('status').textContent='风格素材暂时没有加载完整，请刷新页面重试。';console.error(error);}
