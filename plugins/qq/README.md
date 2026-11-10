# QQ渠道

可选 integration_adapter。安装后默认停用；启用不代表宿主已经接线。

需要：channel_transport、verified_identity、native_receipts。

数据：channel configuration and receipt ledger; credentials excluded。

安装后用 plugin_call action=status 查看；调用只在主人私密管理入口开放。
action=status 返回共享入口和所需条件；本插件不自建服务、不冒充渠道登录器或发送器。

按主仓库 docs/PLUGIN_DATA_BACKUP.md 把获准数据交给原格式快照；已在 brain.sqlite 中的数据只保存一次。恢复不激活旧任务、账号或发送队列。
