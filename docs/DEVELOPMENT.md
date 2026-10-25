# 开发与验证

运行环境：Node.js 22+、npm。打包需要 Python 3.10+ 标准库，无需额外 Python 包。

```sh
git clone https://github.com/Megumin61/Kumo.git
cd Kumo
npm run setup
npm run check
npm test
npm run package
```

`setup` 在 `plugins/kumo/src/mcp` 中执行 `npm ci --ignore-scripts`，依据已提交锁文件安装依赖，不修改全局包。浏览器界面为原生 HTML/CSS/JavaScript，无前端构建步骤。本地助手使用 Node 内置模块并复用 MCP 源码；因此完整仓库运行助手前要执行 setup。

## 源码与运行包

- 浏览器与花园：`browser-extension/`，可直接加载。
- 本地助手：`local-bridge/`，使用与 AI 相同的资料结构。
- MCP 源码：`plugins/kumo/src/mcp/`，可在此运行 `npm start` 或 `npm test`。
- 可分发 MCP：`plugins/kumo/mcp/server.mjs`，已打包依赖。源码修改不会自动改写这个文件。

修改 MCP 后，用 esbuild 等兼容 ESM/Node 的打包器生成运行文件，并保持原有工具注解及第三方声明，再对运行包验证。不要仅改源码就称已更新已打包的插件。媒体脚本需与运行包一起保留。

## 检查与测试

`npm run check` 检查可分发文件、模块引用和私密配置；`npm test` 使用临时合成资料库测试保存、检索、分类、知识编译与越界保护，不连接个人资料库。测试不等于真实浏览器或 ChatGPT 宿主安装验收。

`npm run package` 创建 `dist/` 中的浏览器包、完整本地安装包、独立 AI 插件包及 SHA256SUMS.txt。完整包包含助手与源码，助手仍需 setup；独立 AI 包已内置依赖。

## 贡献

请描述问题、预期行为及验证方式。保持用户原始剪藏与人工分类；连接配置、凭证、用户资料库、聊天档案和 `node_modules` 不得提交。报告安全问题请使用 [安全说明](../SECURITY.md) 中的私密联系方式。
