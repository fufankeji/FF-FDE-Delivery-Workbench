/** Subprocess boundary for the version-pinned Semantica Python SDK. */

import { spawn } from 'node:child_process'
import { delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SemanticProviderConfig } from './types.ts'

const MAX_BRIDGE_OUTPUT_BYTES = 4 * 1024 * 1024

interface BridgeSuccess<T> { readonly ok: true; readonly value: T }
interface BridgeFailure { readonly ok: false; readonly error?: { readonly type?: string; readonly message?: string } }

/** Stable failure surfaced by the Provider routes and run evidence. */
export class SemanticaBridgeError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'SemanticaBridgeError'
  }
}

/** Execute one bounded Semantica SDK operation without invoking a shell. */
export async function runSemantica<T>(
  config: SemanticProviderConfig,
  operation: 'health' | 'extract' | 'propose-schema' | 'publish-schema' | 'build' | 'validate' | 'context',
  input: unknown,
): Promise<T> {
  const bridge = fileURLToPath(new URL('../python/bridge.py', import.meta.url))
  return await new Promise<T>((resolve, reject) => {
    const pythonPath = config.semanticaSource === undefined
      ? process.env.PYTHONPATH
      : [config.semanticaSource, process.env.PYTHONPATH].filter(Boolean).join(delimiter)
    const child = spawn(config.pythonCommand, [bridge, operation], {
      cwd: config.semanticaSource,
      env: { ...process.env, ...(pythonPath === undefined ? {} : { PYTHONPATH: pythonPath }) },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutBytes = 0
    let stderrBytes = 0
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      child.kill('SIGTERM')
      settled = true
      reject(new SemanticaBridgeError('provider-timeout', `Semantica ${operation} 超过 ${String(config.operationTimeoutMs)}ms，已停止。`))
    }, config.operationTimeoutMs)
    timer.unref()

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.byteLength
      if (stdoutBytes <= MAX_BRIDGE_OUTPUT_BYTES) stdout.push(chunk)
      else child.kill('SIGTERM')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.byteLength
      if (stderrBytes <= MAX_BRIDGE_OUTPUT_BYTES) stderr.push(chunk)
    })
    child.on('error', (error) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      reject(new SemanticaBridgeError('provider-unavailable', `无法启动 Semantica Python：${error.message}`))
    })
    child.on('close', (code) => {
      if (settled) return
      settled = true; clearTimeout(timer)
      if (stdoutBytes > MAX_BRIDGE_OUTPUT_BYTES) {
        reject(new SemanticaBridgeError('provider-output-too-large', 'Semantica 返回内容超过 4 MiB 限制。'))
        return
      }
      const text = Buffer.concat(stdout).toString('utf8')
      let payload: BridgeSuccess<T> | BridgeFailure
      try { payload = JSON.parse(text) as BridgeSuccess<T> | BridgeFailure } catch {
        const diagnostic = Buffer.concat(stderr).toString('utf8').trim().slice(-1_000)
        reject(new SemanticaBridgeError('provider-invalid-response', `Semantica 返回了无效响应${diagnostic === '' ? '' : `：${diagnostic}`}`))
        return
      }
      if (code !== 0 || !payload.ok) {
        const message = !payload.ok ? payload.error?.message : undefined
        const diagnostic = Buffer.concat(stderr).toString('utf8').trim().slice(-1_000)
        reject(new SemanticaBridgeError(
          'provider-operation-failed',
          message ?? (diagnostic === '' ? `Semantica ${operation} 执行失败。` : diagnostic),
        ))
        return
      }
      resolve(payload.value)
    })
    child.stdin.end(JSON.stringify(input))
  })
}
