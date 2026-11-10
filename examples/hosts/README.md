# 通用宿主接入示例

本目录全部为合成数据，仅用于全新隔离状态。不能把这些消息输入真实用户的记忆库。

安装 Python 包后，用 `python -c "from personal_bot.deploy import RUNTIME; print(RUNTIME)"` 找到已安装运行时目录。`reply_driver.mjs` 就在该目录，不需要复制 Muse 的目录或自写临时 brain.py。实际命令与环境设置见 [HOST_ADAPTERS](../../docs/HOST_ADAPTERS.md)。

[portable-context.json](portable-context.json) 展示可运行的 context 请求。真实接入时，宿主从正式消息工具取得原文、稳定 ID、序号、真实毫秒时间和已认证发送者，再转换为同样结构；不要让回复模型编造这些字段。

处理顺序：

1. 调用 driver 的 context，保留返回的 ticket、context 和 emotion_template。
2. 当前回复模型填写模板中的实际变化；不要从另一个模型或关键词规则生成情绪。
3. 调用 `{"phase":"commit","ticket":"实际返回值","emotion_assessment":实际填写的模板}`。
4. ready_to_send 为真后，宿主用原有发送工具交付文字，再处理 media。没有发送工具就只完成本地流程，不能报告用户已收到。
5. 已取得真实尝试/发送回执后调用 finish；纯文字使用真实 receipt、outcome=text_only、text_finished=true。图片的 accepted/unknown 需要实际已准备的素材，不能用文本回执假装图片已送达。

长工具返回后重新读取最新消息，commit 附最新 host_response；不要继续提交旧目标。后台反馈用同一绑定调用 `host_entry.mjs` 的 feedback，不经过表情决策。

这是通用格式的隔离示例，不是某个真实平台的连接器，也不证明 Dot 或其他平台已完成接线。

只装核心的宿主先配置 `STICKERS_ENABLED=0`，不需要建立假图库或表情配置。选择表情后再按真实模块说明启用；不要让缺失配置变成聊天失败。
