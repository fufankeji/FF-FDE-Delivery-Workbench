import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, realpath, stat, utimes, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const materialRoot = import.meta.dirname;
const repositoryRoot = resolve(materialRoot, '../..');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function projectPath(root, path) {
  if (isAbsolute(path) || path.includes('\\') || path.split('/').some(part => ['', '.', '..'].includes(part))) {
    throw new Error(`素材路径不合法：${path}`);
  }
  return join(root, path);
}

/** 仅初始化一个全新隔离目录，不改现有 Workspace、会话或项目文件。 */
export async function loadProject(destination = join(repositoryRoot, '.runtime/fde-agent-sample')) {
  const target = resolve(destination);
  const manifest = await json(join(materialRoot, 'manifest.json'));
  if (manifest.schemaVersion !== 1) throw new Error('不支持此素材清单版本。');
  const paths = new Set();
  for (const entry of manifest.files) {
    const source = projectPath(join(materialRoot, 'project'), entry.path);
    if (paths.has(entry.path) || !(await lstat(source)).isFile()) throw new Error(`素材文件无效：${entry.path}`);
    paths.add(entry.path);
    const bytes = await readFile(source);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) {
      throw new Error(`素材校验失败，请恢复仓库原件后再导入：${entry.path}`);
    }
  }
  await mkdir(dirname(target), { recursive: true });
  try {
    await mkdir(target);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`目标已存在，未覆盖任何数据：${target}。继续使用它，或指定另一个全新目录。`);
    throw error;
  }
  const workspace = join(await realpath(target), 'project');
  const dshHome = join(await realpath(target), 'dsh-home');
  for (const entry of manifest.files) {
    const output = projectPath(workspace, entry.path);
    await mkdir(dirname(output), { recursive: true });
    await copyFile(projectPath(join(materialRoot, 'project'), entry.path), output, constants.COPYFILE_EXCL);
  }
  let sourceCount = 0;
  for (const entry of manifest.files.filter(file => file.path.startsWith('.fde/sources/'))) {
    const record = await json(projectPath(workspace, entry.path));
    if (!paths.has(record.relativePath)) throw new Error(`资料原件缺失：${record.relativePath}`);
    const original = projectPath(workspace, record.relativePath);
    // Git 不保存 mtime；恢复原索引的时间，不能改索引字节或重签历史测试指纹。
    await utimes(original, record.mtimeMs / 1000, record.mtimeMs / 1000);
    const info = await stat(original);
    if (info.size !== record.bytes || info.mtimeMs !== record.mtimeMs) {
      throw new Error(`文件系统无法保留资料时间精度：${record.relativePath}。本次未登记工作区；请换用本地磁盘上的新目录。`);
    }
    sourceCount += 1;
  }
  const workspaceId = randomUUID();
  const now = new Date().toISOString();
  const storageRoot = join(dshHome, 'storages');
  await mkdir(storageRoot, { recursive: true });
  const writeJson = (name, value) => writeFile(join(storageRoot, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  await writeJson('workspace.json', {
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: [workspaceId], archivedSessionIds: [] },
    tables: { workspaces: { [workspaceId]: {
      path: workspace, title: manifest.title, sessionIds: [], createdAt: now, updatedAt: now,
    } } },
  });
  await writeJson('fde_stage.json', {
    unit: { name: 'fde_stage', version: 1 }, global: null,
    tables: { projects: { [workspaceId]: manifest.lifecycle } },
  });
  return { workspaceId, workspace, dshHome, sourceCount, fileCount: manifest.files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length > 3) throw new Error('用法：node source-materials/fde-agent/load.mjs [全新目标目录]');
    const result = await loadProject(process.argv[2]);
    console.log(JSON.stringify(result, null, 2));
    console.log('\n已载入项目资料与历史阶段状态；没有复制会话、凭证或正在运行的进程。');
    console.log('从 upstream/deepseek-harness 目录启动，显式将 DSH_HOME 设为上面的 dshHome。');
    console.log('示例命令（3080 被占用时请选其他空闲端口，不要终止其他项目）：');
    const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
    console.log(`DSH_HOME=${quote(result.dshHome)} corepack pnpm dsh web --no-open --host 127.0.0.1 --port 3080`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
