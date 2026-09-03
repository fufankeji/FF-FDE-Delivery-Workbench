---
document: feature-tasks
feature: F010
status: in-progress
updated: "2026-08-28"
---

# F010 · 六阶段项目进度任务

## 任务规则

- 当前只交付六阶段定义、项目级当前阶段和空白项目工作指引；完整项目进度页面转由 F011 负责。
- 工作指引可解释每阶段规范输入和规范产出，但不创建、不统计也不伪造任何阶段文件、确认项、通过条件或推进动作。
- 每个 Task 只有真实完成证据和一个最窄验证方法后才勾选。

## 任务清单

- [x] T001 冻结六阶段项目进度合同
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-001～AC-F010-004
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F010 三件套
  - 完成证据：六阶段名称、顺序、高层目标、项目级归属和无推进边界已落盘
  - 验证：PRD、Product Spec 与 F010 定向规格校验

- [x] T002 建立 Workspace 级初始阶段持久状态
  - 来源：REQ-001, NFR-007, NFR-008, AC-F010-003, AC-F010-004
  - 依赖：T001
  - 修改：`packages/fde/stage/`
  - 完成证据：明确 Workspace 首次读取初始化为 `requirements`；重复读取、并发读取和重启恢复返回同一项目状态；无阶段变更入口
  - 验证：FDE Stage Host 聚焦测试

- [x] T003 建立共享阶段读取控制器
  - 来源：REQ-001, NFR-005, NFR-007, AC-F010-003, AC-F010-004
  - 依赖：T002
  - 修改：`packages/client/ui-fde-stage/` controller 与读取协议
  - 完成证据：按 WorkspaceId 合并加载，发布稳定加载/成功/失败状态，重试不使用其他项目缓存
  - 验证：FDE Stage Client controller 聚焦测试

- [x] T004 呈现空白提示和当前阶段
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-001, AC-F010-002, AC-F010-004
  - 依赖：T003
  - 修改：FDE Stage Client Slot registrations、组件、主题样式和中文文案
  - 完成证据：空白会话显示紧凑提示；已开始会话显示头部阶段；完整项目进度不进入会话页签
  - 验证：FDE Stage Client 组件与 Slot 注册测试

- [x] T005 组合两个阶段插件并保持现有主链
  - 来源：REQ-001, NFR-005, NFR-008, AC-F010-002, AC-F010-003
  - 依赖：T002, T004
  - 修改：Web Bundle、TypeScript 聚合、包索引、README 与 Agent Note
  - 完成证据：Host/Client rows 进入 Boot 组合；项目、会话、官方对话与右侧开发 Dock 保持原路径
  - 验证：两个新包构建＋官方完整构建

- [x] T006 重启并交付人工验收
  - 来源：REQ-001, REQ-002, NFR-005, NFR-007, AC-F010-001～AC-F010-004
  - 依赖：T005
  - 修改：运行服务与 `docs/verification/`
  - 完成证据：3080 返回 200，实际 Client 包与 Host 初始化入口可达，页面等待用户检查
  - 验证：启动日志＋HTTP/配置检查；不执行浏览器截图自动化

- [x] T007 从会话内移除完整交付流程页面
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-001, AC-F010-002, AC-F010-004
  - 依赖：T004
  - 修改：`packages/client/ui-fde-stage/` 的 `conversation.view` 注册、组件、样式与测试
  - 完成证据：空白提示和会话头部当前阶段继续可用；“对话／轨迹”旁不再出现“交付流程”，六阶段定义可由 F011 复用
  - 验证：FDE Stage Client Slot 注册与组件聚焦测试

- [x] T008 对齐空白阶段提示与输入卡
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-002
  - 依赖：T004
  - 修改：`packages/client/ui-fde-stage/src/client/stage.module.css` 与阶段样式合同测试
  - 完成证据：阶段提示条复用 Composer 的 card max-width 和双侧 clearance，在宽屏与收缩宽度下和输入卡拥有相同左右边界
  - 验证：FDE Stage 样式合同聚焦测试

- [x] T009 在阶段门成功后刷新项目交付阶段提示
  - 来源：REQ-001, NFR-005, NFR-007, NFR-008, AC-F010-003
  - 依赖：T003
  - 修改：`packages/client/ui-fde-stage` Workspace 级变更监听、强制刷新与 controller 测试
  - 完成证据：需求调研门成功后，会话头部与空白提示重新读取该 Workspace 的已提交阶段，不继续显示旧 revision，也不刷新其他项目
  - 验证：FDE Stage controller 聚焦测试

- [x] T010 对齐人工返回后的阶段读模型
  - 来源：REQ-012, NFR-005, NFR-007, NFR-008, AC-F010-005
  - 依赖：T009
  - 修改：F010 规格与现有 Workspace 级阶段失效通知回归测试
  - 完成证据：人工返回后同项目会话重新读取新 revision 和当前阶段，另一项目不刷新；写动作仍不进入 F010
  - 验证：F010/F011 controller 联合聚焦测试

- [x] T011 优化空白项目的品牌与当前阶段工作指引
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-002, AC-F010-004
  - 依赖：T004, T008
  - 修改：`packages/client/ui-conversation/` Hero 品牌层级与通用输入提示；`packages/client/ui-fde-stage/` 工作指引卡、六阶段规范输入/产出和聚焦测试
  - 完成证据：空白项目首页使用清晰的品牌主副标题；指引卡在同一视觉轴上呈现真实当前阶段、目标、规范输入/产出、当前问题和六阶段位置，不显示虚构数量或完成态
  - 验证：Conversation Hero 与 FDE Stage 组件/样式聚焦测试＋两个目标 bundle

