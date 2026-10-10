// AI Leadership Lab — 방문자 집계
//   POST /public/track  (공개) 홈페이지 페이지뷰 기록 — 개인 식별 정보 없이 일별 카운터만 올린다
//   GET  /analytics     (관리자) 최근 N일 집계 조회
//
// 테이블 구조: pk = 'YYYY-MM-DD'(한국시간), sk =
//   'total'        → pv(페이지뷰) · uv(그날 처음 온 방문자) · ss(방문 세션)
//   'page#<경로>'   → n(페이지뷰)
//   'ref#<유입처>'  → n(세션)
//   'dev#m|d'      → n(세션, 모바일/PC)
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.ANALYTICS_TABLE;

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch|go-http/i;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify(body),
});

function kstDate(offsetDays = 0) {
  const d = new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

// 저장 키에 들어갈 값은 짧고 안전한 문자만
function clean(s, max) {
  return String(s || '').replace(/[^\p{L}\p{N}._\-/]/gu, '').slice(0, max);
}

function add(pk, sk, counts) {
  const names = {}, values = {}, parts = [];
  Object.entries(counts).forEach(([k, v], i) => {
    if (!v) return;
    names[`#k${i}`] = k;
    values[`:v${i}`] = v;
    parts.push(`#k${i} :v${i}`);
  });
  if (!parts.length) return null;
  return ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { pk, sk },
    UpdateExpression: `ADD ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

async function track(event) {
  const ua = event.headers?.['user-agent'] || '';
  if (!ua || BOT_UA.test(ua)) return { statusCode: 204 };

  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');
  let b;
  try { b = JSON.parse(raw); } catch { return json(400, { error: 'invalid JSON' }); }

  const day = kstDate();
  const path = clean(b.p, 80) || '/';
  const newVisitor = b.n === 1 ? 1 : 0;
  const newSession = b.s === 1 ? 1 : 0;
  const source = clean(b.r, 60) || '(직접 방문)';
  const device = b.d === 'm' ? 'm' : 'd';

  const jobs = [
    add(day, 'total', { pv: 1, uv: newVisitor, ss: newSession }),
    add(day, `page#${path}`, { n: 1 }),
  ];
  if (newSession) {
    jobs.push(add(day, `ref#${source}`, { n: 1 }));
    jobs.push(add(day, `dev#${device}`, { n: 1 }));
  }
  await Promise.all(jobs.filter(Boolean));
  return { statusCode: 204 };
}

async function report(event) {
  const days = Math.min(Math.max(parseInt(event.queryStringParameters?.days, 10) || 30, 1), 365);
  const dates = Array.from({ length: days }, (_, i) => kstDate(i));
  const results = await Promise.all(dates.map(async (pk) => {
    const out = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: { ':pk': pk },
    }));
    return { date: pk, items: out.Items ?? [] };
  }));

  // 날짜별 행 + 기간 합계(페이지·유입처·기기)
  const daily = [];
  const pages = {}, refs = {}, devices = {};
  for (const { date, items } of results) {
    const row = { date, pv: 0, uv: 0, ss: 0 };
    for (const it of items) {
      if (it.sk === 'total') Object.assign(row, { pv: it.pv || 0, uv: it.uv || 0, ss: it.ss || 0 });
      else if (it.sk.startsWith('page#')) pages[it.sk.slice(5)] = (pages[it.sk.slice(5)] || 0) + (it.n || 0);
      else if (it.sk.startsWith('ref#')) refs[it.sk.slice(4)] = (refs[it.sk.slice(4)] || 0) + (it.n || 0);
      else if (it.sk.startsWith('dev#')) devices[it.sk.slice(4)] = (devices[it.sk.slice(4)] || 0) + (it.n || 0);
    }
    daily.push(row);
  }
  daily.reverse(); // 오래된 날 → 오늘
  return json(200, { days, daily, pages, refs, devices });
}

export const handler = async (event) => {
  try {
    const path = event.rawPath ?? '';
    if (path.endsWith('/public/track')) return await track(event);
    if (path.endsWith('/analytics')) return await report(event);
    return json(404, { error: 'not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'internal error' });
  }
};
