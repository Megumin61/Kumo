<p align="center"><img src="plugins/kumo/assets/primary.png" alt="Kumo" width="120"></p>
<h1 align="center">Kumo</h1>
<p align="center"><strong>Clip Everything</strong><br>把值得留下的内容，变成以后用得上的知识。</p>
<p align="center"><a href="https://kumo-clip-jayce.ximisapa.chatgpt.site/">产品介绍</a> · <a href="docs/INSTALL.md">安装指南</a> · <a href="docs/DEVELOPMENT.md">开发指南</a> · <a href="https://github.com/Megumin61/Kumo/releases">下载</a></p>

Kumo 是一款以本地文件夹为资料库的网页剪藏工具。浏览器负责保存来源和笔记，知识花园帮助探索收藏，AI 插件负责检索、精读与经授权的整理。

## 可以做什么

- **保存网页**：留下标题、链接、作者、正文、图片和自己的笔记；采集结果受页面公开程度与平台结构影响。
- **收藏项目与视频线索**：GitHub 项目保存简介、可读取的 README 和来源；B 站保存标题、作者、封面、简介与视频链接，不要求下载整个视频。
- **探索知识花园**：通过领域、主题和帖子查看自己的内容，使用不同植物节点与两套品牌外观。
- **让 AI 用上收藏**：在支持本地执行的 ChatGPT Work / Codex 客户端中，查找依据、读取原文、整理分类并编译主题知识。

## 快速开始

### 只使用浏览器剪藏

1. 从 [Releases](https://github.com/Megumin61/Kumo/releases) 下载浏览器包，解压后保留该文件夹。
2. 在 Edge 打开 `edge://extensions`（Chrome 为 `chrome://extensions`），开启开发人员模式，选择“加载解压缩的扩展”。
3. 选择包含 `manifest.json` 的文件夹；如果下载了完整仓库，选择 `browser-extension/`。
4. 打开要保存的网页，点击 Kumo，选择保存目录并完成第一次剪藏。

基础剪藏无需 Node.js，也不需要 OpenAI API Key。

### 使用收藏列表与知识花园

先安装 Node.js 22 或更新版本，再在仓库根目录执行：

```sh
npm run setup
npm run helper -- --library "资料文件夹的完整路径"
```

回到扩展，选择“连接的本地资料库”。本地助手只监听 `127.0.0.1:43789`，需要保持运行；它不会代替 AI 自动编译。

### 安装 AI 插件

在支持本地 marketplace 的 Codex CLI 中添加：

```sh
codex plugin marketplace add Megumin61/Kumo
```

随后在支持本地插件的桌面客户端打开插件目录，选择 Kumo 来源并安装；新建对话，说“检查 Kumo 连接”，授权连接同一个资料文件夹。也可使用完整仓库中的本地 marketplace。详见 [安装指南](docs/INSTALL.md)。

只解压插件文件不会自动完成宿主安装。当前本地 MCP 需要桌面本地执行，不能通过把本地地址填进 ChatGPT 网页来连接。

## 让收藏参与工作

> 找出我收藏中适合当前界面设计的三篇参考，读取原文，并说明可以怎样用。

> 整理新收藏，保留人工标签与原件，先给出分类和编译预览。

> 对比我保存的两个 GitHub 项目，找出实现这个功能的条件和证据缺口。

默认只读。整理和派生写入需要明确授权。实际读给 AI 的内容会进入当前模型上下文；本地保存不等于离线推理。

## 项目结构

```text
browser-extension/   浏览器扩展与花园界面
local-bridge/        本地资料库助手
plugins/kumo/        ChatGPT Work / Codex 插件、运行包与 MCP 源码
.agents/plugins/     本地 / GitHub marketplace 索引
docs/                安装、开发、隐私与发布说明
scripts/             检查与打包工具
```

## 当前版本

浏览器扩展 **0.18.0**，本地助手 **0.16.2**，AI 插件包 **0.13.4**（核心 **0.13.3**）。截至 2026-10-24，Edge 版本已提交审核；OpenAI 公开目录尚未提交。本仓库提供源码和本地安装，不代表已经通过任何商店审核。

详见 [更新记录](CHANGELOG.md)、[隐私说明](docs/PRIVACY.md) 与 [发布状态](docs/PUBLISHING.md)。

## 许可与支持

保留现有 [PolyForm Noncommercial 1.0.0 许可](LICENSE) 和各依赖的第三方许可。源码可见不等于没有使用限制；品牌图片也不代表已完成商标或版权清权。

问题反馈：[GitHub Issues](https://github.com/Megumin61/Kumo/issues) · 支持邮箱：ximisapa61@gmail.com。报告问题时请勿附带账号凭证或完整个人资料库。
