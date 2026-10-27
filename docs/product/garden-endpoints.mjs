// Public demo adapter. Production renderers and styles are copied unchanged.
export const IN_EXTENSION=false,IN_LOCAL_HELPER=false,IS_SNAPSHOT=true;
export const KNOWLEDGE_URL='./knowledge.json';
export const PANEL_VIEW=new URL(location.href).searchParams.get('panel')==='1';
export function coverURL(id,name){return /^[a-f0-9]{24}$/.test(id)?'sample-cover.svg':null;}
