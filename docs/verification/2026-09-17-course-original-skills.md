# 平台内置与课程原版技能集成验证

## 授权、范围与内容源

用户确认在同一技能中心收录两类来源：保留七个“平台内置”，新增用户提供的第一课 `fde-business-diagnosis` 课程原版。默认全部，提供来源筛选、蓝/紫标签和真实课次；阅读、下载共用原文件，不加入 Agent 调用链，不扫描后续课程。直接修改现有 main 主工作树，保留先前改动，没有创建 worktree、提交或推送。

- 外部维护源：`/Volumes/Extreme SSD/【正课】FDE企业AI项目实战训练营/Lesson 1｜工业FDE落地模糊需求拆解方法/Skills/fde-business-diagnosis`。
- 当前收录唯一内容源：`upstream/deepseek-harness/packages/client/ui-fde-project/src/client/course-skills/fde-business-diagnosis.json`，20,850 字节；保留六个原文件的相对路径、UTF-8 字符串、SHA-256 与课程归属。没有另建重复的原文目录。
- 六个原文件共 19,054 字节；完成后与 SSD 原件逐文件比较，目录集、原始字节和 SHA-256 全部一致。排除 AppleDouble 与 Finder 元数据，不改动或删除外部原件，也不补造 README/许可证。
- 收录版本：`d223699b37315e1efacc38d82dc49dbf05b56967314d596a4075f59843f8cca2`。

REQ-034/AC-031、PSC-028、F026 边界、三件套、架构及项目说明已按确认范围同步，产品规格仍只有简体中文一份；现有上游包 README 保留强制中英配对合同。

## 实现与取舍

来源与 Skill ID 共同标识条目，课程原版不覆盖平台适配版。蓝色平台标签与紫色课程标签由主题提供；课次不等同于平台阶段。平台目录读取失败时，本地打包的课程原版仍能阅读和下载。

文件树从实际文件路径构造，平台包保留四个直属文件，课程包呈现 `agents/`、`assets/`、`references/`。根目录默认展开，子目录按需展开；折叠不清空正文、位置或下载目标。关闭弹窗保留分类、搜索、列表滚动并恢复触发按钮焦点；放大与 Escape 的原交互继续保留。

共享 MarkdownText 只增加可选 `fileLinks`：在落定输出中将调用者确认存在的相对链接转为窗内打开动作，并保留原链接标签。选择共享解析器而非改写课程 Markdown，避免下载和阅读内容分叉；不启用该参数的调用者、外链与流式输出保留原行为。技能阅读器只解析当前包内真实文件，拒绝越界、绝对路径和外部协议，跳转时展开祖先目录。没有新增依赖、Host 文件读取、安装、执行或 Agent 注册。

## 定向验证

命令从 `upstream/deepseek-harness/` 执行，原文比较从项目根目录执行。

| 检查 | 结果 |
|---|---|
| 定向 Vitest：`skills-center-data.client.spec.ts`、`skills-center.client.spec.tsx` | 7 + 8 项通过：平台内容保留、课程 ZIP 每文件哈希一致、目录/链接、来源筛选、课程信息、目录失败隔离、两类下载和既有弹窗交互 |
| 定向 Vitest：`markdown-file-links.client.spec.tsx`、`markdown-dom-parity.client.spec.tsx` | 3 + 48 项通过：行内/引用式包内链接、作者标签、未知/不安全/外部目标以及默认与流式渲染兼容 |
| 定向 Vitest：`skills-reader-theme.client.spec.tsx` | 2 项通过，阅读弹窗继续获得局部明暗主题别名 |
| `corepack pnpm exec vitest run packages/client/ui-fde-project/tests/workbench-navigation.client.spec.tsx` | 5 项通过；总览技能入口文案同步为“内置 / 课程”后更新两处旧断言，未修改总览数据或导航 |
| `corepack pnpm exec tsc -b packages/client/ui-fde-project/tsconfig.json` | 退出 0，包含其共享原语项目引用；JSON 内容源显式加入项目文件集合 |
| `corepack pnpm exec tsdown --config tsdown.config.ts`，cwd 为 `packages/client/ui-primitives/` | 退出 0，更新共享 Markdown 的静态输出 |
| `corepack pnpm --filter @deepseek-ai/dsh-client-ui-fde-project --filter @deepseek-ai/dsh-client-ui-theme bundle` | 退出 0，更新项目和主题动态包 |
| `corepack pnpm run build:web` | 退出 0，Web 外壳包含更新后的共享 Markdown |
| `findUiI18nViolations` 定向检查 SkillsCenter 与 SkillFileTree | 两个文件零违规 |
| `verify-translation-pairing` 定向检查 ui-fde-project、ui-theme、ui-primitives README | 三对通过；仅更新对应已有 sidecar |

