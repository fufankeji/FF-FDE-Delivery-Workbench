import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { loadEvaluationWorkbench } from '../src/evaluation-workbench.ts'
import { loadV2StageSurface } from '../src/v2-stage-surface.ts'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'fde-evaluation-info-'))
  roots.push(root)
  for (const [file, body] of [['app.ts', 'export const ready = true'], ['criteria.md', 'Expected: result is ready'], ['evidence.txt', 'actual result: ready']]) {
    await writeFile(join(root, file!), body!)
  }
  return { root, data: {
    candidate: { version: 'r1', summary: 'One executable acceptance path', sourceFiles: ['app.ts'] },
    testing: { environment: 'local-test', metrics: [
      { id: 'business-1', title: '真实业务验收', kind: '业务', required: true, criterion: 'Return ready', sourceRefs: ['criteria.md'] },
    ], run: { fingerprint: '', results: [] as { metricId: string; status: string; value: string; evidenceRefs: string[]; evidenceDigests?: Record<string, string> }[] } },
  } }
}

async function recordPass(root: string, data: Awaited<ReturnType<typeof fixture>>['data']) {
  const prepared = await loadEvaluationWorkbench(root, data)
  data.testing.run = { fingerprint: prepared.testing.fingerprint!, results: [
    { metricId: 'business-1', status: 'PASS', value: 'ready', evidenceRefs: ['evidence.txt'], evidenceDigests: { 'evidence.txt': createHash('sha256').update('actual result: ready').digest('hex') } },
  ] }
}

describe('stage-five effective information and evidence gate', () => {
  it('keeps missing records empty without inventing development tasks or results', async () => {
    const { root, data } = await fixture()
    expect(await loadEvaluationWorkbench(root, undefined)).toMatchObject({ status: 'missing', candidate: { version: '' }, testing: { metrics: [], current: false } })
    const value = await loadEvaluationWorkbench(root, data)
    expect(value.testing.metrics[0]?.status).toBe('NOT_RUN')
    expect(value.reviewBlockers).toEqual(['必测项尚未通过：真实业务验收'])
    expect(value).not.toHaveProperty('development')
  })

  it('accepts current recorded evidence without any development task list', async () => {
    const { root, data } = await fixture()
    await recordPass(root, data)
    expect(await loadEvaluationWorkbench(root, data)).toMatchObject({ status: 'ready', reviewBlockers: [], testing: { current: true } })
  })

  it.each(['file', 'version', 'environment', 'criterion', 'source'] as const)('expires recorded results when %s changes', async (change) => {
    const { root, data } = await fixture()
    await recordPass(root, data)
    if (change === 'file') await writeFile(join(root, 'app.ts'), 'export const ready = false')
    if (change === 'version') data.candidate.version = 'r2'
    if (change === 'environment') data.testing.environment = 'another-environment'
    if (change === 'criterion') data.testing.metrics[0]!.criterion = 'Different acceptance condition'
    if (change === 'source') await writeFile(join(root, 'criteria.md'), 'New accepted scope')
    const value = await loadEvaluationWorkbench(root, data)
    expect(value.testing.metrics[0]?.status).toBe('STALE')
    expect(value.reviewBlockers).toContain('必测项尚未通过（版本已过期）：真实业务验收')
  })

  it.each(['NOT_RUN', 'RUNNING', 'WARN', 'FAIL'])('does not accept required %s results', async (status) => {
    const { root, data } = await fixture()
    await recordPass(root, data)
    data.testing.run.results[0]!.status = status
    expect((await loadEvaluationWorkbench(root, data)).reviewBlockers).toContain('必测项尚未通过：真实业务验收')
  })

  it('retains optional failures and rejects a PASS without readable evidence', async () => {
    const { root, data } = await fixture()
    data.testing.metrics.push({ ...data.testing.metrics[0]!, id: 'optional', title: '补充验证', required: false })
    await recordPass(root, data)
    data.testing.run.results.push({ metricId: 'optional', status: 'FAIL', value: 'known limitation', evidenceRefs: ['evidence.txt'] })
    expect(await loadEvaluationWorkbench(root, data)).toMatchObject({ reviewBlockers: [], testing: { metrics: [{ status: 'PASS' }, { status: 'FAIL' }] } })
    data.testing.run.results[0]!.evidenceRefs = ['missing.txt']
    expect((await loadEvaluationWorkbench(root, data)).testing.metrics[0]?.status).toBe('STALE')
  })

  it('rejects duplicate IDs and paths outside the registered project, including symlinks', async () => {
    const { root, data } = await fixture()
    data.testing.metrics.push({ ...data.testing.metrics[0]! })
    expect((await loadEvaluationWorkbench(root, data)).status).toBe('invalid')
    data.testing.metrics.pop()
    const outside = await mkdtemp(join(tmpdir(), 'fde-evaluation-outside-'))
    roots.push(outside)
    await writeFile(join(outside, 'private.txt'), 'must not read')
    await symlink(join(outside, 'private.txt'), join(root, 'linked.txt'))
    for (const path of ['../private.txt', 'linked.txt', '.fde/stages/evaluation.json']) {
      data.candidate.sourceFiles = [path]
      const value = await loadEvaluationWorkbench(root, data)
      expect(value.candidate.sourceFiles[0]?.status).toBe('error')
      expect(value.testing.fingerprint).toBeUndefined()
      expect(value.reviewBlockers.length).toBeGreaterThan(0)
    }
  })

  it('uses the same live gate as the stage surface; three files never substitute for evidence', async () => {
    const { root, data } = await fixture()
    const stateDir = join(root, '.fde/stages')
    const artifactDir = join(root, 'fde-deliverables/05-poc-eval')
    await mkdir(stateDir, { recursive: true }); await mkdir(artifactDir, { recursive: true })
    for (const file of ['evaluation-plan.md', 'evaluation-report.md', 'evaluation-baseline.md']) await writeFile(join(artifactDir, file), `# ${file}`)
    const state = { schemaVersion: 1, stage: 'evaluation', status: 'review-ready', recommendation: 'go', blockers: [], workItems: ['plan', 'cases', 'run', 'conclusion'].map(id => ({ id, status: 'complete' })) }
    await writeFile(join(stateDir, 'evaluation.json'), JSON.stringify(state))
    expect(await loadV2StageSurface(root, 'evaluation')).toMatchObject({ presentCount: 3, reviewReady: false })
    await recordPass(root, data)
    await writeFile(join(stateDir, 'evaluation.json'), JSON.stringify({ ...state, evaluation: data }))
    expect(await loadV2StageSurface(root, 'evaluation')).toMatchObject({ reviewReady: true })
    await writeFile(join(root, 'app.ts'), 'changed after results were recorded')
    expect(await loadV2StageSurface(root, 'evaluation')).toMatchObject({ reviewReady: false })
  })
})
