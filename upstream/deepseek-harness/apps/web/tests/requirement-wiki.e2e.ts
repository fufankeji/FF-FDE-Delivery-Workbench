// Web e2e scenario: the shipped FDE project page reads one immutable Wiki
// revision built from two real parsed project Sources, renders the Three.js
// Galaxy View, and keeps the same graph available as a keyboard-readable list.
// The graph scenario seeds the durable Agent result directly. The prompt
// scenario deliberately reaches the fixture-less route-only adapter: no
// external model runs, while the real Session log pins the exact queued input.

import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from 'vitest'
import {
  parseProjectSource,
  registerStoredProjectResources,
  storeProjectResourceBatch,
} from '@deepseek-ai/dsh-fde-source'
import {
  abandonRequirementWikiBuild,
  loadRequirementWikiSnapshot,
  markRequirementWikiBuildRunning,
  publishRequirementWiki,
  startRequirementWikiBuild,
} from '@deepseek-ai/dsh-fde-project'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  assertFixtureInventory,
  captureStableAria,
  compareOrRefreshGolden,
  launchWebScaffold,
  watchConsole,
  webSnapshotMode,
  type WebScaffold,
} from './scaffold.ts'
import { ZH_BROWSER_LOCALE, saveFailureShot } from './support.ts'

const SNAPSHOT_DIR = fileURLToPath(new URL('./snapshots/requirement-wiki', import.meta.url))
const UI_EXPECTED = join(SNAPSHOT_DIR, 'ui.expected.md')
const PROMPT_EXPECTED = join(SNAPSHOT_DIR, 'prompt.expected.md')
const MODE = webSnapshotMode()

function stableWikiInstruction(value: string): string {
  return value
    .replace(/wiki_[a-f0-9]{32}/gu, '<BuildId>')
    .replace(/src_[a-zA-Z0-9_-]{12,80}/gu, '<SourceId>')
}

