import http from 'node:http';
import path from 'node:path';
import {readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validCover} from './cover.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.md':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export function readKnowledge(){return new Promise((resolve,reject)=>{const request=http.get({hostname:'127.0.0.1',port:43789,path:'/knowledge'},response=>{let length=0;const chunks=[];response.on('data',chunk=>{length+=chunk.length;if(length>8*1024*1024){request.destroy(Error('响应过大'));return;}chunks.push(chunk);});response.on('error',reject);response.on('end',()=>{try{if(response.statusCode!==200)throw Error('桥接不可用');resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}});});request.on('error',reject);request.setTimeout(12000,()=>request.destroy(Error('读取超时')));});}
export function readCover(id,name){return new Promise((resolve,reject)=>{const outgoing=http.get({hostname:'127.0.0.1',port:43789,path:'/library/items/'+id+'/'+name},incoming=>{let size=0;const chunks=[],type=incoming.headers['content-type']||'';if(incoming.statusCode!==200||!/^image\/(png|jpeg|webp)(?:;|$)/i.test(type)){incoming.resume();reject(Error('无封面'));return;}incoming.on('data',chunk=>{size+=chunk.length;if(size>12*1024*1024)outgoing.destroy(Error('封面过大'));else chunks.push(chunk);});incoming.on('error',reject);incoming.on('end',()=>resolve({bytes:Buffer.concat(chunks),type}));});outgoing.on('error',reject);outgoing.setTimeout(7000,()=>outgoing.destroy(Error('封面超时')));});}
export function createPreviewServer({read=readKnowledge,cover=readCover}={}){return http.createServer(async(request,response)=>{
  response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');
  response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405).end();return;}
  try{const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(pathname==='/api/cover'){const params=new URL(request.url,'http://localhost').searchParams,id=params.get('id'),name=params.get('name');if(!validCover(id,name)){response.writeHead(400).end();return;}try{const result=await cover(id,name);response.writeHead(200,{'Content-Type':result.type,'Content-Length':result.bytes.length,'Cache-Control':'private, max-age=300'}).end(request.method==='HEAD'?undefined:result.bytes);}catch{response.writeHead(404).end();}return;}
    if(pathname==='/api/knowledge'){try{const payload=await read();response.writeHead(200,{'Content-Type':types['.json']}).end(request.method==='HEAD'?undefined:JSON.stringify(payload));}catch{response.writeHead(502,{'Content-Type':types['.json']}).end(JSON.stringify({ok:false}));}return;}
    const target=await realpath(path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname)));if(!target.startsWith(root+path.sep)||!types[path.extname(target)]){response.writeHead(404).end();return;}
    const bytes=await readFile(target);response.writeHead(200,{'Content-Type':types[path.extname(target)],'Content-Length':bytes.length}).end(request.method==='HEAD'?undefined:bytes);
  }catch{response.writeHead(404).end();}
});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))createPreviewServer().listen(Number(process.env.PORT||43822),'127.0.0.1',()=>console.log('Kumo V15 http://127.0.0.1:43822/'));
