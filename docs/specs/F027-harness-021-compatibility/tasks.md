---
document: feature-tasks
feature: F027
status: in-progress
updated: "2026-10-23"
---

# F027 · 官方基座兼容任务

## 任务规则

文档先于实现；只记录真实验证结果。当前用户未授权计费模型、浏览器自动验收或 GitHub 推送。成功检查不重复运行，修改相关输入后才重验。

当前进度：Review 阻断启动的问题已修复，T004、T007 重新完成。新增回归实际声明并渲染 turnTail，覆盖先后加载、成功/失败/空结果与 Session 作用域请求；Chrome 155 已实际进入首页且无启动错误。此前 HTTP 和未声明槽位的注册测试不再作为 Client 激活的充分证据。T009 已取消自动首次使用弹窗并完成定向验证；T008 继续等待用户确认，原运行区未切换。

## 任务清单

- [x] T001 固定升级与恢复基线，保护现有源码和数据
  - 来源：NFR-003, NFR-005, AC-F027-001, AC-F027-003
  - 依赖：无
  - 修改：临时 Git index、.runtime/harness-021-upgrade、验证记录
  - 完成证据：源码树 4c607ba0700af259d77eb4cb14f5d86f84bb02e5，merge-state.json 与 original-data-hashes.json；3080 原服务已不在监听，无需停止其他进程
  - 验证：一次源码树和数据清单核对
- [x] T002 合并官方基座并保持既有产品扩展
  - 来源：NFR-005, REQ-033, AC-F027-001, AC-F027-002
  - 依赖：T001
  - 修改：upstream/deepseek-harness、三方冲突与构建配置
  - 完成证据：93 项冲突处理记录、冻结安装、8 个制品门通过；最新 Host/Client 聚合检查均通过，详见 2026-10-23 验证记录
  - 验证：安装和完整构建
- [x] T003 恢复可信请求和项目隔离链
  - 来源：REQ-001, REQ-035, NFR-001, NFR-007, AC-F027-004
  - 依赖：T002
  - 修改：Connection、FDE Host 路由与直接消费测试
  - 完成证据：未认证 401、令牌交换 303、owner 首页 200、跨来源 403、错误项目 404；WebSocket 授权升级成功
  - 验证：定向路由测试
- [x] T004 保留项目导航、会话视图及开发工作区
  - 来源：REQ-009, REQ-033, REQ-036, AC-F027-002, AC-F027-007
  - 依赖：T002
  - 修改：受影响 UI Slot、Store、Sidebar 与 FDE Client
  - 完成证据：项目浏览器 54 项、最新项目/阶段组合 55 项及输出首批 12 项通过；在线 Bundle 含双入口及新工具名，不含旧终端工具名
  - 验证：直接受影响 Client 定向测试
- [x] T005 保留平台 Skills 与独立实验室
  - 来源：REQ-030, REQ-031, REQ-032, REQ-034, AC-F027-005, AC-F027-006
  - 依赖：T002, T003
  - 修改：fde/stage、ui-fde-project、discovery-lab 的兼容部分
  - 完成证据：七项平台 Skills、技能中心阅读下载与真实 Loader 的离线训练授权/恢复用例通过；实验室 v4 工具结果与 Eval collector 已适配
  - 验证：现有 Skills/native-session 定向测试
- [x] T006 在隔离数据验证历史迁移与读取
  - 来源：REQ-010, NFR-003, AC-F027-003
  - 依赖：T003, T004, T005
  - 修改：隔离数据、必要的用量/评估兼容代码
  - 完成证据：history-validation.json：3 条旧会话发布 v4，31 轮、235 次调用及助手正文保持，旧代不变；35 份资料无 stale；原运行 27 文件和项目 247 文件保护核对通过
  - 验证：一次无模型历史恢复检查
- [x] T007 启动正确版本并交付人工体验
  - 来源：NFR-005, NFR-006, REQ-033, AC-F027-001, AC-F027-002
  - 依赖：T006
  - 修改：lock、README、AGENTS、架构、Agent Note 与 verification
  - 完成证据：running-verification.json：3082 认证后 200、实际 Client 版本 0.2.1-rc.2 与修复后的 Review 资源；隔离区只登记 1 个示例 Workspace，部署与版本文档已同步
  - 验证：一次线上资源与运行区核对
- [ ] T008 用户确认现有交付使用体验
  - 来源：REQ-033, REQ-034, AC-F027-002, AC-F027-005, AC-F027-006
  - 依赖：T007
  - 修改：仅处理本 Feature 人工反馈
  - 完成证据：用户明确验收意见
  - 验证：用户手动查看
- [x] T009 首次进入不自动弹出预览与凭证引导，保留主动配置
  - 来源：REQ-033, AC-F027-002
  - 依赖：T007
  - 修改：ui-settings-models 的公开初始化配置与注册、web-app 组合、直接相关回归与包说明
  - 完成证据：首次 29 项定向测试通过，修正测试类型后受影响的 14 项重验通过；8 项制品构建通过，最新 Host/Client 检查均通过；3082 认证后 200，在线初始化两项为 false，实际 Bundle 含新条件
  - 验证：无密钥定向注册/组件测试与在线制品核对；体验由 T008 人工确认

## Task 数量复核

9 项分别交付可独立核验的升级结果，不按前后端车道拆分。T009 承接人工反馈，不预先勾选实现或人工验收。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-10-23 | planned | 用户明确要求兼容最新版并先写 docs | 实现与人工验收尚未完成 |
| 2026-10-23 | 人工反馈修复 | review-list-regression.log 两种加载顺序通过；review-list-build.log 十项通过；chrome-boot-review-fix.json 启动成功 | 其余操作体验仍待用户确认 |
| 2026-10-23 | T009 完成 | onboarding-tests.log、onboarding-revised-tests.log、onboarding-build-check.log 与在线初始化配置核对 | 不执行浏览器回放，T008 由用户刷新验收 |
