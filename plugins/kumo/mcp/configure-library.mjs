import {createRequire as __kumoCreateRequire} from 'node:module';const require=__kumoCreateRequire(import.meta.url);

// ../../../kumo-ai-plugin-0.13.3-src/mcp/configure-library.mjs
import { mkdir, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
async function configure({ root, configPath = path.join(os.homedir(), ".kumo", "config.json"), allowOrganize = false }) {
  if (!root || !path.isAbsolute(root)) throw Error("\u8BF7\u9009\u62E9\u8D44\u6599\u5E93\u7684\u5B8C\u6574\u8DEF\u5F84\uFF0C\u4E0D\u662F\u8F6F\u4EF6\u5B89\u88C5\u76EE\u5F55");
  const libraryRoot = await realpath(root);
  for (const name of ["inbox", "archive", "domains"]) if (!(await stat(path.join(libraryRoot, name))).isDirectory()) throw Error("\u8BE5\u76EE\u5F55\u4E0D\u662F Kumo \u8D44\u6599\u5E93\uFF0C\u8BF7\u5148\u901A\u8FC7\u6D4F\u89C8\u5668\u6269\u5C55\u4FDD\u5B58\u4E00\u6761\u7F51\u9875");
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify({ libraryRoot, allowOrganize: allowOrganize === true }, null, 2) + "\n", { flag: "wx" });
  return { saved: true, libraryRoot, canCompile: allowOrganize === true, restartRequired: true };
}
async function main() {
  const args = process.argv.slice(2), index = args.indexOf("--library"), configIndex = args.indexOf("--config");
  if (index < 0 || !args[index + 1]) throw Error("\u7528\u6CD5\uFF1Anode configure-library.mjs --library \u8D44\u6599\u5E93\u5B8C\u6574\u8DEF\u5F84 [--organize]");
  console.log(JSON.stringify(await configure({ root: args[index + 1], ...configIndex >= 0 ? { configPath: args[configIndex + 1] } : {}, allowOrganize: args.includes("--organize") })));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  console.error(error.code === "EEXIST" ? "\u5DF2\u6709\u8FDE\u63A5\u914D\u7F6E\uFF0C\u672A\u8986\u76D6\u3002\u8BF7\u6838\u5BF9\u73B0\u6709\u8D44\u6599\u5E93\u540E\u518D\u4FEE\u6539\u3002" : error.message);
  process.exitCode = 1;
});
export {
  configure
};
