// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { StageSkillCatalogValue } from '../src/client/stage-skill-catalog.ts'
import { SkillsCenter } from '../src/client/SkillsCenter.tsx'
import * as downloads from '../src/client/skills-center-data.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)
const hostModule = '../../../fde/stage/src/index.ts'
const platformModule = '../../../fde/stage/src/platform-skills.ts'
const { DISCOVERY_STAGE_SKILL_CATALOG } = await import(hostModule) as { DISCOVERY_STAGE_SKILL_CATALOG: StageSkillCatalogValue }
const { platformSkillCatalog } = await import(platformModule) as {
  platformSkillCatalog: (value: StageSkillCatalogValue) => StageSkillCatalogValue
}
const catalog = platformSkillCatalog(DISCOVERY_STAGE_SKILL_CATALOG)
const response = () => ({ ok: true, json: async () => ({ ok: true, value: catalog }) })
const waitForCatalog = async () => {
  await waitFor(() => { expect(screen.getAllByRole('article')).toHaveLength(8) })
  return screen.getAllByRole('button', { name: '查看' })
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('shows the Chinese name and body without a directory tree, source block or license entries', async () => {
  const fetch = vi.fn(async () => response())
  vi.stubGlobal('fetch', fetch)
  const view = render(<SkillsCenter t={t} />)
  await waitForCatalog()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fde-orient' } })
  const root = view.container.querySelector<HTMLElement>('[data-skills-center]')!
  root.scrollTop = 126
  const opener = screen.getByRole('button', { name: '查看' })
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog', { name: '项目启动与方向确认' })
  expect(within(dialog).getByRole('heading', { name: '项目启动与方向确认', level: 1 })).toBeTruthy()
  expect(within(dialog).queryByRole('complementary')).toBeNull()
  expect(dialog.querySelector('[data-skill-folder], [data-skill-frontmatter]')).toBeNull()
  expect(dialog.textContent).not.toMatch(/LICENSE|来源仓库|rpraharaj|davidahmann|\.agents\/skills/)
  expect(view.container.hasAttribute('inert')).toBe(true)
  fireEvent.click(within(dialog).getByRole('button', { name: '任务类型与能力选择' }))
  expect(dialog.querySelector('[data-skill-file="fde-orient/references/engagement-types.md"]')).not.toBeNull()
  expect(within(dialog).getByText('engagement-types.md')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: '返回 Skill 正文' }))
  expect(dialog.querySelector('[data-skill-file="fde-orient/SKILL.md"]')).not.toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭阅读弹窗' }))
  expect(view.container.hasAttribute('inert')).toBe(false)
  expect(screen.getByRole('searchbox').getAttribute('value')).toBe('fde-orient')
  expect(root.scrollTop).toBe(126)
  expect(document.activeElement === opener).toBe(true)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('retains focus containment, reading position, expansion and Escape behavior', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  render(<><button type="button">外部操作</button><SkillsCenter t={t} /></>)
  const opener = (await waitForCatalog())[1]!
  fireEvent.click(opener)
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '项目定向记录' }))
  const first = within(dialog).getByRole('button', { name: '下载当前文件' })
  const last = within(dialog).getByRole('button', { name: '返回 Skill 正文' })
  first.focus()
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
  expect(document.activeElement === last).toBe(true)
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(document.activeElement === first).toBe(true)
  screen.getByRole('button', { name: '外部操作' }).focus()
  expect(dialog.contains(document.activeElement)).toBe(true)
  const body = dialog.querySelector<HTMLElement>('[data-skill-file="fde-orient/assets/orientation.md"]')!
  body.scrollTop = 84
  fireEvent.click(within(dialog).getByRole('button', { name: '放大阅读' }))
  expect(body.scrollTop).toBe(84)
  fireEvent.keyDown(within(dialog).getByRole('button', { name: '还原窗口' }), { key: 'Escape' })
  expect(screen.getByRole('dialog') === dialog).toBe(true)
  expect(body.scrollTop).toBe(84)
  fireEvent.keyDown(within(dialog).getByRole('button', { name: '放大阅读' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement === opener).toBe(true)
})

