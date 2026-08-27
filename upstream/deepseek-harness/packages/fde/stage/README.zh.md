# @deepseek-ai/dsh-fde-stage

[English](README.md) | 中文

FDE 项目当前阶段的 Host 端状态。该包打开一张以 Harness WorkspaceId 为键的 `storage-domain` 表，并提供仅限可信同源访问的 POST 路由：读取或初始化记录，以及执行四个固定转换——`requirements` 到 `solution`、`solution` 到 `development`、`development` 到 `validation`、`validation` 到 `pilot`。同一 Workspace 的并发首次读取共享一次写入；阶段转换按项目串行并要求页面提交精确 revision。四个交付门依次重新检查三份需求调研文件、包括项目 PRD 在内的五份方案设计文档与已确认架构、三份项目开发收口文件，以及当前已由 FDE 确认的验证方案、验证合同、证据、阻塞项和三份验证产物；所有路由都不接受任意目标阶段。

该包同时注册内置 `fde-requirement-research`、`fde-solution-design`、`fde-project-development`、`fde-validation` Skills 和一段简短的阶段感知系统提示。项目开发 Skill 直接约束项目唯一标准 `docs/` 与有证据的任务；验证 Skill 区分方案准备和执行，要求每项指标引用此前阶段的真实文档，也不能创建 Host 所有的 FDE 方案确认。只有 FDE 在浏览器中的明确确认能够授权当前方案，并在验证完成后推进阶段。其余两个阶段门仍延期实现。

## 模型体验

当 Agent 属于需求调研、方案设计、项目开发或验证评估中的已登记项目时，模型会看到一段短提示：当前阶段、固定产物目录、按需加载的 Skill，以及不得确认客户结论或推进项目。对应完整 Skill 正文只在既有 skill 工具被调用后加载；本包不注册阶段推进工具。

#### KV Cache 影响

短提示在每个受支持阶段内保持稳定，只在已提交项目阶段变化时改变，并从部署试运行开始变为空。较长的 Skill 正文只在明确加载后影响普通对话后缀。

## 已知限制与暂缓事项

- 路由只允许本机同源访问，并要求 WorkspaceId 已存在。
- 当前记录只有当前阶段、revision 和时间；阶段历史、受影响状态、试运行／移交证据和浏览器推送仍延期实现。
- 部署试运行到验收移交及最终移交完成的阶段门尚未实现。
- 固定文件只校验存在和可读取；业务质量仍由 FDE 负责判断。
