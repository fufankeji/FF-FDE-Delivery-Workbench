import { defineStore } from '@deepseek-ai/dsh-client-store'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-store'
type LabView = 'catalog' | 'discovery' | 'challenge'
type State = { open: boolean; view: LabView; discoveryOpened: boolean }
type Actions = { open: (draft: State) => void; close: (draft: State) => void; select: (draft: State, view: LabView) => void }
/** One apply-scoped navigation store; never writes project or session state. */
export function createLabStore(): EngineStoreHandle<State, Actions> {
  return defineStore({
    init: (): State => ({ open: false, view: 'catalog', discoveryOpened: false }),
    actions: {
      open: draft => { draft.open = true },
      close: draft => { draft.open = false },
      select: (draft, view) => { draft.view = view; if (view === 'discovery') draft.discoveryOpened = true },
    },
  })
}
