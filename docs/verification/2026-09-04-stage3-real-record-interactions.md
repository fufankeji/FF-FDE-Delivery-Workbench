# 阶段三真实记录交互验证

日期：2026-09-04

## 范围

- 调查工作项、系统节点与连接、动作边界、数据发现和治理卡片仅在对应固定产物存在时打开真实项目记录。
- 缺失产物不生成点击入口；“只读记录”保持为状态文本。
- 不改变阶段推进、阶段返回或调查数据投影。

## 证据

- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx`
  - 结果：退出码 0，1 个测试文件、16 项测试通过。
  - 覆盖：鼠标点击、Enter/Space 键盘打开、真实路径回调，以及缺失治理记录时不呈现假入口。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle`
  - 结果：退出码 0，Client Bundle 生成成功。
- `corepack pnpm exec tsdown --env.DSH_BUILD_FACE host`
  - 结果：退出码 0；补齐并行阶段四配置所需的 Host 运行产物。
- `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3081`
  - 结果：`http://127.0.0.1:3081` 返回 HTTP 200。
  - 在线 Boot Manifest 的 `@deepseek-ai/dsh-client-ui-fde-project` Bundle 包含 `data-investigation-record-link`、`查看调查工作项` 与 `查看动作边界`。
  - 进程显式使用当前 Feature worktree 的 `DSH_HOME`；Workspace 注册仍为数据分析、知识库搭建和 FDE-Agent 三个隔离项目。

## 未验证与已知偏差

- 按仓库人工优先规则，本轮未自动打开浏览器做视觉或完整交互回放；在线页面保留给用户直接验收。
- `corepack pnpm run build:lib:host` 在并行阶段四测试的未使用导入上失败：`packages/fde/semantica/tests/semantica.spec.ts` 中 `readSemanticWorkspace` 未使用。本轮未修改该并行代码；运行所需 JavaScript Bundle 已由上述 `tsdown` 命令成功生成。
