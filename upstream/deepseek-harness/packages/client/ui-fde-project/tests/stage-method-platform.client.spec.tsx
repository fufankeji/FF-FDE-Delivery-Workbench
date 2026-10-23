// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StageMethodDialog } from '../src/client/StageMethodDialog.tsx'

afterEach(cleanup)

it('reads a platform method without displaying upstream attribution or license controls', () => {
  const method = {
    id: 'fde-orient', label: '项目启动与方向确认', description: '确认任务与责任。', whenToUse: '项目开始时。',
    source: 'platform', content: '# 项目定向\n\n读取已有事实，提出下一步。[定向提纲](assets/orientation.md)',
    entryPath: 'fde-orient/SKILL.md', role: 'engineering' as const,
    files: [{ path: 'fde-orient/assets/orientation.md', content: '# 项目定向记录\n\n确认真实任务。', sha256: 'fixture' }],
  }
  render(<StageMethodDialog method={method} methods={[method]} stageIndex={0} onClose={vi.fn()} onSelectMethod={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '完整定义' }))
  expect(screen.getByRole('heading', { name: '项目定向' })).toBeTruthy()
  expect(screen.queryByText('技术信息')).toBeNull()
  expect(screen.queryByText('来源仓库')).toBeNull()
  expect(screen.queryByText('许可证')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '定向提纲' }))
  expect(screen.getByRole('heading', { name: '项目定向记录' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '项目启动与方向确认' }))
  expect(screen.getByRole('heading', { name: '项目定向' })).toBeTruthy()
})
