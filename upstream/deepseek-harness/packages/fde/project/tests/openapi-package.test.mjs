import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const dependencyRequire = createRequire(createRequire(new URL('../package.json', import.meta.url)).resolve('dsh-openapi/package.json'));
const { parse, stringify } = dependencyRequire('yaml');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const owners = ['packages/bundle/web-app', 'packages/fde/project'];
const localSpec = 'file:../../../third-party/dsh-openapi';
const packageKey = 'dsh-openapi@file:third-party/dsh-openapi';

test('both consumers and every locked OpenAPI resolution use the checked-in package', async () => {
  const lock = parse(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'));
  for (const owner of owners) {
    const manifest = await json(join(root, owner, 'package.json'));
    const section = owner.includes('/bundle/') ? 'dependencies' : 'devDependencies';
    assert.equal(manifest[section]['dsh-openapi'], localSpec);
    assert.equal(resolve(root, owner, localSpec.slice(5)), join(root, 'third-party/dsh-openapi'));
    const entry = lock.importers[owner][section]['dsh-openapi'];
    assert.equal(entry.specifier, localSpec);
    assert.ok(entry.version.startsWith('file:third-party/dsh-openapi('));
    assert.ok(lock.snapshots['dsh-openapi@' + entry.version]);
  }
  assert.deepEqual(Object.keys(lock.packages).filter(key => key.startsWith('dsh-openapi@')), [packageKey]);
  assert.deepEqual(lock.packages[packageKey].resolution, { directory: 'third-party/dsh-openapi', type: 'directory' });
  assert.ok(Object.keys(lock.snapshots).filter(key => key.startsWith('dsh-openapi@')).every(key => key.startsWith(packageKey)));
});

test('the complete installed distribution and MIT notice retain their recorded bytes', async () => {
  const source = await json(join(root, 'third-party/dsh-openapi.source.json'));
  assert.equal(Object.keys(source.files).length, 8);
  for (const [file, expected] of Object.entries(source.files)) {
    assert.equal(createHash('sha256').update(await readFile(join(root, 'third-party/dsh-openapi', file))).digest('hex'), expected, file);
  }
  const license = await readFile(join(root, 'third-party/dsh-openapi/LICENSE'), 'utf8');
  assert.match(license, /MIT License/);
  assert.match(license, /Copyright \(c\) 2026 Degurechaff57/);
});

test('a fresh dependency store installs the local package and preserves catalog and HTTP behavior', { timeout: 90_000 }, async () => {
  const fixture = await realpath(await mkdtemp(join(tmpdir(), 'fde-openapi-install-')));
  let server;
  try {
    await cp(join(root, 'third-party/dsh-openapi'), join(fixture, 'third-party/dsh-openapi'), { recursive: true });
    const lock = parse(await readFile(join(root, 'pnpm-lock.yaml'), 'utf8'));
    const openApiSnapshot = Object.entries(lock.snapshots).find(([key]) => key.startsWith(packageKey))[1];
    const yamlVersion = openApiSnapshot.dependencies.yaml;
    const fixtureLock = {
      lockfileVersion: '9.0', settings: { autoInstallPeers: false, excludeLinksFromLockfile: false },
      importers: { '.': {} },
      packages: { [packageKey]: lock.packages[packageKey], ['yaml@' + yamlVersion]: lock.packages['yaml@' + yamlVersion] },
      snapshots: { [packageKey]: { dependencies: { yaml: yamlVersion } }, ['yaml@' + yamlVersion]: lock.snapshots['yaml@' + yamlVersion] },
    };
    for (const owner of owners) {
      await mkdir(join(fixture, owner), { recursive: true });
      await writeFile(join(fixture, owner, 'package.json'), JSON.stringify({ name: 'fixture-' + owner.split('/').at(-1), private: true, dependencies: { 'dsh-openapi': localSpec } }));
      fixtureLock.importers[owner] = { dependencies: { 'dsh-openapi': { specifier: localSpec, version: 'file:third-party/dsh-openapi' } } };
    }
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ private: true, packageManager: 'pnpm@10.34.5' }));
    // The Host supplies Cordis peers. This installation probe downloads only the parser's normal yaml dependency.
    await writeFile(join(fixture, 'pnpm-workspace.yaml'), stringify({ packages: ['packages/*/*'], autoInstallPeers: false }));
    await writeFile(join(fixture, 'pnpm-lock.yaml'), stringify(fixtureLock));
    await writeFile(join(fixture, 'empty.npmrc'), '');
    const env = Object.fromEntries(['PATH', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'SystemRoot', 'COMSPEC'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
    env.npm_config_userconfig = join(fixture, 'empty.npmrc');
    env.npm_config_globalconfig = join(fixture, 'empty.npmrc');
    await promisify(execFile)('corepack', ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts', '--store-dir', join(fixture, 'store'), '--registry=https://registry.npmjs.org'], {
      cwd: fixture, env, timeout: 60_000, maxBuffer: 1024 * 1024,
    });
    for (const owner of owners) {
      const require = createRequire(join(fixture, owner, 'package.json'));
      const installed = await realpath(require.resolve('dsh-openapi/package.json'));
      assert.ok(installed.startsWith(fixture + sep), installed);
      assert.equal((await json(installed)).version, '0.1.0');
    }
    const require = createRequire(join(fixture, owners[1], 'package.json'));
    const installedRoot = dirname(require.resolve('dsh-openapi/package.json'));
    const openapi = await import(pathToFileURL(join(installedRoot, 'src/openapi.js')).href);
    const http = await import(pathToFileURL(join(installedRoot, 'src/http.js')).href);
    server = createServer((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const api = { id: 'project', baseUrl: `http://127.0.0.1:${server.address().port}`, allowedMethods: ['GET', 'HEAD'], headers: {}, credentials: [], allowPrivateNetwork: true };
    const document = openapi.parseOpenApi('openapi: 3.1.0\ninfo: {title: Local API, version: "1"}\npaths:\n  /items:\n    get:\n      operationId: listItems\n      responses: {"200": {description: ok}}\n');
    const catalog = openapi.buildCatalog(document, api, 'fixture.yaml', 100);
    assert.equal(catalog.operations.length, 1);
    const operation = catalog.operations[0];
    assert.equal(openapi.describeOperation(operation).operationId, 'listItems');
    const policy = { timeoutMs: 5000, maxResponseBytes: 1024, maxRedirects: 0 };
    assert.deepEqual((await http.requestOperation(operation, {}, api, policy)).body, { ok: true });
    await assert.rejects(http.requestOperation({ ...operation, method: 'POST' }, {}, api, policy), /disabled/);
    await assert.rejects(http.requestOperation(operation, {}, { ...api, allowPrivateNetwork: false }, policy), /private|loopback/i);
  } finally {
    if (server) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
    await rm(fixture, { recursive: true, force: true });
  }
});
