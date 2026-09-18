import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { NativeSessions } from '../src/vendor/native-sessions.js';

const failure = { kind: 'error', error: { code: 'UNSUPPORTED_REASONING_EFFORT', message: 'model does not support this effort' } };
const start = (seq, turn) => ({ seq, type: 'turn/start', data: { turn } });
const end = (seq, turn, reason) => ({ seq, type: 'turn/end', data: { turn, reason } });
const user = seq => ({ seq, type: 'user/message', data: { id: 'question' } });
const reply = (seq, turn) => ({ seq, type: 'assistant/message', data: { turn, message: { content: [{ type: 'text', text: 'answer' }] } } });

function fixture(events) {
  const native = Object.create(NativeSessions.prototype);
  native.ctx = { sessions: { flush: mock.fn() } };
  native.events = async () => events;
  const agent = { id: 'role', session: {}, whenIdle: mock.fn() };
  return { native, agent };
}

test('retains the current turn preparation failure before user/message is committed', async () => {
  const current = [start(10, 2), end(11, 2, failure)];
  const { native, agent } = fixture([start(0, 1), user(1), reply(2, 1), end(3, 1, { kind: 'completed' }), ...current]);
  assert.deepEqual(await native.settle(agent, 'question', 10), { status: 'failed', messageId: 'question', events: current, reason: failure });
});

for (const { name, events } of [
  { name: 'an unstarted request', events: [] },
  { name: 'an aborted preparation', events: [start(10, 2), end(11, 2, { kind: 'aborted', reason: 'user' })] },
  { name: 'an earlier failure', events: [start(0, 1), end(1, 1, failure)] },
  { name: 'an error in a later unrelated turn', events: [start(10, 2), end(11, 2, { kind: 'aborted', reason: 'user' }), start(12, 3), end(13, 3, failure)] },
]) test(`keeps ${name} out of the request error`, async () => {
  const { native, agent } = fixture(events);
  assert.deepEqual(await native.settle(agent, 'question', 10), { status: 'canceled', messageId: 'question', events: [] });
});

for (const { reason, status } of [
  { reason: { kind: 'completed' }, status: 'completed' },
  { reason: failure, status: 'failed' },
]) test(`keeps consumed-message settlement tied to its own turn (${status})`, async () => {
  const { native, agent } = fixture([start(10, 2), user(11), reply(12, 2), end(13, 2, reason), start(14, 3), end(15, 3, failure)]);
  const result = await native.settle(agent, 'question', 10);
  assert.equal(result.status, status);
  assert.equal(result.text, 'answer');
  assert.deepEqual(result.reason, reason);
});

for (const { result, error } of [
  { result: { status: 'failed', reason: failure }, error: failure.error.message },
  { result: { status: 'canceled' }, error: '模型任务未生成完整内容，请重试。' },
]) test(`preserves helper failure details and disposes the helper (${result.status})`, async () => {
  const { native } = fixture([]);
  native.helperOwners = new Map();
  native.open = mock.fn();
  native.send = () => ({ completion: Promise.resolve(result) });
  native.dispose = mock.fn();
  await assert.rejects(native.generate('prompt', 'question', { owner: 'run' }), { message: error });
  assert.equal(native.dispose.mock.callCount(), 1);
  assert.equal(native.helperOwners.size, 0);
});
