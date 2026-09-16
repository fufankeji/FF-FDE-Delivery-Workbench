# 首页深色系统下的对比度修复

日期：2026-09-16。范围：F011 的 AC-F011-018、T034。实现与定向验证完成，配色待用户手动确认；不宣称首页历史高保真任务 T032 完成。

## 原因与修复

3083 新隔离运行区没有显式主题偏好，首页实际嵌入 `system`，并保留 `data-dsh-theme-preference` 接续标记。此前局域网主题接续修复仍在；本次不是该逻辑丢失。首页后续定稿样式固定了浅色渐变背景，但旧的 `body[data-ds-dark-theme] .deliveryHomepage` 规则以更高优先级把文字变量改为浅色，导致背景和文字配对失效。

先更新 F011 的 spec、plan、tasks 并通过校验，再把该选择器收窄为 `.deliveryPreviewWindow`。首页沿用既有浅色画布与文字，右侧预览保留深色背景和文字的成组切换。布局、真实入口、项目数据、动效、全局默认主题及用户持久化设置均不变。包 README 仅同步这一配色约定。

## 验证

规格命令在工作树根执行，包命令在其 `upstream/deepseek-harness` 执行。

| 检查 | 命令或入口 | 结果 |
|---|---|---|
| F011 规格 | `validate_feature_specs.py . --feature F011 --require-ready` | 代码修改前通过，无错误或告警 |
| 主题回归 | `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/delivery-home-theme.client.spec.ts` | 旧选择器下 2 项失败；修复后 2 项通过 |
| 构建 | `corepack pnpm run build` | 退出 0，包含 Client bundle；登记 270 项客户端产物和 3 项公开构建环境值 |
| 包说明配对 | `corepack pnpm run verify-translation-pairing packages/client/ui-fde-project/README.md` | 同步并重新登记后，1 组配对一致 |
| 在线首页 | 认证后的 `http://127.0.0.1:3083/` | HTTP 200，主题偏好仍为 `system`，启动接续标记保留 |
| 实际客户端包 | 首页 Boot Manifest 中 `ui-fde-project` 的 URL，修订 `87e6fad264ba47f2-37` | HTTP 200；深色变量选择器为 `body[data-ds-dark-theme] .y9W83G_deliveryPreviewWindow`，浅色首页主文字为 `#111827` |
| 隔离运行区 | 3083 监听进程 cwd、显式 `DSH_HOME` 与 Workspace 存储 | cwd 位于本工作树 Harness；`DSH_HOME=../../.runtime/dsh-home`；Workspace 列表为空 |

启动沿用 `DSH_HOME=../../.runtime/dsh-home corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3083`。旧进程退出稍慢使首次重启遇到端口占用；旧进程退出后重试成功。3080 主服务未重启、未替换。

没有运行浏览器自动化、截图或像素验收，也没有改写主题配置来规避问题。初次验证使用 3083 页面，修改当时留在已有 `feature/discovery-diagnosis` 工作树，尚未提交、合并或推送；没有创建新工作树或持久运行目录。随后用户于同日授权合并并清理该临时分支，合并状态以 Git 历史为准。构建日志为 `/tmp/fde-home-theme-build.log`，无需提交，可在不再需要排错时删除。
