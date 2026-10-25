// v16.5 · Where the garden reads its data.
// Inside the Kumo extension it talks to the local bridge directly (host permission
// http://127.0.0.1:43789/*); in the standalone preview it goes through preview-server.mjs.
export const IN_EXTENSION=typeof location!=='undefined'&&location.protocol==='chrome-extension:';
export const IN_LOCAL_HELPER=typeof location!=='undefined'&&['127.0.0.1','localhost'].includes(location.hostname)&&location.pathname.startsWith('/ui/');
const BRIDGE='http://127.0.0.1:43789';
// A shared preview link (no bridge, no preview server) reads a snapshot published next to the page.
export const IS_SNAPSHOT=!IN_EXTENSION&&typeof location!=='undefined'&&!['127.0.0.1','localhost'].includes(location.hostname);
export const KNOWLEDGE_URL=IN_EXTENSION?BRIDGE+'/knowledge':IN_LOCAL_HELPER?'/knowledge':IS_SNAPSHOT?'knowledge.json':'/api/knowledge';
export function coverURL(id,name){if(IS_SNAPSHOT)return null;return IN_LOCAL_HELPER?'/library/items/'+id+'/'+name.split('/').map(encodeURIComponent).join('/'):IN_EXTENSION?BRIDGE+'/library/items/'+id+'/'+name.split('/').map(encodeURIComponent).join('/'):'/api/cover?id='+id+'&name='+encodeURIComponent(name);}

export const PANEL_VIEW=typeof location!=='undefined'&&new URL(location.href).searchParams.get('panel')==='1';
