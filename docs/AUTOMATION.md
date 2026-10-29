# Kumo 自动化采集脚手架

浏览器工具通常能操作网页正文，却无法操作浏览器工具栏中的扩展弹窗。Kumo 的自动化入口把“读取已打开的页面”和“写入资料库”连接起来，无需点击扩展图标。

本功能不自动登录、不启动新浏览器，不抓取账号清单；它接收用户已授权访问的单篇帖子页面。账号帖子清单中的每个链接仍须由浏览器工具实际打开并读取，才能保存正文、图片和已加载的评论。

## 给 Claude Code 的最短说明

可以直接把下面这段交给 Claude Code：

> 从 Kumo 源码仓库根目录使用脚手架。先阅读 `docs/CLAUDE-KUMO.md`。使用你现有的浏览器会话，逐篇打开我授权的帖子清单，复用 Kumo 的采集脚本，将每篇的完整 JSON 快照通过 `scripts/kumo-capture.mjs save` 写入本机服务。先用 `tags` 查询我要使用的标签。必须记录每篇返回的 `status`、`id`、`relativePath` 和媒体缺失情况。不要把列出链接当作已经收藏；重复项保留原有标签和笔记。按我已经授权的清单和标签执行；缺少这些信息时再询问。

## 准备

需要 Node.js 22+ 和已启动的本地助手。以下命令在仓库根目录执行：

```powershell
# 以下命令从 Kumo 源码仓库根目录执行
# 本次已经启动；以后电脑重启后，可在原服务运行时再次启动独立入口。
.\local-bridge\start-automation.ps1
node scripts/kumo-capture.mjs status
node scripts/kumo-capture.mjs tags
```

`status.capabilities` 应含 `page_capture`。脚手架优先识别 `http://127.0.0.1:43789`；旧版主服务仍运行时，可使用同一资料库的独立自动化入口 `http://127.0.0.1:43791`，由 SDK 自动识别并核对资料库路径一致。不会更改已有的浏览器权限、MCP 配置或资料库位置。可用 `--bridge` 显式指定本机地址。

原服务未运行时，也可给启动脚本显式传入原资料库路径：`-LibraryRoot "原资料库完整路径"`。启动脚本不注册开机任务，也不会停止其他进程。

## 最简方式：插件内开启本页开发者入口

在 Kumo 插件中打开“保存设置 → 开发者模式 → 开启本页入口”。网页右下角会临时出现“Kumo · 嚼一嚼”，浏览器助手可以像点击普通网页按钮一样点击它，直接复用扩展的保存、去重、标签记忆和状态提示，不需要 Playwright 回调或额外连接。按钮的可访问名称是“Kumo 保存当前帖子”。

入口仅在当前文档临时存在，可以点击 × 或回到设置关闭，刷新/完整导航后消失；因此逐个重新加载页面的批量任务仍建议采用下面的 SDK 或采集脚本。用户已经开启页面按钮时，助手不必再去点击浏览器工具栏。

## 方法一：浏览器工具执行页面脚本，再用 CLI 保存

适用于能在当前页面执行 JavaScript 并导出完整结果的浏览器工具：

```powershell
node scripts/kumo-capture.mjs extract-script --output deliverables/automation/capture-page.js
```

输出文件是一个自执行表达式。让浏览器工具读取这个文件，在**已打开的单篇帖子详情页**执行，取得返回的 JSON 对象，并完整写入 `snapshot.json`。这个步骤只采集页面，不会保存进 Kumo。表达式来自扩展的 `page-state.js` 和 `extractor.js`，不读取浏览器 Cookie、不依赖页面直接请求本地地址。

```powershell
node scripts/kumo-capture.mjs save --input snapshot.json --tag "自媒体参考"
```

返回例子的字段结构为：`status`、`verified`、`id`、`relativePath`、`userTags`、`media`、`comments`、`warnings`、`errors`。这只是字段说明，不能代替实际服务回执。

默认下载图片；加 `--video` 尝试下载已发现的直接视频文件。`--no-images` 表示用户明确只保存正文、图片地址和评论。标签必须已存在；可用标签名称或稳定 ID，未指定时进入未分类。显式新建标签可用 `tag-create --label "标签名"`。

## 方法二：已有 Playwright Page 的脚本直接保存

SDK 不安装 Playwright，也不新建会话。复用调用方已有的、能访问帖子的 `page`：

```js
import {capturePage} from './scripts/kumo-sdk.mjs';

// page 是调用方已经连接的浏览器页面；先打开目标帖并等待正文加载。
const result = await capturePage(page, {tag: '自媒体参考'});
console.log(result);
```

