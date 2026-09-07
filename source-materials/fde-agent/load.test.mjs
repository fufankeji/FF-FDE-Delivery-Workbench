import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadProject } from './load.mjs';

test('导入完整资料与阶段状态，保留原件摘要和时间，不复制私人运行状态；重复导入不覆盖', async t => {
  const sandbox = await mkdtemp(join(tmpdir(), 'fde-material-test-'));
  t.after(() => rm(sandbox, { recursive: true, force: true }));
  const target = join(sandbox, 'loaded');
  const result = await loadProject(target);
  const manifest = JSON.parse(await readFile(join(import.meta.dirname, 'manifest.json'), 'utf8'));
  assert.equal(result.sourceCount, 35);
  for (const entry of manifest.files) {
    const bytes = await readFile(join(result.workspace, entry.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.path);
  }
  for (const name of await readdir(join(result.workspace, '.fde/sources'))) {
    const record = JSON.parse(await readFile(join(result.workspace, '.fde/sources', name), 'utf8'));
    const info = await stat(join(result.workspace, record.relativePath));
    assert.equal(info.mtimeMs, record.mtimeMs, record.relativePath);
    assert.equal(info.size, record.bytes);
  }
  const workspacePath = join(result.dshHome, 'storages/workspace.json');
  const before = await readFile(workspacePath, 'utf8');
  const registry = JSON.parse(before);
  assert.deepEqual(registry.global.workspaceIds, [result.workspaceId]);
  assert.equal(registry.tables.workspaces[result.workspaceId].path, result.workspace);
  assert.deepEqual(registry.tables.workspaces[result.workspaceId].sessionIds, []);
  const stage = JSON.parse(await readFile(join(result.dshHome, 'storages/fde_stage.json'), 'utf8'));
  assert.deepEqual(stage.tables.projects[result.workspaceId], manifest.lifecycle);
  for (const path of ['.fde/project-runtime.json', '.runtime', '.fde/previews']) {
    await assert.rejects(lstat(join(result.workspace, path)), { code: 'ENOENT' });
  }
  assert.deepEqual(await readdir(result.dshHome), ['storages']);
  await assert.rejects(loadProject(target), /目标已存在/);
  assert.equal(await readFile(workspacePath, 'utf8'), before);
});
