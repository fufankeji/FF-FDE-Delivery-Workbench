import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { loadCatalog, parseSamples, neighborhood, digest } from '../catalog.mjs';
import { analyze, riskFor, validateReport, makeDraft } from '../workflow.mjs';
import { createApp } from '../server.mjs';

const root = resolve(import.meta.dirname, '../..');
const catalog = await loadCatalog(root);

test('原始样本只读取输入字段；篡改历史答案不改变分析结果', async () => {
  const raw = await readFile(join(root, 'fde-resources/02-data-sample-and-dictionary.md'), 'utf8');
  const changed = raw.split('\n').map(line => {
    if (!line.startsWith('| R-')) return line;
    const c = line.split('|'); c[7] = 'wrong-final'; c[8] = 'wrong-priority'; c[9] = 'wrong-duplicate'; return c.join('|');
  }).join('\n');
  assert.equal(catalog.reports.length, 12);
  assert.deepEqual(parseSamples(raw), parseSamples(changed));
  assert.equal('final_domain' in catalog.reports[0], false);
  const r = catalog.reports.find(r => r.id === 'R-1002');
  const result = analyze(r, catalog.reports, catalog);
  assert.equal(result.risk.priority, 'P0');
  assert.deepEqual(result.domains.map(d => d.id), ['pos-hardware', 'network']);
  assert(result.duplicates.some(d => d.id === 'R-1003' && !d.timeVerified));
  assert(result.questions.length <= 3);
  assert(result.graph.nodes.length > 0);
});

test('安全优先、缺失保持未知，不执行报修原文中的越权指令', () => {
  assert.equal(riskFor(catalog.reports.find(r => r.id === 'R-1005')).priority, 'P0');
  assert.equal(riskFor(catalog.reports.find(r => r.id === 'R-1010')).priority, '待定');
  const injected = analyze(catalog.reports.find(r => r.id === 'R-1008'), catalog.reports, catalog);
  assert(injected.warnings.some(s => s.includes('不可信')));
  assert.equal(injected.modelConnected, false);
  assert(!JSON.stringify(injected).includes('dispatch_success'));
  assert.throws(() => validateReport({ region: 'west', storeId: 'NJ-003', assetText: '设备', symptom: '坏了' }, catalog), /华东一区/);
  assert.throws(() => validateReport({ storeId: 'NJ-003', assetText: '设备', symptom: '坏了', reportedAt: 'yesterday' }, catalog), /时间无效/);
});

test('重复规则核对两小时时间窗，不合并记录', () => {
  const a = { ...catalog.reports[0], id: 'A', reportedAt: '2026-08-01T12:00:00+08:00' };
  const b = { ...a, id: 'B', reportedAt: '2026-08-01T13:00:00+08:00' };
  const c = { ...a, id: 'C', reportedAt: '2026-08-01T16:00:00+08:00' };
  const result = analyze(a, [a, b, c], catalog);
  assert.deepEqual(result.duplicates.map(x => x.id), ['B']);
  assert.equal(result.duplicates[0].timeVerified, true);
});

test('图谱使用真实节点边和 SourceId，不凭空建立连线', () => {
  const center = catalog.graph.nodes.find(n => n.label === 'NJ-003');
  const graph = neighborhood(catalog.graph, [center.id]);
  assert(graph.nodes.length > 1);
  assert(graph.edges.length > 0);
  assert(graph.edges.every(e => catalog.graph.edges.some(real => real.id === e.id)));
  assert(graph.nodes.some(n => n.sourceRefs.length > 0));
  assert(catalog.vendors.some(v => v.id === 'V-NET-02' && v.categories.includes('network') && v.stores.includes('NJ-003')));
});

test('人工确认、证据版本和幂等操作是本地草稿前置条件', () => {
  const run = analyze(catalog.reports[0], catalog.reports, catalog);
  const state = { reports: [], runs: [run], drafts: [] };
  const input = { runId: run.id, confirmed: true, operator: '本地测试', operationId: 'test-operation-01' };
  assert.throws(() => makeDraft({ ...input, confirmed: false }, state, catalog), /确认/);
  assert.throws(() => makeDraft(input, state, { ...catalog, fingerprint: 'changed' }), /重新分析/);
  const draft = makeDraft(input, state, catalog); state.drafts.push(draft);
  assert.equal(makeDraft(input, state, catalog).id, draft.id);
  assert.throws(() => makeDraft({ ...input, operator: '另一操作人' }, state, catalog), /不同内容/);
  assert.equal(draft.externalWrite, false);
  assert.equal(draft.status, 'local-draft');
});

async function originalHashes() {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push([path, digest(await readFile(join(root, path)))]);
    }
  }
  for (const dir of ['.fde', 'fde-resources', 'fde-deliverables']) await walk(dir);
  return files.sort((a, b) => a[0].localeCompare(b[0]));
}

test('真实 HTTP 闭环：新增 → 分析 → 并发幂等保存 → 重启读回；原件不变', async () => {
  const before = await originalHashes();
  const stateDir = await mkdtemp(join(tmpdir(), 'fde-repair-test-'));
  let server = await createApp({ root, stateDir });
  const listen = async () => { await new Promise(r => server.listen(0, '127.0.0.1', r)); return `http://127.0.0.1:${server.address().port}`; };
  const close = () => new Promise(r => server.close(r));
  let url = await listen();
  async function request(path, data, expected = 200) {
    const response = await fetch(url + path, data ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : undefined);
    const value = await response.json(); assert.equal(response.status, expected, JSON.stringify(value)); return value;
  }
  try {
    const report = await request('/api/reports', { storeId: 'NJ-003', assetText: '收银终端', symptom: '无法联网，顾客排队', impact: '全店交易中断' }, 201);
    const run = await request('/api/analyze', { reportId: report.id }, 201);
    assert.equal(run.risk.priority, 'P0');
    const input = { runId: run.id, confirmed: true, operator: 'HTTP 测试', operationId: 'http-verified-operation', note: '仅本地草稿' };
    const [a, b] = await Promise.all([request('/api/drafts', input), request('/api/drafts', input)]);
    assert.equal(a.id, b.id);
    assert.equal((await request('/api/overview')).drafts.length, 1);
    assert.deepEqual(await request(`/api/drafts/${a.id}`), a);
    await request('/api/drafts', { ...input, note: '不同内容' }, 409);
    await request('/api/source?id=../../AGENTS.md', undefined, 404);
    const source = await request(`/api/source?id=${encodeURIComponent(catalog.sources.find(s => s.name.endsWith('.md')).id)}`);
    assert.equal(typeof source.text, 'string');
    const forbidden = await fetch(url + '/api/reports', { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(forbidden.status, 403);
    assert((await (await fetch(url)).text()).includes('门店维修工作台'));
    await close(); server = await createApp({ root, stateDir }); url = await listen();
    assert.equal((await request(`/api/drafts/${a.id}`)).id, a.id);
    assert.deepEqual(await originalHashes(), before);
    // 后续阶段可新增登记文件；应用执行前后的全部文件仍须逐一保持不变。
    assert(before.length >= 144, '至少保留初始阶段材料，允许新增后续阶段记录');
  } finally { await close(); await rm(stateDir, { recursive: true }); }
});
