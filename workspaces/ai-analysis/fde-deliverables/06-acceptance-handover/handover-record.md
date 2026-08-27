# 移交记录（候选）

> 验收移交阶段产物（候选） ｜ 最终版本 `DS4-0.1.0-local-20260827`
> 状态：**移交已完成**。企业通过验收；交付物已导出、企业已接收；`trainingCompleted=true`、`accessResponsibilityTransferred=true`、`operationsResponsibilityTransferred=true`（由 FDE 代录确认）。

## 1. 移交总览（如实）

| 项 | 状态 |
|---|---|
| 最终版本 | `DS4-0.1.0-local-20260827` |
| 部署试运行基线 | `fde-deliverables/05-deployment-trial/deployment-baseline.md`（候选；`status=ready`，FDE 已授权、问题已接受） |
| 企业验收状态 | `accepted`（企业通过验收，FDE 代录确认） |
| 培训完成 | **是**（`trainingCompleted=true`） |
| 访问权限责任移交 | **是**（`accessResponsibilityTransferred=true`） |
| 运维责任移交 | **是**（`operationsResponsibilityTransferred=true`） |

结论：**企业通过验收、交付物已导出并接收，移交完成**；记录由 FDE 代录确认。

## 2. 培训（未完成）

- 未安排/记录培训。原可用性验收设想 3 名分析师独立完成一次分析，未执行。
- 待办：整理《使用手册》+ 现场/远程培训 + 签到/记录；覆盖 数据接入、查询、画像、图表、模型、报告、运维。

## 3. 权限与访问责任移交（未完成）

- 正式多用户/鉴权不在一期范围（单机试点）。当前为本地单机；账号/权限模型未定义。
- 待办：明确用户清单与角色、访问方式（本地/局域网）、账号（当前无）、密钥交接，并登记责任人。

## 4. 运维责任移交（未完成）

- 运维主体与职责未确定；回滚/备份/监控责任方未定。
- 待办：明确 IT 运维责任人、备份策略（位置/周期/时长）、故障处置与回滚演练、联系人。

## 5. 待关闭的移交条件（状态见 `.fde/acceptance-handover.json` conditions）

| id | 条件 | 状态 |
|---|---|---|
| AC-CUSTOMER-SIGNOFF | 企业验收结论确认（接受/有条件接受/退回/终止） | open |
| AC-CUST-OBJ | 客户验收问题与指标口径（10 个验收问题对账） | resolved（FDE 已接受 decisionReason=1） |
| AC-PERF | 性能验收（设备/百万行/查询集/阈值） | resolved（FDE 已接受） |
| AC-MODEL | 复购模型验收（窗口/阈值/业务代价） | resolved（FDE 已接受） |
| AC-AGENT | Agent 可追溯性与模型外发子条件复核 | resolved（FDE 已接受） |
| AC-REPORT-FMT | 报告导出 PDF/Word 是否必做 | open |
| AC-TRIAL | 试运行记录（3 名分析师 + 回滚演练） | resolved（FDE 在部署阶段接受） |

## 6. 需 FDE/企业确认后填写的记录

- FDE 代录企业验收结论（接受 / 有条件接受 / 退回 / 终止），并写入 `acceptance` 状态与 evidence。
- 移交签章/签字、日期、交接人；培训、权限、运维责任确认；条件项接受理由与后续跟进（conditionally-accepted 时的 reason/owner/followUp）。

> 本记录为候选产物；文件齐备只表示可提交，不代表移交完成。项目不能被本记录完成。
