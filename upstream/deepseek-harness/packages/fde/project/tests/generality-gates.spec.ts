import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { loadV2StageSurface, V2_STAGE_DEFINITIONS } from '../src/v2-stage-surface.ts'
import { loadEvaluationWorkbench } from '../src/evaluation-workbench.ts'
import { loadDeliveryWorkbench } from '../src/delivery-workbench.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
async function project(stage: 'definition' | 'investigation') {
  const root = await mkdtemp(join(tmpdir(), 'fde-generality-gate-'))
  roots.push(root)
  const definition = V2_STAGE_DEFINITIONS.find(item => item.id === stage)!
  for (const file of [...definition.artifacts.map(item => item.path), definition.statePath]) await mkdir(dirname(join(root, file)), { recursive: true })
  const state = { schemaVersion: 1, stage, status: 'review-ready', workItems: definition.workItems.map(item => ({ id: item.id, status: 'complete' })), recommendation: 'pending', blockers: [] }
  await writeFile(join(root, definition.statePath), JSON.stringify(state))
  return { root, definition, state }
}

it.each(['definition', 'investigation'] as const)('does not certify blank %s artifacts or another project file', async stage => {
  const { root, definition } = await project(stage)
  for (const artifact of definition.artifacts) await writeFile(join(root, artifact.path), '  \n')
  expect(await loadV2StageSurface(root, stage)).toMatchObject({ presentCount: 0, reviewReady: false })
  const outside = await mkdtemp(join(tmpdir(), 'fde-other-project-'))
  roots.push(outside)
  await writeFile(join(outside, 'record.md'), 'another project')
  await rm(join(root, definition.artifacts[0]!.path))
  await symlink(join(outside, 'record.md'), join(root, definition.artifacts[0]!.path))
  expect((await loadV2StageSurface(root, stage)).artifacts[0]?.status).toBe('error')
})

it('keeps empty or unresolved investigation blocked and permits evidence-backed non-applicability', async () => {
  const { root, definition, state } = await project('investigation')
  for (const artifact of definition.artifacts) await writeFile(join(root, artifact.path), 'Local calculator: no external services or AI action. Scope checked by owner.')
  const investigation = { systems: [], connections: [], actionBoundaries: [], dataFindings: [], governanceReviews: [] }
  const save = async (value: unknown) => writeFile(join(root, definition.statePath), JSON.stringify({ ...state, investigation: value }))
  await save(investigation)
  expect((await loadV2StageSurface(root, 'investigation')).reviewBlockers).toHaveLength(4)
  const notApplicable = Object.fromEntries(['systems', 'actionBoundaries', 'dataFindings', 'governanceReviews'].map(key => [key, { reason: '本轮是无外部数据与服务的本地计算器', evidenceRefs: [definition.artifacts[0]!.path] }]))
  await save({ ...investigation, notApplicable })
  expect((await loadV2StageSurface(root, 'investigation')).reviewReady).toBe(true)
  await save({ ...investigation, notApplicable, systems: [{ id: 'new', label: '待调查来源', kind: 'data', status: 'pending' }] })
  expect((await loadV2StageSurface(root, 'investigation')).reviewReady).toBe(false)
})

it('invalidates unbound, changed and synthetic PASS claims without rewriting the project', async () => {
  const { root } = await project('definition')
  await writeFile(join(root, 'app.js'), 'calculator implementation')
  await writeFile(join(root, 'criterion.md'), '2 + 2 = 4')
  await writeFile(join(root, 'run.txt'), 'NOT EXECUTED')
  const data = { candidate: { version: 'v1', summary: 'calculator', sourceFiles: ['app.js'] }, testing: { environment: 'local', metrics: [{ id: 'sum', title: '加法', kind: '功能', required: true, criterion: '2 + 2 = 4', sourceRefs: ['criterion.md'] }] } }
  const fingerprint = (await loadEvaluationWorkbench(root, data)).testing.fingerprint
  const result = { metricId: 'sum', status: 'PASS', value: '4', evidenceRefs: ['run.txt'] }
  const claimed = { ...data, testing: { ...data.testing, run: { fingerprint, results: [result] } } }
  expect((await loadEvaluationWorkbench(root, claimed)).testing.metrics[0]?.status).toBe('STALE')
  await writeFile(join(root, 'run.txt'), 'observed: 4')
  const recorded = { ...claimed, testing: { ...claimed.testing, run: { fingerprint, results: [{ ...result, evidenceDigests: { 'run.txt': hash('observed: 4') } }] } } }
  // Hash binding proves integrity, not execution or the business assertion.
  expect((await loadEvaluationWorkbench(root, recorded)).reviewBlockers).toEqual([])
  expect((await loadEvaluationWorkbench(root, recorded, { kind: 'integration-fixture' })).testing.metrics[0]?.status).toBe('STALE')
  await writeFile(join(root, 'run.txt'), 'changed after recording')
  expect((await loadEvaluationWorkbench(root, recorded)).testing.metrics[0]?.status).toBe('STALE')
})

it.each(['pilot', 'production', 'improvement'] as const)('does not count %s fixtures as real delivery', async stage => {
  const { root } = await project('definition')
  await writeFile(join(root, 'version.md'), 'v1')
  const result = await loadDeliveryWorkbench(root, stage, { schemaVersion: 1, version: 'v1', versionFiles: [{ path: 'version.md', sha256: hash('v1') }], environment: { kind: stage === 'pilot' ? 'pilot' : 'production', label: 'declared scope' }, items: [] }, { kind: 'integration-fixture' })
  expect(result.reviewBlockers.some(message => message.includes('联调或模拟'))).toBe(true)
})
