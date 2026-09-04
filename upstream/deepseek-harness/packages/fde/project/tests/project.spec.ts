import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProjectOpenApiCatalog } from '../src/openapi-tools.ts'
import { projectEvaluationDecision } from '../src/evaluation-guard.ts'
import { loadDevelopmentDocs, resolveDevelopmentArtifact } from '../src/development-docs.ts'
import { resolveRequirementArtifact } from '../src/requirement-artifacts.ts'
import { resolveSolutionArtifact } from '../src/solution-artifacts.ts'
import { loadV2StageSurface } from '../src/v2-stage-surface.ts'
import {
  acceptValidationMetric, confirmValidationPlan, loadValidationStage, resolveValidationArtifact, waiveValidationIssue,
} from '../src/validation.ts'
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

const discoveryEvidence = (id: string, state: 'confirmed' | 'inferred' | 'unverified' = 'unverified') => ({
  id,
  state,
  kind: 'conversation',
  ref: 'session:test#turn-1',
  summary: '用户在当前对话中描述了候选工作流，仍需现场核对。',
})

const guideSource = (artifact: string) => ({
  id: 'davidahmann/fde-guide',
  version: '060ef0f3',
  commit: '060ef0f3b67743b2e1fc3705763d423eae980236',
  license: 'Apache-2.0',
  artifact,
})

const localSource = {
  id: 'ff-fde-workbench/discovery-contract',
  version: 'F005-v2',
  commit: 'product-spec/F005',
  license: 'project',
  artifact: 'fact-confirmation-list',
}

