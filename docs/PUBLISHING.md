# 分发与发布

Kumo 的 GitHub 正式产品仓库为 https://github.com/Megumin61/Kumo ，描述为 **Clip Everything**。

## 本地分发

浏览器可加载解压缩扩展，AI 插件可由支持本地 marketplace 的桌面客户端安装。完整仓库包含 `.agents/plugins/marketplace.json`，其插件路径为 `./plugins/kumo`。本地来源可分享给其他人，不等于进入公共目录搜索。

## 商店状态（2026-10-24）

- Microsoft Edge：0.18.0 已提交审核，尚未取得正式商店安装链接。审核中的包不因本仓库更新自动变化。
- OpenAI：未上传、未提交。当前账号已登录，个人验证入口要求先添加有效的默认付款方式，开发者身份尚未验证。本地 MCP 的公开提交另需 OpenAI 批准提交组织；该资格未确认。
- GitHub Releases：提供本地安装包和文件校验值，不表示商店认证。

OpenAI 官方资料明确要求验证发布者，并对本地 MCP 公开提交限制准入。付款方式要求来自当前账号页面，没有据此声称上架收费或必须充值。

- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/build/plugins

公开提交还需解决 AI 适用的隐私和条款页面、真实宿主演示及审查材料、地区/商业声明和发布者确认。完整本地能力应保留，不通过移除 MCP 来掩盖未获得的发布资格。