`capturePage` 会记录采集前的 URL，执行同一套采集规则，再由 Node.js 调用本地服务。打开页面不等于内容已加载；调用方负责展开需要保留的正文、图集和评论，然后采集。只记录实际已加载的评论，不宣称取得了全站最高赞评论。

## 方法三：临时添加页面内入口

适用于调用方已有 Playwright Page，并支持 `exposeBinding` 的场景：

```js
import {installPageEntry} from './scripts/kumo-sdk.mjs';

const entry = await installPageEntry(page, {tag: '自媒体参考'});
// 页面右下角出现“Kumo · 收藏到自媒体参考”，浏览器工具可直接点击。
await page.getByRole('button', {name: 'Kumo 保存当前帖子'}).click();
// 按钮 data-kumo-status / data-kumo-saved-id 记录实际结果。

// 完成后移除临时入口；刷新/导航后需重新安装。
await entry.remove();
```

按钮使用自动化工具提供的回调将工作交给 Node.js；网页不直接调用本机接口。入口绑定在安装时的单篇页面，导航后失效。普通网页脚本如果没有调用方的这个回调，不能仅凭一段 DOM 按钮代码获得保存能力。

如果没有启用插件本页入口，而 Claude 的浏览器工具也不支持页面脚本执行、导出 JSON，或提供可连接的 Page，则需要先启用插件入口或扩展浏览器连接方式。

## 批量处理与回执

已采集的快照可以按一行一个 JSON 保存到 `snapshots.jsonl`，再逐条导入：

```powershell
node scripts/kumo-capture.mjs batch --input snapshots.jsonl --tag "自媒体参考" --report deliverables/automation/account-results.jsonl
```

也可让浏览器逐篇打开后调用 `capturePage`，每条追加保存回执。建议顺序访问账号帖子，失败后记录并继续，不对同一个 Page 同时导航。清单中的链接数量不等于已经保存的帖子数量。

SDK 也提供顺序处理链接清单的 `captureUrls`。调用方通过 `preparePage` 等待帖子加载、展开评论，并通过 `onResult` 实时保存回执：

```js
import {appendFile} from 'node:fs/promises';
import {captureUrls} from './scripts/kumo-sdk.mjs';

const summary = await captureUrls(page, authorizedPostUrls, {
  tag: '自媒体参考',
  stopOnError: true,
  preparePage: async (page) => {
    // 按当前平台实际页面等待正文、展开需要保存的评论；遇到登录/验证时停止。
    await waitUntilTheAuthorizedPostIsReady(page);
  },
  onResult: (result) => appendFile(reportPath, JSON.stringify(result)+'\n', 'utf8')
});
```

其中 `authorizedPostUrls`、`reportPath` 和页面准备函数由调用方提供，不包含内置账号或自动发现目标。

| status | 含义 | 是否可以计为本轮新增完整收藏 |
| --- | --- | --- |
| `saved` | 正文及本次请求的媒体已写入，并核对保存记录 | 是；仍应查看页面采集 warnings |
| `duplicate` | 资料库已经有这条帖子；保留原有内容、标签和笔记 | 否，单独计为已存在 |
| `partial` | 正文已写入，媒体或可识别的页面内容缺失 | 单独列出，不能报为完整成功 |
| `failed` | CLI 未取得成功回执 | 否；若是超时，先查询资料库再重试 |

CLI 退出码：0 为成功/已存在，1 为错误，2 为部分完成。批量输出每条结果和最终分类计数，报告文件已存在时拒绝覆盖。重复运行不会通过此入口改写已有帖子的标签或笔记；补媒体可回到扩展的补全流程。

图片和直接视频在服务端从常见平台公开 CDN 获取；需要浏览器登录态、Referer、blob/HLS 或不在支持范围内的媒体会返回缺失明细，不会把“只保存了媒体 URL”算成已下载。视频默认不请求，回执会注明；图片/视频未请求与下载失败分别报告。

## 本地 HTTP 接口

`POST /capture` 接收：

```json
{
  "clip": {"schema": "kumo-clip-v1", "...": "页面采集脚本返回的完整快照"},
  "tag": "自媒体参考",
  "note": "用户原文笔记，可省略",
  "images": true,
  "video": false,
  "expectedUrl": "可选，用于核对当前采集帖"
}
```

接口复用现有内容包生成、去重和资料库写入流程。现有 `/clips`、`/tags`、`/annotations` 仍然可用；自动化无需自行构造 Markdown、文件路径或内容包。
