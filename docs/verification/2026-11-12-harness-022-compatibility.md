# F030 · Harness 0.2.2-rc.2 升级验证

日期：2026-11-12。结论：兼容实现、完整构建、核心定向回归及本机桌面启动已完成，等待用户手动体验确认。没有执行真实计费模型调用、全量 Web E2E、自动截图、录屏或 GitHub 推送。采用 feature-spec-planning 先冻结 F030 三件套，后实施；没有改动 PRD/总 Spec 的业务范围。

## 代码基线与合并

- 唯一仓库：`FDEDeliveryWorkbench`，现有 main 工作树，没有新建 checkout/worktree。
- 旧官方：`687f282e8625c6b8d11ff58211a90524be2e4317` / `dsh-v0.2.1-rc.2`。
- 新官方：`ddac96760b6edf8fa0fe17cbdcf0b512f4c12b2c` / `dsh-v0.2.2-rc.2`。
- 原下游成果本地检查点：`53bb3e0dc83de6b10b83f6d4f392fc076d319f8e`，包括 F029 和桌面标题栏避让；升级改动仍留在工作树，未推送。
- 映射旧树：`59d979667d952371863250c2c0b6f7c00810c00e`；映射新树：`4bfeeb2183c623df9099acf86cd8e18905c17133`；三方结果：`f8c16699985c88f48ab34d78e4735f0089805195`。129 个交叠路径中有 61 个实际冲突文件，逐项裁决记录在 F030 Plan。最终合并标记检查无残留，`git diff --check` 退出 0。

## 安装、构建与直接行为

命令在 `upstream/deepseek-harness/` 执行；主机 Node 24.16.0，pnpm 11.28.5。日志在被忽略的 `.runtime/harness-022-upgrade/`，不随源码提交。

| 验证 | 实际结果 | 证据 |
|---|---|---|
| `corepack pnpm install --frozen-lockfile --offline --ignore-scripts` | 退出 0，锁文件已更新且无需重新解析；此前正常安装已运行必要生命周期脚本 | `install-final-frozen.log` |
| `corepack pnpm run build --serial` | 11/11 通过，含 native、FDE integrations、Host/Client 编译与聚合类型检查、Desktop/Host/Client Bundle、Web；记录 422 份 Client 产物 | `build-final-022.log` |
| F029 Host/Client、Stage/Skills、项目输出/运行、项目导航/工作台样式、WorkspaceBrowser/Rows、活动投影共 20 个定向文件 | 首轮 176 通过；实验室和 Semantica 3 项失败修复后通过；1 项真实 Python SDK 工具组合测试因未配置专用解释器跳过 | `focused-tests.log`、`compatibility-tests.log` |
| 上传入口、阶段页、会话壳、设置快捷入口、侧栏 DOM 快照 | 修复新版必需 hooks/props 后通过；快照仅更新已确认的无“全局新会话”入口及新版侧栏结构，没有运行浏览器截图 | `ui-merge-tests.log`、`ui-compatibility-tests.log`、`sidebar-snapshots.log`、`hero-final-test.log` |
| Markdown 文件链接 | 原 110 项通过；新增文档文件集合不得绕过到系统文件/应用协议的 1 项通过 | `file-links-tests.log`、`file-link-boundary-test.log` |
| 真实分发的 File Review Client factory | 2 项通过：先/后声明 Slot 均激活，产出文件与 v4 错误消息显示正确、打开审阅页、卸载回收 | `file-review-tests.log` |
| `node --test packages/fde/discovery-lab/tests/native-sessions.test.mjs` | 9/9 通过，保留准备失败、取消与独立辅助会话语义 | `native-lab-tests.log` |
| 中英文包说明及生成目录 | 6 个直接受影响的文档对一致；配置、工具与 Slot 目录按源码再生成 | `pairing-check.log`、`config-catalog.log`、`tool-catalog.log`、`client-catalog.log` |

失败定位没有通过关闭功能或放宽全局校验来处理：实验室 `tools.presentAs` 改为角色作用域内的原生执行器；会话视图 action 命名冲突分离；投影等待新注册 API；File Review 沿用已验证代码补丁并将精确兼容声明限定为 0.2.2-rc.2。`dsh-better-sidebar@0.31.1`、`dsh-observe@0.2.27`、本地 OpenAPI 和固定 Eval 均保留。

## 数据保护与读取

源为 `.runtime/harness-021-validation/`，副本为 `.runtime/harness-022-validation/`。只复制必要的非秘密项目、登记、阶段、Session、训练 SQLite 和挑战记录；不复制凭据、环境文件、浏览器身份或 profiles 依赖。

