# 第六至八阶段完整演示验证

状态：已撤回。用户于 2026-09-07 明确否定独立演示模式；其入口、读取器和状态分支已移除。下文仅保留历史调试过程，不代表当前产品合同。当前结果见 2026-09-07-single-project-delivery-flow.md。

## 最新结果：阶段状态闭环修复

本节替代下方历史记录中“默认第六阶段、只显示演示资料数量”的行为。用户指出导航切换不等于阶段闭环，本轮已补齐独立模拟决定及状态投影。

- 唯一演示目录新增 `lifecycle.json`（约 3 KiB，可由三条明确标为虚构的决定重建，功能验收结束后随独立演示目录清理）。模拟试点评审 Go → 模拟验收交接 Go → 第一轮改进完成均已落盘，带编号、版本、角色、时间、依据和 SHA-256。
- Host 核验决定顺序、阶段就绪、版本与证据，返回 `deliveryDemo.lifecycle`；前端不根据文件数量猜完成。无决定时保持未完成，缺失或无效决定不显示完成链。
- 演示进度轴只显示六至八阶段，六／七“演示已完成”，八“本轮已完成 · 演示”；默认跟随第八阶段，可回看六七，并在正文查看模拟决定和迁移记录。退出恢复真实第五阶段与完整八阶段路径，再进入回到演示当前阶段。第八阶段本轮完成不等于永久终止改进，下一轮仍待开始。
- 四个定向测试文件共 60 项获得通过证据：首次运行前端 50 项通过；后端首次 2 项失败，原因是测试夹具给试点使用了生产 scope；按既有阶段约束修正夹具后，后端 10 项全部通过。包含空决定不自动完成、越序、重复编号、非递增时间、旧版本、失效依据、工作未完拒绝，以及真实侧栏／正文共享订阅的进入、回看、返回、退出和重新进入。
- 两个包 TypeScript 检查通过，Client bundle 成功；PRD、总 Spec、F010/F011/F012 规格校验通过，`git diff --check` 通过。未运行浏览器回放、截图或视觉验收。
- 3080 更新后的监听进程为 78548，显式 `DSH_HOME=../../.runtime/dsh-home`，首页 HTTP 200。在线 bundle `rev=bf9ba608c881` 的 SHA-256 为 `074f5d622b0527e2b0fe220aba463e920ee04617fab2e7c1d3d2c0220b50265a`，与本地一致，包含“本轮交付与改进已闭环”，不含旧的演示文件数量状态表达。
- 在线 API 确认：演示当前为 improvement，completedCycles=1；pilot=completed、production=completed、improvement=cycle-completed；DEMO-FDE-06／07／08-CYCLE-01 三条决定依据均 current=true。
- 实际项目保持 evaluation、revision=5、improvementCycles=0；本轮前后四个真实阶段文件摘要逐一一致。隔离 Workspace 仍只有 ai-analysis、llm-wiki、fde-agent；重启前所有会话 idle，未操作 3081 或 4177。
- 未执行真实部署、批准、客户签收、发布或 Git 提交。当前完成的是可追溯的演示状态闭环，实际交付仍需真实证据和人工决定；页面效果等待用户手动确认。

## 实现与数据

- Web snapshot 独立字段 `deliveryDemo`，真实 `v2Stages` 不变；模型工具不加载演示。
- 首次自动展示第六阶段；六、七、八阶段直接切换；退出恢复真实第五阶段。每页与详情、文件保留虚构标记，没有演示部署、批准或 Agent 执行入口。
- 演示数据源：`/Users/muyu/FDE-Agent/fde-agent/.fde/previews/delivery/`，18 个小文本文件，磁盘占用约 104 KiB。9 / 10 / 10 条详细记录，9 份固定文档，另有版本、语义依赖和证据说明。没有复制客户代码、原始资料、运行时或图谱。
- 所有指标、角色、授权、签收、发布和观测时间均为虚构样例，不是运行证据。SHA-256 仅校验示例文件一致性。
- 资料保留至本轮功能验收结束；可将 manifest.enabled 改为 false 停用自动展示，或验收后清理整个独立演示目录。不会影响真实材料。本轮未提交 Git。

