import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  createCompleteDevelopmentRoute, createCompleteRequirementsRoute, createCompleteSolutionRoute, createStageRoute,
} from '../src/http.ts'
import {
  PROJECT_DEVELOPMENT_SKILL, projectDevelopmentPrompt,
  REQUIREMENT_RESEARCH_SKILL, requirementResearchPrompt,
  SOLUTION_DESIGN_SKILL, solutionDesignPrompt,
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
      '2026-08-28T00:00:00.000Z', '2026-08-29T00:00:00.000Z',
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
