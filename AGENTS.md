# AGENTS.md

## 仓库定位

这是 `FF - FDE 交付工作台` 的私有完整交接仓库。任何修改都必须同时保护三类事实：工作台源码、`数据分析项目` 文件与数据、DeepSeek Harness 会话/阶段状态。

产品设计与使用流程见 `PRODUCT_GUIDE.md`，克隆、恢复和启动流程见 `README.md`。

## 目录事实源

- `app/deepseek-harness/`：工作台源码事实源。基于 DeepSeek Harness 官方提交 `e648f3ba1ecee83a88eebc4ff1aaf8a4a4264327`，包含尚未回到官方上游的 FDE 改动。
- `workspaces/ai-analysis/`：当前演示项目事实源。项目资料、`.fde/` 状态、六阶段产物、研发文档、前后端源码和业务数据库都在此目录。
- `handoff/dsh-home-template/`：可迁移的隔离 DSH 状态模板，保存会话、附件、Workspace 登记、Session 投影和 FDE 阶段状态。
- `.runtime/dsh-home/`：由恢复脚本生成的本机运行副本，不提交 Git，也不得反向覆盖模板。

## 安装与启动

```bash
./scripts/install.sh
./scripts/start.sh
```

等价的手动工作台命令为：

```bash
./scripts/pnpm.sh install --frozen-lockfile
./scripts/pnpm.sh run build
node scripts/restore-handoff-state.mjs
DSH_HOME=.runtime/dsh-home ./scripts/pnpm.sh dsh web --no-open --host 127.0.0.1 --port 3080
```

不得省略 `DSH_HOME`，否则会加载用户全局或其他项目的工作区。
不得绕过 `scripts/pnpm.sh` 直接使用电脑当前激活的 pnpm；该脚本以源码
`package.json` 声明的版本为准，避免不同 pnpm 版本阻断安装或启动。

## 会话与数据保护

- 不删除、截断、重写或重新生成 `handoff/dsh-home-template/sessions/` 中的历史会话，除非用户明确要求更新交接快照。
- 会话模板中的 `__FDE_WORKSPACE_PATH__`、`__FDE_APP_PATH__` 和目录名 `__FDE_PROJECT_BUCKET__` 是迁移占位符，不得改成某台电脑的绝对路径。
- 不提交 `.runtime/dsh-home/`；运行时产生的新会话若需要进入下一版交接包，应先停止服务、脱敏路径和凭证，再更新模板。
- 不删除 `workspaces/ai-analysis/fde-resources/`、`fde-deliverables/`、`.fde/`、`docs/` 或已跟踪的 `.runtime/northlight.sqlite3`。
- 私有仓库不等于允许提交秘密。禁止提交 `.credentials.yaml`、`.env`、API Key、访问令牌、Cookie 或个人匿名标识。
- 依赖、缓存、构建产物、日志、PID 和临时导出包均保持 Git 忽略。

## 开发与验证

- 保持改动最小，并沿用 `app/deepseek-harness/AGENTS.md` 与更深层 `AGENTS.md` 的源码约束。
- 数据分析项目的启动、测试与环境要求以 `workspaces/ai-analysis/AGENTS.md` 为准。
- 修改工作台后，只运行与改动直接相关的最窄检查；不默认做浏览器截图、全量 E2E 或录屏。
- 修改 Workspace、Session 或阶段状态时，至少验证恢复脚本能在临时目录中生成 3 个项目会话、9 份会话归档和正确的当前工作区路径。
- 发布前确认 `git status`、远端可见性为 Private、远端 SHA 与本地一致，并再次检查凭证文件未被跟踪。
