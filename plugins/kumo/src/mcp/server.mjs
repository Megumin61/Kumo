import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createEvidenceLibrary} from './library.mjs';
import {createKumoMcp} from './tools.mjs';
import {tokenAuth,oauthAuth} from './auth.mjs';
import {loadConfiguration,createUnconfiguredMcp,addConnectionStatus} from './connection.mjs';

export async function createHttpServer(library,{token,oauth,allowOrganize=false,port=43790}={}){
  const authenticate=oauth?oauthAuth(oauth):tokenAuth(token),clients=new Set();
  const server=http.createServer(async(req,res)=>{
    const host=String(req.headers.host||'');
    const allowed=['127.0.0.1:'+server.address()?.port,'localhost:'+server.address()?.port,...(oauth?[new URL(oauth.resource).host]:[])];
    if(!allowed.includes(host)){res.writeHead(403);res.end('Host not allowed');return;}
    if(req.headers.origin&&!['http://'+host,...(oauth?[new URL(oauth.resource).origin]:[])].includes(req.headers.origin)){res.writeHead(403);res.end('Origin not allowed');return;}
    if(req.url==='/.well-known/oauth-protected-resource'&&oauth){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({resource:oauth.resource,authorization_servers:[oauth.issuer],scopes_supported:['kumo:read',...(allowOrganize?['kumo:organize']:[])]}));return;}
    if(req.url!=='/mcp'){res.writeHead(404);res.end();return;}
    let identity;
    try{identity=await authenticate(req.headers.authorization);}catch{res.writeHead(401,{'WWW-Authenticate':oauth?'Bearer resource_metadata="'+new URL('/.well-known/oauth-protected-resource',oauth.resource).href+'", scope="kumo:read"':'Bearer realm="Kumo local testing"'});res.end('Unauthorized');return;}
    if(req.method!=='POST'){res.writeHead(405,{Allow:'POST'});res.end();return;}
    let size=0;req.on('data',chunk=>{size+=chunk.length;if(size>512*1024)req.destroy();});
    const mcp=createKumoMcp(library,{canWrite:allowOrganize&&identity.canWrite}),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    clients.add(mcp);res.on('close',()=>{void transport.close();void mcp.close();clients.delete(mcp);});
    try{await mcp.connect(transport);await transport.handleRequest(req,res);}catch{if(!res.headersSent){res.writeHead(500);res.end('MCP request failed');}}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  const stop=server.close.bind(server);server.close=callback=>{for(const client of clients)void client.close();return stop(callback);};
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  return server;
}
async function main(){
  const settings=await loadConfiguration(),{root,allowOrganize}=settings,config=settings.config||{};
  let library;
  try{if(settings.error)throw Error(settings.error);library=await createEvidenceLibrary(root,{allowOrganize,bridgeUrl:config.bridgeUrl||'http://127.0.0.1:43789'});}
  catch(error){
    if(process.argv.includes('--http'))throw error;
    const server=createUnconfiguredMcp(settings.error||(root?'invalid_library':'not_configured'));
    process.stdin.once('end',()=>{void server.close();process.stdin.destroy();});
    await server.connect(new StdioServerTransport());return;
  }
  if(process.argv.includes('--http')){
    const server=await createHttpServer(library,{token:process.env.KUMO_MCP_TOKEN,oauth:config.oauth,allowOrganize,port:Number(process.env.KUMO_MCP_PORT||config.port||43790)});
    console.error('Kumo MCP 已启动，仅监听本机 /mcp；未发布到 ChatGPT。');
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
  }else{
    const server=addConnectionStatus(createKumoMcp(library,{canWrite:allowOrganize}),{connected:true,root,allowOrganize});
    process.stdin.once('end',()=>{library.close();void server.close();process.stdin.destroy();});
    await server.connect(new StdioServerTransport());
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Kumo 启动失败：请检查知识库路径、目录结构及连接配置。');process.exitCode=1;});
