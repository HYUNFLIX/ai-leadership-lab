import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, STALE_MS } from '../assistant-app.mjs';
import { fakeData, fakeModel, text, use, res, LECTURES, CLIENTS } from './helpers.mjs';

function setup(responses = []) {
  const saved = new Map();
  const store = {
    get: async (id) => (saved.has(id) ? JSON.parse(saved.get(id)) : null),
    put: async (conv) => { saved.set(conv.id, JSON.stringify(conv)); },
  };
  const data = fakeData(LECTURES, CLIENTS);
  const model = fakeModel(responses);
  const invoked = [];
  const clock = { t: 1_000_000 };
  const app = createApp({
    store, data,
    makeModel: async () => model,
    invokeWorker: async (id) => { invoked.push(id); },
    explainError: (err) => '설명: ' + err.message,
    now: () => clock.t,
    log: () => {},
  });
  return { app, store, data, model, invoked, clock };
}

test('새 질문: 접수하고 작업을 호출한 뒤, 작업이 끝나면 답이 보인다', async () => {
  const { app, store, invoked } = setup([res([text('안녕하세요.')])]);
  const accepted = await app.accept({ text: ' 안녕 ' });
  assert.equal(accepted.statusCode, 202);
  const id = accepted.body.conversationId;
  assert.deepEqual(invoked, [id]);
  assert.equal((await store.get(id)).status, 'running');
  assert.equal((await app.view(id)).body.status, 'running');

  await app.work(id);
  const view = await app.view(id);
  assert.equal(view.statusCode, 200);
  assert.equal(view.body.status, 'idle');
  assert.deepEqual(view.body.view, [{ role: 'user', text: '안녕' }, { role: 'assistant', text: '안녕하세요.' }]);
});

test('요청 형식 오류는 400', async () => {
  const { app } = setup();
  assert.equal((await app.accept(null)).statusCode, 400);
  assert.equal((await app.accept({})).statusCode, 400);
  assert.equal((await app.accept({ text: 'a', retry: true })).statusCode, 400);
  assert.equal((await app.accept({ text: '   ' })).statusCode, 400);
  assert.equal((await app.accept({ text: 'x'.repeat(8001) })).statusCode, 400);
  assert.equal((await app.accept({ decisions: [] })).statusCode, 400);
  assert.equal((await app.accept({ retry: true })).statusCode, 400);
});

test('없는 대화는 404', async () => {
  const { app } = setup();
  assert.equal((await app.accept({ conversationId: 'nope', text: 'a' })).statusCode, 404);
  assert.equal((await app.view('nope')).statusCode, 404);
  assert.equal((await app.view(undefined)).statusCode, 404);
});

test('처리 중인 대화에 다시 보내면 409', async () => {
  const { app } = setup();
  const { body } = await app.accept({ text: '첫 질문' });
  assert.equal((await app.accept({ conversationId: body.conversationId, text: '또 질문' })).statusCode, 409);
});

test('확인 대기가 아닌데 decisions를 보내면 409', async () => {
  const { app } = setup([res([text('답')])]);
  const { body } = await app.accept({ text: '질문' });
  await app.work(body.conversationId);
  assert.equal((await app.accept({ conversationId: body.conversationId, decisions: [] })).statusCode, 409);
});

test('확인 흐름: 승인하면 저장되고 대화가 이어진다', async () => {
  const { app, data } = setup([
    res([use('w1', 'update_lecture', { id: 'c', paymentStatus: 'paid' })], 'tool_use'),
    res([text('입금 완료로 바꿨습니다.')]),
  ]);
  const { body } = await app.accept({ text: '11월 3일 강의 입금 완료 처리' });
  const id = body.conversationId;
  await app.work(id);
  const waiting = (await app.view(id)).body;
  assert.equal(waiting.status, 'needs_confirmation');
  assert.equal(waiting.pending[0].toolUseId, 'w1');

  assert.equal((await app.accept({ conversationId: id, decisions: [{ toolUseId: 'w1', approved: true }] })).statusCode, 202);
  await app.work(id);
  assert.equal(data.lectures.find((l) => l.id === 'c').paymentStatus, 'paid');
  assert.equal((await app.view(id)).body.status, 'idle');
});

test('모델 오류: 오류 상태가 되고 retry로 이어서 처리한다', async () => {
  const { app } = setup([new Error('boom'), res([text('다시 답합니다.')])]);
  const { body } = await app.accept({ text: '질문' });
  const id = body.conversationId;
  await app.work(id);
  const failed = (await app.view(id)).body;
  assert.equal(failed.status, 'error');
  assert.equal(failed.error, '설명: boom');

  assert.equal((await app.accept({ conversationId: id, retry: true })).statusCode, 202);
  await app.work(id);
  const view = (await app.view(id)).body;
  assert.equal(view.status, 'idle');
  assert.deepEqual(view.view.map((v) => v.role), ['user', 'assistant']);
});

test('오류 상태가 아니면 retry는 409', async () => {
  const { app } = setup([res([text('답')])]);
  const { body } = await app.accept({ text: '질문' });
  await app.work(body.conversationId);
  assert.equal((await app.accept({ conversationId: body.conversationId, retry: true })).statusCode, 409);
});

test('오래 멈춘 작업은 시간 초과로 보이고 다시 보낼 수 있다', async () => {
  const { app, clock } = setup([res([text('늦은 답')])]);
  const { body } = await app.accept({ text: '질문' });
  const id = body.conversationId;
  clock.t += STALE_MS + 1;
  const stale = (await app.view(id)).body;
  assert.equal(stale.status, 'error');
  assert.match(stale.error, /오래 걸려/);

  assert.equal((await app.accept({ conversationId: id, retry: true })).statusCode, 202);
  await app.work(id);
  assert.equal((await app.view(id)).body.status, 'idle');
});

test('대화가 너무 길면 413', async () => {
  const { app, store } = setup([res([text('답')])]);
  const { body } = await app.accept({ text: '질문' });
  await app.work(body.conversationId);
  const conv = await store.get(body.conversationId);
  conv.messages.push({ role: 'user', content: [{ type: 'text', text: 'x'.repeat(300_001) }] });
  await store.put(conv);
  assert.equal((await app.accept({ conversationId: body.conversationId, text: '또 질문' })).statusCode, 413);
});

test('작업은 running 상태가 아니면 아무것도 하지 않는다', async () => {
  const { app, model } = setup([res([text('답')])]);
  const { body } = await app.accept({ text: '질문' });
  await app.work(body.conversationId);
  await app.work(body.conversationId);
  await app.work('nope');
  assert.equal(model.calls.length, 1);
});
