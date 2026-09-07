import { createServer } from 'node:http';
import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadCatalog, safeProjectFile, neighborhood } from './catalog.mjs';
import { analyze, validateReport, makeDraft, riskFor, UserError } from './workflow.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.pdf': 'application/pdf', '.svg': 'image/svg+xml' };
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(value)); };

async function body(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new UserError('请求必须为 JSON', 415);
  let bytes = 0; const chunks = [];
  for await (const chunk of req) { bytes += chunk.length; if (bytes > 32_768) throw new UserError('请求超过大小限制', 413); chunks.push(chunk); }
  try { const data = JSON.parse(Buffer.concat(chunks).toString()); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); return data; }
  catch { throw new UserError('JSON 内容无效'); }
}

export async function createApp({ root = ROOT, stateDir = join(root, '.runtime/maintenance') } = {}) {
  let state;
  try { state = JSON.parse(await readFile(join(stateDir, 'state.json'), 'utf8')); }
  catch (err) { if (err.code !== 'ENOENT') throw new Error('运行记录无法读取；已保留原文件，请检查后重试。'); state = { reports: [], runs: [], drafts: [] }; }
  if (!Array.isArray(state.reports) || !Array.isArray(state.runs) || !Array.isArray(state.drafts)) throw new Error('运行记录格式错误，未覆盖原文件');
  // Serialize read-modify-write operations and commit memory only after durable success.
  let queue = Promise.resolve();
  function mutate(fn) {
    const result = queue.then(async () => {
      const next = structuredClone(state);
      const value = await fn(next);
      await mkdir(stateDir, { recursive: true });
      const temp = join(stateDir, `state-${randomUUID()}.tmp`);
      await writeFile(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
      await rename(temp, join(stateDir, 'state.json'));
      state = next;
      return value;
    });
    queue = result.catch(() => {}); return result;
  }
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self' http://127.0.0.1:3080 http://localhost:3080");
    try {
      const expected = `127.0.0.1:${server.address().port}`;
      const permitted = [expected, `localhost:${server.address().port}`];
      if (!permitted.includes(req.headers.host)) throw new UserError('仅允许本地项目地址', 403);
      if (req.headers.origin && !permitted.map(x => `http://${x}`).includes(req.headers.origin)) throw new UserError('不接受其他站点的请求', 403);
      const url = new URL(req.url, `http://${expected}`);
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true, name: 'FF - 门店维修工作台', mode: 'local', modelConnected: false });
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
        const paths = { '/': 'frontend/index.html', '/app.js': 'frontend/app.js', '/style.css': 'frontend/style.css', '/brand/ff-logo.png': 'frontend/public/brand/ff-logo.png' };
        const path = paths[url.pathname]; if (!path) throw new UserError('页面不存在', 404);
        res.setHeader('Content-Type', MIME[extname(path)]); return res.end(await readFile((await safeProjectFile(root, path)).file));
      }
      const catalog = await loadCatalog(root);
      if (req.method === 'GET' && url.pathname === '/api/overview') return json(res, 200, {
        reports: [...catalog.reports, ...state.reports].map(r => ({ ...r, risk: riskFor(r) })),
        runs: state.runs, drafts: state.drafts, sources: catalog.sources, stores: catalog.stores,
        graph: { nodes: catalog.graph.nodes.length, edges: catalog.graph.edges.length, revision: catalog.graph.revision, provider: catalog.graph.provider },
        mode: '规则 + 图谱快照', modelConnected: false,
      });
      if (req.method === 'GET' && url.pathname === '/api/graph') {
        const id = url.searchParams.get('node');
        if (id && !catalog.graph.nodes.some(n => n.id === id)) throw new UserError('实体不存在', 404);
        return json(res, 200, id ? neighborhood(catalog.graph, [id]) : catalog.graph);
      }
      if (req.method === 'GET' && url.pathname === '/api/source') {
        const source = catalog.sources.find(x => x.id === url.searchParams.get('id') || x.path === url.searchParams.get('id'));
        if (!source) throw new UserError('资料不在当前项目清单中', 404);
        const { file } = await safeProjectFile(root, source.path);
        const ext = extname(source.path);
        if (ext === '.png' || ext === '.pdf') {
          res.setHeader('Content-Type', MIME[ext]); return res.end(await readFile(file));
        }
        return json(res, 200, { ...source, text: await readFile(file, 'utf8') });
      }
      if (req.method === 'GET' && url.pathname.startsWith('/api/drafts/')) {
        const draft = state.drafts.find(d => d.id === url.pathname.split('/').pop());
        if (!draft) throw new UserError('草稿不存在', 404);
        return json(res, 200, draft);
      }
      if (req.method === 'POST' && url.pathname === '/api/reports') {
        const report = validateReport(await body(req), catalog);
        await mutate(s => { s.reports.push(report); }); return json(res, 201, report);
      }
      if (req.method === 'POST' && url.pathname === '/api/analyze') {
        const input = await body(req);
        const run = await mutate(s => {
          const reports = [...catalog.reports, ...s.reports]; const report = reports.find(r => r.id === input.reportId);
          if (!report) throw new UserError('请选择有效报修记录', 404);
          const result = analyze(report, reports, catalog); s.runs.push(result); return result;
        }); return json(res, 201, run);
      }
      if (req.method === 'POST' && url.pathname === '/api/drafts') {
        const input = await body(req);
        const draft = await mutate(s => { const d = makeDraft(input, s, catalog); if (!s.drafts.some(x => x.id === d.id)) s.drafts.push(d); return d; });
        return json(res, 200, draft);
      }
      throw new UserError('接口不存在', 404);
    } catch (err) {
      if (res.headersSent) return res.end();
      json(res, err.status ?? 500, { error: err instanceof UserError ? err.message : '读取或保存失败，原始资料未被修改。请检查本地服务终端。' });
      if (!(err instanceof UserError)) console.error(err.message);
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createApp();
  const port = Number(process.env.REPAIR_PORT ?? 4177);
  server.listen(port, '127.0.0.1', () => console.log(`FF - 门店维修工作台 http://127.0.0.1:${port}\n本地规则 + 既有图谱；无生产派单、无模型调用。Ctrl+C 停止。`));
}
