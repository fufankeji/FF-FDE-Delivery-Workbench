#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..')
const templateRoot = join(repositoryRoot, 'handoff', 'dsh-home-template')
const runtimeRoot = join(repositoryRoot, '.runtime', 'dsh-home')
const workspacePath = join(repositoryRoot, 'workspaces', 'ai-analysis')
const appPath = join(repositoryRoot, 'app', 'deepseek-harness')
const markerPath = join(runtimeRoot, '.handoff-state.json')

const WORKSPACE_PLACEHOLDER = '__FDE_WORKSPACE_PATH__'
const APP_PLACEHOLDER = '__FDE_APP_PATH__'
const PROJECT_BUCKET_PLACEHOLDER = '__FDE_PROJECT_BUCKET__'

function fail(message) {
  console.error(`[restore] ${message}`)
  process.exit(1)
}

function projectKey(cwd) {
  let readable = ''
  let separatorRun = false

  for (let index = 0; index < cwd.length; index += 1) {
    const code = cwd.charCodeAt(index)
    const character = String.fromCharCode(code)

    if (character === '/' || character === '\\' || character === ':') {
      if (!separatorRun) readable += '-'
      separatorRun = true
    } else if (character !== '~' && /^[A-Za-z0-9._-]$/.test(character)) {
      readable += character
      separatorRun = false
    } else {
      readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
      separatorRun = false
    }
  }

  const slug = readable.replace(/^-+/, '') || 'root'
  return `--${slug.slice(0, 251)}--`
}

function replacePlaceholders(filePath) {
  const original = readFileSync(filePath, 'utf8')
  const migrated = original
    .split(WORKSPACE_PLACEHOLDER).join(workspacePath)
    .split(APP_PLACEHOLDER).join(appPath)

  if (migrated === original) return
  writeFileSync(filePath, migrated, 'utf8')
}

if (!existsSync(templateRoot)) fail(`找不到交接模板：${templateRoot}`)
if (!existsSync(workspacePath)) fail(`找不到数据分析项目：${workspacePath}`)
if (!existsSync(appPath)) fail(`找不到工作台源码：${appPath}`)

if (existsSync(markerPath)) {
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'))
  if (marker.workspacePath === workspacePath && marker.appPath === appPath) {
    console.log(`[restore] 隔离工作区已经恢复：${runtimeRoot}`)
    console.log(`[restore] 项目：${workspacePath}`)
    process.exit(0)
  }
}

if (existsSync(runtimeRoot) && readdirSync(runtimeRoot).length > 0) {
  fail(`目标目录已有数据，已停止以避免覆盖：${runtimeRoot}\n请先把该目录移动为备份，再重新执行。`)
}

mkdirSync(runtimeRoot, { recursive: true })
for (const entry of readdirSync(templateRoot)) {
  cpSync(join(templateRoot, entry), join(runtimeRoot, entry), {
    recursive: true,
    preserveTimestamps: true,
  })
}

replacePlaceholders(join(runtimeRoot, 'storages', 'workspace.json'))
replacePlaceholders(join(runtimeRoot, 'storages', 'session_projcache.json'))

const sessionsRoot = join(runtimeRoot, 'sessions')
const templateBucket = join(sessionsRoot, PROJECT_BUCKET_PLACEHOLDER)
if (!existsSync(templateBucket) || !statSync(templateBucket).isDirectory()) {
  fail(`会话模板目录不存在：${templateBucket}`)
}

let sessionCount = 0
for (const sessionId of readdirSync(templateBucket)) {
  const sessionFile = join(templateBucket, sessionId, 'session.jsonl')
  if (!existsSync(sessionFile)) continue
  replacePlaceholders(sessionFile)
  sessionCount += 1
}

const restoredBucket = join(sessionsRoot, projectKey(workspacePath))
if (existsSync(restoredBucket)) fail(`目标会话目录已经存在：${restoredBucket}`)
renameSync(templateBucket, restoredBucket)

writeFileSync(markerPath, `${JSON.stringify({
  schemaVersion: 1,
  restoredAt: new Date().toISOString(),
  workspacePath,
  appPath,
  sessionCount,
}, null, 2)}\n`, 'utf8')

console.log(`[restore] 已恢复隔离 DSH_HOME：${runtimeRoot}`)
console.log(`[restore] 已迁移项目路径：${workspacePath}`)
console.log(`[restore] 已恢复 ${sessionCount} 份会话归档。`)
