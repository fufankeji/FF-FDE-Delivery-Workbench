# 第一阶段业务诊断与中文建议验证

日期：2026-09-16。范围：F005 的 AC-F005-007、AC-F005-008，任务 T011、T012。结论：实现与定向验证完成，产品体验和真实模型诊断质量待人工确认；F005 原有 T004、T006 不在本次完成声明内。

## 基线与执行顺序

- 从已提交主线 `205dcd8c276a3f4c575c14cb3c3cb73423e93d4e` 创建 `feature/discovery-diagnosis`，独立工作树为 `FDEDeliveryWorkbench/.worktrees/discovery-diagnosis`。主工作树的 README、部署说明和此前验证草稿保持原样。
- 只读参考用户提供的 `fde-business-diagnosis`：读取其主说明、交互诊断与业务资产参考、报告与调查记录模板及 Agent 元数据；外置盘原件不修改、不复制为第二套内置 Skill。
- 先更新 F005 的 spec、plan、tasks 并通过规格校验，再修改内置 Skill。既有 PRD、Product Spec 与 Feature 边界已覆盖此次增强，没有新增平行规格或后续阶段任务。

## 实现范围

`packages/fde/stage/src/index.ts` 增强现有核心方法及其必要协同说明：授权材料与已有记录、实际业务、额外劳动因果、指标口径、传统改进对照、AI 增量、有限追问、条件建议、事实纠正后的增量修订。核心目录同步七项判断、八步流程、三份记录职责与明确标为教学的示例。

七项 Skill ID、固定上游来源、三份文件、JSON 版本／枚举、最小章节和人工阶段门不变；主报告承载完整诊断，确认清单和流程基线各自收敛，不强制完整环境审计。责任映射正文区分证据 `kind` 与 `state: unverified`，未修改协议。

`packages/client/ui-fde-project/src/client/index.ts` 只调整第一阶段推荐草稿。业务建议使用中文，技术标识保持准确；原生输入框仍保留用户草稿、不自动发送、不推进阶段。没有修改页面布局或其他阶段业务实现。第二阶段既有“返回补充业务流程”仍复用同一个核心 Skill，未增加第二份定义。

## 命令与结果

规格命令在工作树根执行，其余命令在该工作树的 `upstream/deepseek-harness` 执行。

| 检查 | 命令或入口 | 结果 |
|---|---|---|
| 前置需求与总规格 | `validate_prd.py . --require-confirmed`、`validate_product_spec.py . --require-confirmed` | 通过；PRD 的既有需求数量提示保留 |
| F005 规格 | `validate_feature_specs.py . --feature F005 --require-ready` | 通过，无错误或告警；在代码修改前完成 |
| 离线依赖 | `corepack pnpm install --frozen-lockfile --offline` | 通过，使用 pnpm 10.34.5，无依赖版本变更 |
| 核心方法与动作 | `corepack pnpm exec vitest run packages/fde/stage/tests/stage.spec.ts packages/client/ui-fde-project/tests/apply.client.spec.ts` | 28 + 2 项通过；首次命令还带了不存在的 discovery-stage 测试路径，实际仅运行这两个文件，随后补跑下行的真实兼容测试 |
| 既有产物兼容 | `corepack pnpm exec vitest run packages/fde/project/tests/project.spec.ts -t 'candidate workflows\|invalid workflow catalog\|pinned Artifact metadata\|fixed requirement outputs'` | 4 项通过，其余 19 项按范围跳过；覆盖逐条证据、无效目录、固定来源与正文结构、受控路径 |
| 最后路由修订 | `corepack pnpm exec vitest run packages/fde/stage/tests/stage.spec.ts` | 28 项通过；允许复用任务所需既有阶段记录，不扩大到未授权资料；不重复计入 34 项总数 |
| 构建 | `corepack pnpm run build` | 最终完整构建退出 0，登记 270 个客户端产物及 3 项公开构建环境值；包含受影响 Client bundle |
| 既有文档配对 | `corepack pnpm run verify-translation-pairing packages/fde/stage/README.md packages/client/ui-fde-project/README.md .agents/notes/implemented/feature/2026-08-31-fde-stage-one-guided-intake.md` | 三组已有配对一致；产品规格与本验证记录仅中文 |
| 全局文案检查 | `corepack pnpm run verify-client-ui-i18n` | 退出 1，2771 处既有硬编码文案；本次唯一改动的 Client 文件以同一检查器对比 HEAD 与工作树，均为 0，诊断完全一致；未扩展整改 |
| 补丁空白检查 | `git diff --check` | 通过 |

