import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_STEPS, newConversation, startTurn, queueDecisions, runLoop, snapshot, buildSystemPrompt, kstToday,
} from '../assistant-loop.mjs';
import { fakeData, fakeModel, text, use, res, LECTURES, CLIENTS } from './helpers.mjs';

const NEW_LECTURE = { date: '2026-11-20', name: '팀장 과정', client: '가나전자', fee: 2000000, taxDeduction: '3.3' };
const lastMessage = (conv) => conv.messages[conv.messages.length - 1];

function setup(responses, question = '질문') {
  const conv = newConversation('conv-1');
  const data = fakeData(LECTURES, CLIENTS);
  const model = fakeModel(responses);
  startTurn(conv, question);
  return { conv, data, model };
}

test('조회만 하는 질문: 도구 결과를 넘기고 답으로 끝난다', async () => {
  const { conv, data, model } = setup([
    res([use('t1', 'aggregate_lectures', { group_by: 'none' })], 'tool_use'),
    res([text('총 4건입니다.')]),
  ]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'idle');
  assert.deepEqual(conv.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant']);
  const result = conv.messages[2].content[0];
  assert.equal(result.type, 'tool_result');
  assert.equal(result.tool_use_id, 't1');
  assert.equal(JSON.parse(result.content).total.count, 4);
  assert.deepEqual(conv.events, ['강의 집계 중']);
  assert.deepEqual(snapshot(conv).view, [
    { role: 'user', text: '질문' },
    { role: 'assistant', text: '총 4건입니다.' },
  ]);
  assert.equal(model.calls.length, 2);
});

test('변경 요청: 승인 전에는 저장하지 않고 확인 대기로 멈춘다', async () => {
  const { conv, data, model } = setup([
    res([text('등록하겠습니다.'), use('w1', 'create_lecture', NEW_LECTURE)], 'tool_use'),
    res([text('등록했습니다.')]),
  ]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'needs_confirmation');
  assert.equal(data.lectures.length, 4);
  assert.equal(lastMessage(conv).role, 'assistant');
  const snap = snapshot(conv);
  assert.equal(snap.pending.length, 1);
  assert.equal(snap.pending[0].toolUseId, 'w1');
  assert.equal(snap.pending[0].title, '강의 등록 · 2026-11-20 가나전자');
  assert.ok(snap.pending[0].rows.length > 0);

  queueDecisions(conv, [{ toolUseId: 'w1', approved: true }]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'idle');
  assert.equal(data.lectures.length, 5);
  assert.equal(data.lectures.at(-1).netPayment, 1934000);
  assert.deepEqual(snapshot(conv).view, [
    { role: 'user', text: '질문' },
    { role: 'assistant', text: '등록하겠습니다.' },
    { role: 'action', toolUseId: 'w1', title: '강의 등록 · 2026-11-20 가나전자', table: 'lectures', outcome: 'done' },
    { role: 'assistant', text: '등록했습니다.' },
  ]);
  assert.deepEqual(snapshot(conv).pending, []);
});

test('변경 거절: 저장하지 않고 취소 결과를 모델에 알린다', async () => {
  const { conv, data, model } = setup([
    res([use('w1', 'create_lecture', NEW_LECTURE)], 'tool_use'),
    res([text('취소했습니다.')]),
  ]);
  await runLoop(conv, { model, data });
  queueDecisions(conv, [{ toolUseId: 'w1', approved: false }]);
  await runLoop(conv, { model, data });

  assert.equal(data.lectures.length, 4);
  assert.equal(JSON.parse(conv.messages[2].content[0].content).declined, true);
  assert.equal(snapshot(conv).view.find((v) => v.role === 'action').outcome, 'declined');
});

test('조회와 변경이 한 턴에 섞이면 결과를 하나의 user 메시지로 묶는다', async () => {
  const { conv, data, model } = setup([
    res([use('r1', 'search_lectures', { client: '가나' }), use('w1', 'update_lecture', { id: 'c', paymentStatus: 'paid' })], 'tool_use'),
    res([text('입금 완료로 바꿨습니다.')]),
  ]);
  await runLoop(conv, { model, data });
  assert.equal(conv.status, 'needs_confirmation');
  assert.equal(conv.messages.length, 2);

  queueDecisions(conv, [{ toolUseId: 'w1', approved: true }]);
  await runLoop(conv, { model, data });

  const results = conv.messages[2].content;
  assert.deepEqual(results.map((b) => b.tool_use_id).sort(), ['r1', 'w1']);
  assert.equal(conv.messages[2].role, 'user');
  assert.equal(data.lectures.find((l) => l.id === 'c').paymentStatus, 'paid');
  assert.equal(conv.status, 'idle');
});

test('확인 대기 중 새 질문이 오면 대기 중인 변경을 모두 취소로 처리한다', async () => {
  const { conv, data, model } = setup([
    res([use('w1', 'create_lecture', NEW_LECTURE)], 'tool_use'),
    res([text('알겠습니다.')]),
  ]);
  await runLoop(conv, { model, data });
  startTurn(conv, '아니야, 다른 질문');

  assert.equal(conv.pending, null);
  assert.equal(JSON.parse(conv.messages[2].content[0].content).declined, true);
  assert.deepEqual(lastMessage(conv), { role: 'user', content: [{ type: 'text', text: '아니야, 다른 질문' }] });

  await runLoop(conv, { model, data });
  assert.equal(conv.status, 'idle');
  assert.equal(data.lectures.length, 4);
});

test('결정에 빠진 변경은 취소로 본다', async () => {
  const { conv, data, model } = setup([
    res([use('w1', 'create_lecture', NEW_LECTURE), use('w2', 'update_lecture', { id: 'c', paymentStatus: 'paid' })], 'tool_use'),
    res([text('처리했습니다.')]),
  ]);
  await runLoop(conv, { model, data });
  queueDecisions(conv, [{ toolUseId: 'w2', approved: true }]);
  await runLoop(conv, { model, data });

  assert.equal(data.lectures.length, 4);
  assert.equal(data.lectures.find((l) => l.id === 'c').paymentStatus, 'paid');
  const outcomes = snapshot(conv).view.filter((v) => v.role === 'action').map((v) => [v.toolUseId, v.outcome]);
  assert.deepEqual(outcomes.sort(), [['w1', 'declined'], ['w2', 'done']]);
});

test('잘못된 변경 입력은 확인 카드 없이 오류 결과로 돌려주고 계속한다', async () => {
  const { conv, data, model } = setup([
    res([use('w1', 'create_lecture', { date: '2026-11-20', name: '팀장 과정' })], 'tool_use'),
    res([text('고객사를 알려주세요.')]),
  ]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'idle');
  assert.equal(conv.messages[2].content[0].is_error, true);
  assert.match(conv.messages[2].content[0].content, /client/);
  assert.equal(snapshot(conv).view.some((v) => v.role === 'action'), false);
});

test('조회 도구 오류는 is_error 결과로 모델에 돌려준다', async () => {
  const { conv, data, model } = setup([
    res([use('t1', 'search_lectures', { date_from: '어제' })], 'tool_use'),
    res([text('날짜를 다시 확인했습니다.')]),
  ]);
  await runLoop(conv, { model, data });

  assert.equal(conv.messages[2].content[0].is_error, true);
  assert.equal(conv.status, 'idle');
});

test('한 질문에 모델 호출은 MAX_STEPS회까지만', async () => {
  const responses = Array.from({ length: MAX_STEPS + 3 }, (_, i) => res([use('t' + i, 'aggregate_lectures', {})], 'tool_use'));
  const { conv, data, model } = setup(responses);
  await runLoop(conv, { model, data });

  assert.equal(model.calls.length, MAX_STEPS);
  assert.equal(conv.status, 'idle');
  assert.equal(lastMessage(conv).role, 'user');
  assert.match(snapshot(conv).view.at(-1).text, /단계/);
  assert.equal(snapshot(conv).view.at(-1).role, 'notice');
});

test('거절 응답은 오류 상태로 끝내고 대화에는 추가하지 않는다', async () => {
  const { conv, data, model } = setup([res([], 'refusal')]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'error');
  assert.ok(conv.error);
  assert.equal(conv.messages.length, 1);
});

test('길이 제한으로 잘린 답은 안내를 붙인다', async () => {
  const { conv, data, model } = setup([res([text('긴 초안의 앞부분')], 'max_tokens')]);
  await runLoop(conv, { model, data });

  assert.equal(conv.status, 'idle');
  assert.deepEqual(snapshot(conv).view.map((v) => v.role), ['user', 'assistant', 'notice']);
});

test('단계마다 저장한다', async () => {
  const { conv, data, model } = setup([
    res([use('t1', 'aggregate_lectures', {})], 'tool_use'),
    res([text('끝')]),
  ]);
  const saved = [];
  await runLoop(conv, { model, data, save: async (c) => saved.push([c.status, c.messages.length]) });
  assert.deepEqual(saved, [['running', 3], ['idle', 4]]);
});

test('시스템 프롬프트에는 오늘 날짜가 들어가고 데이터는 들어가지 않는다', () => {
  const prompt = buildSystemPrompt('2026-11-10');
  assert.match(prompt, /2026-11-10/);
  assert.match(prompt, /aggregate_lectures/);
  assert.equal(prompt.includes('가나전자'), false);
});

test('kstToday는 한국시간 기준 날짜를 돌려준다', () => {
  assert.equal(kstToday(new Date('2026-11-09T15:30:00Z')), '2026-11-10');
  assert.equal(kstToday(new Date('2026-11-09T14:59:00Z')), '2026-11-09');
});
