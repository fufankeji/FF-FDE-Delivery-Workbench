import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { verifyBundledAssets } from './upstream/deepseek-harness/packages/fde/discovery-lab/src/assets.ts';

const root = import.meta.dirname;
const manifest = JSON.parse(await readFile(resolve(root, 'MANIFEST.json'), 'utf8'));
const version = JSON.parse(await readFile(resolve(root, 'SOURCE_VERSION.json'), 'utf8'));
if (!/^[a-f0-9]{40}$/.test(version.sourceCommit)) throw new Error('源码版本无效');
const seen = new Set();
for (const entry of manifest.files) {
  const file = resolve(root, entry.path);
  if (!file.startsWith(root + sep) || entry.path.includes('\\') || entry.path.split('/').includes('..') || seen.has(entry.path)) throw new Error('文件清单路径无效');
  seen.add(entry.path);
  let parent = root;
  for (const part of entry.path.split('/')) {
    parent = resolve(parent, part);
    if ((await lstat(parent)).isSymbolicLink()) throw new Error(`不允许符号链接：${entry.path}`);
  }
  const bytes = await readFile(file);
  if (bytes.length !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`文件校验失败：${entry.path}`);
}
for (const file of ['upstream/deepseek-harness/package.json', 'upstream/deepseek-harness/pnpm-lock.yaml', 'upstream/deepseek-harness/third-party/dsh-openapi/package.json', 'frontend/public/brand/ff-logo.png', 'source-materials/fde-agent/manifest.json', 'upstream/deepseek-harness/packages/fde/discovery-lab/assets-manifest.json']) {
  if (!seen.has(file)) throw new Error(`缺少必需文件：${file}`);
}
console.log(`源码完整性通过：${seen.size} 文件；版本 ${version.sourceCommit}`);
const lab = verifyBundledAssets(resolve(root, 'upstream/deepseek-harness/packages/fde/discovery-lab'));
console.log(`实验室完整性通过：${lab.cases} 案例、${lab.references} 份引用资料、${lab.files} 文件。`);
console.log(`当前 Node ${process.version}；部署要求 Node 24.x（至少 24.9.0）、pnpm 11.28.5。此检查不代表安装、构建或模型调用已成功。`);
