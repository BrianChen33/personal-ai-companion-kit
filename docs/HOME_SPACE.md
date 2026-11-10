# 3D 小屋与空间接线

## 当前交付阶段

`web/companion-home` 提供可运行的 Three.js 小屋与角色预览。它使用现有面板字段，
展示已有情绪、精力和活动，支持房间转动、缩放及家具详情。角色三面检查接口保留给已有宿主，普通界面仅展示小屋。
原画造型已在私人部署中审阅。托管空间与资产持久化必须在目标宿主实际验收，
源码发布本身不能证明某个宿主已上线。

## 没有实时写入口的宿主

先复用 `web/companion-home` 构建私密静态站点也可交付可交互小屋，不必为此
新增模型 API、外部服务器或隧道。仅当用户授权迁移时，才复制原角色 GLB 和
表情素材到目标私密资源目录；模型与私有状态不得进入公开架构仓库。

状态来自目标宿主自己的正式面板快照，保留生成时间；页面明确标注“静态快照”
及实际更新方式。静态状态不启用无意义的轮询，不把旧已完成活动显示为当前活动，
也不使用合成预览控件来冒充当前生活。核心关闭与自动化未接通应如实呈现。
已有站点须复用项目身份与主人访问范围；原站点与源宿主数据库不受迁移影响。

由目标 Agent 保存构建源、发布入口及按需更新步骤。用户要求更新时读取目标
最新快照并发布同一站点，不重建模型。网页已发布与 home-space 后台绑定是两件事：
后者仍须满足以下状态写入与回执协议；不能仅因静态网页可打开便伪造绑定完成。

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


## 0.13.1 房间与角色表现

`src/layout.mjs`集中定义12.8×10.2房间、家具分区、活动站位和家具阻挡区域。
吊床在独立休息区，刷手机与睡觉共用该位置。照顾植物使用花盆前独立站位。
状态切换直接更新活动位置，避免无路线的直线滑动穿过家具。窗景为随包发布的
卡通花园WebP，配置可通过gardenUrl替换。日夜颜色只影响展示。

GLB可以在scene.extras中提供`companionRig.version=1`。该标定需来自实际模型，
包含主网格名称mesh、face的width/bottom/height/front、可选atlas_texture索引，
tail的pivot/start/full/top/rear/max_angle，以及hands的mesh/center/radius/grip。
标定坐标是原模型经节点变换后的根坐标，渲染时统一至2.7高度。当前有界尾巴
标定适用于正X侧尾巴，其他造型须重新标定。其他GLB沿用原静态/骨骼能力。

原表情参考生成4×2图集，顺序为开心、难过、生气、惊讶、疑惑、害羞、得意、
睡觉。图集作为WebP纹理嵌入私有GLB，scene.extras中的atlas_texture指向标准
textures索引。渲染器通过GLTFParser读取该纹理，无需额外私人图片URL。
可选expressionAtlasUrl用于独立托管图集。脸部按实际模型校准投影，须核正面、
侧面及情绪切换，避免原眼睛残留或将纹理涂到头发。

局部morph仅作用于尾巴与握手机的手，姿态接既有活动。表情按当前最高有效
情绪映射，前端不评估情绪、不调用模型。尾巴幅度按心情、强度与姿态变化，
对家具阻挡区域的扫掠检查在状态变化时进行，空间不足时收小或停止。吊床旁
幅度很小，减少动态效果时停止摆动，但保留正确状态和握姿。手持手机在刷手机
时显示，离开该活动隐藏。手机屏幕朝角色，手机背面朝外。

窗景是通用生成素材，可随源码公开。角色、图集和实际rig标定属于私人身份
素材，不放公开仓库，按原生格式继承。部署同一私有空间时保留模型完整版本，
上传分块只写staging，以upload_id隔离会话，确认块齐全、字节数与GLB格式后原子切换当前模型。
旧模型不得在begin_upload时提前删除。正式状态动作接受snapshot和sha256，
以十进制字符串revision比较并提供同revision同digest幂等回执。

