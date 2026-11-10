# 3D小屋

可选 integration_adapter。安装后默认停用；启用不代表宿主已经接线。

需要：private_space、state_actions、private_asset_storage。

数据：approved GLB/artwork and host projection; old bindings inactive。

安装后用 plugin_call action=status 查看；调用只在主人私密管理入口开放。
action=probe/capture/ack 使用原有 outbox 协议。空间代码在仓库 web/companion-home（以 docs/HOME_SPACE.md 实际路径为准）；需宿主部署后才能显示，不声称本插件会创建空间。

按主仓库 docs/PLUGIN_DATA_BACKUP.md 把获准数据交给原格式快照；已在 brain.sqlite 中的数据只保存一次。恢复不激活旧任务、账号或发送队列。
