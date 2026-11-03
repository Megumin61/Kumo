import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
const garden=new URL('../browser-extension/garden/',import.meta.url);
await build({entryPoints:[fileURLToPath(new URL('garden-v12.mjs',garden))],outfile:fileURLToPath(new URL('garden-v12.bundle.mjs',garden)),bundle:true,format:'esm',platform:'browser',target:'chrome120',minify:true,sourcemap:true});
for(const name of ['index.html','garden-v16.html']){const url=new URL(name,garden),html=await fs.readFile(url,'utf8');await fs.writeFile(url,html.replace('src="garden-v12.mjs"','src="garden-v12.bundle.mjs"'));}
console.log('Built browser-extension/garden/garden-v12.bundle.mjs');
