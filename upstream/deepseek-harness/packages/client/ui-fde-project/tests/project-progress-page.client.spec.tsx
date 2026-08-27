// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { ProjectProgressOverlay } from '../src/client/ProjectProgressOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ProjectProgressOverlayProps } from '../src/client/slots.ts'

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe(): void {}
    disconnect(): void {}
  })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.body.dataset.fdePage })

const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)

describe('ProjectProgressOverlay standalone page', () => {
  it('hides the center/details work surfaces while open and restores them on close', () => {
    const frame = document.createElement('div')
    const sidebar = document.createElement('div')
    const center = document.createElement('div')
    const details = document.createElement('div')
    const overlay = document.createElement('div')
    frame.append(sidebar, center, details, overlay)
    document.body.append(frame)
    const props = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {} }),
      useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [] }),
      useSessions: hook({ byId: {} }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps
    const view = render(<ProjectProgressOverlay {...props} />, { container: overlay })
    expect(document.body.dataset.fdePage).toBe('project-progress')
    expect(center.style.visibility).toBe('hidden')
    expect(details.style.visibility).toBe('hidden')
    expect(center.getAttribute('aria-hidden')).toBe('true')
    view.unmount()
    expect(document.body.dataset.fdePage).toBeUndefined()
    expect(center.style.visibility).toBe('')
    expect(details.style.visibility).toBe('')
    frame.remove()
  })

  it('compares projects by their real six-stage position before entering a project', () => {
    const showProjectDetail = vi.fn()
    const props = {
      useProjectPage: hook({ open: true, view: 'overview' as const }),
      useStageProgress: hook({ byWorkspace: {
        'workspace-1': { status: 'ready', value: {
          workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        } },
        'workspace-2': { status: 'ready', value: {
          workspaceId: 'workspace-2', currentStage: 'development', revision: 3,
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:02:00.000Z',
        } },
      } }),
      useProjectSurfaces: hook({ byWorkspace: {} }),
      useProjectSources: hook({ byWorkspace: {} }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [
        {
          workspaceId: 'workspace-1', title: '客户需求梳理', path: '/project/one', sessionIds: ['session-1'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        },
        {
          workspaceId: 'workspace-2', title: '数据分析项目', path: '/project/two', sessionIds: ['session-2'],
          createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
        },
      ] }),
      useSessions: hook({ byId: {
        'session-1': { id: 'session-1', displayTitle: '需求会话', running: false, blank: false, updatedAt: 1 },
        'session-2': { id: 'session-2', displayTitle: '研发会话', running: true, blank: false, updatedAt: 2 },
      } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail, renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByText('工作台焦点')).toBeTruthy()
    expect(screen.getByText('需要关注')).toBeTruthy()
    expect(screen.getByText('交付节点')).toBeTruthy()
    expect(screen.getByText('最近会话')).toBeTruthy()
    expect(screen.getByText('研发会话')).toBeTruthy()
    expect(screen.getByText('六阶段项目分布')).toBeTruthy()
    expect(screen.getByText('阶段 1/6 · 需求调研')).toBeTruthy()
    expect(screen.getByText('阶段 3/6 · 项目开发')).toBeTruthy()
    expect(screen.getAllByRole('list', { name: '项目六阶段位置' })).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: '筛选阶段 3：项目开发，1 个项目' }))
    expect(screen.queryByRole('heading', { name: '客户需求梳理' })).toBeNull()
    expect(screen.getByRole('heading', { name: '数据分析项目' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /全部项目/ }))
    const projectButtons = screen.getAllByRole('button', { name: /查看项目/ })
    fireEvent.click(projectButtons[1] as HTMLElement)
    expect(showProjectDetail).toHaveBeenCalledWith('workspace-2')
  })

  it('separates stage inputs and outputs and requires the FDE second confirmation', async () => {
    const completeRequirements = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>阶段产出正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: null, evaluation: { casesCount: 0, reports: [] },
        requirements: {
          root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3,
          artifacts: [
            { id: 'research-report', title: '需求调研报告', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md', status: 'present', bytes: 120, fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=research-report' },
            { id: 'confirmation-checklist', title: '需求确认清单', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', status: 'present', fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=confirmation-checklist' },
            { id: 'requirement-baseline', title: '需求基线', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md', status: 'present', fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=requirement-baseline' },
          ],
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements, completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByRole('button', { name: /阶段输入/ })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('需求调研报告')).toBeTruthy()
    expect(screen.getByText('待 FDE 确认')).toBeTruthy()
    expect(screen.getByText('选择一份“已有文件”查看只读内容。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览需求调研报告' }))
    expect(screen.getByText('阶段产出正文')).toBeTruthy()
    expect(renderSlot).toHaveBeenLastCalledWith('fde.project.source.preview', {
      source: {
        fileUrl: '/api/fde-project/requirements/artifact?workspaceId=workspace-1&artifactId=research-report',
        name: 'requirement-research-report.md',
        bytes: 120,
        previewKind: 'text',
      },
    })
    fireEvent.click(screen.getByRole('button', { name: '完成需求调研' }))
    expect(screen.getByText('我已核对客户原始资料、需求调研报告、确认清单、需求基线和仍保留的未决事项。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入方案设计' }))
    await waitFor(() => { expect(completeRequirements).toHaveBeenCalledWith('workspace-1', 1) })
  })

  it('shows five solution documents and the confirmed architecture before the FDE enters development', async () => {
    const completeSolution = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>方案设计正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'solution', revision: 2,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:01:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: {
          version: 1, revision: 1, title: '数据分析系统架构', status: 'confirmed',
          updatedAt: '2026-08-27T00:00:00.000Z', groups: [], nodes: [], edges: [],
        },
        evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: {
          root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 5,
          artifacts: [
            { id: 'project-prd', title: '项目 PRD', path: 'fde-deliverables/02-solution-design/project-prd.md', status: 'present', bytes: 320, fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=project-prd' },
            { id: 'solution-design', title: '方案设计', path: 'fde-deliverables/02-solution-design/solution-design.md', status: 'present', bytes: 240, fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=solution-design' },
            { id: 'development-plan', title: '研发计划', path: 'fde-deliverables/02-solution-design/development-plan.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=development-plan' },
            { id: 'acceptance-plan', title: '验收方案', path: 'fde-deliverables/02-solution-design/acceptance-plan.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=acceptance-plan' },
            { id: 'solution-baseline', title: '方案基线', path: 'fde-deliverables/02-solution-design/solution-baseline.md', status: 'present', fileUrl: '/api/fde-project/solution/artifact?workspaceId=workspace-1&artifactId=solution-baseline' },
          ],
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('方案设计阶段产出')).toBeTruthy()
    expect(screen.getByText('项目 PRD')).toBeTruthy()
    expect(screen.getByText('研发计划')).toBeTruthy()
    expect(screen.getByText('验收方案')).toBeTruthy()
    expect(screen.getByText('方案基线')).toBeTruthy()
    expect(screen.getByText('系统架构')).toBeTruthy()
    expect(screen.getByText('已确认 R1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览项目 PRD' }))
    expect(screen.getByText('方案设计正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成方案设计' }))
    expect(screen.getByText(/我已核对项目 PRD 等五份方案文档/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入项目开发' }))
    await waitFor(() => { expect(completeSolution).toHaveBeenCalledWith('workspace-1', 2) })
  })

  it('shows docs-based development progress and keeps validation behind FDE confirmation', async () => {
    const completeDevelopment = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>研发文档正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'development', revision: 3,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:02:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: null, evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 5, artifacts: [] },
        development: {
          root: 'docs', issues: [],
          core: { requiredCount: 3, presentCount: 3, artifacts: [
            { id: 'core-prd', title: '项目 PRD', path: 'docs/PRD.md', kind: 'core', status: 'present', bytes: 120, fileUrl: '/api/fde-project/development/artifact?workspaceId=workspace-1&artifactId=core-prd' },
            { id: 'core-product-spec', title: '产品总规格', path: 'docs/specs/product-spec.md', kind: 'core', status: 'present' },
            { id: 'core-feature-map', title: 'Feature Map', path: 'docs/specs/feature-map.md', kind: 'core', status: 'present' },
          ] },
          features: [
            {
              id: 'F001', title: '数据接入', directory: 'docs/specs/F001-source-ingestion', status: 'in-progress',
              plannedStart: '2026-08-27', plannedEnd: '待确认', milestone: '完成数据源接入',
              taskTotal: 3, taskCompleted: 2,
              artifacts: [
                { id: 'feature-F001-spec', title: 'Feature Spec', path: 'docs/specs/F001-source-ingestion/spec.md', kind: 'feature', status: 'present' },
                { id: 'feature-F001-plan', title: '实施计划', path: 'docs/specs/F001-source-ingestion/plan.md', kind: 'feature', status: 'present' },
                { id: 'feature-F001-tasks', title: '任务清单', path: 'docs/specs/F001-source-ingestion/tasks.md', kind: 'feature', status: 'present' },
              ],
            },
            {
              id: 'F002', title: '模型评估', directory: 'docs/specs/F002-evaluation', status: 'unknown',
              taskTotal: 0, taskCompleted: 0, artifacts: [],
            },
          ],
          closure: { root: 'fde-deliverables/03-project-development', requiredCount: 3, presentCount: 3, artifacts: [
            { id: 'closure-implementation-report', title: '实施报告', path: 'fde-deliverables/03-project-development/implementation-report.md', kind: 'closure', status: 'present' },
            { id: 'closure-runbook', title: '运行手册', path: 'fde-deliverables/03-project-development/runbook.md', kind: 'closure', status: 'present' },
            { id: 'closure-development-baseline', title: '研发基线', path: 'fde-deliverables/03-project-development/development-baseline.md', kind: 'closure', status: 'present' },
          ] },
        },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    expect(screen.getByRole('region', { name: '项目交付数据总览' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '研发证据图谱' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看阶段 3：项目开发' }).getAttribute('aria-current')).toBe('step')
    expect(screen.getByRole('button', { name: '查看阶段 1：需求调研' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '查看阶段 6：验收移交' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('Feature 研发进度')).toBeTruthy()
    expect(screen.getByText('F001')).toBeTruthy()
    expect(screen.getByText('数据接入')).toBeTruthy()
    expect(screen.getByLabelText('任务证据 2/3')).toBeTruthy()
    expect(screen.getByText('暂无任务证据')).toBeTruthy()
    expect(screen.getByText('状态待确认')).toBeTruthy()
    expect(screen.getByText('项目开发收口产物')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览项目 PRD' }))
    expect(screen.getByRole('dialog', { name: '预览项目 PRD' })).toBeTruthy()
    expect(screen.getByText('研发文档正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog', { name: '预览项目 PRD' })).toBeNull()
    expect(screen.getByRole('button', { name: '查看阶段 3：项目开发' }).getAttribute('aria-current')).toBe('step')
    fireEvent.click(screen.getByRole('button', { name: '查看阶段 4：验证评估' }))
    expect(screen.getByRole('region', { name: '验证证据矩阵' })).toBeTruthy()
    expect(screen.getAllByText('尚未开始').length).toBeGreaterThan(0)
    expect(screen.getByText('项目当前处于 项目开发')).toBeTruthy()
    expect(completeDevelopment).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '查看阶段 3：项目开发' }))
    fireEvent.click(screen.getByRole('button', { name: '完成项目开发' }))
    expect(screen.getByText(/我已核对实施报告、运行手册、研发基线/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入验证评估' }))
    await waitFor(() => { expect(completeDevelopment).toHaveBeenCalledWith('workspace-1', 3) })
  })

  it('shows validation inputs, evidence, outputs, and keeps pilot behind FDE confirmation', async () => {
    const completeValidation = vi.fn(async () => {})
    const waiveValidationIssue = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>验证报告正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'validation', revision: 4,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:03:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' }, architecture: null,
        evaluation: { casesCount: 1, reports: [] },
        validation: {
          contract: {
            status: 'ready', path: '.fde/evaluations/validation.json', digest: `sha256:${'1'.repeat(64)}`, candidateId: 'R1', environment: '本地验收环境',
            datasets: [{ id: 'core-cases', name: '核心业务用例', version: '1.0' }],
            metrics: [{
              id: 'runtime-smoke', name: '核心流程冒烟', category: 'functional', method: '启动并访问核心页面', threshold: '全部通过',
              sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['BA-1'], available: true }],
              required: true, status: 'PASS', value: '通过', evidence: '.fde/evaluations/reports/r1/smoke.md', evidenceAvailable: true,
            }],
            issues: [{
              id: 'model-window', title: '复购模型测试窗口尚未确定', severity: 'medium', status: 'open',
              evidenceAvailable: false, resolution: '增长团队确认时间窗口、正负样本定义和泄漏边界后再执行模型验收。',
            }],
          },
          artifacts: { root: 'fde-deliverables/04-validation', requiredCount: 3, presentCount: 3, items: [
            { id: 'validation-plan', title: '验证计划', path: 'fde-deliverables/04-validation/validation-plan.md', status: 'present', fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-plan' },
            { id: 'validation-report', title: '验证报告', path: 'fde-deliverables/04-validation/validation-report.md', status: 'present', bytes: 220, fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-report' },
            { id: 'validation-baseline', title: '验证基线', path: 'fde-deliverables/04-validation/validation-baseline.md', status: 'present', fileUrl: '/api/fde-project/validation/artifact?workspaceId=workspace-1&artifactId=validation-baseline' },
          ] },
          planReady: true, planBlockers: [], planApproval: { status: 'confirmed', contractDigest: `sha256:${'1'.repeat(64)}` },
          requiredMetricCount: 1, satisfiedMetricCount: 1, gateReady: true, blockers: [],
        },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface: vi.fn(),
      completeRequirements: vi.fn(), completeSolution: vi.fn(), completeDevelopment: vi.fn(), completeValidation, waiveValidationIssue,
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('评估方案、执行与产物')).toBeTruthy()
    expect(screen.getByText('R1')).toBeTruthy()
    expect(screen.getByText('核心业务用例')).toBeTruthy()
    expect(screen.getByText('核心流程冒烟')).toBeTruthy()
    expect(screen.getByText('BA-1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '人工确认关闭' }))
    expect(screen.getByText(/不会把未通过、未执行或缺少证据的指标改成通过/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认接受并关闭' }))
    expect(screen.getByText('请填写本次人工接受的原因、范围或后续处理约定。')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '接受理由' }), {
      target: { value: '客户确认当前模型窗口不阻塞本轮交付，下一轮补充专项验证。' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认接受并关闭' }))
    await waitFor(() => {
      expect(waiveValidationIssue).toHaveBeenCalledWith(
        'workspace-1', `sha256:${'1'.repeat(64)}`, 'model-window',
        '客户确认当前模型窗口不阻塞本轮交付，下一轮补充专项验证。',
      )
    })
    fireEvent.click(screen.getByRole('button', { name: '预览验证报告' }))
    expect(screen.getByText('验证报告正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成验证评估' }))
    expect(screen.getByText(/我已核对候选版本、环境和数据版本/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入部署试运行' }))
    await waitFor(() => { expect(completeValidation).toHaveBeenCalledWith('workspace-1', 4) })
  })

  it('refreshes the project snapshot and guides a candidate architecture to the full review view', async () => {
    const refreshProjectSurface = vi.fn()
    const reviewProjectArchitecture = vi.fn(async () => {})
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'solution', revision: 2,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:01:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目',
        runtime: { schemaVersion: 1, revision: 0, status: 'stopped', updatedAt: '1970-01-01T00:00:00.000Z' },
        apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: {
          version: 1, revision: 2, title: '数据分析系统架构', status: 'candidate',
          updatedAt: '2026-08-27T00:02:00.000Z', groups: [], nodes: [], edges: [],
        },
        evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: { root: 'fde-deliverables/02-solution-design', requiredCount: 5, presentCount: 0, artifacts: [] },
      } } } }),
      useProjectSources: hook({ byWorkspace: { 'workspace-1': { status: 'ready', files: [] } } }),
      useRequirementWiki: hook({ byWorkspace: {} }),
      useWorkspaces: hook({ items: [{
        workspaceId: 'workspace-1', title: '数据分析项目', path: '/project/one', sessionIds: ['session-1'],
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:00:00.000Z',
      }] }),
      useSessions: hook({ byId: { 'session-1': { id: 'session-1', displayTitle: '会话', running: false, blank: false, updatedAt: 1 } } }),
      loadStage: vi.fn(), retryStage: vi.fn(), loadProjectSurface: vi.fn(), refreshProjectSurface,
      completeRequirements: vi.fn(), completeSolution: vi.fn(),
      loadProjectSources: vi.fn(), parseProjectSource: vi.fn(), loadRequirementWiki: vi.fn(),
      prepareRequirementWikiRun: vi.fn(), startRequirementWikiBuild: vi.fn(), abandonRequirementWikiBuild: vi.fn(),
      enterProject: vi.fn(), reviewProjectArchitecture, closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot: vi.fn(() => null),
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    await waitFor(() => { expect(refreshProjectSurface).toHaveBeenCalledWith('workspace-1') })
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    fireEvent.click(screen.getByRole('button', { name: '去确认架构：数据分析系统架构 R2' }))
    await waitFor(() => { expect(reviewProjectArchitecture).toHaveBeenCalledWith('workspace-1') })
    expect(screen.queryByText('待 FDE 确认 R2')).toBeNull()
  })
})
