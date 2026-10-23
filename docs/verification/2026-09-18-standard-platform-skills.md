# 七个平台中文 Skill 标准化验证

## 确认与范围

用户确认将七个内置 Skill 做成平台专属中文完整版，明确要求使用 skill-creator 标准化和优化；Agent 直接文件加载，页面与下载使用同一份文件，阅读界面只保留名称与正文。完整实质方法和必要资料保留，平台路径、工具及产物约定沿用现有规则。课程原版和其他阶段不迁移。

主仓为 `/Users/muyu/MuYuProjectBuild/FDEDeliveryWorkbench`，main 基线为 `414d9a93dd1fb040f9694a447caeac55e226bc46`。没有新建 worktree、访问凭据库、调用平台配置的模型、提交或推送 GitHub；原部署手册草稿、README 部署入口和旧构建记录保持本地原状。

## 一份维护源

唯一目录为 `upstream/deepseek-harness/packages/fde/stage/skills/`。七个 ID 保留，名称、描述和完整中文正文在各自 SKILL.md 中；必要操作细节和模板位于 references/、assets/。共享持久化字段只在 qualify-ai-workflow/references/stage-records.md 中维护，其他包通过相对链接复用。技术标识、JSON 字段和既有 sourceAdapter 数据值不翻译或迁移，许可原文保留在 _licenses 中，不列入日常阅读导航。

原生 FileSystemSkillProvider 只扫描固定平台目录，provider 名为 fde-platform，保留原优先级 250。七个旧内存正文注册移除，Agent 每次加载从文件获取当前正文及资源基目录；历史会话已经加载的结果不重写。目录接口每次读取同一包，提供名称、描述、正文、入口、文件清单和 SHA-256，客户端不保存第二份平台正文。

原约 2.9 MiB 的 ui-fde-project 平台原版 JSON 快照及其导入脚本已经移除，旧独立快照决策记录合并到标准文件决策记录。原始研究仓库未删除，许可和来源版本记录保留；没有为回退另建源码副本。此前原版快照验证记录保留为历史事实并注明已被替代。

## Skill-creator 的使用与前测

- 按技能规范保留 kebab-case ID、清晰中文 description、完整实质流程和必要引用，不生成无用目录或另一套 README。
- 七份入口均通过 `/Users/muyu/.codex/skills/.system/skill-creator/scripts/quick_validate.py`。
- 独立评估者只读取相关 Skill，并处理一份模拟采购审批材料，不写客户文件、不发送消息。结果没有把 9 单便利样本外推到月总体，没有把含义不清的 20 分钟作为 AI 可节省工时，也没有把历史开发者当成批准人。
- 前测指出两处歧义后作局部修正：模拟材料在既有 summary 中明确标记且不能冒充 confirmed 的生产事实；“承诺无证据支持”先待核实，不能直接等同“承诺已被事实推翻”。未新增证据枚举或字段。

这是一项模拟判断检查，不代表配置模型已经完成真实客户业务验收，也不声称已对每种业务场景完成效果评估。

## 定向检查

命令 cwd 为 `upstream/deepseek-harness/`，规格验证从项目根执行。

