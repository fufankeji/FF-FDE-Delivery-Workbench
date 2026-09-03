---
document: feature-spec
feature: F020
status: ready
updated: "2026-08-27"
---

# F020 · 项目开发规范与研发进度规格

## 目标与可观察结果

项目进入项目开发后，工作台提供单一内置 `fde-project-development` Skill，引导 Agent 按“项目 PRD → 产品总规格 → Feature Map → 逐 Feature Spec/Plan/Tasks → 实施与证据”推进。项目进度直接读取项目真实 `docs/`，展示核心文档、Feature、任务、日期/里程碑、阻塞和研发收口产物；不存在第二套任务数据库。三份固定收口产物齐备后，仍只有 FDE 能推进到验证评估。

## 来源与范围

- 来源需求：REQ-002, REQ-003, REQ-004, REQ-011, REQ-012, REQ-015, REQ-016, REQ-024, NFR-001, NFR-003, NFR-004, NFR-005, NFR-007, NFR-008, NFR-010
- 来源总规格：PSC-002, PSC-004, PSC-005, PSC-006, PSC-007, PSC-009, PSC-011, PSC-017, PSC-018, PSC-028
- 对应 PRD 验收：AC-004, AC-014, AC-015, AC-023
- 当前切片包含：开发 Skill、固定 docs 合同、安全扫描、研发进度只读展示、Markdown 预览、三份收口产物和 `development → validation` 人工门。
- 当前切片不包含：任务编辑器、自动排期、甘特依赖编辑、第二套任务数据库、原样 Spec Kit CLI/分支命令、自动生成 docs、观测或评估页面实现、自动运行评估或自动推进阶段。观测从项目开发开放由 F014 负责；评估从验证评估开放由 F015 负责。

## 文档合同

### 核心文档

| 产物 | 固定路径 | 作用 |
|---|---|---|
| 项目 PRD | `docs/PRD.md` | 冻结产品目标、范围、需求与验收 |
| 产品总规格 | `docs/specs/product-spec.md` | 冻结跨 Feature 对象、状态、不变量与共享行为 |
| Feature Map | `docs/specs/feature-map.md` | 列出 Feature、依赖、优先级与真实状态 |

### 逐 Feature 文档

只识别 `docs/specs/FNNN-slug/`，其中 `FNNN` 是三位数字且目录内按需存在：

- `spec.md`：用户可观察行为、边界和 Feature 验收。
- `plan.md`：影响范围、实施顺序、依赖、风险、回退与验证。
- `tasks.md`：可执行任务和完成证据；`- [x]` 只在证据存在时使用。

文档 frontmatter 可声明 `document`、`feature`、`status`、`title`、`planned_start`、`planned_end`、`milestone`、`updated`。日期未知时使用 `待确认`，不得虚构日期。任务完成数只按 `tasks.md` 的 Markdown checkbox 计算；无 `tasks.md` 时不显示百分比。

### 研发收口产物

| 产物 | 固定路径 | 用途 |
|---|---|---|
| 实施报告 | `fde-deliverables/03-project-development/implementation-report.md` | 记录已实现范围、关键变更、版本和未完成项 |
| 运行手册 | `fde-deliverables/03-project-development/runbook.md` | 记录安装、配置、启动、停止、健康检查、故障恢复和安全边界 |
| 研发基线 | `fde-deliverables/03-project-development/development-baseline.md` | 固定候选版本、测试/评估证据、已知风险与进入验证评估前的人工判断依据 |

## 用户旅程与状态

| 前置 | 用户动作 | 系统行为 | 可观察结果 | 下一步 |
|---|---|---|---|---|
| 项目处于 development | FDE 让 Agent 规划或实现功能 | Agent 按需加载 Skill，读取当前 docs 与源码证据，更新同一路径 | 右侧目录树立即可见文件；项目进度刷新后展示真实文档和任务 | 继续逐 Feature 开发 |
| docs 部分存在 | FDE 打开项目进度 | Host 扫描固定目录并解析 frontmatter/checkbox | 核心文档、Feature、任务、日期/里程碑、阻塞和读取错误真实可见 | 打开文档预览或回到项目交付修订 |
| 开发持续进行 | FDE 打开观测 | F014 从项目开发阶段提供真实运行汇总，本 Feature 不复制观测状态 | 可查看 Agent、工具、Token、耗时和错误 | 继续开发或形成收口产物 |
| 三份收口产物存在 | FDE 二次确认完成项目开发 | Host 复核文件、阶段和 expected revision | 单步进入 validation，项目进度与交付同步更新 | 开始验证评估阶段 |

