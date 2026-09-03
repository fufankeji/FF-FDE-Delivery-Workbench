# F023/F007 部署试运行与验收移交验证

## 范围

- Feature：F023 部署试运行与进入验收移交、F007 验收移交与项目完成。
- 分支：`main`
- 基线：`e648f3b`
- 用户可见目标：阶段 5 管理目标环境、部署版本、真实证据、问题决策与四份阶段产物；阶段 6 管理最终版本、客户验收、交付物、条件项、责任移交与四份最终产物；两个阶段均由 FDE 两步确认推进，最终进入只读可见的“项目已完成”状态。
- 保持项：Agent 和 Skill 只生成候选材料；文件存在、部署脚本、外部口头确认和前端按钮均不能自行推进阶段；平台不读取凭据，不内置通用部署器，不替代客户签章或外部制品仓库。

## 实现证据

| 能力 | 结果 |
|---|---|
| 部署试运行合同 | `.fde/deployment-trial.json` 投影当前项目的目标环境、授权状态、候选版本、5 类项目内证据、问题决策与 4 份固定产物；门槛不满足时逐项列出真实缺口 |
| 严重问题人工决策 | Agent 不得把问题标成 `accepted`；项目进度页要求 FDE 填写理由，并以当前合同 SHA-256 摘要调用 Host，只修改被选问题，合同已变化时拒绝旧操作 |
| 验收移交合同 | `.fde/acceptance-handover.json` 投影最终版本、客户验收及证据、交付物可取得状态、条件项、培训/权限/运维责任移交与 4 份固定产物 |
| 阶段推进 | Host 以 expected revision 复核门槛；阶段 5 两步确认执行 `pilot → handoff`，阶段 6 两步确认执行 `handoff → completed` |
| 完成状态 | `completed` 是终态而非第七阶段；项目进度仍展示六阶段事实和全部交付证据，开发页不再提供继续推进动作 |
| Skills | 内置 `fde-deployment-trial` 与 `fde-acceptance-handover`，只约束文件规范、证据引用和候选材料生成，不代替 FDE 决策 |
| 试运行结论人工确认 | 当四份产物、五类证据和全部问题决定已经齐备，但目标环境授权与试运行结论尚未记录时，项目进度页显示独立两步确认；Host 绑定当前合同 SHA-256 摘要写入 `environment.authorized=true` 与 `status=ready`，不执行部署、停止或回滚 |
| 验收移交事实人工记录 | 企业验收证据改为最多 40 份项目相对文件；项目进度提供四步 FDE 表单，按页面当前合同摘要记录验收结论、交付物可取得状态、条件决定和培训/权限/运维责任移交。Host 在文件锁内拒绝过期摘要和条目变化，只更新人工决定字段；保存记录与最终“完成项目”仍是两个独立动作 |
| 最终阶段事实源 | 验收移交 Skill 先读取 `.fde/deployment-trial.json`，该结构化合同优先于可能过期的部署 Markdown；Agent 首次生成时保持验收 pending、交付物 false、条件 open 和移交 false，并保留项目进度已写入的人工字段 |

## 测试与构建证据

| 检查 | 结果 |
|---|---|
| 四个相关包 `tsc --noEmit` | exit 0；`packages/fde/project`、`packages/fde/stage`、`packages/client/ui-fde-project`、`packages/client/ui-fde-stage` 均通过 |
| 五个聚焦测试文件 | exit 0；30 项通过，覆盖两个快照、阶段路由/CAS、项目进度页面和既有进度页回归 |
| 人工接受问题增量测试 | exit 0；2 个文件 6 项通过，覆盖 Host 精确摘要写入和页面操作合同 |
| `corepack pnpm run build` | exit 0；Host、Client 包和 Web 前端正式构建通过；仅保留既有 bundle 依赖提示及 Vite 大 chunk 提示 |
| `git diff --check` | exit 0；本轮上游源码与说明改动无空白错误或冲突标记 |
| 试运行结论修复聚焦检查 | exit 0；4 个测试文件共 30 项通过，3 个相关包 `tsc --noEmit` 通过，实际“数据分析项目”只读快照显示四份产物、五类证据及问题决定均齐备，可进入 FDE 人工确认 |
| 验收移交人工记录聚焦检查 | exit 0；4 个测试文件共 33 项通过，覆盖多份验收证据、精确摘要写入、旧提交拒绝、Skill 事实源、前端请求体和四步 FDE 表单；`packages/fde/project`、`packages/fde/stage`、`packages/client/ui-fde-project` 类型检查通过 |
| 本轮双语配对检查 | exit 0；4 个命名配对一致：FDE Project、FDE Stage、Project Progress README 与项目交付页面 Agent Note |
| 本轮正式构建 | exit 0；Host、Client 包及 Web 前端构建通过；仅有既有依赖打包提示和 Vite 大 chunk 提示 |

仓库级双语配对检查仍被并行改动中的 `packages/client/ui-workspace/README.md`/`.zh.md` 阻塞；Agent Note 全量格式检查仍被另一份验证阶段 Note 缺少固定章节阻塞。两项均不属于 F023/F007，本轮没有越界修改；本轮涉及的 README 与 Agent Note 配对文件已经重新记录。

## 隔离运行证据

- 页面：`http://127.0.0.1:3080`
- DSH_HOME：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`
- 启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`
- 构建后停止旧进程并使用上述隔离目录重启；`curl http://127.0.0.1:3080/` 返回 HTTP 200。
- 本轮服务会话已重新启动；`curl http://127.0.0.1:3080/` 再次返回 HTTP 200。
- 对 `/Users/muyu/test/ai-analysis` 只读加载：部署试运行合同为 `ready`、已授权且无阻塞；验收移交合同不再因证据数组而失效，当前保留 7 项真实阻塞（企业验收、交付物、条件项、三项责任移交和移交证据）。本轮未替用户写入任何决定。

## 人工验收

- 按协同开发约定，未执行浏览器截图、视觉对比或完整 E2E；页面已留在 3080 供用户手动验证。
- 阶段 5 建议检查：项目进度显示版本、环境、5 类证据、问题和 4 份产物；严重问题必须关闭、延期或由 FDE 填写理由人工接受；门槛齐备后经两步确认进入验收移交。
- 如果页面只剩“目标环境未获 FDE 授权”和“试运行状态尚未 ready”两项阻塞，先点击“确认目标环境与试运行结论”，复核后点击“确认授权并标记试运行完成”；返回阶段区后，“完成部署试运行”按钮应可点击并继续进入验收移交。
- 阶段 6 建议检查：最终版本、客户验收证据、交付物、条件项、已知问题及培训/权限/运维移交均可追溯；门槛齐备后经两步确认完成项目。
- 阶段 6 先点击“记录验收与移交事实”，按四步填写企业验收结论与项目内证据、勾选真实可取得交付物、决定条件项、勾选真实完成的培训/权限/运维责任并填写移交证据；保存后确认阻塞项随真实事实减少。该操作不执行现实动作，也不完成项目。
- 人工确认前，F023-T007 与 F007-T007 保持未勾选，两个 Feature 继续标记为 `in-progress`。
