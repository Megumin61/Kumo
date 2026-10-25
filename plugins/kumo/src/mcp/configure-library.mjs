import {mkdir,realpath,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';

export async function configure({root,configPath=path.join(os.homedir(),'.kumo','config.json'),allowOrganize=false}){
  if(!root||!path.isAbsolute(root))throw Error('请选择资料库的完整路径，不是软件安装目录');
  const libraryRoot=await realpath(root);
  for(const name of ['inbox','archive','domains'])if(!(await stat(path.join(libraryRoot,name))).isDirectory())throw Error('该目录不是 Kumo 资料库，请先通过浏览器扩展保存一条网页');
  await mkdir(path.dirname(configPath),{recursive:true});
  await writeFile(configPath,JSON.stringify({libraryRoot,allowOrganize:allowOrganize===true},null,2)+'\n',{flag:'wx'});
  return {saved:true,libraryRoot,canCompile:allowOrganize===true,restartRequired:true};
}
async function main(){const args=process.argv.slice(2),index=args.indexOf('--library'),configIndex=args.indexOf('--config');if(index<0||!args[index+1])throw Error('用法：node configure-library.mjs --library 资料库完整路径 [--organize]');console.log(JSON.stringify(await configure({root:args[index+1],...(configIndex>=0?{configPath:args[configIndex+1]}:{}),allowOrganize:args.includes('--organize')})));}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.code==='EEXIST'?'已有连接配置，未覆盖。请核对现有资料库后再修改。':error.message);process.exitCode=1;});
