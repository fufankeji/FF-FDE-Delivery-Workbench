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
      enterProject: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
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
        workspaceId: 'workspace-1', title: '数据分析项目', apiDocs: { status: 'unconfigured', message: '未配置' },
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
      enterProject: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
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

  it('shows four solution documents and the confirmed architecture before the FDE enters development', async () => {
    const completeSolution = vi.fn(async () => {})
    const renderSlot = vi.fn(() => <div>方案设计正文</div>)
    const props = {
      useProjectPage: hook({ open: true, view: 'project' as const, workspaceId: 'workspace-1' }),
      useStageProgress: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', currentStage: 'solution', revision: 2,
        createdAt: '2026-08-27T00:00:00.000Z', updatedAt: '2026-08-27T00:01:00.000Z',
      } } } }),
      useProjectSurfaces: hook({ byWorkspace: { 'workspace-1': { status: 'ready', value: {
        workspaceId: 'workspace-1', title: '数据分析项目', apiDocs: { status: 'unconfigured', message: '未配置' },
        architecture: {
          version: 1, revision: 1, title: '数据分析系统架构', status: 'confirmed',
          updatedAt: '2026-08-27T00:00:00.000Z', groups: [], nodes: [], edges: [],
        },
        evaluation: { casesCount: 0, reports: [] },
        requirements: { root: 'fde-deliverables/01-requirement-research', requiredCount: 3, presentCount: 3, artifacts: [] },
        solution: {
          root: 'fde-deliverables/02-solution-design', requiredCount: 4, presentCount: 4,
          artifacts: [
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
      enterProject: vi.fn(), closeProjectPage: vi.fn(), showProjectOverview: vi.fn(),
      showProjectTimeline: vi.fn(), showProjectDetail: vi.fn(), renderSlot,
      t: makeTranslate(zh),
    } as unknown as ProjectProgressOverlayProps

    render(<ProjectProgressOverlay {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /阶段产出/ }))
    expect(screen.getByText('方案设计阶段产出')).toBeTruthy()
    expect(screen.getByText('研发计划')).toBeTruthy()
    expect(screen.getByText('验收方案')).toBeTruthy()
    expect(screen.getByText('方案基线')).toBeTruthy()
    expect(screen.getByText('系统架构')).toBeTruthy()
    expect(screen.getByText('已确认 R1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '预览方案设计' }))
    expect(screen.getByText('方案设计正文')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完成方案设计' }))
    expect(screen.getByText(/我已核对四份方案文档/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '确认并进入项目开发' }))
    await waitFor(() => { expect(completeSolution).toHaveBeenCalledWith('workspace-1', 2) })
  })
})
