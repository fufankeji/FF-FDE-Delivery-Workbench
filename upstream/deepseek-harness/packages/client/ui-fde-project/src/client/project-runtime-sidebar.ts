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

/** Resolve the platform-owned isolated preview instead of changing project CSP. */
export async function resolveProjectPreview(workspaceId: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const response = await fetchImpl('/api/fde-project/runtime/preview', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }),
  })
  const result = await response.json() as { ok?: boolean; value?: { url?: string }; error?: { message?: string } }
  if (!response.ok || result.ok !== true || typeof result.value?.url !== 'string') throw new Error(result.error?.message ?? '项目预览服务暂不可用。')
  const url = new URL(result.value.url)
  if (url.protocol !== 'http:' || !/^fde-[a-f0-9]{36}\.localhost$/.test(url.hostname) || !url.port || url.username || url.password) throw new Error('平台返回了无效的隔离预览地址。')
  return url.href
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
    const message = payload !== null && 'error' in payload ? payload.error.message : undefined
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

function runtimeTerminalOf(service: BetterSidebarService, preferredTitle: string): RuntimeTab | undefined {
  const state = service.getSnapshot().state
  const terminals = [
    ...tabsOf(state?.bottomSplits as RuntimeSplit | undefined),
  ].filter(tab => tab.type === 'terminal')
  const newestFirst = [...terminals].reverse()
  return newestFirst.find(tab => tab.id.startsWith('agent:') && tab.title === preferredTitle)
    ?? newestFirst.find(tab => tab.title === preferredTitle)
    ?? newestFirst.find(tab => tab.id.startsWith('agent:'))
}

async function waitForRuntimeTerminal(
  service: BetterSidebarService,
  preferredTitle: string,
  waitMs: number,
): Promise<RuntimeTab | undefined> {
  const current = runtimeTerminalOf(service, preferredTitle)
  if (current !== undefined || waitMs <= 0) return current
  return await new Promise<RuntimeTab | undefined>((resolve) => {
    let dispose = (): void => {}
    let settled = false
    const finish = (terminal?: RuntimeTab): void => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      dispose()
      resolve(terminal)
    }
    const timeout = window.setTimeout(() => { finish() }, waitMs)
    dispose = service.subscribeState(() => {
      const terminal = runtimeTerminalOf(service, preferredTitle)
      if (terminal !== undefined) finish(terminal)
    })
    const afterSubscribe = runtimeTerminalOf(service, preferredTitle)
    if (afterSubscribe !== undefined) finish(afterSubscribe)
  })
}

/** Visible instruction used only when the old Host no longer owns the recorded Agent PTY. */
export function projectRuntimeTerminalRecoveryPrompt(
  previewUrl: string | undefined,
  preferredTitle = '项目运行',
): string {
  const preview = previewUrl === undefined ? '运行记录没有可核验的预览地址' : `已记录预览地址为 ${previewUrl}`
  return `当前 FDE 项目仍记录为运行中，但右侧标题为“${preferredTitle}”的持久终端在当前 DSH Host 中已经不可用。${preview}。\n\n1. 先调用 terminal_list；如果同名终端已经出现，直接读取并使用它，不要再创建。\n2. 如果确实不存在，只调用一次 terminal_create，title=${preferredTitle}，command 留空，在当前项目目录恢复一个新的可观察终端。\n3. 读取项目 AGENTS.md 及其引用的真实运行说明，只用其中声明的状态或健康检查方式核验已记录的项目服务；不要重复启动、停止或修改服务，也不要扫描或操作其他项目。\n4. 本次没有新的 operationId，不要调用 project_runtime_report。旧 Host 中的终端输出无法恢复，必须明确说明新终端只是替代观察入口，不得声称找回了旧日志。\n5. 最后在当前对话简短说明：新终端是否已经恢复、既有项目是否仍可访问，以及若服务已经失效应由 FDE 再明确点击启动或停止。`
}

/** Activate the most relevant retained Agent terminal in the active Session. */
export async function showProjectRuntimeTerminal(
  service: BetterSidebarService,
  sessionId: string,
  workspacePath: string,
  preferredTitle = '项目运行',
  waitMs = 1_000,
): Promise<boolean> {
  revealProjectSidebar(service, sessionId, workspacePath)
  const terminal = await waitForRuntimeTerminal(service, preferredTitle, waitMs)
  if (terminal === undefined) return false
  service.activateTab(terminal.id, { sessionId, cwd: workspacePath })
  return true
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
