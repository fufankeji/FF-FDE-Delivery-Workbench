/** Better Sidebar integration for visible project terminals and embedded previews. */

import type { BetterSidebarService } from 'dsh-better-sidebar'

interface SettingsWireSuccess {
  readonly ok: true
  readonly value: { readonly value?: unknown; readonly revision?: number }
}

interface SettingsWireFailure {
  readonly ok?: false
  readonly error?: { readonly message?: string }
}

function commaValues(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

/** Exact host:port authority admitted for one verified local preview URL. */
export function projectPreviewAuthority(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('项目预览只支持 HTTP(S)。')
  const port = url.port || (url.protocol === 'https:' ? '443' : '80')
  return `${url.hostname}:${port}`
}

function prefsReady(service: BetterSidebarService, authority?: string): boolean {
  const prefs = service.getSnapshot().prefs
  return prefs.agentTerminalTools
    && prefs.tabsEnabled.terminal !== false
    && prefs.tabsEnabled.browser !== false
    && (authority === undefined || commaValues(prefs.browserAllowedLoopback).includes(authority))
}

async function waitForPrefs(service: BetterSidebarService, authority?: string): Promise<void> {
  if (prefsReady(service, authority)) return
  await new Promise<void>((resolve, reject) => {
    let dispose = (): void => {}
    const timeout = window.setTimeout(() => {
      dispose()
      reject(new Error('右侧终端与项目预览配置尚未生效，请重试。'))
    }, 3_000)
    dispose = service.subscribeState(() => {
      if (!prefsReady(service, authority)) return
      window.clearTimeout(timeout)
      dispose()
      resolve()
    })
  })
}

/** Persist and adopt only the Sidebar capabilities required by an explicit project run. */
export async function ensureProjectRuntimeSidebar(
  service: BetterSidebarService,
  authority?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (prefsReady(service, authority)) return
  const prefs = service.getSnapshot().prefs
  const allowlist = new Set(commaValues(prefs.browserAllowedLoopback))
  if (authority !== undefined) allowlist.add(authority)
  const response = await fetchImpl('/sidebar/api/settings.update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      patch: {
        agentTerminalTools: true,
        browserAllowedLoopback: [...allowlist].join(', '),
        tabsEnabled: { ...prefs.tabsEnabled, terminal: true, browser: true },
      },
    }),
  })
  const payload = await response.json().catch(() => null) as SettingsWireSuccess | SettingsWireFailure | null
  if (!response.ok || payload === null || payload.ok !== true) {
    const message = payload !== null && 'error' in payload ? payload.error?.message : undefined
    throw new Error(message ?? '无法启用右侧终端与项目预览。')
  }
  await waitForPrefs(service, authority)
}

/** Expand the current Session's right panel with its project files. */
export function revealProjectSidebar(
  service: BetterSidebarService,
  sessionId: string,
  workspacePath: string,
): void {
  service.openTab({ type: 'explorer', title: 'Files', path: workspacePath }, { sessionId, cwd: workspacePath })
}

/** Wait until Better Sidebar has adopted the Session opened by the Client runtime. */
export async function waitForProjectSidebarSession(service: BetterSidebarService, sessionId: string): Promise<void> {
  if (service.getSnapshot().sessionId === sessionId) return
  await new Promise<void>((resolve, reject) => {
    let dispose = (): void => {}
    const timeout = window.setTimeout(() => {
      dispose()
      reject(new Error('右侧工作区尚未切换到项目运行会话。'))
    }, 2_000)
    dispose = service.subscribeState(() => {
      if (service.getSnapshot().sessionId !== sessionId) return
      window.clearTimeout(timeout)
      dispose()
      resolve()
    })
  })
}

interface RuntimeTab { readonly id: string; readonly type: string; readonly title: string }
interface RuntimeSplit {
  readonly kind?: string
  readonly tabs?: readonly RuntimeTab[]
  readonly children?: readonly RuntimeSplit[]
}

function tabsOf(node: RuntimeSplit | undefined): RuntimeTab[] {
  if (node === undefined) return []
  return [...(node.tabs ?? []), ...(node.children ?? []).flatMap(child => tabsOf(child))]
}

/** Activate the most relevant retained Agent terminal in the active Session. */
export function showProjectRuntimeTerminal(
  service: BetterSidebarService,
  sessionId: string,
  workspacePath: string,
  preferredTitle = '项目运行',
): void {
  revealProjectSidebar(service, sessionId, workspacePath)
  const state = service.getSnapshot().state
  const tabs = [
    ...tabsOf(state?.splits as RuntimeSplit | undefined),
    ...tabsOf(state?.bottomSplits as RuntimeSplit | undefined),
    ...((state?.floats ?? []).map(item => item.tab) as RuntimeTab[]),
  ].filter(tab => tab.type === 'terminal' && tab.id.startsWith('agent:'))
  const terminal = [...tabs].reverse().find(tab => tab.title === preferredTitle) ?? tabs.at(-1)
  if (terminal === undefined) throw new Error('当前项目的运行终端尚未出现。')
  service.activateTab(terminal.id, { sessionId, cwd: workspacePath })
}

/** Open one verified project URL inside the current Session's Browser tab. */
export function openProjectPreview(
  service: BetterSidebarService,
  sessionId: string,
  workspacePath: string,
  previewUrl: string,
): void {
  service.openTab({ type: 'browser', title: '项目预览', url: previewUrl }, { sessionId, cwd: workspacePath })
}