共 73 项相关测试通过。沿用本轮已通过结果，不重复运行等价检查。已有跨平台包、tsconfig 重复映射、Vite paths 插件和构建 chunk 大小提示不阻断本轮构建；未修改这些无关配置。没有执行全仓构建，不能以此声明完整发布产物记录已刷新。

## 3080 在线证据

重启前确认原监听进程的 cwd 与显式 DSH_HOME 后，仅停止该进程。新服务 PID `30655`，cwd 是主仓 `upstream/deepseek-harness/`，显式使用 `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench/.runtime/dsh-home`。

- 本地鉴权后首页 HTTP 200，Boot Manifest revision `b3698a113330`。
- 项目包 revision `ce40e0f0cf72ac0c-37`，5,679,430 字节，SHA-256 `551622abffc38f7a00a182fea28003d6ac56c2e94b542dc93278458574a0c89d`。
- 主题包 revision `ce40e0f0cf72ac0c-8`，98,110 字节，SHA-256 `ab8f379c65709ec09dabf627e2a719ecd7d160b7347bcb3526fa80f56e7e8111`。
- 两个在线包与本地可执行内容一致，仅服务端 source map 尾注不同；课程、分类、目录、包内链接和来源颜色标记存在，不含 Node `require("module")`。
- 实际 HTML 引用 `/assets/index-BuyjQJI-.js`，566,493 字节，SHA-256 `61484f1e38c27f4ab4f2698a417332a6e9e4ba62d5ca944e6770ef2d48d25d01`；在线字节与本地 Web 输出完全一致，包含 `fileLinks`。
- `/api/fde-stage/skills` 返回 HTTP 200，第一阶段仍是七个方法，全部运行目录中不存在课程原版 ID，收录没有改变运行注册。
- 重启前后 `workspace.json` SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`，Workspace 登记未修改。

## 留存与待确认

未自动打开浏览器、录屏或截图。真实观感与手动下载体验仍由用户确认，T004 不勾选；组件测试、源码与在线资源一致不能替代视觉验收。

构建复用原有被忽略目录：`apps/web/dist` 约 18 MB、`ui-fde-project/lib` 约 16 MB、`ui-theme/lib` 约 468 KB、`ui-primitives/lib` 约 2.8 MB，均相对 `upstream/deepseek-harness/`（包目录位于 `packages/client/`）。停止服务且不再需要本地预览时可清理这些构建输出，使用上述命令重新生成；不得连带删除 `.runtime/dsh-home` 中用户数据。日志复用 `.runtime/workbench-web.log`。没有新增依赖树、运行区、媒体或 ZIP 留存。

## 提交前增量检查

用户授权提交 GitHub 后，对本轮 16 个 TypeScript/TSX 文件执行仓库 `scripts/run-oxlint.ts` 定向检查，修正引号、缩进、长行、返回 void 的回调写法及三处不必要的非空断言；最终全部通过，没有扩展产品行为。由于目录构造和文件名表达式发生等价调整，重新执行技能数据、技能阅读器与导航三个测试文件，共 20 项通过，并重新执行上述项目 TypeScript 构建检查，退出 0。共享 Markdown 的最后调整仅为参数换行，沿用已通过行为测试；其他已验证路径不重复检查。本节未重建或重启服务，上面的在线哈希记录仍对应功能交付时的构建，而不是本次格式整理后的新构建。
