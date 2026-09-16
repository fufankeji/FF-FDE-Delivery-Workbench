// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { createLabStore } from '../src/client/stores.ts'
import { LabOverlay, LabSummary } from '../src/client/LabPage.tsx'
import { apply, inject } from '../src/client/index.ts'
import { zh } from '../../ui-fde-project/src/client/locales.ts'

const t = makeTranslate(zh)
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('loads training only after navigation and preserves its iframe across module switches', () => {
  const { store, actions } = createLabStore().create()
  const useStore = bindSnapshotSelector(store)
  const useWorkspaces = vi.fn(() => { throw new Error('Must not touch projects') })
  const useSessions = vi.fn(() => { throw new Error('Must not touch sessions') })
  const back = vi.fn()
  const props = { active: false, back, useStore, actions, useWorkspaces, useSessions, t } as unknown as ComponentProps<typeof LabOverlay>
  const view = render(<LabOverlay {...props} />)
  expect(screen.queryByTitle('业务挖掘实验室训练区')).toBeNull()
  view.rerender(<LabOverlay {...props} active />)
  const frame = screen.getByTitle('业务挖掘实验室训练区')
  expect(frame.getAttribute('src')).toBe('/fde-discovery-lab/')
  fireEvent.load(frame)
  view.rerender(<LabOverlay {...props} />)
  expect(screen.queryByRole('region', { name: '业务挖掘实验室' })).toBeNull()
  expect(screen.getByTitle('业务挖掘实验室训练区')).toBe(frame)
  expect(frame.closest('section')?.hidden).toBe(true)
  view.rerender(<LabOverlay {...props} active />)
  expect(screen.getByTitle('业务挖掘实验室训练区')).toBe(frame)
  fireEvent.click(screen.getByRole('button', { name: '返回原工作面' }))
  expect(back).toHaveBeenCalledOnce()
  expect(useWorkspaces).not.toHaveBeenCalled()
  expect(useSessions).not.toHaveBeenCalled()
})

it('reloads a failed training frame only after explicit retry', () => {
  const { store, actions } = createLabStore().create()
  render(<LabOverlay {...{ active: true, back: vi.fn(), useStore: bindSnapshotSelector(store), actions, t } as ComponentProps<typeof LabOverlay>} />)
  const frame = screen.getByTitle('业务挖掘实验室训练区')
  fireEvent.error(frame)
  expect(screen.getByRole('alert').textContent).toContain('实验室暂时无法打开，请重试。')
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  const nextFrame = screen.getByTitle('业务挖掘实验室训练区')
  expect(nextFrame).not.toBe(frame)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('status')).toBeTruthy()
  fireEvent.load(nextFrame)
  expect(screen.queryByRole('status')).toBeNull()
})

it('contributes only to declared platform slots and retracts its own entries', async () => {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  slots.register({ name: 'root', children: { 'sidebar.footer.action': { kind: 'list', scope: 'root' }, 'shell.overlay': { kind: 'list', scope: 'root' } } } as never, () => null)
  slots.register({ name: 'sidebar.footer.action', id: 'existing-project-center' } as never, () => null)
  const fiber = ctx.plugin({ inject, apply })
  await fiber.await()
  const release = slots.register({ name: 'shell.overlay', id: 'platform', children: {
    'fde.workbench.lab.page': { kind: 'single', scope: 'root' },
    'fde.workbench.lab.summary': { kind: 'single', scope: 'root' },
  } } as never, () => null)
  await vi.waitFor(() => expect(slots.entries('fde.workbench.lab.page')[0]?.component).toBe(LabOverlay))
  expect(slots.entries('fde.workbench.lab.summary')[0]?.component).toBe(LabSummary)
  expect(slots.entries('fde.workbench.lab.page')[0]?.store).toBeDefined()
  expect(slots.entries('shell.overlay')).toHaveLength(1)
  expect(slots.entries('sidebar.footer.action').map(entry => entry.options.id)).toEqual(['existing-project-center'])
  await fiber.dispose()
  expect(slots.entries('fde.workbench.lab.page')).toHaveLength(0)
  expect(slots.entries('fde.workbench.lab.summary')).toHaveLength(0)
  release()
  await ctx.fiber.dispose()
})

it('shows distinct lab and case totals and resumes existing training from read-only case data', async () => {
  const fetch = vi.fn(async (_url: string) => new Response(JSON.stringify([{ id: 'finance', currentRunId: 'run-1' }, { id: 'retail' }])))
  vi.stubGlobal('fetch', fetch)
  const openLab = vi.fn()
  render(<LabSummary {...{ openLab, t } as ComponentProps<typeof LabSummary>} />)
  await waitFor(() => expect(screen.getByText('个可用案例').previousElementSibling?.textContent).toBe('2'))
  expect(screen.getByText('个实验室').previousElementSibling?.textContent).toBe('1')
  expect(screen.getByText(/当前服务有 1 个案例已开始训练/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /继续已有训练/ }))
  expect(openLab).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch.mock.calls[0]?.[0]).toBe('/api/fde-discovery-lab/cases')
})

it('does not invent zero cases on failure and can retry without touching project state', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 503 }))
    .mockResolvedValueOnce(new Response('[]'))
  vi.stubGlobal('fetch', fetch)
  render(<LabSummary {...{ openLab: vi.fn(), t } as ComponentProps<typeof LabSummary>} />)
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
  expect(screen.queryByText('个可用案例')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '重试' }))
  await waitFor(() => expect(screen.getByText('个可用案例').previousElementSibling?.textContent).toBe('0'))
  expect(fetch).toHaveBeenCalledTimes(2)
})
