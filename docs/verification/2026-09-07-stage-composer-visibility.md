# 八阶段输入框显示一致性验证

## 范围与依据

- 当前分支为 `main`，运行入口为 `http://127.0.0.1:3080`。
- 按用户确认的规则修复既有只读浏览行为，对应 `PSC-021` 与 `AC-F002-005`；不新增阶段模式，不修改阶段 API、Agent 执行链或项目数据。
- 实际当前阶段显示输入框；历史与未来阶段隐藏；查看阶段不改变当前阶段；正式返回流程仍由 Host 成功更新后生效。
- 修复第一、第二、第四阶段及通用归档／未来预览遗漏的隐藏标记，取消历史页为输入框预留的高度与底部空间。第三、第五及第六至第八阶段沿用已有判断。
- 空白会话保留工作台与草稿，只隐藏输入栏及输入区 dock；已有对话的只读阶段隐藏悬浮输入框区域。切回 Agent 对话不受这些选择器影响。
- 包说明按仓库文档规范补齐规则和现有双语配对；此前排序、背景图和第五阶段表格滚动改动原样保留，未提交 Git。

## 自动检查

命令均在 `upstream/deepseek-harness` 执行。

| 检查 | 结果 |
| --- | --- |
| `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx` | 53 项通过；新增覆盖八个当前阶段、七个历史阶段、七个未来阶段，以及推进后隐藏、权威阶段返回后恢复 |
| `corepack pnpm exec vitest run packages/client/ui-conversation/tests/stage-composer-styles.client.spec.ts` | 4 项通过；校验空白／已有会话的只读与可输入布局规则，草稿节点及内容保留 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` | 退出 0 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project --filter @deepseek-ai/dsh-client-ui-conversation bundle` | 两个包构建成功 |
| `corepack pnpm run verify-translation-pairing packages/client/ui-fde-project/README packages/client/ui-conversation/README` | 两组说明配对一致 |
| `git diff --check` | 退出 0 |

首次新增测试遇到 jsdom 缺少 Dialog 方法、Vite 转换 CSS 文件 URL 的测试环境问题；共享已有 Dialog 桩、使用测试工作目录读取样式后，上述检查通过。样式测试是局部规则测试，不是浏览器视觉验收。

## 主服务核验

- 按显式隔离命令启动：`DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`。
- 新进程 PID `92174`，从本仓库 `upstream/deepseek-harness` 启动，进程环境中的 `DSH_HOME` 与命令一致；首页 HTTP 200。
- 首页 Boot Manifest 指向的两个在线包均返回 HTTP 200，SHA-256 与本地构建逐字节一致，并包含新增隐藏规则和历史页高度恢复规则。

| 在线包 | 修订 | SHA-256 |
| --- | --- | --- |
| `ui-fde-project` | `90c5ce5b88f5` | `268cbe5ce2a11509864a69fcf47abf405c35c8d33c3f81e6fd0a28aabef3dd07` |
| `ui-conversation` | `6bd49637151e` | `6b16ccee5abb91d0ca9f2b0706abe133d7f79259c3096197c4365371085d01d2` |

- 隔离 Workspace 注册表重启前后 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，仍为原有三个项目。
- `3081` 的 PID `89999` 与 `4177` 的 PID `54378` 保持不变。
- 没有调用模型、正式阶段推进或返回接口，没有写入客户项目文件。

## 待人工确认

按项目人工优先约定，没有运行浏览器截图或全量 E2E。刷新 3080 后，当前第八阶段应保留输入框；回看第一至第七阶段应隐藏且不留底部输入框占位；返回当前阶段或切至 Agent 对话应恢复输入。
