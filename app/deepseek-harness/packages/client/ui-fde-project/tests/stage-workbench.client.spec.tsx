// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ProjectStageWorkbenchHero } from '../src/client/StageWorkbench.tsx'

afterEach(cleanup)

const hook = <T,>(snapshot: T) => <S,>(selector: (state: T) => S): S => selector(snapshot)

function props(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-1',
    workspace: { workspaceId: 'workspace-1', title: '企业知识库搭建', path: '/isolated/project' },
    defaultContent: <div>官方首页</div>,
    useStageProgress: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          value: {
            workspaceId: 'workspace-1', currentStage: 'requirements', revision: 1,
            createdAt: '', updatedAt: '',
          },
        },
      },
    }),
    useProjectSurfaces: hook({ byWorkspace: {} }),
    useProjectSources: hook({
      byWorkspace: {
        'workspace-1': {
          status: 'ready',
          files: [{
            sourceId: 'source-1', originalName: '客户访谈纪要.docx', storedName: '客户访谈纪要.docx',
            relativePath: 'fde-resources/客户访谈纪要.docx', extension: 'docx', bytes: 100, mtimeMs: 1,
            mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            parse: { status: 'ready', parser: 'test', parserVersion: '1' },
          }],
        },
      },
    }),
    loadStage: vi.fn(),
    loadProjectSurface: vi.fn(),
    loadProjectSources: vi.fn(),
    runDiscoveryAction: vi.fn(async () => {}),
    openProjectConversation: vi.fn(),
    openProjectPage: vi.fn(),
    t: vi.fn(),
    ...overrides,
  } as unknown as ComponentProps<typeof ProjectStageWorkbenchHero>
}

describe('ProjectStageWorkbenchHero', () => {
  it('keeps the official hero outside a registered project', () => {
    render(<ProjectStageWorkbenchHero {...props({ sessionId: undefined, workspace: undefined })} />)
    expect(screen.getByText('官方首页')).toBeTruthy()
  })

  it('shows stage-one purpose, evidence gaps, inputs, artifacts and an Agent action', () => {
    const input = props()
    render(<ProjectStageWorkbenchHero {...input} />)

    expect(screen.getByText('哪个真实工作流问题值得继续解决？')).toBeTruthy()
    expect(screen.getByText('客户访谈纪要.docx')).toBeTruthy()
    expect(screen.getByText('真实流程知情者')).toBeTruthy()
    expect(screen.getByText('待访谈')).toBeTruthy()
    expect(screen.getByText('现场观察记录')).toBeTruthy()
    expect(screen.getByText('现在还不能进入下一阶段')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '判断工作流价值' }))
    expect(input.runDiscoveryAction).toHaveBeenCalledWith('session-1', 'qualify-workflow')
  })
})
