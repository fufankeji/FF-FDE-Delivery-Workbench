/** Keep the retained Files tree current using the official filesystem change stream. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-api-workspace-files/remote'
import type { WorkspaceFileWatchFrame } from '@deepseek-ai/dsh-api-workspace-files/types'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'

/** Follow only the selected Session and release the stream when it changes. */
export function installProjectFileRefresh(ctx: Context): void {
  // Inject the parent `remote` namespace too: the scope accesses
  // `scope.remote.$stream` below, which the nested-only declaration rejected
  // with "cannot get property \"remote\" without inject".
  ctx.inject(['remote', 'remote.workspaceFiles'], scope => {
    let active = true
    let sessionId: string | undefined
    let stop: () => Promise<void> = async () => {}
    const closing = new Set<Promise<void>>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = (): void => {
      if (!active) return
      clearTimeout(timer)
      timer = setTimeout(() => { window.dispatchEvent(new Event('dsh-sidebar:refresh-files')) }, 300)
    }
    const switchSession = (): void => {
      const next = scope.sessions.list.getSnapshot().current
      if (next === sessionId) return
      const previous = stop()
      closing.add(previous)
      void previous.finally(() => { closing.delete(previous) })
      sessionId = next
      stop = async () => {}
      if (next === undefined) return
      const stream = scope.remote.$stream<WorkspaceFileWatchFrame>({
        name: 'FDE project files',
        open: signal => scope.remote.workspaceFiles.changes(next, signal),
        ended: () => new Error('Project file stream ended'),
      })
      stop = () => stream.dispose()
      void (async () => {
        try {
          for await (const item of stream) {
            item.accept()
            if (item.value.kind === 'change') refresh()
          }
        } catch {
          // A removed Session or terminal Host failure ends automatic refresh;
          // the Files tree still supports its explicit refresh action.
        }
      })()
    }
    scope.effect(() => {
      const unsubscribe = scope.sessions.list.subscribe(switchSession)
      window.addEventListener('fde:project-sources-changed', refresh)
      switchSession()
      return async () => {
        active = false
        unsubscribe()
        window.removeEventListener('fde:project-sources-changed', refresh)
        clearTimeout(timer)
        await Promise.allSettled([stop(), ...closing])
      }
    }, 'fde: project file refresh')
  })
}
