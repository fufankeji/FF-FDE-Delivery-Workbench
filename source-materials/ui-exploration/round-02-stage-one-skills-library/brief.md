# 第一阶段 Skills：视觉探索简报

日期：2026-09-17。目标项目：FF - FDE 交付工作台，当前 `feature/platform-navigation` worktree。本轮延续已有 round-02，不覆盖其他轮次。

## 事实与授权

- 产品形态：[`product-shape-spec.md`](product-shape-spec.md)，`CONFIRMED`。
- 页面功能：[`page-function-spec.md`](page-function-spec.md)，用户以“可以，去做，先出视觉”确认。
- 当前产品事实仅来自本轮用户要求、七个已核对的第一阶段 Skill、当前平台导航和上述合同；历史 UI 图、竞品和其他项目不作为参考输入。
- 目标用户是 FDE 从业者，任务是按阶段找到方法、打开完整内容、取得文件。产品不是课程门户、插件市场或在线 IDE。
- 数量为已提议并获确认的四张：两张资产浏览页、两张单 Skill 阅读页；每张单独生成，不拼成一张小图。
- 第一阶段可用，第二至八阶段待接入；浏览和下载不运行 Agent，不改变项目阶段。

## 真实文字与取景

- 品牌：`FF - FDE 交付工作台`；署名：`@赋范空间 独家研发`。
- 平台入口：总览、项目中心、实验室、技能中心；返回介绍首页与底部设置保留。
- 列表取景：第一阶段“发现高价值问题”，七个真实方法卡片，每个有查看与下载；首页没有文件树。
- 阅读取景：`qualify-ai-workflow`，默认 `SKILL.md`；文件树只属于当前包，正文为可读 Markdown，不是代码编辑器。
- 详情树使用已确认的拟交付文件 `SKILL.md`、`README.md` 和来源说明；这只展示设计方案，不声称下载包已实现。外部参考资料独立为来源链接，不伪装为包内目录。
- 真实内容节选来自现有业务诊断方法：先读材料、还原正常与异常流程、区分事实与推断、比较传统改进与 AI 增量；不加入客户隐私或真实项目数据。
- 源码版本以 `63e2d2f` 显示来源版本，不编造发行版本、下载量或评分。

## 表达策略与独立设计命题

主路线为视觉气质与阅读体验。此页没有正在执行的任务，不使用粒子、扫描、运行进度或装饰性工作流冒充业务活动。仅在阅读页用局部选中态和路径对应表达真实文件归属。

| 编号 | 页面与时刻 | 设计命题 | 策略与视觉词汇 |
| --- | --- | --- | --- |
| 1 | 技能中心：初次浏览七项资产 | 如何让七种方法同等易扫读，仍有清楚阶段归属？ | 视觉气质；mineral surface、fine technical ruling、precise data marks、restrained modular rhythm |
| 2 | 技能中心：理解主方法与配套方法 | 如何突出业务诊断主线，而不让其他六项变成次要链接？ | 视觉气质；warm editorial hierarchy、quiet margin notes、subtle paper character、authorial composition |
| 3 | Skill 详情：阅读主定义 | 如何让文件结构可理解，同时把注意力留给长文？ | 阅读优先；quiet negative space、layered reading rhythm、hairline dividers、calm material separation |
| 4 | Skill 详情：核对当前文件与资产来源 | 如何让文件归属、来源版本与正文形成清楚关系，而不变成 IDE？ | 轻量混合；semantic color carryover、linked highlights、inset reading surface、precise typography |

这些词汇只提供创作材料，不设完整色板、像素网格或固定卡片排列；除用户明确要求的详情“文件树与 Markdown 阅读”关系及受保护的平台导航外，交由绘图模型组织视觉方案。四张不要求互相复制布局，选定后才统一跨页风格。

## 生成、存储与验收边界

- 使用 `imagegen` 内置生图，纯文字生成，每张独立调用；不读取 API Key，不使用 CLI 付费调用，不传历史截图。
- 每张完整提示词先保存到 `prompts/`，图像生成后复制到 `candidates/`；结果和真实状态逐张写入 `generation-log.md`。
- 图片可能存在中文、图标或 Logo 精度偏差。候选不替代真正品牌资产，最终实现必须使用仓库原 Logo 和真实文案。
- 图片目录已通过本轮 `.gitignore` 排除；生成工具默认输出是中间副本，项目候选目录是本轮交付入口。保留至人工选型及实现承接，之后可归档或清理；提示词可用于重新生成候选，但不保证逐像素相同。
- 只检查成功文件、图片可见性和提示词对应关系；不自动排名或审美重抽，不运行浏览器、截图或前端测试。
- 完成后状态为 `AWAITING_TEACHER_SELECTION`，等待选图，不实施或推送。