`prepare-validation.mjs` 记录 250 个文件、20,307,965 字节及其 hash/mtime；Session 只改副本首帧 cwd，后续压缩事件 frame 字节不变。`verify-history.mjs` 通过新版真实 JSONL 后端以 read 模式读取 11 个唯一 v4 Session，包括原 Workspace 的 3 个会话和 8 个实验室岗位会话；14 份代际文件全部保留，项目身份相同，训练库 `PRAGMA quick_check` 为 `ok`，中文挑战保留 1 条历史。实际桌面启动后再次核对原件摘要，250 个文件和 14 份代际文件均未改变。

该检查证明历史可读与原件不变，不代表历史记录中的业务指标重新通过验收。桌面正常启动产生的空白会话等新运行状态仅属于新版副本。

## 最小在线检查与桌面启动

Web 验证显式使用新版隔离 DSH_HOME 和 `127.0.0.1:3083`。匿名首页 401，授权后 200；挑战、实验室案例、Skills 和项目快照接口授权后 200，匿名及异源访问均 403。项目快照按实际合同使用只读 POST；首次验证脚本误用 GET 得到 405，修正脚本后通过，未修改服务合同。

从在线 Boot Manifest 验证版本为 `0.2.2-rc.2`；实际下载 Project、挑战、实验室、Better Sidebar、File Review 的在线 Bundle 并核对本轮行为。旧欢迎/凭据引导开关均为 false，未使用 `allow-version` 豁免。见 `web-verification.log`。

停止 3083 的 Web Host 后，使用以下参数启动真正的桌面开发载体，没有打开系统 Chrome：

```bash
DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-022-validation/dsh-home \
DSH_DESKTOP_USER_DATA_DIR=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/harness-022-validation/desktop-user-data \
DSH_DESKTOP_OPEN_DEVTOOLS=0 \
corepack pnpm start:desktop
```

本机网络下载还使用了进程级代理环境；代理地址不是学员部署前提。桌面运行时自检通过，Office 文档往返检查通过；载体记录版本 0.2.2-rc.2、工具 Node 24.21.0、Python 3.12.14、pnpm 11.28.5。实际 Electron 页面 Boot 版本为 0.2.2-rc.2，无“Failed to load plugins”；原门店项目、阶段 8/8、35 份资料及工作台导航文本可见。只读取启动状态，没有执行逐页自动化操作或视觉验收。

交付时 Electron PID 27540，内置 Host PID 27590，监听 `127.0.0.1:53826`；端口由桌面分配，重启会变化。3083 已停止。原运行区和其他桌面应用未被关闭或改写。

## 尚未通过或未执行的检查

- 上游 `ui-settings-general/tests/shell.client.spec.ts` 的全组合源码测试有 9 项未通过：测试运行器直接 ESM 导入 `dsh-better-sidebar/client`，不能加载 Web Bundle 中第三方分发 factory；这不是已修复项，不能声明整套 UI 测试全绿。设置快捷入口独立测试通过，真实桌面已加载相同插件组合。没有为让该测试通过而移除第三方功能或更改通用测试装配器。
- Better Sidebar 在本桌面启动日志提示 page-level transform 导致 geometry mismatch，并使用自身 degraded viewport sync；没有插件激活失败。右侧面板对齐、拖动、缩放由用户体验确认，本轮未擅自改主题布局。
- 未执行真实模型访谈、本体 Python SDK、真实 API/外部系统联调、Windows/Linux 新机部署、全量浏览器回放及完整人工视觉验收。未复制模型凭据；需要模型的功能由用户在平台内配置后使用。
- 原生桌面的完整点击旅程仍待用户确认，因此 T007 和 Feature Map 保持 in-progress，不将技术启动等同于最终产品验收。

## 运行产物与清理

- 新运行区 `.runtime/harness-022-validation/` 约 24 MiB，含数据和桌面用户状态；确认不再需要其中的新操作记录后才能清理。
- `.runtime/harness-022-upgrade/` 约 552 KiB，含合并清单、准备/验证脚本和日志；验收与回退窗口结束后可清理。启动授权参数已从日志脱敏。
- 复用现有 `upstream/deepseek-harness/node_modules`（约 2.9 GiB）与 `apps/desktop/.desktop-build`（约 707 MiB）；停止应用后可按锁文件和源码重建。没有生成新源码包、视频、额外 worktree 或依赖备份。
- 收尾时磁盘可用约 4.3 GiB。升级前代码检查点和旧数据保留；回退步骤见 [升级说明](../architecture/harness-022-upgrade.md)。
