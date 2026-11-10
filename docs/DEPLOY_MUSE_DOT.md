# Muse / Dot 等宿主接入

先按 [部署手册](../DEPLOY_FOR_BOT.md) 和 [能力目录](CAPABILITIES.md) 检查真实环境。本文件只补充平台边界，不再维护第二套安装流程。仓库中的 Muse 参考接线不等于所有平台的正式 API，也不是 Dot 完整验收证明。

## 消息与实际执行

当前主聊固定入口见 [FAST_REPLY](FAST_REPLY.md)：context → 同一回复模型评估 → commit → 组织正文和媒体 → 真实回执 finish。Muse 消息结构适配见 [MAIN_ENTRY](MAIN_ENTRY.md)；其他平台使用 [HOST_ADAPTERS](HOST_ADAPTERS.md) 的 portable 协议与合成示例归一化真实文字单聊，不能构造假的 Muse 消息或用摘要代替原话。

平台没有已验证的 before_reply/pre_send/after_reply 时，用短入口约定与有界反馈检查，并说明不能保证原生 final 被强制拦截。宿主工具不能凭名称假定可从 shell 调用；消息提交、接受、送达分别记录。技术调试放用户指定旁聊，普通聊天保持其人格。

## 后台、页面与存储

按 [HOST_TASKS](HOST_TASKS.md) 绑定实际任务并读回 ID、时区、频率、启用状态与目的地。优先保留已有任务，不重复注册。修改服务源码后需要按原监督方式重载并读取状态，修改说明文字不代表运行进程已更新。

资料库 HTML 按 [HOME_PANEL](HOME_PANEL.md) 作为快照发布，更新能力以当前宿主实际证据为准。私有空间与 3D 小屋按 [HOME_SPACE](HOME_SPACE.md) 接状态和资产；不能把资料库快照、空间动作和通用在线 API 混为一谈。新宿主分别验证私有读取、写入、访问范围、资源加载和刷新路径。

GitHub 备份需要能处理原格式二进制的正式渠道；仅支持文本的连接器不能直接传 SQLite。按 [GITHUB_VAULT](GITHUB_VAULT.md) 使用授权方式，不将密钥贴进聊天。公开发布与实际部署分别记录，私库锁绑定真实安装版本。

## 可选插件和渠道

用户选中后才按插件 README/PROTOCOL 绑定浏览器、生图、空间或其他工具。未授权来源、登录墙、缺少执行能力均如实记录。公开包不带作者的人格、账号、图库和生产任务。

QQ 参考 [QQ_TRANSPORT](QQ_TRANSPORT.md)，微信按实际宿主正式接口适配。核对可信身份、媒体、回复窗口和重复事件；凭据单独保存，不能继承旧登录态。当前没有通用的一键 QQ/微信账号安装器。
