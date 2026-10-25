import {forceData} from './force-data.mjs';
import {prepareSymbols,specimenFor,artLevel} from './art.mjs';
import {countLabel} from './schema.mjs';
import {typeNames} from './model.mjs';
const shorten=(value,n=12)=>Array.from(value).slice(0,n).join('')+(Array.from(value).length>n?'…':'');
export function createForceGarden(host,mode,callbacks){
  const surface=document.createElement('div');surface.className='force-surface';surface.setAttribute('role','img');surface.setAttribute('aria-label',mode==='field'?'可拖动的收藏聚落。每个形状代表真实收藏、主题或领域，可通过搜索及下方目录阅读。':'已有双端依据的材料联系。点击节点读材料，点击线读双方依据。');host.append(surface);
  const labels=document.createElement('div');labels.className='force-labels';host.append(labels);
  const empty=document.createElement('p');empty.className='empty-graph';empty.hidden=true;host.append(empty);
  const chart=echarts.init(surface,null,{renderer:'canvas'});let version=0,model,data,config,selected,signature='',queued=false;
  const labelButtons=new Map();
  function reflect(){queued=false;if(!data)return;const series=chart.getModel().getSeriesByIndex(0);if(!series)return;const seriesData=series.getData(),points=[];
    data.nodes.forEach((node,index)=>{const layout=seriesData.getItemLayout(index);if(!layout)return;const [x,y]=series.coordinateSystem.dataToPoint(layout);points.push({key:node.key,x,y,kind:node.record.kind});const label=labelButtons.get(node.key);if(label){label.style.left=x+'px';label.style.top=(y+node.size/2+9)+'px';label.hidden=x<0||x>host.clientWidth||y<0||y>host.clientHeight;}});callbacks.onPositions?.(points);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(reflect);}}
  chart.on('rendered',schedule);
  chart.on('graphroam',()=>{callbacks.onZoom?.(chart.getOption().series[0].zoom||1);schedule();});
  chart.on('click',event=>{if(event.dataType==='node')callbacks.onSelect?.(event.data.key);else if(event.dataType==='edge'&&event.data.relationKey)callbacks.onSelect?.(event.data.relationKey);});
  chart.on('mouseover',event=>{if(event.dataType!=='node')return;const box=host.getBoundingClientRect(),ev=event.event?.event||{},point=event.event||{};callbacks.onTooltip?.({clientX:ev.clientX??box.x+point.offsetX,clientY:ev.clientY??box.y+point.offsetY},model.records.get(event.data.key));});
  chart.on('mouseout',()=>callbacks.onTooltip?.(null,null));chart.getZr().on('mousedown',()=>callbacks.onTooltip?.(null,null));
  function select(key){selected=key;if(!data)return;chart.dispatchAction({type:'downplay',seriesIndex:0});const index=data.nodes.findIndex(node=>node.key===key);if(index>=0)chart.dispatchAction({type:'highlight',seriesIndex:0,dataIndex:index});else{const edgeIndex=data.edges.findIndex(edge=>edge.key===key);if(edgeIndex>=0){chart.dispatchAction({type:'highlight',seriesIndex:0,dataType:'edge',dataIndex:edgeIndex});for(const end of [data.edges[edgeIndex].from,data.edges[edgeIndex].to])chart.dispatchAction({type:'highlight',seriesIndex:0,dataIndex:data.nodes.findIndex(node=>node.key===end)});}}for(const [id,button]of labelButtons)button.classList.toggle('selected',id===key);}
  async function draw(nextModel,options={}){
    if(model!==nextModel)signature='';model=nextModel;config=options;selected=options.selected;chart.resize();const nextSignature=[model.totals.revision,options.theme,options.relationType,options.showRelations].join('|');
    if(nextSignature===signature&&!options.reset){select(selected);schedule();return;}
    const job=++version;host.setAttribute('aria-busy','true');try{
      const symbols=await prepareSymbols(options.theme);if(job!==version)return;
      const width=host.clientWidth,height=host.clientHeight;data=forceData(model,{...options,mode,width,height});signature=nextSignature;
      empty.hidden=!!data.nodes.length;empty.textContent='这个联系类型下暂无已核实的材料联系。';labels.replaceChildren();labelButtons.clear();
      for(const node of data.nodes)if(mode==='field'&&node.fixed){const button=document.createElement('button');button.textContent=node.record.name;button.addEventListener('click',()=>callbacks.onSelect?.(node.key));labels.append(button);labelButtons.set(node.key,button);}
      const nodes=data.nodes.map(node=>({id:node.key,key:node.key,name:node.record.name,x:node.x,y:node.y,fixed:node.fixed,draggable:true,symbol:symbols[specimenFor(model,node.record)*3+artLevel(node.record)],symbolSize:node.size,
        value:node.record.count||1,label:{show:mode==='converge'||node.record.kind!=='source',formatter:mode==='converge'?shorten(node.record.name,9):countLabel(node.record),position:mode==='converge'?'bottom':'inside',color:'#274b3c',fontSize:mode==='converge'?10:node.record.kind==='domain'?17:13,fontWeight:500},
        emphasis:{label:{show:true,position:'bottom',formatter:shorten(node.record.name),color:'#244335',fontSize:13,backgroundColor:'#fffdf6',padding:[4,6],borderRadius:4}},itemStyle:{opacity:node.record.status==='index_only'?.45:1}}));
      const colors={complements:'#b59657',supports:'#7b9d8a',contradicts:'#b7736b',example:'#8f99ae',prerequisite:'#9a8caa'};
      const edges=data.edges.map(edge=>({source:edge.from,target:edge.to,relationKey:edge.relation?.key,lineStyle:{color:edge.kind==='relation'?colors[edge.relation?.type]||'#b59657':'#a9b79a',width:edge.kind==='relation'?mode==='converge'?2:1.3:1,opacity:edge.kind==='relation'?.8:.47,type:mode==='field'&&edge.kind==='relation'?'dashed':'solid',curveness:edge.kind==='relation'?.12:0},label:{show:false,formatter:edge.relation?typeNames[edge.relation.type]:''},emphasis:{lineStyle:{width:3,opacity:1},label:{show:edge.kind==='relation',fontSize:12,backgroundColor:'#fffdf6',padding:4,color:'#4f5d45'}}}));
      chart.setOption({animationDurationUpdate:350,aria:{enabled:false},tooltip:{show:false},series:[{type:'graph',layout:'force',data:nodes,links:edges,roam:true,draggable:true,labelLayout:{hideOverlap:true},scaleLimit:{min:.35,max:4},zoom:1,force:{repulsion:mode==='field'?[70,180]:150,edgeLength:mode==='field'?[44,91]:[70,110],gravity:mode==='field'?.055:.18,friction:.3,layoutAnimation:!matchMedia('(prefers-reduced-motion: reduce)').matches},emphasis:{focus:'adjacency',blurScope:'series'},blur:{itemStyle:{opacity:.2},lineStyle:{opacity:.08}},edgeSymbol:['none','none'],edgeSymbolSize:5}]},{notMerge:true});
      callbacks.onZoom?.(1);select(selected);schedule();
    }catch(error){signature='';empty.hidden=false;empty.textContent=error.message;callbacks.onStatus?.('节点素材暂时无法加载，可以刷新重试。');}finally{if(job===version)host.setAttribute('aria-busy','false');}
  }
  const observer=new ResizeObserver(()=>{if(host.clientWidth&&host.clientHeight){chart.resize();schedule();}});observer.observe(host);
  return {draw,select,zoom(factor){chart.dispatchAction({type:'graphRoam',seriesIndex:0,zoom:factor,originX:host.clientWidth/2,originY:host.clientHeight/2});callbacks.onZoom?.(chart.getOption().series[0].zoom||1);},dispose(){version++;observer.disconnect();chart.dispose();host.replaceChildren();}};
}




