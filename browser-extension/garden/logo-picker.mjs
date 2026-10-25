import {centreLogo,logoVariants,setCentreLogo} from './appearance-remix.mjs';
export function mountLogoPicker(host,{storage=globalThis.localStorage,onChange=()=>{}}={}){
 if(!host)return {sync(){}};
 const doc=host.ownerDocument,label=doc.createElement('label'),select=doc.createElement('select'),caption=doc.createElement('span');label.className='quick-logo-picker';caption.textContent='Logo';select.setAttribute('aria-label','切换知识花园和收藏聚落的中心 Logo');
 for(const v of logoVariants){const option=doc.createElement('option');option.value=v.id;option.textContent=v.name;select.append(option);}
 const sync=()=>{select.value=centreLogo(storage).id;};select.onchange=()=>{if(!setCentreLogo(select.value,storage)){sync();return;}sync();onChange();};label.append(caption,select);host.append(label);sync();return {sync,select};
}
