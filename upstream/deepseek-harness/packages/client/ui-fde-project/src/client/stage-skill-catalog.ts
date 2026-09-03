/** Browser reader for the fixed methods registered by the FDE stage Host plugin. */

/** Exact Host route for the read-only stage method catalog. */
export const FDE_STAGE_SKILL_CATALOG_PATH = '/api/fde-stage/skills'

/** One method definition shown under a project stage. */
export interface StageSkillCatalogMethod {
  readonly id: string
  readonly label: string
  readonly description: string
  readonly whenToUse: string
  readonly source: string
  readonly content: string
  readonly group?: 'required' | 'conditional'
}

/** One stage and the methods that the product actually registers for it. */
export interface StageSkillCatalogStage {
  readonly id: string
  readonly index: number
  readonly methods: readonly StageSkillCatalogMethod[]
}

/** Validated browser value returned by the Host. */
export interface StageSkillCatalogValue {
  readonly schemaVersion: 1
  readonly stages: readonly StageSkillCatalogStage[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMethod(value: unknown): value is StageSkillCatalogMethod {
  if (!isRecord(value)) return false
  const group = value.group
  return ['id', 'label', 'description', 'whenToUse', 'source', 'content']
    .every(key => typeof value[key] === 'string' && value[key].trim() !== '')
    && (group === undefined || group === 'required' || group === 'conditional')
}

function isStage(value: unknown): value is StageSkillCatalogStage {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.trim() !== ''
    && Number.isSafeInteger(value.index)
    && Array.isArray(value.methods)
    && value.methods.every(isMethod)
}

function isCatalog(value: unknown): value is StageSkillCatalogValue {
  return isRecord(value)
    && value.schemaVersion === 1
    && Array.isArray(value.stages)
    && value.stages.every(isStage)
}

/**
 * Read the fixed product catalog without enumerating local or global Skill directories.
 * @param signal - optional cancellation for the current view lifecycle.
 * @param fetchImpl - fetch implementation used by the browser or a focused test.
 * @returns the validated product catalog.
 */
export async function fetchStageSkillCatalog(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<StageSkillCatalogValue> {
  const response = await fetchImpl(FDE_STAGE_SKILL_CATALOG_PATH, {
    method: 'GET',
    ...(signal === undefined ? {} : { signal }),
  })
  let payload: unknown
  try { payload = await response.json() } catch { throw new Error('阶段工作方法响应无效。') }
  const result = payload as { readonly ok?: unknown; readonly value?: unknown; readonly error?: { readonly message?: string } }
  if (!response.ok || result.ok !== true) throw new Error(result.error?.message ?? '阶段工作方法读取失败。')
  if (!isCatalog(result.value)) throw new Error('阶段工作方法响应无效。')
  return result.value
}
