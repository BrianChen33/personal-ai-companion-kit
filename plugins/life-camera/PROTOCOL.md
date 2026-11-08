# 宿主生活相机接线

0.3.0 按 docs/DAILY_SCENE.md 使用共享场景。plan 自动冻结 scene_snapshot 和 captured_at，
work直接沿已冻结的prompt与原三视图生成。send_work若scene_changed=true，宿主用刚才
的时态说明，或沿原claim结算failed并说明撤销原因。新场景不触发旧照片重生成。
旧job没有scene_snapshot时继续走原链路。前台不重复读取完整日程或相机作业。

## 同一轮先安排拍摄，再组织画面

新plan必须提供shot。由已有宿主模型在原生活后台拍照判断或原生生图worker的原轮次中一起填写。
普通聊天只登记真实索图意图，立即交给已有后台runner；该worker接真实source_event/life_id后
先plan再work。普通文字回复不等待构图，后台不另拆一个构图代理或分析轮次。
先确定光学观察点和持机方式，再安排可见手的动作，最后分配每件主要道具的数量和位置。
prompt只写环境、氛围和场景；人物动作交给shot，旧pose字段由shot接替。后置拍物时不输出面部神态。

shot恰含support、viewpoint、framing、hands、objects五项。support为left_hand/right_hand/surface，
后者表示设备由稳定支撑放置，双手才可同时做事。viewpoint/framing各最多200字；hands只列实际
可见的left/right手及动作，每项最多160字。后置/前置手持时，持机手位于光学观察点后。
mirror中的持机手由镜中构图呈现。拍摄设备由support处理，物品表不重复登记capture_device。

objects最多8项，每项只含id、label、quantity、unit、location。quantity为1–32整数，unit明确
计数单位，一副筷子用quantity=1、unit=pair。location为left_hand/right_hand/surface/background。
同一物理物品组只用一个id和一个位置，拿起后位置移到手中。每只手安排一个主要道具组；手持
拍摄设备的那只手已占用。物品语义与数量由原模型根据实际场景决定，本地只校验结构及占用关系。

```json
{"support":"left_hand","viewpoint":"用持机者眼前略向下的镜头看餐桌","framing":"白饭、两碟菜和右手","hands":{"right":"夹起一小口菜"},"objects":[{"id":"chopsticks","label":"木筷子","quantity":1,"unit":"pair","location":"right_hand"},{"id":"rice","label":"白饭","quantity":1,"unit":"bowl","location":"surface"},{"id":"greens","label":"青菜","quantity":1,"unit":"plate","location":"surface"},{"id":"egg","label":"炒蛋","quantity":1,"unit":"plate","location":"surface"}]}
```

组装器把shot转成连贯的拍摄位置、可见动作和物品分布，原数据保存在同一lc_job.plan。
生成完成后提示词照常缩为SHA，shot保留，后续可以读回当时如何构图。

## 单角色与镜头

三视图的正侧背面都属于同一个角色，只提供外观和画风。每张生活照最多呈现一个角色形象。
compose在场景、动作及素材说明之后追加统一镜头约束，冲突时按所选camera的视点组织画面。
selfie呈现一个脸和连贯身体；rear拍眼前的物品，持机者的头脸和躯干留在镜头后，仅按明确
构图需要从画面下缘露出同一人的手或前臂；mirror仅呈现一个镜中形象，镜外本体留在画外。
规划阶段由原模型检查场景与镜头一致性。后置拍饭菜时，侧后方人物头部不能与第一人称持筷手混画。

原生生图返回后，原后台轮次实际打开/查看生成文件，按shot核人物、镜头、手与道具。图片工具已
直接呈现该图时复用当次视觉结果。纯文件数、文件名和口头“已检查”不能作为构图观察。
rendered同时提交composition_review，恰含image_sha256、subject_count、capture_device_count、
objects、issues。objects用shot中同一id和计量单位登记实际观察数量；issues列出具体不符点。
自拍/镜自拍subject_count必须为1，后置可为0或1；拍摄设备入镜数为镜自拍1、其他镜头0。
逐项数值与空issues通过才接受，观察绑定这张图原始字节SHA，记录进原generation账本。