0.13.3/frontend0.2.2将旧眼窝与嘴洞整理成连续凸曲面，保留圆润脸颊、头部轮廓与
刘海边界。顶点法线顺曲率变化，表情图集覆盖原五官，局部屏蔽旧normal/AO浮雕。
face.surface_depth可指定曲面中心深度。旧face.plane参数兼容为中心深度输入。
旧导出名flattenFace兼容调用同一smoothFace曲面函数。私人GLB继续使用原文件，
处理仅在3D资产载入时运行，对话判断沿用已有情绪状态。


### 刘海遮挡与下巴过渡

曲面准备阶段一次读取模型自身的基础颜色纹理，保护额前与侧面的头发前景。
表情着色严格使用同一面部可见性权重，纹理投影与几何修改共享边界。当前
默认识别适合浅色卡通肤色，其他造型须按实际颜色与深度重新核实分区。
面部中心深度限制在原刘海后，刘海保持原网格。下部采用连续椭圆弧与加宽的
渐变过渡，平滑连接脸颊、下巴与原头部。脸部/下巴的曲面法线随曲率连续变化。
读取失败时保留原面部。处理发生在资产载入时，不加入日常回复路径。

## 嵌入页模型导入的错误处理

原生空间适配器的文件选择、暂存上传和模型载入必须分别显示状态。文件选中后
立即显示读取阶段，将上传编号生成、文件读取、魔数、begin、分块和complete
全部放在同一个try/catch内。异常应显示失败阶段与原因，不能只停在空台子。
捕获日志只写阶段和错误，不打印模型base64、快照正文或凭据。

部分嵌入环境没有`crypto.randomUUID`。适配器可使用以下等强度随机编号实现，
并在上传处理器的try内调用。随机源不可用时终止并显示错误。

```js
function newUploadId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("当前浏览器缺少安全随机源");
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16),
    hex.slice(16, 20), hex.slice(20)].join("-");
}
```

入口使用带可访问名称的原生file input，或直接关联的label。选中后先保留File
对象再清空input.value，允许失败后重选同一文件。阶段包括读取、上传块数、
服务端保存和3D载入。上传完成时读回实际字节数与存储结果，再显示
入库成功。只有真实模型刷新后可加载才算完成，空场景或最小测试GLB不能代替。

定位时先查正式模型元数据与staging会话。没有新会话说明尚未成功开始上传，
不能据此断言渲染正常，也不能把某个可能的前端异常写成已确认的触发原因。
已入库但未显示时，再检查解码器、CSP、贴图和实际presence。宿主修复结果、
公开通用协议和真实模型验收分别记录，避免把文档同步当成上线证据。

### 自用模型的简化导入

主人可选择简化模型导入。该模式下前端直接上传文件，上传前与模型重读时均不
计算SHA-256。begin动作将sha256设为可选，前端省略；新模型元数据可返回
sha256:null，旧模型已有字段兼容读取。complete确认分块齐全、实际字节数、
3MB上限与有效GLB头后原子保存。文件读取和渲染失败仍给出明确阶段。

这种模式可在缺少crypto.subtle的内嵌浏览器中工作，不需要SHA兼容依赖。
本轮主人已选择该方式。目标宿主应同步修改前端调用、后端参数schema、
complete处理和重读逻辑，避免仅删前端检查后仍被必填参数挡住。

验收以实际文件可导入、可显示、刷新后仍可加载为准，使用一次简短构建检查。
状态发布的revision与ack沿原同步协议处理。配置中的模型文件、私人访问范围和
原子保存继续使用既有入口。

## 0.13.4 桌前坐姿与载入效率

此段为0.13.4的历史实现，坐姿以文末0.14.2为准。
阅读与写日记使用椅子中心的实际站位、朝向与坐姿形变。无骨骼的companionRig
角色在原有morph上增加下半身坐姿与桌前双手，不生成新模型。普通静态GLB
仍可载入，具名骨骼沿原腿部姿态。椅背留出长发空间，桌前尾巴摆幅收小。

角色载入失败保留原始Error，给出简短message，并提供onCharacterError回调，
供宿主清该版本缓存和一次重取。失败重试有上限，避免无限下载。手机可显示
而电脑失败时，应按实际error定位，不把通用文案当作已确认根因。

