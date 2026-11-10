# 平台接入：Muse 与通用宿主

Kit 0.16.0 提供两个消息解码入口，共用同一套 context → commit → 表达/媒体 → finish。没有额外模型、网络代理、数据库或后台巡检；能力检查在安装时做，不每轮扫描提供方。

**这一版只接一个已认证主人的私密单聊文字。** 群聊、其他人的私聊、图片/语音输入须使用其自己的适配器，不能为了通过校验塞进 owner-private。QQ/微信原有接线不自动替换。一个私人状态根目录对应一个所有者。

## 结构和兼容性

| 文件 | 职责 |
|---|---|
| `host_message_adapter.mjs` | 纯解码和原文投影：Muse 原生结果 / 通用消息格式 |
| `host_entry.mjs` | 共享取源、反馈、审计与现有正式入口调用 |
| `main_native_entry.mjs` | 保留原命令的 Muse 兼容入口 |
| `reply_driver.mjs` | 共用票据、同模型提交、一次抽签、媒体及真实回执 |
| `host_runtime.mjs` | 程序与私人状态路径解析，兼容原环境变量 |

Muse 原 `native_response`、turn ID、多条用户消息、空白处理和默认命令保留。通用宿主使用 `host_response`，不伪造 Muse 的 turns/items。底层部分字段和目录保留 native/stickers 命名以兼容已有状态；这不表示新的独立发送器或新的图库。

## 安装与路径

先按 [部署手册](../DEPLOY_FOR_BOT.md) 安装 Python 包，在源码目录外初始化私人 STATE。普通安装不需要把 Python 源码复制到状态目录。

```sh
python -c "from personal_bot.deploy import RUNTIME; print(RUNTIME)"
```

从返回目录取得 driver 路径，并在宿主服务的正式配置中设置：

| 环境变量 | 用途 |
|---|---|
| `COMPANION_BRAIN_ROOT` | 已初始化的私人 STATE 绝对路径 |
| `COMPANION_PYTHON` | 安装该包的 Python 解释器绝对路径 |
| `COMPANION_BRAIN_SCRIPT` | 可选：已有独立部署的 brain.py 绝对路径；通常省略 |

没有新变量时仍兼容 `STICKER_BRAIN_ROOT` / `STICKER_PYTHON`。Python 入口优先使用明确配置，其次现有 STATE/brain.py，最后使用包内 brain.py。源码自包含环境可继续采用原方式。新变量由受信任安装配置提供，不能从聊天正文中读取或改写。

`--root WORKSPACE` 是私有驱动工作目录，保存已存在的表情配置、票据与回执；它与 `COMPANION_BRAIN_ROOT` 指向的核心 STATE 是两个明确用途，可位于同一私人父目录，不能放到公共 checkout。只装核心、不启用表情时，在宿主配置设置 `STICKERS_ENABLED=0`，这样缺少图库不阻塞文字回复。日后选择启用时解除此变量并按表达模块建立真实 `stickers/config.json` 和素材；缺失/损坏配置不能冒充有效表情配置。

```sh
node ABS_RUNTIME/reply_driver.mjs --adapter portable --host-id PROVIDER --owner-id OWNER --chat-id CHAT --root WORKSPACE < request.json
```

上面的占位值须替换成真实配置。Windows 可通过 PowerShell 的环境变量和文件输入传入同样内容；不要把 Unix 环境变量语法原样复制过去。参见 [合成示例](../examples/hosts/README.md)。

## 通用消息格式 v1

context 的 `host_response` 必须是：

```json
{
  "schema": "companion-host-messages-v1",
  "host_id": "example-host",
  "conversation_id": "example-direct-chat",
  "conversation_type": "direct",
  "messages": [{
    "id": "example-message-1",
    "sequence": 1,
    "role": "user",
    "sender_id": "example-owner",
    "text": "完整原文，包括空格和换行",
    "occurred_at_ms": 1700000000123
  }]
}
```

