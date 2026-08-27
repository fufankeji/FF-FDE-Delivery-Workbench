/** Fixed FDE stage order and locale keys used by the progress UI. */

/** Stable project-stage ids accepted from the Host. */
export const FDE_STAGE_IDS = [
  'requirements',
  'solution',
  'development',
  'validation',
  'pilot',
  'handoff',
] as const

/** One stable project-stage id. */
export type FdeStageId = typeof FDE_STAGE_IDS[number]
/** Six active stages plus the terminal project-completed state. */
export type FdeProjectState = FdeStageId | 'completed'

/** Read-only metadata for one stage card. */
export interface FdeStageDefinition {
  readonly id: FdeStageId
  readonly number: number
  readonly nameKey: `stage.${FdeStageId}.name`
  readonly goalKey: `stage.${FdeStageId}.goal`
  readonly questionKey: `stage.${FdeStageId}.question`
}

/** Product-confirmed six-stage order. */
export const FDE_STAGES: readonly FdeStageDefinition[] = FDE_STAGE_IDS.map((id, index) => ({
  id,
  number: index + 1,
  nameKey: `stage.${id}.name`,
  goalKey: `stage.${id}.goal`,
  questionKey: `stage.${id}.question`,
}))

/**
 * Test whether a wire value is one of the six supported stage ids.
 * @param value - untrusted wire value.
 * @returns whether the value is a supported stage id.
 */
export function isFdeStageId(value: unknown): value is FdeStageId {
  return typeof value === 'string' && (FDE_STAGE_IDS as readonly string[]).includes(value)
}

/** Test whether a wire value is an active stage or the terminal state. */
export function isFdeProjectState(value: unknown): value is FdeProjectState {
  return value === 'completed' || isFdeStageId(value)
}
