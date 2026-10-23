/** Better Sidebar integration for visible project terminals and embedded previews. */

import { isolatedProjectPreview } from './ProjectPreview.tsx'
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
  return isolatedProjectPreview(result.value.url)
}

function prefsReady(service: BetterSidebarService): boolean {
  return service.getSnapshot().prefs.tabsEnabled['fde-project-preview'] !== false
}

async function waitForPrefs(service: BetterSidebarService): Promise<void> {
  if (prefsReady(service)) return
  await new Promise<void>((resolve, reject) => {
    let dispose = (): void => {}
    const timeout = window.setTimeout(() => {
      dispose()
      reject(new Error('项目预览配置尚未生效，请重试。'))
    }, 3_000)
    dispose = service.subscribeState(() => {
      if (!prefsReady(service)) return
      window.clearTimeout(timeout)
      dispose()
      resolve()
    })
  })
}

/** Persist and adopt only the Sidebar capabilities required by an explicit project run. */
export async function ensureProjectRuntimeSidebar(
  service: BetterSidebarService,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (prefsReady(service)) return
  const prefs = service.getSnapshot().prefs
  const response = await fetchImpl('/sidebar/api/settings.update', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      patch: {
        tabsEnabled: { ...prefs.tabsEnabled, 'fde-project-preview': true },
      },
    }),
  })
  const payload = await response.json().catch(() => null) as SettingsWireSuccess | SettingsWireFailure | null
  if (!response.ok || payload === null || payload.ok !== true) {
    const message = payload !== null && 'error' in payload ? payload.error.message : undefined
    throw new Error(message ?? '无法启用项目预览。')
  }
  await waitForPrefs(service)
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

/** Open one verified project URL inside the current Session's Browser tab. */
export function openProjectPreview(
  service: BetterSidebarService,
  sessionId: string,
  workspacePath: string,
  previewUrl: string,
): void {
  service.openTab({ type: 'fde-project-preview', title: '项目预览', path: isolatedProjectPreview(previewUrl) }, { sessionId, cwd: workspacePath })
}
