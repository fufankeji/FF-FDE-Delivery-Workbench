# F014/F015 阶段入口纠正验证

## 范围

- 纠正规则：`观测`从项目开发（`development`）开始可见；`评估`只在 FDE 完成项目开发并进入验证评估（`validation`）后可见。
- 保持项：系统架构仍从方案设计开始；API 文档仍需项目处于运行中且具有真实 OpenAPI 来源；进入后续阶段后保留已开放入口。
- 本记录取代 `2026-08-27-f020-project-development-docs.md` 中“开发阶段评估、验证阶段观测”的旧阶段可见性结论；该旧记录继续保留为当时的历史验证证据。

## 文档合同验证

| 检查 | 结果 |
|---|---|
| `validate_prd.py . --require-confirmed` | exit 0；PRD confirmed，24 个需求、10 个 NFR、23 个验收；仅有范围数量复核 warning |
| `validate_product_spec.py . --require-confirmed` | exit 0；Product Spec confirmed，29 个 PSC、34 个需求映射、23 个验收；无错误或警告 |
| `validate_feature_specs.py . --feature F014 --require-ready` | exit 0；F014 三件套与 Feature Map 追踪有效 |
| `validate_feature_specs.py . --feature F015 --require-ready` | exit 0；F015 三件套与 Feature Map 追踪有效 |
| `validate_feature_specs.py . --feature F020 --require-ready` | exit 0；F020 已移除不属于研发文档 Feature 的评估入口职责 |

## 实现验证

| 检查 | 结果 |
|---|---|
| `pnpm exec vitest run packages/client/ui-fde-project/tests/view-availability.client.spec.ts packages/client/ui-fde-project/tests/apply.client.spec.ts` | exit 0；2 个文件、5 项通过；development 为系统架构＋观测，validation 起增加评估；运行态 API 组合不改变该顺序 |
| `pnpm exec tsc -p packages/client/ui-fde-project/tsconfig.json --noEmit` | exit 0 |
| `pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | exit 0；最新 Client Bundle 已生成 |
| Agent Note 翻译配对 | exit 0；英文、中文与 `.i18n.yaml` 一致 |
| 隔离工作台重启后 `curl http://127.0.0.1:3080/` | HTTP 200；使用项目 `../../.runtime/dsh-home` |

## 人工验收边界

- 按协同开发约定，本轮未执行浏览器回放、自动截图或视觉对比。
- 用户刷新 3080 后，在当前项目开发阶段应看到“观测”且看不到“评估”；FDE 完成项目开发并进入验证评估后，两者应同时可见。
