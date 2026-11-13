# 统一导航与默认配置 · GitHub 与学员源码发布

## 范围与授权

用户在重新打开桌面并确认后，要求推送代码至既有 GitHub 并覆盖桌面的完整源码包。本轮承接 F032、F033，只发布源码及部署说明，不新增媒体或模型调用。保留用户此前明确要求提交的根 docs 与仓库版本管理规则，不执行通用发布模板的 docs 移除动作。

目标为 `fufankeji/FF-FDE-Delivery-Workbench` 的 main；fetch 后本地与 origin/main 为 0/0。普通后续推送，不改仓库可见性、保护规则或历史。根 `.agents/`、`lefthook.yml` 和旧未跟踪的 `docs/verification/2026-10-30-student-source-package.md` 不进入提交或学员包。

## 已有证据与发布检查

复用 F032/F033 已完成的定向测试、11/11 完整构建、全新配置加载和当前桌面加载证据，不仅因提交而重跑同一验证。前两份记录保留上游旧 SidebarRoot 断言及全库默认产品检查的既有问题，未宣称全仓测试或全平台运行通过。

用户已确认本轮界面与默认配置。完成态校验提醒 F025、F030 的历史验收依赖仍未收口，因此只勾选本轮实际完成任务，F032/F033 总状态仍保持 in-progress，不改旧依赖状态以满足校验。

发布预检扫描 22,364 个候选文件，没有敏感文件、凭据形态或超限文件报告。仅报告根 docs 被跟踪、README 指向该目录，与本项目及用户明确合同相符，故保留；根无统一 LICENSE 的警告沿现有授权说明处理，不擅自另选许可证。第三方许可证随源码保留。

通用学员打包器 dry-run 在 Harness 的 CLAUDE.md 内部文件链接处停止；继续使用已有 `student-delivery/build-source.py` 和同一 bundle.toml。脚本只选择冻结提交内命中白名单的已跟踪源码，将同仓已跟踪文件链接物化，保留凭据/本机路径、示例与 248 份实验室素材的逐字节检查，不复制个人运行区。

## 源码包验收计划

产品提交后冻结唯一 sourceCommit，先生成 dist 下候选包，再独立解压，逐项执行 bundle.toml 的源码校验、锁文件安装、串行完整构建、实验室素材校验、样例测试、新导航与默认配置测试、示例导入，并启动独立本机临时端口验证真实页面资源和洞察/实验室接口。只做无密钥浏览检查，不验证付费模型效果。

验收临时目录预计占用数 GiB；唯一维护源为本次冻结提交和候选 ZIP，结束停止自有进程并删除展开副本/依赖/本次导入数据。桌面旧 ZIP 在候选验收通过前保持原样；之后同名替换，仅保留一个桌面交付文件，不生成旁置摘要文件。

## 发布与最终 ZIP

产品源码提交 `edba4c0a878070273822a3fa73f76cebfc15b938` 已通过普通 `git push origin main` 推送，远端 main SHA 与本地一致，远端 README 可读。GitHub 推送响应报告当前账号对受保护引用的既有权限例外（`Cannot update this protected ref` 被豁免）；未改分支规则、未使用 force。该提交没有对应 Actions run，不把无 CI 记录说成 CI 通过。

桌面同名文件 `FF-FDE交付工作台-完整源码-2026-11-13.zip` 已在全部验收通过后原位替换。82,537,194 字节，约 78.7 MiB；唯一根目录 FDEDeliveryWorkbench，17,761 个源/交付文件，另有 MANIFEST.json 与 SHA256SUMS.txt。SOURCE_VERSION.json 记录上述产品提交；源码含 192 份门店样例文件、248 份实验室素材，11 个同仓文件链接物化，排除 4,242 个开发辅助路径。没有个人运行数据、依赖树、凭据或 Git 仓库。

内部 ZIP 摘要：`38a63ff66d8317f93990ed3fa6381ca6ffde5f11d45100347dd975080c3260e4`。同卷原子替换后摘要保持一致，桌面没有另行生成摘要旁文件。旧 ZIP 已被用户授权覆盖，其旧源码仍可由此前 Git 提交重建。

## 独立解压实跑

平台为 macOS arm64，Node 24.16.0、pnpm 11.28.5。所有命令从最终候选 ZIP 独立解压的无 `.git` 目录运行，未借用开发目录的 node_modules 或运行区。安装使用标准共享包缓存，但依赖树在临时目录独立建立。

| 检查 | 结果 | 证据 |
|---|---|---|
| source-integrity | 17,761 文件摘要通过，sourceCommit 一致 | `node verify-source.mjs` |
| install | frozen-lockfile 安装成功，执行原安装脚本，13.3 秒 | `.runtime/2026-11-13-student-install.log` |
| build | 显式传入包内提交，串行完整构建 11/11 通过，379.73 秒 | `.runtime/2026-11-13-student-build.log` |
| lab-materials | 5 案例、234 引用、248 文件、36,654,779 字节完整 | 包内素材校验器 |
| sample-tests | 7/7 通过，包括真实 HTTP 新增、分析、幂等保存与重启读回 | 包内两个 Node 测试文件 |
| navigation-and-defaults | 8 文件、32/32 通过，4.80 秒 | `.runtime/2026-11-13-student-feature-tests.log` |
| sample-import | 新建隔离示例，35 份原件、192 文件；没有复制会话或凭据 | 包内 load.mjs |
| authenticated-start | 本次启动授权成功，首页 200，Boot Manifest 有效 | 包内 `dsh web --no-open --host 127.0.0.1 --port 0` |
| client-resources | 洞察、项目、外观、实验室模块各唯一，真实资源均 200；新导航与官方默认文案存在 | 使用本次 Boot Manifest 的资源 URL |
| independent-apis | 案例列表 200 且 5 案例，中文挑战 200，洞察 summary 200 且 ok=true | 本机已认证的只读请求 |
| stop | 本轮 Host 进程组已结束，没有操作原桌面实例 | 子进程 close 完成信号 |

验包展开目录约 3.2 GiB，验收后删除，包含其依赖、编译产物和本轮导入的仿真数据；均可从桌面 ZIP 重新生成，没有留下 worktree 或备用 checkout。候选 ZIP 通过 rename 移至桌面，dist 不保留另一份 ZIP。日志是被 Git 忽略的小型文本，交付确认后可删除；授权链接和 Cookie 仅在验证进程内使用，未进入日志或文档。

基础学员部署链路通过。真实模型调用、Semantica 重建和 Linux/Windows 原生运行仍需学员配置或目标机验证；没有录屏、自动浏览器回放或把 HTTP 检查声明为全量视觉验收。收尾文档提交只补本记录，不改变 SOURCE_VERSION.json 所标识的产品源码。
