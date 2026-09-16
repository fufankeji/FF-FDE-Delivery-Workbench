import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
type State = { open: boolean }
type Actions = { open: (draft: State) => void; close: (draft: State) => void }
/** One apply-scoped navigation store; never writes project or session state. */
export function createLabStore(): EngineStoreHandle<State, Actions> {
  return defineStore({
    init: (): State => ({ open: false }),
    actions: {
      open: draft => { draft.open = true },
      close: draft => { draft.open = false },
    },
  })
}
