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
  readonly entryPath?: string
  readonly files?: readonly { readonly path: string; readonly content: string; readonly sha256: string }[]
  readonly group?: 'required' | 'conditional'
  readonly role?: 'core' | 'conditional' | 'engineering'
  readonly answers?: readonly string[]
  readonly answerGroups?: readonly StageSkillCatalogAnswerGroup[]
  readonly workflow?: readonly string[]
  readonly artifacts?: readonly StageSkillCatalogArtifact[]
  readonly collaborators?: readonly StageSkillCatalogCollaborator[]
  readonly example?: StageSkillCatalogExample
  readonly references?: readonly StageSkillCatalogReference[]
  readonly sourceUrl?: string
  readonly sourceLanguage?: 'en'
  readonly adapterLanguage?: 'zh-CN'
  readonly license?: string
}

export interface StageSkillCatalogAnswerGroup {
  readonly label: string
  readonly tone: 'identity' | 'flow' | 'value'
  readonly answers: readonly string[]
}

export interface StageSkillCatalogArtifact {
  readonly label: string
  readonly path: string
  readonly purpose: string
  readonly required: boolean
}

export interface StageSkillCatalogCollaborator {
  readonly id: string
  readonly label: string
  readonly condition: string
  readonly contribution: string
  readonly role: 'engineering' | 'conditional'
}

export interface StageSkillCatalogExample {
  readonly title: string
  readonly summary: string
  readonly steps: readonly {
    readonly batch: string
    readonly input: string
    readonly finding: string
    readonly skills: readonly string[]
    readonly output: string
  }[]
}

export interface StageSkillCatalogReference {
  readonly label: string
  readonly path: string
  readonly category: 'method' | 'artifact' | 'control'
  readonly kind: 'markdown' | 'json' | 'pattern' | 'catalog'
  readonly purpose: string
  readonly url: string
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function isArtifact(value: unknown): value is StageSkillCatalogArtifact {
  return isRecord(value)
    && ['label', 'path', 'purpose'].every(key => isNonEmptyString(value[key]))
    && typeof value.required === 'boolean'
}

function isAnswerGroup(value: unknown): value is StageSkillCatalogAnswerGroup {
  return isRecord(value)
    && isNonEmptyString(value.label)
    && (value.tone === 'identity' || value.tone === 'flow' || value.tone === 'value')
    && isStringArray(value.answers)
}

function isCollaborator(value: unknown): value is StageSkillCatalogCollaborator {
  return isRecord(value)
    && ['id', 'label', 'condition', 'contribution'].every(key => isNonEmptyString(value[key]))
    && (value.role === 'engineering' || value.role === 'conditional')
}

function isExample(value: unknown): value is StageSkillCatalogExample {
  return isRecord(value)
    && isNonEmptyString(value.title)
    && isNonEmptyString(value.summary)
    && Array.isArray(value.steps)
    && value.steps.every(step => isRecord(step)
      && ['batch', 'input', 'finding', 'output'].every(key => isNonEmptyString(step[key]))
      && isStringArray(step.skills))
}

function isReference(value: unknown): value is StageSkillCatalogReference {
  return isRecord(value)
    && ['label', 'path', 'purpose', 'url'].every(key => isNonEmptyString(value[key]))
    && (value.category === 'method' || value.category === 'artifact' || value.category === 'control')
    && (value.kind === 'markdown' || value.kind === 'json' || value.kind === 'pattern' || value.kind === 'catalog')
}

function isMethod(value: unknown): value is StageSkillCatalogMethod {
  if (!isRecord(value)) return false
  const group = value.group
  const role = value.role
  return ['id', 'label', 'description', 'whenToUse', 'source', 'content']
    .every(key => isNonEmptyString(value[key]))
    && (group === undefined || group === 'required' || group === 'conditional')
    && (role === undefined || role === 'core' || role === 'conditional' || role === 'engineering')
    && (value.answers === undefined || isStringArray(value.answers))
    && (value.answerGroups === undefined || (Array.isArray(value.answerGroups) && value.answerGroups.every(isAnswerGroup)))
    && (value.workflow === undefined || isStringArray(value.workflow))
    && (value.artifacts === undefined || (Array.isArray(value.artifacts) && value.artifacts.every(isArtifact)))
    && (value.collaborators === undefined || (Array.isArray(value.collaborators) && value.collaborators.every(isCollaborator)))
    && (value.example === undefined || isExample(value.example))
    && (value.references === undefined || (Array.isArray(value.references) && value.references.every(isReference)))
    && (value.sourceUrl === undefined || isNonEmptyString(value.sourceUrl))
    && (value.sourceLanguage === undefined || value.sourceLanguage === 'en')
    && (value.adapterLanguage === undefined || value.adapterLanguage === 'zh-CN')
    && (value.license === undefined || isNonEmptyString(value.license))
    && (value.entryPath === undefined || isNonEmptyString(value.entryPath))
    && (value.files === undefined || (Array.isArray(value.files) && value.files.every(file => isRecord(file)
      && isNonEmptyString(file.path) && !file.path.includes('\\') && !file.path.includes(':')
      && file.path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
      && typeof file.content === 'string' && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256))
      && value.files.some(file => isRecord(file) && file.path === value.entryPath)))
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
