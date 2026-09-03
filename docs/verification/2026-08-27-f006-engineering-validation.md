# F006 验证评估与进入部署试运行验证记录

- 日期：2026-08-27
- 范围：F006 验证合同、`fde-validation` Skill、评估页、项目进度产物与 `validation → pilot` FDE 人工门
- 非范围：真实业务验收执行、浏览器截图、完整 E2E、部署试运行之后的阶段门

## 已验证结果

| 检查 | 结果 | 证据 |
|---|---|---|
| Host 验证合同与证据边界 | 通过 | 固定读取 `.fde/evaluations/validation.json`；证据和三份阶段产物必须 realpath 位于当前项目内；缺失、无效、未执行、失败、无接受理由的 WARN 和未关闭 high/critical 问题形成稳定阻塞；未满足的必需指标只有具备完整 FDE 人工接受才解除自身阻塞 |
| 验证 Skill 与提示 | 通过 | `fde-validation` 按需加载；不得编造输入、阈值、结果和证据；关键验证条件变化时要求把受影响结果重置为 `NOT_RUN`；无阶段推进能力 |
| 评估页 | 通过 | 保留既有 Trial 运行器，并展示候选版本、环境、输入、指标、阈值、结果、证据、问题与阻塞项 |
| 项目进度与人工门 | 通过 | 展示并预览 `validation-plan.md`、`validation-report.md`、`validation-baseline.md`；仅在 gateReady 且 FDE 二次确认后调用 revision 保护的单步阶段路由 |
| 数据分析样本 | 通过 | 候选版本和现有脱敏订单 CSV 已登记，8 项指标均保持 `NOT_RUN`；只生成验证计划，不生成虚假报告或基线；Host 扫描返回 11 个真实阻塞，`gateReady=false` |
| 聚焦自动测试 | 通过 | 6 个测试文件、39 项测试通过；覆盖合同解析、证据边界、Skill/Prompt、阶段 CAS、控制器、评估页和项目进度页 |
| 相关包类型检查 | 通过 | `packages/fde/project`、`packages/fde/stage`、`packages/client/ui-fde-project` TypeScript project build 退出 0 |
| 前端目标 Bundle | 通过 | `@deepseek-ai/dsh-client-ui-fde-project` 的 ESM 与 Client CJS Bundle 构建成功 |
| 文档机检 | 通过 | PRD confirmed：25 REQ、10 NFR、24 AC，仅保留范围数量复核 warning；Product Spec confirmed：30 PSC、无 warning；F005/F006 定向 Feature 校验均无 error/warning；四组双语配对一致 |
| 必需指标人工接受修复 | 通过 | Host 保留 NOT_RUN／FAIL、证据缺口、数值和说明，只写入 `manualAcceptance.reason/acceptedAt`；过期摘要、可选/已满足指标、重复决定和空理由拒绝；4 个测试文件 45 项聚焦测试、两包 TypeScript、完整 Build、四组双语配对、PRD/Product Spec/F005/F006 校验通过；`http://127.0.0.1:3080` 返回 200 |

## 手工验收入口

1. 项目进入“验证评估”阶段后打开“评估”，确认能够看到候选版本、环境、项目输入、验证指标、证据和阻塞项。
2. 在项目进度页查看同一份输入/输出状态，点击已存在的阶段文档可预览。
3. 未执行指标或缺少报告/基线时，“完成验证评估”保持不可提交并说明真实缺口。
4. 完成真实验证、补齐证据和三份文档后，由 FDE 进行两步确认；成功后只进入一次“部署试运行”。
5. 若某个必需指标本轮无法完成，在“指标与证据”的“FDE 决策”列点击“人工接受指标”，填写原因、适用范围或后续约定并确认；原结果仍显示待执行/未通过，但该项不再阻塞。全部其余阻塞处理完后，“完成验证评估”恢复可用。
