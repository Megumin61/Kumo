// v19 · 领域的"大圈"只留一个：花瓣波浪边 + 沿边长出的小叶子。不再有圈中圈。
const NS='http://www.w3.org/2000/svg';
const node=(name,attrs,parent)=>{const e=document.createElementNS(NS,name);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));parent?.append(e);return e;};
const rnd=(seed,i)=>{let h=2166136261;for(const ch of seed+':'+i){h^=ch.codePointAt(0);h=Math.imul(h,16777619);}return (h>>>0)/4294967295;};
function deepen(hex='#a8b878',amount=.3){const m=/^#?([0-9a-f]{6})$/i.exec(hex);if(!m)return '#7d9a62';const n=parseInt(m[1],16);return '#'+[n>>16&255,n>>8&255,n&255].map(v=>Math.round(v*(1-amount)).toString(16).padStart(2,'0')).join('');}
export function addDomainFlair(plot,{key,rx,ry,color,tilt=0}){
 const ink=deepen(color,.34),group=node('g',{class:'domain-flair','pointer-events':'none',transform:`rotate(${tilt})`}),N=Math.max(14,Math.round((rx+ry)/26)),R=(a,k)=>[Math.cos(a)*rx*k,Math.sin(a)*ry*k];
 let d='';for(let i=0;i<N;i++){const a0=i/N*Math.PI*2,a1=(i+1)/N*Math.PI*2,mid=(a0+a1)/2,bump=1.045+rnd(key,i)*.035,[x0,y0]=R(a0,.985),[x1,y1]=R(a1,.985),[cx,cy]=R(mid,bump);d+=(i?'':`M ${x0.toFixed(1)} ${y0.toFixed(1)} `)+`Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} `;}
 node('path',{class:'flair-edge',d:d+'Z',stroke:ink},group);
 const leaves=Math.max(6,Math.round(N/2));
 for(let i=0;i<leaves;i++){const a=(i+rnd(key,'l'+i)*.7)/leaves*Math.PI*2,[x,y]=R(a,1.045),deg=a*180/Math.PI,s=.8+rnd(key,'s'+i)*.7;
  const leaf=node('g',{class:'flair-leaf',transform:`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg+90).toFixed(0)}) scale(${s.toFixed(2)})`},group);
  node('path',{d:'M0 0 C -6 -7 -3 -17 0 -21 C 3 -17 6 -7 0 0 Z',fill:i%3===0?'#c9d98f':'#9dbb78',stroke:ink},leaf);node('path',{d:'M0 -2 L0 -16',stroke:ink,fill:'none'},leaf);}
 plot.append(group);return group;
}
