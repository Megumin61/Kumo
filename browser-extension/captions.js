(function(scope){
 const stamp=value=>{const ms=Math.max(0,Math.round(value*1000));return String(Math.floor(ms/3600000)).padStart(2,'0')+':'+String(Math.floor(ms/60000)%60).padStart(2,'0')+':'+String(Math.floor(ms/1000)%60).padStart(2,'0')+'.'+String(ms%1000).padStart(3,'0');};
 function files(tracks){return (tracks||[]).slice(0,8).filter(t=>t.cues?.length).map((track,index)=>({name:'assets/captions-'+String(index+1).padStart(2,'0')+'.vtt',type:'text/vtt;charset=utf-8',content:'WEBVTT\n\n'+track.cues.slice(0,2000).filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.end>=c.start).map(c=>stamp(c.start)+' --> '+stamp(c.end)+'\n'+String(c.text||'').replaceAll('-->','→').slice(0,3000)).join('\n\n')+'\n'}));}
 scope.KumoCaptions={files};if(typeof module==='object')module.exports=scope.KumoCaptions;
})(globalThis);
