# F031 · 实验室完整源码交付验证

2026-11-13 用户明确要求将缺失的运行素材纳入代码、提交现有 GitHub，并交付桌面新版源码 ZIP。此前源码的 `.assets` 被 Git 与学员包排除，新安装会返回素材未安装的 503；本机已有素材不能作为新用户可用性的证据。

## 实现与内容边界

`packages/fde/discovery-lab/assets/` 成为受版本管理的固定素材源，包含原运行白名单的 248 文件、36,654,779 字节、5 案例、234 份引用资料及固定计算脚本、字体和许可。逐文件清单为 `assets-manifest.json`；源码校验命令、完整构建、Host 初始化与学员包检查共用同一检查逻辑。案例引用也必须进入清单，不能仅检查 finance 的一个文件。

素材初始化失败仍返回真实 503 和“重新获取完整源码、构建后重启”的恢复信息；训练数据库错误没有被素材检查吞掉。没有移除认证、改角色授权、发起模型请求或复制 DSH_HOME。用户授权仅覆盖此运行白名单，不包含原 ZIP 的教师材料、未来事件、个人历史和凭据，原第三方与字体许可保留。

本机旧桌面进程仍使用原 `.assets` 路径，因此暂时保留这份约 36 MiB 的旧缓存；它被 Git 与打包器排除，不再是源码事实源。旧实例退出、新实例使用 assets 后，且确认与固定清单相同，即可安全删除旧缓存。新资源目录不是可删构建缓存。

## 已完成的技术检查

| 检查 | 结果 | 证据 |
|---|---|---|
| PRD、Product Spec、F031 规格校验 | 通过，用户指令确认新的完整交付合同 | 相应 Skill 校验器 |
| `node packages/fde/discovery-lab/scripts/verify-assets.mjs` | 5 案例、234 份资料、248 文件完整，未调用模型 | 素材清单及命令输出 |
| `vitest run .../assets.spec.ts .../loader-composition.spec.ts` | 7 项通过：完整、缺失、损坏、漏清单、角色权限与恢复 | `.runtime/f031-lab-tests.log` |
| `node --test .../five_cases.test.mjs .../calculations-and-export.test.mjs` | 7 项通过，使用真实固定 Python 计算和 PDF 导出路径 | `.runtime/f031-calculations-tests.log` |
| `corepack pnpm run build --serial` | 11/11 通过，422 份 Client 产物登记 | `.runtime/f031-build.log` |
| 发布就绪扫描 | 无凭据、敏感文件或超限文件 blocker；只有默认排除 docs 的规则提示，按用户既有明确要求与仓库合同保留 docs | `.runtime/f031-publish-check.json` |
| 通用打包器 dry-run | 因既有 `CLAUDE.md` 内部符号链接拒绝；使用本项目原打包器的受控链接物化，不放宽路径或秘密检查 | `.runtime/f031-generic-package-dry-run.log` |

## 发布与独立验包

产品实现提交为 `8db3f37056f9e89ac66564a3c49b7f847217bad3`；源码包冻结在 `3b867c20f6a8f121532eb8895a30c0b4cadf9dd4`。后者仅补齐新上游三份已审阅的掩码/设置测试 fixture 白名单：两份文件与官方目标标签逐字节相同，另一份中的凭据形态字面量与官方完全一致，均为测试数据；没有取消整个秘密扫描。打包器将实际 Git HEAD 注入 SOURCE_VERSION.json，避免保留旧提交标识。

项目打包器 dry-run 与正式构建通过：17,759 个源/交付文件，正文共 175,210,334 字节，包含全部 248 份实验室素材；11 个仓库内部文件链接物化为普通文件，4,242 个开发辅助路径被排除。无 .git、node_modules、个人会话、凭据或训练数据库。素材 Markdown 原件包含有语义的两个行末空格与原始末尾空行，因此仅对 `assets/**` 保留原字节并关闭对应空白告警；`-text` 同时避免 Windows Git 换行转换破坏摘要，其余源码检查不变。

