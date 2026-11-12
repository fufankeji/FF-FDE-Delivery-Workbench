// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { QUESTIONS } from '@deepseek-ai/dsh-fde-scenario-challenge/src/questions.ts'
import { resultOf } from '@deepseek-ai/dsh-fde-scenario-challenge/src/store.ts'
import type { Attempt, AttemptId, ChallengeView } from '@deepseek-ai/dsh-fde-scenario-challenge/types'
import { ChallengePage } from '../src/client/ChallengePage.tsx'
import { zh } from '../src/client/locales.ts'
import type { CommandOutcome } from '../src/client/resource.ts'

const t = makeTranslate(zh)
const attemptId = 'a520b942-e55d-459c-83dd-d38cae2c529d' as AttemptId
const startedAt = 1_800_000_000_000
function activeView(): ChallengeView {
  return { revision: 1, serverNow: startedAt, history: [], active: {
    id: attemptId, version: 'fde-scenarios-zh-v1', startedAt, deadlineAt: startedAt + 300_000, revision: 0,
    answers: Array.from({ length: 10 }, () => null),
    questions: QUESTIONS.map(({ id, domain, domainLabel, prompt, options }) => ({ id, domain, domainLabel, prompt, options })),
  } }
}
function completed(): ChallengeView {
  const attempt: Attempt = { id: attemptId, version: 'fde-scenarios-zh-v1', startedAt, deadlineAt: startedAt + 300_000,
    questions: QUESTIONS, answers: [1, ...Array.from({ length: 9 }, () => null)], revision: 1, endedAt: startedAt + 40_000, reason: 'manual' }
  return { revision: 3, serverNow: startedAt + 40_000, active: null, history: [resultOf(attempt)] }
}
function props(value: ChallengeView) {
  return { active: true, openDiscovery: vi.fn(), refresh: vi.fn(), mutate: vi.fn(async (): Promise<CommandOutcome> => ({ ok: true, attemptId, revision: 2 })), t,
    useResource: vi.fn(() => ({ status: 'live', value, failure: undefined })),
  } as ComponentProps<typeof ChallengePage>
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

it('introduces the Chinese rules and does not start on mount', () => {
  const input = props({ revision: 0, serverNow: startedAt, active: null, history: [] })
  render(<ChallengePage {...input} />)
  expect(screen.getByText(zh.clockRule)).toBeTruthy()
  expect(screen.getByText(zh.privacy)).toBeTruthy()
  expect(screen.getByRole('button', { name: '开始 5 分钟挑战' })).toBeTruthy()
  expect(input.mutate).not.toHaveBeenCalled()
  expect(screen.getByText('还没有已完成的挑战')).toBeTruthy()
})

it('resumes answers, navigates, confirms unanswered questions and only reviews a completed result', async () => {
  const input = props(activeView())
  const view = render(<ChallengePage {...input} />)
  fireEvent.click(screen.getByRole('button', { name: '继续挑战' }))
  expect(screen.getByText('5:00')).toBeTruthy()
  expect(screen.queryByText('正确选项')).toBeNull()
  expect(screen.queryByText(QUESTIONS[0]!.explanations[1]!)).toBeNull()
  fireEvent.click(screen.getAllByRole('radio')[1]!)
  await waitFor(() => expect(input.mutate).toHaveBeenCalledWith({ kind: 'answer', attemptId, revision: 0, questionId: 'value-01', choice: 1 }))
  const saved = activeView()
  input.useResource = vi.fn(() => ({ status: 'live', value: { ...saved, revision: 2, active: { ...saved.active!, revision: 1, answers: [1, ...Array.from({ length: 9 }, () => null)] } }, failure: undefined })) as typeof input.useResource
  view.rerender(<ChallengePage {...input} />)
  expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '下一题' }))
  expect(screen.getByText(QUESTIONS[1]!.prompt)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '上一题' }))
  fireEvent.click(screen.getByRole('button', { name: '交卷' }))
  expect(screen.getByRole('dialog', { name: '确认结束本轮挑战？' })).toBeTruthy()
  expect(screen.getByText(/还有 9 道题未作答/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '确认交卷' }))
  await waitFor(() => expect(input.mutate).toHaveBeenCalledWith({ kind: 'submit', attemptId, revision: 1 }))
  input.useResource = vi.fn(() => ({ status: 'live', value: completed(), failure: undefined })) as typeof input.useResource
  view.rerender(<ChallengePage {...input} />)
  expect(screen.getByText('答对 1 / 10 题')).toBeTruthy()
  expect(screen.getByText(zh.boundary)).toBeTruthy()
  expect(screen.getByText(zh.repeat)).toBeTruthy()
  expect(screen.getAllByText('0 / 2 题')).toHaveLength(4)
  fireEvent.click(screen.getAllByText('选项说明')[0]!)
  expect(screen.getByText(QUESTIONS[0]!.explanations[1]!)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '进入业务挖掘实验室' }))
  expect(input.openDiscovery).toHaveBeenCalledOnce()
})

it('keeps the confirmed selection on write failure and offers a Chinese recovery action', async () => {
  const input = props(activeView())
  input.mutate = vi.fn(async (): Promise<CommandOutcome> => ({ ok: false, code: 'storage' }))
  render(<ChallengePage {...input} />)
  fireEvent.click(screen.getByRole('button', { name: '继续挑战' }))
  fireEvent.click(screen.getAllByRole('radio')[0]!)
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(zh.error_storage))
  expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked)).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '重新读取记录' }))
  expect(input.refresh).toHaveBeenCalled()
})

it('requests settlement at the server deadline without accepting another answer', async () => {
  vi.useFakeTimers()
  const value = activeView()
  const input = props({ ...value, serverNow: value.active!.deadlineAt - 1000 })
  render(<ChallengePage {...input} />)
  fireEvent.click(screen.getByRole('button', { name: '继续挑战' }))
  expect(screen.getByText('0:01')).toBeTruthy()
  await act(async () => { vi.advanceTimersByTime(1200) })
  expect(screen.getByText('0:00')).toBeTruthy()
  expect(screen.getAllByRole('radio').every(radio => radio.matches(':disabled'))).toBe(true)
  expect(input.refresh).toHaveBeenCalledTimes(2)
  expect(input.mutate).not.toHaveBeenCalled()
})

it('opens an immutable history result without starting or modifying an attempt', () => {
  const input = props(completed())
  render(<ChallengePage {...input} />)
  fireEvent.click(screen.getByRole('button', { name: '查看解析' }))
  expect(screen.getByText('本次场景判断表现')).toBeTruthy()
  expect(input.mutate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '返回挑战介绍' }))
  expect(screen.getByRole('button', { name: '开始 5 分钟挑战' })).toBeTruthy()
})
