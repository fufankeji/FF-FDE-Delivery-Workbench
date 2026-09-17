// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { ClientModuleSystem, type ClientModuleLoaderTarget, type DshWindow } from '@deepseek-ai/dsh-client-modules/client'
import { getStaticModules } from '@deepseek-ai/dsh-client-web/src/seed.ts'

const projectId = '@deepseek-ai/dsh-client-ui-fde-project'
const win = window as DshWindow

afterEach(() => {
  delete win.__ModuleLoader__
  for (const style of document.querySelectorAll(`style[data-plugin="${projectId}"]`)) style.remove()
})

it('imports the built FDE project plugin using only the browser platform modules', async () => {
  const target: ClientModuleLoaderTarget = {
    mode: 'queue',
    pendingQueue: [],
    load(registration) { this.pendingQueue.push(registration) },
    create() { throw new Error('This import test constructs the module system directly.') },
  }
  win.__ModuleLoader__ = target
  const source = readFileSync(resolve(import.meta.dirname, '../../../packages/client/ui-fde-project/lib/client.js'), 'utf8')
  // Source tests resolve npm libraries in Node; this artifact must import without Node built-ins.
  new Function('window', source)(window)
  const modules = new ClientModuleSystem({
    manifest: { rev: 'built-fde-import', modules: [], plugins: [] },
    staticModules: getStaticModules(),
    registrationTarget: target,
    bootstrapModule: { id: '@deepseek-ai/dsh-client-modules', exports: {} },
  })

  const plugin = await modules.import(projectId)
  expect(plugin).toEqual(expect.objectContaining({ apply: expect.any(Function) }))
  expect(modules.loadCache.get(projectId)?.edges.has('module')).toBe(false)
  expect(document.querySelector(`style[data-plugin="${projectId}"]`)).not.toBeNull()
})
