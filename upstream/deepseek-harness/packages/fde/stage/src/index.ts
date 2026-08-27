/** FDE project-stage Host plugin. @module @deepseek-ai/dsh-fde-stage */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection'
import { loadDevelopmentDocs, loadRequirementArtifacts, loadSolutionArtifacts, readProjectArchitecture } from '@deepseek-ai/dsh-fde-project'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import { createCompleteDevelopmentRoute, createCompleteRequirementsRoute, createCompleteSolutionRoute, createStageRoute } from './http.ts'
import { fdeStageDomainSpec, type FdeStageId } from './spec.ts'
import { FdeStageState } from './state.ts'

export { FdeStageRequestError, createCompleteDevelopmentRoute, createCompleteRequirementsRoute, createCompleteSolutionRoute, createStageRoute } from './http.ts'
export { FDE_STAGE_IDS, fdeStageDomainSpec, fdeStageId, projectStageRecord } from './spec.ts'
export type { FdeStageId, ProjectStageRecord } from './spec.ts'
export { FdeStageConflictError, FdeStageState, FdeStageTransitionError } from './state.ts'

/** Stable Host route used by the FDE Stage browser plugin. */
export const FDE_STAGE_OPEN_PATH = '/api/fde-stage/open'
/** Fixed manual gate from requirement research to solution design. */
export const FDE_STAGE_COMPLETE_REQUIREMENTS_PATH = '/api/fde-stage/requirements/complete'
/** Fixed manual gate from solution design to project development. */
export const FDE_STAGE_COMPLETE_SOLUTION_PATH = '/api/fde-stage/solution/complete'
/** Fixed manual gate from project development to validation. */
export const FDE_STAGE_COMPLETE_DEVELOPMENT_PATH = '/api/fde-stage/development/complete'
/** Cordis plugin name. */
export const name = 'fde-stage'
/** Required durable Workspace, model guidance, and same-origin Web services. */
export const inject = ['skills', 'storageDomain', 'systemPrompt', 'workspaceRegistry', 'webServer']

/** Runtime Skill loaded on demand while an FDE is consolidating requirements. */
export const REQUIREMENT_RESEARCH_SKILL = {
  name: 'fde-requirement-research',
  description: '整理 FDE 项目需求调研资料，并在固定目录生成或更新需求调研报告、需求确认清单和候选需求基线。',
  whenToUse: '当前项目处于需求调研，用户要求梳理、收敛或更新阶段材料时使用。',
  source: 'bundled',
  content: `# FDE 需求调研产物

只在当前项目的需求调研工作中使用本 Skill。先读取用户本次明确授权的项目资料、当前对话，以及固定路径中已经存在的产物；不要把未读取的资料说成已经核对。

## 固定产物

1. \`fde-deliverables/01-requirement-research/requirement-research-report.md\`
   - 业务背景与目标、角色与使用场景、现状流程、目标流程、系统与数据、范围、约束、风险、验收方向、未知项。
2. \`fde-deliverables/01-requirement-research/confirmation-checklist.md\`
   - 每项写清待确认问题、来源依据、影响、当前答复和状态；没有客户或 FDE 明确答复时不得标为已确认。
3. \`fde-deliverables/01-requirement-research/requirement-baseline.md\`
   - 汇总候选范围、明确不做、关键业务规则、数据边界、验收方向、依赖与仍保留的未决项。

## 工作规则

- 把内容区分为“来源事实”“合理推断”“未知/待确认”，并尽可能标注对应文件或对话依据。
- 有新资料或新结论时更新同一文件，不创建 final、v2、new 等平行最终稿。
- 资料冲突时保留冲突双方及其来源，不自行选择客户结论。
- 三份文件都是候选阶段产物。不得声称客户已经确认，不得改变项目阶段；是否进入方案设计只能由 FDE 在项目进度页决定。
- 若信息不足，先在需求确认清单记录缺口，并在回复中明确建议 FDE 下一步向客户确认什么。`,
} as const

