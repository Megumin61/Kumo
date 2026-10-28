# Kumo 浏览器扩展 0.18.8

把用户主动选择的网页、来源、图片和笔记保存到本地目录。当前界面以简体中文为主，支持 Chromium / Microsoft Edge。

## 本地安装

1. 在 Edge 扩展页打开开发人员模式。
2. 选择“加载解压缩的扩展”，选择本目录（含 manifest.json）。
3. 打开公开文章，点击 Kumo，选择资料文件夹并保存。也可以在“保存位置”选择浏览器下载目录。

Windows 默认 Ctrl+Q 快速剪藏；实际键位可在“保存设置 → 快捷剪藏 → 修改快捷键”中查看与调整。首次保存需授权资料目录。

收藏列表、知识花园和编译摘要需要另外安装本地助手并连接同一资料库。浏览器扩展不扫描 AI 软件安装目录，也不自带云端 AI 编译服务。

## 发布状态

0.18.8 优化收藏面板、平台标识、重复收藏检查与已加载评论的保存。商店审核与本地分发分别进行，最新状态见[发布说明](https://github.com/Megumin61/Kumo/blob/main/docs/PUBLISHING.md)。

- [产品介绍](https://kumo-clip-jayce.ximisapa.chatgpt.site/)
- [隐私政策](https://kumo-clip-jayce.ximisapa.chatgpt.site/privacy)
- [使用与支持](https://kumo-clip-jayce.ximisapa.chatgpt.site/support)
- [AI 插件](../plugins/kumo/)

运行所需的植物图集、节点样式与两套品牌图片在 assets/ 和 garden/assets/ 中。这些属于界面资源，不包含用户保存的网页或个人知识库。上游许可保留于 NOTICE.txt。

完整安装步骤见 [安装指南](../docs/INSTALL.md)。