describe('web e2e: FDE requirement Wiki Galaxy View', () => {
  let scaffold: WebScaffold
  let browser: Browser
  let page: Page
  let tripwire: ReturnType<typeof watchConsole>
  let workspacePath: string

  beforeAll(async () => {
    scaffold = await launchWebScaffold({})
    workspacePath = join(scaffold.workspaceCwd, '客户知识项目')
    await mkdir(workspacePath)
    await scaffold.ctx.workspaceRegistry.create(workspacePath, '客户知识项目')
    const created = await scaffold.ctx.apiProxy.sessions.create({
      rpcId: 'requirement-wiki-create-session' as never,
      payload: { sessionId: SessionId('requirement-wiki-web-e2e'), cwd: workspacePath },
    })
    if (!created.result.ok) throw new Error(`session.create failed: ${created.result.error.message}`)

    const stored = await storeProjectResourceBatch(workspacePath, [
      { name: '客户需求.md', data: Buffer.from('# 目标\n减少交付遗漏，所有结论都能追溯原始资料。') },
      { name: '验收纪要.txt', data: Buffer.from('验收要求：每个交付结果需要证据，并由客户负责人确认。') },
    ])
    const records = await registerStoredProjectResources(workspacePath, stored)
    const sources = await Promise.all(records.map(record => parseProjectSource(workspacePath, record.sourceId)))
    const sourceIds = sources.map(source => source.sourceId)
    const build = await startRequirementWikiBuild(workspacePath, sourceIds, 0)
    await markRequirementWikiBuildRunning(workspacePath, build.id)
    await publishRequirementWiki(workspacePath, build.id, 0, {
      pages: [
        {
          id: 'delivery_goal', topic: 'business-goal', title: '降低交付遗漏',
          summary: '客户希望交付过程完整且可追溯。',
          body: '所有交付结论都需要关联原始客户资料。', sourceIds: [sourceIds[0]!],
        },
        {
          id: 'source_process', topic: 'process', title: '资料整理流程',
          body: '先保存原件并完成本地识别，再生成候选知识页与关系。', sourceIds: [sourceIds[0]!],
        },
        {
          id: 'acceptance_evidence', topic: 'acceptance', title: '验收证据',
          body: '每个交付结果都需要可读取的验收证据。', sourceIds: [sourceIds[1]!],
        },
        {
          id: 'wording_risk', topic: 'risk', title: '口径冲突风险',
          body: '不同资料中的验收口径需要由客户负责人最终确认。', sourceIds,
        },
      ],
      relations: [
        {
          id: 'goal_drives_process', from: 'delivery_goal', to: 'source_process', type: 'relates-to',
          label: '目标驱动流程', directed: true, sourceIds: [sourceIds[0]!],
        },
        {
          id: 'evidence_validates_goal', from: 'acceptance_evidence', to: 'delivery_goal', type: 'validates',
          label: '证据验证目标', directed: true, sourceIds,
        },
        {
          id: 'risk_blocks_acceptance', from: 'wording_risk', to: 'acceptance_evidence', type: 'constrains',
          label: '口径影响验收', directed: true, sourceIds: [sourceIds[1]!],
        },
      ],
      conflicts: [{
        id: 'acceptance_owner_conflict', title: '验收责任口径待统一',
        detail: '现有资料没有统一说明最终确认责任。', impact: '可能影响正式验收。',
        pageIds: ['acceptance_evidence', 'wording_risk'], sourceIds,
      }],
      unknowns: [{
        id: 'acceptance_owner_unknown', title: '最终验收负责人未明确',
        detail: '需要客户补充最终验收人的姓名或角色。',
        pageIds: ['acceptance_evidence'], sourceIds: [sourceIds[1]!],
      }],
    }, 'snapshot-project-agent')

    browser = await chromium.launch()
    page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, locale: ZH_BROWSER_LOCALE })
    tripwire = watchConsole(page)
    await page.goto(scaffold.baseUrl, { waitUntil: 'load' })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  }, 120_000)

  afterAll(async () => {
    await browser?.close()
    await scaffold?.close()
  })

  it('opens the project Wiki, draws the real Galaxy, and exposes the same searchable graph without WebGL', async () => {
    onTestFailed(() => saveFailureShot(page, 'web-e2e-requirement-wiki'))
    await page.getByRole('button', { name: '项目进度' }).click()
    await page.getByRole('heading', { name: '项目进度' }).waitFor({ timeout: 15_000 })
    await page.getByRole('button', { name: '查看项目' }).click()
    await page.getByRole('navigation', { name: '项目详情' })
      .getByRole('button', { name: '需求知识图谱' }).click()
    await page.getByRole('heading', { name: '需求知识图谱' }).waitFor({ timeout: 15_000 })

    const galaxy = page.getByTestId('requirement-galaxy-view')
    const canvas = galaxy.locator('canvas[aria-label="需求知识 Galaxy View R1"]')
    await expect.poll(() => canvas.count(), { timeout: 15_000 }).toBe(1)
    const canvasSize = await canvas.evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }))
    expect(canvasSize.width).toBeGreaterThan(0)
    expect(canvasSize.height).toBeGreaterThan(0)
    expect(await page.getByText('4 星体 · 3 关系', { exact: true }).count()).toBe(1)

    const search = page.getByRole('textbox', { name: '搜索知识' })
    await search.fill('验收')
    await expect.poll(() => page.getByText('2 星体 · 1 关系', { exact: true }).count()).toBe(1)
    await page.getByRole('button', { name: '显示全部' }).click()
    await page.getByText(/^知识页与关系列表/).click()
    await page.getByRole('button', { name: /验收证据/ }).click()
    await expect.poll(() => page.getByRole('heading', { name: '验收证据' }).count()).toBe(1)

    const snapshot = await captureStableAria(page, 'main[class*="detailPage"]', scaffold.workspaceCwd)
    await compareOrRefreshGolden(UI_EXPECTED, snapshot, MODE)
    expect(snapshot).toContain('知识页与关系列表 · 4 页 / 3 关系')
    expect(snapshot).toContain('来源 · 验收纪要.txt')
    expect(tripwire.warnings).toEqual([])
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('records the confirmed fixed-source instruction in the exact project Session', async () => {
    const pickerHeading = page.getByRole('heading', { name: '选择本次整理的资料' })
    await page.getByRole('button', { name: '更新需求知识' }).click()
    await pickerHeading.waitFor()
    const picker = pickerHeading.locator('..').locator('..')
    await picker.getByRole('checkbox', { name: /客户需求\.md/ }).check()
    await picker.getByRole('checkbox', { name: /验收纪要\.txt/ }).check()
    await picker.getByRole('button', { name: '更新需求知识' }).click()

    const confirmation = page.getByRole('dialog', { name: '确认整理需求知识' })
    await confirmation.waitFor()
    const targetText = await confirmation.getByText(/^目标会话：/u).textContent()
    const confirmedSessionId = targetText?.slice('目标会话：'.length)
    if (confirmedSessionId === undefined || confirmedSessionId === '') throw new Error('confirmation did not name its target Session')
    expect(scaffold.ctx.sessions.get(SessionId(confirmedSessionId))?.header.cwd).toBe(workspacePath)
    await expect.poll(() => confirmation.getByText(/Provider：.+ · 模型：/u).count()).toBe(1)

    const settled = scaffold.whenTurnSettled()
    await confirmation.getByRole('button', { name: '确认并整理' }).click()
    expect(String(await settled)).toBe(confirmedSessionId)

    const session = scaffold.ctx.sessions.get(SessionId(confirmedSessionId))
    const message = session?.events.findLast(event => event.type === 'user/message'
      && event.data.content.some(block => block.type === 'text' && block.text.startsWith('请执行当前 FDE 项目的需求知识整理。')))
    if (message?.type !== 'user/message') throw new Error('confirmed Wiki run did not append a user message')
    const textBlock = message.data.content.find(block => block.type === 'text')
    if (textBlock?.type !== 'text') throw new Error('confirmed Wiki user message has no text block')
    await compareOrRefreshGolden(PROMPT_EXPECTED, stableWikiInstruction(textBlock.text), MODE)

    const snapshot = await loadRequirementWikiSnapshot(workspacePath)
    if (snapshot.build === null) throw new Error('confirmed Wiki run did not create a Host build')
    await abandonRequirementWikiBuild(workspacePath, snapshot.build.id, 'Web prompt snapshot complete.')
    expect(snapshot.current?.revision).toBe(1)
    expect(tripwire.pageErrors).toEqual([])
  }, 60_000)

  it('keeps its snapshot inventory closed', async () => {
    await assertFixtureInventory(SNAPSHOT_DIR, ['prompt.expected.md', 'ui.expected.md'])
  })
})
