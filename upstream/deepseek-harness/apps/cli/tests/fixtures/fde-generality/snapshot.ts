import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, healProfilesModuleFallback, loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-tools'

const repository = fileURLToPath(new URL('../../../../..', import.meta.url))
const overlay = process.argv[2]
if (!overlay) throw new Error('FDE snapshot requires an overlay')
const runtimeHome = process.env.DSH_HOME
if (!runtimeHome) throw new Error('FDE snapshot requires an isolated DSH_HOME')
await healProfilesModuleFallback({ installAnchor: join(repository, 'apps/cli/package.json'), home: runtimeHome })
const rootConfig = join(runtimeHome, 'profiles', 'generality', 'cordis.yml')
await mkdir(dirname(rootConfig), { recursive: true })
await writeFile(rootConfig, '[]\n')
const ctx = await boot('fde-generality-snapshot', rootConfig, [
  ...loadOverlayPatches('fde-generality-snapshot', join(repository, 'packages/bundle/base/cordis.patch.yml')),
  ...loadOverlayPatches('fde-generality-snapshot', join(repository, 'packages/bundle/web-app/cordis.patch.yml')),
  ...loadOverlayPatches('fde-generality-snapshot', overlay),
])

type Stage = { title: string; objective: string; explanation: string; statePath: string; artifacts: { path: string; title: string }[]; workItems: { id: string; title: string; purpose: string }[]; presentCount: number; reviewReady: boolean; reviewBlockers: string[] }
type Project = { v2Stages: Record<string, Stage> }
try {
  const base = `http://127.0.0.1:${ctx.webServer.port}`
  async function request(path: string, body: unknown) {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) })
    const result = await response.json()
    if (!response.ok || !result.ok) throw new Error(JSON.stringify(result))
    return result.value
  }
  async function save(root: string, path: string, content: string) {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), content)
  }
  const projects = []
  for (const title of ['本地计算器', '出版资料索引']) {
    const root = join(process.cwd(), title)
    await mkdir(root)
    const workspace = await ctx.workspaceRegistry.create(root, title)
    const stage = await request('/api/fde-stage/open', { workspaceId: workspace.id })
    projects.push({ root, workspace, stage })
  }
  const first = projects[0]!
  const second = projects[1]!
  const snapshot = (id: string): Promise<Project> => request('/api/fde-project/snapshot', { workspaceId: id })
  const initial = await snapshot(first.workspace.id)
  const catalogResponse = await fetch(`${base}/api/fde-stage/skills`, { headers: { Origin: base } })
  const catalog = await catalogResponse.json()
  if (!catalogResponse.ok || !catalog.ok) throw new Error('Stage methods did not load')
  const definition = initial.v2Stages.definition!
  for (const artifact of definition.artifacts) await save(first.root, artifact.path, '  \n')
  const state = { schemaVersion: 1, stage: 'definition', status: 'review-ready', recommendation: 'pending', blockers: [], workItems: definition.workItems.map(item => ({ id: item.id, status: 'complete' })) }
  await save(first.root, definition.statePath, JSON.stringify(state))
  const blank = (await snapshot(first.workspace.id)).v2Stages.definition!
  for (const artifact of definition.artifacts) await save(first.root, artifact.path, '计算器边界：仅做本地算术；无外部写入。')
  const nonempty = (await snapshot(first.workspace.id)).v2Stages.definition!
  await save(first.root, definition.statePath, JSON.stringify({ ...state, dataProvenance: { kind: 'integration-fixture' } }))
  const before = await readFile(join(first.root, definition.statePath), 'utf8')
  const fixture = (await snapshot(first.workspace.id)).v2Stages.definition!
  const other = (await snapshot(second.workspace.id)).v2Stages.definition!
  const after = await readFile(join(first.root, definition.statePath), 'utf8')
  const query = ctx.tools.schemas().find(tool => tool.name === 'semantic_context_query')
  if (!query) throw new Error('Shipped semantic_context_query did not load')
  process.stdout.write(JSON.stringify({
    projects: projects.map(project => ({ title: project.workspace.title, stage: project.stage.v2Stage })),
    methodCopy: catalog.value.stages.map((stage: { id: string; methods: { id: string; label: string; description: string }[] }) => ({ id: stage.id, methods: stage.methods.map(({ id, label, description }) => ({ id, label, description })) })),
    stageCopy: Object.entries(initial.v2Stages).map(([id, stage]) => ({ id, title: stage.title, objective: stage.objective, explanation: stage.explanation, workItems: stage.workItems.map(({ id, title, purpose }) => ({ id, title, purpose })), artifacts: stage.artifacts.map(({ path, title }) => ({ path, title })) })),
    blank: { presentCount: blank.presentCount, reviewReady: blank.reviewReady },
    nonempty: { presentCount: nonempty.presentCount, reviewReady: nonempty.reviewReady },
    fixture: { reviewReady: fixture.reviewReady, blockers: fixture.reviewBlockers },
    independentProject: { presentCount: other.presentCount, reviewReady: other.reviewReady },
    readsPreserveBytes: before === after,
    query: { description: query.description, parameters: query.parameters },
  }) + '\n')
} finally {
  await ctx.fiber.dispose()
}
