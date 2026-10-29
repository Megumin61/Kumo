# Kumo 本地助手

版本 0.16.2 / API v7。连接浏览器剪藏与用户选择的资料文件夹，提供收藏列表和知识花园。

需要 Node.js 22+。从仓库根目录执行 `npm run setup`，再执行 `npm run helper -- --library "资料文件夹完整路径"`。配置保存在用户主目录 `.kumo/bridge-config.json`，不进入仓库。默认地址为 `http://127.0.0.1:43789`。

已有配置与目标不一致、端口冲突或版本不兼容时提示检查，不覆盖旧配置，也不自动结束其他服务。重启电脑后重新启动助手。

Windows 可使用本目录 `configure-and-start.ps1`。完整步骤及能力边界见 [安装指南](../docs/INSTALL.md)。助手复用 `../plugins/kumo/src/mcp/` 源码，发布时需保留相对位置并安装依赖。

自动化采集入口见 [脚手架说明](../docs/AUTOMATION.md)：CLI、已有浏览器 Page 的 SDK 和临时页面按钮均可复用页面采集与保存流程。新版服务在 `/status` 中声明 `page_capture`，通过 `POST /capture` 接收页面快照并返回保存回执。
