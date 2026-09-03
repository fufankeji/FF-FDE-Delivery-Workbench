# V2 功能回迁主分支验证记录

## 目标

把独立开发仓库 `FF-FDE-Delivery-Workbench` 中已经完成和仍在开发的 V2 功能统一迁回 `FDEDeliveryWorkbench` 的目标源码仓库 `main`，并停止从旧开发现场继续运行或开发。

## 迁移基线

- 源功能快照：`e3709da86d4ddb9bb3943ef3dbf6d576a113efa7`
- 源迁移台账快照：`b5d7afd9284145fc30fc89a5e0b4084070e0b8d2`
- 目标迁移前基线：`b8ef09f6557c5e6b30aad0f64774cbee9c5bc50d`
- 目标最终提交：`1dfaddaacc6e33d7cd43a3d91bbbe210b58e8729`

## 迁移范围

- `FF-FDE-Delivery-Workbench/app/deepseek-harness/` 映射到 `FDEDeliveryWorkbench/upstream/deepseek-harness/`。
- 105 个源差异路径完成逐项核对，其中复制 88 个最终文件，删除 18 个源端已移除路径；最终映射文件与源快照内容一致。
- 44 个项目级 `docs/` 差异迁入目标文档目录，并与目标已有的 llm-wiki 移除决定对账。
- `.runtime/`、`workspaces/`、`handoff/dsh-home-template/`、依赖、构建产物、测试输出和临时检查脚本没有迁入。

## 验证结果

- 文档链：PRD、Product Spec、12 个 Feature Spec 校验通过。
- 测试：受影响矩阵共 15 个测试文件、114 项逻辑结果通过；修正后直接复跑的 3 个重点文件共 53 项全部通过。
- 静态检查：暂存文件 lint、工具目录校验、第三方声明校验和翻译配对校验通过。
- 构建：`pnpm run typecheck`、`pnpm run build:lib:client`、`pnpm run build:web` 通过；合入主分支后 `pnpm run build` 通过。
- Git：迁移提交已 fast-forward 到目标 `main`，目标工作区干净；临时 migration worktree 已移除，目标仓库只剩主工作树。
- 运行：3080 返回 HTTP 200；监听进程工作目录为 `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/upstream/deepseek-harness`。
- 在线产物：Client bundle 包含 `data-fde-stage-workbench`、`resolveEnteredProject` 和“当前优先事项”，不包含 `requirement_wiki`、`RequirementWiki`、`需求知识图谱` 或 `llm-wiki`。

## 保留边界与最后一步

目标主项目既有的 `.runtime/dsh-home` 和 Workspace 登记未被覆盖。旧开发仓库仍保留其原始运行数据、6 个自动漂移的 Source 元数据文件和调试输出，当前只作为冻结现场，不再作为运行或开发入口。

按照项目既有停止条件，旧目录的删除属于不可逆清理，必须在用户从目标 `main` 打开的最终页面完成一次人工确认后执行。确认前不删除旧运行时、Workspace 数据或尚未推送的源仓库提交。
