// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { StageSkillCatalogValue } from '../src/client/stage-skill-catalog.ts'
import { SkillsCenter } from '../src/client/SkillsCenter.tsx'
import * as downloads from '../src/client/skills-center-data.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)
// The fixture is real Host data; its Cordis declarations do not belong in Client compilation.
const hostModule = '../../../fde/stage/src/index.ts'
const { DISCOVERY_STAGE_SKILL_CATALOG } = await import(hostModule) as { DISCOVERY_STAGE_SKILL_CATALOG: StageSkillCatalogValue }
const response = () => ({ ok: true, json: async () => ({ ok: true, value: DISCOVERY_STAGE_SKILL_CATALOG }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows seven real cards before any file tree, filters them and restores search, scroll and focus after reading', async () => {
  const fetch = vi.fn(async () => response())
  vi.stubGlobal('fetch', fetch)
  const view = render(<SkillsCenter t={t} />)
  expect(screen.getByRole('status').textContent).toContain('正在读取')
  await screen.findAllByRole('button', { name: '查看' })
  expect(screen.getAllByRole('article')).toHaveLength(7)
  expect(screen.getAllByRole('button', { name: '下载' })).toHaveLength(7)
  expect(screen.queryByRole('complementary')).toBeNull()
  expect(screen.queryByRole('button', { name: /安装|执行/ })).toBeNull()
  expect(fetch.mock.calls).toHaveLength(1)
  const input = screen.getByRole('searchbox', { name: '搜索技能' })
  fireEvent.change(input, { target: { value: '紧迫性' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByRole('article').getAttribute('data-skill-card')).toBe('qualify-ai-workflow')
  fireEvent.change(input, { target: { value: 'knowledge-interview' } })
  expect(screen.getAllByRole('article')).toHaveLength(1)
  const root = view.container.querySelector<HTMLElement>('[data-skills-center]')!
  root.scrollTop = 126
  const opener = screen.getByRole('button', { name: '查看' })
  fireEvent.click(opener)
  expect(screen.queryByRole('searchbox')).toBeNull()
  expect(screen.queryByRole('article')).toBeNull()
  const files = screen.getByRole('complementary', { name: '文件目录' })
  expect(within(files).getAllByRole('button').map(button => button.textContent?.replace('▤', ''))).toEqual(['SKILL.md', 'README.md', 'LICENSE', 'NOTICE.md'])
  expect(view.container.querySelector('[data-skill-file="SKILL.md"] h1')?.textContent).toBe('现场知识访谈')
  expect(root.scrollTop).toBe(0)
  fireEvent.click(within(files).getByRole('button', { name: 'README.md' }))
  const markdown = view.container.querySelector<HTMLElement>('[data-skill-file="README.md"]')!
  expect(within(markdown).getByRole('heading', { name: '使用边界' })).toBeTruthy()
  expect(within(markdown).getByRole('link', { name: /rpraharaj/ }).getAttribute('rel')).toContain('noopener')
  fireEvent.click(within(markdown).getByRole('button', { name: 'SKILL.md' }))
  expect(view.container.querySelector('[data-skill-file="SKILL.md"]')).not.toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /返回技能列表/ }))
  expect(screen.getByRole('searchbox').getAttribute('value')).toBe('knowledge-interview')
  expect(root.scrollTop).toBe(126)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: '查看' }))
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('recovers a failed catalog and an empty search without exposing false cards or execution actions', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response())
  vi.stubGlobal('fetch', fetch)
  render(<SkillsCenter t={t} />)
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: '查看' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await screen.findAllByRole('button', { name: '查看' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no-such-skill' } })
  expect(screen.getByRole('status').textContent).toContain('没有找到匹配的技能')
  expect(screen.queryByRole('article')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
  expect(screen.getAllByRole('article')).toHaveLength(7)
})

it('uses the same package and file content for both download entry points, and reports preparation failure', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  const save = vi.spyOn(downloads, 'saveSkillDownload').mockImplementation(() => {})
  const skills = downloads.stageOneLibrary(DISCOVERY_STAGE_SKILL_CATALOG)
  render(<SkillsCenter t={t} />)
  const buttons = await screen.findAllByRole('button', { name: '下载' })
  fireEvent.click(buttons[0]!)
  expect(save).toHaveBeenLastCalledWith('qualify-ai-workflow.zip', expect.any(Uint8Array), 'application/zip')
  fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]!)
  fireEvent.click(screen.getByRole('button', { name: '下载当前文件' }))
  expect(save).toHaveBeenLastCalledWith('SKILL.md', skills[0]!.files[0]!.content, 'text/markdown;charset=utf-8')
  fireEvent.click(screen.getByRole('button', { name: '下载整个 Skill' }))
  expect(save).toHaveBeenLastCalledWith('qualify-ai-workflow.zip', expect.any(Uint8Array), 'application/zip')
  save.mockImplementation(() => { throw new Error('browser refused') })
  fireEvent.click(screen.getByRole('button', { name: '下载当前文件' }))
  expect(screen.getByRole('alert').textContent).toBe('下载准备失败，请重试。')
  expect(screen.getByRole('complementary')).toBeTruthy()
})
