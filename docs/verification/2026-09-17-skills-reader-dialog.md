# 第一阶段技能阅读弹窗验证

## 授权与范围

用户在对比本地大模型学习平台 Skills 源码后，确认把“查看”从替换列表的详情页改成阅读弹窗。继续使用原七个 Skill、文件内容、搜索和下载，不增加安装、执行、试跑、评级或其他阶段。直接修改现有 main 主工作树，不创建 worktree，不修改运行数据。

PRD AC-031、总规格 PSC-028、F026 AC-F026-002 与 T005 已同步；PRD、总规格和 F026 结构校验均通过。原页面定稿只继续约束卡片列表，弹窗借鉴交互而非承诺学习平台的逐像素复刻。T004 人工确认仍未完成。

## 实现与取舍

- 复用本仓 Modal、MarkdownText 和既有下载逻辑。列表持续挂载，弹窗默认 SKILL.md；目录和正文独立滚动，固定标题与操作区，放大不重建正文。
- 选择“列表上阅读”而不是整页替换，便于连续查看不同 Skill，同时保留搜索、列表滚动及原查看按钮。没有导入学习平台的安装/试跑语义，也没有引入其 Radix、Tailwind 或运行服务。
- 弹窗打开时记录并锁定底层分支和 body 滚动，键盘焦点限定在弹窗内；关闭或组件卸载恢复之前的 inert/overflow 状态。关闭按钮、遮罩关闭整个弹窗；放大时 Escape 只还原，普通窗口 Escape 关闭并恢复触发按钮焦点。
- 下载错误在当前阅读弹窗内显示，文件选择、Markdown 内部引用、整包和单文件下载继续使用同一适配文件内容。未修改共享 Modal、项目页或实验室。

## 定向证据

以下命令均从 `upstream/deepseek-harness/` 执行。

| 检查 | 结果 |
|---|---|
| `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/skills-center.client.spec.tsx` | 退出 0，1 文件、5 项通过；覆盖保留列表与文件阅读、键盘焦点循环、放大保留位置、Escape 两级退出、遮罩与卸载恢复、目录失败/搜索恢复及两类下载/失败提示 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json` | 退出 0，组件及字典类型通过 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project bundle` | 退出 0；复用已有输出目录，仅构建受影响包，不代表全仓构建通过 |
| 仓库 `findUiI18nViolations` 检查本轮 SkillsCenter.tsx | 零硬编码界面文案 |
| `corepack pnpm run verify-translation-pairing packages/client/ui-fde-project/README.md` | 1 对已有包 README 一致；本轮产品规格仍只有简体中文版本 |

构建的跨平台包提示及 Vitest 已有 paths 插件提示不影响退出状态，本轮未扩展处理无关配置。没有重复运行已通过的总览检查、ZIP 数据算法测试或全量 Web E2E。

## 3080 运行核验

- 监听 PID `24341`，cwd 是主仓 `upstream/deepseek-harness/`，显式 `DSH_HOME=/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`。
- 重启前后 `workspace.json` SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，原 Workspace 登记未改动。
- 本地鉴权后首页 HTTP 200，Boot Manifest revision `213bf9d0a9fb`；实际项目包 revision `c921e555d21ec52b-37`，HTTP 200，5,645,598 字节，SHA-256 为 `399177bc663c80e5bdb795b135a49cd62a3080896e9a8686f6cca697402bde9a`。
- 在线可执行内容与本次本地产物完全一致，仅服务端 source map 尾注不同；包含阅读弹窗、放大、还原和关闭的新标记，不再包含 `skills.back`，仍不包含 Node `require("module")`。

## 未验证与留存

遵循项目人工优先规则，没有自动打开浏览器、点击界面、截图或做像素比较；真实观感和窗口尺寸体验待用户确认，不能把组件测试或 HTTP 成功当成视觉通过。

服务日志复用被忽略的 `.runtime/workbench-web.log`，旧日志被本次启动覆盖；构建产物复用原包 `lib/`，可由相同命令重新生成。没有新增 worktree、依赖副本、图片、录像或大型留存产物；没有提交或推送。