## 不变量与边界

1. `docs/` 是研发进度唯一事实源；页面不保存独立任务状态。
2. Agent 只能按当前项目授权读写；扫描和预览不接受浏览器任意路径。
3. 同一 Feature 只维护同一目录，不创建 `final-v2`、`new` 等平行最终版。
4. 文档存在不等于完成；task checkbox 只表达有证据的执行结果。
5. 未知日期显示待确认，不推算甘特、完成百分比或承诺。
6. 阶段页签不由本 Feature 实现：F014 负责项目开发起可见的观测，F015 负责进入验证评估后可见的评估。
7. Agent、Skill、文件生成和任务勾选都不能调用阶段推进。

## 功能行为

1. 仅当项目处于项目开发时，模型请求获得短阶段约束；FDE 要求规划、拆分或实施功能时，Agent 才按需加载 `fde-project-development`。
2. Skill 要求先读取项目现有 PRD、产品总规格、Feature Map、对应 Feature 文档和源码证据，再在同一路径更新文档；不原样引入 Spec Kit 的分支、CLI 或平行规格目录。
3. Host 只扫描固定 `docs/` 根、合法 `FNNN-slug` 目录和三份研发收口文件，按真实 frontmatter 与 Markdown checkbox 形成快照；浏览器只能用 Host 返回的 ArtifactId 请求预览。
4. 项目进度按同一快照展示核心文档、Feature、任务证据、已声明日期/里程碑/阻塞和研发收口文件，不提供另一套任务编辑状态。
5. 三份收口文件齐备后仍需 FDE 二次确认；项目进入验证评估后才由 F015 开放评估，本 Feature 不提前注册评估入口。

## 异常与恢复

| 情况 | 用户可见状态 | 恢复 |
|---|---|---|
| 核心文档或 Feature 文件缺失 | 对应项显示缺失，Feature 不补造任务或日期 | 让 Agent 按规范补齐或人工维护同一路径文件 |
| frontmatter 不完整或任务无证据 | 日期显示待确认，任务只按真实 checkbox 统计 | 修正文档元数据或补充可核查证据后再勾选 |
| 文档路径非法、重复 Feature ID 或读取失败 | 快照列出真实问题，非法文件不进入预览白名单 | 调整到固定目录并刷新项目进度 |
| 收口产物不齐、阶段或 revision 已变化 | 完成按钮保持不可提交或 Host 返回真实缺口 | 补齐文件、刷新权威阶段后重新二次确认 |

## 验收标准

### AC-F020-001 · 开发规范可被 Agent 按需加载

- 来源：REQ-002, REQ-003, REQ-004, REQ-011, NFR-003, NFR-005, PSC-004, PSC-005, PSC-009, PSC-011, PSC-028
- 对应 PRD 验收：AC-004, AC-023
- Given 项目处于项目开发
- When FDE 请求规划、拆分或实施功能
- Then Agent 被要求加载 `fde-project-development`，按固定 docs 目录原位维护文档，未知日期保持待确认，任务无证据不勾选，不创建第二套任务状态或推进阶段

### AC-F020-002 · 项目进度只展示真实研发文档

- 来源：REQ-003, REQ-015, REQ-016, REQ-024, NFR-001, NFR-005, NFR-007, NFR-008, NFR-010, PSC-005, PSC-017, PSC-018, PSC-028
- 对应 PRD 验收：AC-014, AC-015, AC-023
- Given 项目 docs 中存在零到多个核心文档和 Feature 目录
- When FDE 打开项目进度的阶段产出
- Then 页面展示真实存在/缺失/读取失败状态、Feature 状态、任务完成数与已声明日期/里程碑，并支持安全预览；不存在的数据不补造

### AC-F020-003 · 项目开发只能由 FDE 推进

- 来源：REQ-012, REQ-024, NFR-003, NFR-004, NFR-005, NFR-008, PSC-002, PSC-006, PSC-007, PSC-009, PSC-011, PSC-028
- 对应 PRD 验收：AC-023
- Given 三份研发收口产物均存在
- When Agent 完成回复或 FDE 在项目进度二次确认
- Then Agent 行为不改变阶段；只有 FDE 提交且 Host 校验固定文件、当前阶段和 expected revision 成功时，项目才进入验证评估

## 开放问题

- 验证评估阶段的固定产物与进入部署试运行门在下一阶段单独冻结，本 Feature 不预设。
