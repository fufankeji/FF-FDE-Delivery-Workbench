import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  createCompleteDevelopmentRoute,
  createCompleteHandoffRoute,
  createCompletePilotRoute,
  createCompleteRequirementsRoute,
  createCompleteSolutionRoute,
  createCompleteValidationRoute,
  createReturnStageRoute,
  createStageRoute,
} from '../src/http.ts'
import {
  ACCEPTANCE_HANDOVER_SKILL, acceptanceHandoverPrompt,
  DEPLOYMENT_TRIAL_SKILL, deploymentTrialPrompt,
  PROJECT_DEVELOPMENT_SKILL, projectDevelopmentPrompt,
  REQUIREMENT_RESEARCH_SKILL, requirementResearchPrompt,
  SOLUTION_DESIGN_SKILL, solutionDesignPrompt,
  VALIDATION_SKILL, validationPrompt,
} from '../src/index.ts'
import type { ProjectStageRecord } from '../src/spec.ts'
import { FdeStageState } from '../src/state.ts'

const wid = (value: string): WorkspaceId => value as WorkspaceId

function table() {
  const records = new Map<WorkspaceId, ProjectStageRecord>()
  const put = vi.fn(async (key: WorkspaceId, value: ProjectStageRecord) => { records.set(key, value) })
  return {
    records,
    put,
    value: {
      get: (key: WorkspaceId) => records.get(key),
      entries: () => records.entries(),
      keys: () => records.keys(),
      get size() { return records.size },
      put,
      delete: async (key: WorkspaceId) => records.delete(key),
      update: async (key: WorkspaceId, fn: (current: ProjectStageRecord) => ProjectStageRecord) => {
        const current = records.get(key)
        if (current === undefined) throw new Error('missing')
        const next = fn(current)
        records.set(key, next)
        return next
      },
    } satisfies KvTable<WorkspaceId, ProjectStageRecord>,
  }
}

function request(body: unknown, method = 'POST'): IncomingMessage {
  const bytes = Buffer.from(JSON.stringify(body))
  return {
    method,
    headers: { 'content-length': String(bytes.byteLength) },
    resume: vi.fn(),
    async *[Symbol.asyncIterator]() { yield bytes },
  } as unknown as IncomingMessage
}

function response() {
  let status = 0
  let body = ''
  return {
    value: {
      writeHead: (next: number) => { status = next },
      end: (next?: string | Uint8Array) => { body = next === undefined ? '' : String(next) },
    } as unknown as ServerResponse,
    snapshot: () => ({ status, body: JSON.parse(body) as unknown }),
  }
}

