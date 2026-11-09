# 3D 小屋与空间接线

## 当前交付阶段

`web/companion-home` 提供可运行的 Three.js 小屋与角色预览。它使用现有面板字段，
展示已有情绪、精力和活动，支持房间转动、缩放、家具详情及角色三面检查。
原画造型已在私人部署中审阅。托管空间与资产持久化必须在目标宿主实际验收，
源码发布本身不能证明某个宿主已上线。

实际角色模型、三视图、表情与部署配置放在公开 checkout 外。公开项目提供通用
房间、GLB 载入和状态映射。模型 URL 由部署者的私有配置指定。

## 本地预览

```sh
cd web/companion-home
npm ci
npm test
npm run build
```

部署页面同源提供 `home-config.json` 和 `state.json`。配置包含
`characterUrl`、可选 `referenceUrl`、可选 `stickerUrl` 和 `stateUrl`。
这些字段是本应用定义的资源接口，宿主接线需要使用真实已验证的工具。
所有私人资源与数据必须继承空间的主人访问范围。

浏览器加载器支持 Meshopt 网格压缩和 WebP 贴图。部署的 CSP 需为捆绑的
Meshopt 解码器允许 `script-src 'wasm-unsafe-eval'`，并为 GLB 内嵌贴图解码
允许 `img-src blob:` 与 `connect-src blob:`。这些 scheme 只用于本地解码，
模型与状态的网络请求仍由原有同源、私有访问范围控制。

私人模型发布前先检查正面、两侧与背面，尤其是身体连续性、手掌体积和尾巴
数量。压缩从已认可的原始模型生成，使用 2048px WebP 贴图、Meshopt 和有界
减面，保留节点与动作。压缩目标为约 3 MB 内，几何错误容差优先于固定面数。
压缩后的 GLB 须实际载入浏览器检查，外观通过后再用于动作与空间接线。

状态沿用 `generated_at`、`timezone`、`mood.labels`、`companion.energy`、
`companion.contact_desire`、`companion.activity` 与现有概览字段。
活动兼容 `name/activity`、`started_at/started`、`ends_at/ends`。
仅展示发生时间已到的活动，过了预计结束时间时等待新的正式状态。

`preview=true` 明确标注合成预览。动作、心情与精力控件仅修改浏览器内的合成
对象。编辑后保持本地选择。普通状态每 30 秒检查一次，页面隐藏时暂停。
资源和 WebGL 加载失败时，状态卡片保留可用。

## 私人造型审查

先以真实三视图制作同一角色的 GLB，保存可复用骨骼或命名姿态节点。正面、
侧面、背面交给主人确认，再制作完整动作与表情。可选动画节点协议使用
`Head`、`Tail`、`LeftArm/RightArm`、`LeftLeg/RightLeg`、
`LeftEye/RightEye`、`LeftBrow/RightBrow` 与 `Mouth`。
无骨骼模型使用整体位置与轻微待机变化。原表情素材通过私有 `stickerUrl`
或宿主的情绪素材映射接入。关节动作和面部表情按实际模型能力验收。

原生模型动画可提供 `idle` 与 `walking` clips。浏览器支持基本姿态，减少动态
效果的设备仍更新实际位置和表情。模型和房间资源按版本缓存，状态数据单独更新。

可以将私人合成状态、模型和参考图打包成一个离线造型预览。

```sh
node tools/export-preview.mjs STATE_JSON CHARACTER_GLB REFERENCE_JPG OUTPUT_HTML
```

此导出明确为造型与合成状态预览。当前脚本含完整 Three.js 程序与私有资产，
输出留在私人目录，发布前核内联脚本语法。正式离线状态导出沿原面板入口处理。

## Muse 空间的已核能力与部署门槛

本轮原生工具核验确认 fullstack 有持久托管数据及声明动作。当前已核接口包括
`artifact.create_web_fullstack`、`artifact.list_actions` 和
`artifact.invoke_action`。完整参数须在目标宿主实时读回。

