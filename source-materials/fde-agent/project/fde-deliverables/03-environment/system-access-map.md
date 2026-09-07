# 系统访问图（阶段 3 / investigation）

> 状态说明：候选记录，供 FDE 审阅。本文件记录**账号、访问与动作权限的事实**，不设计方案、不做连接假设。来源均为仿真（`evidence_kind: simulation`）。**文件存在/能登录/能读取 ≠ 已获准用于业务决定 ≠ 可写草稿 ≠ 有权正式派单**，各项单独记录，不相互推导。结论引用 `src_*` SourceId。

## 一、逐系统事实表（account / access / action，不得相互推导）

依据 `01-systems-access-and-ownership.md`（SRC-SIM-0301，`src_4ff1…`）与 `04-access-request-register.json`（SRC-SIM-0304，`src_6e5c…`）。

| 系统 | 是否存在 | 是否实际查看 | 认证状态 | 读取状态 | 获准用途 | 动作权限 | 环境 | 时效 | Owner | 批准证据 | 等待时间 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WorkOrder Pro 7（历史工单导出） | 是 | 是（脱敏导出在场） | approved | approved | 仅当前调查离线分析（AR-301 business_use=approved_for_current_investigation_only） | 未申请（AR-301 action=not_requested） | production-export | 到期 2026-09-30 | 林哲 | ACCESS-APPROVAL-301 | 已完成 |
| WorkOrder Pro 7（Sandbox 草稿写入） | 是 | 部分（接口验证未做） | approved(仿真) | approved(仿真) | 仿真使用（AR-305 business_use=approved_for_simulation） | 写草稿 pending（8–12 工作日） | sandbox | — | 林哲＋信息安全 | ACCESS-REQUEST-305 | 8–12 工作日 |
| WorkOrder Pro 7（正式派单 API） | 是 | 否 | not_requested | not_requested | not_approved（AR-306） | 禁止/未申请 | production | — | 设备运维、信息安全、区域运营共同 | 无（evidence_ref=null） | unknown |
| AssetBook | 是 | 是（快照在场） | approved | approved | 身份分析（AR-302 business_use=approved_for_identity_analysis） | 未申请 | snapshot-export | 到期 2026-09-30 | 许文 | ACCESS-APPROVAL-302 | 已完成 |
| ContractHub | 是 | 是（6 份仿真摘要） | approved | approved | schema 发现、非覆盖决定（AR-303 business_use=approved_for_schema_discovery_not_coverage_decision） | 未申请 | simulation-package | 到期 2026-09-20 | 沈悦 | ACCESS-APPROVAL-303 | 已完成 |
| StoreNet Monitor | 是 | 否 | pending | pending | pending（AR-304） | 未申请（Agent 不得改网络配置） | production-readonly | — | 罗峰 | ACCESS-REQUEST-304 | ~5 工作日 |
| 企业消息平台 | 是 | 否（仅脱敏样本） | deferred | deferred | not_approved（AR-307） | deferred | production | — | 数字化运营部＋法务 | SCOPE-DEFER-307 | Pilot 后再评估 |

> **不得相互推导**：例如 WorkOrder Sandbox 写草稿 pending（AR-305）≠ 正式派单可用；企业消息平台即使有样本也不等于已获 API 批准（AR-307 deferred）；ContractHub 有 6 份仿真摘要 ≠ 覆盖决定权。

## 二、认证/读取/获准用途/动作四态拆解示例（本表可作审计口径）

- WorkOrder Pro：认证 approved、读取 approved、用途=仅当前调查离线分析、动作=not_requested（不可派单）。来源 AR-301 `src_6e5c…`。
- 企业消息平台：认证 deferred、读取 deferred、用途=not_approved、动作=deferred。来源 AR-307。
- **能登录不等于能读取、能读取不等于可用于业务决定、可用于分析不等于可写草稿、可写草稿不等于有权正式派单**——以上四者分别记录。

## 三、已知失败与限制（SRC-SIM-0301）

- WorkOrder Pro API 文档比 Sandbox 实际版本新一个小版本（`src_4ff1…`）。
- AssetBook 4.6% 在用设备无唯一有效标签（`src_4ff1…`）。
- ContractHub 元数据不含全部费用审批规则，PDF 正文才是权威来源（`src_4ff1…`）。
- 供应商当日值班来自人工表格，不在 API 中（`src_4ff1…`）。
- 系统间无统一事件 ID：消息、设备、工单只能以门店、时间、设备候选与症状组合匹配（`src_4ff1…`）。

## 四、待核对（unverified，需访问或负责人确认）

- StoreNet Monitor 告警读取（AR-304 pending）尚未获批，无法核对真实网络告警边界。
- WorkOrder Sandbox 草稿写入（AR-305）pending，实际写权限未获批。
- 企业消息平台无 API/数据使用批准（AR-307 deferred）；当前只用人工上传脱敏文本。

## 五、WorkOrder 版本与接口观察（只读，未实时调用）

来源 `08-workorder-api-openapi.yaml`（SRC-SIM-0308，`src_8794…`）、`09-sandbox-readback-log.txt`（SRC-SIM-0309，`src_5053…`）、`10-system-version-difference.md`（SRC-SIM-0310，`src_bfd4…`）。

- 集成文档声明 7.4；案例 Sandbox 观察为 **7.3.1**；生产版本未确认。**文档存在≠已部署，Sandbox 成功≠生产可用**（`src_bfd4…`）。
- 说明：`09` 为**预置仿真观察记录，不是本机实时网络调用**；本次未调用任何真实接口，写动作 `POST /ticket-drafts` 返回 403、`dispatch` 记 `[未执行]`（`src_5053…`）。
- 版本差异处置：`evidence_refs` 字段按可选处理（设计前向 owner 核对）；草稿写记权限待批（AR-305）；江苏区域可读、浙江 403 维持最小区域权限（`src_bfd4…`）。
- 待 owner 回答项见 `src_bfd4…`：Sandbox 何时升 7.4、operation_id 去重时窗/冲突/审计、生产版本/读回延迟/区域授权、合同与值班权威来源。
