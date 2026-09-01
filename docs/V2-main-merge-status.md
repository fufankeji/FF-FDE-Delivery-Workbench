# V2 开发现场与最终合并记录

## 当前决定

自 2026-09-01 起，`FF-FDE-Delivery-Workbench` 作为 V2 八阶段开发、人工测试和问题修复的唯一开发现场。八阶段全部完成前，不再把阶段性修改迁入 `FDEDeliveryWorkbench/main`，也不清理当前仓库、运行时或旧 worktree。

当前开发入口和运行状态：

- 开发仓库：`/Users/muyu/MuYuProjectBuild/FF-FDE-Delivery-Workbench`
- 工作台源码：`app/deepseek-harness/`
- 当前 Git 基线：`e58df4c3b93f6ac135d78f55b3b0e1bf973c5609`
- 当前开发状态：V2 八阶段的权威状态、统一基础工作台、真实产物扫描、当前项目内人工评审、阶段返回和人工测试提示词已经形成；本轮源码与文档待提交
- 当前 Web 地址：`http://127.0.0.1:3080`
- 当前运行源码目录：`FF-FDE-Delivery-Workbench/app/deepseek-harness`
- 当前隔离运行时：`FF-FDE-Delivery-Workbench/.runtime/dsh-home`

`FF-FDE-Delivery-Workbench` 是独立 Git 仓库，不是 `FDEDeliveryWorkbench` 中的普通 Feature 分支。因此最终动作是一次受控迁移与合并，不能把它当成同一仓库中的直接 `git merge`。

## 已经迁入主项目的内容

目标主项目：

- 目录：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench`
- 源码仓库：`FDEDeliveryWorkbench/upstream/deepseek-harness`
- 当前目标分支：`main`
- 已合并提交：`8dcc9074fb6ac3efe8212508223c6b341b41019b`

该提交已经包含：

1. 旧首页提交 `661143ea102e933c1b437e0ef6815d23e666c654`。
2. V2 项目工作台的第一轮迁移提交 `0323d7a561`。
3. 当时已经形成的 V2 项目中心、阶段工作台、阶段状态、资料入口和相关文档。

`FDEDeliveryWorkbench-homepage` worktree 当前停在旧首页提交 `661143ea10`，其提交已经被目标 `main` 包含。它暂时保留，仅在最终合并和运行验证完成后清理。

## 当前尚未合并的内容

本仓库当前工作区仍是后续开发事实源，包括但不限于：

- 第一阶段引导式项目工作台的后续交互和布局调整；
- 第一阶段业务对象、候选工作流、阶段记录和 Skill 展示；
- 项目资料上传入口、阶段头部和运行轨迹的配套调整；
- FDE 项目与阶段 Host 逻辑、测试和包依赖；
- `docs/specs/` 下更新后的中文产品 Spec、Feature Spec、Plan 和 Tasks；
- `docs/manual-tests/` 下的人工流程测试材料；
- 八阶段统一基础闭环的源码、中文 Spec、验证记录和阶段 2～8 人工测试提示词。

本轮只完成可逐阶段手测的基础闭环，不把后续专用能力伪装为已完成：价值证据分层、治理权限矩阵、真实纵向切片执行、Eval 执行器、Pilot 授权与运行、生产采用监控、受控发布和跨项目复用仍以各 Feature `tasks.md` 中未勾选的 T001～T006 为准。

当前运行时中的 Session、Workspace 登记、附件和阶段状态不属于普通源码差异。最终迁移时必须单独审计，不能通过覆盖 `.runtime/`、`workspaces/` 或 Workspace 注册表来“顺便合并”。

## 八阶段开发期间的规则

1. 继续在本仓库开发和启动，不切换到目标 `main`。
2. 每次只开发用户当前确认的阶段；一个阶段完成后提交该阶段源码、中文文档和最窄验证证据。
3. 不把 `.runtime/dsh-home/`、凭证、依赖目录、构建产物或临时文件提交 Git。
4. 不删除或改写现有 Session 历史、客户资料、项目产物和阶段状态。
5. 八阶段完成前不再次执行部分迁移，避免目标 `main` 与当前人工测试现场来回漂移。
6. 如果目标 `main` 在此期间出现其他提交，只记录目标新 SHA；不得直接覆盖本仓库已经人工确认的 V2 行为。

## 最终合并前检查

八阶段全部完成并由用户明确要求合并后，按以下顺序执行：

1. 停止当前 3080 服务，确认不再写入 Session 和阶段状态。
2. 检查本仓库 tracked、untracked 和 ignored 状态，把源码、中文 Spec、人工测试资料与运行数据分开。
3. 提交所有应进入 V2 的源码和文档，记录最终源提交 SHA。
4. 核对目标 `FDEDeliveryWorkbench/upstream/deepseek-harness/main` 是否干净，记录最终目标 SHA。
5. 生成文件级差异清单。源码从 `app/deepseek-harness/` 映射到目标源码根目录；项目级文档从本仓库 `docs/` 映射到 `FDEDeliveryWorkbench/docs/`。
6. 在从最新目标 `main` 创建的临时 migration worktree 中迁移差异。不得直接用整目录覆盖目标 `main`。
7. 冲突处理以本仓库已经人工验证的 V2 产品行为为准，同时保留目标 `main` 中独立的上游修复、构建规则和安全约束。
8. 运行受影响包的最窄测试、Client bundle 和项目构建；记录真实退出结果。
9. 合并到目标 `main`，核对最终 `main` 包含迁移提交，且工作区干净。
10. 单独决定 Session、Workspace 与客户资料的迁移方式；未确认前不覆盖目标隔离区。
11. 从目标 `main` 使用目标项目明确的 `DSH_HOME` 启动 3080，验证页面、进程源码目录、隔离区和 Workspace 数据一致。
12. 完成上述验证后，才审计并清理 `FDEDeliveryWorkbench-homepage` 和 `FF-FDE-Delivery-Workbench`。

## 最终合并的停止条件

出现以下任一情况时停止，不继续覆盖或清理：

- 本仓库仍有无法归类的未提交文件；
- 目标 `main` 有其他人的未提交修改；
- 文件差异显示目标 `main` 存在尚未带回 V2 的独立功能或修复；
- Session、Workspace 路径或阶段状态的来源不明确；
- 3080 虽然返回 HTTP 200，但进程源码目录、`DSH_HOME` 或 Workspace 登记不符合预期；
- 最终页面尚未经过用户手动确认。
