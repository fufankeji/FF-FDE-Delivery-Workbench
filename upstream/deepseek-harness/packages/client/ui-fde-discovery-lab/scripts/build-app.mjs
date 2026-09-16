import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
export async function buildApp() {
  await mkdir(root+'lib/app', {recursive:true});
  await build({entryPoints:[root+'app/lan.tsx'],outfile:root+'lib/app/app.js',bundle:true,format:'esm',platform:'browser',target:'es2022',jsx:'automatic',minify:true,legalComments:'inline',define:{'process.env.NODE_ENV':'"production"'}});
  await copyFile(root+'app/index.html',root+'lib/app/index.html');
}
