import {hashSeed} from './garden-life.mjs';
const kinds=['terrace','frond','petal','leaf','archipelago','fan'];
const named={'interface-design':'terrace','agent-tooling':'frond','ai-animation':'petal','career-development':'terrace','consumer-products':'leaf','ai-game-prototyping':'archipelago','industry-observations':'fan'};
const names={terrace:'等高花圃',frond:'羽叶边界',petal:'花瓣地貌',leaf:'叶片小岛',archipelago:'群岛轮廓',fan:'扇叶纹理',seed:'种子圃'};
export function regionIdentity(key){if(typeof key!=='string'||!(/^domain:/.test(key)||['pending','unassigned'].includes(key)))return null;const id=key.replace(/^domain:/,''),kind=['pending','unassigned'].includes(key)?'seed':named[id]||kinds[Math.floor(hashSeed(key+':terrain')*kinds.length)];return {kind,name:names[kind],phase:hashSeed(key+':terrain-phase')*Math.PI*2};}
export function regionWave(identity,a,t){if(!identity)return 0;const p=identity.phase+t*.025;return ({terrace:.04*Math.cos(4*a+p)+.025*Math.sin(2*a),frond:.035*Math.cos(5*a+p)+.035*Math.sin(2*a),petal:.075*Math.cos(3*a+p),leaf:.075*Math.cos(a+p)+.03*Math.sin(2*a+p),archipelago:.06*Math.sin(3*a+p)+.035*Math.cos(5*a-p),fan:.055*Math.cos(2*a+p)+.04*Math.sin(3*a-p),seed:.018*Math.sin(2*a+p)})[identity.kind];}
export function signaturePaths(identity,rx,ry){if(!identity)return [];const arc=(scale,start,span)=>Array.from({length:29},(_,i)=>{const a=start+span*i/28,r=1+regionWave(identity,a,0);return (i?'L ':'M ')+(Math.cos(a)*rx*scale*r).toFixed(2)+' '+(Math.sin(a)*ry*scale*r).toFixed(2);}).join(' ');
 if(identity.kind==='terrace')return [.86,.92].map((s,i)=>arc(s,identity.phase+.3,1.15+i*.15));
 if(identity.kind==='frond'||identity.kind==='fan'){let d='';for(let i=0;i<13;i++){const a=identity.phase+i*.075;const x=Math.cos(a)*rx*.98,y=Math.sin(a)*ry*.98;d+='M '+x.toFixed(2)+' '+y.toFixed(2)+' l '+(Math.cos(a+.7)*8).toFixed(2)+' '+(Math.sin(a+.7)*8).toFixed(2)+' ';}return [d];}
 if(identity.kind==='seed')return [arc(.94,identity.phase,1.8)];
 return [arc(.91,identity.phase+.5,.6),arc(.95,identity.phase+3.2,.45)];
}