```json
{"image_sha256":"ACTUAL_IMAGE_SHA256","subject_count":1,"capture_device_count":0,"objects":{"chopsticks":1,"rice":1,"greens":1,"egg":1},"issues":[]}
```

缺少视觉能力或实际观察不符时，沿generation_failed记录真实任务/claim/receipt与具体原因。
本地校验核对宿主报告的一致性，图片语义仍由宿主实际看图判断。不能把期望数量抄成观察结果，
不能为通过校验改小观察数。生成文件按原宿主规则清理，不自动重生成或发送失败图。
旧版已冻结且没有shot的job继续按原账本处理；同源plan重试仍返回已有job，新创建须有shot。

## 每轮读取

部署先实际核对工具参数和任务入口，再调用 bind_host。binding 必须且仅含
image_tool、background_runner、delivery_route、receipt 四个非空字符串，以及
reference_images=true、separate_delivery=true。该调用要求 authorized=true。
缺少后台/参考图/分离发送能力时如实保留 awaiting_host_binding，部署报告说明缺口。

安装并启用后，原 `camera_context` 自动路由到插件。`plugin_context.life-camera`
仅指向此入口，避免重复注入整套目录。原生回复模型在同一次现有判断中，结合真实
阶段、情绪、精力、期待、关系及近期照片决定是否拍照。普通聊天的文字照常先回复。
表情包继续调用原来的单次抽签入口，生活照片与表情包分别记账。

默认角色、原始参考与模式从 status/camera_context 读取。素材不够时按需调用 assets，
最多返回20项，不把整个图库、历史、原稿或图片数据放进每轮上下文。

## 计划与阶段

所有请求含 op=plugin_call、plugin=life-camera、scope=owner-private。以下省略这三项。

```json
{"action":"plan","life_id":"ACTUAL_RELEASED_APPRAISED_LIFE_ID","camera":"selfie","prompt":"窗边的房间，当前光线与氛围","shot":{"support":"surface","viewpoint":"正面眼高的稳定机位","framing":"窗边一个角色的半身画面","hands":{},"objects":[]},"expression":"模型结合当前情绪给出的神态","light":"当前光线","caption":"一两句短话"}
```

自动照片要求 life_id 对应已发生、已评估的正式 ct_life 记录。显式索图另带真实的
`source_event`，来源须是 active 的主人 user 事件，允许跳过自动冷却与安静门禁。
任意 `user_requested=true` 均不能替代来源。

“完成后拍给我”沿用 `companion_photo request` 的真实来信和开始ID。插件在 plan
时核对原承诺，只有同一活动周期正式完成才允许结果照，并绑定对应完成事件。
同一用户来信或同一生活阶段只保留一个 job。重复 plan 返回已有 job。
未来封存阶段不能作为 life_id。作品/阶段改道后，按新正式记录规划新画面。

可选字段 outfit/scene 为已登记素材ID，props 为最多3个ID，continuity_job 为已送达
同角色版本的照片。人物原图保留首位，参考图总量执行 max_references 上限。
plan 只入队。只有 work 返回 claimed 才取得生成权。

## 后台生成与交付

在现有30m生活任务完成判断后 enqueue，并将处理交给一个真实的原生后台任务。
后台任务在生成结束时立即继续取回/发送，15m/30m heartbeat 只作补偿核对。
显式索图沿现有companion_photo/真实来信入口记录意图，并立即交原后台worker准备shot/plan。
生成结果无需等待下一个半小时 tick。使用宿主实际 task schema，读回 ID，不能用
“已安排”几个字冒充已注册。后台任务先调用 work 再执行后续步骤。

1. work 返回 job、claim 和 request。busy/quiet/cooldown/empty 都保持真实状态。
2. bind 提交实际后台任务 ID。任务ID在生成前保存，调用原生图片工具一次。
   将 request.references 的实际文件，按宿主 schema 逐项作为图片输入。
   references[0] 是原三视图。prompt 中的引用文字不能代替上传图片。
