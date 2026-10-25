import {family,palette,nodeSize,glyph,countOf} from './schema.mjs';
export const upstreamForce={repulsion:46,edgeLength:[10,42],gravity:.16,friction:.22,layoutAnimation:true};
export function swarmData(model){
  const topics=model.topics.filter(topic=>topic.members.length&&model.records.has('domain:'+topic.domainId)),records=[...model.groups,...topics,...model.sources],ids=new Set(records.map(record=>record.key)),links=[];
  const put=(from,to,kind,record)=>{if(ids.has(from)&&ids.has(to))links.push({id:kind+':'+from+'--'+to,source:from,target:to,kind,recordKey:record?.key,relation:record});};
  for(const topic of topics)put(topic.key,ids.has('topic:'+topic.parentTopicId)?'topic:'+topic.parentTopicId:'domain:'+topic.domainId,'membership');
  for(const source of model.sources){const candidates=(source.card?.topicIds||[]).map(id=>model.records.get('topic:'+id)).filter(topic=>topic&&topic.domainId===source.primary.slice(7)&&ids.has(topic.key)),topic=candidates.find(candidate=>!candidates.some(other=>other.parentTopicId===candidate.id));put(source.key,topic?.key||source.primary,'membership');}
  for(const relation of model.relations)put(relation.from,relation.to,'evidence',relation);
  for(const source of model.sources)if(!links.some(link=>link.kind==='membership'&&link.source===source.key&&link.target===source.primary))put(source.key,source.primary,'cohesion');
  for(const bundle of [...model.bundles].sort((first,second)=>second.relations.length-first.relations.length).slice(0,4))put(bundle.from,bundle.to,'bundle',bundle);
  return {records,links};
}
export function forceOption(model,theme='petal'){
  const {records,links}=swarmData(model);
  return {animationDuration:400,tooltip:{show:false},
    series:[{id:'swarm',type:'graph',layout:'force',force:{...upstreamForce,repulsion:[8,95],edgeLength:[26,90]},roam:true,draggable:true,left:45,right:45,top:40,bottom:60,scaleLimit:{min:.35,max:4},nodeScaleRatio:.7,
      data:records.map(record=>{const colors=palette[family(model,record)],hub=record.kind!=='source'&&record.kind!=='topic',topic=record.kind==='topic',limited=['index_only','pending','stale'].includes(record.status),size=nodeSize(record,'field'),owner=hub?record.key:record.primary||'domain:'+record.domainId;return {id:record.key,name:record.name,kind:record.kind,hub,dom:owner,value:hub?55:topic?5:1+model.relations.filter(relation=>relation.from===record.key||relation.to===record.key).length*.2,symbol:hub||topic?'image://data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(glyph(model,record,theme)):'circle',symbolSize:size,symbolKeepAspect:true,draggable:true,cursor:'grab',itemStyle:{color:limited?'#fafaf7':topic?colors.soft:colors.fill,borderColor:colors.line,borderWidth:hub||topic?0:1,borderType:['pending','stale'].includes(record.status)?'dashed':'solid'},label:{show:hub,position:'inside',formatter:String(countOf(record)),color:'#3a4b31',fontSize:14,fontWeight:750},emphasis:{scale:1.06,label:{show:hub}},blur:{itemStyle:{opacity:1}}};}),
      links:links.map(link=>({...link,value:link.kind==='membership'?(model.records.get(link.target)?.kind==='topic'?10:6):link.kind==='cohesion'?6:0,lineStyle:{color:link.kind==='membership'?'#a6b58c':link.kind==='bundle'?'#b3a064':'#9daa89',width:link.kind==='bundle'?1.5:link.kind==='evidence'?.8:1.1,opacity:link.kind==='cohesion'?0:link.kind==='membership'?.48:link.kind==='bundle'?.34:.15,type:link.kind==='bundle'?'dashed':'solid',curveness:link.kind==='membership'?.07:.13}})),
      emphasis:{focus:'none',lineStyle:{opacity:.75,width:1.2}},blur:{itemStyle:{opacity:1},lineStyle:{opacity:.4}},selectedMode:false}]};
}
export function createSwarm(host,{onSelect,onPositions,onZoom,onStatus,onTooltip}){
  const chart=echarts.init(host,null,{renderer:'canvas'}),named=new WeakSet(),hitAreas=new WeakSet();let model=null,selected=null,gesture=null,dragged=false,disposed=false,fitTimer=0;
  function state(){const series=chart.getModel()?.getSeriesByIndex(0);return {series,data:series?.getData()};}
  function reflect(){
    const {data}=state();if(!data||disposed)return;const points=[];
    for(let index=0;index<data.count();index++){const raw=data.getRawDataItem(index),position=data.getItemLayout(index),graphic=data.getItemGraphicEl(index);if(position){const pixel=graphic?.transformCoordToGlobal(0,0)||chart.convertToPixel({seriesIndex:0},position);points.push({key:raw.id,x:pixel[0],y:pixel[1],kind:raw.kind});}
      if(raw.kind==='source'&&graphic&&!hitAreas.has(graphic)){hitAreas.add(graphic);const hit=new echarts.graphic.Circle({shape:{r:7},style:{fill:'rgba(0,0,0,0)'},cursor:'pointer'});hit.on('mouseover',event=>{const box=host.getBoundingClientRect();onTooltip?.({clientX:box.x+event.offsetX,clientY:box.y+event.offsetY},model.records.get(raw.id));});hit.on('mouseout',()=>onTooltip?.(null,null));hit.on('click',event=>{if(!dragged){event.cancelBubble=true;onSelect(raw.id);}});graphic.add(hit);}
      if(raw.hub&&graphic&&!named.has(graphic)){named.add(graphic);const label=new echarts.graphic.Text({name:'domain-caption',silent:false,cursor:'pointer',style:{text:raw.name,x:0,y:raw.symbolSize/2+8,align:'center',verticalAlign:'top',font:'700 11px "Segoe UI","Microsoft YaHei UI",sans-serif',fill:'#526642',stroke:'#fafaf7',lineWidth:4,paintOrder:'stroke'}});label.on('click',event=>{if(!dragged){event.cancelBubble=true;onSelect(raw.id);}});graphic.add(label);}
    }
    onPositions?.(points);onZoom?.(chart.getOption().series?.[0]?.zoom||1);
  }
  chart.on('rendered',reflect);chart.on('graphroam',reflect);
  chart.on('mouseover',params=>{if(gesture)return;const record=model?.records.get(params.dataType==='node'?params.data.id:params.data.recordKey),event=params.event?.event,box=host.getBoundingClientRect();if(record)onTooltip?.({clientX:event?.clientX??box.left+params.event.offsetX,clientY:event?.clientY??box.top+params.event.offsetY},record);});
  chart.on('mouseout',()=>onTooltip?.(null,null));chart.getZr().on('globalout',()=>onTooltip?.(null,null));
  chart.getZr().on('mousedown',event=>{clearTimeout(fitTimer);gesture=[event.offsetX,event.offsetY];dragged=false;host.style.cursor='grabbing';onTooltip?.(null,null);});
  chart.getZr().on('mousemove',event=>{if(gesture&&Math.hypot(event.offsetX-gesture[0],event.offsetY-gesture[1])>3){dragged=true;onStatus?.('原生力导向：只拖动当前节点，其他点由弹性连线自然响应。');}});
  chart.getZr().on('mouseup',()=>{gesture=null;host.style.cursor='grab';setTimeout(()=>{dragged=false;},0);});
  chart.getZr().on('mousewheel',()=>clearTimeout(fitTimer));
  chart.on('click',params=>{if(dragged)return;const key=params.dataType==='node'?params.data.id:params.data.recordKey;if(key)onSelect(key);});
  const observer=new ResizeObserver(()=>{if(host.clientWidth&&host.clientHeight)chart.resize();});observer.observe(host);
  function fit(){if(disposed||gesture||!host.clientWidth||!host.clientHeight)return;const {data}=state();if(!data)return;const bounds={left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity};for(let index=0;index<data.count();index++){const raw=data.getRawDataItem(index),graphic=data.getItemGraphicEl(index);if(!graphic)continue;const [horizontal,vertical]=graphic.transformCoordToGlobal(0,0),radius=raw.symbolSize/2;bounds.left=Math.min(bounds.left,horizontal-(raw.hub?70:radius+8));bounds.right=Math.max(bounds.right,horizontal+(raw.hub?70:radius+8));bounds.top=Math.min(bounds.top,vertical-radius-12);bounds.bottom=Math.max(bounds.bottom,vertical+radius+(raw.hub?30:12));}const factor=Math.min(1,(host.clientWidth-45)/(bounds.right-bounds.left+28),(host.clientHeight-35)/(bounds.bottom-bounds.top+28)),originX=(bounds.left+bounds.right)/2,originY=(bounds.top+bounds.bottom)/2;if(factor<.97)chart.dispatchAction({type:'graphRoam',seriesId:'swarm',zoom:factor,originX,originY});chart.dispatchAction({type:'graphRoam',seriesId:'swarm',dx:host.clientWidth/2-originX,dy:host.clientHeight/2-originY});}
  return {draw(nextModel,{theme='petal',reset=false}={}){model=nextModel;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,option=forceOption(model,theme);if(reduced){option.series[0].force.layoutAnimation=false;option.animation=false;}chart.setOption(option,{notMerge:true});chart.resize();reflect();clearTimeout(fitTimer);fitTimer=setTimeout(fit,reduced?50:2600);},
    select(key){selected=key;chart.dispatchAction({type:'downplay',seriesIndex:0});const {data}=state();if(data)for(let index=0;index<data.count();index++)if(data.getRawDataItem(index).id===selected)chart.dispatchAction({type:'highlight',seriesIndex:0,dataIndex:index});},
    zoom(factor){const series=chart.getModel()?.getSeriesByIndex(0),box=series?.coordinateSystem?.getViewRect();if(box)chart.dispatchAction({type:'graphRoam',seriesId:'swarm',zoom:factor,originX:box.x+box.width/2,originY:box.y+box.height/2});},
    resize(){chart.resize();},dispose(){disposed=true;clearTimeout(fitTimer);observer.disconnect();chart.dispose();}};
}
