# 交付清单（候选）

> 验收移交阶段产物（候选） ｜ 最终版本 `DS4-0.1.0-local-20260827`
> 说明：记录候选交付物。**企业已通过验收；交付物已导出，企业已接收（`available=true`）。** 本清单为如实记录，不虚构、不夸大。

## 1. 候选交付物清单

每项交付物对应一个单一、真实存在的项目相对文件路径（文件包位于 `fde-deliverables/06-acceptance-handover/packages/`）。

| id | 名称 | 位置（真实文件路径） | 版本 | 校验（SHA-256） | 可取得 |
|---|---|---|---|---|---|
| DEL-APP | DS4-AI 数据分析系统（应用运行包） | `fde-deliverables/06-acceptance-handover/packages/ds4-ai-0.1.0-app.zip` | 0.1.0 | `a6b610b2ed77c4408415fe996418ad39004166cc5ae8f51566b43809488f4c4c` | **true（企业已接收）** |
| DEL-SRC-PKG | DS4-AI 数据分析系统源码包 | `fde-deliverables/06-acceptance-handover/packages/ds4-ai-0.1.0-src.zip` | 0.1.0 | `94900e05fa1000c2bb36700ec5b3f3861564c608d656e92c9d62c688ea89f88b` | **true（企业已接收）** |
| DEL-DOCS | 项目文档集（PRD/规格/方案/验证/部署/验收移交） | `fde-deliverables/06-acceptance-handover/packages/ds4-ai-0.1.0-docs.zip` | 0.1.0 | `b7a0b1ceb046481e9e57b35ef59f047e2d81b6aed6e34a1b3e580747d274c6ae` | **true（企业已接收）** |
| DEL-EXPORT-SAMPLE | 导出备份样例（验证轮证据样例） | `fde-deliverables/06-acceptance-handover/packages/ds4-ai-0.1.0-export-sample.zip` | 0.1.0 | `06534882a50fa8e3ff89a29170825b09067647a3ab2bb2cd8691a0db37c34bea` | **true（企业已接收）** |

> 说明：四个文件包已生成于上述单一文件路径（均为真实文件）；企业通过验收并已接收，`available=true`。

## 2. 交付物状态与缺口

- 应用运行包（DEL-APP）：`ds4-ai-0.1.0-app.zip` 已生成（含 backend/frontend/scripts/sandbox/fixtures/配置与使用文档；不含已安装依赖与运行时数据）。
- 源码包（DEL-SRC-PKG）：`ds4-ai-0.1.0-src.zip` 已生成（完整源码）。
- 文档集（DEL-DOCS）：`ds4-ai-0.1.0-docs.zip` 已生成（`docs/` + `fde-deliverables/`，不含 packages 子目录）。
- 导出样例（DEL-EXPORT-SAMPLE）：`ds4-ai-0.1.0-export-sample.zip` 已生成（验证轮导出样例副本）。
- 说明：文件包已就位，但**未确认企业可取得**；部署试运行已 `ready`，正式交付/交接给企业仍未确认。

## 3. 需在移交前补全的交付动作

1. 确定正式部署目标与授权（含数据、凭证、网络边界）——已有部署试运行 `ready`；如需面向企业的独立部署，仍需授权与校验。
2. 核对交付包内容与源目录一致，并在交付时提供校验（SHA-256 已记录）。
3. 补齐验收证据（见 `acceptance-report.md`）与移交手续（见 `handover-record.md`）。

> 本清单为候选产物；文件齐备只表示可提交，不代表企业确认或项目移交完成。
