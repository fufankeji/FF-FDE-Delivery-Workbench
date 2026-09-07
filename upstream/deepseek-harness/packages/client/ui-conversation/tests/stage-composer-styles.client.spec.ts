// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

const css = readFileSync('packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css', 'utf8')
const hideRules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{\s*display:\s*none;\s*\}/g)]
  .filter(match => match[1]!.includes('data-hide-stage-composer'))
  .map(match => match[0].replace(/:global\(([^)]+)\)/g, '$1')).join('\n')

afterEach(() => { document.body.replaceChildren() })

describe('read-only stage composer styles', () => {
  it.each([false, true])('hides only input in a blank session and preserves the workbench (readonly: %s)', readonly => {
    document.body.innerHTML = `<style>${hideRules}</style><div class="composerHero">
      <div data-slot="conversation.hero.content"><section id="stage" ${readonly ? 'data-hide-stage-composer="true"' : ''}>阶段记录</section></div>
      <div data-slot="conversation.input.dock"><div id="dock">排队任务</div></div>
      <div data-slot="conversation.composer.bar"><div id="bar"><textarea>尚未发送的草稿</textarea></div></div>
    </div>`
    const draft = document.querySelector('textarea')!
    const stage = document.getElementById('stage')!
    expect(getComputedStyle(stage).display).not.toBe('none')
    for (const id of ['dock', 'bar']) expect(getComputedStyle(document.getElementById(id)!).display).toBe(readonly ? 'none' : 'block')
    stage.removeAttribute('data-hide-stage-composer')
    expect(getComputedStyle(document.getElementById('bar')!).display).toBe('block')
    expect(document.querySelector('textarea')).toBe(draft)
    expect(draft.value).toBe('尚未发送的草稿')
  })

  it.each([false, true])('hides the overlay seat only for a read-only active view (readonly: %s)', readonly => {
    document.body.innerHTML = `<style>${hideRules}</style><div class="scrollBody">
      <section id="stage" data-conversation-composer-overlay ${readonly ? 'data-hide-stage-composer="true"' : ''}>阶段记录</section>
      <div class="composerSeat"><textarea>继续工作</textarea></div>
    </div>`
    expect(getComputedStyle(document.getElementById('stage')!).display).not.toBe('none')
    expect(getComputedStyle(document.querySelector('.composerSeat')!).display).toBe(readonly ? 'none' : 'block')
  })
})
