import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  IconPaperclipOutline16, Toast, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import css from './ProjectResourceUploadAction.module.css'

/** Exact Host route owned by `@deepseek-ai/dsh-fde-source`. */
export const PROJECT_RESOURCE_UPLOAD_PATH = '/api/fde-project-resources/upload'
export const PROJECT_RESOURCE_PARSE_PATH = '/api/fde-project-resources/parse'
export const PROJECT_SOURCES_CHANGED_EVENT = 'fde:project-sources-changed'
export const PROJECT_RESOURCE_UPLOAD_OPEN_EVENT = 'fde:project-source-upload-open'

export interface UploadedProjectResource {
  readonly sourceId: string
  readonly storedName: string
  readonly parse: { readonly status: string }
}

interface UploadSuccess {
  ok: true
  value: {
    directory: string
    files: readonly UploadedProjectResource[]
  }
}

interface UploadFailure {
  ok: false
  error: { code: string; message: string }
}

/**
 * Submit one explicit project-scoped batch without touching conversation state.
 * @param workspaceId - exact Workspace owner of the files.
 * @param files - browser-selected files in order.
 * @param fetchImpl - same-origin fetch boundary, overridable by component tests.
 * @returns the durably committed Source records.
 */
export async function uploadProjectResources(
  workspaceId: string,
  files: readonly File[],
  fetchImpl: typeof fetch = fetch,
): Promise<readonly UploadedProjectResource[]> {
  const form = new FormData()
  form.set('workspaceId', workspaceId)
  for (const file of files) form.append('files', file, file.name)
  const response = await fetchImpl(PROJECT_RESOURCE_UPLOAD_PATH, { method: 'POST', body: form })
  let payload: UploadSuccess | UploadFailure
  try {
    payload = await response.json() as UploadSuccess | UploadFailure
  } catch (error) {
    throw new Error(`invalid-response: ${String(error)}`)
  }
  if (!response.ok || payload.ok !== true) {
    const failure = payload as UploadFailure
    throw new Error(failure.error?.message ?? `HTTP ${String(response.status)}`)
  }
  if (payload.value.directory !== 'fde-resources' || !Array.isArray(payload.value.files)) {
    throw new Error('invalid-response')
  }
  if (payload.value.files.some(file => typeof file.sourceId !== 'string' || typeof file.storedName !== 'string')) {
    throw new Error('invalid-response')
  }
  return payload.value.files
}

async function recognizeProjectResource(
  workspaceId: string,
  sourceId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(PROJECT_RESOURCE_PARSE_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId, sourceId }),
  })
  if (!response.ok) throw new Error(`HTTP ${String(response.status)}`)
  const payload = await response.json() as { ok?: unknown }
  if (payload.ok !== true) throw new Error('invalid-response')
}

function ProjectResourceUploadControl({ workspaceId, path, t, composer = false }: {
  readonly workspaceId: string
  readonly path: string
  readonly t: ProjectResourceUploadActionProps['t']
  readonly composer?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const closeToast = useCallback(() => { setToast(null) }, [])
  const announce = useCallback((text: string) => {
    toastSeq.current += 1
    setToast({ seq: toastSeq.current, text })
  }, [])

  useEffect(() => {
    const openForProject = (event: Event): void => {
      const detail = (event as CustomEvent<{ workspaceId?: unknown }>).detail
      if (detail?.workspaceId !== String(workspaceId) || busy) return
      inputRef.current?.click()
    }
    window.addEventListener(PROJECT_RESOURCE_UPLOAD_OPEN_EVENT, openForProject)
    return () => { window.removeEventListener(PROJECT_RESOURCE_UPLOAD_OPEN_EVENT, openForProject) }
  }, [busy, workspaceId])

  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0 || busy) return
    setBusy(true)
    void uploadProjectResources(String(workspaceId), files).then((stored) => {
      announce(t('success', { count: stored.length }))
      const notifyChanged = (): void => {
        window.dispatchEvent(new CustomEvent(PROJECT_SOURCES_CHANGED_EVENT, { detail: { workspaceId: String(workspaceId), path } }))
      }
      notifyChanged()
      const parseable = stored.filter(file => file.parse.status === 'pending')
      if (parseable.length > 0) {
        void Promise.allSettled(parseable.map(file => recognizeProjectResource(String(workspaceId), file.sourceId))).then((results) => {
          notifyChanged()
          const failed = results.filter(result => result.status === 'rejected').length
          if (failed > 0) announce(t('recognitionFailed', { count: failed }))
        })
      }
    }, (error: unknown) => {
      const detail = error instanceof Error && error.message === 'invalid-response'
        ? t('invalidResponse')
        : error instanceof Error ? error.message : String(error)
      announce(t('failure', { message: detail }))
    }).finally(() => { setBusy(false) })
  }

  const label = busy ? t('uploading') : composer ? t('composerAction') : t('action')
  return (
    <span className={css.root} data-composer={composer ? 'true' : undefined}>
      <input
        ref={inputRef}
        className={css.input}
        type="file"
        multiple
        tabIndex={-1}
        aria-hidden
        onChange={onChange}
      />
      <Tooltip label={label} side="top" delayMs={500}>
        <button
          type="button"
          className={css.button}
          aria-label={label}
          disabled={busy}
          data-busy={busy ? 'true' : 'false'}
          onPointerDown={(event) => { event.stopPropagation() }}
          onClick={(event) => {
            event.stopPropagation()
            inputRef.current?.click()
          }}
        >
          <IconPaperclipOutline16 size={14} />
          {composer && <span>{label}</span>}
        </button>
      </Tooltip>
      {toast !== null && (
        <Toast key={toast.seq} text={toast.text} onDone={closeToast} />
      )}
    </span>
  )
}

/** Project-row file picker that persists files without creating a message or Agent turn. */
export function ProjectResourceUploadAction({ workspaceId, path, t }: ProjectResourceUploadActionProps) {
  return <ProjectResourceUploadControl workspaceId={String(workspaceId)} path={path} t={t} />
}

/** Project-scoped lightweight upload control inside the native composer tool row. */
export function ProjectResourceComposerAction({ sessionId, useWorkspaces, t }: ProjectResourceComposerActionProps) {
  const workspace = useWorkspaces(state => state.items.find(item => item.sessionIds.includes(sessionId)))
  if (workspace === undefined) return null
  return <ProjectResourceUploadControl workspaceId={String(workspace.workspaceId)} path={workspace.path} t={t} composer />
}

/** Props supplied by the Workspace project-action slot and locale seat. */
export type ProjectResourceUploadActionProps =
  PropsRuntime<'sidebar.workspaces.projectActions'>
  & PropsLocale<'fdeSources'>

/** Props supplied by the session-scoped native composer Slot. */
export type ProjectResourceComposerActionProps =
  PropsRuntime<'conversation.input.left'>
  & PropsLocale<'fdeSources'>
