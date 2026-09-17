status: DIRECTION_SELECTED_PENDING_REVISION

# 第一阶段 Skills 视觉候选

本轮目标：比较技能中心卡片浏览与单 Skill 文件阅读这两层页面。页面功能已确认；使用内置 `imagegen` 逐张纯文字生成，没有参考图、历史截图或 CLI/API Key。

2026-09-17：用户确认 1 号卡片浏览思路，明确去掉八阶段导航条，改为直接滚动浏览。1 号不是整图定稿；详情页尚未选择。修订见 [round-03](../round-03-stage-one-skills-scroll/page-function-spec.md)，四张原候选均保留。

成功 **4 张**，失败 **0 张**。1、2 为技能中心；3、4 为阅读页。图片用于选视觉方向，不表示前端、下载包或外部 Agent 兼容性已经实现。

## 1 · 技能中心：平铺资产目录

[查看原图](candidates/1-skill-catalog.png) · [完整提示词](prompts/1-skill-catalog.txt)

![1 号：技能中心平铺资产目录](candidates/1-skill-catalog.png)

- 页面／时刻：用户进入第一阶段，扫读七个 Skill 并选择查看或下载。
- 视觉人格：浅色矿物纹理与七张同级卡片；视觉气质路线，主要词汇为 mineral surface、technical ruling、modular rhythm。
- 观察：七项资产都在首屏明确呈现，动作位置重复一致。生成结果把平台导航移到了顶部并加入较强纹理装饰；若选这一方向，仍须恢复原侧栏，不扩大既有导航改动范围。

## 2 · 技能中心：核心方法与配套能力

[查看原图](candidates/2-method-library.png) · [完整提示词](prompts/2-method-library.txt)

![2 号：技能中心核心方法与配套能力](candidates/2-method-library.png)

- 页面／时刻：用户先理解业务诊断主方法，再寻找当前缺口所需的六个配套方法。
- 视觉人格：暖调编辑式层级与纸张感；视觉气质路线，主要词汇为 editorial hierarchy、margin-note logic、paper character。
- 观察：主卡与六张配套卡建立了不同权重，原平台侧栏仍可辨认。未接入阶段名称被模型简化，宣传性引语不是确认文案，均不能直接带入实现。

## 3 · Skill 阅读页：正文优先

[查看原图](candidates/3-markdown-reader.png) · [完整提示词](prompts/3-markdown-reader.txt)

![3 号：Skill 阅读页正文优先](candidates/3-markdown-reader.png)

- 页面／时刻：用户打开核心 Skill，选中 `SKILL.md` 连续阅读。
- 视觉人格：冷白阅读面、蓝色选中态与较轻的文件导航；阅读优先路线，主要词汇为 negative space、reading rhythm、hairline dividers。
- 观察：平台导航、包内文件和正文三种信息层级分开，整包下载与当前文件下载也有区分。阶段面包屑和正文节选须用正式名称与实际 Markdown 校准。

## 4 · Skill 阅读页：文件与来源对应

[查看原图](candidates/4-package-reading.png) · [完整提示词](prompts/4-package-reading.txt)

![4 号：Skill 阅读页文件与来源对应](candidates/4-package-reading.png)

- 页面／时刻：用户核对当前包、当前文件、来源版本与将要下载的范围。
- 视觉人格：模块化阅读面、明确路径与局部色彩对应；轻量混合路线，主要词汇为 linked highlights、semantic color carryover、inset reading surface。
- 观察：文件路径、版本和下载范围比 3 号更显性，正文示范了表格渲染。生成的头像不属于本轮功能，表格里的业务数据只是模型生成的视觉示例，不能进入真实 Skill 或作为客户事实。

## 统一边界

- 图片中的 Logo 不是可替代仓库原 Logo 的品牌资产；最终实现必须用真实品牌、文案和 Skill 内容。
- 未自动选择或淘汰候选；四张均完整保留。当前运行中的总览、项目中心、实验室和设置没有修改。
- 候选保存在本轮 `candidates/`，已排除 Git。提示词保存在 `prompts/`，生成记录在 [generation-log.md](generation-log.md)。选型与实现承接后可归档或清理图片；同一提示词重新生成不保证逐像素相同。

你可以回复“列表选 2，阅读页选 3”“选 1，但保留原侧栏”或“沿 4 再抽”。跨页视觉一致化及前端实现都等待下一步明确指令。
