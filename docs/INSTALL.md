# 安装 Kumo

## 浏览器扩展

下载本仓库或 Releases 中的浏览器 ZIP，解压。Edge / Chrome 的扩展管理页开启开发人员模式，加载包含 `manifest.json` 的 `browser-extension` 文件夹。随后将 Kumo 固定到工具栏，打开公开网页，选择资料目录并保存。

本地安装无需商店审核，但别人必须主动安装；它不会让 Kumo 出现在公共插件市场搜索中。升级时用新版本更新原文件夹，在扩展管理页重新加载。不要删除作为已安装来源的文件夹。正式商店包使用商店更新机制。

## 收藏列表、知识花园与本地助手

需要 Node.js 22+ 与 npm。浏览器扩展本身无需 npm；本地助手复用 MCP 源码，需要安装其锁定依赖。

在仓库根目录执行：

```sh
npm run setup
npm run helper -- --library "资料文件夹的完整路径"
```

请选择保存资料的位置，不是 AI 软件的安装目录。助手创建缺失的 `inbox/`、`archive/`、`domains/`；连接配置保存在用户主目录 `.kumo/bridge-config.json`。已有不一致配置会提示检查，不会覆盖。重启电脑后再次运行 `npm run helper`。Windows 也可执行 `local-bridge/configure-and-start.ps1`。

在扩展的保存位置选择“连接的本地资料库”。助手地址为 `http://127.0.0.1:43789`。端口冲突时请先检查已有助手连接的目录，不要直接终止未知进程。

## ChatGPT Work / Codex 本地插件

需要支持本地插件的桌面客户端与 Node.js 22+。`plugins/kumo/mcp/server.mjs` 已包含 JavaScript 依赖，单独安装发布版 AI 插件无需 `npm install`。

方法一：使用支持 marketplace 命令的 Codex CLI：

```sh
codex plugin marketplace add Megumin61/Kumo
```

然后在桌面客户端插件目录中选择 Kumo 来源，安装 Kumo，并新建对话。如果客户端没有本地插件入口，此方法不适用于该客户端。

方法二：下载完整仓库，保持 `.agents/plugins/marketplace.json` 与 `plugins/kumo/` 的相对位置；在支持本地 marketplace 的客户端中将仓库根目录作为本地来源。Codex CLI 也支持：

```sh
codex plugin marketplace add "本地 Kumo 仓库完整路径"
```

方法三：仅当宿主明确支持导入独立插件 ZIP 时，导入 Releases 中的 AI 插件包；不要将 marketplace ZIP 当作单插件上传包。

安装后说“检查 Kumo 连接”。首次需要授权资料文件夹；浏览器与 AI 应使用同一个目录。默认只读，需要整理时再明确开启派生写入。具体配置脚本及边界见 [AI 安装说明](../plugins/kumo/INSTALL.md)。

这些方式不需要先完成公开目录的发布者验证。它们与公开目录搜索是两个分发渠道。此版本需要本地执行，不能在普通 ChatGPT 云端会话中直接访问电脑文件夹。

## 可选媒体能力

基础文字检索不需要 Python。图像排版和视频抽帧需要 Python + Pillow；视频还需要 FFmpeg。Windows OCR 脚本依赖 Windows 识别能力。如果系统安装的 Python / FFmpeg 没有被自动找到，可通过环境变量 `KUMO_PYTHON`、`KUMO_FFMPEG` 和 `KUMO_FFPROBE` 指定可执行文件的完整路径；Windows 默认 Python 会先尝试宿主附带的运行时。在线转写默认关闭，需另外配置服务并授权发送音频。不会为了安装基础插件而自动安装这些可选工具。

## 常见问题

- **保存成功但列表没有内容**：核对浏览器的保存目录、助手连接目录和 AI 连接目录是否一致。
- **提示未连接**：先确认 Node.js 版本及助手状态；配置失败不等于资料为空。
- **AI 没有自动整理**：保存与整理是独立步骤；向已安装插件的 AI 明确提出整理请求。
- **采集内容不完整**：登录墙、播放器、动态加载或平台限制可能只留下元信息与链接；先检查保存结果，不要将缺失正文当作已读取。
