// v16.5 · Where the garden reads its data.
// The extension reads its authorized directory. Standalone previews can still load a snapshot.
export const IN_EXTENSION=typeof location!=='undefined'&&location.protocol==='chrome-extension:';
export const IN_LOCAL_HELPER=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)&&location.pathname.startsWith('/ui/');
const BRIDGE='';
// A shared preview link (no bridge, no preview server) reads a snapshot published next to the page.
export const IS_SNAPSHOT=!IN_EXTENSION&&typeof location!=='undefined'&&!['127.0.0.1','localhost'].includes(location.hostname);
export const KNOWLEDGE_URL=IN_EXTENSION?null:IN_LOCAL_HELPER?'/knowledge':IS_SNAPSHOT?'knowledge.json':'/api/knowledge';
export function coverURL(id,name){if(IS_SNAPSHOT)return null;return IN_LOCAL_HELPER?'/library/items/'+id+'/'+name.split('/').map(encodeURIComponent).join('/'):IN_EXTENSION?globalThis.KumoBridge.asset(id,name):'/api/cover?id='+id+'&name='+encodeURIComponent(name);}

export const PANEL_VIEW=typeof location!=='undefined'&&(new URL(location.href).searchParams.get('panel')==='1'||new URL(location.href).searchParams.get('map')==='1');

export async function readKnowledge(options={}){if(IN_EXTENSION){return globalThis.KumoBridge.knowledge();}const response=await fetch(KNOWLEDGE_URL,options);if(!response.ok)throw Error("knowledge_unavailable");return response.json();}
