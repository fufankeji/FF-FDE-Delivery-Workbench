import { describe, expect, it, vi } from 'vitest'
import { ProjectPageController } from '../src/client/page-controller.ts'

describe('ProjectPageController', () => {
  it('navigates overview, timeline, project detail, and closed states explicitly', () => {
    const controller = new ProjectPageController()
    expect(controller.getSnapshot()).toEqual({ open: true, view: 'home' })
    const changed = vi.fn()
    controller.subscribe(changed)
    controller.open()
    expect(controller.getSnapshot()).toEqual({ open: true, view: 'overview' })
    controller.showTimeline()
    expect(controller.getSnapshot()).toEqual({ open: true, view: 'timeline' })
    controller.showProject('workspace-1')
    expect(controller.getSnapshot()).toEqual({ open: true, view: 'project', workspaceId: 'workspace-1' })
    controller.close()
    expect(controller.getSnapshot()).toEqual({ open: false, view: 'closed' })
    controller.open()
    expect(controller.getSnapshot()).toEqual({ open: true, view: 'overview' })
    expect(changed).toHaveBeenCalledTimes(5)
  })
})
