// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BetterSidebarService } from 'dsh-better-sidebar'
import {
  projectRuntimeTerminalRecoveryPrompt,
  showProjectRuntimeTerminal,
} from '../src/client/project-runtime-sidebar.ts'

afterEach(() => { vi.useRealTimers() })

interface TestTab { readonly id: string; readonly type: string; readonly title: string }

function serviceFor(initialTabs: readonly TestTab[]) {
  let tabs = [...initialTabs]
  const listeners = new Set<() => void>()
  const openTab = vi.fn()
  const activateTab = vi.fn()
  const service = {
    getSnapshot: () => ({
      sessionId: 'session-1',
      prefs: {},
      state: {
        splits: { kind: 'leaf', tabs },
        bottomSplits: { kind: 'leaf', tabs: [] },
        floats: [],
      },
    }),
    openTab,
    activateTab,
    subscribeState: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  } as unknown as BetterSidebarService
  return {
    service,
    openTab,
    activateTab,
    replaceTabs(next: readonly TestTab[]) {
      tabs = [...next]
      for (const listener of listeners) listener()
    },
  }
}

describe('project runtime terminal navigation', () => {
  it('opens an already-visible same-title terminal before an unrelated Agent terminal', async () => {
    const fixture = serviceFor([
      { id: 'agent:other', type: 'terminal', title: '其他任务' },
      { id: 'terminal:visible', type: 'terminal', title: '项目运行' },
    ])

    await expect(showProjectRuntimeTerminal(fixture.service, 'session-1', '/project/one')).resolves.toBe(true)
    expect(fixture.activateTab).toHaveBeenCalledWith(
      'terminal:visible',
      { sessionId: 'session-1', cwd: '/project/one' },
    )
  })

  it('waits for the current Session Agent terminal push before activating it', async () => {
    const fixture = serviceFor([])
    const shown = showProjectRuntimeTerminal(fixture.service, 'session-1', '/project/one', '项目运行', 1_000)
    fixture.replaceTabs([{ id: 'agent:run-1', type: 'terminal', title: '项目运行' }])

    await expect(shown).resolves.toBe(true)
    expect(fixture.activateTab).toHaveBeenCalledWith(
      'agent:run-1',
      { sessionId: 'session-1', cwd: '/project/one' },
    )
  })

  it('returns a recoverable miss when the old Host no longer owns the terminal', async () => {
    vi.useFakeTimers()
    const fixture = serviceFor([])
    const shown = showProjectRuntimeTerminal(fixture.service, 'session-1', '/project/one', '项目运行', 1_000)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(shown).resolves.toBe(false)
    expect(fixture.activateTab).not.toHaveBeenCalled()
  })

  it('keeps the recovery prompt observational and explicit about lost output', () => {
    const prompt = projectRuntimeTerminalRecoveryPrompt('http://127.0.0.1:5173/')
    expect(prompt).toContain('terminal_list')
    expect(prompt).toContain('只调用一次 terminal_create')
    expect(prompt).toContain('不要重复启动、停止或修改服务')
    expect(prompt).toContain('不要调用 project_runtime_report')
    expect(prompt).toContain('旧 Host 中的终端输出无法恢复')
  })
})
