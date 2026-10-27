import {readFile,writeFile,mkdir,readdir,copyFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
// Kept in scripts/sync-site-demo.mjs in the public repository.
const root=process.argv[2]||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'browser-extension/garden'),dest=path.join(root,'docs/product');
await mkdir(dest,{recursive:true});
const entries=await readdir(source,{withFileTypes:true}),identical=[];
// Copy production UI verbatim. Only the host/data adapter and HTML wrapper differ.
for(const item of entries){if(!item.isFile()||!/^.+\.(mjs|css)$/.test(item.name)||item.name==='preview-server.mjs')continue;
 await copyFile(path.join(source,item.name),path.join(dest,item.name));
 if(item.name!=='garden-endpoints.mjs')identical.push({file:item.name,sha256:createHash('sha256').update(await readFile(path.join(source,item.name))).digest('hex')});
}
for(const name of ['brand-release','garden-props-v2','garden-styles-v1','landmarks-v12','platforms','reference-locked-v6'])await cp(path.join(source,'assets',name),path.join(dest,'assets',name),{recursive:true});
await copyFile(path.join(source,'assets/kumo-brand-original.png'),path.join(dest,'assets/kumo-brand-original.png'));
await writeFile(path.join(dest,'garden-endpoints.mjs'),`// Public demo adapter. Production renderers and styles are copied unchanged.
export const IN_EXTENSION=false,IN_LOCAL_HELPER=false,IS_SNAPSHOT=true;
export const KNOWLEDGE_URL='./knowledge.json';
export const PANEL_VIEW=new URL(location.href).searchParams.get('panel')==='1';
export function coverURL(id,name){return /^[a-f0-9]{24}$/.test(id)?'sample-cover.svg':null;}
`);
const original=await readFile(path.join(source,'garden-v16.html'),'utf8');
const policy=`<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'">`;
const html=original.replace('<title>Kumo · 知识花园</title>','<title>Kumo · 产品交互体验（示例资料）</title>'+policy).replace('</head>','<link rel="stylesheet" href="demo-host.css"></head>').replace('<script type="module" src="garden-v12.mjs"></script>','<script type="module" src="demo-host.mjs"></script><script type="module" src="garden-v12.mjs"></script>');
for(const name of ['index.html','garden-v16.html'])await writeFile(path.join(dest,name),html);
const fixture=JSON.parse(await readFile(path.join(root,'docs/demo-content.json'),'utf8'));
const sources=[],nodes=[],cards=[];
let count=0;
for(const [di,d]of fixture.entries()){
 const domainId='demo-domain-'+di;nodes.push({id:domainId,kind:'domain',name:d.name,summary:d.intro,keywords:d.tags,knowledge:{takeaways:[d.intro],methods:['先保留出处，再结合具体任务阅读与归纳。']}});
 for(const [ti,title]of d.topics.entries()){
  const topicId='demo-topic-'+di+'-'+ti;nodes.push({id:topicId,domainId,kind:'topic',name:title,summary:'围绕「'+title+'」留下的练习、观察和方法。这是一组虚构的产品体验资料。',keywords:d.tags});
  for(const [pi,post]of d.titles[ti].entries()){
   const id=(++count).toString(16).padStart(24,'0');
   const content='这是一份为 Kumo 官网编写的示例资料。\n\n'+d.intro+'\n\n这次留下的主题是「'+title+'」。阅读时，先记录内容解决的问题，再区分原作者的观点和自己的观察，最后保留下一次可以使用它的场景。\n\n个人笔记：下一次做相关任务时，回到这份材料，核对背景和适用条件，再决定是否采用。';
   sources.push({id,title:post,platform:di===1?'github':di===3?'bilibili':'web',author:'Kumo 示例作者',capturedAt:'2026-10-'+String(25-(count%12)).padStart(2,'0')+'T10:00:00Z',tags:d.tags,url:'sample.html?id='+id,excerpt:d.intro,content,files:{images:['sample.png']}});
   cards.push({id,domainIds:[domainId],topicIds:[topicId],summary:post+'。'+d.intro+' 这是官网体验用的虚构内容，不是对第三方原文的摘要。',keywords:d.tags,evidenceStatus:'verified',reuseWhen:['需要研究「'+title+'」时，回看这份示例的结构。'],evidence:[{quote:'先记录内容解决的问题，再区分原作者的观点和自己的观察。',view:'text'}],limitations:['仅供体验产品交互，不作为实际研究结论。']});
  }
 }
}
for(const title of ['刚收下的一张灵感卡','还没归类的项目线索','等有空再读的学习笔记']){const id=(++count).toString(16).padStart(24,'0');sources.push({id,title,platform:'web',author:'Kumo 示例作者',capturedAt:'2026-10-26T08:00:00Z',tags:['待整理'],excerpt:'已收藏，等待整理。这是虚构示例。',content:'这份示例还没有编译卡，因此在独立的待编译圈中呈现。',url:'sample.html?id='+id,files:{images:['sample.png']}});}
await writeFile(path.join(dest,'knowledge.json'),JSON.stringify({demo:true,total:sources.length,revision:'public-demo-v2',sources,nodes,cards,relations:[]},null,2)+'\n');
await writeFile(path.join(dest,'source-manifest.json'),JSON.stringify({description:'Production files copied byte for byte; endpoint adapter and demo host are the only integration layer.',source:'browser-extension/garden',files:identical},null,2)+'\n');
console.log(JSON.stringify({copiedProductionFiles:identical.length,sources:sources.length,domains:fixture.length,topics:nodes.filter(n=>n.kind==='topic').length}));
