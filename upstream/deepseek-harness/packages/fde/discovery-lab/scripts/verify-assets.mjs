import { fileURLToPath } from 'node:url'
import { verifyBundledAssets } from '../src/assets.ts'

const result = verifyBundledAssets(fileURLToPath(new URL('../', import.meta.url)))
console.log(`实验室素材完整：${result.cases} 个案例，${result.references} 份引用资料，${result.files} 个文件，${result.bytes} 字节。`)
