# @deepseek-ai/dsh-fde-project

[English](README.md) | 中文

HTTP 接口共享 Connection 的部署请求检查：默认仅本机；显式 `--lan` 时接受本机 IPv4 与监听端口上的同源请求。此模式无登录鉴权，特权设置仍限本机。

FDE 项目交付页面使用的可信 Host 支持。它只解析显式 Harness WorkspaceId，只读取该项目的 `.fde/project-runtime.json`、`.fde/api-docs.json`、`.fde/architecture.json`、`.fde/evaluations/`、`.fde/deployment-trial.json`、`.fde/acceptance-handover.json`、六阶段固定产物和标准项目开发文档，校验有界结构后，通过同源接口返回一个浏览器快照。阶段产物读取器只报告已有、缺失或读取失败，不创建文件，也不把文件存在当成确认；已有的 Markdown 产物会获得有大小限制的同源只读预览地址，Host 按已索引产物标识选择文件，不接受浏览器传入路径。它还适配锁定版本 `dsh-openapi` 的解析和 HTTP 实现，使标准 OpenAPI 工具按调用 Agent 所属的已注册 Workspace 解析配置，而不是使用进程级共享 API 清单。

## 项目基础信息

`GET /api/fde-project/usage?workspaceId=…` 只允许受信同源请求读取已登记 Workspace 所属会话的数值用量。它使用已连接投影或公开投影缓存的冷回放，不激活 Agent、不返回消息。每条会话返回累计统计、Token 总量和按调用时间生成的活动，或明确的不可用状态。请求不能指定会话 ID 或文件路径；客户端断开时取消历史读取。投影服务卸载会移除路由。

`POST /api/fde-project/metadata` 只接受可信的已登记 `workspaceId`，不接受任意目录。不传 `metadata` 时读取 `.fde/project-metadata.json` 中的企业与交付周期，文件缺失返回 `null`；传入时在文件锁内创建缺失记录，保留已有记录。日期必须是真实日历日期且结束不早于开始；损坏文件、符号链接和过大记录均拒绝处理。该接口用于项目创建与旧浏览器数据导入，不用于修改已有周期或批准阶段。项目中心与 Workspace 侧栏共享其客户端投影。

## 项目开发文档

只读研发投影扫描 `docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md`，以及最多 100 个规范 `docs/specs/FNNN-slug/{spec,plan,tasks}.md` Feature 目录。可选 frontmatter 提供标题、状态、计划日期、里程碑和阻塞；Markdown 未勾选/已勾选任务是唯一任务数量来源。缺少日期时保持未知，重复 Feature ID 会被报告，浏览器没有反写任务 API。同一投影还报告 `fde-deliverables/03-project-development/` 下三份收口文件。Host 提供字节前会重新索引每个预览 ID，并用 realpath 检查文件仍位于已登记 Workspace 内。

## 项目运行

`POST /api/fde-project/runtime/preview` 只接受可信请求中的 Workspace ID，从运行记录解析已启动地址。临时 loopback 代理为每个项目分配随机 `*.localhost` 来源和 OS 分配端口，与工作台存储和其他项目隔离。页面与资源正文保持原样，支持 HTTP 流和 WebSocket 升级；嵌入响应头适配实际工作台父页面，同目标重定向和请求来源映射到对应入口，Cookie 移除 Domain 属性。每次请求重新核对运行记录；观察到停止或地址变化后，已有流最迟在下一次一秒周期检查中关闭。卸载关闭监听与连接。任意目标、工作台端口、跨来源写入和外部重定向均拒绝，不改项目源码或持久状态。对硬编码绝对来源、跨站登录或不支持的 HTTPS 嵌入环境，浏览器保留显式原地址备选。

一次明确的启动或停止请求会在 `.fde/project-runtime.json` 中创建一个精确操作，并绑定必须执行它的 Session。可见 Agent 读取项目自己的 `AGENTS.md`，使用 Better Sidebar 持久终端工具，验证真实 loopback 项目地址，再通过 `project_runtime_report` 结束该操作。启动阻塞后，如果同一 Session 在同一操作中补齐条件并验证了真实预览地址，可以恢复为运行中；Host 仍会拒绝过期 operation id、其他 Session 的报告、非 loopback 或带凭据的 URL、越过项目的 OpenAPI 路径和其他无效状态迁移。停止项目时，只有 Agent 如实报告服务已经退出后，才清除项目预览与 API 运行事实，同时保留终端标题和可回看的输出。停止结果不明确时必须先重试停止，不能再次启动。

## 验证合同