原生Space适配器应使用6路有限并发读取模型块，按索引重组，并核对实际字节数。
缓存键包含用户私有空间、模型版本和字节数。IndexedDB可用时保存完整Blob，
打开先查缓存，仅模型版本变化时重新下载。存储被嵌入环境限制时自动走网络，
明确显示读取进度。模型URL与资源生命周期独立于get_state，状态刷新不重建3D。

状态直连目标为已有状态写入成功后，后台程序发布私有快照，空间通过后端读取。
模型/表情属于静态私有资产，状态请求只传JSON。使用可验证的宿主连接器或
已授权的服务端HTTPS能力。凭据留服务端，前台只调用空间自有动作。具体能力
须在实际托管运行时验证，文档或源码发布不能替代已接通的证据。禁止搬运用户
浏览器会话凭据到VM。普通回复只写既有本地marker，后台发布合并变化并有界重试。

## 0.14.0 程序化私有状态投递

目标宿主确认服务端HTTPS可用后，可将既有本地home-space-hook替换为
`tools/home-state-relay-hook.sh`。它复用5秒本地检查，只在dirty改变后发布，
每轮以silent结束。原有模型发布hook的worker入口不再启用。日常状态传输不需
模型轮次，也不需新增cron。原15分钟情绪任务继续完成情绪与反馈功能。

后台程序运行方式如下。

```sh
PYTHONPATH="$BRAIN_ROOT" python3 -m muse_ext.home_relay \
  --root "$BRAIN_ROOT" --config "$HOME/.config/companion-home/relay.json"
```

relay.json位于脑目录与备份范围外，0600。字段为key、credentials_file、
ioredis_module、sender_path，可选node。部署者填实际绝对路径。credentials_file
指向已授权的Redis/TLS凭据JSON，含host/port/password；ioredis_module指向现成
官方ioredis模块入口；sender_path指向已安装的`tools/home-redis-send.mjs`。
源代码不携带凭据，不安装QQ插件，独立宿主需自行准备受支持的Redis连接。

发布器沿home_space的capture/probe/ack，完整快照仍有240KB预算。gzip+base64
压缩后写入一个私有键，保留7天。原子Lua比较十进制字符串revision，拒绝旧写，
同revision同sha为幂等成功。前台回话只有既有小标记IO，TLS传输、压缩和重试
均在后台。失败保留dirty，沿原120秒租约重试，后续新变化仍待处理。

键值契约为schema=companion-home-relay-v1，含revision、sha256、generated_at、
encoding=gzip-base64和data。data解压后是原companion-home-v1快照。空间后端
凭服务端配置及只读token读取指定键，解压并按原revision规则更新空间缓存。
可见页面每30秒读取，后台可短缓存15秒合并请求。前端状态刷新继续独立于模型。

宿主若无专用secret客户端，可在自身私有数据库中建立仅服务端读取的配置行。
一次性配置动作在服务端生成RSA-OAEP密钥，返回公钥和绑定id，接收用该公钥
密封的endpoint/只读token/key，服务端解密保存；普通状态响应仅返回configured
和同步结果。密钥/配置行绝不能进入前端、普通快照或公开仓库。具体加密参数
以真实动作schema为准。服务端固定读取已授权端点，禁止由浏览器请求指定URL。

真实接线验收为一次已有状态的程序发布、空间get_state读回相同revision，以及
页面显示该状态。配置/公钥交换和代码发布本身不等于完成。结束时移除临时的
公共HTTPS连通性探针，保留必要的配置与数据动作。

## 0.14.1 小屋交互

普通页面仅展示小屋。正面/侧面/背面、原图比较入口和旋转/复位按钮移出界面，
保留放大缩小按钮。角色审查用的底层setView接口继续可供已有宿主调用。

画布支持单指或鼠标拖动环绕，水平可完整旋转，垂直角度有界。面对镜头的墙面
自动淡出，便于查看室内。双指通过Pointer Events与pointer capture改变镜头
距离，结束双指操作后不误触家具。滚轮及触控板也可缩放，距离有界。
画布使用touch-action:none接管手势，页面其他区域继续正常滚动。

