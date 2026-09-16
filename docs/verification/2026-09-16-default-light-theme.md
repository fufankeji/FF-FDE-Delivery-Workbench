# 默认浅色启动验证

日期：2026-09-16。用户确认每次启动默认使用白色主题。先更新 Product Spec 的共享默认行为并通过校验，再修改主题实现。

## 范围

- `ui-theme` 的共享默认值从 `system` 改为 `light`，同时供 Host schema、首屏引导、主题运行时和设置面板初始状态使用。
- 无显式偏好时启动为浅色，不受操作系统深色模式影响；已保存的偏好及手动切换浅色、深色、跟随系统的能力不变。没有编辑用户设置文件，也没有在启动时强制写回偏好。
- 沿用当前 `feature/discovery-diagnosis` 工作树及 3083 隔离预览，不修改 3080 主运行区。

## 验证结果

| 检查 | 命令或入口 | 结果 |
|---|---|---|
| 产品规格 | `validate_prd.py . --require-confirmed`、`validate_product_spec.py . --require-confirmed` | 通过；PRD 原有需求数量提示保留 |
| 主题行为 | `corepack pnpm exec vitest run packages/client/ui-theme/tests/boot-theme.client.spec.ts packages/client/ui-theme/tests/host.client.spec.ts packages/client/ui-theme/tests/theme.client.spec.ts packages/client/ui-theme/tests/settings-store.client.spec.ts packages/client/ui-theme/tests/apply.client.spec.ts` | 5 个文件、47 项测试通过，覆盖暗色系统下默认浅色、设置初始状态、显式主题与持久化读取 |
| 构建 | `corepack pnpm run build` | 退出 0，登记 270 项客户端产物与 3 项公开构建环境值 |
| 包文档 | `corepack pnpm run verify-translation-pairing packages/client/ui-theme/README.md` | 1 组配对一致 |
| 在线预览 | 3083 认证后的首页与 Boot Manifest 实际主题包 | 均 HTTP 200；首页偏好为 `light`，在线包修订 `8cd8c099f7551456-8` 含浅色默认值与设置面板共用默认值，启动接续标记保留 |
| 运行隔离 | 监听进程 cwd、显式 `DSH_HOME` 与 Workspace 存储 | 当前工作树 Harness、`DSH_HOME=../../.runtime/dsh-home`、Workspace 列表为空；3080 未改动 |

构建日志为 `/tmp/fde-default-light-build.log`；仅供本次排错，不提交，可在不再需要时删除。未执行浏览器截图或自动视觉验收。上述验证完成时变更尚未提交、合并或推送；随后用户于同日授权与 Skills 更新一起合并并清理临时分支，合并状态以 Git 历史为准。
