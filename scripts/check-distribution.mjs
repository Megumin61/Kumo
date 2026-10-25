import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
async function walk(dir){
  for(const item of await readdir(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist','__pycache__'].includes(item.name))continue;
    const full=path.join(dir,item.name);
    if(item.isDirectory())await walk(full);else files.push(full);
  }
}
await walk(root);
const issues=[];
for(const full of files){
  const rel=path.relative(root,full).replaceAll('\\','/');
  if(/(^|\/)(local-config\.json|bridge-config\.json|organization\.json|metadata\.json|source\.md|conversation[^/]*|\.env(?:\..*)?)$/i.test(rel))issues.push(`Private data/config path: ${rel}`);
  if(!/\.(?:md|json|js|mjs|py|ps1|html|css|txt)$/.test(full))continue;
  const content=await readFile(full,'utf8');
  const secrets=[/gh[pousr]_[A-Za-z0-9]{25,}/,/github_pat_[A-Za-z0-9_]{35,}/,/sk-[A-Za-z0-9_-]{32,}/,/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/];
  if(secrets.some(x=>x.test(content)))issues.push(`Credential pattern: ${rel}`);
  if(/[A-Z]:[\\/]Users[\\/](?!Public(?:[\\/]|$))[^\\/\s"']+[\\/]|[A-Z]:[\\/]CodexData[\\/]|(?:phone|mobile|手机号)\s*[:=]\s*['"]?\+?1[3-9]\d{9}/i.test(content))issues.push(`Private machine/contact reference: ${rel}`);
  if(full.endsWith('.json'))try{JSON.parse(content);}catch{issues.push(`Invalid JSON: ${rel}`);}
  if(/\.(mjs|js)$/.test(full)){
    const result=spawnSync(process.execPath,['--check',full],{encoding:'utf8',windowsHide:true});
    if(result.status!==0)issues.push(`Syntax: ${rel}: ${result.stderr.trim()}`);
    if(full.endsWith('.mjs')){
      for(const match of content.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)){
        try{await stat(path.resolve(path.dirname(full),match[2]));}catch{issues.push(`Missing import in ${rel}: ${match[2]}`);}
      }
    }
  }
}
const plugin=JSON.parse(await readFile(path.join(root,'plugins/kumo/plugin.json'),'utf8'));
const catalog=JSON.parse(await readFile(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
if(plugin.name!=='kumo'||catalog.plugins[0].source.path!=='./plugins/kumo')issues.push('Plugin identity/path mismatch');
const digest=await readFile(path.join(root,'browser-extension/garden/domain-digests.mjs'),'utf8');
if(!digest.includes('Object.freeze({})'))issues.push('Personal preset digest map must remain empty');
console.log(JSON.stringify({files:files.length,issues},null,2));
if(issues.length)process.exitCode=1;