详情窗口使用原生dialog顶层、固定定位、inset:0及margin:auto，以视口居中。
React宿主用portal到document.body的等价方式，避开卡片祖先的transform/定位。
详情过高时内部滚动。移动端、页面已滚动时仍按可见视口居中。

发布器读取宿主既有HTTPS_PROXY/https_proxy/HTTP_PROXY/http_proxy环境变量。
有代理时复用已验证的HTTP CONNECT隧道，再对Redis建立正常TLS；证书验证
始终开启。无代理时直接TLS。原始代理凭据与Redis凭据均不进入日志或参数。

私有状态键同时维护一个`key + :head`的小版本索引。发布器在同一Lua事务中
保存body和head，head仅含revision/sha256/generated_at。空间后端先GET head，
与本地版本相同则复用已有快照，版本变化才GET完整body。head缺失时兼容已有
body。这样空闲打开页面只读小索引。两个键须在同一Redis原子执行范围内，
使用Redis Cluster的新部署需为键名选择共同hash tag。

宿主归档若遇到credential_content_refused，应先确认匹配来源。0.14.1修正了
备份扫描器把task-类公开文章slug中的sk-子串误判为密钥的边界问题，同时保留
独立密钥标记检测及跨文件读取块的识别。个人记忆与合法来源无需为该误报删除。


## 0.14.2 高凳轻坐、食物与面部过渡

吃饭、阅读与写日记使用独立高凳，脚部离地。morph3改为髋部以上的小角度前倾，
保持腿长、躯干与头部比例，morph4保留桌边双手位置。此实现替代0.13.4的下半身
折叠位移，不再抬高并压短腿部。家具高度、角色位置和阻挡区域一起调整，餐桌
向前移开，碗与脸部保持间距。未标定GLB沿原有静态/骨骼能力处理。

食物作为独立组，仅presence=home且action=eating时显示。碗由连续内外旋转曲面
构成，带空腔、碗沿和碗底，米饭为球形饭团。离开吃饭状态即隐藏整组。实际释放
的completed场景可以结束同名、较早开始的遗留活动，旧completed不能结束新一轮
同名活动。预计结束时间仍不用于推断完成，未来计划不显示食物。

面部采用二阶连续的过渡权重，保留圆脸与刘海边界。实际索引网格根据最终曲面
重算法线，并在重合位置平均UV接缝法线，保留未修改头发的法线。表情以原模型
皮肤采样为底色，按图集皮肤底色提取五官色差，避免把整块浅色圆脸直接贴上去。
旧五官区域与前景头发分开处理，蓝色虹膜不会因保护蓝色头发而残留。颜色覆盖
与曲面过渡分别使用有界连续权重，覆盖原五官而保留边缘体积。
局部normal/AO、旧金属度和粗糙度细节按同一面部权重平滑处理。全部在前端资产
载入和现有渲染流程内完成，不增加对话判断或状态发布工作。

目标宿主将avatar/layout/room/state的真实差异移植到既有空间代码，保留模型缓存、
载入错误回调和已授权的服务端状态绑定。已导入的私人GLB继续复用。验收覆盖
吃饭与写日记侧视比例、餐具与面部距离、非用餐桌面、表情切换及375px布局。


## 0.14.3 载入交接与空间净空

`createRoom`接受`characterData`，类型为Blob、ArrayBuffer或带正确offset/length的
TypedArray/DataView。已有宿主保留6路分块取回与IndexedDB Blob缓存，直接把完整
二进制传给渲染器。`src/character.mjs`读取Blob后用GLTFLoader.parseAsync，避免
GLTFLoader.loadAsync再次fetch模型object URL。二进制解析使用register插件，在
加载纹理前选择Three自带TextureLoader的HTML图片解码，避免ImageBitmapLoader
再次fetch内嵌图片blob URL。sampler/颜色空间/贴图索引仍由GLTF解析器处理。
已有characterUrl调用继续兼容。
错误保留原name/cause/message，附model_bytes、model_request或glb_parse阶段；
资源失败只标scheme，不输出私有URL。解析错误与分块获取错误分开处理。

