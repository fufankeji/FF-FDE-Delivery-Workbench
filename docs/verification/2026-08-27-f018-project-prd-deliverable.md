---
document: verification
feature: F018
date: "2026-08-27"
status: passed
---

# F018 项目 PRD 第五固定产物验证

## 验证对象

- `fde-solution-design` Skill 将 `fde-deliverables/02-solution-design/project-prd.md` 列为第一份固定文档，并区分项目 PRD 的“做什么”与方案设计的“怎么做”。
- FDE Project Host 只通过固定 ArtifactId `project-prd` 解析、统计和提供同源只读预览地址。
- 项目进度把项目 PRD 纳入方案设计阶段产出和 0～5 计数；存在时可选择预览。
- `solution → development` 人工门在项目 PRD 缺失时拒绝推进；五份文档、已确认架构、当前阶段、expected revision 和 FDE 二次确认同时成立时仍只推进一次。
- 本次改动不在真实项目中预创建 `project-prd.md`，由用户随后通过项目对话让 Agent 生成。

## 自动验证

| 验证 | 结果 |
|---|---|
| PRD `--require-confirmed` 校验 | 通过：22 条功能需求、21 条验收标准；仅保留“功能需求超过 12 条”的既有范围提醒 |
| Product Spec `--require-confirmed` 校验 | 通过：27 条 PSC、无警告 |
| F005/F011/F013/F018 Feature Spec 校验 | 全部通过 |
| FDE Project、FDE Stage、UI FDE Project 聚焦测试 | 4 个测试文件、25 项测试通过 |
| `packages/fde/project` 与 `packages/fde/stage` TypeScript build | 通过 |
| `@deepseek-ai/dsh-client-ui-fde-project` Bundle | 通过 |
| 改动 TS/TSX 的 oxlint | 通过，无输出 |
| Agent Note 与两个 Package README 双语配对 | 三组均通过 |
| 上游工作树 `git diff --check` | 通过 |

## 运行验证

- 使用 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home` 重启官方 Web UI。
- `127.0.0.1:3080` 由 PID `77229` 监听。
- `http://127.0.0.1:3080/` 返回 HTTP 200。
- 对当前“数据分析项目”调用真实 `/api/fde-project/snapshot` 返回 `solution.requiredCount = 5`、`presentCount = 4`；第一项为 `project-prd` 且状态是 `missing`，原有四份文档仍为 `present`。这同时证明新合同已加载、旧产物未丢失，并且系统没有替用户预创建项目 PRD。
- 按协同开发约定未运行浏览器截图、录制或自动回放；页面生成与预览链路交由用户手动验证。
