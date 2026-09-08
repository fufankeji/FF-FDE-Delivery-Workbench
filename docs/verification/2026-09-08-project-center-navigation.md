# 项目中心最近动态与交付周期验证

## 范围与验收

- 最近动态的标题、更新时间和点击目标一一对应；会话更新打开精确 Agent 对话，阶段与项目登记记录打开对应项目管理页。
- 已归档、空白、子 Agent 和不属于项目的会话不作为普通会话入口；打开失败不新建会话或跳转到另一会话。
- 周期预览项目行、登记数量入口和查看全部入口可用；完整时间线只统计有周期的项目，保留已完成项目的周期，可返回卡片或列表。
- 企业与周期随项目保存在 `.fde/project-metadata.json`，侧栏和项目中心共享读取；旧浏览器仅初始化缺失记录，创建后的保存失败不重复创建项目。
- 不改变阶段记录、人工决定或项目运行状态。

## 自动验证

工作目录：`upstream/deepseek-harness`。以下为已执行的窄范围验证，不等于全仓或浏览器视觉验收。

| 检查 | 结果 |
|---|---|
| `packages/fde/project/tests/project-metadata.spec.ts` | 7 项通过；真实 HTTP 路由、持久化、并发初始化、隔离、非法日期、损坏文件及符号链接 |
| `packages/client/ui-workspace/tests/project-metadata.client.spec.ts` | 4 项通过；旧数据导入、Host 已有记录优先、保存失败恢复、错误项目响应与卸载 |
| `packages/client/ui-fde-project/tests/project-center-navigation.client.spec.tsx` | 3 项通过；活动内容/时间/目标、展开、周期预览/全部入口/计数/空态、失败重试 |
| `project-progress-page.client.spec.tsx` 与 `project-attention.client.spec.tsx` | 项目中心相关 30 项通过；原分页夹具补齐归档会话状态后单独复跑通过 |
| `ui-fde-project/tests/apply.client.spec.ts` | 2 项通过；精确会话入口额外覆盖错误所属、归档、空白、子 Agent 和删除后的目标 |
| `ui-workspace/tests/workspace-browser.client.spec.tsx` | 创建保存与保存失败恢复两项定向通过；失败仍保留项目，不自动创建 Session |
| `ui-workspace/tests/apply.client.spec.ts` | 6 项通过；原插件组合继续成立 |
| 受影响包类型检查 | `pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json packages/fde/project/tsconfig.json --pretty false` 通过 |
| Client 构建 | `pnpm --filter @deepseek-ai/dsh-client-ui-workspace --filter @deepseek-ai/dsh-client-ui-fde-project bundle` 通过 |
| Host 构建 | `pnpm exec tsdown --filter @deepseek-ai/dsh-fde-project` 通过 |

产品 PRD、总 Spec 和 F002 规格校验通过；本次变更遵循 PSC-002 与 AC-F002-003，完成 T013，不把 F002 其他未完成任务标为已完成。

## 3080 运行核对

- 仅重启规范主工作区的 3080，命令为 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`。
- 服务 PID 45382，cwd 为规范仓库的 `upstream/deepseek-harness`；首页返回 200。
- Boot Manifest 中 `ui-workspace` revision 为 `0f56b75e33f6`，`ui-fde-project` 为 `6843ec65be92`；两个实际返回的 Client Bundle 均与本地 `lib/client.js` 完全一致。
- 使用真实已登记 Workspace ID，不附带 `metadata`，只读请求 `/api/fde-project/metadata` 返回 200、`ok=true`，项目 ID 一致；该项目当前记录缺失，如实返回 `null`。
- 重启前后的 Workspace 登记存储 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。
- 没有操作 3081、业务项目服务或 Semantica，没有推进真实项目阶段。

## 剩余验收与边界

- 请刷新保存过旧周期的原浏览器，才会将旧记录自动导入项目文件。没有宣称已在用户原浏览器中执行过迁移。
- 当前修改未做浏览器截图或视觉验收；组件交互测试不等同实际点击验收。
- 最近动态是各类记录的最新更新摘要，不是完整审计日志；本次不增加已有周期编辑功能。
- 构建产物位于既有忽略目录，测试临时文件已清理；未提交 Git。

## 用户验收补修：首页返回路径

用户反馈时间轴无法回到主页后，核对到两个入口缺口：时间轴仅提供卡片/列表切换，产品首页则只作为初始状态而没有返回方法。补充顶部“返回首页”与时间轴标题左侧“返回项目中心”，保留原卡片/列表、具体项目和会话入口。

- 新增组件回归先复现缺少“返回项目中心”按钮而失败；修复后 `project-center-navigation.client.spec.tsx`、`page-controller.client.spec.ts` 与 `apply.client.spec.ts` 共 7 项通过。
- 返回项目中心后，项目集合、最近动态和周期预览完整恢复；返回首页后可再次进入工作台；导航未调用项目会话入口。
- `pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json --pretty false` 与 `pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` 均通过。受影响 README 和 Agent Note 配对校验通过。
- 3080 新 PID 为 57614，显式 `DSH_HOME=../../.runtime/dsh-home`；首页与实际 Client Bundle 均返回 200，revision 为 `125b7b19e44c`，内容与本地构建完全一致，包含两条返回文案。
- 重启前后 Workspace 登记存储摘要保持上述值；未改阶段数据，未操作 3081。本次仍由用户手动确认视觉效果，未提交 Git。
