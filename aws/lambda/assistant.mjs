// AI 비서 — 강의·고객 데이터를 컨텍스트로 Claude API 호출 (Cognito JWT 뒤에서만 동작)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ssm = new SSMClient({});
const LECTURES = process.env.LECTURES_TABLE;
const CLIENTS = process.env.CLIENTS_TABLE;
const MODEL_ID = process.env.MODEL_ID || 'claude-sonnet-5';
const KEY_PARAM = process.env.ANTHROPIC_KEY_PARAM || '/ailab/anthropic-api-key';

let cachedKey = null;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

async function getApiKey() {
  if (cachedKey) return cachedKey;
  const out = await ssm.send(new GetParameterCommand({ Name: KEY_PARAM, WithDecryption: true }));
  cachedKey = out.Parameter.Value;
  return cachedKey;
}

async function scanAll(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const out = await ddb.send(new ScanCommand({ TableName, ExclusiveStartKey }));
    items.push(...(out.Items ?? []));
    ExclusiveStartKey = out.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

function buildSystemPrompt(lectures, clients) {
  const today = new Date().toISOString().slice(0, 10);
  return `당신은 AI 리더십연구소 김현 소장의 개인 업무 비서입니다.
소장의 강의 이력과 고객사 데이터를 바탕으로 정확하게 답합니다.

규칙:
- 데이터에 근거해 답하고, 데이터에 없는 내용은 추측하지 말고 없다고 말할 것
- 금액 계산·집계는 신중하게, 단위(원)를 명시할 것
- 제안서·이메일 초안 요청 시 소장의 전문 분야(AI 리더십·AI 리터러시·바이브코딩 강의)를 반영할 것
- 간결하고 실용적으로 답할 것. 오늘 날짜: ${today}

paymentStatus 값: paid(지급완료), pending(지급대기)

## 강의 이력 데이터 (${lectures.length}건)
${JSON.stringify(lectures)}

## 고객사 데이터 (${clients.length}건)
${JSON.stringify(clients)}`;
}

export const handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'invalid JSON' }); }

  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages || !messages.length) return json(400, { error: 'messages required' });
  // 히스토리 상한 (토큰 비용 보호)
  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 8000),
  }));

  let apiKey;
  try { apiKey = await getApiKey(); }
  catch { return json(503, { error: 'API 키가 설정되지 않았습니다. SSM 파라미터(/ailab/anthropic-api-key)를 등록하세요.' }); }

  try {
    const [lectures, clients] = await Promise.all([scanAll(LECTURES), scanAll(CLIENTS)]);

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: 3000,
        // 조회·요약 용도 — thinking 비활성화로 응답 속도·비용 최적화
        thinking: { type: 'disabled' },
        // 대용량 데이터 컨텍스트는 캐싱 (반복 질문 시 입력 비용 ~90% 절감)
        system: [{
          type: 'text',
          text: buildSystemPrompt(lectures, clients),
          cache_control: { type: 'ephemeral' },
        }],
        messages: trimmed,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('Anthropic error:', JSON.stringify(data).slice(0, 500));
      return json(502, { error: 'AI 응답 실패: ' + (data.error?.message || res.status) });
    }

    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    return json(200, { reply: text, usage: data.usage });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'internal error' });
  }
};