此次宿主尚未提供 VM 直接推送的文档化 HTTPS、CLI 或 SDK 入口。可确认的状态
同步方式包括独立原生文件 hook 唤醒后台模型调用动作，以及原有 15 分钟后台
轮次末尾补漏。hook 脚本读取本地outbox，前端每30秒读取缓存。新鲜度仍取决于
后台worker排队与动作完成时间。

创建工具的 `research_dir` 描述用于已完成的文本研究目录。二进制 GLB、本地
源码及预构建包的摄入能力仍需实际核实。应在同一目标空间有界检查资源载入、
WebGL、主人访问范围和动作 schema，再进行真实状态迁移。

正式发布动作需要版本去重、旧状态拒绝覆盖新状态、原子保存与清晰更新时间。
页面短请求读取缓存状态。现有 SQLite 为唯一认知来源，页面动画不写入情绪或
生活经历。私人明细按访问范围和同一状态版本读取。

主人确认造型并确定同步方案后，再接发布器、原 heartbeat 和空间唯一入口。
公开代码、通用部署协议、provenance 与实际私库架构锁分别同步并核远端。

## 已发生的日常驱动位置

优先使用 `companion.activity.activity`，其次兼容旧版 `name`。仅 `active/paused`
与旧版明确开始时间生效，`awaiting_plan`、未来计划和主人的活动不能移动角色。
没有当前活动时读取已释放的 `daily_scene.scene`。

散步/跑步开始后，角色从小屋隐藏，显示“出去散步了/出去跑步了”和已有地点。
预计结束时间经过只表示等待更新。完成外出但未确认返回时显示位置待确认。
新的室内活动或可信的 `home_state={subject:"companion",presence:"home"|"away",
occurred:实际时间}` 才改变归属。`home_state` 是本应用可选投影契约，宿主原生
没有该字段时不得伪造。日夜与墙钟仅是本地展示，不会生成生活经历。

## 原生 hook 接线

1. 先验收唯一私有fullstack空间的WebGL、模型上传与刷新持久化、主人访问范围。
   浏览器文件选择器读取本机GLB，检查3MB预算与glTF魔数，再用宿主自己支持的
   鉴权JSON写入分块保存base64。此能力需实际构建验证。导入失败保留旧模型，
   完整上传后原子切换当前版本。
2. 在真实脑根目录写 `state/home-space-binding.json`，包含 `enabled:true` 与实际
   `space` slug。这是opt-in配置。成功状态操作只原子写 `home-space-dirty.json`，
   普通回复不构建面板、不联网、不增加模型。
3. 将 `tools/home-space-hook.sh` 安装到宿主hooks脚本目录，并绑定实际脑根目录。
   用实际 `hooks.add` 注册5秒本地检查，投递系统调试，先dry_run再enable。
   工具schema、聊天ID与路径均由目标宿主查证，不写进公开源码。
4. hook worker运行 `python3 -m muse_ext.home_space --root BRAIN_ROOT capture`。
   outbox含 `snapshot/sha256/dirty_revision`，snapshot含十进制字符串revision。
   调用真实声明的set_state动作，确认同revision与sha256后才执行
   `ack --revision … --sha256 …`。120秒租约限制失败重唤醒。发布期间新dirty
   不被旧回执吞掉。无变化本地silent，不唤醒模型。后台不发主聊通知。
5. set_state在同一事务比较revision，旧写拒绝覆盖新写。同revision同digest为
   幂等成功，异digest为冲突。回执返回实际存储revision和digest。空间前端通过
   宿主鉴权数据接口读取同一版本快照，VM文件与私人资源保持私有。
6. 原15分钟任务末尾复用capture/publish/ack补漏，原30分钟日常不新增定时器。
   资料库HTML作为明确的离线导出，空间验收后作为日常管理唯一入口。

静态模型、原表情、三视图独立导入一次，状态刷新不夹带base64图像。动态投影
上限240KB，人物100位、日常20条、摘要12条、词汇1000个关键词。完整历史保留
于原数据库与原格式备份。上限错误须报告，失败时保留上次成功同步时间。
