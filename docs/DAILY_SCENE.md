# 每日粗安排与生活场景

Kit 0.10.0 / runtime 2.9.0 / life-camera 0.2.0。继续沿用输入、记忆、情绪、生活、表达、反馈六层。借鉴 dsh-daily-schedule 的粗日程、本地读取和衣着场景连续性，保留本系统既有的事件进程、封存作品、真实阅读与情绪来源。

## 最短链路

原30分钟生活任务在同一次模型运行中准备今天约4–6个宽松打算。只为剩余半天安排时可以少于4个。日程轻微影响普通活动的选择权重，先抽刷手机的40/60规则继续由 life_routine 唯一配置控制。日程允许临时调整，正在进行的活动仍走 life_projects 的暂停与未来修订。

原15分钟反馈与30分钟生活任务推进真实已到期阶段，由同一个模型补充当前地点、穿着、手边物品、光线与外观细节。普通聊天直接读取 companion.day_scene 小摘要。生活相机在入队时冻结这个场景，以原三视图为首张实际参考图，后台生成后沿原主聊路径投递。

一张原SQLite保存设置、最多7天的日程和一份当前场景。无新服务、定时任务、模型调用、每天一份文件或前台规划。日程不存情绪，不向原话、经历或回忆表插入未来事件。只有原 life_projects/真实阅读释放的事件进入原情绪评估。

## 正式操作

操作统一为 `op=companion_day, scope=owner-private`，要求 life 模块可用。

| action | 输入 | 返回 |
|---|---|---|
| configure | authorized=true, enabled=true/false | 当前启用状态、日程和场景 |
| pending | 无 | 是否缺今日计划、当前version、可用活动名与字段规范 |
| plan | expected_version, plan | 保存或幂等读回今日计划 |
| scene | expected_version, life_id, fields | 保存或幂等读回真实已释放阶段的场景 |
| status | 无 | 完整今日计划及当前场景，仅后台、明确查询和面板使用 |

新安装及升级默认关闭，宿主经用户选择后显式启用。已有用户批准的部署直接沿用授权。

`plan` 只有两个键，day 为上海时区今天的 YYYY-MM-DD，anchors 有1–6项。每项只有 at、activity、intention，分别为当天严格递增的Unix秒、pending所列活动名、最多140字的打算。新安排的时间必须晚于当前时刻。已有过去打算的时间与内容保留，未来部分可修订。expected_version 初次为0，后续为读回版本。完全相同的日程重试返回 replayed，不重复加版本。

`scene.fields` 可含 location、clothing、props、light、appearance，每项最多100字。省略表示未知，提交完整当前已知字段，避免意外删掉衣着。life_id 必须对应已有、未撤销、发生时间已到的 ct_life。初次expected_version=0，随后使用当前scene.version。完全相同且base_version相同的重试幂等；过期写入被拒绝，重新读取后决定。禁止把未来计划或封存稿当场景事实。

tick自动跟进已释放活动名称与阶段。新活动保留来源仍有效的已知衣着与外观，清除旧地点、物品和光线，等待同一后台模型确认。缺少记录就保持未知，不按钟点推断已经吃饭或换衣。中断与改计划时仍先调用原companion_activity正式入口。status.scene_version始终返回可写版本，即使旧场景来源已撤销；此时scene为空，旧字段不再继承。

## 宿主接线

1. 保留原15m与30m任务的ID、enabled、目的地、时区、节奏及健康/新闻/阅读分支。普通聊天入口只透传已有 companion.day_scene，不新增读取工具步骤。
2. 30m任务开头调用pending。needed=true时在该轮现有模型运行中生成剩余当天粗安排并plan；有计划就复用。接着按原tick、activity pending/plan、情绪评估和阅读流程工作。
3. 15m/30m推进阶段后，如地点、衣着等确有变化，按当前 released life_id 和版本调用scene。每批只提交一次最新场景；没有变化不重复写。只用本轮模型，无独立场景分析模型。
4. 相机plan自动保存scene_snapshot，包括captured_at、场景版本和来源。选取旧阶段时不借用当前场景细节。work必须使用已保存的prompt与实际三视图，禁止生成时重写为后来活动。
5. send_work返回scene_changed及caption_policy。场景已变化时使用“刚才”的说明；已无分享价值可沿原claim settle failed并记录真实撤销原因，省去发送。禁止重生成或重发。原unknown handoff、receipt_work及真实图片回执链完整保留。
6. 原反馈任务末尾静默覆盖同一个面板。日常详情展示此刻、今日打算、活动过程、相机和每批8条历史；小屋、中央原表情和八项概览卡保留。刷新实际native任务定义后，按新架构锁提交私库。

宿主原生final的图片附件若未进入transcript，按相机协议保留unknown，或用主人明确确认该照片的真实消息ID结清。不能把文字轮次当作图片送达证据。

## 继承和性能

day_plan:*、day_scene、day_scene_enabled随原SQLite备份。继承者先验证当前来源和宿主任务，再按用户选择恢复运行。源事件撤销后当前场景不再展示。历史日程只是当时的意图，不能补写成经历。

前台附加值上限以测试约束为900个JSON字符，通常更小，只含当前场景与下一条意图。全日计划、相机历史与回执列表留在后台或面板。实际总回复耗时仍取决于宿主排队、模型和工具，局部读取耗时单独计量。

参考项目 https://github.com/aa1355721445-lgtm/dsh-daily-schedule ，读取版本0.4.0，commit eb6335a7e621add197c355ca4a48ea8231e3dcd3。仅借鉴设计并针对当前环境重写，无原源码复制。
