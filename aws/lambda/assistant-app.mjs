// AI 비서 요청 처리 — 접수(accept), 조회(view), 작업(work). 의존성은 인자로 받는다(단위 테스트 대상).
import { randomUUID } from 'node:crypto';
import {
  newConversation, startTurn, queueDecisions, queueRetry, runLoop, snapshot, MAX_CONVERSATION_BYTES,
} from './assistant-loop.mjs';

export const STALE_MS = 150_000;
const MAX_QUESTION_LENGTH = 8000;
const reply = (statusCode, body) => ({ statusCode, body });

export function createApp({
  store, data, makeModel, invokeWorker,
  explainError = () => '처리 중 오류가 발생했습니다. 다시 시도해 주세요.',
  now = () => Date.now(),
  log = () => {},
}) {
  const isStale = (conv) => conv.status === 'running' && now() - (conv.updatedAt || 0) > STALE_MS;

  async function accept(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: '요청 형식이 올바르지 않습니다.' });
    const kinds = [typeof body.text === 'string', Array.isArray(body.decisions), body.retry === true].filter(Boolean).length;
    if (kinds !== 1) return reply(400, { error: 'text, decisions, retry 중 하나만 보내야 합니다.' });

    let conv;
    if (body.conversationId) {
      conv = await store.get(String(body.conversationId));
      if (!conv) return reply(404, { error: '대화를 찾을 수 없습니다. 새 대화를 시작해 주세요.' });
    } else {
      if (typeof body.text !== 'string') return reply(400, { error: 'conversationId가 필요합니다.' });
      conv = newConversation(randomUUID());
    }
    if (conv.status === 'running' && !isStale(conv)) return reply(409, { error: '이전 요청을 처리하는 중입니다.' });

    if (typeof body.text === 'string') {
      const text = body.text.trim();
      if (!text) return reply(400, { error: '질문을 입력해 주세요.' });
      if (text.length > MAX_QUESTION_LENGTH) return reply(400, { error: '질문이 너무 깁니다(8,000자 이하).' });
      if (JSON.stringify(conv.messages).length > MAX_CONVERSATION_BYTES) return reply(413, { error: '대화가 너무 길어졌습니다. 새 대화를 시작해 주세요.' });
      startTurn(conv, text);
    } else if (Array.isArray(body.decisions)) {
      if (conv.status !== 'needs_confirmation' || !conv.pending) return reply(409, { error: '확인을 기다리는 변경이 없습니다.' });
      queueDecisions(conv, body.decisions);
    } else {
      if (conv.status !== 'error' && !isStale(conv)) return reply(409, { error: '다시 시도할 수 있는 상태가 아닙니다.' });
      queueRetry(conv);
    }

    conv.updatedAt = now();
    await store.put(conv);
    await invokeWorker(conv.id);
    return reply(202, { conversationId: conv.id });
  }

  async function view(id) {
    const conv = id ? await store.get(String(id)) : null;
    if (!conv) return reply(404, { error: '대화를 찾을 수 없습니다.' });
    const snap = snapshot(conv);
    if (isStale(conv)) {
      snap.status = 'error';
      snap.error = '응답이 너무 오래 걸려 중단됐습니다. 다시 시도해 주세요.';
    }
    return reply(200, snap);
  }

  async function work(id) {
    const conv = await store.get(String(id));
    if (!conv || conv.status !== 'running') return;
    const save = async (c) => {
      c.updatedAt = now();
      await store.put(c);
    };
    try {
      await runLoop(conv, { model: await makeModel(), data, save, log });
    } catch (err) {
      log({ conversationId: conv.id, error: String((err && err.stack) || err) });
      conv.status = 'error';
      conv.error = explainError(err);
      await save(conv);
    }
  }

  return { accept, view, work };
}