describe('FdeStageState', () => {
  it('initializes one requirements record and coalesces concurrent readers', async () => {
    const data = table()
    const state = new FdeStageState(data.value, () => '2026-08-26T00:00:00.000Z')
    const [first, second] = await Promise.all([state.open(wid('w-1')), state.open(wid('w-1'))])
    expect(first).toEqual({
      currentStage: 'requirements', revision: 1,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
    })
    expect(second).toBe(first)
    expect(data.put).toHaveBeenCalledTimes(1)
    await expect(state.open(wid('w-1'))).resolves.toBe(first)
  })

  it('completes requirements once for the exact revision', async () => {
    const data = table()
    const times = [
      '2026-08-26T00:00:00.000Z', '2026-08-27T00:00:00.000Z',
      '2026-08-28T00:00:00.000Z', '2026-08-29T00:00:00.000Z', '2026-08-30T00:00:00.000Z',
      '2026-08-31T00:00:00.000Z', '2026-09-01T00:00:00.000Z',
    ]
    const state = new FdeStageState(data.value, () => times.shift() ?? '2026-08-27T00:00:00.000Z')
    await state.open(wid('w-1'))
    const next = await state.completeRequirements(wid('w-1'), 1)
    expect(next).toEqual({
      currentStage: 'solution', revision: 2,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
    })
    await expect(state.completeRequirements(wid('w-1'), 1)).rejects.toThrow('已经变化')
    expect(state.current(wid('w-1'))).toBe(next)
    const development = await state.completeSolution(wid('w-1'), 2)
    expect(development).toEqual({
      currentStage: 'development', revision: 3,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-28T00:00:00.000Z',
    })
    await expect(state.completeSolution(wid('w-1'), 2)).rejects.toThrow('已经变化')
    const validation = await state.completeDevelopment(wid('w-1'), 3)
    expect(validation).toEqual({
      currentStage: 'validation', revision: 4,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-29T00:00:00.000Z',
    })
    await expect(state.completeDevelopment(wid('w-1'), 3)).rejects.toThrow('已经变化')
    const pilot = await state.completeValidation(wid('w-1'), 4)
    expect(pilot).toEqual({
      currentStage: 'pilot', revision: 5,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-30T00:00:00.000Z',
    })
    await expect(state.completeValidation(wid('w-1'), 4)).rejects.toThrow('已经变化')
    const handoff = await state.completePilot(wid('w-1'), 5)
    expect(handoff).toMatchObject({ currentStage: 'handoff', revision: 6 })
    const completed = await state.completeHandoff(wid('w-1'), 6)
    expect(completed).toMatchObject({ currentStage: 'completed', revision: 7 })
  })

  it('returns exactly one stage, preserves an audit, and requires the returned range to be reconfirmed', async () => {
    const data = table()
    const times = [
      '2026-08-26T00:00:00.000Z', '2026-08-27T00:00:00.000Z',
      '2026-08-28T00:00:00.000Z', '2026-08-29T00:00:00.000Z',
      '2026-08-30T00:00:00.000Z', '2026-08-31T00:00:00.000Z',
      '2026-09-01T00:00:00.000Z', '2026-09-02T00:00:00.000Z',
    ]
    const state = new FdeStageState(data.value, () => times.shift() ?? '2026-09-03T00:00:00.000Z')
    await state.open(wid('w-1'))
    await state.completeRequirements(wid('w-1'), 1)
    await state.completeSolution(wid('w-1'), 2)
    await state.completeDevelopment(wid('w-1'), 3)

    const returned = await state.returnToPrevious(wid('w-1'), 4, '客户补充了开发范围')
    expect(returned).toMatchObject({
      currentStage: 'development',
      revision: 5,
      reconfirmThrough: 'validation',
      returns: [{
        from: 'validation',
        to: 'development',
        reason: '客户补充了开发范围',
        returnedAt: '2026-08-30T00:00:00.000Z',
        revision: 5,
      }],
    })
    await expect(state.returnToPrevious(wid('w-1'), 4, '旧页面')).rejects.toThrow('已经变化')

    const validation = await state.completeDevelopment(wid('w-1'), 5)
    expect(validation).toMatchObject({ currentStage: 'validation', revision: 6, reconfirmThrough: 'validation' })
    const pilot = await state.completeValidation(wid('w-1'), 6)
    expect(pilot).toMatchObject({ currentStage: 'pilot', revision: 7, returns: returned.returns })
    expect(pilot).not.toHaveProperty('reconfirmThrough')
  })

  it('reopens a completed project to handoff and refuses to return before requirements', async () => {
    const data = table()
    const state = new FdeStageState(data.value, () => '2026-08-27T00:00:00.000Z')
    data.records.set(wid('completed'), {
      currentStage: 'completed', revision: 7,
      createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-26T00:00:00.000Z',
    })
    await expect(state.returnToPrevious(wid('completed'), 7, '补充移交记录')).resolves.toMatchObject({
      currentStage: 'handoff', revision: 8, reconfirmThrough: 'completed',
    })
    await state.open(wid('new'))
    await expect(state.returnToPrevious(wid('new'), 1, '返回')).rejects.toThrow('第一个阶段')
    await expect(state.returnToPrevious(wid('new'), 1, '   ')).rejects.toThrow('返回原因必须填写')
  })
})

