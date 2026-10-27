import {coverURL} from './garden-endpoints.mjs';
export function coverPath(record){
  const file=[...(record.files?.images||[]),...(record.files?.frames||[]),record.files?.screenshot].find(name=>typeof name==='string'&&/^(?:assets\/|frames\/)?[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(name));
  return /^[a-f0-9]{24}$/.test(record.id||'')&&file?coverURL(record.id,file):null;
}
export function validCover(id,name){return /^[a-f0-9]{24}$/.test(id||'')&&/^(?:assets\/|frames\/)?[a-zA-Z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(name||'');}
