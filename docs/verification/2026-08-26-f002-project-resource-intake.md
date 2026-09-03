# F002 项目资料持久化切片验证记录

日期：2026-08-26

## 验证范围

- 真实项目行存在独立“添加项目资料”Slot/action。
- 多文件批次以明确 WorkspaceId 保存到 `<workspace>/fde-resources/`。
- 同名不覆盖、符号链接目录拒绝、超限批次不发布部分文件。
- Client 只调用上传 route，不访问 Composer、Session 或 Agent。
- Web Bundle 组合 Host/Client 插件并可正常构建、启动。

项目资料列表、预览、解析、OCR、SourceId/事件、权限/版本和对话引用不在本次验证范围。

## 规格校验

| 命令 | 结果 |
|---|---|
| `validate_prd.py <project> --require-confirmed` | 退出 0；confirmed；13 REQ、8 NFR、12 AC；保留“功能需求超过 12 条”的已有范围复核 warning |
| `validate_product_spec.py <project> --require-confirmed` | 退出 0；confirmed；16 PSC；无错误/警告 |
| `validate_feature_specs.py <project> --feature F002 --require-ready` | 退出 0；F002 ready；无错误/警告 |

## 实现验证

| 命令 | 结果 |
|---|---|
| `pnpm exec vitest run packages/fde/source/tests/upload.spec.ts packages/client/ui-fde-sources/tests/project-resource-action.client.spec.tsx packages/client/ui-fde-sources/tests/apply.client.spec.ts packages/client/ui-workspace/tests/rows.client.spec.tsx packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx packages/client/ui-workspace/tests/apply.client.spec.ts` | 退出 0；6 个测试文件、91 项测试通过 |
| `pnpm run constraints` | 退出 0 |
| `pnpm run verify-client-packages` | 退出 0；41 个 Client packages 符合依赖与模块规则 |
| `pnpm run verify-cordis-config` | 退出 0；130 个配置文件通过 |
| `pnpm run verify-package-invariants` | 退出 0；229 个 package companion 通过 |
| `pnpm run verify-package-readme-model-experience` | 退出 0；229 个 package README 通过 |
| `pnpm run verify-package-readme-limitations` | 退出 0；229 个 package README 通过 |
| `pnpm run verify-translation-pairing` | 退出 0；1007 对文档一致 |
| `pnpm run verify-agent-note-format` | 退出 0；597 份 Agent Note 通过 |
| `pnpm run verify-package-paths` | 退出 0；4116 个文件引用路径通过 |
| `pnpm run build` | 退出 0；Host/Client libraries、FDE packages 与 Vite Web 完整构建成功 |
| `git diff --check` | 退出 0 |

`verify-export-jsdoc` 在本次新增导出修复后只剩两个与当前切片无关的 ignored 临时文件失败：`packages/client/ui-primitives/src/oxlint-contract-82e287e0-7919-4d6d-8b20-3c1ba12c06c7.ts` 与 `packages/fs/fs-observation-policy/src/oxlint-contract-82e287e0-7919-4d6d-8b20-3c1ba12c06c7.ts`。两者均早于本次开发存在且不在 Git 状态中，本次未删除或修改。

`verify-client-domain-graph` 报告当前工作树已有的 27 项 runtime/ui-conversation/ui-workspace 分层违规；新增 `ui-fde-sources` 没有出现在违规列表。本次按范围不处理这些既有架构债务。

## 运行验证

- 使用隔离 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home` 重启官方 Web。
- 当前运行地址：`http://127.0.0.1:3080`。
- `GET /` 返回 HTTP 200。
- `GET /api/fde-project-resources/upload` 返回 HTTP 405 和稳定 `method-not-allowed` JSON，证明新 Host route 已挂载；真实 POST 写入行为由聚焦 route/storage 测试覆盖，未向用户已有项目写入测试文件。

## 待人工确认

1. 在真实项目行悬停，确认回形针动作 tooltip 为“添加项目资料”。
2. 选择一个或多个文件，确认顶部 Toast 显示保存数量。
3. 在该项目物理目录确认生成 `fde-resources/` 且文件内容完整。
4. 确认当前输入框文字和对话没有因上传发生变化。
