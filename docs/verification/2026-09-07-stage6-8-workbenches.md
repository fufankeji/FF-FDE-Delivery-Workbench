# 阶段六至八工作台与真实资料接入验证

日期：2026-09-07。实现范围：F010 / F011 / F012 的 AC-003 与 T009；不是三个阶段的真实生产执行完成。

## 实现与边界

- PRD、PSC-025、Feature Map、三个 Feature 的 spec/plan/tasks 和架构已同步。状态新增 delivery：版本、摘要、环境、固定类别、责任、观察时间、下一动作及证据。
- 第六阶段：试点运行与交付；第七阶段：生产与验收交接；第八阶段：运行反馈与持续改进。专用页签、右侧详情、固定记录、只读未来／历史预览保留既有主路径。
- 同版本声明和文件摘要检查不等于验证报告真实性或批准权；本地测试不自动成为试点或生产结论。未接入的部署、监控、生产 Semantica 查询和签收执行器没有虚假执行入口。

## 定向检查

- PRD validator --require-confirmed：通过，29 REQ、14 NFR、25 AC；保留原有需求数较多的提醒。
- Product Spec validator --require-confirmed：通过，25 PSC；Feature validator --require-ready --feature F010 --feature F011 --feature F012：通过。
- 两个直接修改包 tsc -p <package>/tsconfig.json --noEmit：通过。首次使用 --incremental false 被 composite 配置拒绝，去掉该选项后通过，不是源码错误。
- 首组 Vitest 四文件：66 项通过（delivery-workbench、project、delivery-stage-panel、stage-workbench）。
- 后续新增环境范围检查并验证方法指引：delivery-workbench + stage 共 37 项通过；前三阶段独立预览路由 3 项通过。合计 95 个不同测试通过，重复执行不重复计数。
- 测试编写过程修正两处夹具不足：未来路由快照缺少既有 requirements 字段；jsdom 未实现原生 dialog 方法。另修正一处断言“不能／不可”文字差异。没有因此弱化生产代码或业务门禁。
- 客户端 bundle 成功。仅运行定向测试，不运行整套浏览器回放、自动截图或付费模型；视觉效果和真实浏览器完整操作仍待用户确认。

## 主运行区读回

- 主仓库 main，主端口 http://127.0.0.1:3080。只重启对应服务，保留独立的 3081 与客户应用 4177。
- 新 3080 监听进程 PID 63405，显式 DSH_HOME=../../.runtime/dsh-home，从 canonical upstream/deepseek-harness 启动。首页 HTTP 200。
- 从首页 __DSH_BOOT__ 读取 ui-fde-project 的真实在线 bundle URL，HTTP 200，含三个新页面标题与 data-delivery-workbench。
- 隔离 workspace.json 仍登记原有 3 个 Workspace；fde-agent 对应目录 /Users/muyu/FDE-Agent/fde-agent，原有 2 个 Session ID 保留。
- /api/fde-stage/open 只读已存在阶段：evaluation、revision=5、improvementCycles=0。未调用任何推进接口。
- /api/fde-project/snapshot：pilot 8 项、production 10 项、improvement 11 项，delivery.status=ready、versionCurrent=true，固定文件分别 3/3 可读，reviewReady 均 false。
- 第五阶段候选仍 local-repair-v0.2-ui，原 79 个实现／资料文件摘要未变，testing.current=true，唯一原必测缺口仍为页面完整流程人工验收。

## 客户资料接入

在 /Users/muyu/FDE-Agent/fde-agent 新增 .fde/stages/{pilot,production,improvement}.json，以及各阶段目录下的 9 份准备记录和 docs/verification/2026-09-07-delivery-observation.json。这些是当前项目资料，不在工作台 Git 仓库内；本轮未提交或推送。

数据来自已有源码、需求／架构／测试说明、第三阶段系统与治理记录、第五阶段真实测试输出和第四阶段 56 实体／56 关系快照。本地 GET /api/health 实际返回 mode=local、modelConnected=false；没有伪造 Pilot、生产用户、客户批准、恢复实操或新业务运行。

## 待人工确认与后续范围

刷新 3080，进入该项目，点击左侧第六、七、八阶段；查看页签、右侧详情、长文件名及短视口滚动。“返回当前阶段”回到第五阶段，不改变 lifecycle。执行开发仍在 Agent 对话。

真实试点、生产观测、客户签收、运行责任实操和应用侧独立 Semantica 生产查询仍未完成；原 T001–T006 未因本轮界面交付被勾选。用户原有 stage-05-evaluation/README.md 改动未修改。
