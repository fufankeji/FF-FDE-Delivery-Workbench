import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProjectOpenApiCatalog } from '../src/openapi-tools.ts'
import { projectEvaluationDecision } from '../src/evaluation-guard.ts'
import { loadDevelopmentDocs, resolveDevelopmentArtifact } from '../src/development-docs.ts'
import { resolveRequirementArtifact } from '../src/requirement-artifacts.ts'
import { resolveSolutionArtifact } from '../src/solution-artifacts.ts'
import { confirmValidationPlan, loadValidationStage, resolveValidationArtifact, waiveValidationIssue } from '../src/validation.ts'
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
    expect(value.runtime).toMatchObject({ revision: 0, status: 'stopped' })
    expect(value.apiDocs.status).toBe('unconfigured')
    expect(value.architecture).toBeNull()
    expect(value.evaluation).toMatchObject({ casesCount: 0, reports: [] })
    expect(value.requirements).toMatchObject({ requiredCount: 3, presentCount: 0 })
    expect(value.requirements.artifacts.map(item => item.status)).toEqual(['missing', 'missing', 'missing'])
    expect(value.solution).toMatchObject({ requiredCount: 5, presentCount: 0 })
    expect(value.solution.artifacts.map(item => item.status)).toEqual(['missing', 'missing', 'missing', 'missing', 'missing'])
    expect(value.development).toMatchObject({
      core: { requiredCount: 3, presentCount: 0 },
      features: [],
      closure: { requiredCount: 3, presentCount: 0 },
      issues: [],
    })
    expect(value.validation).toMatchObject({
      contract: { status: 'missing', metrics: [] },
      artifacts: { requiredCount: 3, presentCount: 0 },
      gateReady: false,
    })
  })

  it('reports only real requirement-research files as present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-requirements-'))
    const output = join(root, 'fde-deliverables', '01-requirement-research')
    await mkdir(output, { recursive: true })
    await writeFile(join(output, 'requirement-research-report.md'), '# 需求调研报告\n')
    await writeFile(join(output, 'confirmation-checklist.md'), '# 需求确认清单\n')

    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '需求项目', path: root })
    expect(value.requirements).toMatchObject({
      root: 'fde-deliverables/01-requirement-research',
      requiredCount: 3,
      presentCount: 2,
    })
    expect(value.requirements.artifacts).toEqual([
      expect.objectContaining({
        id: 'research-report', status: 'present', path: 'fde-deliverables/01-requirement-research/requirement-research-report.md',
        fileUrl: '/api/fde-project/requirements/artifact?workspaceId=w1&artifactId=research-report',
      }),
      expect.objectContaining({
        id: 'confirmation-checklist', status: 'present', path: 'fde-deliverables/01-requirement-research/confirmation-checklist.md',
        fileUrl: '/api/fde-project/requirements/artifact?workspaceId=w1&artifactId=confirmation-checklist',
      }),
      expect.objectContaining({ id: 'requirement-baseline', status: 'missing', path: 'fde-deliverables/01-requirement-research/requirement-baseline.md' }),
    ])
    expect(value.requirements.artifacts[2]).not.toHaveProperty('fileUrl')
  })

  it('resolves only fixed requirement outputs inside the registered project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-requirements-safe-'))
    const outside = await mkdtemp(join(tmpdir(), 'fde-requirements-outside-'))
    const output = join(root, 'fde-deliverables', '01-requirement-research')
    await mkdir(output, { recursive: true })
    await writeFile(join(output, 'requirement-research-report.md'), '# 项目内产物\n')
    await writeFile(join(outside, 'requirement-baseline.md'), '# 项目外文件\n')
    await symlink(join(outside, 'requirement-baseline.md'), join(output, 'requirement-baseline.md'))

    await expect(resolveRequirementArtifact(root, 'research-report')).resolves.toMatchObject({
      id: 'research-report', name: 'requirement-research-report.md',
    })
    await expect(resolveRequirementArtifact(root, '../../outside')).resolves.toBeUndefined()
    await expect(resolveRequirementArtifact(root, 'requirement-baseline')).rejects.toThrow('越过项目目录')
  })

  it('reports and resolves only the five fixed solution-design documents', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-solution-'))
    const output = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(output, { recursive: true })
    await writeFile(join(output, 'project-prd.md'), '# 项目 PRD\n')
    await writeFile(join(output, 'solution-design.md'), '# 方案设计\n')
    await writeFile(join(output, 'development-plan.md'), '# 研发计划\n')
    await writeFile(join(output, 'acceptance-plan.md'), '# 验收方案\n')
    await writeFile(join(output, 'solution-baseline.md'), '# 方案基线\n')

    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '方案项目', path: root })
    expect(value.solution).toMatchObject({
      root: 'fde-deliverables/02-solution-design',
      requiredCount: 5,
      presentCount: 5,
    })
    expect(value.solution.artifacts.map(item => item.fileUrl)).toEqual([
      '/api/fde-project/solution/artifact?workspaceId=w1&artifactId=project-prd',
      '/api/fde-project/solution/artifact?workspaceId=w1&artifactId=solution-design',
      '/api/fde-project/solution/artifact?workspaceId=w1&artifactId=development-plan',
      '/api/fde-project/solution/artifact?workspaceId=w1&artifactId=acceptance-plan',
      '/api/fde-project/solution/artifact?workspaceId=w1&artifactId=solution-baseline',
    ])
    await expect(resolveSolutionArtifact(root, 'project-prd')).resolves.toMatchObject({
      id: 'project-prd', name: 'project-prd.md',
    })
    await expect(resolveSolutionArtifact(root, 'solution-design')).resolves.toMatchObject({
      id: 'solution-design', name: 'solution-design.md',
    })
    await expect(resolveSolutionArtifact(root, '../../outside')).resolves.toBeUndefined()
  })

  it('indexes standard development docs, Feature task evidence, and close-out files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-development-docs-'))
    const feature = join(root, 'docs', 'specs', 'F001-source-ingestion')
    const closure = join(root, 'fde-deliverables', '03-project-development')
    await mkdir(feature, { recursive: true })
    await mkdir(closure, { recursive: true })
    await writeFile(join(root, 'docs', 'PRD.md'), '# 项目 PRD\n')
    await writeFile(join(root, 'docs', 'specs', 'product-spec.md'), '# 产品总规格\n')
    await writeFile(join(root, 'docs', 'specs', 'feature-map.md'), '# Feature Map\n')
    await writeFile(join(feature, 'spec.md'), `---
document: feature-spec
feature: F001
title: 数据接入
status: in-progress
planned_start: 2026-08-27
planned_end: 待确认
milestone: 完成数据源接入
---
# F001 · 数据接入
`)
    await writeFile(join(feature, 'plan.md'), '# 实施计划\n')
    await writeFile(join(feature, 'tasks.md'), `# 任务清单

- [x] T001 已有源码证据
- [x] T002 已有测试证据
- [ ] T003 待联调
`)
    await writeFile(join(closure, 'implementation-report.md'), '# 实施报告\n')
    await writeFile(join(closure, 'runbook.md'), '# 运行手册\n')

    const value = await loadDevelopmentDocs(root, 'w1')
    expect(value.core).toMatchObject({ requiredCount: 3, presentCount: 3 })
    expect(value.features).toEqual([
      expect.objectContaining({
        id: 'F001', title: '数据接入', status: 'in-progress',
        plannedStart: '2026-08-27', plannedEnd: '待确认', milestone: '完成数据源接入',
        taskTotal: 3, taskCompleted: 2,
      }),
    ])
    expect(value.features[0]?.artifacts.map(artifact => artifact.fileUrl)).toEqual([
      '/api/fde-project/development/artifact?workspaceId=w1&artifactId=feature-F001-spec',
      '/api/fde-project/development/artifact?workspaceId=w1&artifactId=feature-F001-plan',
      '/api/fde-project/development/artifact?workspaceId=w1&artifactId=feature-F001-tasks',
    ])
    expect(value.closure).toMatchObject({ requiredCount: 3, presentCount: 2 })
    await expect(resolveDevelopmentArtifact(root, 'feature-F001-tasks')).resolves.toMatchObject({
      name: 'tasks.md', path: 'docs/specs/F001-source-ingestion/tasks.md',
    })
    await expect(resolveDevelopmentArtifact(root, '../../outside')).resolves.toBeUndefined()
  })

  it('binds validation readiness to real sources, exact FDE plan confirmation, evidence, and three outputs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const evidence = join(evaluations, 'reports', 'validation-r1')
    const outputs = join(root, 'fde-deliverables', '04-validation')
    const solution = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(evidence, { recursive: true })
    await mkdir(outputs, { recursive: true })
    await mkdir(solution, { recursive: true })
    const acceptancePlan = '# 验收方案\n\nFA-1 核心冒烟\n'
    await writeFile(join(solution, 'acceptance-plan.md'), acceptancePlan)
    await writeFile(join(evidence, 'smoke.md'), '# 前后端冒烟通过\n')
    await writeFile(join(outputs, 'validation-plan.md'), '# 验证计划\n')
    await writeFile(join(outputs, 'validation-report.md'), '# 验证报告\n')
    await writeFile(join(outputs, 'validation-baseline.md'), '# 验证基线\n')
    const contract = {
      schemaVersion: 2,
      candidate: { id: 'R1', description: '本地候选版本' },
      environment: 'macOS 本地验证环境',
      datasets: [{ id: 'smoke-cases', name: '核心业务冒烟用例', version: '1' }],
      metrics: [{
        id: 'runtime-smoke', name: '前后端冒烟', category: 'functional', method: '启动服务并访问核心页面',
        threshold: '核心入口全部可用', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'] }], required: true,
        result: { status: 'PASS', value: '通过', evidence: '.fde/evaluations/reports/validation-r1/smoke.md' },
      }],
      issues: [],
    }
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify(contract))

    const value = await loadValidationStage(root, 'w1')
    expect(value).toMatchObject({
      contract: { status: 'ready', candidateId: 'R1', metrics: [{ status: 'PASS', evidenceAvailable: true, sources: [{ available: true, references: ['FA-1'] }] }] },
      artifacts: { requiredCount: 3, presentCount: 3 },
      planReady: true,
      planApproval: { status: 'pending' },
      requiredMetricCount: 1,
      satisfiedMetricCount: 1,
      gateReady: false,
    })
    expect(value.contract.digest).toMatch(/^sha256:[a-f0-9]{64}$/u)
    const confirmed = await confirmValidationPlan(root, value.contract.digest ?? '')
    expect(confirmed).toMatchObject({ planApproval: { status: 'confirmed' }, gateReady: true, blockers: [] })
    const executingContract = {
      ...contract,
      metrics: contract.metrics.map(metric => ({ ...metric, result: { status: 'NOT_RUN', note: '开始执行本轮验证。' } })),
    }
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify(executingContract))
    await expect(loadValidationStage(root)).resolves.toMatchObject({ planApproval: { status: 'confirmed' }, gateReady: false })
    await writeFile(join(solution, 'acceptance-plan.md'), `${acceptancePlan}\nFA-2 新增边界\n`)
    await expect(loadValidationStage(root)).resolves.toMatchObject({ planApproval: { status: 'stale' }, gateReady: false })
    await writeFile(join(solution, 'acceptance-plan.md'), acceptancePlan)
    await expect(loadValidationStage(root)).resolves.toMatchObject({ planApproval: { status: 'confirmed' }, gateReady: false })
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify({ ...executingContract, environment: '变更后的环境' }))
    await expect(loadValidationStage(root)).resolves.toMatchObject({ planApproval: { status: 'stale' }, gateReady: false })
    expect(value.artifacts.items.map(item => item.fileUrl)).toEqual([
      '/api/fde-project/validation/artifact?workspaceId=w1&artifactId=validation-plan',
      '/api/fde-project/validation/artifact?workspaceId=w1&artifactId=validation-report',
      '/api/fde-project/validation/artifact?workspaceId=w1&artifactId=validation-baseline',
    ])
    await expect(resolveValidationArtifact(root, 'validation-report')).resolves.toMatchObject({ name: 'validation-report.md' })
    await expect(resolveValidationArtifact(root, '../../outside')).resolves.toBeUndefined()
  })

  it('keeps validation blocked when required evidence or an accepted warning reason is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-blocked-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const solution = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(evaluations, { recursive: true })
    await mkdir(solution, { recursive: true })
    await writeFile(join(solution, 'acceptance-plan.md'), '# 验收方案\n\nPA-1 性能\n')
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify({
      schemaVersion: 2,
      candidate: { id: 'R2' },
      environment: '待验证环境',
      metrics: [{
        id: 'latency', name: '响应时延', category: 'performance', method: '固定请求集压测',
        threshold: 'P95 小于 2 秒', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['PA-1'] }], required: true,
        result: { status: 'WARN', value: 'P95 2.1 秒', evidence: '.fde/evaluations/reports/missing.md' },
      }],
      issues: [{ id: 'deploy-risk', title: '部署脚本未验证', severity: 'high', status: 'open' }],
    }))
    const value = await loadValidationStage(root)
    expect(value.gateReady).toBe(false)
    expect(value.blockers).toEqual(expect.arrayContaining([
      '必需指标“响应时延”缺少可读取证据。',
      '必需指标“响应时延”的 WARN 尚无接受理由。',
      '关键问题“部署脚本未验证”尚未处理。',
      '验证计划尚未生成。',
      '验证报告尚未生成。',
      '验证基线尚未生成。',
    ]))
  })

  it('lets an FDE accept one current open issue without changing metric results', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-waive-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const evidence = join(evaluations, 'reports', 'validation-r1')
    const outputs = join(root, 'fde-deliverables', '04-validation')
    const solution = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(evidence, { recursive: true })
    await mkdir(outputs, { recursive: true })
    await mkdir(solution, { recursive: true })
    await writeFile(join(solution, 'acceptance-plan.md'), '# 验收方案\n\nFA-1 核心流程\n')
    await writeFile(join(evidence, 'smoke.md'), '# 核心流程通过\n')
    for (const name of ['validation-plan.md', 'validation-report.md', 'validation-baseline.md']) {
      await writeFile(join(outputs, name), `# ${name}\n`)
    }
    const contractPath = join(evaluations, 'validation.json')
    await writeFile(contractPath, JSON.stringify({
      schemaVersion: 2,
      candidate: { id: 'R1' },
      environment: 'macOS 本地验证环境',
      metrics: [{
        id: 'runtime-smoke', name: '核心流程', category: 'functional', method: '执行核心流程',
        threshold: '全部通过', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'] }],
        required: true, result: { status: 'PASS', evidence: '.fde/evaluations/reports/validation-r1/smoke.md' },
      }],
      issues: [{
        id: 'customer-reconciliation', title: '客户对账结果待补充', severity: 'high', status: 'open',
        resolution: '需要客户提供真实对账结果。',
      }],
    }))

    const before = await loadValidationStage(root)
    const digest = before.contract.digest ?? ''
    await confirmValidationPlan(root, digest)
    expect((await loadValidationStage(root)).gateReady).toBe(false)
    const after = await waiveValidationIssue(root, digest, 'customer-reconciliation', '客户确认本轮先按现有样例验收，真实对账延后补充。')
    expect(after).toMatchObject({
      contract: {
        metrics: [{ id: 'runtime-smoke', status: 'PASS' }],
        issues: [{
          id: 'customer-reconciliation', status: 'waived',
          resolution: '需要客户提供真实对账结果。',
          waiverReason: '客户确认本轮先按现有样例验收，真实对账延后补充。',
        }],
      },
      planApproval: { status: 'confirmed' },
      gateReady: true,
      blockers: [],
    })
    expect(Date.parse(after.contract.issues[0]?.waivedAt ?? '')).not.toBeNaN()
    await expect(waiveValidationIssue(root, digest, 'customer-reconciliation', '重复接受')).rejects.toThrow('已经处理')

    const changed = JSON.parse(await readFile(contractPath, 'utf8')) as { environment: string; issues: Record<string, unknown>[] }
    changed.environment = '已经变化的验证环境'
    const changedIssue = changed.issues[0]
    if (changedIssue === undefined) throw new Error('expected validation issue')
    delete changedIssue.waiverReason
    delete changedIssue.waivedAt
    changed.issues[0] = { ...changedIssue, status: 'open' }
    await writeFile(contractPath, JSON.stringify(changed))
    await expect(waiveValidationIssue(root, digest, 'customer-reconciliation', '使用过期方案接受')).rejects.toThrow('评估方案已经变化')
  })

  it('keeps valid project and metric facts visible when one metric result is malformed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-partial-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const evidence = join(evaluations, 'reports', 'validation-r3')
    const outputs = join(root, 'fde-deliverables', '04-validation')
    const solution = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(evidence, { recursive: true })
    await mkdir(outputs, { recursive: true })
    await mkdir(solution, { recursive: true })
    await writeFile(join(solution, 'acceptance-plan.md'), '# 验收方案\n\nFA-1 核心验证\nFA-2 恢复验证\n')
    await writeFile(join(evidence, 'smoke.md'), '# 核心验证通过\n')
    for (const name of ['validation-plan.md', 'validation-report.md', 'validation-baseline.md']) {
      await writeFile(join(outputs, name), `# ${name}\n`)
    }
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify({
      schemaVersion: 2,
      candidate: { id: 'R3', description: '部分字段损坏的候选版本' },
      environment: 'macOS 本地验证环境',
      datasets: [{ id: 'smoke-data', name: '冒烟数据' }],
      metrics: [{
        id: 'runtime-smoke', name: '核心验证', category: 'functional', method: '执行核心路径',
        threshold: '核心路径可用', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'] }],
        required: true, result: { status: 'PASS', evidence: '.fde/evaluations/reports/validation-r3/smoke.md' },
      }, {
        id: 'restore', name: '恢复验证', category: 'recovery', method: '执行恢复路径',
        threshold: '可以恢复', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-2'] }],
        required: true, result: { status: 'PASS', evidence: ['first.md', 'second.md'] },
      }],
      issues: [],
    }))

    const value = await loadValidationStage(root, 'w1')
    expect(value).toMatchObject({
      contract: {
        status: 'invalid', candidateId: 'R3', environment: 'macOS 本地验证环境',
        datasets: [{ id: 'smoke-data' }], metrics: [{ id: 'runtime-smoke', status: 'PASS' }],
      },
      artifacts: { requiredCount: 3, presentCount: 3 },
      planReady: false,
      planApproval: { status: 'unavailable' },
      gateReady: false,
    })
    expect(value.contract.message).toContain('metrics[1].result.evidence 必须是非空文字')
    expect(value.contract).not.toHaveProperty('digest')
    expect(value.blockers[0]).toContain('验证合同包含 1 个无效指标')
  })

  it('does not allow FDE confirmation while a metric source is unreadable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-source-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const outputs = join(root, 'fde-deliverables', '04-validation')
    await mkdir(evaluations, { recursive: true })
    await mkdir(outputs, { recursive: true })
    await writeFile(join(outputs, 'validation-plan.md'), '# 验证计划\n')
    await writeFile(join(evaluations, 'validation.json'), JSON.stringify({
      schemaVersion: 2,
      candidate: { id: 'R3' },
      environment: '本地环境',
      metrics: [{
        id: 'source-check', name: '来源校验', category: 'business', method: '核对来源', threshold: '来源存在',
        sources: [{ path: 'fde-deliverables/02-solution-design/missing.md', references: ['BA-1'] }],
        required: true, result: { status: 'NOT_RUN' },
      }],
      issues: [],
    }))
    const value = await loadValidationStage(root)
    expect(value).toMatchObject({
      contract: { status: 'ready', metrics: [{ sources: [{ available: false }] }] },
      planReady: false,
      planApproval: { status: 'unavailable' },
    })
    expect(value.planBlockers).toContain('指标“来源校验”的来源文件不可读取：fde-deliverables/02-solution-design/missing.md。')
    await expect(confirmValidationPlan(root, value.contract.digest ?? '')).rejects.toThrow('来源文件不可读取')
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
