export function selectStyleCard(key,{host,reader,viewport,onTheme,onDraw}){
 const top=reader.scrollTop,page=viewport.scrollY;
 onTheme(key,true);onDraw();
 for(const card of host.querySelectorAll('.garden-style-card')){
  const active=card.dataset.style===key;card.classList.toggle('selected',active);card.setAttribute('aria-pressed',String(active));card.querySelector('.style-check')?.remove();
  if(active){const mark=host.ownerDocument.createElement('i');mark.className='style-check';mark.textContent='✓';card.append(mark);}
 }
 reader.scrollTop=top;viewport.scrollTo({top:page,behavior:'instant'});
}
