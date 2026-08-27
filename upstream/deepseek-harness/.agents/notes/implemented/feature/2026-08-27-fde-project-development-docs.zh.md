# Agent Note：FDE 项目开发文档与研发进度

状态：已实现

[English](2026-08-27-fde-project-development-docs.md) | 中文

## 问题

项目开发需要的不只是代码 Dock。FDE 会通过多轮 Agent 对话持续完善 PRD、规格、实施计划、任务、测试和证据；工程经验较少的使用者还需要一条可见流程，知道已经有什么、什么仍未知、何时可以进入验证。复用通用任务看板会在项目 Markdown 旁建立第二个事实源；按文件存在自动推进，又会让 Agent 产出代替业务决策。

## 决定

Host 注册一个按需加载的 `fde-project-development` Skill。它借鉴 Spec Kit 的轻量规格先行顺序，但直接维护项目唯一标准 `docs/`：`docs/PRD.md`、`docs/specs/product-spec.md`、`docs/specs/feature-map.md` 和 `docs/specs/FNNN-slug/{spec,plan,tasks}.md`。它不安装第二套 CLI、不强制分支名，也不建立任务数据库。未知日期保持“待确认”，Markdown 任务只有在源码、测试、构建或运行证据存在时才能勾选。

`@deepseek-ai/dsh-fde-project` 增加有界只读研发投影。它最多扫描 100 个规范 Feature 目录，只解析少量 frontmatter 白名单字段，统计 Markdown 任务，报告重复 Feature ID，并索引 `fde-deliverables/03-project-development/` 下三份收口文件。预览路由只接受 Host 已索引产物 ID，提供字节前再次检查 realpath 仍在 Workspace 内；浏览器不能提交任意路径。

“项目进度”从该投影展示核心文档、Feature 状态、任务证据、计划日期、里程碑、阻塞、文档预览和收口文件，从不反写任务状态。“评估”从项目开发阶段开始可用，“观测”仍从验证评估开始。三份收口文件只使 FDE 动作可用。二次确认调用专用 `development` 到 `validation` Host 路由，并重新检查文件、当前阶段和精确 revision。Agent 与 Skill 都没有推进阶段的能力。

## 考虑过的替代方案

**原样安装 GitHub Spec Kit。** 它的 CLI、分支流程和生成状态适合仓库初始化，但会重复现有 FDE 文档合同，并把安装变成运行时前置。

**把任务保存在看板数据库。** 这会要求 UI 状态和 Markdown 之间增加同步与冲突规则，因此继续以项目 docs 为权威。

**从 Git 提交或文件时间推算进度。** 这些信号不能证明验收、测试证据、日期或任务完成，并且导入的非 Git 项目可能根本不存在这些数据。

**任务或收口文件齐备时自动推进。** 风险接受属于 FDE。文件存在只允许审阅，绝不改变阶段。

## 结果

导入项目和 Agent 开发项目都能在不采用第二套工作流引擎的前提下展示一致研发计划。已有源码项目可逆向形成相同结构并立即验证页面。缺失或损坏文档会保持可见，不会静默修复。第一版不在页面编辑 docs、不估算排期、不绘制依赖甘特，也不判断已勾选任务的语义质量；这些仍由 FDE 和项目工具负责。
