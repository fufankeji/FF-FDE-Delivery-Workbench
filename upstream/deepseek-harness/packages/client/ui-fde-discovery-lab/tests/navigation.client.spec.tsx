// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { createLabStore } from '../src/client/stores.ts'
import { LabLauncher, LabModuleLauncher, LabOverlay } from '../src/client/LabPage.tsx'
import { apply, inject } from '../src/client/index.ts'
import { ProjectProgressOverlay } from '../../ui-fde-project/src/client/ProjectProgressOverlay.tsx'
import { ProjectPageController } from '../../ui-fde-project/src/client/page-controller.ts'
import type { ProjectProgressOverlayProps } from '../../ui-fde-project/src/client/slots.ts'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh } from '../../ui-fde-project/src/client/locales.ts'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('opens independently and returns without reading or mutating project state', () => {
  const {store,actions}=createLabStore().create()
  const useStore=bindSnapshotSelector(store)
  const useWorkspaces=vi.fn(()=>{throw new Error('Must not touch projects')})
  const useSessions=vi.fn(()=>{throw new Error('Must not touch sessions')})
  const shared={useStore,actions,useWorkspaces,useSessions}
  render(<><LabLauncher {...shared as ComponentProps<typeof LabLauncher>} wide/><LabOverlay {...shared as ComponentProps<typeof LabOverlay>}/></>)
  expect(screen.queryByRole('dialog')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'业务挖掘实验室'}))
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(screen.getByTitle('业务挖掘实验室训练区').getAttribute('src')).toBe('/fde-discovery-lab/')
  fireEvent.click(screen.getByRole('button',{name:'返回工作台'}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(store.getSnapshot()).toEqual({open:false})
  expect(useWorkspaces).not.toHaveBeenCalled()
  expect(useSessions).not.toHaveBeenCalled()
})
it('appends both slot occupants, keeps prior occupants and retracts only its own entry',async()=>{
  const ctx=new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots=ctx.get('slots') as SlotRegistry
  slots.register({name:'root',children:{'sidebar.footer.action':{kind:'list',scope:'root'},'shell.overlay':{kind:'list',scope:'root'}}} as never,()=>null)
  slots.register({name:'sidebar.footer.action',id:'existing-project-center'} as never,()=>null)
  const fiber=ctx.plugin({inject,apply})
  await fiber.await()
  expect(slots.entries('sidebar.footer.action').map(entry=>entry.options.id)).toContain('existing-project-center')
  expect(slots.entries('sidebar.footer.action').map(entry=>entry.options.id)).toContain('fde-discovery-lab')
  expect(slots.entries('shell.overlay')).toHaveLength(1)
  const releaseModules = slots.register({ name:'shell.overlay', id:'test-home', children:{ 'fde.workbench.module.action':{kind:'list',scope:'root'} } } as never,()=>null)
  await vi.waitFor(() => expect(slots.entries('fde.workbench.module.action')).toHaveLength(1))
  expect(slots.entries('fde.workbench.module.action')[0]?.component).toBe(LabModuleLauncher)
  const moduleStore = slots.entries('fde.workbench.module.action')[0]?.store
  expect(moduleStore).toBeDefined()
  expect(moduleStore).toBe(slots.entries('sidebar.footer.action').find(entry => entry.options.id === 'fde-discovery-lab')?.store)
  expect(moduleStore).toBe(slots.entries('shell.overlay').find(entry => entry.options.id === 'fde-discovery-lab')?.store)
  releaseModules()
  await vi.waitFor(() => expect(slots.entries('fde.workbench.module.action')).toHaveLength(0))
  await fiber.dispose()
  expect(slots.entries('sidebar.footer.action').map(entry=>entry.options.id)).toEqual(['existing-project-center'])
  expect(slots.entries('shell.overlay')).toHaveLength(0)
  await ctx.fiber.dispose()
})

it('opens from the actual fullscreen home and project center with no project, and returns to the same page', () => {
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} })
  vi.stubGlobal('IntersectionObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} })
  const page = new ProjectPageController()
  const { store, actions } = createLabStore().create()
  const useStore = bindSnapshotSelector(store)
  const shared = { useStore, actions }
  const hook = <T,>(value: T) => <S,>(selector: (state: T) => S) => selector(value)
  const props = {
    useProjectPage: bindSnapshotSelector(page),
    useWorkspaces: hook({ items: [], archivedSessionIds: [], phase: 'ready', state: 'ready' }),
    useSessions: hook({ byId: {} }),
    useStageProgress: hook({ byWorkspace: {} }), useProjectSurfaces: hook({ byWorkspace: {} }),
    useProjectSources: hook({ byWorkspace: {} }), useProjectMetadata: hook({ byWorkspace: {} }),
    loadStage: vi.fn(), loadProjectSurface: vi.fn(), loadProjectSources: vi.fn(), loadProjectMetadata: vi.fn(),
    enterProject: vi.fn(), openProjectCreation: vi.fn(),
    showProjectHome: page.showHome, showProjectOverview: page.showOverview,
    renderSlot: (name: string) => name === 'fde.workbench.module.action'
      ? <LabModuleLauncher {...shared as ComponentProps<typeof LabModuleLauncher>} /> : null,
    t: makeTranslate(zh),
  } as unknown as ProjectProgressOverlayProps
  render(<><ProjectProgressOverlay {...props} /><LabOverlay {...shared as ComponentProps<typeof LabOverlay>} /></>)
  for (const view of ['home', 'overview']) {
    expect(page.getSnapshot().view).toBe(view)
    fireEvent.click(screen.getByRole('button', { name: '业务挖掘实验室' }))
    expect(screen.getByRole('dialog', { name: '业务挖掘实验室' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回工作台' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(page.getSnapshot().view).toBe(view)
    if (view === 'home') fireEvent.click(screen.getByRole('button', { name: /进入工作台/ }))
  }
  expect(screen.getByRole('navigation', { name: '工作台独立功能' }).textContent).toContain('业务挖掘实验室')
  expect(screen.getByRole('button', { name: /新建项目/ })).toBeTruthy()
  expect(props.enterProject).not.toHaveBeenCalled()
  expect(props.openProjectCreation).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '返回首页' }))
  expect(page.getSnapshot().view).toBe('home')
})
