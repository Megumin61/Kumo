const byId=id=>document.getElementById(id),namespace='http://www.w3.org/2000/svg';
const escapeText=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const types={supports:'支持',contradicts:'存在分歧',example:'案例说明',prerequisite:'前置知识',complements:'互补'};
const list=values=>values?.length?'<ul>'+values.map(value=>'<li>'+escapeText(value)+'</li>').join('')+'</ul>':'<p>证据不足，尚未沉淀。</p>';
const sourceLink=source=>'<a href="library.html#item='+encodeURIComponent(source.id)+'">'+escapeText(source.title||'查看原件')+'</a>';
const nodeKey=node=>node.kind+':'+node.id;
let current={kind:'root',id:'',offset:0,relatedOffset:0,sourceOffset:0,sources:false},data=null,epoch=0,compactLayout;
const initialDepth=history.state?.kumoDepth||0;
function destination(node){return {kind:node.kind,id:node.id,offset:0,relatedOffset:0,sourceOffset:0,sources:false};}
function button(label,action){const element=document.createElement('button');element.type='button';element.textContent=label;element.onclick=action;return element;}
function svg(tag,attributes={},label){const element=document.createElementNS(namespace,tag);for(const[name,value]of Object.entries(attributes))element.setAttribute(name,value);if(label!==undefined)element.textContent=label;return element;}
function urlState(){const params=new URLSearchParams(location.hash.slice(1));const kind=params.get('kind')||'root';return {...current,kind:['root','domain','topic'].includes(kind)?kind:'root',id:params.get('id')||'',offset:Number(params.get('offset')||0),relatedOffset:Number(params.get('relatedOffset')||0),sourceOffset:0,sources:false};}
async function navigate(next,{push=true,refresh=false}={}){
  const request=++epoch;byId('connection').textContent='正在加载当前知识…';byId('graph').setAttribute('aria-busy','true');
  try{
    const result=await KumoBridge.knowledgeFocus({...next,refresh});if(request!==epoch)return;
    current={...next};data=result;const hash='#'+new URLSearchParams({kind:next.kind,id:next.id,offset:next.offset,relatedOffset:next.relatedOffset});
    const state={kumo:current,kumoDepth:(history.state?.kumoDepth||initialDepth)+(push?1:0)};
    if(push)history.pushState(state,'',hash);else history.replaceState(state,'',hash);
    byId('connection').textContent='';render();
  }catch(error){if(request===epoch)byId('connection').textContent='连接失败，已保留当前内容。点击“刷新连接”重试。'+error.message;}
  finally{if(request===epoch)byId('graph').setAttribute('aria-busy','false');}
}
function render(){
  byId('coverage').textContent=`${data.total} 条真实收藏 · ${data.compiled} 条已编译 · ${data.pending} 条待整理 · ${data.indexOnly} 条仅建索引`;
  byId('back').disabled=!(history.state?.kumoDepth>initialDepth)&&current.kind==='root';
  byId('breadcrumbs').replaceChildren();data.breadcrumbs.forEach((node,index)=>{const element=button(node.name,()=>navigate(destination(node)));if(index===data.breadcrumbs.length-1)element.setAttribute('aria-current','page');byId('breadcrumbs').append(element);});
  const center=data.center,knowledge=center.summaryNeedsReview?null:center.knowledge;
  byId('inspector').innerHTML='<span class="badge">'+(center.summaryNeedsReview?'来源变化 · 待核验':center.kind==='root'?'知识总览':'领域知识')+'</span><h2>'+escapeText(center.name)+'</h2><p>'+escapeText(center.summary)+'</p><p class="metric">'+center.sourceCount+' 条关联资料</p>'+(center.kind==='root'?'<p>选择一个领域，查看子主题和可复用经验。待整理收藏仍可在“我的收藏”查找。</p>':'<h3>可复用判断</h3>'+list(knowledge?.takeaways)+'<h3>怎么做</h3>'+list(knowledge?.steps)+'<h3>怎么检查</h3>'+list(knowledge?.checks)+'<h3>适用边界</h3>'+list(center.avoidWhen)+'<h3>分歧与未知</h3>'+list(knowledge?.openQuestions));
  const relations=document.createElement('section');relations.id='relations';
  for(const related of data.related){const detail=document.createElement('details');detail.className='relationship';detail.innerHTML='<summary>'+escapeText(related.node.name)+' · 查看关联依据</summary>'+related.relations.map(relation=>'<p><strong>'+escapeText(types[relation.type]||relation.type)+'</strong> · '+escapeText(relation.reason)+'</p><blockquote>'+escapeText(relation.fromQuote)+'</blockquote>'+sourceLink(relation.fromSource)+(relation.fromEvidence?.resource?'<small>图片观察 · '+escapeText(relation.fromEvidence.resource)+'</small>':'')+'<blockquote>'+escapeText(relation.toQuote)+'</blockquote>'+sourceLink(relation.toSource)+(relation.toEvidence?.resource?'<small>图片观察 · '+escapeText(relation.toEvidence.resource)+'</small>':'')).join('');detail.append(button('探索 '+related.node.name,()=>navigate(destination(related.node))));relations.append(detail);}byId('inspector').append(relations);
  const evidence=document.createElement('details');evidence.id='sources';evidence.className='evidence';evidence.open=Boolean(current.sources);evidence.innerHTML='<summary>来源与逐篇总结 · '+data.sourceTotal+'</summary><div id="source-list"></div>';
  evidence.ontoggle=()=>{if(evidence.open&&!current.sources)void navigate({...current,sources:true},{push:false});};byId('inspector').append(evidence);
  if(current.sources){for(const source of data.sources){const resource=document.createElement('div');resource.className='resource';resource.innerHTML='<div>'+sourceLink(source)+'<small>'+(source.evidenceStatus==='index_only'?'仅建索引':source.evidenceStatus==='limited'?'有限证据':'已编译')+'</small><p>'+escapeText(source.summary)+'</p></div>';byId('source-list').append(resource);}if(data.nextSourceOffset!==null)byId('source-list').append(button('下一页来源',()=>navigate({...current,sourceOffset:data.nextSourceOffset},{push:false})));if(current.sourceOffset)byId('source-list').append(button('上一页来源',()=>navigate({...current,sourceOffset:Math.max(0,current.sourceOffset-10)},{push:false})));}
  let pagination=byId('pagination');if(!pagination){pagination=document.createElement('div');pagination.id='pagination';document.querySelector('.workspace').after(pagination);}pagination.replaceChildren();
  if(current.offset)pagination.append(button('上一页子主题',()=>navigate({...current,offset:Math.max(0,current.offset-8)})));if(data.nextOffset!==null)pagination.append(button('更多子主题',()=>navigate({...current,offset:data.nextOffset})));if(current.relatedOffset)pagination.append(button('上一页关联',()=>navigate({...current,relatedOffset:Math.max(0,current.relatedOffset-3)})));if(data.nextRelatedOffset!==null)pagination.append(button('更多关联',()=>navigate({...current,relatedOffset:data.nextRelatedOffset})));
  byId('node-list').replaceChildren();for(const node of [...data.children,...data.related.map(item=>item.node)])byId('node-list').append(button(node.name+' · '+node.sourceCount+' 条资料',()=>navigate(destination(node))));draw();
}
function draw(){if(!data)return;const graph=byId('graph'),width=graph.clientWidth,height=graph.clientHeight;graph.setAttribute('viewBox',`0 0 ${width} ${height}`);graph.replaceChildren();
  const center={...data.center,x:width*.5,y:height*.5};
  const position=(index,total)=>total===1?height*.5:90+index*(height-180)/(total-1);
  const children=data.children.map((node,index)=>({...node,x:width*.18,y:position(index,data.children.length)}));
  const related=data.related.map((item,index)=>({...item.node,x:width*.82,y:position(index,data.related.length),related:true}));
  const compact=width<420;if(compactLayout!==compact){document.querySelector('.accessible-map').open=compact;compactLayout=compact;}
  if(children.length)graph.append(svg('text',{x:width*.18,y:35,'text-anchor':'middle',class:'column-label'},'子领域与主题'));
  if(related.length)graph.append(svg('text',{x:width*.82,y:35,'text-anchor':'middle',class:'column-label'},'证据关联'));
  for(const node of [...children,...related]){const edge=svg('path',{class:'edge'+(node.related?' relation':''),d:`M${center.x},${center.y} L${node.x},${node.y}`});if(node.related){const target=svg('g',{class:'relation-link',role:'button',tabindex:0,'aria-label':'查看 '+node.name+' 的关联依据'});target.append(edge,svg('circle',{cx:(center.x+node.x)/2,cy:(center.y+node.y)/2,r:9,fill:'transparent'}));target.onclick=()=>{const index=data.related.findIndex(item=>nodeKey(item.node)===nodeKey(node)),detail=byId('relations').children[index];detail.open=true;detail.scrollIntoView({block:'nearest'});};target.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();target.onclick();}};graph.append(target);}else graph.append(edge);}
  for(const node of [center,...children,...related]){const isCenter=node===center,group=svg('g',{class:'focus-node'+(isCenter?' center':'')+(node.related?' related':''),transform:`translate(${node.x},${node.y})`,'data-id':nodeKey(node),role:'button',tabindex:0,'aria-label':node.name});group.append(svg('rect',{x:-Math.min(83,width*.14),y:-28,width:Math.min(166,width*.28),height:56,rx:12}),svg('title',{},node.name+' · '+node.summary));const maximum=Math.max(3,Math.floor(Math.min(166,width*.28)/13)-1),characters=Array.from(node.name),label=characters.slice(0,maximum).join('')+(characters.length>maximum?'…':'');group.append(svg('text',{'text-anchor':'middle',y:-2},label),svg('text',{'text-anchor':'middle',y:17,class:'node-count'},node.sourceCount+' 条资料'));group.onclick=()=>{if(!isCenter)void navigate(destination(node));};group.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();group.onclick();}};graph.append(group);}
}
byId('back').onclick=()=>{if(history.state?.kumoDepth>initialDepth)history.back();else void navigate(destination({kind:'root',id:''}),{push:false});};byId('home').onclick=()=>navigate(destination({kind:'root',id:''}));byId('reload').onclick=()=>navigate(current,{push:false,refresh:true});
window.addEventListener('popstate',event=>navigate(event.state?.kumo||urlState(),{push:false}));new ResizeObserver(draw).observe(byId('graph'));void navigate(urlState(),{push:false});
