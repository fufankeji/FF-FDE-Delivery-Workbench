# Issue #1：项目创建目录选择修复

## 范围与决定

修复默认 Web profile 的“新建项目无响应”，保持已有唯一项目表单、目录创建、Workspace 注册和元数据流程。Web 固定使用 browse 两端；Desktop 禁用继承的两端后再使用 native 配对，不恢复 auto，不绕过目录权限或改动项目数据。

缺少目录界面时，项目中心事件仍由 WorkspaceBrowser 接收，表单显示明确不可用原因并禁用创建、位置选择和导入。能力恢复后原草稿继续使用；侧栏自身不可用的添加入口仍隐藏。

本次单独提交 Issue 修复，不包含本地尚未提交的中文 Skills 标准化、部署手册、README 部署入口或旧构建记录。根目录 docs 按本仓 AGENTS 要求与源码同仓维护，不执行发布工具通用的 docs 排除规则。

## 变更

- web-app 默认补齐 ui-directory-picker-browse。
- Desktop 覆盖同时禁用继承的 browse Client，避免与 native Client 争用 single slot。
- 移除 web-agent-presets fixture 自行插入目录选择配对的补丁，避免掩盖默认配置遗漏。
- 保留项目创建事件监听，补齐能力缺失、禁止写入及恢复提示。
- 文档说明 Host/Client 必须配对，并提示升级后移除旧临时 insert，避免重复装配。

## 检查结果

从 upstream/deepseek-harness 执行：

| 检查 | 结果 |
|---|---|
| apps/cli/tests/profiles/web/tests/directory-picker.spec.ts | 1 项通过；全新隔离默认 profile 无用户补丁，Web 只有 browse 两端，Desktop 覆盖后只有 native 两端 |
| packages/client/ui-workspace/tests/workspace-browser.client.spec.tsx | 54 项通过；包括原有创建/导入、项目中心请求、缺少目录能力不写入、恢复保留草稿 |
| test:e2e apps/cli/tests/web-agent-presets.e2e.ts -t 'supplies both shipped presets' | 1 项通过、31 项未选择；真实 Loader 使用默认目录配对，未调用模型。无端口 fixture 中依赖 webServer 的六个条目按原设计保持 pending |
| tsc -b packages/client/ui-workspace/tsconfig.json | 通过 |
| ui-workspace、ui-directory-picker-browse 的 Client bundle | 通过 |
| 阅读器本轮 UI 文案检查 | WorkspaceBrowser 零硬编码文案违规 |
| 三对包 README 与 Issue 修复 Agent Note 配对 | 通过 |

共 56 项已选择检查通过。整文件 lint 仍报告 35 项既有问题；逐项对应行均与 HEAD 字节一致，本轮新增缩进问题已修正，没有修改无关旧代码，不能声称全仓 lint 通过。未运行全量构建、全量 E2E、浏览器自动点击或截图；未在 Linux 真机与 Electron UI 中重复执行流程，Desktop 验证为实际配置组合检查。

## 本地在线证据

服务 PID 92905，使用主仓显式 .runtime/dsh-home，继续运行 --lan --port 3080。本机、局域网首页与阶段 API 均为 200，Boot revision 为 f6e6090b77b5；启动清单中只有 @deepseek-ai/dsh-client-ui-directory-picker-browse 一套目录 Client。

- ui-workspace：revision dfc36b623113c979-34，166435 字节，SHA-256 01b97d884cae682bf85a5c14eb46de7c7e42e8e965cac352bce917a091ccd469。
- ui-directory-picker-browse：revision dfc36b623113c979-35，50078 字节，SHA-256 e15307c6fd9abfa72731cda871f339d1595dddcd9aa5bbb1f73da1cb75e83585。

在线包与本地可执行字节一致，仅正常服务端 source map 尾注不同；工作区包包含新能力提示。重启前后 Workspace 登记 SHA-256 均为 a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9，没有创建、删除或迁移用户项目。

测试临时 profile 在 finally 中清理。构建复用原 lib 目录，两包 JS 和 source map 合计约 544 KB，均不入 Git；停止本地预览后可重建清理，不得连带删除用户运行数据。

## 升级说明

若此前按 Issue 的临时方案在用户 profile 中 insert 了 ui-directory-picker-browse，更新源码后需要移除该重复 insert。默认组合已提供两端，不需要再加补丁。
