// v18 · 热力圈：每个领域中心一圈、外面再罩一个大圈，越靠近中心越浓；主题周围有小光晕，表示这里收得多。
const NS='http://www.w3.org/2000/svg';
const node=(name,attrs,parent)=>{const e=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));parent?.append(e);return e;};
export function deepen(hex='#a8b878',amount=.34){
 const m=/^#?([0-9a-f]{6})$/i.exec(hex);if(!m)return '#b59a3c';const n=parseInt(m[1],16),c=[n>>16&255,n>>8&255,n&255].map(v=>Math.max(0,Math.round(v*(1-amount))));
 const avg=(c[0]+c[1]+c[2])/3,s=1.35;return '#'+c.map(v=>Math.max(0,Math.min(255,Math.round(avg+(v-avg)*s))).toString(16).padStart(2,'0')).join('');
}
function gradient(svg,id,color,stops){
 let defs=svg.querySelector('defs.heat-defs');if(!defs){defs=node('defs',{class:'heat-defs'});svg.prepend(defs);}
 defs.querySelector('#'+CSS.escape(id))?.remove();
 const g=node('radialGradient',{id,cx:'50%',cy:'50%',r:'50%'},defs);for(const [offset,opacity]of stops)node('stop',{offset,'stop-color':color,'stop-opacity':opacity},g);return id;
}
// plot: <g> whose origin is the domain centre. rx/ry: colony radii; hubSize: domain node size.
export function addDomainHeat(svg,plot,{key,rx,ry,hubSize,color,count=0}){
 const ink=deepen(color),id='heat-'+String(key).replace(/[^a-z0-9_-]/gi,'_'),strong=Math.min(.72,.46+count*.014);
 gradient(svg,id,ink,[['0%',strong],['40%',strong*.6],['75%',strong*.25],['100%',0]]);
 const group=node('g',{class:'domain-heat','pointer-events':'none'});queueMicrotask(()=>plot.append(group));
 node('ellipse',{class:'heat-field',rx:rx*1.02,ry:ry*1.02,fill:`url(#${id})`},group);
 node('ellipse',{class:'heat-outer',rx:rx*.98,ry:ry*.98,stroke:ink},group);
 node('circle',{class:'heat-core',r:hubSize/2+16,stroke:ink},group);
 node('circle',{class:'heat-core heat-core-2',r:hubSize/2+34,stroke:ink},group);
 return group;
}
export function addTopicHeat(svg,plot,{key,rx,ry,color,count=1}){
 const ink=deepen(color,.22),id='heat-t-'+String(key).replace(/[^a-z0-9_-]/gi,'_'),a=Math.min(.5,.2+count*.04);
 gradient(svg,id,ink,[['0%',a],['55%',a*.4],['100%',0]]);
 node('ellipse',{class:'topic-heat',rx:rx*1.08,ry:ry*1.08,fill:`url(#${id})`,'pointer-events':'none'},plot);
}
