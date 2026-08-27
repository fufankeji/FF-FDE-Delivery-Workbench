import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  listProjectSources,
  parseProjectSource,
  registerStoredProjectResources,
  storeProjectResourceBatch,
} from '@deepseek-ai/dsh-fde-source'
import {
  abandonRequirementWikiBuild,
  loadRequirementWikiSnapshot,
  markRequirementWikiBuildRunning,
  publishRequirementWiki,
  readCurrentRequirementWiki,
  startRequirementWikiBuild,
} from '../src/requirement-wiki.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function workspace(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'fde-requirement-wiki-'))
  roots.push(root)
  return root
}

async function readySource(root: string, name: string, content: string) {
  const stored = await storeProjectResourceBatch(root, [{ name, data: Buffer.from(content) }])
  const [record] = await registerStoredProjectResources(root, stored)
  if (record === undefined) throw new Error('test source was not registered')
  return await parseProjectSource(root, record.sourceId)
}

function candidate(sourceIds: readonly string[]) {
  return {
    pages: [
      {
        id: 'business_goal', topic: 'business-goal', title: '客户业务目标',
        summary: '统一项目资料中的目标。', body: '降低人工交付遗漏，并保留来源追溯。', sourceIds,
      },
      {
        id: 'acceptance_rule', topic: 'acceptance', title: '验收方向',
        body: '每个交付结果都需要可读取证据。', sourceIds,
      },
    ],
    relations: [{
      id: 'goal_validated_by_acceptance', from: 'business_goal', to: 'acceptance_rule',
      type: 'validates', label: '由验收方向验证', directed: true, sourceIds,
    }],
    conflicts: [{
      id: 'delivery_conflict', title: '交付时间存在冲突', detail: '两份资料给出了不同日期。',
      impact: '需要客户确认排期。', pageIds: ['business_goal'], sourceIds,
    }],
    unknowns: [{
      id: 'owner_unknown', title: '最终验收人未明确', detail: '当前资料没有给出最终验收角色。',
      pageIds: ['acceptance_rule'], sourceIds,
    }],
  }
}

describe('project requirement Wiki with real Source records', () => {
  it('publishes one immutable revision from parsed project files and detects later source changes', async () => {
    const root = await workspace()
    const brief = await readySource(root, '客户需求.txt', '目标：降低人工交付遗漏。')
    const meeting = await readySource(root, '会议纪要.md', '# 验收\n每项结果需要证据。')
    const sourceIds = [brief.sourceId, meeting.sourceId]

    await expect(loadRequirementWikiSnapshot(root)).resolves.toMatchObject({ status: 'absent', current: null })
    const queued = await startRequirementWikiBuild(root, sourceIds, 0)
    expect(queued).toMatchObject({ status: 'queued', expectedRevision: 0 })
    expect(queued.sources.map(source => source.derivedPath)).toEqual([
      `.fde/derived/${brief.sourceId}.md`,
      `.fde/derived/${meeting.sourceId}.md`,
    ])
    await expect(markRequirementWikiBuildRunning(root, queued.id)).resolves.toMatchObject({ status: 'running' })

    const published = await publishRequirementWiki(root, queued.id, 0, candidate(sourceIds), 'test-project-agent')
    expect(published).toMatchObject({ revision: 1, buildId: queued.id, generatedBy: 'test-project-agent' })
    expect(published.pages).toHaveLength(2)
    await expect(readCurrentRequirementWiki(root)).resolves.toEqual(published)
    await expect(loadRequirementWikiSnapshot(root)).resolves.toMatchObject({
      status: 'ready', current: { revision: 1 }, build: { status: 'succeeded', publishedRevision: 1 },
    })
    expect(await readFile(join(root, '.fde', 'requirement-wiki', 'versions', 'R000001', 'pages', 'business_goal.md'), 'utf8'))
      .toBe('降低人工交付遗漏，并保留来源追溯。\n')

    await writeFile(join(root, 'fde-resources', '新增说明.txt'), '新来源尚未识别')
    await listProjectSources(root)
    await expect(loadRequirementWikiSnapshot(root)).resolves.toMatchObject({ status: 'stale', current: { revision: 1 } })

    const update = await startRequirementWikiBuild(root, [brief.sourceId], 1)
    await expect(abandonRequirementWikiBuild(root, update.id)).resolves.toMatchObject({ status: 'cancelled' })
    await expect(loadRequirementWikiSnapshot(root)).resolves.toMatchObject({
      status: 'stale', current: { revision: 1 }, build: { status: 'cancelled' },
    })
  })

  it('rejects pending, changed, untraceable, and cross-project inputs without replacing the current revision', async () => {
    const alpha = await workspace()
    const beta = await workspace()
    const stored = await storeProjectResourceBatch(alpha, [{ name: 'pending.txt', data: Buffer.from('pending') }])
    const [pending] = await registerStoredProjectResources(alpha, stored)
    if (pending === undefined) throw new Error('test source was not registered')
    await expect(startRequirementWikiBuild(alpha, [pending.sourceId], 0)).rejects.toThrow('尚未形成当前有效派生文本')
    await expect(startRequirementWikiBuild(beta, [pending.sourceId], 0)).rejects.toThrow('不属于当前项目')

    const ready = await parseProjectSource(alpha, pending.sourceId)
    const firstBuild = await startRequirementWikiBuild(alpha, [ready.sourceId], 0)
    await writeFile(join(alpha, ready.relativePath), 'changed while building')
    await expect(publishRequirementWiki(alpha, firstBuild.id, 0, candidate([ready.sourceId]), 'agent'))
      .rejects.toThrow('整理期间已经变化')
    await expect(loadRequirementWikiSnapshot(alpha)).resolves.toMatchObject({
      status: 'absent', current: null, build: { status: 'failed' },
    })
    await expect(markRequirementWikiBuildRunning(alpha, firstBuild.id)).rejects.toThrow('已经失败')

    const reparsed = await parseProjectSource(alpha, ready.sourceId)
    const invalidBuild = await startRequirementWikiBuild(alpha, [reparsed.sourceId], 0)
    const invalid = candidate([reparsed.sourceId])
    invalid.pages[0]!.sourceIds = ['src_not_from_this_build']
    await expect(publishRequirementWiki(alpha, invalidBuild.id, 0, invalid, 'agent'))
      .rejects.toThrow('本次输入之外')
    await expect(loadRequirementWikiSnapshot(alpha)).resolves.toMatchObject({ build: { status: 'failed' } })

    const finalBuild = await startRequirementWikiBuild(alpha, [reparsed.sourceId], 0)
    const current = await publishRequirementWiki(alpha, finalBuild.id, 0, candidate([reparsed.sourceId]), 'agent')
    expect(current.revision).toBe(1)

    const staleRevisionBuild = await startRequirementWikiBuild(alpha, [reparsed.sourceId], 1)
    await expect(publishRequirementWiki(alpha, staleRevisionBuild.id, 0, candidate([reparsed.sourceId]), 'agent'))
      .rejects.toThrow('expectedRevision 不一致')
    await expect(readCurrentRequirementWiki(alpha)).resolves.toMatchObject({ revision: 1, buildId: finalBuild.id })
  })
})
