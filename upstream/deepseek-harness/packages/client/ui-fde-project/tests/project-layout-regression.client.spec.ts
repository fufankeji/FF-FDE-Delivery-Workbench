// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, expect, it } from 'vitest'

const detailCss = readFileSync(resolve(import.meta.dirname, '../src/client/project.module.css'), 'utf8')
const stageCss = readFileSync(resolve(import.meta.dirname, '../src/client/StageWorkbench.module.css'), 'utf8')
const dockCss = stageCss.slice(stageCss.indexOf('/* FDE stages dock'))
  .replace(/:global\((.+)\) \{/g, '$1 {')

afterEach(() => { document.body.replaceChildren() })

it('gives project details a scroll owner and reflows the three columns and milestone facts', () => {
  const detail = detailCss.match(/\.projectV2Detail \{([^}]+)\}/)?.[1]
  expect(detail).toContain('overflow: auto')
  expect(detail).toContain('min-height: 0')
  expect(detailCss).toContain('@container fde-project-detail (max-width: 1100px)')
  expect(detailCss).toContain('@container fde-project-detail (max-width: 760px)')
  expect(detailCss).toContain('grid-template-columns: repeat(auto-fit, minmax(130px, 1fr))')
  expect(detailCss.match(/\.projectV2Main \{([^}]+)\}/)?.[1]).not.toContain('overflow: hidden')
})

it.each(['stage-execution', 'stage-definition', 'stage-history'])('reserves a separate composer row for active %s', (layout) => {
  document.body.innerHTML = `<style>[data-composer-seat] { position: absolute; }${dockCss}</style>
    <div data-conversation-content data-content-phase="active"><div data-conversation-scroll>
      <div data-slot="conversation.session"><main><section id="stage" data-conversation-composer-layout="${layout}" data-conversation-composer-overlay>内容</section></main></div>
      <div data-composer-seat><textarea>保留草稿</textarea></div>
    </div></div>`
  expect(getComputedStyle(document.querySelector('[data-composer-seat]')!).position).toBe('static')
  expect(getComputedStyle(document.querySelector('[data-conversation-scroll]')!).overflow).toBe('hidden')
  const stage = getComputedStyle(document.querySelector('#stage')!)
  expect(stage.overflow).toBe('auto')
  expect(stage.getPropertyValue('--dsh-composer-height')).toBe('0px')
  expect(document.querySelector('textarea')?.value).toBe('保留草稿')
})

it.each(['chat', 'stage-history'])('does not replace the existing chat or read-only composer policy (%s)', (layout) => {
  document.body.innerHTML = `<style>[data-composer-seat] { position: sticky; }${dockCss}</style>
    <div data-conversation-content data-content-phase="active"><div data-conversation-scroll>
      <section data-conversation-composer-layout="${layout}" data-conversation-composer-overlay data-hide-stage-composer="true">记录</section>
      <div data-composer-seat></div>
    </div></div>`
  expect(getComputedStyle(document.querySelector('[data-composer-seat]')!).position).toBe('sticky')
})
