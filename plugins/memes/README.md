# 梗与表达

可选 runtime。安装后默认停用；启用不代表宿主已经接线。

需要：public_http_for_weekly_sync。

数据：brain.sqlite: ct_meme_*; expression_settings。

安装后用 plugin_call action=status 查看；调用只在主人私密管理入口开放。
action=request，request 为现有 meme_search/learn/feedback/record_use/preference 请求或 companion_expression_config；每周同步通过 CLI meme-sync。

按主仓库 docs/PLUGIN_DATA_BACKUP.md 把获准数据交给原格式快照；已在 brain.sqlite 中的数据只保存一次。恢复不激活旧任务、账号或发送队列。
