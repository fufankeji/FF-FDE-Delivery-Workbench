// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { followFrameTheme } from '../src/client/frame-theme.ts'

afterEach(() => {
  document.body.replaceChildren()
  document.body.removeAttribute('style')
  document.body.removeAttribute('data-ds-dark-theme')
})

it('follows only display tokens and dark mode without navigating the training frame', async () => {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const target = frame.contentDocument!
  target.body.textContent = 'Existing training'
  document.body.style.setProperty('--dsw-alias-label-primary', '#123456')
  document.body.style.setProperty('--private-config', 'must-not-copy')
  const stop = followFrameTheme(frame)
  try {
    expect(target.documentElement.style.getPropertyValue('--dsw-alias-label-primary')).toBe('#123456')
    expect(target.documentElement.style.getPropertyValue('--private-config')).toBe('')
    document.body.style.setProperty('--dsw-alias-label-primary', '#abcdef')
    document.body.setAttribute('data-ds-dark-theme', '')
    await vi.waitFor(() => { expect(target.documentElement.style.getPropertyValue('--dsw-alias-label-primary')).toBe('#abcdef') })
    expect(target.body.hasAttribute('data-ds-dark-theme')).toBe(true)
    expect(target.documentElement.style.colorScheme).toBe('dark')
    expect(frame.contentDocument).toBe(target)
    expect(target.body.textContent).toBe('Existing training')
    expect(frame.getAttribute('src')).toBeNull()
    document.body.style.removeProperty('--dsw-alias-label-primary')
    document.body.removeAttribute('data-ds-dark-theme')
    await vi.waitFor(() => { expect(target.documentElement.style.getPropertyValue('--dsw-alias-label-primary')).toBe('') })
    expect(target.documentElement.style.colorScheme).toBe('light')
  } finally { stop() }
})

it('stops observation and load synchronization when the frame is disposed', async () => {
  const frame = document.createElement('iframe')
  document.body.append(frame)
  const stop = followFrameTheme(frame)
  const target = frame.contentDocument!
  stop()
  document.body.setAttribute('data-ds-dark-theme', '')
  await Promise.resolve()
  frame.dispatchEvent(new Event('load'))
  expect(target.body.hasAttribute('data-ds-dark-theme')).toBe(false)
})
