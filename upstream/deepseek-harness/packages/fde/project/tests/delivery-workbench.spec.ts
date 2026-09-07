import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadDeliveryWorkbench } from '../src/delivery-workbench.ts'
import { loadV2StageSurface, V2_STAGE_DEFINITIONS } from '../src/v2-stage-surface.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })
const digest = (body: string) => createHash('sha256').update(body).digest('hex')
async function fixture(stage: 'pilot' | 'production' | 'improvement' = 'pilot') {
  const root = await mkdtemp(join(tmpdir(), 'fde-delivery-'))
  roots.push(root)
  await writeFile(join(root, 'app.ts'), 'v1')
  await writeFile(join(root, 'evidence.md'), 'actual observation')
  const categories = stage === 'pilot' ? ['authorization', 'integration', 'recovery', 'technical', 'business'] : stage === 'production' ? ['release', 'adoption', 'acceptance', 'deliverable', 'handover'] : ['change', 'impact', 'validation', 'release']
  const data = {
    schemaVersion: 1, version: 'r1',
    versionFiles: [{ path: 'app.ts', sha256: digest('v1') }],
    environment: { kind: stage === 'pilot' ? 'pilot' : 'production', label: 'approved scope' },
    items: categories.map(category => ({
      id: category, category, title: category, summary: 'actual recorded result', status: 'passed',
      version: 'r1', scope: stage === 'pilot' ? 'pilot' : 'production',
      owner: 'named reviewer', observedAt: '2026-09-07T08:00:00.000Z', required: true,
      evidence: [{ path: 'evidence.md', sha256: digest('actual observation') }],
    })),
  }
  return { root, data }
}

describe('late-stage versioned delivery evidence', () => {
  it.each(['pilot', 'production', 'improvement'] as const)('requires all %s categories and still leaves lifecycle decisions to the caller', async stage => {
    const { root, data } = await fixture(stage)
    const before = await loadDeliveryWorkbench(root, stage, data)
    expect(before).toMatchObject({ status: 'ready', versionCurrent: true, reviewBlockers: [] })
    expect(before.items.every(item => item.status === 'passed')).toBe(true)
    data.items = []
    expect((await loadDeliveryWorkbench(root, stage, data)).reviewBlockers.length).toBeGreaterThan(0)
  })
  it('does not promote local results to Pilot readiness', async () => {
    const { root, data } = await fixture()
    data.items.forEach(item => { item.scope = 'local' })
    const result = await loadDeliveryWorkbench(root, 'pilot', data)
    expect(result.items[0]?.status).toBe('passed')
    expect(result.reviewBlockers).toHaveLength(5)
  })
  it('invalidates evidence after code or evidence content changes while preserving the declaration', async () => {
    const { root, data } = await fixture()
    await writeFile(join(root, 'app.ts'), 'v2')
    let result = await loadDeliveryWorkbench(root, 'pilot', data)
    expect(result.versionCurrent).toBe(false)
    expect(result.items[0]).toMatchObject({ declaredStatus: 'passed', status: 'stale' })
    data.versionFiles[0]!.sha256 = digest('v2')
    await writeFile(join(root, 'evidence.md'), 'changed report')
    result = await loadDeliveryWorkbench(root, 'pilot', data)
    expect(result.items.every(item => item.status === 'stale')).toBe(true)
    expect(result.items[0]?.evidence[0]?.current).toBe(false)
  })
  it('does not accept a local environment even if every row declares Pilot scope', async () => {
    const { root, data } = await fixture()
    data.environment.kind = 'local'
    expect((await loadDeliveryWorkbench(root, 'pilot', data)).reviewBlockers).toContain('当前环境不是试点范围，不能仅依据本地结果评审。')
  })
  it('does not accept old versions, absent evidence, owners or observation times', async () => {
    const { root, data } = await fixture()
    data.items[0]!.version = 'r0'
    data.items[1]!.evidence = []
    const input = { ...data, items: [...data.items.slice(0, 2), { ...data.items[2], owner: undefined }, { ...data.items[3], observedAt: undefined }] }
    const result = await loadDeliveryWorkbench(root, 'pilot', input)
    expect(result.items.every(item => item.status === 'stale')).toBe(true)
  })
  it('allows evidenced non-applicable integration, but never waives authorization or outcomes', async () => {
    const { root, data } = await fixture()
    data.items[1]!.status = 'not_applicable'
    expect((await loadDeliveryWorkbench(root, 'pilot', data)).reviewBlockers).toEqual([])
    data.items[0]!.status = 'not_applicable'
    expect((await loadDeliveryWorkbench(root, 'pilot', data)).reviewBlockers.length).toBeGreaterThan(0)
  })
  it('rejects malformed records and keeps missing distinct from invalid', async () => {
    const { root, data } = await fixture()
    expect((await loadDeliveryWorkbench(root, 'pilot', undefined)).status).toBe('missing')
    for (const value of [{ ...data, schemaVersion: 2 }, { ...data, items: [...data.items, data.items[0]] }, { ...data, items: [{ ...data.items[0], category: 'acceptance' }] }]) {
      expect((await loadDeliveryWorkbench(root, 'pilot', value)).status).toBe('invalid')
    }
  })
  it('refuses missing, empty, escaping and self-referential evidence', async () => {
    const { root, data } = await fixture()
    await writeFile(join(root, 'empty.md'), '')
    await symlink(tmpdir(), join(root, 'outside'))
    for (const path of ['missing.md', 'empty.md', '../outside', '/etc/hosts', 'outside/example', '.fde/stages/pilot.json']) {
      data.items[0]!.evidence = [{ path, sha256: digest('actual observation') }]
      const result = await loadDeliveryWorkbench(root, 'pilot', data)
      expect(result.items[0]?.status).toBe('stale')
      expect(result.items[0]?.evidence[0]?.current).toBe(false)
    }
  })
  it('only includes ontology fields when explicitly recorded, and checks their evidence', async () => {
    const { root, data } = await fixture()
    expect((await loadDeliveryWorkbench(root, 'pilot', data)).semantic).toBeUndefined()
    const result = await loadDeliveryWorkbench(root, 'pilot', { ...data, semantic: { mode: 'snapshot', schemaVersion: 'v1', graphRevision: 'r1', summary: 'static snapshot only', evidence: [] } })
    expect(result.semantic?.mode).toBe('snapshot')
    expect(result.reviewBlockers).toContain('语义依赖证据缺失或已变化。')
  })
  it('requires specialized evidence at the existing stage gate even when all fixed files exist', async () => {
    const { root, data } = await fixture()
    const definition = V2_STAGE_DEFINITIONS.find(stage => stage.id === 'pilot')!
    for (const artifact of definition.artifacts) {
      await mkdir(join(root, artifact.path, '..'), { recursive: true })
      await writeFile(join(root, artifact.path), 'candidate document')
    }
    await mkdir(join(root, '.fde/stages'), { recursive: true })
    const state = { schemaVersion: 1, stage: 'pilot', status: 'review-ready', workItems: definition.workItems.map(item => ({ id: item.id, status: 'complete' })), blockers: [], recommendation: 'pending' }
    await writeFile(join(root, definition.statePath), JSON.stringify(state))
    expect((await loadV2StageSurface(root, 'pilot')).reviewReady).toBe(false)
    await writeFile(join(root, definition.statePath), JSON.stringify({ ...state, delivery: data }))
    expect((await loadV2StageSurface(root, 'pilot')).reviewReady).toBe(true)
  })
})
