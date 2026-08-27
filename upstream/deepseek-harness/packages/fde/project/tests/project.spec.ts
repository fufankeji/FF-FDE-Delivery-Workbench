import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProjectOpenApiCatalog } from '../src/openapi-tools.ts'
import { projectEvaluationDecision } from '../src/evaluation-guard.ts'
import {
  approveProjectEvaluationBaseline, confirmProjectArchitecture, loadProjectSurfaceSnapshot, replaceProjectArchitecture,
} from '../src/snapshot.ts'

const openApiPolicy = {
  timeoutMs: 30_000,
  maxSpecBytes: 2_097_152,
  maxResponseBytes: 262_144,
  maxRedirects: 3,
  maxOperations: 1_000,
} as const

describe('FDE project surface snapshot', () => {
  it('keeps unconfigured project surfaces honest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-empty-'))
    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '空白项目', path: root })
    expect(value.apiDocs.status).toBe('unconfigured')
    expect(value.architecture).toBeNull()
    expect(value.evaluation).toMatchObject({ casesCount: 0, reports: [] })
  })

  it('loads project-scoped API, architecture, and evaluation facts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-ready-'))
    await mkdir(join(root, '.fde', 'evaluations', 'cases'), { recursive: true })
    await mkdir(join(root, '.fde', 'evaluations', 'reports', 'run-1'), { recursive: true })
    await writeFile(join(root, '.fde', 'api-docs.json'), JSON.stringify({
      docsUrl: 'http://127.0.0.1:8000/docs',
      openapiSource: 'http://127.0.0.1:8000/openapi.json',
      allowedMethods: ['GET', 'HEAD'],
    }))
    await writeFile(join(root, '.fde', 'architecture.json'), JSON.stringify({
      title: '真实架构', revision: 2, status: 'candidate', updatedAt: '2026-08-26T00:00:00.000Z',
      groups: [{ id: 'service', label: '服务端' }],
      nodes: [{ id: 'api', label: 'API', kind: 'core', group: 'service' }],
      edges: [],
    }))
    await writeFile(join(root, '.fde', 'evaluations', 'cases', 'smoke.yml'), 'name: smoke\nprompt: ok\nassert:\n  output_contains: [ok]\n')
    await writeFile(join(root, '.fde', 'evaluations', 'reports', 'run-1', 'report.json'), JSON.stringify({
      summary: { pass: 1, fail: 0, error: 0 },
      cases: [{ name: 'smoke', status: 'pass', failures: [] }],
    }))

    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '真实项目', path: root })
    expect(value.apiDocs).toMatchObject({ status: 'configured', allowedMethods: ['GET', 'HEAD'] })
    expect(value.architecture).toMatchObject({ title: '真实架构', revision: 2 })
    expect(value.evaluation.casesCount).toBe(1)
    expect(value.evaluation.reports[0]).toMatchObject({ status: 'PASS', passed: 1, total: 1 })
  })

  it('does not publish an invalid architecture as usable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-invalid-'))
    await mkdir(join(root, '.fde'), { recursive: true })
    await writeFile(join(root, '.fde', 'architecture.json'), JSON.stringify({
      title: '损坏架构',
      nodes: [{ id: 'api', label: 'API' }],
      edges: [{ from: 'api', to: 'missing' }],
    }))
    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '项目', path: root })
    expect(value.architecture).toBeNull()
    expect(value.architectureError).toContain('引用无效')
  })

  it('indexes only the OpenAPI source inside the addressed project', async () => {
    const first = await mkdtemp(join(tmpdir(), 'fde-openapi-first-'))
    const second = await mkdtemp(join(tmpdir(), 'fde-openapi-second-'))
    for (const [root, title, path] of [[first, '客户接口 A', '/alpha'], [second, '客户接口 B', '/beta']] as const) {
      await writeFile(join(root, 'openapi.json'), JSON.stringify({
        openapi: '3.1.0', info: { title, version: '1' },
        paths: { [path]: { get: { operationId: `get${path.slice(1)}`, responses: { 200: { description: 'ok' } } } } },
      }))
    }
    const firstCatalog = await loadProjectOpenApiCatalog(first, openApiPolicy)
    const secondCatalog = await loadProjectOpenApiCatalog(second, openApiPolicy)
    expect(firstCatalog.catalog).toMatchObject({ title: '客户接口 A', operations: [{ operationId: 'getalpha', path: '/alpha' }] })
    expect(secondCatalog.catalog).toMatchObject({ title: '客户接口 B', operations: [{ operationId: 'getbeta', path: '/beta' }] })
    expect(firstCatalog.catalog.operations.some(operation => operation.path === '/beta')).toBe(false)
  })

  it('publishes candidates against an exact revision and confirms that revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-architecture-write-'))
    const first = await replaceProjectArchitecture(root, {
      title: '候选架构',
      groups: [{ id: 'app', label: '应用' }],
      nodes: [{ id: 'web', label: 'Web', kind: 'entry', group: 'app' }],
      edges: [],
    }, 0)
    expect(first).toMatchObject({ revision: 1, status: 'candidate' })
    await expect(replaceProjectArchitecture(root, {
      title: '过期修改', groups: [], nodes: [], edges: [],
    }, 0)).rejects.toThrow('版本冲突')
    const confirmed = await confirmProjectArchitecture(root, 1)
    expect(confirmed).toMatchObject({ revision: 1, status: 'confirmed', title: '候选架构' })
    const second = await replaceProjectArchitecture(root, {
      title: '第二版架构', groups: [], nodes: [], edges: [],
    }, 1)
    expect(second).toMatchObject({ revision: 2, status: 'candidate' })
    const history = JSON.parse(await readFile(join(root, '.fde', 'architecture-history', 'R1.json'), 'utf8')) as unknown
    expect(history).toMatchObject({ revision: 1, status: 'confirmed', title: '候选架构' })
  })

  it('approves only an indexed project report as baseline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-baseline-'))
    const reportDir = join(root, '.fde', 'evaluations', 'reports', 'run-1')
    await mkdir(reportDir, { recursive: true })
    await writeFile(join(reportDir, 'report.json'), JSON.stringify({
      summary: { passed: 1, failed: 0, errored: 0 },
      cases: [{ name: 'smoke', status: 'pass', failures: [] }],
    }))
    await approveProjectEvaluationBaseline(root, '.fde/evaluations/reports/run-1/report.json')
    const snapshot = await loadProjectSurfaceSnapshot({ workspaceId: 'w', title: '项目', path: root })
    expect(snapshot.evaluation.baseline).toMatchObject({ status: 'PASS', passed: 1, total: 1 })
    await expect(approveProjectEvaluationBaseline(root, '../other/report.json')).rejects.toThrow('越过项目目录')
  })

  it('guards evaluation tools to the current project and blocks Judge calibration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-eval-guard-'))
    const cases = join(root, '.fde', 'evaluations', 'cases')
    const runtime = join(root, '.runtime', 'fde-evaluations', 'run-1')
    await mkdir(cases, { recursive: true })
    await mkdir(runtime, { recursive: true })
    await expect(projectEvaluationDecision(root, 'eval_run', {
      cases_dir: cases,
      output_dir: join(runtime, 'output'),
      session_root: join(runtime, 'sessions'),
      profile: 'headless',
    })).resolves.toBeUndefined()
    await expect(projectEvaluationDecision(root, 'eval_run', {
      cases_dir: cases,
      output_dir: join(tmpdir(), 'escaped-eval-output'),
    })).resolves.toMatchObject({ kind: 'deny' })
    await expect(projectEvaluationDecision(root, 'eval_judge_validate', {
      labels_path: join(root, '.fde', 'evaluations', 'labels.jsonl'),
    })).resolves.toMatchObject({ kind: 'deny' })
    const outside = await mkdtemp(join(tmpdir(), 'fde-eval-symlink-target-'))
    const linked = join(root, '.runtime', 'fde-evaluations', 'linked')
    await symlink(outside, linked)
    const symlinkDecision = await projectEvaluationDecision(root, 'eval_run', {
      cases_dir: cases,
      output_dir: join(linked, 'output'),
    })
    expect(symlinkDecision?.kind).toBe('deny')
    if (symlinkDecision?.kind === 'deny') expect(symlinkDecision.reason).toContain('符号链接')
  })
})
