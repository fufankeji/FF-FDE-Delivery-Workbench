---
document: feature-tasks
feature: F009
status: in-progress
updated: "2026-08-26"
---

# F009 · 项目开发工作区任务

## 任务规则

- 一个 Task 交付一个可独立验证的结果，可以跨页面、服务、数据、模型和测试。
- 不使用技术车道标签；只有真实完成证据和最窄验证通过后才勾选。
- 当前任务只覆盖右侧文件树/编辑、外部变化、Git Diff 与按当前会话/轮次组织的 Agent 文件审查，不提前实现评估或部署。

## 任务清单

- [x] T001 冻结项目开发工作区与右侧 Dock 合同
  - 来源：REQ-015, NFR-010, AC-F009-001～AC-F009-004
  - 依赖：无
  - 修改：PRD、Product Spec、Feature Map、Architecture 与 F009 三件套
  - 完成证据：PSC-017、DEC-022、PSD-013 与当前插件/降级边界落盘；DEC-021/PSD-012 保留为被替代历史
  - 验证：PRD、Product Spec 与 F009 Feature Spec 校验器

- [x] T002 替换为锁定的右侧工作台与审查插件
  - 来源：REQ-015, NFR-005, AC-F009-001
  - 依赖：T001
  - 修改：Web Bundle 依赖、Cordis row 与 `pnpm-lock.yaml`
  - 完成证据：Workbench Layout 及 patch 完整移除；`dsh-better-sidebar@0.16.1` 与 `dsh-file-review-tab@0.2.0` 以精确版本进入实际 Web Profile，来源提交和许可证可追溯
  - 验证：依赖解析与 `dsh --profile web --dump-config`

- [ ] T003 保持项目/会话与中央对话并建立右侧 Dock
  - 来源：REQ-015, NFR-010, AC-F009-001, AC-F009-004
  - 依赖：T002
  - 修改：工作台实际组合、必要的最小 FDE 兼容适配
  - 完成证据：F001 项目树和官方中央对话不移动；右侧 Files/Git/Review 可展开和收起
  - 验证：当前组合构建＋用户人工 Dock 检查

- [ ] T004 接通代码保存、Git Diff 与 Agent 文件审查
  - 来源：REQ-015, NFR-003, NFR-008, NFR-010, AC-F009-002, AC-F009-003
  - 依赖：T002
  - 修改：工作台 Host/Client 能力组合与必要兼容配置
  - 完成证据：文本保存和失败真实；Git Diff 与按会话/轮次的 Agent 变化各自可查看，Code Mode 变化可重建，无法归因/撤销时诚实降级
  - 验证：插件聚焦测试证据复核＋当前组合构建＋用户人工文件/Git/Review 检查

- [x] T005 验证右侧插件不会破坏当前 FDE 主链路
  - 来源：REQ-015, NFR-005, NFR-008, AC-F009-001, AC-F009-004
  - 依赖：T003, T004
  - 修改：必要聚焦测试、README/Architecture 同步
  - 完成证据：品牌、项目创建、项目资料入口、会话对话和工作台组合成功构建
  - 验证：最窄相关 package/bundle build

- [x] T006 重启并交付人工产品验收
  - 来源：REQ-015, NFR-010, AC-F009-001～AC-F009-004
  - 依赖：T005
  - 修改：运行服务、验证记录与任务执行状态
  - 完成证据：3080 使用隔离 `DSH_HOME` 返回 200，页面可供用户检查左侧项目/会话、中央对话和右侧开发 Dock
  - 验证：启动日志＋HTTP 可用性检查，不执行浏览器截图自动化

## Task 数量复核

- 任务总数：6
- 原因：按合同、插件替换、右侧 Dock、文件/Git/Agent 审查、现有主链兼容和运行验收六个独立结果拆分，没有包含工程验证上线。

## 执行记录

| 日期 | 状态变化 | 完成证据 | 偏差/剩余项 |
|---|---|---|---|
| 2026-08-26 | in-progress | 用户确认插件优先并授权实现左侧开发工作区 | T001～T006 待执行；按 Agent 轮次归因的审查明确不在当前切片冒充完成 |
| 2026-08-26 | T001-complete | PRD、Product Spec 与 F009 定向校验通过；PSC-017、DEC-021、PSD-012 已落盘 | 进入插件组合；其余 Task 待执行 |
| 2026-08-26 | implementation-ready-for-manual-review | T002、T005、T006 完成：精确依赖与 Cordis row 已组合；受控 patch 保持首次项目入口、默认收起编辑区并统一主要项目文案；最终官方构建成功，Boot Manifest/Client 脚本/Host API 可达，3080 已重启 | T003、T004 的可见布局、真实保存/冲突与 Diff 仍待用户人工确认；不运行浏览器自动化 |
| 2026-08-26 | sidebar-anchor-fix | 根据用户截图确认插件已加载但模式条未显示；修复原插件对外置主按钮兄弟节点的假设，增加 FDE 项目浏览区域顶部回退锚点；语法检查、完整构建和最终 Client 提供均通过 | 待用户硬刷新确认“项目/文件/Git/终端”模式条可见 |
| 2026-08-26 | activity-rail-correction | 用户指出顶部横向模式条破坏项目层级；对照 VS Code Activity Bar 与社区右侧 Dock 后，改为左侧 44px 竖向图标栏，项目/文件内容独占右列；最终构建、Client 提供与 HTTP 200 通过 | 待用户硬刷新确认左侧层级和操作感受；不运行浏览器截图自动化 |
| 2026-08-26 | right-dock-correction | 用户继续否定左侧 Activity Rail，并明确要求参考成熟 DSH 插件改为右侧；F009 合同改为左侧项目/会话＋中央对话＋右侧 Files/Git/Review Dock | 旧 T002/T005/T006 完成证据只适用于被替代的 Workbench Layout；新组合重新执行 T002～T006 |
| 2026-08-26 | right-dock-ready-for-manual-review | Workbench Layout 与 patch 已完全移除；Better Sidebar `0.16.1`＋File Review `0.2.0` 已组合并裁剪，配置展开、最终构建、Boot Manifest、两个 Client、Host API 与 HTTP 200 均通过 | T003、T004 的右侧视觉、文件保存、Git/Review 交互待用户人工确认；不运行浏览器截图自动化 |
| 2026-08-26 | agent-file-tree-refresh-fix | 根据用户实测修复 Agent 新建 `INSTALL.md` 后文件树缓存不更新：当前 Session 成功 `write/edit` 与 Code Mode 嵌套文件变更会按 300ms 合并窗口刷新根目录、已展开目录和搜索；最终构建、服务重启、实际 Client 内容与 F009 定向校验均通过 | T004 仍待用户硬刷新后让 Agent 再新建一个文件，确认右侧 Files 无需手动刷新即可出现；不运行浏览器截图自动化 |
