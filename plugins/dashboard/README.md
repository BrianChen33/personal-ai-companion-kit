# 离线面板

可选 runtime。安装后默认停用；启用不代表宿主已经接线。

需要：private_html_delivery。

数据：derived HTML excluded; approved private artwork optional。

安装后用 plugin_call action=status 查看；调用只在主人私密管理入口开放。
action=render 生成现有单文件 HTML。绑定原有情绪任务末尾刷新，不另起任务。

按主仓库 docs/PLUGIN_DATA_BACKUP.md 把获准数据交给原格式快照；已在 brain.sqlite 中的数据只保存一次。恢复不激活旧任务、账号或发送队列。
