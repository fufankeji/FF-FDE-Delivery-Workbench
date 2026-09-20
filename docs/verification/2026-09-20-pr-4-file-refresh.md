# PR #4 合并与项目文件自动刷新验证

日期：2026-09-20。范围：[PR #4](https://github.com/fufankeji/FF-FDE-Delivery-Workbench/pull/4) 与其对应的 Issue #3；不扩展项目功能、不改 Provider、业务数据或分支保护规则。

## 合并结果

- PR 源提交：`0f92f25ed20522e95843dcbc01864669b6109139`。
- GitHub 合并提交：`601536cd74b47ed5c9d152899255f087250b268c`，状态 `MERGED`。
- 普通合并被主分支更新规则拒绝；用户明确同意后，仅对此 PR 使用 `--admin --match-head-commit` 合并。没有修改规则、强推或重写历史。
- 本地先以 `--ff-only` 合入 PR 验证，再以 `--ff-only` 同步远端合并提交。两者源码树无差异，已通过的行为测试不重复执行。

修复为文件刷新作用域同时声明 `remote` 与 `remote.workspaceFiles`，使读取 `scope.remote.$stream` 符合 Cordis 注入要求。另补齐该行回调参数的括号以通过 lint，不改变运行行为。

## 定向回归

新增 `packages/client/ui-fde-project/tests/file-refresh.client.spec.ts`，使用真实 Cordis 作用域和 Snapshot Store，只对远程文件流使用测试替身。Provider 位于并列插件，避免根作用域的替身绕过注入检查。计时器、Context、事件监听及订阅均有清理。

合并前，新测试 3 项全部失败，并复现 `cannot get property "remote" without inject`；合入 PR 后与原插件注册测试一起运行，5 项全部通过。

| 检查 | 实际结果 |
| --- | --- |
| `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/file-refresh.client.spec.ts packages/client/ui-fde-project/tests/apply.client.spec.ts --reporter=verbose` | 退出 0，2 文件、5 项通过；覆盖等待文件服务、选中项目后的刷新、会话切换、重复选择不重复订阅、无选中会话及释放订阅/计时器 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project` | 无错误诊断，随后包构建成功 |
| `corepack pnpm exec tsx scripts/run-oxlint.ts packages/client/ui-fde-project/tests/file-refresh.client.spec.ts packages/client/ui-fde-project/src/client/file-refresh.ts` | 修正回调括号后无诊断，随后构建成功 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 退出 0；最终 Client JS 约 5.66 MB，Source Map 约 8.40 MB，均为既有被忽略的可重建产物 |

命令从 Harness 子目录执行。没有调用真实模型，没有运行全量测试、浏览器自动化、截图或录屏；这里只证明注入和刷新订阅路径及真实构建包，不冒充人工视觉验收。

## 实际运行版本

仅重启主项目原有的 3080 服务，显式使用 `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`，保留原 LAN 模式。新进程 PID 为 27827，工作目录为当前主项目的 `upstream/deepseek-harness`。

`127.0.0.1:3080` 和 `192.168.110.19:3080` 首页均为 HTTP 200。从实际 Boot Manifest 读取的项目 UI Bundle revision 为 `7cd0841b689490c2-38`；两个地址均返回 HTTP 200、5,661,530 字节，均包含父/子 Remote 注入且不存在原嵌套键单独注入，正文与本地最终构建一致。

Workspace 登记仍为 3 项，文件 SHA-256 在重启前后均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。没有复制、迁移或清空任何运行数据，没有新建 worktree 或安装第二份依赖。

本次提交仅包含回归测试、回调括号及本记录。既有 Skills、部署说明等 62 个本地修改/未跟踪文件单独保留。发布工具通用的根 `docs/` 排除规则与本项目更具体的同仓文档要求冲突，故保留项目文档，不取消跟踪。
