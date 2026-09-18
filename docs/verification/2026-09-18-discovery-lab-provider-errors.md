# 业务挖掘实验室 Provider 与错误回传修复

日期：2026-09-18。范围：[Issue #2](https://github.com/fufankeji/FF-FDE-Delivery-Workbench/issues/2)，属于 F024 / REQ-030～REQ-032 / PSC-026 的已有访谈与失败重试路径，不改变产品范围、项目模型选择器或训练数据结构。

## 修复结果

- 实验室访谈、证据核对与报告不再强制指定 `reasoningEffort: off`，由所选 Provider/模型的能力和默认配置决定；不是改成内部不支持的 `none`，也不保证关闭思考。
- 请求准备在 `user/message` 之前失败时，保留该请求首个新轮次的结构化错误和事件。发送前的 `fromSeq` 排除旧轮次；仍维持每 Session 从空闲状态接受唯一请求的约束。真正取消和未启动请求保持原处理。
- 原有训练回执逻辑直接持久保存真实错误；辅助任务也传出错误消息。已结束的历史请求不回填，回执结算前进程崩溃仍走既有中断恢复逻辑。
- 自定义网关的 `compat.supportsDeveloperRole` 与接口档位映射继续由具体 Provider/模型配置，不改官方 Agent Loop 或全局 LLM 适配器。包说明和原有 Agent Note 已同步。

## 实际验证

命令从 `upstream/deepseek-harness/` 执行，均为无真实密钥测试。

| 检查 | 结果 |
| --- | --- |
| 修复前运行新增与调整后的回归 | 4 项失败、7 项通过；复现不支持推理的模型访谈失败、准备错误丢失及辅助任务错误被覆盖 |
| `node --import tsx/esm --test packages/fde/discovery-lab/tests/native-sessions.test.mjs` | 退出 0，9 项通过；覆盖早期错误、取消、历史/后续轮次不串用、正常完成和辅助任务清理 |
| `corepack pnpm exec vitest run packages/fde/discovery-lab/tests/loader-composition.spec.ts --reporter=dot` | 退出 0，2 项通过；真实 Loader、Agent Loop、JSONL、SQLite 与 HTTP，仅模型为脚本化适配器 |
| `corepack pnpm exec tsc -b packages/fde/discovery-lab` | 退出 0 |
| `corepack pnpm exec tsdown --filter @deepseek-ai/dsh-fde-discovery-lab --log-level warn` | 退出 0；构建包已包含去除强制档位、早期错误保留和辅助错误传递 |
| 两个文档对的 `verify-translation-pairing --write` 与命名检查 | 包 README 与原有 Agent Note 对齐 |
| 定向 `scripts/run-oxlint.ts` | 退出 1，107 条均位于原有未修改行；新增/修改行 0 条。不声称全量 lint 通过，不清理无关旧问题 |
| `git diff --check` | 退出 0 |

Loader 回归额外验证了非推理模型没有被强制档位、推理模型使用自己的 `medium` 默认档位、错误前未提交用户消息且未产生证据、失败后可成功重试、重启后失败回执仍保留。临时目录由测试清理，未使用主运行区的训练数据库。

此前诊断已通过 `llm-pi-ai` 的 3 项定向模拟接口测试：声明的档位映射与未声明档位拒绝、`off` 的接口值传递、拒绝 `developer` 的网关使用 `system`。本次不修改该适配器，不重复相同检查。

## 本地运行与边界

只重启原有主工作树运行进程，继续显式使用根目录 `.runtime/dsh-home` 和 LAN 3080。重启后 PID 为 4368；本机与 `192.168.110.19:3080` 首页及实验室案例接口均返回 HTTP 200，案例数均为 5。Workspace 登记文件 SHA-256 在重启前后均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，没有迁移、清空或重建业务数据。

构建检查最初误以保留源码注释作为通过条件；打包器会移除注释。检查实际构建代码后确认三个修复均已包含，无需重复构建。没有前端源码改动，没有运行浏览器自动化或真实 DashScope/其他计费模型；真实网关参数接受情况和人工体验仍需对应环境验证。

发布预检只报告通用 Skill 的五项根 `docs/` 排除冲突。按本项目 `AGENTS.md` 的更具体要求，产品文档继续与源码同仓，不删除、不取消跟踪。此次只提交 Issue #2 相关文件，保留工作区中既有 Skills 与部署文档改动。
