# 治理审查（阶段 3 / investigation）

> 状态说明：候选记录，供 FDE 审阅。本文件只记录**动作边界与治理/安全事实**，不设计方案、不授权外部动作。来源为仿真。每对象分别记录 read / suggest / draft / execute 状态，不相互推导。引用 `src_*` SourceId。尚无真实治理/法务批准证据，一律标 pending/unverified。

## 一、动作边界表（每对象 read/suggest/draft/execute 分别记录）

依据 `01-systems-access-and-ownership.md`（`src_4ff1…`）、`04-access-request-register.json`（`src_6e5c…`）、`10-role-and-boundary-confirmation.md`（SIM-0210，`src_99c9…`）。

| 对象 | read | suggest | draft | execute | 依据 |
|---|---|---|---|---|---|
| WorkOrder Pro 历史工单导出 | allowed（当前调查） | n/a | n/a | denied | AR-301 `src_6e5c…` |
| WorkOrder Pro Sandbox 草稿写 | allowed(仿真读) | allowed | pending（8–12 工作日） | denied | AR-305 |
| WorkOrder Pro 正式派单 | not-applicable | not-applicable | not-applicable | denied/not_requested | AR-306 |
| AssetBook 快照 | allowed | n/a | n/a | denied | AR-302 |
| ContractHub 仿真摘要 | allowed（schema 发现） | allowed（候选） | n/a | denied（不可作覆盖/费用决定） | AR-303；`src_4ff1…` |
| StoreNet Monitor | pending | n/a | n/a | denied（Agent 不改网络配置） | AR-304；`src_4ff1…` |
| 企业消息平台 | denied（deferred） | denied | denied | denied | AR-307 |
| 工单草稿（建议输出） | — | allowed（草稿+人工确认） | conditional（沙盒写未批） | denied | SIM-0210 边界 |
| P0 应急路径 | — | suggest 只提示 | 不自动 | **人工执行（不自动派单/不延迟）** | SIM-0210；policy `src_fee3…` |

> 现状边界：本阶段所有对象 execute=denied/not_requested；draft 仅 WorkOrder Sandbox 为 conditional（写权限 pending）。**没有任何对象被批准 execute（正式派单）**。

## 二、安全/隐私/治理事实

- 请求须绑定当前操作人、区域与项目；跨区域查询默认拒绝（`src_4ff1…`）。
- 企业消息平台真实群含员工姓名与可能顾客信息，无 API/数据使用批准（`src_4ff1…`/AR-307）；只允许人工上传脱敏文本。
- 凭据：访问登记明确“不含账号、令牌、Cookie 或任何真实凭据”（`src_6e5c…`）。
- 草稿写权限（AR-305）pending，需林哲＋信息安全；正式派单（AR-306）需设备运维、信息安全、区域运营共同，未申请。

## 三、分域治理复核（一个领域意见不替代另一领域批准）

来源：`04-access-request-register.json`（`src_6e5c…`）、`01-systems-access-and-ownership.md`（`src_4ff1…`）、`10-role-and-boundary-confirmation.md`（SIM-0210，`src_99c9…`）、`05-cost-assumptions.yaml`（`src_5583…`）、policy（`src_fee3…`）。**每个领域单独批准，不得用一个领域意见替代另一个领域。**

| 域 | 评审范围 | 状态 | 条件/owner | 未决项 |
|---|---|---|---|---|
| 信息安全 | WorkOrder 草稿写（AR-305）权限 | pending | 信息安全团队；需林哲共同 | 草稿写是否获批；StoreNet 读取边界 |
| 隐私 | 企业消息平台数据（含员工/顾客信息） | pending/deferred | 数字化运营部＋法务 | API/数据使用批准（AR-307）Pilot 后再评估 |
| 法务 | 企业消息平台、合同正文权威性 | pending | 法务 | 群数据合规；ContractHub 正文为准 |
| 采购 | ContractHub 合同覆盖与费用审批 | 部分 | 采购运营负责人沈悦 | 仅 6 份仿真摘要；权威版本/有效期未核（AR-303） |
| 财务 | 成本标准 120/260 | unconfirmed | 财务 | 未批准，仅候选情景（`src_5583…`） |
| 区域运营 | P0 应急、门店影响、停止/收窄 | confirmed（仿真） | 区域运营负责人贺敏 | 停止权边界已定；真实生产口径未核 |
| 设备运维 | 工单数据口径、草稿写、去重 | confirmed（仿真，责任） | 设备运维经理林哲 | Sandbox 写实际结果；API 版本升级 |