describe('FDE project surface snapshot', () => {
  it('derives one V2 stage from real files and blocks review on unresolved high-risk facts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-v2-definition-'))
    const outputs = join(root, 'fde-deliverables', '02-outcome-scope')
    const states = join(root, '.fde', 'stages')
    await mkdir(outputs, { recursive: true })
    await mkdir(states, { recursive: true })
    for (const name of ['outcome-contract.md', 'value-case.md', 'delivery-plan.md']) {
      await writeFile(join(outputs, name), `# ${name}\n`)
    }
    await writeFile(join(states, 'definition.json'), JSON.stringify({
      schemaVersion: 1,
      stage: 'definition',
      status: 'review-ready',
      workItems: [
        { id: 'baseline', status: 'complete' }, { id: 'outcome', status: 'complete' },
        { id: 'scope', status: 'complete' }, { id: 'ownership', status: 'complete' },
      ],
      blockers: [{ id: 'owner', title: '客户尚未确认最终验证人', severity: 'high', status: 'open' }],
      recommendation: 'go',
    }))

    const blocked = await loadV2StageSurface(root, 'definition')
    expect(blocked).toMatchObject({
      stateStatus: 'ready', status: 'blocked', presentCount: 3, requiredCount: 3, reviewReady: false,
      reviewBlockers: ['客户尚未确认最终验证人'], recommendation: 'go',
    })
    expect(blocked.workItems.every(item => item.status === 'complete')).toBe(true)

    await writeFile(join(states, 'definition.json'), JSON.stringify({
      schemaVersion: 1,
      stage: 'definition',
      status: 'review-ready',
      workItems: blocked.workItems,
      blockers: [
        { id: 'owner', title: '客户尚未确认最终验证人', severity: 'high', status: 'resolved' },
        { id: 'baseline-data', title: '基线数据仍待客户核对', severity: 'medium', status: 'open' },
      ],
      recommendation: 'go',
    }))
    await expect(loadV2StageSurface(root, 'definition')).resolves.toMatchObject({
      status: 'review-ready', presentCount: 3, reviewReady: true, reviewBlockers: [],
      blockers: [
        { id: 'owner', severity: 'high', status: 'resolved' },
        { id: 'baseline-data', severity: 'medium', status: 'open' },
      ],
    })

    await writeFile(join(states, 'definition.json'), JSON.stringify({
      schemaVersion: 1,
      stage: 'outcome-scope',
      status: 'review-ready',
      workItems: blocked.workItems,
      blockers: [],
      recommendation: 'go',
    }))
    await expect(loadV2StageSurface(root, 'definition')).resolves.toMatchObject({
      stateStatus: 'invalid', status: 'blocked', reviewReady: false,
      reviewBlockers: ['阶段状态文件无法读取：stage 必须是 definition。'],
    })

    await writeFile(join(states, 'definition.json'), JSON.stringify({
      schemaVersion: 1,
      stage: 'definition',
      status: 'working',
      workItems: { baseline: 'complete', outcome: 'current', scope: 'waiting', ownership: 'waiting' },
      blockers: [],
      recommendation: 'pending',
    }))
    const invalidShape = await loadV2StageSurface(root, 'definition')
    expect(invalidShape).toMatchObject({
      stateStatus: 'invalid', status: 'blocked', reviewReady: false,
      reviewBlockers: ['阶段状态文件无法读取：workItems 必须是数组，不能写成对象映射。'],
    })
    expect(invalidShape.workItems.map(item => item.status)).toEqual(['current', 'waiting', 'waiting', 'waiting'])
  })

  it('keeps unconfigured project surfaces honest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-empty-'))
    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '空白项目', path: root })
    expect(value.runtime).toMatchObject({ revision: 0, status: 'stopped' })
    expect(value.apiDocs.status).toBe('unconfigured')
    expect(value.architecture).toBeNull()
    expect(value.evaluation).toMatchObject({ casesCount: 0, reports: [] })
    expect(value.requirements).toMatchObject({ requiredCount: 3, presentCount: 0 })
    expect(value.requirements.artifacts.map(item => item.status)).toEqual(['missing', 'missing', 'missing'])
    expect(value.discovery).toMatchObject({
      status: 'collecting', currentWorkId: 'collect-originals', presentCount: 0, requiredCount: 3,
      reviewReady: false,
      workflows: { status: 'missing', path: '.fde/discovery/workflows.json', items: [] },
    })
    expect(value.discovery.workItems.map(item => item.status)).toEqual(['current', 'waiting', 'waiting', 'waiting'])
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

  it('projects structured investigation facts and rejects relationships to unknown nodes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-v2-investigation-'))
    const outputs = join(root, 'fde-deliverables', '03-environment')
    const states = join(root, '.fde', 'stages')
    await mkdir(outputs, { recursive: true })
    await mkdir(states, { recursive: true })
    for (const name of ['data-readiness.md', 'system-access-map.md', 'governance-review.md']) {
      await writeFile(join(outputs, name), `# ${name}\n`)
    }
    const state = {
      schemaVersion: 1,
      stage: 'investigation',
      status: 'working',
      workItems: [
        { id: 'data', status: 'complete' }, { id: 'systems', status: 'current' },
        { id: 'access', status: 'waiting' }, { id: 'owners', status: 'waiting' },
      ],
      blockers: [],
      recommendation: 'pending',
      investigation: {
        systems: [
          { id: 'tickets', label: '历史工单', kind: 'data', status: 'confirmed', owner: '售后主管' },
          { id: 'sandbox', label: '工单 Sandbox', kind: 'system', status: 'conditional' },
        ],
        connections: [{ from: 'tickets', to: 'sandbox', label: '只读样本' }],
        actionBoundaries: [{
          target: '工单 Sandbox', read: 'allowed', suggest: 'allowed',
          draft: 'conditional', execute: 'denied',
        }],
        dataFindings: [{ label: '设备 ID 缺失率', value: '17%', status: 'warning' }],
        governanceReviews: [{ area: 'security', status: 'conditional', owner: '信息安全' }],
      },
    }
    await writeFile(join(states, 'investigation.json'), JSON.stringify(state))

    await expect(loadV2StageSurface(root, 'investigation')).resolves.toMatchObject({
      stateStatus: 'ready',
      investigation: {
        systems: [{ id: 'tickets', status: 'confirmed' }, { id: 'sandbox', status: 'conditional' }],
        connections: [{ from: 'tickets', to: 'sandbox', label: '只读样本' }],
        actionBoundaries: [{ target: '工单 Sandbox', execute: 'denied' }],
        dataFindings: [{ label: '设备 ID 缺失率', value: '17%', status: 'warning' }],
        governanceReviews: [{ area: 'security', status: 'conditional', owner: '信息安全' }],
      },
    })

    await writeFile(join(states, 'investigation.json'), JSON.stringify({
      ...state,
      status: 'review-ready',
      recommendation: 'go',
    }))
    await expect(loadV2StageSurface(root, 'investigation')).resolves.toMatchObject({
      status: 'blocked',
      reviewReady: false,
      reviewBlockers: ['阶段工作项尚未全部完成'],
    })

    await writeFile(join(states, 'investigation.json'), JSON.stringify({
      schemaVersion: 1,
      stage: 'investigation',
      status: 'review-ready',
      workItems: state.workItems.map(item => ({ ...item, status: 'complete' })),
      blockers: [],
      recommendation: 'go',
    }))
    await expect(loadV2StageSurface(root, 'investigation')).resolves.toMatchObject({
      stateStatus: 'ready',
      status: 'blocked',
      reviewReady: false,
      reviewBlockers: ['环境调查驾驶舱尚未形成结构化记录'],
    })

    await writeFile(join(states, 'investigation.json'), JSON.stringify({
      ...state,
      investigation: { ...state.investigation, connections: [{ from: 'tickets', to: 'production' }] },
    }))
    await expect(loadV2StageSurface(root, 'investigation')).resolves.toMatchObject({
      stateStatus: 'invalid',
      reviewBlockers: ['阶段状态文件无法读取：investigation.connections[0] 必须引用已登记的系统节点。'],
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
    expect(value.discovery).toMatchObject({
      status: 'collecting', currentWorkId: 'collect-originals', presentCount: 0, reviewReady: false,
    })
    expect(value.discovery.artifacts.map(item => [item.title, item.status, item.required, item.structureState])).toEqual([
      ['现场观察记录', 'present', true, 'invalid'],
      ['事实确认清单', 'present', true, 'invalid'],
      ['工作流章程', 'missing', true, 'missing'],
      ['项目重新界定记录', 'missing', false, 'not_applicable'],
    ])
    expect(value.discovery.blockers).toContain('文件已存在，但尚未登记 Artifact 来源、版本、结构与证据。')
  })

  it('projects persisted candidate workflows without inventing missing evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-discovery-workflows-'))
    const state = join(root, '.fde', 'discovery')
    await mkdir(state, { recursive: true })
    await writeFile(join(state, 'workflows.json'), JSON.stringify({
      schemaVersion: 2,
      selectedWorkflowId: 'refund-review',
      workflows: [{
        id: 'refund-review', title: '退款申请复核', actor: '售后专员', trigger: '客户发起退款申请',
        problem: '需要跨三个系统核对订单与履约状态，处理时间长且容易漏项。', disposition: 'selected',
        evidenceRefs: [
          discoveryEvidence('ev-1', 'confirmed'),
          discoveryEvidence('ev-2', 'confirmed'),
          discoveryEvidence('ev-3', 'inferred'),
          discoveryEvidence('ev-4', 'unverified'),
        ],
      }],
    }))

    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(value.discovery.workflows).toEqual({
      path: '.fde/discovery/workflows.json', status: 'ready', selectedWorkflowId: 'refund-review',
      items: [{
        id: 'refund-review', title: '退款申请复核', actor: '售后专员', trigger: '客户发起退款申请',
        problem: '需要跨三个系统核对订单与履约状态，处理时间长且容易漏项。', disposition: 'selected',
        evidence: { confirmed: 2, inferred: 1, unverified: 1 },
        evidenceRefs: [
          discoveryEvidence('ev-1', 'confirmed'),
          discoveryEvidence('ev-2', 'confirmed'),
          discoveryEvidence('ev-3', 'inferred'),
          discoveryEvidence('ev-4', 'unverified'),
        ],
      }],
    })
  })

  it('reports an invalid workflow catalog instead of presenting an empty success state', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-discovery-invalid-'))
    const state = join(root, '.fde', 'discovery')
    await mkdir(state, { recursive: true })
    await writeFile(join(state, 'workflows.json'), JSON.stringify({ schemaVersion: 2, workflows: [{ id: 'missing-fields' }] }))

    const value = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(value.discovery.workflows).toMatchObject({ status: 'invalid', items: [] })
    expect(value.discovery.workflows.message).toContain('disposition 无效')
  })

  it('requires pinned Artifact metadata, real Markdown structure, and claim-level evidence before review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-discovery-artifacts-'))
    const output = join(root, 'fde-deliverables', '01-requirement-research')
    const state = join(root, '.fde', 'discovery')
    await mkdir(output, { recursive: true })
    await mkdir(state, { recursive: true })
    await writeFile(join(output, 'requirement-research-report.md'), '# 现场观察记录\n\n## 来源事实\n- 待核对\n\n## 代表案例\n- 退款复核\n\n## 现场观察\n- 尚未现场观察\n\n## 未验证事项\n- 系统行为\n')
    await writeFile(join(output, 'confirmation-checklist.md'), '# 事实确认清单\n\n## 待确认事项\n- 系统行为\n\n## 已确认事项\n- 客户诉求\n\n## 决策权\n- 业务负责人\n')
    await writeFile(join(output, 'requirement-baseline.md'), '# 工作流章程\n\n## 候选工作流\n退款复核\n\n## 业务结果\n缩短处理时间\n\n## 现状基线\n尚未测量\n\n## 范围与非目标\n仅退款复核\n\n## 人工回退\n人工处理\n\n## 停止条件\n错误率超限\n')
    await writeFile(join(state, 'workflows.json'), JSON.stringify({
      schemaVersion: 2,
      selectedWorkflowId: 'refund-review',
      workflows: [{
        id: 'refund-review', title: '退款申请复核', actor: '售后专员', trigger: '客户发起退款申请',
        problem: '跨系统核对耗时且容易漏项。', disposition: 'selected', evidenceRefs: [discoveryEvidence('workflow-1')],
      }],
    }))
    const records = [
      { id: 'research-report', version: 1, contentPath: 'fde-deliverables/01-requirement-research/requirement-research-report.md', sourceAdapter: guideSource('field-observation-log') },
      { id: 'confirmation-checklist', version: 1, contentPath: 'fde-deliverables/01-requirement-research/confirmation-checklist.md', sourceAdapter: localSource },
      { id: 'requirement-baseline', version: 1, contentPath: 'fde-deliverables/01-requirement-research/requirement-baseline.md', sourceAdapter: guideSource('workflow-charter') },
    ].map((item, index) => ({
      ...item,
      structureState: 'starter_valid',
      evidenceState: 'unverified',
      evidenceRefs: [discoveryEvidence(`artifact-${String(index + 1)}`)],
      inputRefs: ['session:test#turn-1'],
      decisionRefs: [],
      supersedes: [],
    }))
    await writeFile(join(state, 'artifacts.json'), JSON.stringify({ schemaVersion: 1, artifacts: records }))

    const ready = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(ready.discovery).toMatchObject({ status: 'ready-for-review', presentCount: 3, reviewReady: true, blockers: [] })
    expect(ready.discovery.artifacts.slice(0, 3).map(item => [item.structureState, item.version, item.evidenceRefs.length])).toEqual([
      ['starter_valid', 1, 1], ['starter_valid', 1, 1], ['starter_valid', 1, 1],
    ])
    expect(ready.discovery.route.primaryMethod).toMatchObject({ skill: 'qualify-ai-workflow', layer: 'method' })
    expect(ready.discovery.route.engineering.map(item => item.skill)).toEqual(['fde-orient', 'knowledge-interview', 'ownership-map', 'repo-recon', 'stakeholder-brief'])

    await writeFile(join(state, 'artifacts.json'), JSON.stringify({
      schemaVersion: 1,
      artifacts: [...records, {
        id: 'scope-decision-brief',
        contentPath: 'fde-deliverables/01-requirement-research/scope-decision-brief.md',
        structureState: 'starter_valid',
      }],
    }))
    const withSupplementalFile = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(withSupplementalFile.discovery).toMatchObject({
      status: 'ready-for-review', presentCount: 3, reviewReady: true, blockers: [],
    })

    const compatibleRecords = records.map((item, index) => ({
      ...item,
      ...(index === 0 ? { id: 'requirement-research-report' } : {}),
      evidenceRefs: ['workflow-1'],
      supersedes: null,
    }))
    await writeFile(join(state, 'artifacts.json'), JSON.stringify({ schemaVersion: 1, artifacts: compatibleRecords }))
    const compatible = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(compatible.discovery).toMatchObject({ status: 'ready-for-review', presentCount: 3, reviewReady: true, blockers: [] })
    expect(compatible.discovery.artifacts[0]).toMatchObject({ id: 'research-report', status: 'present', structureState: 'starter_valid' })

    records[2] = { ...records[2]!, sourceAdapter: { ...guideSource('workflow-charter'), commit: 'unreviewed' } }
    await writeFile(join(state, 'artifacts.json'), JSON.stringify({ schemaVersion: 1, artifacts: records }))
    const invalid = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '发现项目', path: root })
    expect(invalid.discovery).toMatchObject({ presentCount: 0, reviewReady: false })
    expect(invalid.discovery.artifacts.slice(0, 3).map(item => item.structureState)).toEqual(['invalid', 'invalid', 'invalid'])
    expect(invalid.discovery.blockers[0]).toContain('Artifact Catalog 无效')
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

  it('lets an FDE accept one unmet required metric without rewriting its real result', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-validation-accept-metric-'))
    const evaluations = join(root, '.fde', 'evaluations')
    const evidence = join(evaluations, 'reports', 'validation-r1')
    const outputs = join(root, 'fde-deliverables', '04-validation')
    const solution = join(root, 'fde-deliverables', '02-solution-design')
    await mkdir(evidence, { recursive: true })
    await mkdir(outputs, { recursive: true })
    await mkdir(solution, { recursive: true })
    await writeFile(join(solution, 'acceptance-plan.md'), '# 验收方案\n\nFA-1 核心流程\nPA-1 性能基线\n')
    await writeFile(join(evidence, 'smoke.md'), '# 核心流程通过\n')
    for (const name of ['validation-plan.md', 'validation-report.md', 'validation-baseline.md']) {
      await writeFile(join(outputs, name), `# ${name}\n`)
    }
    const contractPath = join(evaluations, 'validation.json')
    const contract = {
      schemaVersion: 2,
      candidate: { id: 'R1' },
      environment: 'macOS 本地验证环境',
      metrics: [{
        id: 'runtime-smoke', name: '核心流程', category: 'functional', method: '执行核心流程',
        threshold: '全部通过', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'] }],
        required: true, result: { status: 'PASS', evidence: '.fde/evaluations/reports/validation-r1/smoke.md' },
      }, {
        id: 'million-row-performance', name: '百万行查询性能', category: 'performance', method: '正式设备压测',
        threshold: 'P95 小于 2 秒', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['PA-1'] }],
        required: true, result: { status: 'NOT_RUN', note: '正式性能设备尚未到位。' },
      }, {
        id: 'optional-export', name: '可选导出检查', category: 'functional', method: '手工导出',
        threshold: '文件可下载', sources: [{ path: 'fde-deliverables/02-solution-design/acceptance-plan.md', references: ['FA-1'] }],
        required: false, result: { status: 'NOT_RUN' },
      }],
      issues: [],
    }
    await writeFile(contractPath, JSON.stringify(contract))

    const before = await loadValidationStage(root)
    const digest = before.contract.digest ?? ''
    await confirmValidationPlan(root, digest)
    expect((await loadValidationStage(root))).toMatchObject({ satisfiedMetricCount: 1, gateReady: false })
    const accepted = await acceptValidationMetric(
      root, digest, 'million-row-performance', '客户确认本轮不提供正式性能设备，部署试运行阶段补测并回填证据。',
    )
    expect(accepted).toMatchObject({
      contract: { metrics: [
        { id: 'runtime-smoke', status: 'PASS', evidenceAvailable: true },
        {
          id: 'million-row-performance', status: 'NOT_RUN', evidenceAvailable: false,
          note: '正式性能设备尚未到位。',
          manualAcceptance: { reason: '客户确认本轮不提供正式性能设备，部署试运行阶段补测并回填证据。' },
        },
        { id: 'optional-export', status: 'NOT_RUN' },
      ] },
      planApproval: { status: 'confirmed' },
      requiredMetricCount: 2,
      satisfiedMetricCount: 2,
      gateReady: true,
      blockers: [],
    })
    expect(Date.parse(accepted.contract.metrics[1]?.manualAcceptance?.acceptedAt ?? '')).not.toBeNaN()
    await expect(acceptValidationMetric(root, digest, 'million-row-performance', '重复接受')).rejects.toThrow('已经由 FDE 人工接受')
    await expect(acceptValidationMetric(root, digest, 'optional-export', '接受可选项')).rejects.toThrow('只有必需指标')
    await expect(acceptValidationMetric(root, digest, 'runtime-smoke', '接受已通过项')).rejects.toThrow('已经通过正常结果和证据')

    const changed = JSON.parse(await readFile(contractPath, 'utf8')) as typeof contract
    changed.environment = '已经变化的验证环境'
    await writeFile(contractPath, JSON.stringify(changed))
    await expect(acceptValidationMetric(root, digest, 'million-row-performance', '使用过期方案接受')).rejects.toThrow('评估方案已经变化')
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
