# 代码支撑度评估（开发前）

> 阶段：项目开发前置评估（开发收口附件，随 `03-project-development` 一并交付）｜ 状态：候选评估产物
> 项目：星桥生活电商｜智能经营分析工作台·一期（Northlight / DS4-AI）
> 评估对象：`backend/northlight/`、`frontend/src/`、`scripts/`、`sandbox/`、`fixtures/`、`backend/tests/`
> 对照基准：`02-solution-design/project-prd.md`（FR-1~14）＋ `solution-design.md`（系统边界/决策）
> 方法：将代码按 「数据与查询 / 分析与模型 / 报告·Skills·Agent / API·仓储·安全 / 前端 / 测试·脚本·沙箱」 六组并行审阅，逐条对照 FR 与安全要求，引用「文件:行号」为证据。评估为候选结论，供开发决策，不代表客户/FDE 已验收。

---

## 0. 一句话结论

**现有代码已具备「本地优先分析工作台」的主体骨架，能满足一期大部分确定性功能；但存在若干影响「按期满足客户需求」的缺口，主要集中在：模型可复现元数据不完整、离线（无模型）时确定性能力不执行、字段画像缺 min/max、模型外发边界与导出包脱敏、以及性能验收未闭环。** 其中 **模型外发安全边界**（确认决策要求「仅脱敏字段+本地/私有模型」）与 **离线可用性**（决策 C-05）是两项需要优先对齐的硬要求；其余多为增强项。

---

## 1. 功能需求支撑度总览

| FR | 需求 | 状态 | 关键证据/缺口 |
|---|---|---|---|
| FR-1 | 项目化空间 | ✅ 支持 | 创建/重命名/归档/导出/隔离齐备。缺：archive 仅 status 标志，未对归档项目强制只读；导出包打包原始数据未脱敏 |
| FR-2 | 多数据源接入 | ✅ 支持 | CSV/Excel/SQLite 导入 + MySQL 只读会话（SET SESSION READ ONLY）；文件复制+sha256 保原始不被覆盖 |
| FR-3 | 字段画像 | ⚠️ 部分 | 类型/空值/唯一/来源变化已实现；**缺 min/max**（后端与前端均未产出/呈现）；MySQL 来源变化指纹仅按(表名,行数)，列变更或行数不变的数据更新检不出 |
| FR-4 | 只读查询 | ✅ 支持 | sqlglot AST 拒 DDL/DML/多语句；各源只读连接+表级作用域；记录 SQL+行数+结果哈希。缺：未单独保存 SQL 文本哈希；sqlite 无表级作用域 |
| FR-5 | 可视化 | ✅ 支持 | bar/line/area/scatter/pie/boxplot/heatmap；write_chart_spec 记维度/指标；前端 ECharts |
| FR-6 | 数据处理 | ✅ 支持 | 画像/清洗/特征均写入新 uuid 产物（derived/code），不覆盖原始。缺：清洗为固定配方，无参数化 UI；测试未显式断言原始文件字节未变 |
| FR-7 | 模型实验 | ⚠️ 部分 | 分类/回归/聚类 + 种子/特征/算法/指标/逐行预测已登记；**缺**：划分参数 test_size=0.2 硬编码且未写入 config、未调优时默认超参未记录、**target 混入 features 有泄漏**、聚类 kmeans n_clusters=4 写死 |
| FR-8 | 项目对话 | ⚠️ 部分 | 在线时先 plan_ready 后执行并给证据；但**计划是每意图固定三分模板**，非针对问题的自然语言计划；system prompt 未要求模型先陈述计划 |
| FR-9 | 报告版本 | ✅ 支持 | Markdown 底稿 + 引用产物 + 版本化 revise/restore（新版本）+ HTML 导出。缺：restore 只追加版本无覆盖/删除；重复 render_html 产生重复 HTML 产物 |
| FR-10 | Skills | ✅ 支持 | 可读 SKILL.md + 受控脚本 + 真实无网络沙箱（docker --network none/read-only/non-root/cap-drop）。缺：内置 10 个 Skill 均纯文档（无内置沙箱脚本实例）；沙箱可写整个项目工作区 |
| FR-11 | 离线可用 | ⚠️ 部分 | **查询/画像/可视化/特征/建模在无模型时不执行，仅返回指引文案**；仅报告与 HTML 导出真正落产物；NORMAL 对话需模型 |
| FR-12 | 自然语言入口 | ✅ 支持 | /chat 与 /chat/stream（SSE）；前端 ChatPage。离线多为模板指引 |
| FR-13 | 可复用 Skills | ✅ 支持 | 全局安装 + 项目启用 + 升级/卸载 + 跨项目复用。缺：前端按项目启用/运行/升级 UI 缺失（ChatPage 恒传 skillIds:[]） |

**图例**：✅ 支持（已实现且可用）｜ ⚠️ 部分（有核心实现但仍有关键缺口）

---

## 2. 支撑度按「功能分组」的细节（证据概要）

