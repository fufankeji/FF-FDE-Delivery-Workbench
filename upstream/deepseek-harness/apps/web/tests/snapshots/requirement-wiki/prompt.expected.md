请执行当前 FDE 项目的需求知识整理。BuildId=<BuildId>，页面基于 revision R1。

先调用 requirement_wiki_get，并传入 BuildId；随后只读取它返回的以下固定派生文本，不要读取其他项目或自行扩展来源：
- <SourceId>: .fde/derived/<SourceId>.md（客户需求.md）
- <SourceId>: .fde/derived/<SourceId>.md（验收纪要.txt）

把资料整体梳理为业务目标、角色、流程/SOP、系统与数据、业务规则、约束、验收方向、风险、冲突和未知项。每个知识页、关系、冲突和未知项都必须引用一个或多个本次 SourceId。完成后调用 requirement_wiki_publish 一次提交完整候选，expectedRevision 必须使用 requirement_wiki_get 返回的值。不要把候选理解写成客户已确认事实，不要推进项目阶段或项目基线。
