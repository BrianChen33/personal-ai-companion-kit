# 按任务找文档

默认只读当前任务需要的路径。安装说明不是日常提示词，模块契约也不需要每轮重读。

| 现在要做什么 | 从哪里开始 | 何时继续往下读 |
|---|---|---|
| 了解系统 / 复制安装提示词 | [仓库 README](../README.md) | 准备安装时读下一行 |
| 新建、升级或恢复安装 | [DEPLOY_FOR_BOT](../DEPLOY_FOR_BOT.md) | 按六个阶段，只读当前阶段的模块 |
| 确认当前共同规则 | [CURRENT_RULES](CURRENT_RULES.md) | 具体参数再进入模块契约 |
| 判断能装哪些功能 | [CAPABILITIES](CAPABILITIES.md) | 用户选中且宿主有条件时读插件 README/PROTOCOL |
| 理解六层及数据分工 | [ARCHITECTURE](ARCHITECTURE.md) | 按需查看 [SYSTEM_REPLICATION](SYSTEM_REPLICATION.md) |
| 迁移角色和记忆 | [INHERITANCE](INHERITANCE.md) | 获准范围内读私库清单与插件恢复说明 |
| 修改和发布仓库 | [AGENTS](../AGENTS.md)、[MAINTENANCE](MAINTENANCE.md) | 改到的模块契约、版本与发布证据 |

## 当前模块契约

| 主题 | 文档 |
|---|---|
| 人格与表达习惯 | [PERSONA_ONBOARDING](PERSONA_ONBOARDING.md)、[VOICE_TRIALS](VOICE_TRIALS.md)、[PERSONALITY_GROWTH](PERSONALITY_GROWTH.md) |
| 正式主聊和情绪 | [FAST_REPLY](FAST_REPLY.md)、[MAIN_ENTRY](MAIN_ENTRY.md)、[MODEL_EMOTION](MODEL_EMOTION.md) |
| 连续生活与场景 | [LIFE_PROJECTS](LIFE_PROJECTS.md)、[LIFE_ROUTINE](LIFE_ROUTINE.md)、[DAILY_SCENE](DAILY_SCENE.md) |
| 后台与阅读 | [HOST_TASKS](HOST_TASKS.md)、[FEEDBACK_HEARTBEAT](FEEDBACK_HEARTBEAT.md)、[READING_QUEUE](READING_QUEUE.md) |
| 宿主与渠道 | [HOST_ADAPTERS](HOST_ADAPTERS.md)、[DEPLOY_MUSE_DOT](DEPLOY_MUSE_DOT.md)、[QQ_TRANSPORT](QQ_TRANSPORT.md) |
| 梗知识、人格表达与相机衔接 | [HUMOR](HUMOR.md)、[VOICE_AND_LIFE_CAMERA](VOICE_AND_LIFE_CAMERA.md)，实际相机以插件 PROTOCOL 为准 |
| 页面与状态 | [WEB_SPACES](WEB_SPACES.md)、[HOME_PANEL](HOME_PANEL.md)、[HOME_SPACE](HOME_SPACE.md) |
| 备份 | [GITHUB_VAULT](GITHUB_VAULT.md)、[PLUGIN_DATA_BACKUP](PLUGIN_DATA_BACKUP.md) |
| 程序调用与边界 | [API](API.md)、[TERMINOLOGY](TERMINOLOGY.md)、[THREAT_MODEL](THREAT_MODEL.md) |
| 旧 memory_bridge 数据交换兼容 | [MUSE_ADAPTER](MUSE_ADAPTER.md)、[RUNNER](RUNNER.md)；行转换和独立自检不是聊天宿主适配器，也不是完整 Muse/Dot 安装入口 |

四个独立插件及条件统一从 [能力目录](CAPABILITIES.md) 找，不在多处维护第二份版本表。

## 不加入默认运行上下文的资料

- [CHANGELOG](../CHANGELOG.md)：版本变化概况，不提供旧规则执行步骤。
- [releases](releases)：固定版本的文件与内容标识，用于发布/升级核对，不是当前操作提示词。
- [legacy](legacy)：旧接口历史，不用于新安装；旧数据调查时只取格式事实，不能重新启用旧规则。
- [superpowers](superpowers)：研发方案、执行记录，不是用户部署步骤，也不证明已发布或已部署。
- [CORE_PLUGINS_PROPOSAL](CORE_PLUGINS_PROPOSAL.md)：已同意分步推进的研发路线，完成范围另行标明。
- [ROLLBACK](ROLLBACK.md)：已有恢复参考，非默认部署任务，不要求创建新的回退工程。
- `personal_bot/provenance.json`：代码来源与版本证据；旧条目不是现行指令。

专题中的版本号可能表示该协议的首次引入版本，不等于整套 Kit 的当前版本。安装固定一个 commit；遇到旧概况和当前模块契约冲突，采用当前契约并记录需修正文档，不能猜造工具格式。