> 领域间互不替代：采购认可 6 份摘要 ≠ 信息安全批准草稿写 ≠ 财务批准成本 ≠ 法务批准群数据。各域未决项见上表与下节。

## 四、材料声明 vs 实际观察冲突（并列保留）

- **声明**：WorkOrder Sandbox 草稿写已获批用于仿真（AR-305 auth/read=approved）；**观察**：其 `action_state=pending`、expected 8–12 工作日，实际写权限未获批 → 并列保留，草稿写视为 conditional/pending。
- **声明**：企业消息平台“报修入口之一”；**观察**：无 API/数据批准（AR-307 deferred）→ 并列保留，首期仅人工上传文本。
- **声明**：StoreNet Monitor “可读在线状态/告警”（`src_4ff1…` 系统清单）；**观察**：AR-304 pending，尚未获批读取 → 并列保留，告警读取待通。

## 五、待核对（unverified）

- StoreNet 告警读取、Sandbox 草稿写实际结果、企业消息平台治理决定——均需真实批准/负责人确认后更新。

## 六、当前可安全执行 vs 禁止（按南京主线与接口证据核对）

来源 `08-workorder-api-openapi.yaml`（`src_8794…`）、`09-sandbox-readback-log.txt`（`src_5053…`）、`01-systems-access-and-ownership.md`（`src_4ff1…`）、`04-access-request-register.json`（`src_6e5c…`）。

**当前可安全读取（read allowed）**
- WorkOrder 历史工单脱敏导出（AR-301）、AssetBook 快照（AR-302）、ContractHub 6 份仿真摘要（AR-303）。
- Sandbox 限定区域内只读 GET：getTicket/getAsset/listVendors（`src_5053…` 江苏区域 GET 200；浙江 403 区域边界生效）。
- 企业消息脱敏导出样本（只读分析，非 API）。

**可形成的候选（suggest/draft-候选，不写入）**
- 结构化补全建议、故障域候选、紧急等级候选、维修商候选、证据引用——这些是候选输出，形成于工作台内，不写外部系统。
- 草稿（仅当未来获批后）——见下节写动作要求。

**尚待批准的 Sandbox 草稿写（conditional/pending）**
- `POST /ticket-drafts`（createTicketDraft）：AR-305 未批，当前返回 403 `draft_write_permission_pending`（`src_5053…`）。8–12 工作日。

**明确禁止（denied / 当前不得执行）**
- 生产写入 / 正式派单（dispatchTicket，AR-306 not_requested）——日志记为 `[未执行]`，不以 403 探测替代（`src_5053…`）。
- 消息通知 / 企业消息平台读取（AR-307 deferred）。
- 跨区域读取（默认拒绝，region_scope_denied，`src_5053…`）。

## 七、获批写动作的必要要求（未来任何草稿写须满足；本次未执行）

依据 `src_8794…`/`src_5053…`/`src_60b7…`（字段字典，`src_fbbc…`）。**本次没有执行任何真实写动作**——日志明确 `POST /ticket-drafts` 返回 403 未创建对象，`dispatch` 记 `[未执行]`。

1. **operation_id**：每次写动作须携带独立幂等标识（写请求必填，见 openapi；字段字典 `src_fbbc…`）。
2. **幂等**：`Idempotency-Key` 头必填；若 operation_id/Idempotency-Key 已存在返回 409（`src_8794…`）。写超时不得重复创建，标 unknown 后按 operation_id 读回（SIM-0109 政策口径）。
3. **审计**：记录项目、区域、当前用户、SourceId、operation_id、规则/合同版本、建议、人工决定与读回（SIM-0109 `src_fee3…`）。
4. **失败处置**：403=权限不足（非执行成功）；409=幂等冲突；必须保留原始响应与身份，不臆造成功。
5. **人工接管**：写动作须人工确认后提交；P0/权限拒绝/冲突/工具 unknown/跨区域请求须有明确人工接管路径。
6. **权威系统独立读回**：创建成功后必须再调用 `GET` 独立读回核对（201 后须 GET，`src_8794…`/policy），不以本地假设替代。