/** Runtime Skill loaded on demand while an FDE is consolidating the solution. */
export const SOLUTION_DESIGN_SKILL = {
  name: 'fde-solution-design',
  description: '把已确认需求收敛为项目 PRD、方案设计、研发计划、验收方案、候选方案基线和项目级系统架构。',
  whenToUse: '当前项目处于方案设计，用户要求设计、收敛或更新项目方案时使用。',
  source: 'bundled',
  content: `# FDE 方案设计产物

只在当前项目的方案设计工作中使用本 Skill。先读取已确认的需求基线、用户本次明确授权的项目资料和当前对话，再读取固定路径中已有的方案产物。不要把候选方案或推断写成客户已经确认的需求。

## 固定文档

1. \`fde-deliverables/02-solution-design/project-prd.md\`
   - 定义“要做什么”：用户与角色、业务目标、用户/业务流程、功能需求、业务规则、输入输出与数据、AI 行为与失败回退、约束、需求到验收的映射，以及仍待确认的产品问题。
2. \`fde-deliverables/02-solution-design/solution-design.md\`
   - 定义“怎么做”：系统边界、技术组件、集成关系、数据与 AI 实现策略、关键技术决策、非目标，以及项目 PRD 条目与实现方案的对应关系；不要重复项目 PRD 中的产品范围和角色定义。
3. \`fde-deliverables/02-solution-design/development-plan.md\`
   - 工作包、里程碑、实施顺序、数据与环境准备、外部依赖、风险和候选时间安排。
4. \`fde-deliverables/02-solution-design/acceptance-plan.md\`
   - 可检查的业务、功能、AI、性能、安全、部署和试运行验收条件，以及验证证据要求。
5. \`fde-deliverables/02-solution-design/solution-baseline.md\`
   - 候选方案版本、需求基线引用、关键决策、未决项、已接受风险，以及原型、API 契约、数据映射和 POC 是否适用及其证据位置。

## 系统架构

- 先调用 \`architecture_get\` 读取当前项目架构和 revision，再用 \`architecture_set\` 提交完整候选并携带精确 expected revision。
- 不要直接写 \`.fde/architecture.json\`，不要把任务步骤、运行轨迹或隐藏推理画成架构节点。
- 架构候选由 FDE 在“系统架构”中审阅确认；你不能自行确认。

## 工作规则

- 明确区分“已确认需求”“方案选择”“合理推断”“未知/待确认”，并尽可能引用需求基线、文件或对话依据。
- 有新事实或新决定时更新同一文件，不创建 final、v2、new 等平行最终稿。
- 原型、API 契约、数据映射和 POC 按项目实际情况决定，不机械补造；在方案基线记录适用性、证据或不适用理由。
- 五份文档和系统架构都是候选阶段产物。不得声称客户或 FDE 已经确认，不得改变项目阶段；是否进入项目开发只能由 FDE 在项目进度页决定。`,
} as const

/** Runtime Skill loaded on demand while an FDE is planning and executing development. */
export const PROJECT_DEVELOPMENT_SKILL = {
  name: 'fde-project-development',
  description: '按统一 docs 规范拆分、实施和追踪 FDE 项目研发，并在开发完成时形成固定收口产物。',
  whenToUse: '当前项目处于项目开发，用户要求规划、拆分、实施、检查研发进度或收口开发时使用。',
  source: 'bundled',
  content: `# FDE 项目开发规范

只在当前项目的项目开发阶段使用本 Skill。先读取已确认的项目 PRD、方案、架构、现有源码和已有 docs，再决定本次需要补文档还是实施功能。不要用模板内容覆盖真实项目事实。

## 标准 docs

1. \`docs/PRD.md\`：产品目标、范围、需求和验收。
2. \`docs/specs/product-spec.md\`：跨 Feature 的对象、状态、不变量和共享行为。
3. \`docs/specs/feature-map.md\`：Feature、依赖、优先级和真实状态。
4. \`docs/specs/FNNN-slug/spec.md\`：一个 Feature 的可观察行为、边界和验收。
5. \`docs/specs/FNNN-slug/plan.md\`：影响范围、实施顺序、风险、回退和验证。
6. \`docs/specs/FNNN-slug/tasks.md\`：可执行任务、依赖和完成证据。

Feature 文档 frontmatter 使用 \`document\`、\`feature\`、\`status\`、\`title\`、\`planned_start\`、\`planned_end\`、\`milestone\`、\`updated\`；日期没有事实依据时写“待确认”。同一 Feature 持续更新同一路径，不创建 final、v2、new 等平行最终稿。

## 开发规则

- 先收敛 PRD 与总规格，再冻结 Feature Map；只为本次明确实施的 Feature 创建或更新 spec/plan/tasks。
- 实施前读对应 spec、plan 和 tasks；变更必须能回到需求、验收和任务。
- \`- [x]\` 只在源码、测试、构建或运行证据真实存在后使用，并在任务下记录最窄证据；文档存在本身不等于完成。
- 新事实影响上游时，先更新受影响的 PRD/总规格/Feature，再继续开发；不要另建任务数据库或让页面状态反写 docs。
- 评估可以从项目开发阶段使用，但评估结果不能自动勾选任务、更新基线或推进阶段。

## 开发收口

开发完成时更新以下固定候选产物：

1. \`fde-deliverables/03-project-development/implementation-report.md\`
2. \`fde-deliverables/03-project-development/runbook.md\`
3. \`fde-deliverables/03-project-development/development-baseline.md\`

三份文件分别记录实现范围与剩余项、安装运行和故障恢复、候选版本与测试/评估证据及已知风险。它们仍是候选阶段产物；你不能声称 FDE 已确认，不得改变项目阶段。是否进入验证评估只能由 FDE 在项目进度页决定。`,
} as const