## 定向检查

- `vitest run packages/fde/project/tests/delivery-demo.spec.ts packages/client/ui-fde-project/tests/delivery-stage-panel.client.spec.tsx packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx`：首次 39 通过、3 失败；失败为新增测试遗漏 each 回调参数，已修复。
- 修正测试参数及浏览控制器的原子通知后，仅重跑受影响项：`vitest run packages/client/ui-fde-project/tests/delivery-stage-panel.client.spec.tsx packages/client/ui-fde-project/tests/stage-workbench.client.spec.tsx -t 'demonstration|automatically opens'`，4 通过、35 跳过。合计 42 个不同测试均有通过证据。
- 两个受影响包 `tsc --noEmit` 均通过；客户端 bundle 成功。未运行全仓检查、浏览器自动回放、截图或录屏，视觉效果仍由用户确认。
- PRD、Product Spec 和 F010/F011/F012 规格校验通过。PRD 仅有已有的需求数量提示。

## 3080 在线结果

补充：演示错误提示按阶段的 1-based index 显示；新增第七阶段缺失提示断言，读取器 3 项定向测试再次通过。修正后重启并复核首页、在线 bundle、隔离运行目录和 Workspace 清单，均通过。

- 主仓库 main，最终监听进程 68407；工作目录为 canonical upstream/deepseek-harness，`DSH_HOME=../../.runtime/dsh-home`。
- 重启前会话均未运行；未操作 3081 或业务应用 4177。首页 HTTP 200。
- 在线 Client URL：`/plugins/@deepseek-ai/dsh-client-ui-fde-project/client.js?rev=bdc56926a063`；在线与本地 bundle SHA-256 一致，包含完整演示文案。
- snapshot.deliveryDemo.status=ready；阶段 6 / 7 / 8 分别为 9 / 10 / 10 项，均 3 份可读产物，所有示例证据摘要一致；三个 demo.reviewReady 均 false，不能进入真实阶段门。
- 项目实际阶段仍为 evaluation，revision=5，improvementCycles=0。
- 前后对比 8 个真实文件摘要：evaluation / pilot / production / improvement 四个真实阶段 JSON、project-runtime.json、architecture.json、knowledge-graph.json、maintenance/state.json 全部一致。
- 隔离区仍登记 ai-analysis、llm-wiki、fde-agent 三个 Workspace，登记会话数量分别为 3 / 2 / 2；未迁移或删除会话。

## 边界

### 导航闭环修复

用户截图反馈后确认：正文在没有显式选择时默认第六阶段演示，而侧栏默认真实第五阶段；另有侧栏“非当前＝已完成”的错误文案。增加侧栏＋正文＋同一个 ProjectStageViewController 的订阅联动测试，修改前因第六阶段没有当前浏览标记失败，修复后通过。

- 共用 resolveProjectStageView，显示演示位置、示例文档数量与真实阶段；提供侧栏退出和重新进入入口。
- 联动点击侧栏第七阶段、正文第八阶段，核对标题与文档同步；退出恢复第五阶段，再进入同步回到第六阶段。
- 侧栏与阶段工作台两个测试文件 40 项通过；补充未来阶段不显示已完成的断言后，该项单独通过。没有执行浏览器视觉审查。
- ui-fde-project 类型检查和 bundle 通过；3080 在线 bundle `rev=1a142289fac0` 与本地 SHA-256 一致，包含“演示浏览状态”。
- 真实项目仍 evaluation、revision=5；本次只修改前端导航及相应文档，没有写入客户项目文件或执行阶段决定。

这是完整信息展示，不是生产链路执行。没有企业授权、真实试点、客户签收或线上发布证据；真实项目仍需按原流程取得对应证据与人工决定。
