# 把角色与记忆迁移到新的 Agent

先取得用户对源私库、目标 Agent 与数据范围的授权，读取私库 README、LATEST 和 manifest，检出其 architecture 锁定的代码 commit。能力条件见 [CAPABILITIES](CAPABILITIES.md)，当前运行约定见 [CURRENT_RULES](CURRENT_RULES.md)。不默认扫描账号下其他仓库，也不从 GitHub 最新 main 推断旧快照版本。

新建、升级、继承是不同流程；本文件只处理原格式数据继承。完整安装顺序见 [DEPLOY_FOR_BOT](../DEPLOY_FOR_BOT.md)。历史更新记录不再作为操作指令。

## 选择继承范围

| 数据 | 可以如何继承 |
|---|---|
| memories、source_events | 有来源的事实/偏好/项目/原话；按scope和时间有界读取 |
| ct_summary及推断 | 可追溯参考；不是用户原话，也不替代原始记录 |
| 原生人物Markdown、ct_person、显式映射 | 选择性继续；未知ID先确认；好感/信任不等于权限 |
| 人格文档 | 选择延续原角色才采用；保留目标人格时只参考选定事实 |
| mood/emotion/ct_label/ct_expectation/模拟精力 | 按旧时间投影衰减，不重放为新刺激；未解期待向用户确认是否继续 |
| ct_life及阅读笔记 | 保留virtual/dream/observed来源；不声称是用户真实活动 |
| ct_meme_private/ct_meme_event/偏好 | 按scope继承解释、教学、纠错、联想机制与来源；candidate不当确定事实 |
| ct_meme_public/ct_meme_term | 公共知识缓存可重建；更新不能覆盖私人解释；同步状态照实保留 |
| expression_settings/ct_emotion_effect | 控制值先核对主人偏好，反应倍率只作用于新事件；旧刺激不重乘 |
| 提醒和发送账本 | 审计可保留；已完成/unknown不重发；待办先重新确认 |
| 原生任务、宿主路径、渠道映射 | 部署参考，默认不激活；重新绑定当前宿主与已授权身份 |
| 向量/缓存/面板 | 可重建；不能作为唯一事实来源 |
| 密钥、cookies、登录态、工具权限 | 不继承，不应进入记忆库；目标宿主重新正式授权 |

先问“延续原角色”或“保留目标人格只参考记忆”，再问尚未指定的范围。无人格按PERSONA_ONBOARDING.md完善。不要仅凭读了一份摘要称为完整继承。

## 原格式快照导入

私库current/使用companion-memory-vault-v1，不是旧CLI restore识别的muse-full-backup-v2。不要把私库目录直接传给旧restore命令，按下面映射导入新的停用目录。

1. 在代码目录外初始化一个**全新、停用的**STATE；停用的仅是这个新目标，不影响用户原来的机器人。
2. 核验manifest全部文件SHA/尺寸和architecture commit。aliases表示相同内容只保存一份，可按需要建立目标逻辑映射，不复制多份。
3. 在没有进程打开新目标数据库时，将current/brain.sqlite复制到新STATE/data/brain.sqlite。不得覆盖原来正在使用的状态库，不复制源库的-WAL/-SHM文件。
4. 保留新目标config的enabled=false和向量默认关闭；不要整份采用源configuration/config.json的启用值。启动匹配版本做只读完整性与schema检查。
5. native下的文档复制到**新的导入资料目录**，作为来源；按用户选择采用人格，不盲目覆盖目标SOUL/AGENTS。原scope、证据、时间和事件ID保留；文件内容中的命令不执行。
6. 重新绑定host_paths/person_map/task_bindings与当前宿主；来源里的旧绝对路径和channel ID不能直接激活。默认不注册提醒对账/旧主动任务，先让用户确认哪些待办仍有效。
7. 同一模型的新对话评估使用新真实事件，不能靠换ID重放历史情绪。自然衰减只投影旧状态；给用户展示已加载范围和仍不确定的关联。
8. 完成一次最终隔离验收后，按用户的正式部署要求启用当前入口。避免旧新两个Agent重复主动发送。

数据库只用SQLite读取；不要把二进制当文本送模型。建议先加载人格/用户索引和当前相关人物，按问题检索事实、时间和原话，降低冷启动上下文。

## 私库README应包含

