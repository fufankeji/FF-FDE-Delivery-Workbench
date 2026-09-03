# 官方 DeepSeek Harness Web 基线验证

## 验证范围

- 目标：固定官方源码版本，完成官方依赖安装、完整构建和未经 FDE 修改的 Web UI 启动。
- 日期：2026-08-26。
- 官方仓库：`https://github.com/deepseek-ai/deepseek-harness.git`。
- 本地 checkout：`upstream/deepseek-harness/`。
- 锁文件：`upstream/deepseek-harness.lock.json`。
- 本地开发分支：`fde-workbench`。

## 锁定版本

```text
commit: b150a551b8d465e31e418e1b2eaf5e79bbb7d28e
release: 0.1.1-rc.2
commit date: 2026-08-21T20:03:37+08:00
commit subject: Merge pull request #2908 from deepseek-harness/release/dsh-0.1.1-rc.2
```

验证时 `git status --short --branch` 只输出 `## fde-workbench`，官方源码工作树干净。

## 环境

```text
Node.js: v24.16.0
repository package manager: pnpm@11.7.0
host: macOS arm64
```

项目通过 `corepack pnpm` 使用仓库声明的 pnpm 版本，没有使用系统 `pnpm@11.24.0` 改写锁文件。

## 安装

执行：

```bash
corepack pnpm install --frozen-lockfile
```

结果：退出状态 `0`。锁文件供应链策略检查通过，共检查 1215 个条目。安装阶段对首次 build 尚未生成的示例 CLI bin 报告软链接警告，安装仍成功完成。

## 构建

执行：

```bash
corepack pnpm run build
```

结果：退出状态 `0`。Host 和 Client packages 构建完成；Vite Web 构建完成；构建记录 200 个 Client artifacts。Vite 报告部分 chunk 超过 500kB，这是性能提示，不是构建失败。

## 启动

为避免读取或污染用户的全局 `~/.dsh`，本次使用项目专属运行目录：

```text
/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home
```

执行：

```bash
env \
  DSH_HOME='/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home' \
  NO_PROXY='127.0.0.1,localhost' \
  no_proxy='127.0.0.1,localhost' \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

可观察输出：

```text
dsh web: http://127.0.0.1:3080
```

HTTP 验证：

```text
GET /: 200
response bytes: 14522
document title: DSH Local Build
listener: 127.0.0.1:3080
```

## 页面基线

- 首次打开显示 `Internal Testing Notice`。
- 继续后显示官方 DeepSeek API Key 引导，可选择 `Configure later`。
- 页面显示官方 `DSH Local Build`、提交短 SHA `b150a55`、New Session、Workspaces、Settings 和空白 Session Hero。
- 临时 Playwright 页面检查没有浏览器控制台错误。
- 本轮没有输入、读取、验证或保存任何模型凭据，没有调用模型服务。
- Codex 内置 Browser 当前没有可用实例；页面视觉验证使用官方源码自带的项目级 Playwright，用户可直接在自己的浏览器打开本地 URL。

## 持久开发状态

```text
official checkout total: approximately 1.5GB
node_modules: approximately 1.3GB
apps/web/dist: approximately 11MB
isolated DSH_HOME after startup: approximately 20KB
```

- `upstream/deepseek-harness/` 是锁定的官方开发基座，可由 lock 文件重新拉取。
- `node_modules` 与构建输出可以通过锁定源码和官方命令重新生成。
- `.runtime/dsh-home` 是本次官方 Web 的隔离运行状态；停止服务且不再需要本次会话/设置后可以清理。
- 项目根 `.gitignore` 已排除整个官方 checkout 和 `.runtime/`，避免误提交第三方源码、依赖和运行数据。

## 尚未验证

- 未配置模型，未执行 Agent Turn。
- 未选择或创建 Workspace。
- 未安装 FDE Plugin。
- 未验证 Sidebar、Details、Conversation View 扩展。
- 未验证 FDE Event、Projection、普通文件来源、代码视图、Evals、部署或交付能力。