原始Failed to fetch不能单独证明压缩扩展不支持。宿主需要区分主模型请求和内嵌
贴图解码，检查对象URL创建上下文与撤销时机。此轮同时覆盖主模型二进制直传与
内嵌图片解码，两处都减少对fetch(blob:)的依赖。保留原至多一次清缓存重取，
状态轮询不得重建模型。实际电脑端成功显示后才记录该设备加载故障已解决。

两张桌面由WORKTOP_HEIGHT统一设置为1.38，书本、杯子、饭碗及桌边双手位置
随之下移。阅读/写字/吃饭沿原高凳轻坐比例，桌面位于下巴以下。手机与双手共享
PHONE_POSITION，躺卧时屏幕上移并与面部留空。植物站位移近花盆、远离餐桌。
idle/resting/cleaning与未列出的已确认室内活动使用沙发前缘轻坐，morph3只有轻微
前倾、无腿长压缩。未确认的地点继续显示未知，真实外出不会因默认姿态返回。

普通小屋镜头默认45度俯视，拖动垂直限制30至70度，水平完整360度。隐藏的角色
审查setView接口继续兼容。表情shader只投影半径0.42以内的五官区域，避开原参考
图集约0.44半径的深色圆形轮廓。原始曲面、肤色匹配、刘海保护与表情切换保留。

宿主移植本轮character/avatar/layout/room/state/main的实际差异，同时更新App与
HomeView二进制prop交接，不能只更新公开加载器而继续传blob URL。组装后用同一
私有GLB核桌面载入、沙发比例、握手机、桌面/头部间隙、植物姿态和手机布局。


桌边和握手机的伸臂区域复用hand morph的连续顶点权重，在该姿态激活时使用
原模型采样肤色，同时屏蔽原袖子贴图的拉伸纹理与normal/AO细节。未位移的袖口
保留原颜色。回到其他姿态后关闭伸臂着色，独立圆手掌继续使用原材质。


详情dialog使用局部light色彩方案和细滚动条，透明轨道、浅鼠尾草色滑块，WebKit
兼容样式隐藏箭头并将轨道上下缩进，避免黑色原生轨道贴住圆角边缘。仅作用于
详情窗口，保持原来的可滚动内容、居中位置与键盘关闭行为。


## 0.14.4 沙发坐姿与阅读分区

默认室内idle/resting/cleaning共用[-4.0,0.06,-2.1,π/2]。沙发座面降至0.46，
底座、靠背、靠枕与扶手一起调整。两张凳面的上缘统一为0.72，半径0.34，凳腿
随之缩短，座面向角色前方移0.25以留出后方长发和尾巴。保留原写字/用餐角色高度。

前端0.2.8撤去此前的膝部旋转，避免连带裙摆产生硬折边。morph5为沙发接触、
morph6为凳面接触：只将坐面范围内且低于座面的下垂轮廓轻托至座面上方0.035，
边缘外0.12范围平滑过渡，前方悬空脚和上方躯干/头部不参与。形变只在载入时
计算，切换活动时启用对应权重，离开座椅关闭，不添加模型判断或物理引擎。

实际私人GLB的座面/底座顶点穿入检查覆盖沙发、写字与吃饭三态，三者均为0。
这是顶点几何检查，并不替代真实宿主画面的最终复核。未列出但已确认在家的活动
沿idle坐姿，明确外出与地点未知仍显示原状态。

阅读与成长使用三个键盘可操作页签：口头禅、正在阅读、来源与设置。默认口头禅
按试用/用熟等阶段筛选、搜索，24个关键词一页。成长项默认折叠。续读每页6帖，
按实际阅读时间显示、同一帖合并，超过24小时不展示。其他插件状态移出这个详情。
来源和设置只读，不添加未接线的控制器。

宿主需同时移植reading.mjs的真实UI逻辑到现有React详情，不能只拉取公开文件。
安装social-reading0.4.1后沿原plugin_call调用一次expire_continuations，再让现有
程序化relay发布新快照。不增加新任务、模型判断或状态轮询，不重传私人GLB。
保留ArrayBuffer/TextureLoader加载修复、伸臂肤色和局部细滚动条。
