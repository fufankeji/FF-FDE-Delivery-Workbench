# 源码部署构建修复验证

## 范围

- 请求：修复已复现的源码构建错误，更新代码并推送 GitHub。
- 基线：`main` 的 `337cd32a63a7042ccfd2ade412619ee41441f4c1`。
- 修改仅涉及活动统计状态类型、相关类型回归测试，以及构建链中的实验室和 Client 测试夹具。未修改业务流程、运行时 Schema 或状态版本。
- 保留已有 `README.md` 与 `DEPLOYMENT_AGENT.md` 本地修改；本记录只留本地，不随本次代码推送。

## 修复内容

1. 活动统计使用显式结构的状态接口，解除 Schema 推断与 Projection 注册类型之间的循环；回归断言约束状态不能退化为 `any`，且仍与持久化 Schema、输出桶类型一致。
2. 实验室工具夹具按合同返回 Promise；`agent/pre-step` 对拒绝结果先返回，仅在进入分支追加消息。
3. Client 测试补齐评估与交付快照的必填字段，移除查询 API 不支持的 `exact` 参数，以及项目行元数据中的多余字段。原有失败到成功、导航、悬浮信息和复制行为断言保留。

## 验证环境与结果

环境为本机 macOS，Node.js `v24.16.0`、pnpm `11.7.0`、锁定 TypeScript `6.0.3`。除特别说明，命令均在 `upstream/deepseek-harness/` 执行。

| 验证 | 真实命令 | 结果 |
| --- | --- | --- |
| 活动统计独立类型检查 | `node node_modules/typescript/bin/tsc --project packages/session/session-stats/tsconfig.json --noEmit --incremental false --composite false --pretty false` | 退出 0 |
| Host 相关回归 | `corepack pnpm exec vitest run packages/session/session-stats/tests packages/fde/discovery-lab/tests/loader-composition.spec.ts` | 退出 0；4 个文件、22 项测试通过 |
| Client 相关回归 | `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-attention.client.spec.tsx packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx packages/client/ui-workspace/tests/rows.client.spec.tsx` | 退出 0；3 个文件、50 项测试通过 |
| 6 个修改文件的静态检查 | `corepack pnpm exec tsx scripts/run-oxlint.ts --config .oxlintrc.staged.json`，追加下方 6 个路径 | 退出 0 |
| 隔离安装 | `corepack pnpm install --frozen-lockfile --offline` | 退出 0；使用本机 pnpm 内容缓存，未复用项目 node_modules 或编译产物 |
| 完整构建 | `DSH_CLIENT_COMMIT_HASH=337cd32a63a7042ccfd2ade412619ee41441f4c1 corepack pnpm run build` | 退出 0；Host、Client、Web 构建通过，记录 230 个 Client 产物 |

静态检查与本次提交的代码路径：

```text
packages/session/session-stats/src/activity.ts
packages/session/session-stats/tests/activity.spec.ts
packages/fde/discovery-lab/tests/loader-composition.spec.ts
packages/client/ui-fde-project/tests/project-attention.client.spec.tsx
packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx
packages/client/ui-workspace/tests/rows.client.spec.tsx
```

完整构建在临时目录 `/tmp/fde-clean-build.GZjfl3` 内执行：先由上述 Git 基线导出源码，再覆盖并逐文件比对这 6 个修复文件；首次安装时无 node_modules、lib 或构建缓存。首次构建暴露的 Client 测试类型错误修复后，在同一隔离目录续跑完整构建成功。构建版本字段使用导出基线 SHA，是因为临时目录没有 Git 元数据，不代表修复后的提交 SHA。该目录与约 2.1 GiB 的可再生产物仅用于本次验证，收口后删除；再验证时可从最终提交重新导出源码并执行安装与构建。

## 边界

- 未运行全量浏览器回放、UI 自动截图、跨平台构建或真实模型调用；上述结果不是用户视觉验收或真实业务交付验收。
- 离线安装证明锁文件与本机已有依赖缓存可用，不代表任意新设备的网络下载已验证。
- 现有本地服务和运行数据未重启、迁移或修改。
- Vite 的大分块提示不阻断构建，本次不扩展为拆包优化。
- 桌面的学员源码 ZIP 未重新生成，仍不包含本次修复；本次交付为 GitHub 源码更新。

## 推送暂停

提交前再次获取远端，发现 `origin/main` 已比本地基线领先 2 个提交：

- `d3879e03c4`：`feat(fde): adapt workbench to harness 0.1.6-alpha.1`
- `8e7281451d`：`docs(fde): record upgrade checkpoint and verification boundaries`

远端升级与本次活动统计和实验室修改重叠，并更改了事件合同及活动统计状态版本。按发布流程的远端领先保护规则停止：6 个修复文件已暂存，但本轮未创建提交、未合并或重放远端提交、未推送。上述测试和完整构建结果只对应旧基线加本轮补丁，不能作为升级后版本已通过的证据。需用户确认是否以最新远端 main 为基线重新对齐修复并验证。

## 用户续办后的提交与推送

用户随后要求先推送提交，合并由其后续处理。为不覆盖已升级的远端 main，已提前告知采用独立修复分支，并执行：

- 提交：`45ad5a99f39510bcf2a9ea2b45b5378e16fc0bde`，仅包含上述 6 个源码和测试文件。
- 正常推送：`git push origin HEAD:refs/heads/fix/source-build-20260916`，退出 0，未使用强推。
- 远端验证：GitHub API 的 `git/ref/heads/fix/source-build-20260916` 返回相同 SHA。
- 远端 main 未修改；本地 main 仍保留本次提交，相对 origin/main 为 ahead 1、behind 2，等待用户后续处理合并。
- `README.md`、`DEPLOYMENT_AGENT.md` 及本验证记录留在本地，未进入本次提交。
- 旧 `prepare-commit-msg` Hook 提示 `Can't find lefthook in PATH`，正常提交仍退出 0；未修改或绕过 Hook，构建、测试与静态检查使用上述已经完成的独立证据。
- 临时目录 `/tmp/fde-clean-build.GZjfl3` 及约 2.1 GiB 的源码副本、依赖与构建产物已删除；均可从基线与修复提交重新生成。
