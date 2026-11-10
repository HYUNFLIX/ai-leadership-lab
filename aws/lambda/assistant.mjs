// AI 비서 Lambda — Cognito JWT 뒤에서만 호출된다.
//   POST /assistant       질문·확인 응답·다시 시도를 접수하고 자기 자신을 비동기로 호출한다
//   GET  /assistant/{id}  대화 상태와 화면용 요약을 돌려준다
//   { worker: true }      비동기 호출: 모델 루프를 실제로 돌린다
import Anthropic from '@anthropic-ai/sdk';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createApp } from './assistant-app.mjs';
import { store, data } from './assistant-store.mjs';
import { TOOLS } from './assistant-tools.mjs';
import { buildSystemPrompt, kstToday } from './assistant-loop.mjs';

const MODEL_ID = process.env.MODEL_ID || 'claude-opus-5-5';
const KEY_PARAM = process.env.ANTHROPIC_KEY_PARAM || '/ailab/anthropic-api-key';

const ssm = new SSMClient({});
const lambda = new LambdaClient({});
let anthropic = null;

async function getAnthropic() {
  if (anthropic) return anthropic;
  const out = await ssm.send(new GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true }));
  // 작업 Lambda의 제한(120초) 안에 끝나도록 요청 제한을 100초로 둔다
  anthropic = new Anthropic({ apiKey: out.Parameter.Value, timeout: 100_000, maxRetries: 1 });
  return anthropic;
}

async function makeModel() {
  const client = await getAnthropic();
  const system = buildSystemPrompt(kstToday());
  return {
    create: (messages) => client.beta.messages.create({
      model: MODEL_ID,
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      // 안전 정책으로 거절되면 Anthropic이 권장하는 모델로 같은 요청을 다시 처리한다
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // 도구 루프의 단계 사이에 대화 앞부분을 캐시한다
      cache_control: { type: 'ephemeral' },
      system,
      tools: TOOLS,
      messages,
    }),
  };
}

async function invokeWorker(conversationId) {
  await lambda.send(new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify({ worker: true, conversationId })),
  }));
}

function explainError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'AI 서비스 인증에 실패했습니다. API 키 설정을 확인해 주세요.';
  if (err instanceof Anthropic.RateLimitError) return '요청이 몰려 있습니다. 잠시 후 다시 시도해 주세요.';
  if (err instanceof Anthropic.APIConnectionError) return 'AI 서비스에 연결하지 못했습니다. 다시 시도해 주세요.';
  if (err instanceof Anthropic.APIError) {
    return err.status >= 500
      ? 'AI 서비스가 일시적으로 불안정합니다. 다시 시도해 주세요.'
      : 'AI 요청이 거부됐습니다. 새 대화로 다시 시도해 주세요.';
  }
  return '처리 중 오류가 발생했습니다. 다시 시도해 주세요.';
}

const app = createApp({
  store, data, makeModel, invokeWorker, explainError,
  log: (entry) => console.log(JSON.stringify(entry)),
});

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event && event.worker === true) {
    await app.work(String(event.conversationId));
    return { ok: true };
  }
  try {
    const method = event.requestContext?.http?.method;
    if (method === 'GET') {
      const out = await app.view(event.pathParameters?.id);
      return json(out.statusCode, out.body);
    }
    if (method === 'POST') {
      let body;
      try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }
      const out = await app.accept(body);
      return json(out.statusCode, out.body);
    }
    return json(405, { error: 'method not allowed' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'internal error' });
  }
};
