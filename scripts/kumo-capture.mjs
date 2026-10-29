import {readFile,mkdir,writeFile,appendFile} from 'node:fs/promises';
import path from 'node:path';
import {callBridge,extractionScript,saveSnapshot} from './kumo-sdk.mjs';

const help=`Kumo automation (Node.js 22+)
  node scripts/kumo-capture.mjs status
  node scripts/kumo-capture.mjs tags
  node scripts/kumo-capture.mjs tag-create --label "自媒体参考"
  node scripts/kumo-capture.mjs extract-script --output capture-page.js
  node scripts/kumo-capture.mjs save --input snapshot.json --tag "自媒体参考"
  node scripts/kumo-capture.mjs batch --input snapshots.jsonl --tag "自媒体参考" --report results.jsonl

save/batch accept Kumo page snapshots, not a list of URLs or titles.
Options: --bridge http://127.0.0.1:43789 --note "..." --no-images --video
Exit codes: 0 saved/duplicate/read-only success, 1 error, 2 partial media.
Images are requested by default. Video requires --video; blob/HLS stays partial.
Read docs/AUTOMATION.md for browser-tool and temporary page-button integration.
`;
async function main(){
  const args=process.argv.slice(2),command=args.shift()||'help',options={};
  const valued=new Set(['input','output','tag','label','note','bridge','report']),flags=new Set(['no-images','video']);
  for(let i=0;i<args.length;i++){const key=args[i].replace(/^--/,'');if(!args[i].startsWith('--'))throw Error('Unexpected argument: '+args[i]);if(flags.has(key))options[key]=true;else if(valued.has(key)&&args[i+1]&&!args[i+1].startsWith('--'))options[key]=args[++i];else throw Error('Unknown or incomplete option: '+args[i]);}
  if(command==='help'){process.stdout.write(help);return;}
  const bridge=options.bridge;
  if(command==='status'){const value=await callBridge('/status',{bridge,timeout:5000});console.log(JSON.stringify(value,null,2));if(!value.capabilities?.includes('page_capture'))throw Error('Update/restart the local bridge before capture');return;}
  if(command==='tags'){const value=await callBridge('/tags',{bridge,timeout:10000});console.log(JSON.stringify({tags:value.tags.filter(tag=>!tag.hidden).map(({id,label,count})=>({id,label,count}))},null,2));return;}
  if(command==='tag-create'){if(!options.label)throw Error('--label is required');console.log(JSON.stringify(await callBridge('/tags',{bridge,body:{action:'add',label:options.label}})));return;}
  if(command==='extract-script'){const script=await extractionScript();if(options.output){const file=path.resolve(options.output);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,script,{encoding:'utf8',flag:'wx'});console.log(JSON.stringify({output:file}));}else process.stdout.write(script);return;}
  if(!['save','batch'].includes(command))throw Error('Unknown command: '+command);
  if(!options.input)throw Error('--input is required');
  let inputText='';
  if(options.input==='-'){process.stdin.setEncoding('utf8');for await(const chunk of process.stdin)inputText+=chunk;}
  else inputText=await readFile(path.resolve(options.input),'utf8');
  const text=inputText.replace(/^\uFEFF/,'');
  const inputs=command==='batch'?text.split(/\r?\n/).filter(line=>line.trim()).map(line=>JSON.parse(line)):[JSON.parse(text)];
  const status=await callBridge('/status',{bridge,timeout:5000});if(!status.capabilities?.includes('page_capture'))throw Error('Bridge does not support page_capture; restart the updated local bridge');
  const report=options.report?path.resolve(options.report):null;
  if(report){await mkdir(path.dirname(report),{recursive:true});await writeFile(report,'',{flag:'wx'});}
  let failure=false,partial=false;const totals={saved:0,duplicate:0,partial:0,failed:0};
  for(let i=0;i<inputs.length;i++){
    let result;
    try{const value=inputs[i];result={index:i+1,...await saveSnapshot(value,{bridge,tag:options.tag??value.tag??'',note:options.note??value.note??'',images:!options['no-images'],video:Boolean(options.video)})};totals[result.status]++;partial ||= result.status==='partial';}
    catch(error){failure=true;totals.failed++;result={index:i+1,status:'failed',error:error.message};}
    const line=JSON.stringify(result)+'\n';process.stdout.write(line);if(report)await appendFile(report,line,'utf8');
  }
  if(command==='batch')console.log(JSON.stringify({summary:totals,total:inputs.length}));
  process.exitCode=failure?1:partial?2:0;
}
main().catch(error=>{console.error(JSON.stringify({status:'failed',error:error.message}));process.exitCode=1;});
