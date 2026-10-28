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
    style.textContent=`
      @keyframes kumo-in{0%{opacity:0;transform:translateY(9px) scale(.94)}70%{opacity:1;transform:translateY(-1px) scale(1.015)}100%{opacity:1;transform:translateY(0) scale(1)}}
      @keyframes kumo-out{to{opacity:0;transform:translateY(4px) scale(.98)}}
      @keyframes kumo-spark{0%{opacity:0;transform:translate(0,3px) scale(.5)}35%{opacity:1;transform:translate(var(--dx),var(--dy)) scale(1)}100%{opacity:0;transform:translate(var(--dx),calc(var(--dy) - 3px)) scale(.7)}}
      .kumo-tip{animation:kumo-in 280ms cubic-bezier(.2,.8,.2,1) both}
      .kumo-tip.kumo-out{animation:kumo-out 200ms ease-in both}
      .kumo-sparks{position:absolute;inset:0;pointer-events:none;overflow:visible}
      .kumo-star{position:absolute;line-height:1;color:#e1b74c;opacity:0;animation:kumo-spark 650ms ease-out var(--delay) both}
      .kumo-star:nth-child(1){left:-4px;top:2px;font-size:12px;--dx:-9px;--dy:-10px;--delay:65ms}
      .kumo-star:nth-child(2){right:3px;top:0;font-size:15px;--dx:10px;--dy:-10px;--delay:120ms}
      .kumo-star:nth-child(3){right:-2px;bottom:4px;font-size:9px;--dx:12px;--dy:6px;--delay:190ms}
      @media (prefers-reduced-motion:reduce){.kumo-tip,.kumo-tip.kumo-out{animation-duration:1ms}.kumo-star{animation:none;opacity:0}}
    `;
    box.className='kumo-tip';
    box.setAttribute('role','status'); box.setAttribute('aria-live','polite');
    const colors={progress:'#4d707e',success:'#58794d',warning:'#907037',error:'#995a4d'};
    box.style.cssText='display:flex;align-items:center;gap:10px;padding:9px 17px 9px 10px;border:1px solid #ffffff70;border-radius:999px;background-color:'+(colors[kind]||colors.success)+';background-clip:padding-box;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fffdf5;box-shadow:0 6px 18px #6b4c9230,0 2px 5px #20351e20;font:600 15px/1.2 system-ui,"Microsoft YaHei",sans-serif;white-space:nowrap;';
    if(pixels?.length===4096){const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.style.cssText='width:32px;height:32px;border-radius:50%;';const ctx=canvas.getContext('2d');ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels),32,32),0,0);box.append(canvas);}
    else {const logo=document.createElement('span');logo.textContent='K';logo.style.cssText='display:grid;place-items:center;width:32px;height:32px;border-radius:50%;background:#e9d76a;color:#405a38;font-weight:800;';box.append(logo);host.__kumoLogo=logo;}
    const text=document.createElement('span');text.textContent=message;box.append(text);shadow.append(style,box);
    if(kind==='success'||kind==='progress'){
      const sparks=document.createElement('div');sparks.className='kumo-sparks';sparks.setAttribute('aria-hidden','true');
      for(let i=0;i<(kind==='success'?3:2);i++){const star=document.createElement('span');star.className='kumo-star';star.textContent='✦';sparks.append(star);}
      shadow.append(sparks);
    }
    (document.body||document.documentElement).append(host);
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
