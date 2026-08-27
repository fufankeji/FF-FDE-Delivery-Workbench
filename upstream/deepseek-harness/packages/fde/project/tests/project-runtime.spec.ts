import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  abandonProjectRuntimeOperation,
  beginProjectRuntimeOperation,
  readProjectRuntime,
  reportProjectRuntime,
} from '../src/project-runtime.ts'
import { loadProjectSurfaceSnapshot } from '../src/snapshot.ts'

describe('FDE project runtime', () => {
  it('keeps one exact Agent-owned start and stop lifecycle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-runtime-'))
    await expect(readProjectRuntime(root)).resolves.toMatchObject({ revision: 0, status: 'stopped' })

    const starting = await beginProjectRuntimeOperation(root, 'start', 'session-1')
    expect(starting).toMatchObject({ revision: 1, status: 'starting', action: 'start', sessionId: 'session-1' })
    await expect(reportProjectRuntime(root, {
      operationId: starting.operationId!, status: 'running', previewUrl: 'http://127.0.0.1:3000',
    }, 'session-other')).rejects.toThrow('发起操作的项目会话')
    await expect(reportProjectRuntime(root, {
      operationId: starting.operationId!, status: 'running', previewUrl: 'https://example.com',
    }, 'session-1')).rejects.toThrow('loopback')

    const running = await reportProjectRuntime(root, {
      operationId: starting.operationId!,
      status: 'running',
      message: '前后端已经就绪。',
      previewUrl: 'http://127.0.0.1:3000',
      docsUrl: 'http://127.0.0.1:8000/docs',
      openapiSource: 'http://127.0.0.1:8000/openapi.json',
      baseUrl: 'http://127.0.0.1:8000',
      terminalTitle: '项目运行',
    }, 'session-1')
    expect(running).toMatchObject({ revision: 2, status: 'running', terminalTitle: '项目运行' })
    const surface = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '项目', path: root })
    expect(surface.runtime.status).toBe('running')
    expect(surface.apiDocs).toMatchObject({
      status: 'configured', openapiSource: 'http://127.0.0.1:8000/openapi.json',
    })

    const stopping = await beginProjectRuntimeOperation(root, 'stop', 'session-2')
    expect(stopping).toMatchObject({ status: 'stopping', action: 'stop', sessionId: 'session-1' })
    const blocked = await reportProjectRuntime(root, {
      operationId: stopping.operationId!, status: 'blocked', message: '服务退出状态尚未确认。',
    }, 'session-1')
    expect(blocked).toMatchObject({ status: 'blocked', action: 'stop', previewUrl: 'http://127.0.0.1:3000/' })
    await expect(beginProjectRuntimeOperation(root, 'start', 'session-1')).rejects.toThrow('先重试停止')

    const retry = await beginProjectRuntimeOperation(root, 'stop', 'session-1')
    const stopped = await reportProjectRuntime(root, {
      operationId: retry.operationId!, status: 'stopped', message: '服务已退出。',
    }, 'session-1')
    expect(stopped).toMatchObject({ status: 'stopped', terminalTitle: '项目运行' })
    expect(stopped).not.toHaveProperty('previewUrl')
  })

  it('settles a start whose visible Agent prompt was not queued', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-runtime-abandon-'))
    const starting = await beginProjectRuntimeOperation(root, 'start', 'session-1')
    const blocked = await abandonProjectRuntimeOperation(root, starting.operationId!, '项目会话不可用。')
    expect(blocked).toMatchObject({ status: 'blocked', action: 'start', message: '项目会话不可用。' })
    const retry = await beginProjectRuntimeOperation(root, 'start', 'session-1')
    expect(retry).toMatchObject({ status: 'starting', action: 'start' })
  })

  it('recovers the current Agent-owned blocked start after the project becomes runnable', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fde-project-runtime-recovery-'))
    const starting = await beginProjectRuntimeOperation(root, 'start', 'session-1')
    const blocked = await reportProjectRuntime(root, {
      operationId: starting.operationId!, status: 'blocked', message: '缺少 AGENTS.md。',
    }, 'session-1')
    expect(blocked).toMatchObject({ revision: 2, status: 'blocked', action: 'start' })

    await expect(reportProjectRuntime(root, {
      operationId: starting.operationId!, status: 'running', previewUrl: 'http://127.0.0.1:5173',
    }, 'session-other')).rejects.toThrow('发起操作的项目会话')
    await expect(reportProjectRuntime(root, {
      operationId: starting.operationId!, status: 'running', previewUrl: 'https://example.com',
    }, 'session-1')).rejects.toThrow('loopback')

    const running = await reportProjectRuntime(root, {
      operationId: starting.operationId!,
      status: 'running',
      message: '项目已经恢复并验证成功。',
      previewUrl: 'http://127.0.0.1:5173',
      docsUrl: 'http://127.0.0.1:8000/docs',
      openapiSource: 'http://127.0.0.1:8000/openapi.json',
      baseUrl: 'http://127.0.0.1:8000',
      terminalTitle: '项目运行',
    }, 'session-1')
    expect(running).toMatchObject({ revision: 3, status: 'running', operationId: starting.operationId })
    const surface = await loadProjectSurfaceSnapshot({ workspaceId: 'w1', title: '项目', path: root })
    expect(surface.apiDocs).toMatchObject({
      status: 'configured', openapiSource: 'http://127.0.0.1:8000/openapi.json',
    })

    const stopping = await beginProjectRuntimeOperation(root, 'stop', 'session-1')
    await reportProjectRuntime(root, {
      operationId: stopping.operationId!, status: 'blocked', message: '停止结果未知。',
    }, 'session-1')
    await expect(reportProjectRuntime(root, {
      operationId: stopping.operationId!, status: 'running', previewUrl: 'http://127.0.0.1:5173',
    }, 'session-1')).rejects.toThrow('当前 blocked 状态不能报告为 running')
  })
})
