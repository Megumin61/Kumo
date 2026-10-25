import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {readFile,mkdir,writeFile,open} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';

const here=path.dirname(fileURLToPath(import.meta.url));
export async function startHelper({libraryRoot,port=43789,configPath=path.join(os.homedir(),'.kumo','bridge-config.json')}={}){
  if(Number(process.versions.node.split('.')[0])<22)throw Error('请先安装 Node.js 22 或更新版本。');
  if(!libraryRoot||!path.isAbsolute(libraryRoot))throw Error('请选择资料文件夹的完整路径，无需选择 AI 软件安装位置。');
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('无效本地端口。');
  const root=path.resolve(libraryRoot),url=`http://127.0.0.1:${port}`;
  const status=async()=>{try{const response=await fetch(url+'/status',{signal:AbortSignal.timeout(1500)});return response.ok?await response.json():null;}catch{return null;}};
  const valid=s=>s?.service==='kumo-local-bridge'&&Number(s.apiVersion)>=7&&path.resolve(s.libraryRoot)===root;
  const existing=await status();
  if(existing){if(!valid(existing))throw Error('此端口已连接其他资料库或不兼容的服务，未更改任何配置。');return {alreadyRunning:true,url,libraryRoot:root};}
  await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',()=>reject(Error('本地端口已被占用，未更改任何配置。')));probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
  let previous;
  try{previous=JSON.parse((await readFile(configPath,'utf8')).replace(/^\uFEFF/,''));}catch(error){if(error.code!=='ENOENT')throw Error('助手配置无法读取，请先检查配置文件；没有覆盖它。');}
  if(previous&&(path.resolve(previous.libraryRoot||'.')!==root||Number(previous.port)!==port))throw Error('已保存另一个资料库配置。请先检查配置文件；没有覆盖它。');
  await mkdir(root,{recursive:true});
  for(const name of ['inbox','archive','domains'])await mkdir(path.join(root,name),{recursive:true});
  await mkdir(path.dirname(configPath),{recursive:true});
  if(!previous)await writeFile(configPath,JSON.stringify({libraryRoot:root,port},null,2),{flag:'wx'});
  const log=await open(path.join(path.dirname(configPath),'bridge.log'),'a');
  const child=spawn(process.execPath,[path.join(here,'server.mjs')],{cwd:here,env:{...process.env,KUMO_LIBRARY_ROOT:root,KUMO_BRIDGE_PORT:String(port)},detached:true,windowsHide:true,stdio:['ignore',log.fd,log.fd]});
  const spawned=await new Promise((resolve,reject)=>{child.once('spawn',()=>resolve(child.pid));child.once('error',reject);});
  child.unref();await log.close();
  for(let i=0;i<30;i++){const current=await status();if(valid(current))return {alreadyRunning:false,pid:spawned,url,libraryRoot:root};await new Promise(r=>setTimeout(r,200));}
  try{child.kill();}catch{}
  throw Error('助手未能启动，请查看配置目录中的 bridge.log。');
}
if(path.resolve(process.argv[1]||'')===fileURLToPath(import.meta.url)){
  try{
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i++){const key={'--library':'libraryRoot','--port':'port','--config':'configPath'}[args[i]];if(!key||!args[i+1])throw Error('用法：node start-helper.mjs --library "资料文件夹完整路径"');options[key]=key==='port'?Number(args[++i]):args[++i];}
    if(!options.libraryRoot){
      try{const saved=JSON.parse(await readFile(path.join(os.homedir(),'.kumo','bridge-config.json'),'utf8'));options.libraryRoot=saved.libraryRoot;options.port=saved.port;}catch{}
      if(!options.libraryRoot){const rl=createInterface({input:process.stdin,output:process.stdout});try{options.libraryRoot=(await rl.question('请粘贴用于保存 Kumo 资料的文件夹完整路径：')).trim().replace(/^"|"$/g,'');}finally{rl.close();}}
    }
    const result=await startHelper(options);
    console.log(`Kumo 已连接：${result.libraryRoot}\n返回扩展，在“保存位置”选择“连接的本地资料库”。\n本地收藏列表：${result.url}/ui/library.html`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}