验证投影会有界解析 schema v2 的 `.fde/evaluations/validation.json`，包括候选版本、环境、项目适用数据、指标、结果和问题。每个指标都必须引用一份或多份此前阶段的真实项目文档，并给出文档内编号。PASS 或 WARN 结果的 `evidence` 必须是一条非空的项目相对路径文字，不能使用数组；WARN 的接受理由必须使用 camelCase 字段 `waiverReason`。证据还必须解析到已登记 Workspace 内真实文件。单个指标格式错误时，投影会保留有效的候选版本、环境、数据集、其他指标、问题和独立索引的阶段产物，便于诊断；但整份合同仍保持无效，不生成摘要，也不能确认方案或推进阶段。验证计划存在且所有来源可读取后，同源精确方案操作会把 FDE 确认原子写入 `.fde/evaluations/validation-plan-approval.json`。其 SHA-256 摘要覆盖候选、环境、数据和指标定义，但不包含执行结果、证据、问题状态和 FDE 指标决定：修改方案会使旧确认失效，正常写回结果或决定则不会。FDE 可以对一条仍为 open 的问题填写非空理由；带锁的精确合同操作保留原问题，并写入 `status=waived`、`waiverReason` 与 `waivedAt`。FDE 也可以单独接受一个尚未满足的必需指标；带锁操作写入 `result.manualAcceptance.reason` 与 `acceptedAt`，同时保留真实 NOT_RUN／FAIL、证据缺口、数值和说明。两种操作都只解除自身阻塞，并拒绝过期方案摘要。没有合格证据或完整指标接受记录的必需指标、未接受 WARN、未关闭 critical／high 问题、不完整的问题接受记录、固定产物缺失，以及方案尚未确认或确认已失效，都会保持为明确阻塞项。同一快照还索引 `fde-deliverables/04-validation/{validation-plan,validation-report,validation-baseline}.md`，供页面有界预览；它不会运行验证或推进交付阶段。

## 交付收口合同

部署试运行投影有界解析 schema v1 的 `.fde/deployment-trial.json`，验证其中的验证、部署、健康检查、回滚、试运行和问题证据路径仍位于已登记 Workspace 内，并索引 `fde-deliverables/05-deployment-trial/` 下四份固定 Markdown。只有目标环境已明确授权、候选版本存在、`status=ready`、五类证据与四份产物齐备，而且 critical/high 问题均已解决或人工接受时，快照才标记可提交；解决、接受和延期决定仍保留说明与责任。一个精确合同的同源动作允许 FDE 在填写非空理由后接受一条 open 或 deferred 问题，并且只改变该问题。另一项独立的精确合同动作只在证据、问题决定和产物已经齐备时可用，用于原子记录 FDE 的目标环境授权与 `status=ready`，但不执行部署、停止或回滚。文件锁和 SHA-256 摘要会拒绝过期决定。

验收移交投影有界解析 schema v1 的 `.fde/acceptance-handover.json`，支持最多四十份项目相对的企业验收证据，验证项目相对证据与交付物文件，只记录外部 HTTP(S) 交付物而不主动获取，并索引 `fde-deliverables/06-acceptance-handover/` 下四份固定 Markdown。一项带文件锁的精确合同 FDE 操作只能更新验收结论与证据、各登记交付物的可取得状态、条件决定，以及三项责任移交事实和证据；它拒绝过期摘要和已变化的条目集合，并保留交付物标识、位置、版本与校验值。项目完成条件包括：验收通过或带条件通过且有证据、部署试运行基线可读取、至少一项交付物可取得、无开放条件、接受条件包含理由/责任/后续安排、培训/权限/运维责任与项目内证据均已移交，以及四份产物齐备。记录这些事实不会完成项目，固定 Host 阶段路由仍要求一次独立的最终确认。两个投影都不执行部署、不上传或下载制品、不认证客户、不完成签章，也不自行推进项目。

## V2 交付工作台

项目快照只读取已登记 Workspace 的正常阶段记录，不返回独立演示快照或另一条生命周期。用户授权的联调数据继续使用同一阶段文件、证据校验与推进接口，来源写入记录，不新增产品模式。

V2 阶段六至八快照新增只读 delivery 投影。版本清单与证据以项目内路径和 SHA-256 固定；缺失或变化的证据不满足阶段评审。本地、Sandbox、试点、生产、前序材料范围独立，语义依赖按需显示快照或运行时接入。读取不启动服务、不替客户批准、不修改项目数据。


## 记录完整性与评审边界

