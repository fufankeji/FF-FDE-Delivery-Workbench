import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { StageBlankStatus } from '../src/client/StageBlankStatus.tsx'
import { StageHeaderStatus } from '../src/client/StageHeaderStatus.tsx'

describe('ui-fde-stage apply', () => {
  it('registers the two contextual stage entries only after their official Slots exist', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'conversation.input.dock': { kind: 'list', scope: 'session' },
        'conversation.session.header.utilities': { kind: 'list', scope: 'session' },
      },
    } as never, () => null)
    const fiber = ctx.plugin({ inject: [...inject], apply })
    await fiber.await()

    expect(slots.entries('conversation.input.dock')[0]?.component).toBe(StageBlankStatus)
    expect(slots.entries('conversation.session.header.utilities')[0]?.component).toBe(StageHeaderStatus)
    await fiber.dispose()
    expect(slots.entries('conversation.input.dock')).toHaveLength(0)
    expect(slots.entries('conversation.session.header.utilities')).toHaveLength(0)
  })
})
