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
  readonly focusKey: `stage.${FdeStageId}.focus`
  readonly questionKey: `stage.${FdeStageId}.question`
}

/** Product-confirmed six-stage order. */
export const FDE_STAGES: readonly FdeStageDefinition[] = FDE_STAGE_IDS.map((id, index) => ({
  id,
  number: index + 1,
  nameKey: `stage.${id}.name`,
  goalKey: `stage.${id}.goal`,
  focusKey: `stage.${id}.focus`,
  questionKey: `stage.${id}.question`,
}))

/** V2 eight-stage presentation projected from the persisted legacy stage state. */
export const FDE_V2_STAGE_PRESENTATION: Readonly<Record<FdeProjectState, {
  readonly current: number
  readonly nameKey: FdeV2StageNameKey
}>> = {
  requirements: { current: 1, nameKey: 'stage.v2.discovery.name' },
  solution: { current: 2, nameKey: 'stage.v2.definition.name' },
  development: { current: 4, nameKey: 'stage.v2.design.name' },
  validation: { current: 5, nameKey: 'stage.v2.evaluation.name' },
  pilot: { current: 6, nameKey: 'stage.v2.pilot.name' },
  handoff: { current: 7, nameKey: 'stage.v2.production.name' },
  completed: { current: 8, nameKey: 'stage.v2.improvement.name' },
}

export const FDE_V2_STAGE_TOTAL = 8

export type FdeV2StageNameKey =
  | 'stage.v2.discovery.name'
  | 'stage.v2.definition.name'
  | 'stage.v2.investigation.name'
  | 'stage.v2.design.name'
  | 'stage.v2.evaluation.name'
  | 'stage.v2.pilot.name'
  | 'stage.v2.production.name'
  | 'stage.v2.improvement.name'

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
