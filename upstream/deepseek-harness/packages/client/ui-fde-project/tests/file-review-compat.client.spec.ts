// @vitest-environment jsdom
/** Load the distributed browser factory against current Conversation and Slots. */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import { SlotTestRuntime } from '@deepseek-ai/dsh-client-test-runtime'
import { UiConversation, ConversationNodeAssembler } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConversationTimelineSnapshot, ConversationViewDefinition, ConversationViewNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionEventLikeEntry } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import type { Context } from '@deepseek-ai/cordis'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import * as Gateway from '@deepseek-ai/dsh-api-gateway/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

it.each([true, false])('activates and renders the production list slot (declared first: %s)', async (declaredFirst) => {
  const require = createRequire(join(process.cwd(), 'packages/bundle/web-app/package.json'))
  const source = readFileSync(join(dirname(require.resolve('dsh-file-review-tab/package.json')), 'lib/client.js'), 'utf8')
  let plugin: { apply: (ctx: Context) => void; inject: string[] } | undefined
  // This is the package's real module-loader artifact, not a browser or DOM replay.
  new Function('window', source)({ __ModuleLoader__: { load: (row: { factory: (require: (name: string) => object) => typeof plugin }) => {
    plugin = row.factory(name => {
      if (name === 'react') return React
      if (name === 'react/jsx-runtime') return jsx
      throw new Error('Unexpected shared module ' + name)
    })
  } } })
  if (plugin === undefined) throw new Error('No review factory')
  const runtime = await SlotTestRuntime.create()
  try {
    if (declaredFirst) await runtime.declare({ 'conversation.chat.turnTail': { kind: 'list', scope: 'session' } })
    const conversation = new UiConversation(runtime.ctx, runtime.sessions)
    const locale = new LocaleRuntime(runtime.ctx)
    locale.setLocale('zh')
    runtime.ctx.provide('locale', locale)
    runtime.slots.installLocale(locale)
    const removeTab = vi.fn()
    const registerTab = vi.fn(() => removeTab)
    const openTab = vi.fn()
    runtime.ctx.provide('betterSidebar', { registerTab, openTab } as never)
    const scope = runtime.ctx.isolate('remote')
    await scope.plugin(TypertRegistry)
    scope.typert.contexts.registerClient('agent', {
      identity: candidate => runtime.sessions.sessionOf(candidate)?.sessionId,
      resolve: id => runtime.sessions.scope(id),
    })
    const rpcCall = vi.fn<ConnectionHandle['rpc']['call']>(async () => ({
      ok: true, value: { files: [{ path: 'result.txt', state: 'applied', changed: false }] },
    }))
    scope.provide('connection', {
      interactions: 'none', isLoopback: true,
      openWebSocket: () => { throw new Error('No network in registration test') },
      generation: { getSnapshot: () => undefined, subscribe: () => () => {} },
      state: { getSnapshot: () => undefined, subscribe: () => () => {} },
      reconnect: () => {}, registerGenerationSource: () => () => {}, start: () => ({ stop: () => {} }),
      rpc: { call: rpcCall, open: async function* () { throw new Error('No stream in registration test') } },
    } satisfies ConnectionHandle)
    await scope.plugin(Gateway)
    const fiber = scope.plugin(plugin)
    await fiber.await()
    if (!declaredFirst) await runtime.declare({ 'conversation.chat.turnTail': { kind: 'list', scope: 'session' } })
    await vi.waitFor(() => expect(scope.get('remote.fileReview')).toBeDefined())
    expect(runtime.slots.entries('conversation.chat.turnTail')).toHaveLength(1)
    expect(registerTab).toHaveBeenCalledWith(expect.objectContaining({ id: 'file-review' }))
    expect(runtime.ctx.get('chatFileMentions')).toBeDefined()
    const id = await runtime.sessions.add({ id: 'review-session', summary: { cwd: '/project' } })
    const reference = runtime.sessions.retain(id)
    await reference.ready
    const viewDefinition: ConversationViewDefinition<ConversationViewNode, { timeline: ConversationTimelineSnapshot }> = {
      target: 'review-compat',
      create: () => ({
        empty: { timeline: { turnOrder: [], turns: new Map() } },
        replace: ({ timeline }) => ({ timeline }), apply: ({ timeline }) => ({ timeline }),
      }),
    }
    const owner = (mode: 'empty' | 'success' | 'failed') => {
      const event = (seq: number, type: string, data: unknown): SessionEventLikeEntry => ({
        type: 'event', event: { seq, time: seq, type, data, ...(type === 'tool/result' ? { surfaceOp: 'append' } : {}) } as SessionEvent,
      })
      const events = [event(1, 'turn/start', { turn: 1 })]
      if (mode !== 'empty') events.push(
        event(2, 'tool/call', { turn: 1, step: 1, callId: 'write-1', name: 'write', arguments: JSON.stringify({ file_path: 'result.txt', content: 'after\n' }) }),
        event(3, 'tool/result', { turn: 1, step: 1, message: { id: 'result-1', role: 'tool', toolCallId: 'write-1', source: { kind: 'tool', callId: 'write-1' }, content: [], isError: mode === 'failed' } }),
      )
      events.push(event(4, 'turn/end', { turn: 1, reason: { kind: 'completed' } }))
      const assembler = new ConversationNodeAssembler(conversation.events, { entries: () => [viewDefinition] })
      assembler.replaceWindow(events, false)
      assembler.activateTarget('review-compat')
      const snapshot = assembler.snapshot('review-compat') as { timeline: ConversationTimelineSnapshot }
      const turn = snapshot.timeline.turns.get(1)
      if (turn === undefined) throw new Error('Missing Turn')
      return { turn, seq: 4, openFile: vi.fn() }
    }
    const view = runtime.renderSlot('conversation.chat.turnTail', owner('empty'), { session: reference })
    expect(view.container.textContent).toBe('')
    view.update(owner('success'))
    const review = await view.view.findByRole('button', { name: '审查所有产出文件' })
    expect(view.view.getByText('result.txt')).toBeTruthy()
    await vi.waitFor(() => expect(rpcCall).toHaveBeenCalledWith('/api', 'fileReview/status', expect.objectContaining({ args: expect.objectContaining({ agentId: id }) }), expect.any(AbortSignal)))
    fireEvent.click(review)
    expect(openTab).toHaveBeenCalledWith({ type: 'file-review' }, { sessionId: id, cwd: '/project' })
    view.update(owner('failed'))
    expect(view.container.textContent).toBe('')
    await act(async () => { await fiber.dispose() })
    expect(runtime.slots.entries('conversation.chat.turnTail')).toHaveLength(0)
    reference.release()
    expect(removeTab).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(scope.get('remote.fileReview')).toBeUndefined())
    expect(runtime.ctx.get('chatFileMentions')).toBeUndefined()
  } finally { await runtime.dispose() }
})
