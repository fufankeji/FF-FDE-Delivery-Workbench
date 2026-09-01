import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { ProjectResourceComposerAction, ProjectResourceUploadAction } from '../src/client/ProjectResourceUploadAction.tsx'

describe('ui-fde-sources apply', () => {
  it('registers the project-row action and the lightweight native-composer action', async () => {
    const ctx = new Context()
    await ctx.plugin(SlotRegistry).await()
    const locale = new LocaleRuntime(ctx)
    locale.setLocale('zh')
    ctx.provide('locale', locale)
    const slots = ctx.get('slots') as SlotRegistry
    slots.register({
      name: 'root',
      children: {
        'sidebar.workspaces.projectActions': { kind: 'list', scope: 'root' },
        'conversation.input.left': { kind: 'list', scope: 'session' },
      },
    } as never, () => null)
    await ctx.plugin({ inject: [...inject], apply }).await()
    const entry = slots.entries('sidebar.workspaces.projectActions')[0]
    expect(entry?.component).toBe(ProjectResourceUploadAction)
    expect(entry?.locale).toBe('fdeSources')
    expect(slots.entries('conversation.input.left')[0]?.component).toBe(ProjectResourceComposerAction)
    expect(locale.bind('fdeSources')('action')).toBe('添加项目资料')
    expect(locale.bind('fdeSources')('composerAction')).toBe('有客户资料？上传')
  })
})
