import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export async function loadConfiguration({env=process.env,home=os.homedir(),packageDir=import.meta.dirname}={}){
  const candidates=env.KUMO_MCP_CONFIG?[env.KUMO_MCP_CONFIG]:[path.join(home,'.kumo','config.json'),path.join(packageDir,'local-config.json')];
  let config={},configPath=null;
  for(const candidate of candidates){
    try{config=JSON.parse((await readFile(candidate,'utf8')).replace(/^\uFEFF/,''));configPath=candidate;break;}
    catch(error){if(error.code==='ENOENT')continue;return {error:'invalid_config',root:null,allowOrganize:false};}
  }
  if(env.KUMO_ALLOW_ORGANIZE!==undefined&&!['true','false'].includes(env.KUMO_ALLOW_ORGANIZE))return {error:'invalid_permission',root:null,allowOrganize:false};
  if(!config||typeof config!=='object'||Array.isArray(config))return {error:'invalid_config',root:null,allowOrganize:false};
  return {config,configPath,root:env.KUMO_LIBRARY_ROOT||config.libraryRoot,allowOrganize:env.KUMO_ALLOW_ORGANIZE===undefined?config.allowOrganize===true:env.KUMO_ALLOW_ORGANIZE==='true'};
}
export function addConnectionStatus(server,{connected=false,reason='not_configured',root,allowOrganize=false}={}){
  server.registerTool('connection_status',{description:'Check whether this local Kumo plugin is connected before reading or organizing. When not configured, ask for the user-selected library folder; never guess an app installation directory or expose the library online.',inputSchema:{},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async()=>{
    const value={connected,state:connected?'connected':reason,canRead:connected,canCompile:connected&&allowOrganize,environment:'local',cloudConnection:false,...(connected?{libraryRoot:root}:{}),nextStep:connected?'读取 wiki_map 确认资料数量；整理前确认范围。':'请提供在浏览器扩展中选择的资料文件夹。连接插件后重启 MCP 或新开对话；不需要软件安装目录。'};
    return {structuredContent:value,content:[{type:'text',text:JSON.stringify(value)}]};
  });
  return server;
}
export function createUnconfiguredMcp(reason){return addConnectionStatus(new McpServer({name:'kumo',version:'0.13.3'},{instructions:'Kumo is not connected. Use connection_status to explain setup. Do not claim the library is empty, read arbitrary personal folders, organize material, change permissions or publish endpoints.'}),{reason});}
