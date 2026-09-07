# 合并后主工作树重新编译与验收环境

## 范围

- 基线为 `main` 的 `142323c1fc`，开始前工作区干净。
- 重新安装锁文件依赖、编译 Host 与 Client、打包 Web，更新主工作树 3080；未操作 3081 或客户项目 4177。
- 保留当前 `.runtime/dsh-home` 和 `/Users/muyu/FDE-Agent/fde-agent` 数据，不同步或覆盖其他 worktree 的运行数据。

## 编译阻塞与最小修正

- 首次完整构建在 Client TypeScript 检查失败：两个测试的局部快照直接断言完整 Hook 类型，另一个测试缺少 `showWhenBlank` 参数。
- 两个局部快照沿用所在测试文件既有的 `unknown` 显式断言方式；运行轨迹测试补入 `showWhenBlank={false}`。未放宽生产类型或修改业务实现。
- 定向测试另发现旧图谱断言期待同一数量文案出现两次；当前图谱已区分可见关系与总关系，断言改为分别验证 `2 个实体 · 1 条关系` 和 `2 个实体 · 1 / 1 条关系`。

## 已执行验证

在 `upstream/deepseek-harness/` 执行：

- `corepack pnpm install --frozen-lockfile`：退出 0，侧栏受控补丁更新，锁文件未修改。
- `corepack pnpm run build`：修正后退出 0，Host/Client TypeScript、运行包及 Vite 构建通过，记录 225 个 Client 构建产物。存在插件耗时和大于 500 kB 分块警告，不阻止构建。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/project-progress-page.client.spec.tsx packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx packages/client/ui-trajectory/tests/views.client.spec.tsx`：首轮 68 项通过、1 项旧图谱断言失败；修正后仅用 `-t 'renders the active ontology route'` 重跑失败用例并通过。合计 69 项相关测试已通过，没有重复执行其他通过用例。
- `git diff --check`：测试代码修正通过。

## 运行证据

- 启动命令：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`。监听 PID 为 `87012`，cwd 与 `DSH_HOME` 均核对为主工作树。
- 首页 HTTP 200，标题为 `FF - FDE 交付工作台`。
- 从首页 Boot Manifest 读取实际 URL，`ui-fde-project`（`66589d062501`）、`ui-renderer`（`d54e8971fd52`）、`ui-theme`（`d99b6d34825f`）、`dsh-better-sidebar`（`5e4a272854c8`）在线 Bundle 全部返回 200，SHA-256 与本地构建一致。项目包含新增预览接口，不含已移除的独立演示入口文案及 `deliveryDemo`。
- Workspace 登记文件重启前后 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`；原有三个项目及 7 个 Session 登记保留。
- 项目快照接口按源码使用可信 POST 读取，返回 HTTP 200、`ok: true`，当前客户项目运行状态为 `running`，第 2 至第 8 阶段数据可读取。初次误用 GET 返回预期的 405，未发生写入。
- 3081 仍由原 PID `85700` 监听；4177 仍由原 PID `54378` 监听。
- 构建日志留在 Git 忽略的 `.runtime/rebuild-main-20260907.log`，可由完整构建重建；本次未提交 Git。

## 待用户验收

未执行浏览器自审、截图、全量 E2E 或计费模型调用。用户刷新 3080 验收合并后的页面及交互；编译与接口通过不代表所有新功能已完成产品验收。