最后一次定向打包命令因根配置发现机制重建了全部包；随后重新执行标准完整构建，恢复同一公开构建环境与产物记录，再启动预览。未将生成产物纳入 Git。

## 隔离预览与在线内容

启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3083`。

认证后首页与只读 `/api/fde-stage/skills` 均为 HTTP 200。目录第一阶段仍有 7 项方法，核心正文标题为“业务诊断与 AI 机会判断”，包含指标口径与 AI 增量要求。通过首页 Boot Manifest 实际 URL 取得的 `ui-fde-project` 在线包包含中文候选建议和“样本、时间窗和计算口径”，不包含旧的英文决定提示。

监听进程的 cwd 为本工作树 Harness 目录，显式 `DSH_HOME` 指向本工作树 `.runtime/dsh-home`。Workspace 存储为空，不读取或复制主运行区项目、会话或凭据。3080 主服务不重启、不替换。

## 未验证项与本地状态

- 未调用付费模型、未生成真实客户诊断报告、未执行浏览器回放、截图或自动 UI 验收。测试能证明方法指令、兼容合同、动作和运行包正确，不能证明模型一定遵守方法或报告已获客户认可。
- 初次验证时改动留在独立工作树，尚未提交、合并或推送；当时主服务未包含本次改动。已有客户报告不会自动重写。随后用户于同日授权合并本切片与主题修复，并清理对应临时分支和工作树；合并状态以 Git 历史为准。
- 工作树约 2.5 GB，其中依赖约 2.2 GB，运行区约 28 KB。源码真源为本工作树未提交改动，依赖与构建可由锁文件和标准构建命令重建。保留至人工验收与合并完成；清理前需核对未提交和未跟踪文件、保存独有交付物、确认提交已被主线包含，并停止 3083 服务。新建测试项目或会话后，运行数据须另行保存，不能视为可再生成缓存。
- 依赖安装自动生成的工作树根 `lefthook.yml` 已删除；它不是用户文件，可由依赖工具重新生成。

## 同日合并与清理

- 用户授权后，Skills 更新、首页配色修复和默认浅色设置一起提交为 `cd6aaa1d515e7ea7f17664fac4dab90cc6ee8aa5`，通过 `git merge --ff-only feature/discovery-diagnosis` 合并回 `main`。沿用上述已通过的定向测试，不重复等价验证。
- 主目录旧依赖树缺少当前锁文件中的依赖，先用 `CI=true corepack pnpm install --frozen-lockfile --offline` 重建；随后发现打包器仍读取 15 个已删除包的旧目录。逐项确认没有受控文件或未忽略文件后，仅清理其中的 `lib` 和依赖链接残留（约 6.7 MB，另有先行清理的 424 KB）；没有修改业务源码或依赖版本。
- 主线最终 `corepack pnpm run build` 退出 0，登记 270 项客户端产物与 3 项公开构建环境值。按原命令恢复 3080：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`。
- 3080 首页、Skills 目录、实际主题包和项目包均返回 HTTP 200。主题包修订 `ec482a5a290ecbf0-8`，项目包修订 `ec482a5a290ecbf0-37`；实际内容包含浅色默认值、中文建议、仅作用于交付预览的深色样式，以及七项原有 Skill 和“业务诊断与 AI 机会判断”。监听进程的 cwd 和 `DSH_HOME` 均属于主工作树。
- 主运行区仍登记 3 个项目、7 个会话，Workspace 文件的 SHA-256 与合并前相同。根 README、部署说明及此前源码构建验证草稿的 SHA-256 也保持不变；这些原有未提交改动未混入本次提交。
- 清理前确认 Feature 工作树没有受控或未跟踪改动、提交已被主线包含、预览运行区没有项目或 Session。随后停止 3083，通过 `git worktree remove` 移除约 2.5 GB 的 `discovery-diagnosis` 工作树，再以 `git branch -d` 删除对应分支；其他工作树未动。源码和验证记录保留在主线，依赖与构建产物可重建；没有推送远端。
- 主目录 `upstream/deepseek-harness/node_modules` 约 2.3 GB，供当前主服务及后续开发使用；停止服务且不再需要本地开发时可清理，再按锁文件安装恢复。安装与构建日志位于 `/tmp/fde-main-discovery-install.log`、`/tmp/fde-main-discovery-merge-build.log`，不提交，可在不再排错时删除。
