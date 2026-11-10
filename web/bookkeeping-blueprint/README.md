# 记账空间结构蓝图

本目录来自用户授权提供的 `billing-center-plugin.zip`：Muse 对已完成账单中心的正式结构诊断。
**不是原始网页源码，也不是可独立运行的应用。** 平台的 inspect 返回结构事实，完整全栈源码不能由正式 export 导出。
schema 与动作契约据此整理；原 App.tsx、actions.ts、样式及其他实现内容缺失。

安装入口是 [bookkeeping 插件](../../plugins/bookkeeping/README.md)。
已有满意空间直接绑定；新 Agent 使用宿主正式 builder 按 [功能规格](../../plugins/bookkeeping/SPEC.md)
实现页面与操作，再验收接线。不得把本目录当作原站逐字复制的源码或宣称一键完整部署。

| 文件 | 用途 |
|---|---|
| schema.sql | 新空数据库的四张业务表，不包含种子数据；禁止对已有库盲目执行 |
| schema.ts | 根据诊断整理的 Drizzle 字段映射，含七种币种定义 |
| CONTRACTS.md | 原 17 个动作及输入、金额、日期规则；新增导出以插件 PROTOCOL 为准 |
| dependencies-reference.json | 原空间依赖版本参考；宿主正式工具决定适用版本 |

新构建必须额外实现：真正一致事务内的只读 exportSnapshot、空库初始化、钱包余额与流水编辑的原子处理，
以及可见页面中的有界刷新。隐私模式是显示遮挡，不代替宿主私有权限。汇率仅手动刷新，
无自动汇率 cron；禁止运行原有个人化 seedInitial/seedSubscriptions。

本目录不收真实账目、行数、空间/诊断/构建标识、个人钱包或订阅示例。
旧迁移链、旧导出草案、旧定时声明已省略，避免被新 Agent 误当现行操作。
