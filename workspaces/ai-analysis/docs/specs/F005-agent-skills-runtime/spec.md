---
document: feature-spec
feature: F005
title: Agent 对话、运行与 Skills
status: completed
planned_start: "待确认"
planned_end: "待确认"
milestone: 自然语言分析运行可观察且可扩展
updated: 2026-08-27
---

# F005 · Agent 对话、运行与 Skills

## 用户结果

用户可以在项目内通过自然语言发起分析，看到计划、步骤、工具、产物、失败、取消和重试；还可以安装或启用符合权限声明的 Skills，为不同业务分析提供方法与脚本能力。

## 行为规格

1. 消息必须属于当前项目，最多引用当前项目明确 SourceId 和已启用 SkillId。
2. 意图分为普通对话、数据问答、探索、可视化、建模、报告和项目操作。
3. 普通对话不注册数据工具且不创建 AnalysisRun；需要工具的意图创建持久 Run、计划和 RunStep。
4. 在线 Agent 通过 OpenAI 兼容模型、DeepAgents 和 SQLite Checkpointer 流式执行；没有模型时使用明确本地路径或返回配置缺口。
5. 每个工具调用记录名称、输入字段、call id、状态、错误和 ArtifactId，不保存模型隐藏推理。
6. 用户可以取消运行；失败 Run 可通过 `retry_of_run_id` 重试并保留原记录。
7. Skills 支持内置安装、ZIP 上传、内容检查、默认启用、项目启用、升级、禁用、卸载和脚本执行。
8. Skill 权限必须声明；项目授权不能越过声明；归档与检查路径不能逃逸 Skill 根。
9. 脚本型 Skill 在无网络、受限写入的 Docker 沙箱执行，产出经过项目路径校验后登记。

## 边界与失败

- API Key 不进入消息、运行元数据、Skill 内容或模型可见数据基线。
- 普通聊天不能因关键词误调用数据工具；模型文本声称创建文件不等于 Artifact 已登记。
- SSE 中断、工具失败和用户取消分别持久化，不折叠为成功。
- Skill 升级必须保留项目关联和默认语义；权限升级需拒绝而非静默扩大。

## 验收

- 普通对话不产生 Run；分析对话产生可查询步骤和关联产物。
- Run 取消/失败/重试状态明确，原记录不被覆盖。
- 恶意 Skill ZIP 路径穿越或权限升级被拒绝；脚本沙箱不能联网或写宿主根。
