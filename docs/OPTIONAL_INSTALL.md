# 六层核心与可选安装

适用新目录。旧目录保持原行为；不要把一次安装当成旧环境的自动迁移。
机器目录见 `personal_bot/plugin_catalog.json`，也可运行：

```sh
python -m personal_bot catalog
python -m personal_bot --root /private/companion setup --plugins dashboard,social-reading
python -m personal_bot --root /private/companion setup --plugins dashboard,social-reading --apply
```

只装核心用 `--plugins ""`。计划不写文件；apply 准备数据和所选插件，全部停用。
未交付的条目不能安装；不下载服务、不申请账户、不创建后台任务。
从 wheel 安装也包含插件源文件，无须回到源码仓库逐个复制。

`state/installation.json` 记录选择、版本和 preparing/prepared。本地插件复制中断时，
同版本同选择可重试；已有 prepared 目录不会重置开关。改变选择需显式 plugin install，
升级需按部署手册；初始化尚未形成检查点就失败时，检查错误并使用新空目录，不覆盖原数据。
并发部署同一个目录不受支持，只允许一个安装 Agent。

完成真实工具接线之后，才运行：

```sh
python -m personal_bot --root /private/companion plugin enable --id dashboard
python -m personal_bot --root /private/companion enable
```

enable 是本地开关，不证明宿主可发送/调度。`plugin_call status` 的
`host_binding_verified=false` 明确表示接入插件尚未核实外部连接。
阅读、相机、健康和记账遵守各自 README；QQ 仍要实际渠道运输层，微信不提供通用实现。
3D 小屋前端另在 `web/companion-home`，Python 插件包提供状态接线，不包含前端构建依赖。

新目录使用 managed-core-v1 配置。梗、面板、相机、表情驱动、小屋投影、QQ 增强和
私库发布在相应入口检查开关；无上下文需要的插件不会逐轮导入。共享情绪算法、SQLite、
送达账本和本地备份仍在核心。关闭插件保留其数据，便于再次启用或迁移。

只按所选插件生成任务蓝图，全部是未创建的说明。后台真实能力不足就保持未绑定，
不要把蓝图、文件存在或成功注册插件等同于生产部署。

人格与插件数据继承见 [INHERITANCE](INHERITANCE.md)，原格式导出见
[PLUGIN_DATA_BACKUP](PLUGIN_DATA_BACKUP.md)。配置开关不是平台权限授权。