describe('requirement-research model guidance', () => {
  it('keeps the long contract in an on-demand Skill and removes the short prompt after requirements', () => {
    expect(REQUIREMENT_RESEARCH_SKILL.name).toBe('fde-requirement-research')
    expect(REQUIREMENT_RESEARCH_SKILL.content).toContain('requirement-baseline.md')
    expect(REQUIREMENT_RESEARCH_SKILL.content).toContain('不得改变项目阶段')
    expect(requirementResearchPrompt('requirements')).toContain('先加载 Skill')
    expect(requirementResearchPrompt('solution')).toBe('')
  })

  it('keeps the solution contract in one on-demand Skill and only prompts during solution design', () => {
    expect(SOLUTION_DESIGN_SKILL.name).toBe('fde-solution-design')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('project-prd.md')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('solution-baseline.md')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('architecture_get')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('先取证，再建模')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('2–7 个职责分组')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('保留仍代表同一概念的现有 ID')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('关键运行时、数据流、控制流或依赖关系')
    expect(SOLUTION_DESIGN_SKILL.content).toContain('不得改变项目阶段')
    expect(solutionDesignPrompt('requirements')).toBe('')
    expect(solutionDesignPrompt('solution')).toContain('先加载 Skill')
    expect(solutionDesignPrompt('development')).toBe('')
  })

  it('uses one lightweight project-development Skill and only prompts during development', () => {
    expect(PROJECT_DEVELOPMENT_SKILL.name).toBe('fde-project-development')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('docs/specs/feature-map.md')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('FNNN-slug')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('implementation-report.md')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('结构性变更')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('architecture_get')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('architecture_set')
    expect(PROJECT_DEVELOPMENT_SKILL.content).toContain('不得改变项目阶段')
    expect(projectDevelopmentPrompt('solution')).toBe('')
    expect(projectDevelopmentPrompt('development')).toContain('生成或更新系统架构')
    expect(projectDevelopmentPrompt('development')).toContain('系统架构')
    expect(projectDevelopmentPrompt('validation')).toBe('')
  })

  it('uses one evidence-backed validation Skill and only prompts during validation', () => {
    expect(VALIDATION_SKILL.name).toBe('fde-validation')
    expect(VALIDATION_SKILL.content).toContain('.fde/evaluations/validation.json')
    expect(VALIDATION_SKILL.content).toContain('schemaVersion')
    expect(VALIDATION_SKILL.content).toContain('metrics[].sources')
    expect(VALIDATION_SKILL.content).toContain('评估方案准备')
    expect(VALIDATION_SKILL.content).toContain('validation-plan-approval.json')
    expect(VALIDATION_SKILL.content).toContain('validation-report.md')
    expect(VALIDATION_SKILL.content).toContain('`result.evidence` 必须是一个非空的项目相对路径字符串')
    expect(VALIDATION_SKILL.content).toContain('"waiverReason"')
    expect(VALIDATION_SKILL.content).toContain('不得代替 FDE 写入 waived')
    expect(VALIDATION_SKILL.content).toContain('不能使用 `accept_reason`')
    expect(VALIDATION_SKILL.content).toContain('不得编造指标值')
    expect(VALIDATION_SKILL.content).toContain('不能修改项目阶段')
    expect(validationPrompt('development')).toBe('')
    expect(validationPrompt('validation')).toContain('先加载 Skill')
    expect(validationPrompt('pilot')).toBe('')
  })

  it('keeps deployment trial and acceptance handover as stage-scoped Skills', () => {
    expect(DEPLOYMENT_TRIAL_SKILL.name).toBe('fde-deployment-trial')
    expect(DEPLOYMENT_TRIAL_SKILL.content).toContain('.fde/deployment-trial.json')
    expect(DEPLOYMENT_TRIAL_SKILL.content).toContain('不得代替 FDE 把问题标为 accepted')
    expect(DEPLOYMENT_TRIAL_SKILL.content).toContain('Agent 保持 false')
    expect(DEPLOYMENT_TRIAL_SKILL.content).toContain('ready 由同一个 FDE 项目进度确认动作写入')
    expect(deploymentTrialPrompt('pilot')).toContain('先加载 Skill')
    expect(deploymentTrialPrompt('handoff')).toBe('')
    expect(ACCEPTANCE_HANDOVER_SKILL.name).toBe('fde-acceptance-handover')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('.fde/acceptance-handover.json')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('.fde/deployment-trial.json')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('唯一事实源')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('最多 40 项项目相对 evidence 数组')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('交付物 available 保持 false')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('“记录验收与移交事实”和“完成项目”是两个独立动作')
    expect(ACCEPTANCE_HANDOVER_SKILL.content).toContain('不得虚构客户签字')
    expect(acceptanceHandoverPrompt('handoff')).toContain('先加载 Skill')
    expect(acceptanceHandoverPrompt('handoff')).toContain('只能由 FDE 在项目进度页记录')
    expect(acceptanceHandoverPrompt('completed')).toBe('')
  })
})