it('restores modal locks on mask close and unmount without discarding earlier state', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  const inactive = document.createElement('div')
  inactive.setAttribute('inert', 'existing')
  document.body.append(inactive)
  const overflow = document.body.style.overflow
  document.body.style.overflow = 'scroll'
  try {
    const view = render(<SkillsCenter t={t} />)
    const openers = await waitForCatalog()
    fireEvent.click(openers[0]!)
    const dialog = screen.getByRole('dialog')
    fireEvent.click(dialog.parentElement!.querySelector('[aria-hidden="true"]')!)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('scroll')
    fireEvent.click(openers[1]!)
    view.unmount()
    expect(inactive.getAttribute('inert')).toBe('existing')
    expect(document.body.style.overflow).toBe('scroll')
  } finally { cleanup(); inactive.remove(); document.body.style.overflow = overflow }
})

it('recovers catalog failures and empty searches while retaining the independent course entry', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response()))
  render(<SkillsCenter t={t} />)
  await screen.findByRole('alert')
  expect(screen.getByRole('article').getAttribute('data-source')).toBe('course')
  fireEvent.click(screen.getByRole('button', { name: '平台内置' }))
  expect(screen.queryByRole('button', { name: '查看' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await waitFor(() => { expect(screen.getAllByRole('article')).toHaveLength(7) })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'not-a-skill' } })
  expect(screen.getByRole('status').textContent).toContain('没有找到匹配')
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }))
  expect(screen.getAllByRole('article')).toHaveLength(7)
  expect(screen.queryByRole('button', { name: /安装|执行/ })).toBeNull()
})

it('downloads the Host package and raw current file, with local preparation errors', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  const save = vi.spyOn(downloads, 'saveSkillDownload').mockImplementation(() => {})
  render(<SkillsCenter t={t} />)
  await waitForCatalog()
  fireEvent.click(screen.getAllByRole('button', { name: '下载' })[0]!)
  expect(save.mock.lastCall?.[0]).toBe('qualify-ai-workflow.zip')
  expect(ArrayBuffer.isView(save.mock.lastCall?.[1])).toBe(true)
  fireEvent.click(screen.getAllByRole('button', { name: '查看' })[0]!)
  const dialog = screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: '下载当前文件' }))
  expect(save).toHaveBeenLastCalledWith('SKILL.md', catalog.stages[0]!.methods[0]!.files![0]!.content, 'text/markdown;charset=utf-8')
  fireEvent.click(within(dialog).getByRole('button', { name: '下载整个 Skill' }))
  expect(save.mock.lastCall?.[0]).toBe('qualify-ai-workflow.zip')
  save.mockImplementation(() => { throw new Error('browser refused') })
  fireEvent.click(within(dialog).getByRole('button', { name: '下载当前文件' }))
  expect(within(dialog).getByRole('alert').textContent).toBe('下载准备失败，请重试。')
})

it('keeps course content, links, downloads and filtering without nested navigation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()))
  const save = vi.spyOn(downloads, 'saveSkillDownload').mockImplementation(() => {})
  render(<SkillsCenter t={t} />)
  await waitForCatalog()
  fireEvent.click(screen.getByRole('button', { name: '课程原版' }))
  expect(screen.getAllByRole('article')).toHaveLength(1)
  expect(screen.getByText('第 1 课 · 工业FDE落地模糊需求拆解方法')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '查看' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByRole('complementary')).toBeNull()
  fireEvent.click(within(dialog).getAllByRole('button', { name: '交互与诊断方法' })[0]!)
  expect(dialog.querySelector('[data-skill-file="references/interaction-and-diagnosis.md"]')).not.toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '下载当前文件' }))
  expect(save.mock.lastCall?.[0]).toBe('interaction-and-diagnosis.md')
  fireEvent.click(within(dialog).getByRole('button', { name: '返回 Skill 正文' }))
  expect(dialog.querySelector('[data-skill-file="SKILL.md"]')).not.toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '下载整个 Skill' }))
  expect(save.mock.lastCall?.[0]).toBe('fde-business-diagnosis.zip')
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭阅读弹窗' }))
  expect(screen.getByRole('button', { name: '课程原版' }).getAttribute('aria-pressed')).toBe('true')
})
