// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MarkdownText } from './markdown-test-components.tsx'

afterEach(cleanup)

it('opens known inline and reference-style file links with the original authored labels', () => {
  const open = vi.fn()
  const fileLinks = { resolve: (path: string) => path === 'references/method.md' ? { open, title: path } : undefined }
  const { container } = render(<MarkdownText text={'[Read **method**](references/method.md) and [template][file].\n\n[file]: references/method.md'} fileLinks={fileLinks} />)
  fireEvent.click(screen.getByRole('button', { name: 'Read method' }))
  fireEvent.click(screen.getByRole('button', { name: 'template' }))
  expect(open).toHaveBeenCalledTimes(2)
  expect(container.querySelector('button strong')?.textContent).toBe('method')
  expect(container.querySelector('a')).toBeNull()
})

it('keeps unknown paths inert and leaves remote links and unsafe destinations outside the file vocabulary', () => {
  const resolve = vi.fn(() => undefined)
  const text = '[missing](absent.md) [remote](https://example.com/method) [unsafe](javascript:alert) [disk](file:///private/file) [absolute](/private/file)'
  const { container } = render(<MarkdownText text={text} fileLinks={{ resolve }} />)
  expect(resolve.mock.calls).toEqual([['absent.md']])
  expect(container.querySelectorAll('button')).toHaveLength(0)
  expect(container.querySelectorAll('a')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'remote' }).getAttribute('rel')).toContain('noopener')
})

it('keeps file links inert without opt-in or while streaming, and resolves them when settled', () => {
  const resolve = vi.fn(() => ({ open: vi.fn(), title: 'file.md' }))
  const text = '[original label](file.md)'
  const view = render(<MarkdownText text={text} />)
  expect(screen.queryByRole('button')).toBeNull()
  view.rerender(<MarkdownText text={text} streaming fileLinks={{ resolve }} />)
  expect(resolve).not.toHaveBeenCalled()
  expect(screen.queryByRole('button')).toBeNull()
  view.rerender(<MarkdownText text={text} fileLinks={{ resolve }} />)
  expect(screen.getByRole('button', { name: 'original label' })).toBeTruthy()
})
