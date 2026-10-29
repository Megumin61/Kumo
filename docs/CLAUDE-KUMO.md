# 给 Claude Code：通过 Kumo 保存用户授权的帖子

以下相对路径均以 Kumo 源码仓库根目录为准。详细调用方法见 `docs/AUTOMATION.md`。

1. 运行 `node scripts/kumo-capture.mjs status`，确认 `page_capture` 能力和原资料库路径；运行同一脚本的 `tags` 子命令查询标签。
2. 确定本轮用户授权的帖子清单、账号范围和目标标签；已有明确授权时直接沿用。
3. 复用已经登录的浏览器会话，逐篇打开详情页，等待正文/图片加载；需要评论时展开评论。保留帖子的真实来源链接和访问参数。
4. 用户在扩展的“保存设置 → 开发者模式”开启本页入口后，可直接点击网页右下角的“Kumo · 嚼一嚼”，不需要操作扩展工具栏。入口刷新后消失。需要批量重新打开页面时，有 Playwright Page 可使用 `capturePage(page,{tag})` 或 `captureUrls`；只有浏览器 JavaScript 工具时，先生成 `extract-script`，在目标页面执行，完整导出返回 JSON，再运行 `save --input snapshot.json --tag 标签`。
5. 每篇保存实际回执，不以链接清单、网页阅读或采集 JSON 代替保存成功。`saved`、`duplicate`、`partial`、`failed` 分别统计；媒体缺失、未请求视频、未加载评论要如实说明。
6. 重复项不重新分类、不覆盖笔记。不要绕过登录、浏览器权限或平台限制。不要直接从资料库目录伪造文件，也不要把账号清单页面本身当成每篇帖子。
7. 最后报告：计划数、实际尝试数、新增数、已存在数、部分完成数、失败数和回执文件位置。未实际执行的帖子明确列为待处理。

只处理用户授权的清单。可用 SDK 的 `captureUrls` 顺序运行，并通过 `preparePage` 准备页面、`onResult` 实时记录回执。