| 检查 | 结果 |
|---|---|
| fde/stage/tests/stage.spec.ts | 28 项通过；第一阶段指引、目录读取与既有阶段状态保持 |
| fde/stage/tests/platform-skills.spec.ts | 2 项通过；真实 registry/native provider 的七项加载、资源目录、正文与文件/目录一致、引用闭包和卸载释放 |
| ui-fde-project/tests/skills-center-data.client.spec.ts | 8 项通过；文件唯一来源、ZIP 路径与逐文件哈希、共享依赖、课程保持及越界文件路径拒绝 |
| ui-fde-project/tests/skills-center.client.spec.tsx | 6 项通过；名称/中文正文、无树/来源/许可导航、资料返回、焦点/放大/关闭、错误恢复、两类下载和课程保持 |
| ui-fde-project/tests/stage-method-platform.client.spec.tsx | 1 项通过；项目内完整定义不展示上游技术信息，配套资料可打开并返回 |
| 两个受影响包的 `tsc -b` | 通过；补齐文件链接回调必需 title 后无类型错误 |
| Host `tsdown --filter @deepseek-ai/dsh-fde-stage` 和项目 Client bundle | 通过；只构建受影响包，不声称全仓发布构建通过 |
| plain Node 导入 fde/stage/lib/index.js | 七份已构建定义逐一等于对应 SKILL.md 正文，验证发布入口正确读取包内资源 |
| 两对受影响 README 与标准化 Agent Note 配对 | 通过 |
| PRD、Product Spec、F026 校验及 `git diff --check` | 通过；保留既有 PRD 超过 12 项需求的非阻断提示 |

共 45 项本轮定向测试通过。源内容或输入改变时只重跑对应检查，未重复全套测试；未执行浏览器截图、录屏或视觉对比。

## 已存在的非本轮问题

扩大到 project-context-sidebar.client.spec.tsx 后，9 项通过、1 项旧断言失败：测试期待“发生冲突后，怎样形成新的边界候选”，源码已经是“项目条件变化后，如何提出范围调整”。通过 git show HEAD 核对，两者在本轮前就已不一致；未修改该测试或相关旧标题。

定向 lint 的其余受影响文件通过；StageMethodDialog.tsx 整文件检查仍报告 4 个旧长行和 1 个旧箭头括号问题，均位于原有协同关系/示例段落，HEAD 已包含相同代码。本轮不做无关重排，不能据此声称全量 lint 或所有仓库测试通过。

新增依赖仅为 Host 文件加载所需的现有 workspace skill-filesystem 与已有 yaml 版本。离线、ignore-scripts 安装完成，锁文件最终只保留该包的六行依赖变化；安装工具对其他条目产生的完整性字段漂移已恢复，既有 peer/平台提示未扩大修复。

## 在线运行证据

最终服务 PID `89759`，显式使用主仓 `.runtime/dsh-home`，维持 `--lan --port 3080`。本机和 `http://192.168.110.19:3080` 首页返回 200，阶段目录接口返回 200，局域网地址的 WebSocket 握手为 101。检查来自本机访问 LAN 地址，不冒充另一台物理设备验证。

Boot revision 为 `19fa424fd6cb`，实际项目包 revision 为 `c7db98f3e7201172-37`，5,661,520 字节，SHA-256 为 `7af93d1a6eb3e8733810dda97de7dbe0bba28898843571aa868e37970a38e561`。在线包与本地可执行内容一致，仅服务端分隔符和 source map 尾注不同；不存在旧上游快照文件路径，已包含返回正文行为。

在线七个条目均为平台文件源，无 sourceUrl/上游 references 展示字段。每个响应正文和下载文件逐一与磁盘文件及哈希一致；包内文件数依次为 8、8、7、7、8、8、7（包括必要许可和共享规则），入口均为 `<Skill 名>/SKILL.md`，不再嵌套上游仓库目录。

重启前后 Workspace 登记 SHA-256 均为 `a31cecf16fbae99538a99d363a9d1b5d7d0cc95bc4b6fb03bd2be5e9246248f9`。没有修改客户文件、阶段数据或课程六文件快照。

## 留存与人工确认

中文 Skill 源码目录约 124 KiB 磁盘占用，随平台源码维护，不应当作缓存删除。构建继续复用被忽略的 lib：项目 Client JS 与 source map 约 14.1 MB，Host 输出约 148 KB；停止预览后可重建清理，不能连带删除用户运行数据。没有新增长期运行区、临时副本或下载 ZIP 留存。

阅读器观感和真实业务使用仍待用户确认，T004 保持未完成；T010 的文件、加载、阅读与下载实现已完成。