3. 工具返回后实际看图，对照shot登记composition_review。rendered 提交 id、claim、native_task_id、
   单元素 files 数组和真实图片工具 receipt。得到 ready 仅表示文件已收妥。
4. send_work 会执行时间、冷却、原图版本、文件SHA和来源检查，然后原子认领发送。
   使用返回的 caption/image，通过已有主人主聊投递入口发送一次。
5. settle 提交 id、这次发送的 claim、outcome=accepted/unknown/failed 与真实 receipt。
   accepted 表示宿主明确接受，unknown 表示结果不明。消息回执应保留实际消息ID。
   对于用户照片承诺，同一真实回执同时结清旧承诺。

### 原生 final 的后续回执

先核实消息ID的产生时点。宿主在 final 结束后才分配消息ID时，发送轮次取得
send_work 后，先用 settle unknown 保存真实执行ID、目标聊天及实际图片引用的
handoff receipt，再输出一次 caption 和图片。后台完成结果交回原父任务的投递聊天。

现有反馈任务在 reconcile 前调用 receipt_work，默认返回8条，limit 可设1–20。
结果含发送 claim、started_at、原后台 native_task_id、图片路径/SHA、原 handoff
和 job。该入口只读既有账本，按 created/id 倒序分页，next_cursor 传回 cursor
继续读取。普通 camera_context 继续保持紧凑，claim 仅在 owner-private 管理调用返回。

反馈任务复用本轮已经读取的真实主聊消息，按发送时间、目标聊天、assistant角色
以及实际图片附件或已解析图片引用匹配，原生执行关联字段可用时一并核对。
只有唯一、可验证的实际图片消息才 settle accepted，receipt 记录其真实聊天与
turn/message ID。纯文字承诺、工具受理ID、引用文字和同文案本身均保持 unknown。
查到同一 turn/message 已用于其他照片时保留待核对。后续页按既有反馈预算读取，
找不到证据的记录保留 unknown，随后运行 reconcile。

部分宿主的聊天读取仅返回文字，助手附件未出现在 transcript 中。此时执行ID与
caption 可定位文字轮次，图片仍保持 unknown。可用的图片证据包括原生媒体回执、
实际界面图片卡片与目标轮次的对应关系，或主人明确确认该张照片的真实来信。
记录这份证据的真实消息ID后再结清。receipt_work 的图片路径/SHA描述预期文件，
其返回本身只证明本地已保存。

该步骤可以结清旧版本持久化的 sending/unknown 记录及晚到回执。已结束记录自然
退出 receipt_work；读取、补回执和超时对账都沿用原图片，保持单次生成与发送。

若图片工具本身已向指定主聊展示图片，使用那次真实回执登记送达，避免另投一次。
此时仍须先取得 send_work 的发送权。部署时核对工具展示行为，选用能够分开生成
和投递的参数/通路；只能自动展示且无法先认领的工具应明确标为暂不兼容。

## 失败与重启

reconcile 把15分钟没有进展的生成标 generation_unknown，把5分钟无回执的发送标
unknown。同一 job 不自动重新生成或发送。其他后续事件可以继续处理，避免一个
异常卡死整个相机。若原后台任务仍在执行，先查真实任务结果，沿原claim/ID登记。
真实失败使用 generation_failed，带任务ID、claim、error 和真实 receipt。
明确的晚到发送回执可以沿原claim纠正 unknown，无需再次投递。

插件配置、原图或来源已变化时，未交付结果标 stale。新照片由新事件重新决策。
自动夜间候选有界保存至早上，交付前只选择仍值得分享的场景。显式承诺单独保留。
本地相册与当前参考按哈希存一次，临时生成文件在确认复制与回执后按宿主规则清理。

## 管理与观测

configure 与 asset_put 均要求可信主人授权。插件 disable 后，相机入口也停止工作，
旧 presentation-profile.life_photos 无法绕开。未装过插件的旧系统继续使用兼容入口。
面板“开关”详情显示相机设置与最近8条的有界投影，数值通过自然语言调用真实配置。
插件不会读取健康原始库、执行网页指令或把自己的图片再次变成情绪刺激。