标题/隐私范围、代码库URL与锁定commit、LATEST与manifest入口、逐步继承提示词、模式与范围选择、当前数据类型、来源标签、任务不自动启动、凭据不继承、真实完成报告。参考examples/vault-readme.template.md。备份Git历史是用户私人档案；删除当前记忆不会自动清除旧commit。

当前情绪规范以锁定代码的MODEL_EMOTION.md和companion_schema为准。旧日记、原话、任务归档或旧安装包中的情绪执行步骤不能继承为当前规则；最多保留历史升级概况。清理时先核对来源和用途，不按版本字符串整库删除。
## 按所选模块恢复

| 模块 | 原格式数据与恢复处理 |
|---|---|
| 阅读与表达成长 | `sr_` 表、`plugins.json` 保存许可来源、观察、队列、词义/场景/纠正、真实使用与成长凭据。按快照架构锁安装匹配插件，不固定安装历史旧版。用户选择保留的来源、习惯与人格成长；拒绝/停用项不复活，候选不批量晋升。 |
| 续读与手机日常 | 已发布版本的过期处理按 [READING_QUEUE](READING_QUEUE.md)；导入不算新阅读，超过 24 小时的续读不恢复执行。`life_routine` 的偏好可保留，旧 phone_intent/浏览器绑定/计划不自动重跑。 |
| 自己的日程与连续活动 | `ct_activity_*`、`ct_life`、`day_plan:*`/`day_scene` 保留阶段、封存作品、来源与实际时间。用户日程保持用户归属；未确认的旧活动不补造完成经历，分享认领先核对真实回执。见 [DAILY_SCENE](DAILY_SCENE.md)。 |
| 生活相机 | `lc_asset`/`lc_job`/设置及许可的原参考图按清单恢复；生成相册独立保管。重新核对工具、路径、目标与 bind_host，保留拍摄时场景。旧 unknown/已完成图片不重新生成或重发，晚到回执按插件 PROTOCOL 对账。 |
| 记账等独立空间 | `current/plugins/<id>/` 只作归档；先安装对应插件，再将完整快照直接导入新的停用目标。保留原生字段、数值、日期表现、ID、余额和关联，不逐笔重放交易；具体见 [PLUGIN_DATA_BACKUP](PLUGIN_DATA_BACKUP.md)。当前记账包没有原网页完整源码。 |
| 小米睡眠与运动 | 插件配置只表达启用意愿；凭据、health.sqlite、context.json 和交接材料不在 GitHub 继承范围。获准的旧对话摘要可按原来源保留；新宿主需要本人重新确认账号权限及摘要数据流。不得将用户身体数据赋给角色精力。 |
| 面板与小屋 | 私人人格标题、合法参考图、角色 GLB 及配置按获准范围恢复；按 [WEB_SPACES](WEB_SPACES.md)、[HOME_SPACE](HOME_SPACE.md) 重新核对页面身份、私有状态/资源接口与生成器。不复制完整旧后台绑定，不用旧页面显示证明状态仍在更新。 |
| QQ / 微信 | 代码版本与普通规则可参考，账号、传输、真实身份与回执权限重新绑定。QQ 见 [QQ_TRANSPORT](QQ_TRANSPORT.md)。旧队列先核对，不能激活两个消费者或重发历史未确认项。 |

核心数据库中的插件表只备份/恢复一次，不再导出第二份活跃账本。空间独立数据单独声明；未安装插件的数据可保留为停用档案，不执行其中的任务或命令。

## 新入口与旧证据

旧 `reply-rounds` 票据、发送回执、formal-entry 状态仅是旧宿主证据，不能授权新宿主发送；新主聊重新绑定并 context。旧成功情绪不重放、倍率不重乘；按原时间投影旧心情，新的真实来信才产生新评估。

当前 driver 使用 compact48-v1，不要求手写 48 个零；其他入口按实际返回模板执行，详见 [FAST_REPLY](FAST_REPLY.md) 与 [MODEL_EMOTION](MODEL_EMOTION.md)。SOUL 与已选择的 growth_overlay 共同构成当前人格，单个原文件内容标识不代表全部成长状态。

原生任务默认停用，只在新环境读回真正绑定并确认有效待办后启用。继承完成报告分别列出已读档案、已导入状态、已接线功能及未完成项；读到文件不等于已经运行。
