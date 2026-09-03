# FF - FDE 交付工作台

面向 FDE 从业者，把企业需求转化为可验证、可部署、可验收、可移交 AI 生产系统的一体化交付工作台。课程负责教会用户使用，但不构成产品角色或信息架构。

## 当前范围

- 目标用户：承担真实企业 AI 项目结果的 FDE 从业者。
- P0 核心旅程：创建空白项目 → 收集原始来源 → 与项目 Agent 协作 → 形成候选产物与确认清单 → 提交项目基线 → 完成工程、验证、上线、验收与移交。
- 当前已实现：FDE 品牌壳、项目优先入口、结构化项目创建与多会话导航、项目 `fde-resources/` 原件与稳定 SourceId、本地文档识别、项目详情/开发工作区双入口只读预览、六阶段提示、独立“项目进度”、项目交付四个结果 View，以及不侵占项目导航的右侧 Files/Editor/Git/Review Dock。
- 当前资料边界：导入、本地识别和预览都不修改输入框、不创建消息、不触发 Agent；已验证 DOCX、XLSX、PPTX、PDF、CSV、Markdown 和文本识别，OCR、版本/删除、权限/有效性与对话显式引用尚未实现。
- 当前开发工作区边界：锁定 `dsh-better-sidebar@0.16.1` 与 `dsh-file-review-tab@0.2.0`；左侧只保留项目/会话、中央保留官方对话，右侧按需展示文件、编辑、Git Diff 与 Agent 文件审查，且两类 Diff 保持不同来源语义。
- 当前项目进度：左侧一级“项目进度”打开保留侧栏、替换中央/右侧工作区的完整页面，汇总真实项目阶段、会话和已有预计周期；项目卡先进入只读项目详情审阅资料，再通过“进入项目交付”回到明确项目；不生成假日期或完成百分比。
- 当前项目结果：项目交付中提供“API 文档”和“系统架构”。API 工具复用锁定 `dsh-openapi` 并按 calling Agent Workspace 隔离；系统架构提供 Agent 候选、精确 revision、人工确认、缩放和 SVG/PNG 导出，不把运行图冒充设计架构。
- 当前运行与质量：观测固定 `dsh-observe`，默认 disabled 且无外发，页面汇总项目内真实 Session/Stats/Token；评估固定 `dsh-eval-harness`，经过二次费用确认后运行隔离 Trial，展示报告、人工 Baseline 和同名用例差异。自动开发验证没有调用付费模型。
- 当前界面主题：设置中的“界面主题”提供官方原版、大肥鱼拟人、云端猫咪和三套九天皮肤，也支持只在当前浏览器处理和保存的自定义背景；皮肤与浅色/深色/跟随系统相互独立。
- 明确不做：客户管理、跨项目资源与成本管理、经营统计、教学角色、团队协作、跨项目资产复用和完整 VS Code Workbench。

## 项目结构

- `upstream/deepseek-harness/`：锁定官方 DeepSeek Harness `0.1.1-rc.2` 的开发工作副本及当前 FDE 下游插件。
- `.runtime/dsh-home/`：被忽略的本地 DSH 运行状态。
- `frontend/`、`backend/`：预留给后续独立 FDE 前端/后端交付层；当前实现仍在锁定基座中以插件方式完成 vertical slices。
- `docs/`：产品级 PRD、项目总 Spec、Feature Map、逐 Feature Spec/Plan/Tasks、架构与验证证据。

## 快速开始

当前工作台插件要求 Node.js 24 或更高版本。

```bash
cd upstream/deepseek-harness
corepack pnpm install --frozen-lockfile
corepack pnpm run build

DSH_HOME="$PWD/../../.runtime/dsh-home" \
  corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080
```

本地入口：<http://127.0.0.1:3080>。

## 使用 Agent 开发

项目规则见 `AGENTS.md`。可让 Codex 先读取该文件、confirmed PRD、Product Spec 与 Feature 三件套，再实现当前授权 Feature。

---

`@赋范空间 独家研发`
