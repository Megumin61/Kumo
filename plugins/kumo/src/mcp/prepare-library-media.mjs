import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEvidenceLibrary} from './library.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const config=JSON.parse((await readFile(process.env.KUMO_MCP_CONFIG||path.join(here,'local-config.json'),'utf8')).replace(/^\uFEFF/,''));
const root=process.env.KUMO_LIBRARY_ROOT||config.libraryRoot;
const library=await createEvidenceLibrary(root,{allowOrganize:true});
try{
  const rows=[];for(let offset=0;;){const page=await library.list({offset,limit:40});rows.push(...page.items);if(page.nextOffset===null)break;offset=page.nextOffset;}
  const report={startedAt:new Date().toISOString(),total:rows.length,items:[]};
  for(const row of rows){
    try{const result=await library.prepareMedia({id:row.id,transcribe:process.argv.includes('--transcribe'),ocr:process.argv.includes('--ocr'),force:process.argv.includes('--force')});
      const item={id:row.id,title:row.title,status:result.status,fingerprint:result.fingerprint,directory:result.directory,coverage:result.coverage,sheets:result.sheets.length,errors:result.errors,transcripts:result.videos.map(v=>({resource:v.resource,status:v.transcript.status}))};report.items.push(item);console.log(JSON.stringify(item));
    }catch(error){const item={id:row.id,title:row.title,status:'failed',error:error.message};report.items.push(item);console.log(JSON.stringify(item));}
  }
  report.finishedAt=new Date().toISOString();const directory=path.join(root,'derived/media');await mkdir(directory,{recursive:true});await writeFile(path.join(directory,'preparation-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({done:true,total:report.total,prepared:report.items.filter(i=>i.status==='ready').length,failed:report.items.filter(i=>i.status==='failed').length}));
}finally{library.close();}