describe('project-stage route', () => {
  it('returns the exact Workspace stage and rejects unknown projects', async () => {
    const open = vi.fn(async () => ({
      currentStage: 'requirements' as const,
      revision: 1,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
    }))
    const handler = createStageRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      open,
    })
    const ok = response()
    await handler(request({ workspaceId: 'w-1' }), ok.value)
    expect(ok.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'requirements', revision: 1 } },
    })
    expect(open).toHaveBeenCalledWith('w-1')

    const missing = response()
    await handler(request({ workspaceId: 'missing' }), missing.value)
    expect(missing.snapshot()).toEqual({
      status: 404,
      body: { ok: false, error: { code: 'workspace-not-found', message: '当前项目不存在或已被移除。' } },
    })
  })

  it('accepts an explicit return reason and rejects unavailable or empty returns', async () => {
    const returnToPrevious = vi.fn(async () => ({
      currentStage: 'development' as const,
      revision: 5,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
      reconfirmThrough: 'validation' as const,
      returns: [{
        from: 'validation' as const, to: 'development' as const, reason: '范围变化',
        returnedAt: '2026-08-30T00:00:00.000Z', revision: 5,
      }],
    }))
    const handler = createReturnStageRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      returnToPrevious,
    })
    const invalid = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 4, reason: '  ' }), invalid.value)
    expect(invalid.snapshot()).toMatchObject({ status: 400, body: { error: { code: 'invalid-request' } } })
    expect(returnToPrevious).not.toHaveBeenCalled()

    const accepted = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 4, reason: ' 范围变化 ' }), accepted.value)
    expect(accepted.snapshot()).toMatchObject({
      status: 200,
      body: { value: { currentStage: 'development', revision: 5, reconfirmThrough: 'validation' } },
    })
    expect(returnToPrevious).toHaveBeenCalledWith('w-1', 4, '范围变化')
  })

  it('requires all fixed outputs before the FDE-only completion action', async () => {
    const complete = vi.fn(async () => ({
      currentStage: 'solution' as const,
      revision: 2,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-27T00:00:00.000Z',
    }))
    const requirements = vi.fn(async () => ({ artifacts: [
      { title: '需求调研报告', status: 'present' as const },
      { title: '需求确认清单', status: 'missing' as const },
      { title: '需求基线', status: 'present' as const },
    ] }))
    const handler = createCompleteRequirementsRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      requirements,
      complete,
    })
    const blocked = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 1 }), blocked.value)
    expect(blocked.snapshot()).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'stage-requirements-incomplete', message: '需求调研产物尚未齐备：需求确认清单。' } },
    })
    expect(complete).not.toHaveBeenCalled()

    requirements.mockResolvedValueOnce({ artifacts: [
      { title: '需求调研报告', status: 'present' },
      { title: '需求确认清单', status: 'present' },
      { title: '需求基线', status: 'present' },
    ] })
    const accepted = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 1 }), accepted.value)
    expect(accepted.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'solution', revision: 2 } },
    })
    expect(complete).toHaveBeenCalledWith('w-1', 1)
  })

  it('requires five solution documents and a confirmed architecture before project development', async () => {
    const complete = vi.fn(async () => ({
      currentStage: 'development' as const,
      revision: 3,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-28T00:00:00.000Z',
    }))
    const solution = vi.fn(async () => ({
      artifacts: [
        { title: '项目 PRD', status: 'missing' as const },
        { title: '方案设计', status: 'present' as const },
        { title: '研发计划', status: 'present' as const },
        { title: '验收方案', status: 'present' as const },
        { title: '方案基线', status: 'present' as const },
      ],
      architecture: { status: 'candidate' },
    }))
    const handler = createCompleteSolutionRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      solution,
      complete,
    })
    const missing = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 2 }), missing.value)
    expect(missing.snapshot()).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'stage-solution-incomplete', message: '方案设计产物尚未齐备：项目 PRD。' } },
    })
    expect(complete).not.toHaveBeenCalled()

    solution.mockResolvedValueOnce({
      artifacts: [
        { title: '项目 PRD', status: 'present' },
        { title: '方案设计', status: 'present' },
        { title: '研发计划', status: 'present' },
        { title: '验收方案', status: 'present' },
        { title: '方案基线', status: 'present' },
      ],
      architecture: { status: 'candidate' },
    })
    const candidate = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 2 }), candidate.value)
    expect(candidate.snapshot()).toMatchObject({
      status: 409,
      body: { ok: false, error: { code: 'stage-architecture-unconfirmed' } },
    })

    solution.mockResolvedValueOnce({
      artifacts: [
        { title: '项目 PRD', status: 'present' },
        { title: '方案设计', status: 'present' },
        { title: '研发计划', status: 'present' },
        { title: '验收方案', status: 'present' },
        { title: '方案基线', status: 'present' },
      ],
      architecture: { status: 'confirmed' },
    })
    const accepted = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 2 }), accepted.value)
    expect(accepted.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'development', revision: 3 } },
    })
    expect(complete).toHaveBeenCalledWith('w-1', 2)
  })

  it('requires the three project-development close-out files before validation', async () => {
    const complete = vi.fn(async () => ({
      currentStage: 'validation' as const,
      revision: 4,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-29T00:00:00.000Z',
    }))
    const development = vi.fn(async () => ({ artifacts: [
      { title: '实施报告', status: 'present' as const },
      { title: '运行手册', status: 'missing' as const },
      { title: '研发基线', status: 'present' as const },
    ] }))
    const handler = createCompleteDevelopmentRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      development,
      complete,
    })
    const blocked = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 3 }), blocked.value)
    expect(blocked.snapshot()).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'stage-development-incomplete', message: '项目开发收口产物尚未齐备：运行手册。' } },
    })
    expect(complete).not.toHaveBeenCalled()

    development.mockResolvedValueOnce({ artifacts: [
      { title: '实施报告', status: 'present' },
      { title: '运行手册', status: 'present' },
      { title: '研发基线', status: 'present' },
    ] })
    const accepted = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 3 }), accepted.value)
    expect(accepted.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'validation', revision: 4 } },
    })
    expect(complete).toHaveBeenCalledWith('w-1', 3)
  })

  it('requires complete validation evidence before the FDE enters pilot deployment', async () => {
    const complete = vi.fn(async () => ({
      currentStage: 'pilot' as const,
      revision: 5,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-30T00:00:00.000Z',
    }))
    const validation = vi.fn(async () => ({ gateReady: false, blockers: ['必需指标“前端冒烟”尚未运行。'] }))
    const handler = createCompleteValidationRoute({
      trusted: () => true,
      workspaceExists: id => id === 'w-1',
      validation,
      complete,
    })
    const blocked = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 4 }), blocked.value)
    expect(blocked.snapshot()).toEqual({
      status: 409,
      body: { ok: false, error: { code: 'stage-validation-incomplete', message: '验证评估尚未达到进入部署试运行的条件：必需指标“前端冒烟”尚未运行。' } },
    })
    expect(complete).not.toHaveBeenCalled()

    validation.mockResolvedValueOnce({ gateReady: true, blockers: [] })
    const accepted = response()
    await handler(request({ workspaceId: 'w-1', expectedRevision: 4 }), accepted.value)
    expect(accepted.snapshot()).toMatchObject({
      status: 200,
      body: { ok: true, value: { workspaceId: 'w-1', currentStage: 'pilot', revision: 5 } },
    })
    expect(complete).toHaveBeenCalledWith('w-1', 4)
  })

  it('requires Host-ready deployment and handover facts for the final two manual gates', async () => {
    const completePilot = vi.fn(async () => ({
      currentStage: 'handoff' as const, revision: 6,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z',
    }))
    const deploymentTrial = vi.fn(async () => ({ gateReady: false, blockers: ['回滚演练证据尚不可用。'] }))
    const pilotHandler = createCompletePilotRoute({
      trusted: () => true, workspaceExists: id => id === 'w-1', deploymentTrial, complete: completePilot,
    })
    const blockedPilot = response()
    await pilotHandler(request({ workspaceId: 'w-1', expectedRevision: 5 }), blockedPilot.value)
    expect(blockedPilot.snapshot()).toMatchObject({ status: 409, body: { error: { code: 'stage-pilot-incomplete' } } })
    deploymentTrial.mockResolvedValueOnce({ gateReady: true, blockers: [] })
    const acceptedPilot = response()
    await pilotHandler(request({ workspaceId: 'w-1', expectedRevision: 5 }), acceptedPilot.value)
    expect(acceptedPilot.snapshot()).toMatchObject({ status: 200, body: { value: { currentStage: 'handoff', revision: 6 } } })

    const completeHandoff = vi.fn(async () => ({
      currentStage: 'completed' as const, revision: 7,
      createdAt: '2026-08-26T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    }))
    const acceptanceHandover = vi.fn(async () => ({ gateReady: true, blockers: [] }))
    const handoffHandler = createCompleteHandoffRoute({
      trusted: () => true, workspaceExists: id => id === 'w-1', acceptanceHandover, complete: completeHandoff,
    })
    const acceptedHandoff = response()
    await handoffHandler(request({ workspaceId: 'w-1', expectedRevision: 6 }), acceptedHandoff.value)
    expect(acceptedHandoff.snapshot()).toMatchObject({ status: 200, body: { value: { currentStage: 'completed', revision: 7 } } })
  })

  it('rejects untrusted and non-POST requests before persistence', async () => {
    const open = vi.fn()
    const forbidden = createStageRoute({ trusted: () => false, workspaceExists: () => true, open })
    const denied = response()
    await forbidden(request({ workspaceId: 'w-1' }), denied.value)
    expect(denied.snapshot()).toMatchObject({ status: 403 })

    const handler = createStageRoute({ trusted: () => true, workspaceExists: () => true, open })
    const method = response()
    await handler(request({}, 'GET'), method.value)
    expect(method.snapshot()).toMatchObject({ status: 405 })
    expect(open).not.toHaveBeenCalled()
  })
})
