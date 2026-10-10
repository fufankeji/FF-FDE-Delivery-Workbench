# OpenAPI 本地依赖与安装验证

日期：2026-10-10。范围：修复 `dsh-openapi` 固定 Git 依赖无法公开下载导致的源码部署阻断，保持 F012 的接口目录、Workspace 隔离和请求安全行为不变。

## 修复结果

`upstream/deepseek-harness/third-party/dsh-openapi/` 保存原锁定安装包的 8 个文件，共 42,676 字节：入口、两个运行模块、包描述、插件配置、两份原说明和 MIT 许可证。它们与原已安装副本逐字节一致，没有重写第三方实现。相邻 `dsh-openapi.source.json` 保存原版本、提交及逐文件 SHA-256。

Web Bundle 的运行依赖和 FDE Project 的开发依赖统一改为 `file:../../../third-party/dsh-openapi`。锁文件中的对应导入、包解析及两个 peer 上下文均改为本地目录；其余解析结果不变，原有未提交的 Skills 依赖条目保留。第三方目录未加入 pnpm workspace，不影响已有 Cordis vendoring 目录或构建集合。

源码包和 Git 提交必须包含上述目录；依赖安装仍需取得 `yaml` 等公共依赖，但不再要求访问原作者 GitHub 仓库，也不要求接收者提供该仓库的凭据。主环境没有重装，现有 `node_modules` 不作复制或清理。

## 验证结果

以下命令从 `upstream/deepseek-harness/` 执行。

| 检查 | 结果 |
| --- | --- |
| 原安装包与新增源文件的 SHA-256 比对 | 8 个文件完全一致，保留 MIT 许可证和原版权声明 |
| `corepack pnpm install --lockfile-only --frozen-lockfile --offline --ignore-scripts` | 退出 0，317 个 workspace 的冻结锁文件检查通过；未安装主工作区依赖 |
| `openapi-package.test.mjs` 中两个本地依赖/文件完整性测试 | 2 项通过；两个消费方、锁文件解析位置和源文件摘要一致 |
| `node --test --test-name-pattern='fresh dependency store' packages/fde/project/tests/openapi-package.test.mjs` | 退出 0；独立临时目录与空 pnpm store 安装成功，两消费方均解析到临时副本内的新安装包 |
| 同一安装测试中的真实模块检查 | YAML 解析、接口目录、接口描述和 loopback HTTP 调用通过；POST 限制与未授权私网请求拒绝通过 |
| `corepack pnpm exec vitest run packages/fde/project/tests/project.spec.ts -t 'indexes only the OpenAPI source inside the addressed project' --reporter=verbose` | 退出 0，1 项通过、22 项未选中；原 FDE 适配器仍隔离两个项目的 OpenAPI 目录 |
| `corepack pnpm exec tsc -b packages/fde/project` | 退出 0 |
| 两个文档对的 `verify-translation-pairing` 命名检查 | 包说明及原有 Agent Note 的中英文和配对记录一致 |
| 四份受影响 Harness 文档的相对链接检查 | 0 个无效链接 |
| 锁文件最小差异比对 | 仅 OpenAPI 解析条目变化；原有 Skills 条目保留，没有升级其他依赖 |
| `git diff --check` | 退出 0 |

安装测试从主锁文件抽取 OpenAPI 与 yaml 的固定记录，保留两个消费目录的实际相对路径；Host 的 Cordis peers 不在该小型安装探针中自动安装。测试使用空 store 和空 npm 用户/全局配置，不继承凭据变量，只从公共 npm 注册表下载 yaml。该证据覆盖本次依赖阻断，不等同于在全新机器完成整个工作台及所有原生依赖的安装。

首次尝试全量离线重新解析锁文件时，因本机没有无关的 `@stylistic/eslint-plugin` 元数据而停止，未写入锁文件。改为最小迁移现有 OpenAPI 解析条目，最终冻结检查和实际空 store 安装均通过。安装测试曾修正 yaml 的依赖域定位与 macOS `/var`、`/private/var` 路径归一化；临时目录在失败和成功时均由 finally 清理。

## 交付边界

未调用模型、未读取凭据库、未创建 worktree、未重启服务，也未更改项目运行数据。临时安装及测试目录均已清理；长期新增内容只有约 43 KB 的第三方运行源码、来源记录、测试和必要文档。未运行全量 E2E 或整仓构建。

本次发布包含 README 的 OpenAPI 安装说明、F012 技术计划、架构、包说明、原有 Agent Note 及本记录。此前未提交的 Skills 改动、完整部署手册草稿及其 README 入口继续留在本地，不混入本次提交；共享文档和锁文件仅暂存 OpenAPI 相关部分。
