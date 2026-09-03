# F022 项目运行与内嵌预览验证

## 范围

- Feature：F022 项目运行与内嵌预览；同步完成 F012-T007 运行态 API 文档门。
- 分支：`main`
- 基线：`e1bf102fa710`
- 用户可见目标：项目从“项目开发”阶段开始在交付页头提供启动/打开/查看终端/停止入口；DSH Agent 读取项目 `AGENTS.md`，在右侧持久终端执行真实启停；成功后在 Better Sidebar Browser 内嵌打开项目；只有运行中且存在真实 OpenAPI 来源时显示“API 文档”。
- 保持项：不增加后台进程管理平台，不猜测技术栈、命令或端口，不打开系统浏览器，不用宽泛 kill，不在项目进度页直接启动项目。

## 实现与测试证据

| 检查 | 结果 |
|---|---|
| PRD、Product Spec 与 F012/F022 Feature 机检 | exit 0；PRD confirmed（24 REQ、10 NFR、23 AC），Product Spec confirmed（29 PSC、34 需求映射、23 AC），F012/F022 ready 且无 Feature 错误或警告；PRD 仅保留既有范围复核 warning |
| FDE Project Host 与 Client 聚焦测试 | exit 0；8 个文件、30 项全部通过，覆盖运行状态迁移、operationId 与 Session 守卫、loopback/OpenAPI 校验、停止失败重试、页头状态动作、API View 门和既有项目页面 |
| `pnpm exec tsc -p packages/fde/project/tsconfig.json --noEmit` | exit 0 |
| `pnpm exec tsc -p packages/client/ui-fde-project/tsconfig.json --noEmit` | exit 0 |
| `pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | exit 0；生成最新 Host 合同与 Client CJS 工件 |
| `pnpm run build:web` | exit 0；Vite 转换 336 个模块并生成 Web 工件；仅保留既有大 chunk 提示 |
| README 与 Agent Note 翻译配对 | exit 0；4 个命名文档对一致 |
| `pnpm run verify-agent-note-format` | exit 0；604 个 Agent Note 格式通过 |

聚焦状态合同：启动失败可继续开发并重试启动；停止失败保留预览和终端，只允许查看运行事实或重试停止，不能再启动第二份服务；停止成功后收起预览和运行态 API 入口，但保留终端标题和输出。

## 启动按钮回归修复

- 人工复现：点击“启动项目”后出现 `cannot get property "betterSidebar"`，尚未进入项目 Agent 或终端步骤。
- 根因：页头虽然在 `ctx.inject(['betterSidebar'])` 生效后注册，但动作闭包延迟读取的是插件外层 Context；该 Context 没有 Better Sidebar 服务权限。
- 修复：运行注入对象显式接收并持有回调作用域中的 Better Sidebar 实例，启动、停止、打开项目和查看终端统一使用该实例。
- 验证：`apply.client.spec.ts` 通过真实 Header Slot 注入对象执行启动，确认项目文件树先打开且 Agent 指令成功排队；单文件 3 项测试、Client `tsc --noEmit` 和目标 bundle 均通过。

## 启动阻塞时的对话回退修复

- 人工复现：用户在“观测”等非对话 View 点击“启动项目”；项目根缺少 `AGENTS.md` 后，Agent 已写入 `blocked`，但当前 View 没有切回对话，因此中央区域看起来为空白，只剩页头阻塞摘要。
- 根因：启动动作直接配置 Sidebar 并排队 Agent 指令，没有选择当前 Session 的 `chat` View；“继续开发”按钮才执行切换，导致正常 Agent 回复被隐藏在另一个 View。
- 修复：启动校验通过后立即选择当前 Session 的“对话”并打开该 Session，再配置 Sidebar、创建运行操作和排队提示；提示明确要求 Agent 无论成功或阻塞，都在调用 `project_runtime_report` 后用简短中文说明结果和下一步。页头继续只显示状态摘要和恢复动作。
- 定向文档机检：PRD confirmed（24 REQ、10 NFR、23 AC）、Product Spec confirmed（29 PSC）、F022 ready，均 exit 0；PRD 仅保留既有范围复核 warning。
- 定向实现验证：`pnpm exec vitest run packages/client/ui-fde-project/tests/apply.client.spec.ts packages/client/ui-fde-project/tests/project-runtime-header.client.spec.tsx` exit 0，2 个文件 5 项通过；Apply 测试同时断言选择/打开 Session 发生在 Agent prompt 之前。
- 编译与构建：Client `tsc --noEmit` exit 0；`@deepseek-ai/dsh-client-ui-fde-project` bundle exit 0；Agent Note 翻译配对 exit 0。
- 隔离运行：使用 `DSH_HOME=../../.runtime/dsh-home` 重启 3080 后，`curl` 返回 `200 text/html; charset=utf-8`。

## 已启动服务仍停留在阻塞态的恢复修复

- 人工复现：同一启动会话先因缺少 `AGENTS.md` 报告 `blocked`；随后 Agent 补齐说明、真实启动并验证前端、后端健康检查和 OpenAPI，却在用原 operationId 报告 `running` 时收到 `当前 blocked 状态不能报告为 running。`。因此页头不更新、“API 文档”不出现，内嵌 Browser 也没有自动打开。
- 真实运行事实：`http://127.0.0.1:5173`、`http://127.0.0.1:8000/api/health` 和 `http://127.0.0.1:8000/openapi.json` 当前均返回 HTTP 200；旧 `.fde/project-runtime.json` 仍如实保持该失败操作的 `blocked`，没有用文件改写伪造 running。
- Host 修复：仅对 `action=start` 的当前 blocked 操作开放恢复；仍要求同一 operationId、原发起 Session、合法 loopback 预览地址及既有 OpenAPI 校验。停止操作的 blocked 不允许直接恢复为 running。
- Client 修复：启动 blocked 状态按 3 秒低频刷新；同一操作从 `starting` 或 `blocked` 首次变为 `running` 时自动打开右侧 Browser 一次，重复 running 快照不会重复打开；运行快照更新同时触发 API 文档可见条件重算。
- 再次启动提示：Agent 先依据 `AGENTS.md` 及其引用的真实项目说明验证已声明服务；只要现有服务已经可用就直接报告，不依赖原终端仍然存在，也不重复启动第二份。
- 定向验证：4 个测试文件 13 项通过；Host/Client `tsc --noEmit`、`@deepseek-ai/dsh-client-ui-fde-project` bundle、3 组 README/Agent Note 翻译配对均 exit 0。
- 验收方式：不手改旧运行记录。已用隔离 DSH_HOME 重启 3080 并取得 HTTP 200；刷新页面后点击一次“重试启动”，新操作应由 Agent 验证现有服务后报告 running；随后页头更新、右侧 Browser 自动打开且“API 文档”出现。

## 隔离运行证据

- 页面：`http://127.0.0.1:3080`
- DSH_HOME：`/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`
- 工作区记录：仅包含 `数据分析项目`，路径 `/Users/muyu/test/ai-analysis`。
- 启动命令明确注入上述 `DSH_HOME` 后，`curl http://127.0.0.1:3080/` 返回 `HTTP 200 text/html`。
- 曾有一次重启遗漏 `DSH_HOME`，导致页面读取全局工作区；发现后立即停止该进程并按上述隔离目录重启。后续 3080 验证不得省略该环境变量。

## 手工验收与边界

- 按协同开发约定，未执行浏览器截图、视觉对比或完整 E2E；页面已留在 3080 供用户手动验证。
- 建议按顺序检查：项目开发阶段显示“启动项目” → 点击后可见 Agent 指令和右侧终端 → 服务验证成功后右侧内嵌项目可打开 → 有真实 OpenAPI 时才出现“API 文档” → 停止后预览/API 收起且终端输出仍可进入。
- 项目缺少 `AGENTS.md` 或尚不可启动时，点击启动应直接进入当前对话，由 Agent 正常说明具体阻塞原因和下一步；该情形不应出现中央白屏，也不应产生假 URL、假 API 文档或隐藏后台成功。
