# F016 工作台界面主题验证记录

## 验证范围

- 新增 `@deepseek-ai/dsh-client-ui-fde-appearance`，通过 `settings.section` 提供“界面主题”。
- 机械复用本地 Studio 的五张 1920×1080 WebP，连同无图片的官方原版形成六套稳定皮肤。
- 自定义 PNG/JPG/WebP 在浏览器内裁切、配色和保存，不进入 Host、项目、Session 或 Agent。
- 皮肤使用官方 ThemeRuntime 的可卸载 Token Override，与浅色、深色、跟随系统独立。
- 设置触发器仍属于侧栏，但设置弹窗 Portal 到 `document.body`，不再被皮肤侧栏的模糊包含块限制宽度。

## 真实证据

| 检查 | 结果 | 可观察证据 |
|---|---|---|
| PRD 校验 | 通过 | 20 项 REQ、10 项 NFR、19 项 AC，`status: confirmed` |
| Product Spec 校验 | 通过 | 23 项 PSC，新增 PSC-023 完整承接 REQ-021/NFR-011/AC-020 |
| F016 Feature 校验 | F016 内容无错误；全局状态检查被既有状态名拦截 | 校验器只报告 F010～F015 的 `implementation-ready-for-manual-review` 非标准状态；未修改这些既有合同 |
| F016 TypeScript | 通过 | `pnpm exec tsc -b packages/client/ui-fde-appearance --force` 退出 0 |
| F016 OxcLint | 通过 | `pnpm exec oxlint packages/client/ui-fde-appearance/src packages/client/ui-fde-appearance/tests --deny-warnings` 退出 0 |
| F016 聚焦测试 | 通过 | 3 个文件、8 项测试全部通过；覆盖默认/恢复、内置保存、官方原版、明暗独立、无效存储、配额失败与 Slot 卸载 |
| Client 依赖合同 | 通过 | 44 个 Client package 的依赖与模块请求规则通过 |
| 完整构建 | 通过 | Host/Client 全部构建，Vite Web dist 成功，记录 214 个 Client artifact |
| 文档同步 | 通过 | `pnpm run doc-sync` 28/28 通过；Agent Note、双语 README、config catalog 与 module graph 一致 |
| 3080 启动 | 通过 | 新进程 PID 78480 监听 `127.0.0.1:3080`，根页面 HTTP 200，Boot 清单包含 `@deepseek-ai/dsh-client-ui-fde-appearance` |
| 静态主题资源 | 通过 | 五个 `/fde-themes/*.webp` 均 HTTP 200，响应字节分别为 216534、47186、78502、72934、53856 |
| 设置弹窗回归测试 | 通过 | `settings-root.client.spec.tsx` 18/18 通过；新增断言确认 dialog 位于 `document.body` 且不属于侧栏渲染容器 |
| 设置包 TypeScript / Lint | 通过 | `tsc -b packages/client/ui-settings-general --force` 与定向 OxcLint 均退出 0 |
| 设置包与 Web 构建 | 通过 | `ui-settings-general` bundle 成功；Vite Web 336 modules 构建成功 |
| 修复后 3080 服务 | 通过 | PID 37171 监听 `127.0.0.1:3080`，根页面 HTTP 200 |

## 既有失败与未执行项

- `pnpm run test:gui` 共 4024 项：4020 通过、1 跳过、3 失败。失败位于既有 `ui-sidebar/tests/sidebar-styles.client.spec.ts` 两项和 `ui-theme/tests/scrollbar-styles.client.spec.ts` 对既有 `ui-fde-project/project.module.css` 的一项约束；F016 的 8 项测试全部通过，本轮不扩展修复无关样式债务。
- 按项目协同规则未运行浏览器回放、自动截图、视觉对比或完整 Web E2E。页面视觉、不同窗口宽度和用户自选图片效果交由用户在 3080 手动确认。
- 未调用模型、外部服务或任何计费能力。

## 资源来源与完整性

五张资源来源于用户明确指定的本地 Studio：`/Users/muyu/MuYuProjectBuild/DeepSeekHarnessDesktop/apps/web/public/dsh-desktop/`，目标为 `upstream/deepseek-harness/apps/web/public/fde-themes/`，总大小约 460 KiB。SHA-256：

- `default-background.webp`: `063f367ce2eaf57388ce71c319cfb1bbff8509663be1920a5baaeca34fb70a9f`
- `cloud-cat-background.webp`: `53f27b77f7994e7263be5f973fef16e64b61e6c3af3d9157c56a2ed58cd6dff7`
- `jiutian-deep-space-compute-observatory.webp`: `ed9ee16fddde961e397a8816f63b3d379ed34446d4d251063e9d78e21f39d454`
- `jiutian-quantum-glass-laboratory.webp`: `993531a63797231e3817e5bfe50de55125a2a9e90e12b8e6e56170363ff1dadf`
- `jiutian-dawn-compute-horizon.webp`: `894370b77d09a7016482760d1c196352d13ab64bb73e1d20c15833fa3b6e87f0`