/** Short stage-aware prompt; the complete Skill body remains on-demand. */
export function requirementResearchPrompt(stage: FdeStageId): string {
  if (stage !== 'requirements') return ''
  return '当前 FDE 项目处于“需求调研”。当用户要求梳理、收敛或更新需求材料时，先加载 Skill `fde-requirement-research`，并把产物更新到 `fde-deliverables/01-requirement-research/` 的三个固定文件。产物均为候选；你不能确认客户结论，也不能推进项目阶段。'
}

/** Short solution-aware prompt; the complete Skill body remains on-demand. */
export function solutionDesignPrompt(stage: FdeStageId): string {
  if (stage !== 'solution') return ''
  return '当前 FDE 项目处于“方案设计”。当用户要求设计、收敛或更新项目方案时，先加载 Skill `fde-solution-design`，更新 `fde-deliverables/02-solution-design/` 的五个固定文件（包含项目 PRD），并通过 architecture_get/architecture_set 维护项目级候选架构。所有产物均为候选；你不能确认架构、客户结论或推进项目阶段。'
}

/** Short development-aware prompt; the complete Skill body remains on-demand. */
export function projectDevelopmentPrompt(stage: FdeStageId): string {
  if (stage !== 'development') return ''
  return '当前 FDE 项目处于“项目开发”。当用户要求规划、拆分、实施或检查研发进度时，先加载 Skill `fde-project-development`，按项目 `docs/` 的 PRD、产品总规格、Feature Map 和逐 Feature spec/plan/tasks 原位维护，并用真实工程证据更新任务。开发收口产物固定在 `fde-deliverables/03-project-development/`。你不能虚构日期或证据，也不能推进项目阶段。'
}

/**
 * Open the project-stage domain and register the read/initialize route.
 * @param ctx - Host context carrying storage, Workspace registry, and WebServer.
 */
export async function apply(ctx: Context): Promise<void> {
  const domain = await ctx.storageDomain.open(fdeStageDomainSpec)
  const state = new FdeStageState(domain.table('projects'))
  ctx.effect(() => async () => { await domain.close() }, 'fde-stage: domain')
  ctx.skills.register(REQUIREMENT_RESEARCH_SKILL)
  ctx.skills.register(SOLUTION_DESIGN_SKILL)
  ctx.skills.register(PROJECT_DEVELOPMENT_SKILL)
  ctx.systemPrompt.section({
    name: 'fde:requirement-research',
    order: 90,
    text: (context) => {
      const cwd = context.agent?.session.header.cwd
      if (cwd === undefined) return ''
      const workspace = ctx.workspaceRegistry.list().find(item => item.path === cwd)
      if (workspace === undefined) return ''
      const stage = state.current(workspace.id)?.currentStage ?? 'requirements'
      return requirementResearchPrompt(stage) || solutionDesignPrompt(stage) || projectDevelopmentPrompt(stage)
    },
  })
  const handler = createStageRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    open: workspaceId => state.open(workspaceId),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_OPEN_PATH,
    handler,
  }), `fde-stage: ${FDE_STAGE_OPEN_PATH}`)
  const completeRequirements = createCompleteRequirementsRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    requirements: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      return await loadRequirementArtifacts(workspace.path)
    },
    complete: async (workspaceId, expectedRevision) => await state.completeRequirements(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_REQUIREMENTS_PATH,
    handler: completeRequirements,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_REQUIREMENTS_PATH}`)
  const completeSolution = createCompleteSolutionRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    solution: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const [artifacts, architecture] = await Promise.all([
        loadSolutionArtifacts(workspace.path),
        readProjectArchitecture(workspace.path),
      ])
      return { artifacts: artifacts.artifacts, architecture }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeSolution(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_SOLUTION_PATH,
    handler: completeSolution,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_SOLUTION_PATH}`)
  const completeDevelopment = createCompleteDevelopmentRoute({
    trusted: request => isTrustedApiRequest(request, []),
    workspaceExists: id => ctx.workspaceRegistry.get(WorkspaceId(id)) !== undefined,
    development: async (workspaceId) => {
      const workspace = ctx.workspaceRegistry.get(WorkspaceId(workspaceId))
      if (workspace === undefined) throw new Error('当前项目不存在或已被移除。')
      const snapshot = await loadDevelopmentDocs(workspace.path)
      return { artifacts: snapshot.closure.artifacts }
    },
    complete: async (workspaceId, expectedRevision) => await state.completeDevelopment(workspaceId, expectedRevision),
    reportFailure: (error) => { ctx.logger.warn(error instanceof Error ? error : new Error(String(error))) },
  })
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: FDE_STAGE_COMPLETE_DEVELOPMENT_PATH,
    handler: completeDevelopment,
  }), `fde-stage: ${FDE_STAGE_COMPLETE_DEVELOPMENT_PATH}`)
}

/** Model-facing content is limited to one short stage section and an on-demand Skill. */
export const modelExperience = 'stage prompt and skill'