- host_id、owner-id 和 chat-id 来自受信任账户配置；消息对象只是观察数据，不能自己授予身份。调用者必须先认证消息来源，再核对真实单聊归属。这个本地接口不是可直接暴露给网络的鉴权服务。
- `sequence` 是该会话内稳定、不重置的非负安全整数。排序不靠模型猜测或仅靠时间戳。平台若没有此序号，适配器需维护稳定映射；不得每次读取重新编号。
- `id` 为稳定消息 ID，同批 id/sequence 不重复；系统用 host/会话/主人/消息 ID 派生内部键，避免不同平台的相同编号碰撞。
- `role` 只接受 user / assistant，用户 sender_id 必须匹配绑定的 owner-id。助手输出只在 feedback 作为使用证据，不当成新的用户情绪刺激。
- `occurred_at_ms` 是正整数 Unix 毫秒，text 原样保留、不裁剪或总结。文本最多 12,000 字符、批次最多 1,000 条、请求最多 2 MiB。不得通过切片伪造完整原话。
- 无附件的纯空白安全结束；未知字段、附件和非文本负载明确拒绝，不替用户生成占位原话。拒绝一批后由宿主按稳定事件记录原因，再处理下一批，不能无限重试阻塞后续消息。
- 可选 page 只接受 has_more 布尔值与 cursor（字符串或 null）。核心依靠已观察到的新消息头防止旧结果倒退；调用者仍需在长任务后读最新消息。

正常使用 `reply_driver`，而不是手工拼接底层操作。context 返回紧凑模板和票据；commit 接该 ticket 与同一回复模型评估。需要新鲜性复核时附最新 `host_response`；Muse 对应字段仍是 `native_response`，不能混用。一次短句回复组共用同一评估与决策。

票据绑定适配器、host、owner、会话、原文和代码版本；换绑定或升级代码后重新 context，不沿用旧票据、不换源 ID 重放情绪。旧 Muse 事件与送达账本保留，代码升级不意味着重做历史消息。

## 工具接线契约

本版统一消息进入核心的路径。下列真实动作仍由宿主正式工具执行，**没有注册一个名称就自动获得能力**。沿用各插件已有 bind_host，不额外建立第二份插件权限表。

| 能力 | 宿主负责 | Kit 的交接与证据 |
|---|---|---|
| 消息读取 | 认证账号、真实对话、原文/身份/时间/稳定序号 | Muse 原生结果或 portable envelope；来源错误在 capture 前拒绝 |
| 模型判断 | 原有回复模型读取 context 并提交真实变化 | compact48 模板与 commit；不能跳过评估后补造成功 |
| 文字/媒体发送 | 正式发送接口或原生 final，按限制交付 | ready_to_send/媒体路径只是准备；finish 只记录真实尝试/结果，unknown 不自动重发 |
| 后台与提醒 | 实际定时、一次性任务、启停和执行记录 | [HOST_TASKS](HOST_TASKS.md)；调度蓝图不是已创建任务 |
| 浏览 | 受许可来源、真实浏览器观察与游标 | 阅读插件现有 stage/ingest/finalize/finish，不伪造浏览结果 |
| 生图 | 正式参考图参数、后台生成、实际看图和投递 | 相机插件现有 bind_host/work/rendered/settle，保留原图与场景 |
| 私有页面/存储 | 真实私密访问、状态发布、资源取回 | [HOME_SPACE](HOME_SPACE.md) / 记账 PROTOCOL；动作名以真实 schema 为准 |

安装记录分别说明：代码支持、宿主工具存在、已绑定、实际调用结果。费用和权限按用户选择处理；不新增付费服务。没有主动发送/后台权限时仅相应模块不可用，普通已绑定的聊天无需等待这些功能。

## 验证范围与下一步

隔离验收覆盖 Muse 回归、通用格式到真实核心、错误身份与会话、空白、重复编号、票据跨绑定、新来信及 wheel 外安装。合成宿主不等于第二个真实个人助理已部署。

本阶段不提供通用群聊适配、媒体输入、跨平台登录器、自动调度器、MCP 安装服务或完整第二平台认证。后续按实际平台补其工具实现，不增加每轮模型数或平行复制另一套情绪/记忆系统。