### 2.1 数据与查询（g1）—— 基础层扎实
- 四类数据源接入 + MySQL 只读会话：`data_sources.py:211-321`。
- 只读查询引擎：sqlglot AST 拒写 + 单语句 + 源作用域 + 只读连接 + 限时限行：`query_service.py:24-234`。
- 记录 SQL/行数/结果哈希 + 来源指纹：`query_service.py:148-176`、`repository.py:230-254`。
- 原始不覆盖：复制 + `datasets/derived|extracts` 目录隔离：`workspace.py:12-26`、`query_service.py:152-153`。
- **缺口**：画像无 min/max；MySQL 指纹仅(表名,行数)；profile_excel 无行数上限（DoS 面）。

### 2.2 分析与模型（g2）
- FR-6 强：画像/清洗/特征均创建新 uuid 产物且登记 lineage，不回写源：`analysis_service.py:78,118-129,141-183,195-219`。
- FR-7 部分：`ml_service.py:90-153,181-306` 覆盖三类任务；`model_jobs.py:18-160` 异步训练+取消+超时；**划分参数/默认超参/target泄漏/聚类k 写死**为缺口。
- **FR-5 缺口**：分析/模型组内无图表生成（其实现位于 query_service/api），属分组边界而非整体缺失。

### 2.3 报告·Skills·Agent（g3）
- FR-9 强：Markdown 真相源 + 引用产物 + 版本化 + HTML：`report_service.py:46-224`、`repository.py:461-471`。
- FR-10 强：受控脚本 + 无网络沙箱：`skill_service.py:46-80,198-246,510-533`、`run-sandbox.sh:28-41`。
- FR-8 部分：先计划后执行的框架存在，但计划为固定模板。
- **FR-11 部分**：离线仅报告/HTML 落产物，查询/画像/建模只给提示：`agent_runtime.py:961-1026`。
- 安全面：只读护栏、凭证不外泄、模型上下文最小化披露（20 行+schema+摘要）、Skill 沙箱、归档防护均落地。

### 2.4 API·仓储·安全·运维（g4）
- 端点覆盖 PRD：项目/数据源/资产/查询/图表/画像/清洗/特征/模型/预测/chat/报告/skills/系统。
- 凭证保护：DB 密码入进程环境（`data_sources.py:284-296`）、api_key 写 settings 0600（`connection_settings.py:19-48`）、导出 manifest 不含 config。
- 敏感设置路由同源守卫：`api.py:96-110`。
- **缺口/风险**：**导出包打包原始数据（sources/extracts/predictions）“未脱敏”**（`api.py:279-286`）；`/system/mysql/inspect|import` 未加同源守卫（`api.py:1188-1207`）；sqlite 无表级作用域；archive 未强制只读；export 残留 runtime/exports 无清理。

### 2.5 前端（g5）
- FR-1/2/4/5/7/8/9/12 为可用页面。
- 结构化图表（table/bar/line/scatter + 扩展饼/箱线/热力/面积）：`ExplorePage.tsx:46,51`、`ChatPage.tsx:433`。
- 报告 canvas 完整（Markdown/引用/版本/HTML）：`ReportCanvas.tsx:16-76`。
- **缺口**：`ReportsPage.tsx` 未接入路由（`App.tsx:27` 重定向到 chat?panel=report），独立报告页为死代码；画像 UI 未呈现 min/max；清洗/特征与按项目 Skill 启用缺参数化/中控 UI。

### 2.6 测试·脚本·沙箱（g6）
- 强测试：只读守卫（`test_data_query.py:95-141,173-181`）、报告版本化/XSS/证据审计（`test_reports_skills.py`）、Skill 沙箱真隔离（`test_skill_sandbox_integration.py` uid/network/rootfs）、项目隔离/归档（`test_workspace_repository.py`）。
- 沙箱真实：`--network none / --read-only / --cap-drop ALL / --no-new-privileges / --user 10001 / --pids-limit`。
- **性能缺口**：`scripts/benchmark_million.py` 只测一次生成+一次聚合，**不计算 P95、无 <10s 断言、未走 QueryService 路径、证据未版本化、无 CI 门禁**。

---

## 3. 与「已确认范围/决策」的匹配度

| 已确认决策 | 现状 | 判断 |
|---|---|---|
| 3 名分析师单机试点 | 本地优先单机架构，符合 | ✅ 匹配 |
| 文件优先 + 只读副本，MySQL 直连非前置 | CSV/Excel/SQLite + 只读会话；MySQL 可延后 | ✅ 匹配 |
| **仅脱敏字段 + 本地/私有模型，敏感不外发** | 已做最小化披露（20 行+schema+摘要、排除 credentials/绝对路径/全量/原始预览）；但 **模型服务为在线 DeepSeek，且会把查询结果前 20 行预览发往远端模型** | ⚠️ **需重点对齐**：需确认是否落地本地/私有模型，或进一步收窄外发内容（仅聚合/字段名） |
| 验收用 AUC/召回率/F1 | 指标含 f1_weighted/cv/recall；未用“准确率 80%” | ✅ 基本匹配 |
| 国庆按“演示核心链路” | 链路（接入→查询→图表→模型→报告）已能闭环 | ✅ 匹配 |

