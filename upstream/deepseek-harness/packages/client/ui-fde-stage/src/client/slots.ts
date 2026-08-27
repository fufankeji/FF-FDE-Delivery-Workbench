/** Slot props and shared injected project-stage face. */

import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { FdeStageProgressController } from './controller.ts'

/** Host-backed callbacks and observable shared by every stage contribution. */
export interface FdeStageInjected {
  hooks: { stageProgress: FdeStageProgressController }
  loadStage: (workspaceId: string) => void
  retryStage: (workspaceId: string) => void
}

/** Session-header current-stage props. */
export type FdeStageHeaderProps =
  PropsRuntime<'conversation.session.header.utilities'>
  & InjectFace<FdeStageInjected>
  & PropsLocale<'fdeStage'>

/** Blank-composer current-stage props. */
export type FdeStageBlankProps =
  PropsRuntime<'conversation.input.dock'>
  & InjectFace<FdeStageInjected>
  & PropsLocale<'fdeStage'>