## 人工反馈：修复阅读弹窗透底

用户截图确认阅读弹窗背景透明。原因是 Skill 颜色别名只声明在 `[data-skills-center]`，共享 Modal 将弹窗挂载到 body 后不再继承这些变量，背景声明因变量缺失而失效。仅在主题所有者 `design-platform.css` 中把原有明暗配色选择器扩展到直接包含 `[data-skill-reader]` 的对话框；不修改共享 Modal、阅读交互或其他弹窗。

- `corepack pnpm exec vitest run packages/client/ui-theme/tests/skills-reader-theme.client.spec.tsx`：退出 0，2 项通过；使用真实共享 Modal 与主题样式表，确认 body 弹窗获得与列表一致的明暗背景、文字和边框别名，其他弹窗不获得 Skill 配色。初版复用的静态扫描助手在 jsdom 中遇到非 file URL，已改为直接加载样式表检查计算后的自定义属性，不修改公共助手。
- `corepack pnpm --filter @deepseek-ai/dsh-client-ui-theme bundle`：退出 0，只重新构建主题包；`corepack pnpm run verify-translation-pairing packages/client/ui-theme/README.md`：1 对通过。
- 当前 3080 监听 PID `25461`，仍使用主仓 cwd 与原绝对路径 DSH_HOME；`workspace.json` hash 与上文一致。本地鉴权后首页 HTTP 200，Boot revision `6313a0f98e71`。
- 实际主题包 revision `e6e8fee8ef4ace67-8`，97,877 字节，SHA-256 `8684bb68567901119b663fbb47ee685108d81af316d850dbe8455b959b750a29`；在线可执行内容与本地构建一致，含新增阅读弹窗配色选择器。检查允许构建压缩选择器空白，不要求源文件中的空格原样保留。
- 本轮没有重跑交互测试、全仓构建或浏览器自审；实际透底问题是否消失交由用户刷新后确认。无新增运行目录或大型产物，无提交或推送。

## 人工反馈：补齐可展开的文件树

用户指出目录仍是平铺列表，未落实参考源码中的展开结构。重新核对学习平台 `apps/desktop/src/components/market/pack-files-panel.tsx` 的 `PackFileTreeRows`：采用文件夹箭头、打开/关闭图标、子项缩进与层级线；仅借鉴交互，未复制其依赖或安装语义。当前适配包的真实结构只有 Skill 根目录及四个直属文件，因此直接呈现这两层，不创建不存在的子目录，也不新增通用文件树抽象。

打开 Skill 时根目录展开并选中 SKILL.md；点击根目录切换子文件可见性，正文、位置和下载目标保留；文内文件引用展开根目录并同步选中。小屏仍使用纵向树形结构，保留目录自身滚动。未修改包内容、ZIP、共享 Modal、刚修复的主题作用域或项目运行数据。F026 Plan/T006 与已有包 README 已同步，上游产品范围和验收未变化。

- F026 定向规格校验：退出 0，无错误或警告。
- `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/skills-center.client.spec.tsx`：退出 0，6 项通过；新增收起/展开、保持正文与位置、放大保留收起状态、文内引用展开并选中、换 Skill 重置状态的检查，原焦点、关闭、搜索与下载检查继续通过。
- `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json`、项目包 `bundle`、现有 README 定向配对检查：均退出 0。没有重跑不受影响的主题回归或全仓构建。
- 当前 3080 PID `26510`，主仓 cwd 与原 DSH_HOME 不变，`workspace.json` SHA-256 与前述记录一致；鉴权后首页 HTTP 200，Boot revision `32afa4a4ec28`。
- 实际项目包 revision `e9d82fabf71c36a6-37`，5,648,723 字节，SHA-256 `f845c85b349c54117bad33f20a6ad4b8ab1a51d0a6cb3f6ec17ff75a72b30747`，与本地可执行内容一致，含新文件夹与层级样式标记，仍不含 Node `require("module")`。
- 没有自动浏览器验收；视觉仍由用户刷新后确认。复用原日志和构建目录，没有新增大型产物、worktree、提交或推送。
