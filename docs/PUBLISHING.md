# 分发与发布

Kumo 的 GitHub 正式产品仓库为 https://github.com/Megumin61/Kumo ，描述为 **Clip Everything**。

## 本地分发

浏览器可加载解压缩扩展，AI 插件可由支持本地 marketplace 的桌面客户端安装。完整仓库包含 `.agents/plugins/marketplace.json`，其插件路径为 `./plugins/kumo`。本地来源可分享给其他人，不等于进入公共目录搜索。

## 商店状态（2026-10-26）

- Microsoft Edge：最近一次成功读取后台时，0.18.0 显示 **In review**，没有正式商店安装链接。已准备 0.18.1 包并尝试替换上传；两次明确返回网络错误，之后一次上传结果因自动审批拦截后台访问而未能核验，最终提交尚未确认。不可把 GitHub 本地版发布称为已完成商店更新。后台没有提供可核实的人工/AI 细分审核进度。
- GitHub 产品官网：https://megumin61.github.io/Kumo/ 。原产品域名 https://kumo-clip-jayce.ximisapa.chatgpt.site 同步保留。新版演示 60 秒，画风动图展示部分样式。
- OpenAI：未上传、未提交。当前账号已登录，个人验证入口要求先添加有效的默认付款方式，开发者身份尚未验证。本地 MCP 的公开提交另需 OpenAI 批准提交组织；该资格未确认。
- GitHub Releases：提供本地安装包和文件校验值，不表示商店认证。

OpenAI 官方资料明确要求验证发布者，并对本地 MCP 公开提交限制准入。付款方式要求来自当前账号页面，没有据此声称上架收费或必须充值。

- https://developers.openai.com/plugins/deploy/submission
- https://developers.openai.com/plugins/deploy/desktop-only
- https://developers.openai.com/plugins/build/plugins

公开提交还需解决 AI 适用的隐私和条款页面、真实宿主演示及审查材料、地区/商业声明和发布者确认。完整本地能力应保留，不通过移除 MCP 来掩盖未获得的发布资格。