固定产物必须是本项目内非空、非纯空白的普通文件。第三阶段空调查项需要 `investigation.notApplicable.<数组名>={reason,evidenceRefs}` 明确说明不适用；未知事实、缺责任人和待确认动作边界阻止评审。第五阶段 PASS 的 `evidenceDigests` 将证据相对路径绑定到 SHA-256；缺少绑定或内容变化均失效。阶段与交付投影保留 `dataProvenance`，联调／模拟输入不能证明真实交付通过。以上仅校验文件完整性与记录声明，不是独立执行认证或客户验收服务；FDE 仍需核对实际运行和批准证据。

## 模型体验

### V2 第五阶段证据读取

稳定、无参数的 `project_evaluation_get` 工具按调用 Session 解析已注册 Workspace，返回第五阶段受测版本、指标、证据缺口与当前验证指纹，不写文件或运行测试。`.fde/stages/evaluation.json` 保存 `evaluation.candidate`（`summary`、`version`、`sourceFiles`）与 `evaluation.testing`（`environment`、`metrics`、可选 `run`）。指标使用 `id/title/kind/required/criterion/sourceRefs`；运行结果使用 `metricId/status/value/evidenceRefs` 和执行前取得的指纹。结果保留 NOT_RUN/RUNNING/PASS/WARN/FAIL；候选文件、版本、环境、指标或来源变化时标为 STALE。必测项非 PASS、缺少数值或证据、记录结构错误和文件不可读均阻止阶段验收。路径必须位于项目内；每份路径清单最多 100 项，最多 256 个不同文件，单文件 8 MiB，总计 32 MiB。不设置开发任务门槛，也不扫描整个项目。该 V2 记录与上文旧验证合同独立。固定 Schema 增加输入 Token；有界元数据只在调用后进入上下文，不改变 Schema 缓存前缀。工具检查文件存在性，不证明测试报告的真实性，仍需 FDE 核对。

### 项目 OpenAPI 与系统架构工具

#### 模型看到什么

五个稳定工具 Schema：`openapi_list`、`openapi_describe`、`openapi_call`、`architecture_get` 和 `architecture_set`。执行时，每个工具通过 Workspace 注册表解析 `exec.agent.session.header.cwd`。OpenAPI 结果只包含当前项目的接口元数据或有界 HTTP 响应；凭据保持为环境变量引用，不进入工具参数或结果。系统架构写入要求精确当前 revision，并原子替换一份完整候选。

#### Token 影响

能看到全局工具注册表的 Agent，其每次请求会增加五个固定 Schema 的输入 Token。项目接口目录和系统架构文件只在工具被调用后加载，并且只通过该次有界结果进入上下文。

#### KV 缓存影响

Schema 在不同项目和请求之间保持一致，因此修改当前项目 OpenAPI 文件不会改变可缓存的工具 Schema 前缀。工具结果只改变普通对话后缀。

### 项目运行报告工具

#### 模型看到什么

一个稳定的 `project_runtime_report` Schema。可见的启动或停止指令提供精确 operation id；工具按调用 Session 解析已注册 Workspace，并只接受该操作对应的状态和已验证运行事实。

#### Token 影响

能看到全局工具注册表的请求会增加该固定 Schema 的输入 Token。操作专属 id、URL、终端标题和失败原因只通过可见用户指令与有界工具结果进入上下文。

#### KV 缓存影响

Schema 在不同项目之间保持稳定；每次操作只改变普通对话后缀。

## 已知限制与延期工作

- 本包不会自行执行服务命令、运行评估或创建系统架构产物；启动和停止工作由可见项目 Agent 通过持久终端完成。
- 本包不会根据 Git 历史、文件时间、Agent 回复或对话内容推断日期、任务完成和 Feature 状态，也不会编辑项目 docs。
- API 文档必须来自项目显式文件或已验证的运行中项目报告；没有 OpenAPI 时保持未配置状态。
- 评估报告当前只读。单个指标格式错误时，其他有效合同事实仍可用于诊断，但 Host 不会修复错误，也不会把部分投影视为可确认合同。
- 部署试运行与验收移交记录仍是项目文件。Agent 维护候选说明与固定文档，保留的 FDE 决定字段归属项目进度中的精确合同操作。Host 不执行部署、不探测外部交付物地址、不收集客户签章，也不管理凭据。
- 适配层刻意复用锁定插件的解析和请求模块，因为上游插件的进程级静态 API 清单本身无法提供 Workspace 隔离。
- 系统架构历史以文件形式保存在 `.fde/architecture-history/`；浏览器当前只展示最新版本。
