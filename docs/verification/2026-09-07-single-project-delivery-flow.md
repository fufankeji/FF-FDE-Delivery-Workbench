# 恢复单一项目交付链

日期：2026-09-07。用户明确要求移除额外演示入口和横幅，使用当前项目数据走原交付链。本记录替代此前完整演示方案；未提交 Git。

## 实现

- 删除 deliveryDemo Host 读取器、快照类型、独立模拟生命周期、前端进入／退出开关、侧栏与正文演示提示、演示 CSS 和对应测试。保留原阶段专用工作台、来源下钻、只读历史及未来预览。
- 默认阶段来自真实项目状态，回看只改变浏览选择。第八阶段显示持久化 improvementCycles 和 lastReviewedAt，不创建第二条进度轴。
- 当前验证项目按用户授权写入联调输入；来源在项目 docs/verification/2026-09-07-delivery-flow-fixture.md 和阶段 dataProvenance 中注明。不修改正式推进接口、证据校验或全局门槛，不直接写 Storage。

## 数据与恢复

数据源仍为 /Users/muyu/FDE-Agent/fde-agent；四个 .fde/stages 阶段文件是工作台唯一读取的输入。替换前 JSON 分别保存在 docs/verification/delivery-flow-before-{evaluation,pilot,production,improvement}.json，总计约 79 KiB，用于回退本次替换；保留至本轮联调验收结束后可清理。原客户资料、图谱、业务源码和应用运行数据未改动。

输入包含人为构造的通过结果与指标，仅用于校验工作台交付状态链，不表示实际生产发布、客户签收或页面人工验收已发生。第五阶段原七项技术结果不变，原人工验收 NOT_RUN 保存在恢复记录中。未再生成产品模式，未把旧演示目录接入产品；该目录仅保留历史文件，不再由快照读取。

## 原接口推进结果

每步先读阶段门，均 reviewReady=true、blockers=[]，再以当前 expectedRevision 调用 /api/fde-stage/v2/complete：

| 提交阶段 | 原 revision | 新阶段 | 新 revision | 已完成改进轮数 |
| --- | --- | --- | --- | --- |
| evaluation | 5 | pilot | 6 | 0 |
| pilot | 6 | production | 7 | 0 |
| production | 7 | improvement | 8 | 0 |
| improvement | 8 | improvement | 9 | 1 |

最近评审时间：2026-09-07T10:06:51.230Z。原始请求读回结果另存项目 docs/verification/2026-09-07-delivery-flow-transitions.md。阶段 6/7/8 当前分别读取 9/10/10 条记录。

## 验证

- stage-workbench.client.spec.tsx、project-context-sidebar.client.spec.tsx、delivery-stage-panel.client.spec.tsx：46 项通过；只删除演示测试，并新增实际完成轮数与无演示入口断言，既有普通阶段测试保留。
- ui-fde-project、fde/project TypeScript 检查均通过；Client bundle 成功。
- 3080 首页 HTTP 200；进程 83618 使用 canonical upstream 工作目录和显式 DSH_HOME=../../.runtime/dsh-home；隔离 Workspace 仍为 ai-analysis、llm-wiki、fde-agent，重启前无运行中会话。未操作 3081、4177。
- 在线 bundle rev=1f45eb350cb2，SHA-256=9a8a90b2ae53c2663c04babf751b825808d3d5a5057c730f8407ebd9947b3a5e，与本地一致。
- 在线 bundle 不包含“后三阶段完整演示”“完整示例已准备”“查看完整演示”“退出演示”或 deliveryDemo。项目 snapshot 没有 deliveryDemo；实际阶段读回 improvement、revision=9、improvementCycles=1。
- 未运行浏览器自动回放、截图或视觉验收。页面由用户刷新后手动确认。