最终文件为桌面 `FF-FDE交付工作台-完整源码-2026-11-13.zip`，82,526,111 字节（约 78.7 MiB），单一根目录 `FDEDeliveryWorkbench`。包内有 MANIFEST.json 与 SHA256SUMS.txt，不另发旁置校验文件。内部记录 ZIP SHA-256：`263558acd6028356d332dfe818a37f56db16abaaab74e68ecee6a30c615facf0`。

### 最终 ZIP 独立解压验收

最终 ZIP 解压到 mktemp 创建的 `/tmp/fde-source-20261113.mneAHu/`，没有 Git、旧 lib、node_modules、`.assets`、作者 DSH_HOME 或模型配置。实测 macOS arm64、Node 24.16.0、pnpm 11.28.5；使用已有 pnpm 下载缓存，不将其称为冷网络安装。

| 检查 | 实际结果 | 证据 |
|---|---|---|
| `node verify-source.mjs` | 17,759 文件摘要一致，5 案例、234 引用、248 素材完整 | 实际命令输出 |
| `pnpm install --frozen-lockfile` | 退出 0，10.5 秒，安装生命周期脚本正常执行 | `.runtime/f031-isolated-install.log` |
| 显式 SOURCE_VERSION 提交信息后 `pnpm run build --serial` | 退出 0，11/11 通过，133.57 秒，410 份干净 Client 产物登记 | `.runtime/f031-isolated-build.log` |
| 示例测试与 `load.mjs` | 7/7；192 个文件和 35 份原件导入一个新的 Workspace，无作者会话或凭据 | `.runtime/f031-isolated-sample-tests.log`、`f031-isolated-sample-import.log` |
| 授权首页与真实 Boot | 303 后 200，Boot 版本 0.2.2-rc.2；Project、Lab、挑战与 File Review 在线资源均 200 | `.runtime/f031-isolated-probe.json` |
| 五案例真实使用入口 | 财务、内部服务、物流、制造、运营列表均可读；逐一新建轮次并选择一个岗位，全部 200；没有提交访谈或调用模型 | 同上 |
| 权限与隔离 | 匿名及异源请求 403，直接索取服务端案例配置 404；训练后项目仍是原一项、项目 Session 列表仍为空 | 同上 |
| 相邻能力 | 中文挑战、Skills 和项目快照接口均 200 | 同上 |
| 停止与清理 | 核对 PID 80634 的 cwd 后正常 SIGTERM，等待 Host 退出且 3096 不再监听；移除本轮临时目录约 3.2 GiB，桌面 ZIP 保留 | 进程退出与路径检查 |

本机原 Electron PID 27540 及其旧运行区保持原状。临时目录只包含可从最终 ZIP 重建的依赖、构建物与本轮仿真训练；删除不涉及讲师/学员原数据。启动授权参数已从日志脱敏。收尾磁盘可用约 4.5 GiB，不把目录逻辑体积当成物理释放空间。

### GitHub 状态

`git push origin main` 已成功，GitHub main 核对为 `3b867c20f6a8f121532eb8895a30c0b4cadf9dd4`；远端素材清单与本地逐字节一致，包含 248 项。没有上传 ZIP、运行数据或依赖，没有使用 force 或更改仓库可见性。GitHub 回执提示本身份获准绕过受保护 ref 的更新限制；这是服务器对本次普通 push 的回执，本轮没有修改保护规则。

本记录的收尾提交仅补验收文档与 Feature 状态，不改变上述已验收源码包的产品文件；源码包仍准确标识其冻结提交。根 `.agents/`、`lefthook.yml` 和旧未跟踪的 `docs/verification/2026-10-30-student-source-package.md` 保留原状，未顺带提交。

F031 的六项技术任务已完成，但全局 Feature 依赖 F024、F030 尚有既有人工验收未关闭。完成态校验据此拒绝整条依赖链完成，Map/Tasks 保持 in-progress，并按当前状态校验；没有为满足校验器而删除依赖或假勾上游人工验收。

前一轮 F030 的完整交互与真实模型调用仍未做全量验收；原上游全组合源码测试第三方导入限制见 [F030 记录](2026-11-12-harness-022-compatibility.md)。本次不为这一素材问题重跑或修复无关全量 UI 测试。
