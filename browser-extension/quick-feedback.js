(function(scope) {
  let cachedLogo=null,loadingLogo=null;
  async function logoPixels() {
    try {
      const url=chrome.runtime.getURL('assets/brand/primary.png');
      let img,canvas;
      if(typeof document==='undefined') {img=await createImageBitmap(await (await fetch(url)).blob());canvas=new OffscreenCanvas(32,32);}
      else {img=new Image();img.src=url;await img.decode();canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;}
      const context=canvas.getContext('2d'); context.drawImage(img,0,0,32,32);
      return Array.from(context.getImageData(0,0,32,32).data);
    } catch { return null; }
  }
  function showInPage(pixels, message, kind='success', token='') {
    document.getElementById('kumo-quick-feedback')?.remove();
    const host=document.createElement('div'); host.id='kumo-quick-feedback';
    host.dataset.kumoToken=token;
    host.style.cssText='all:initial;position:fixed;z-index:2147483647;left:50%;bottom:9%;transform:translateX(-50%);pointer-events:none;';
    const shadow=host.attachShadow({mode:'closed'}), box=document.createElement('div');
    const style=document.createElement('style');
    style.textContent='@keyframes kumo-in{0%{opacity:0;transform:translateY(9px) scale(.94)}70%{opacity:1;transform:translateY(-1px) scale(1.015)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes kumo-out{to{opacity:0;transform:translateY(4px) scale(.98)}}.kumo-tip{animation:kumo-in 280ms cubic-bezier(.2,.8,.2,1) both}.kumo-tip.kumo-out{animation:kumo-out 200ms ease-in both}@media (prefers-reduced-motion:reduce){.kumo-tip,.kumo-tip.kumo-out{animation-duration:1ms}}';
    box.className='kumo-tip';
    box.setAttribute('role','status'); box.setAttribute('aria-live','polite');
    const colors={progress:'#4c6572',success:'#506f46',warning:'#8c6c34',error:'#985648'};
    box.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 18px 10px 11px;border-radius:999px;background:'+(colors[kind]||colors.success)+';color:#fffdf5;box-shadow:0 6px 24px #1b2b2140;font:600 15px/1.2 system-ui,"Microsoft YaHei",sans-serif;white-space:nowrap;';
    if(pixels?.length===4096){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.style.cssText='width:32px;height:32px;border-radius:50%;';const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels),32,32),0,0);box.append(canvas);}
    else {const logo=document.createElement('span');logo.textContent='K';logo.style.cssText='display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#e9d76a;color:#405a38;font-weight:800;';box.append(logo);host.__kumoLogo=logo;}
    const text=document.createElement('span');text.textContent=message;box.append(text);shadow.append(style,box);(document.body||document.documentElement).append(host);
    setTimeout(()=>{box.classList.add('kumo-out');setTimeout(()=>host.remove(),200);},kind==='progress'?3000:kind==='success'?1800:4500);
  }
  function upgradeLogo(pixels,token){
    const host=document.getElementById('kumo-quick-feedback');
    if(host?.dataset.kumoToken!==token||!host.__kumoLogo||pixels?.length!==4096)return;
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.style.cssText='width:32px;height:32px;border-radius:50%;';canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),32,32),0,0);host.__kumoLogo.replaceWith(canvas);delete host.__kumoLogo;
  }
  async function show(tabId, message='收藏完成', kind='success') {
    if(scope.KumoQuickWorker)return scope.KumoQuickWorker.tip(tabId,message,kind);
    const token=crypto.randomUUID(),pixels=cachedLogo;
    await chrome.scripting.executeScript({target:{tabId},func:showInPage,args:[pixels,message,kind,token]});
    if(!pixels){
      loadingLogo??=logoPixels().then(value=>(cachedLogo=value)).finally(()=>{loadingLogo=null;});
      void loadingLogo.then(value=>value&&chrome.scripting.executeScript({target:{tabId},func:upgradeLogo,args:[value,token]})).catch(()=>{});
    }
  }
  scope.KumoQuickFeedback={show,showInPage};
})(globalThis);
