# F033 · 默认安装体验验证

状态：源码配置、定向测试、完整构建和全新配置启动验证已完成；原磁盘阻塞已解除，待用户人工体验。未推送 GitHub、重打源码包、重启现有桌面或调用模型。

## 获准清理后的续做结果

用户明确允许清理旧归档或缓存。盘点时系统已自行把可用空间从约 100 MiB 回升到 8.9 GiB，交换空间占用同步下降；这部分不是本次删除产生的释放量。实际清理约 1.9 GiB：

- 使用 `npm cache clean --force --cache /Users/muyu/.npm` 清理约 1.7 GiB 下载缓存；`.npm` 从约 1.9 GiB 降至 243 MiB，保留已有安装依赖与配置。
- 删除 `/Users/muyu/Library/Caches/electron/e2ab7f5c7b75e539aecedcad672559729d23bea062f0b954d4ba249cabac1162/electron-v40.10.6-darwin-arm64.zip`（约 109 MiB）和 `/Users/muyu/Library/Caches/electron/88abc675d4aba0cab2a3b2c856dc7cf16b7bdded430b75fcceb56e80c3f7d91d/electron-v43.5.0-darwin-arm64.zip`（约 118 MiB）。仅删除下载压缩包，没有删除当前 Electron 程序或 v44.7.0 缓存。
- 上述文件直接删除，未放入废纸篓，可从包源重新下载。所有源码、Git 数据、运行 home、会话、录屏、项目依赖树和桌面最新源码 ZIP 保留；没有删除 worktree。清理及构建后可用空间约 11 GiB。

随后完成：

- 四对 README 配对记录更新及校验通过：ui-fde-appearance、official-bundles、apps/cli、apps/desktop。
- `GIT_OPTIONAL_LOCKS=0 NODE_OPTIONS=--max-old-space-size=2048 corepack pnpm run build --serial`：11/11 通过，91.36 秒，登记 422 份 Client 产物；日志 `.runtime/f033-build-final.log`。
- 使用 `mkdtemp` 创建一次性 `fde-f033-startup-*` home，从源码运行 `corepack pnpm dsh web --no-open --host 127.0.0.1 --port 0`，显式传入该 DSH_HOME。使用启动授权建立本机身份；首页 HTTP 200，Boot Manifest 中 dsh-context 只有一条，实际 Client Bundle HTTP 200，`POST /api/dsh-context/overview` 的只读 summary 请求返回 HTTP 200 且 `ok=true`，新 profile 默认组合包含 dsh-context。未发送模型请求，授权值未输出或保存到报告。
- 验证结束停止该测试进程组并删除一次性 home，无新增常驻服务、运行副本或浏览器。未以本机已有插件安装替代全新配置验证。
- 全库默认隔离检查已不再报外部默认包缺失/组合不完整；仍报告 tool-terminal 的既有实验性分类和 host-apiproxy 两个 schema 引用问题，见 `.runtime/f033-default-isolation-final.log`。本轮不改动这些既有模块，不宣称该全局检查全绿。
- `git diff --check` 通过；依赖锁文件仍只新增 42 行，没有升级其他依赖。

技术验证完成不等于人工视觉验收。默认官方原版的无图片/无 Token、重置及已保存偏好保留由外观测试覆盖；实际桌面的皮肤与洞察体验留给用户确认。

## 已实施

- 默认皮肤改为 official，恢复默认和中英文提示同步；已有合法皮肤偏好不迁移。
- CLI 精确依赖 dsh-context 0.83.1，锁文件仅增加 42 行；默认 Web 模板启用一次，桌面复用。现有配置、禁用 patch 和已移除的插件选择保留。
- 桌面故障恢复仍停用第三方洞察；默认产品检查支持 CLI 中精确声明的外部默认包，工作区和实验性包检查仍保留。
- PRD、总 Spec、F033 结构校验通过；README 文本与最终配对记录均已同步。

## 检查证据

- `pnpm install --lockfile-only --no-frozen-lockfile --ignore-scripts` 及 `pnpm install --frozen-lockfile --ignore-scripts` 成功，只增加 3 个依赖条目；没有新建依赖树副本。
- 首轮 9 文件：325 项通过、4 项失败、1 项跳过。外观、真实新 profile、默认模板与桌面恢复均通过。日志 `.runtime/f033-focused-tests.log`。
- 3 项失败来自新检查器遗漏无 scope 包名，修复解析后该文件 243 项全部通过；日志 `.runtime/f033-isolation-tests.log`。
- 1 项旧 profile 测试在并行测试时超过 5 秒；未改测试或超时配置，仅重跑该失败项，51 毫秒通过。日志 `.runtime/f033-profile-recheck.log`。
- 全库默认隔离检查还报告既有 tool-terminal 实验性分类及 host-apiproxy schema 引用问题，不属于本次默认配置，未扩展修复；不能宣称全库检查全绿。

## 原磁盘阻塞记录（已解除）

完整构建首次在 git index.lock 写入遇到 ENOSPC；串行重试仍在 tsx IPC 管道创建时报 ENOSPC，未进入 Host/Client 编译。README 配对记录更新也因 ENOSPC 无法写入。可用空间约 100 MiB，系统交换空间使用约 16 GiB；本轮测试临时 profile 已清理，可定位的项目测试缓存仅约 12 KiB，未删除其他工作或真实运行数据。

上述续做已完成，结果见本页首节。现有桌面未重启；新默认将在新配置或用户主动恢复默认时应用，不覆盖其已保存选择。