- [x] T012 按人工验收收敛为空白项目轻量阶段入口
  - 来源：REQ-001, REQ-002, NFR-005, AC-F010-002, AC-F010-004
  - 依赖：T011, F011
  - 修改：`packages/client/ui-fde-stage/` 轻量阶段栏与导航事件；`packages/client/ui-fde-project/` 当前项目详情导航接收；相关文档和聚焦测试
  - 完成证据：删除工作入口中的六阶段全景和输入/输出大卡，只保留阶段、行动提示与“查看项目进度”；点击后打开当前 Workspace 的项目详情
  - 验证：FDE Stage 组件/样式测试、Stage/Project 导航测试及两个目标 bundle

## Task 数量复核

- 任务总数：12
- 原因：T012 根据人工验收撤回过重工作指引卡，补齐此前遗漏的轻量可点击入口；阶段决策仍属于 F005，完整项目信息仍属于 F011。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | in-progress | 用户确认六阶段并明确先制作面板与进度管理；T001 文档合同已建立 | T002～T006 待执行；阶段输入、产物与门槛明确延期 |
| 2026-08-26 | implementation-ready-for-manual-review | T002～T006 已实现：Workspace 级 `requirements` 记录、共享 Client controller、空白提示、头部状态和中央交付流程已组合；8 个聚焦测试与官方完整构建通过；数据分析项目在 Host 重启前后保持 revision 1 和原时间戳；3080 已重启 | 页面视觉和真实项目/会话切换待用户人工确认；阶段推进、输入、产物和交付门未实现 |
| 2026-08-26 | scope-adjusted | 用户明确要求把完整项目进度移出会话，改为 F011 左侧一级独立页面；T007 已规划但尚未开发 | 现有运行页面仍保留“交付流程”页签，待与 F011 一起开发和验证 |
| 2026-08-26 | implementation-ready-for-manual-review | T007 已完成；阶段 Client 只注册空白提示与会话头部状态，Slot 聚焦测试和官方完整构建通过，F011 接管独立多项目进度页面 | 阶段推进、输入、产物与交付门仍属于 F005；页面视觉等待用户人工确认 |
| 2026-08-27 | in-progress | 用户人工验收发现空白阶段提示整体比输入卡向左错开一侧 clearance，新增 T008 | 只修复共享宽度轴，不修改阶段数据、Slot 或输入框本身 |
| 2026-08-27 | implementation-ready-for-manual-review | T008 已完成：阶段提示使用 Composer card max-width、双侧 clearance 和水平居中；F010/F016 联合聚焦测试 8 个文件、14 项全部通过，目标 bundle 已重建并重启 3080 | 不运行截图自动化；等待用户复验实际对齐效果 |
| 2026-08-27 | in-progress | 用户确认需求调研已进入方案设计，但项目交付头部仍显示 1/6；新增 T009 只处理已提交阶段的 Workspace 级缓存刷新 | 等待实现、聚焦测试与人工复验 |
| 2026-08-27 | implementation-ready-for-manual-review | T009 已完成：阶段门只在 Host 成功后发送 WorkspaceId 级失效通知，项目交付控制器重新读取持久阶段；发送端与接收端聚焦测试通过 | 等待用户刷新页面并复验头部显示方案设计 |
| 2026-08-27 | current-slice-complete | T010 完成：人工返回复用现有 WorkspaceId 级失效通知，同项目会话重新读取 Host 的新 revision 和当前阶段，其他项目不被刷新；F010 仍没有任何阶段写入口 | FDE Stage controller/组件 4 项聚焦测试及完整构建通过；等待用户手动切换同项目会话验证顶部阶段 |
| 2026-08-28 | in-progress | 用户确认优化空白项目首页：放大并强化品牌标题，增加品牌副标题，把含义不清的紧凑阶段条升级为当前阶段工作指引卡 | T011 待实现；只使用现有阶段状态和固定阶段规范，不新增业务数据或伪造状态 |
| 2026-08-28 | implementation-ready-for-manual-review | T011 已完成：Hero 使用更大的品牌主标题、业务副标题和通用项目输入提示；空白会话按真实当前阶段呈现目标、规范输入/产出、当前问题和六阶段方位 | 3 个聚焦测试文件 20 项通过，Conversation/FDE Stage 两个 bundle 通过，F010 规格校验无错误或警告；3080 已重启并返回 HTTP 200，等待用户人工检查视觉效果 |
| 2026-08-28 | manual-review-rejected | 用户人工检查认为工作指引卡视觉过重且难看，并指出轻量入口没有实现；对照 Linear、Codex、GitHub Projects 后新增 T012 | T011 的品牌主副标题保留；撤回大卡与六阶段细线，补齐真正可点击的当前项目进度入口 |
| 2026-08-28 | implementation-ready-for-manual-review | T012 已完成：空白工作入口撤下六阶段全景、规范输入/产出与当前问题，只保留阶段序号、名称、一句行动提示和“查看项目进度”；点击后直接打开明确 Workspace 的项目详情 | 3 个聚焦测试文件 5 项通过，FDE Stage/Project 两个 bundle 与定向 OxcLint 通过，F010 规格校验无错误或警告；3080 返回 HTTP 200，等待用户人工检查视觉效果 |