> **最关键待对齐**：已确认决策要求「敏感字段不外发、模型仅脱敏/聚合」。现状虽然做了最小化披露与凭证排除，但 `agent_runtime.py:552` 会把 **query 结果预览（最多 20 行实值）** 发往远端模型。这与「仅脱敏字段 + 本地/私有模型」存在边界张力，需在开发启动前明确：外发是否允许 20 行实值、是否强制本地/私有模型、字段白名单如何落地。

---

## 4. 缺口清单（按优先级）

### A 类（影响客户硬性需求，建议先处理）
| id | 缺口 | 对应需求/决策 | 现状位置 |
|---|---|---|---|
| G-1 | **模型外发边界**：查询结果前 20 行实值发往远端模型；需确认本地/私有模型或收窄为仅聚合/字段名 | 已确认“敏感不外发/仅脱敏+本地模型” | agent_runtime.py:552 |
| G-2 | **离线确定性不执行**：无模型时查询/画像/可视化/特征/建模仅返回提示，不真正执行 | 决策 C-05“无模型时确定性能力仍可用” | agent_runtime.py:961-1026 |
| G-3 | **字段画像缺 min/max**（后端未统计、前端未渲染） | PRD FR-3 | data_sources.py:26-204、SourcesPage.tsx:85、DataPage.tsx:188 |
| G-4 | **模型可复现元数据不完整**：划分参数(test_size=0.2)未登记、默认超参未记录、target 泄漏、聚类 k 写死 | PRD FR-7 / 访谈 C-03 可追溯 | ml_service.py:173-177,194-196,243-255,322 |
| G-5 | **导出包未脱敏**：项目导出打包原始 sources/extracts/predictions，且含 preview 元数据 | PRD 安全“凭证/敏感不入导出包” | api.py:279-286 |
| G-6 | **性能验收未闭环**：benchmark_million 无 P95/<10s 门禁、不走 QueryService、证据未版本化、无 CI 门禁 | PRD PA-1 | scripts/benchmark_million.py:44-86 |
| G-7 | **自然语言计划非原生**：计划为固定三分模板；system prompt 未要求模型先陈述计划 | PRD FR-8 | agent_runtime.py:64-95,840-852 |

### B 类（增强/稳健性，建议排期）
| id | 缺口 | 说明 |
|---|---|---|
| G-8 | archive 未强制只读；export 残留未清理 | repository.py:63-64、api.py:244 |
| G-9 | sqlite 无表级作用域；`/system/mysql/inspect|import` 无同源守卫 | query_service.py:64-87、api.py:1188-1207 |
| G-10 | report restore 仅追加版本、重复 render_html 生成重复 HTML 产物 | report_service.py:112-125,162-176 |
| G-11 | 前端：ReportsPage 未路由；画像 min/max 未渲染；清洗/特征与按项目 Skill 缺参数化/中控 UI | App.tsx:27、SkillsPage.tsx:34-104 |
| G-12 | 清洗为固定配方、无字段级配置；内置 Skill 纯文档无沙箱脚本实例 | api.ts:211-228、skills/*/SKILL.md |
| G-13 | joblib 反序列化、SQLite 并发写 locked、sandbox 可写整个工作区、离线判定仅看单环境变量 | ml_service.py:293、model_jobs.py:25、run-sandbox.sh:26 |

---

## 5. 建议的开发启动路径

1. **先对齐 A 类中的 G-1 与 G-2**（涉及已确认决策，需产品/IT 拍板）：确定本地/私有模型与外发字段白名单；把离线时确定性能力改为真正执行（而无模型只影响 NL 语义层）。
2. **补 G-3 / G-4 / G-6**（数据与模型层）：画像加 min/max；模型 config 记录划分/默认超参/剔除 target；性能脚本改为走 QueryService 并计算 P95 且设 <10s 门禁，证据基线纳入版本库。
3. **补 G-5 / G-8 / G-9**（安全与运维）：导出前脱敏/排除原始数据；归档项目只读；敏感系统端点加同源守卫。
4. **补 G-10 / G-11 / G-12**（前端与报告体验）：路由 ReportsPage、渲染画像统计量、清洗/特征参数化、按项目 Skill 中控。
5. **确认单机落地方式（每分析师独立实例 vs 共享本机多项目）** —— 已在方案未决项 U-1，影响工作区隔离与备份，应在开发前定。

---

## 6. 评估未尽事项

- 本评估基于对源码的静态审阅与现有测试，**未实际运行端到端链路**（未启动后端、未跑真实百万行与 MySQL、未验证 docker 沙箱在当前环境可用）。建议进入开发前/首个迭代做一次 **真实链路 smoke test**（文件数据跑通 接入→查询→画像→图表→模型→报告）以验证。
- 部分未决项（报告导出格式 PDF/Word、性能设备与查询集、复购训练窗口）仍依赖客户/IT 提供，见 `02-solution-design/solution-baseline.md` U-2~U-8。

---

> 本评估为候选结论，用于开发决策；是否进入项目开发由 FDE 在项目进度页决定。所有 FR 状态以实际代码证据为准，未将推断写为已实现。
