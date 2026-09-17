import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'

type State = { open: boolean; activeId: string | undefined }
type Actions = {
  open: (draft: State, section?: string) => void
  close: (draft: State) => void
  select: (draft: State, section: string) => void
}

/** Share viewing state between sidebar triggers; configuration remains feature-owned. */
export function createSettingsShellStore(): EngineStoreHandle<State, Actions> {
  return defineStore({
    init: (): State => ({ open: false, activeId: undefined }),
    actions: {
      open: (draft, section) => { draft.open = true; draft.activeId = section },
      close: draft => { draft.open = false; draft.activeId = undefined },
      select: (draft, section) => { draft.activeId = section },
    },
  })
}
