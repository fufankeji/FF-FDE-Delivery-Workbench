import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export const SAMPLE_PATH = 'fde-resources/02-data-sample-and-dictionary.md';
export const GRAPH_PATH = '.fde/design/knowledge-graph.json';
export const CONSTRAINT_PATH = 'fde-resources/01-solution-constraints-1.md';
export const DEVICE_PATH = 'fde-resources/04-device-register.xml';
export const VENDOR_PATH = 'fde-resources/05-vendor-duty-roster.yaml';

/** Select only input columns. Historical final labels never enter a report. */
export function parseSamples(markdown) {
  return markdown.split('\n').filter(line => /^\| R-\d+ \|/.test(line)).map(line => {
    const c = line.split('|').slice(1, 7).map(x => x.trim());
    return { id: c[0], storeId: c[1], assetText: c[2], symptom: c[3], impact: c[4], assetId: c[5],
      reportedAt: null, region: 'east-1', origin: 'sample', sourcePath: SAMPLE_PATH };
  });
}

function parseDevices(xml) {
  return [...xml.matchAll(/<device\s+([^>]+)>([\s\S]*?)<\/device>/g)].map(([, attrs, body]) => {
    const attribute = name => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
    const tag = name => body.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? '';
    return { id: attribute('id'), storeId: attribute('storeId'), category: attribute('category'), status: attribute('status'),
      name: tag('displayName'), location: tag('location'), contractRef: tag('contractRef'), sourcePath: DEVICE_PATH };
  });
}

function parseVendors(yaml) {
  return yaml.split(/\n  - vendor_id: /).slice(1).map(block => {
    const field = name => block.match(new RegExp(`\\n    ${name}: ([^\\n]+)`))?.[1]?.replace(/^"|"$/g, '') ?? '';
    const array = name => field(name).replace(/[\[\]]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    return { id: block.split('\n')[0].trim(), name: field('display_name'), categories: array('categories'), stores: array('covered_stores'),
      duty: field('duty_window'), warning: field('warning'), contractRef: field('contract_ref'), sourcePath: VENDOR_PATH };
  });
}

export async function safeProjectFile(root, path) {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').some(x => !x || x === '..' || x === '.')) throw new Error('文件路径无效');
  const base = await realpath(root);
  const file = await realpath(join(base, path));
  if (!file.startsWith(base + sep)) throw new Error('文件超出项目范围');
  const info = await stat(file);
  if (!info.isFile() || info.size > 10 * 1024 * 1024) throw new Error('文件不可读取或大于 10 MB');
  return { file, info };
}

export async function loadCatalog(root) {
  root = resolve(root);
  const sourceRecords = [];
  for (const name of (await readdir(join(root, '.fde/sources'))).filter(x => x.endsWith('.json'))) {
    const { file } = await safeProjectFile(root, `.fde/sources/${name}`);
    sourceRecords.push(JSON.parse(await readFile(file, 'utf8')));
  }
  const sources = [];
  for (const name of (await readdir(join(root, 'fde-resources'))).sort()) {
    const path = `fde-resources/${name}`;
    const { file, info } = await safeProjectFile(root, path);
    const record = sourceRecords.find(x => x.relativePath === path);
    sources.push({ id: record?.sourceId ?? path, name, path, bytes: info.size, sha256: digest(await readFile(file)) });
  }
  const text = async path => readFile((await safeProjectFile(root, path)).file, 'utf8');
  const graphText = await text(GRAPH_PATH);
  const graph = JSON.parse(graphText);
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('现有图谱格式无法读取');
  const reports = parseSamples(await text(SAMPLE_PATH));
  if (!reports.length) throw new Error('没有找到可用的脱敏报修样本');
  const devices = parseDevices(await text(DEVICE_PATH));
  const vendors = parseVendors(await text(VENDOR_PATH));
  return { reports, devices, vendors, sources, graph, root,
    fingerprint: digest(JSON.stringify(sources.map(s => [s.path, s.sha256])) + graphText),
    stores: [...new Set([...reports.map(r => r.storeId), ...vendors.flatMap(v => v.stores)])].sort(),
  };
}

/** Query real graph edges; visual evidence is not used as a hidden answer key. */
export function neighborhood(graph, ids, depth = 2) {
  const selected = new Set(ids);
  let frontier = new Set(ids);
  for (let hop = 0; hop < depth; hop++) {
    const next = new Set();
    for (const edge of graph.edges) {
      if (frontier.has(edge.source) && !selected.has(edge.target)) next.add(edge.target);
      if (frontier.has(edge.target) && !selected.has(edge.source)) next.add(edge.source);
    }
    for (const id of next) selected.add(id);
    frontier = next;
  }
  return { ...graph, nodes: graph.nodes.filter(n => selected.has(n.id)), edges: graph.edges.filter(e => selected.has(e.source) && selected.has(e.target)) };
}
