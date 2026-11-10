# 관리자 AI 비서 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 AI 비서가 집계를 서버 계산으로 정확히 답하고, 확인을 거쳐 강의·고객 데이터를 등록·수정하게 만든다.

**Architecture:** 로그인 보호 HTTP API가 질문을 접수해 대화를 DynamoDB에 저장하고, 같은 Lambda를 비동기로 다시 호출해 모델 루프를 돌린다. 조회 도구는 서버가 즉시 실행하고, 변경 도구는 확인 대기 상태로 멈췄다가 패널에서 승인하면 실행한다. 패널은 1.5초 간격으로 상태를 받아와 그린다.

**Tech Stack:** Node.js 20 Lambda(ESM `.mjs`), `@anthropic-ai/sdk`, AWS SDK v3(런타임 제공), SAM 템플릿, `node:test`, 브라우저용 순수 JS.

설계 문서: `docs/superpowers/specs/2026-11-10-assistant-redesign-design.md`

## Global Constraints

- 모델은 `claude-opus-5-5`, `output_config: { effort: 'medium' }`. `thinking`과 `tool_choice`는 보내지 않는다.
- 모델 호출은 `@anthropic-ai/sdk`의 `client.beta.messages.create`만 쓴다(raw `fetch` 금지). `betas: ['server-side-fallback-2026-07-01']`, `fallbacks: 'default'`.
- 대화 `messages`는 추가만 한다. 과거 메시지를 자르거나 고치지 않는다. 모델 응답의 `content`는 그대로 넣는다.
- 한 번의 모델 응답에 대한 도구 결과는 반드시 **하나의** `user` 메시지에 모두 담는다.
- 변경 도구는 사용자가 승인하기 전에는 절대 실행하지 않는다. 삭제 도구는 만들지 않는다.
- `assistant-tools.mjs`, `assistant-actions.mjs`, `assistant-loop.mjs`, `assistant-app.mjs`는 AWS·Anthropic 패키지를 import하지 않는다(로컬 단위 테스트 대상).
- 날짜는 `YYYY-MM-DD` 문자열, 기준은 한국시간.
- 테스트 명령: `node --test "aws/lambda/test/*.test.mjs"` (저장소 루트에서). 패널 서식 테스트: `node --test "js/test/*.test.mjs"`.
- 커밋 메시지는 한국어 conventional commits(`feat(assistant): ...`)이고 마지막 줄에 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- `git push`와 AWS 배포는 사용자가 지시할 때만 한다.

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `aws/lambda/assistant-tools.mjs` | 새로 만듦 | 도구 스키마, 입력 검증, 실지급액 계산, 조회 도구 3개 |
| `aws/lambda/assistant-actions.mjs` | 새로 만듦 | 변경 도구 4개: 검증, 저장 값 결정, 확인 카드, 실행 |
| `aws/lambda/assistant-loop.mjs` | 새로 만듦 | 대화 상태 머신, 화면용 요약, 시스템 프롬프트 |
| `aws/lambda/assistant-app.mjs` | 새로 만듦 | 접수·조회·작업 요청 처리(의존성 주입) |
| `aws/lambda/assistant-store.mjs` | 새로 만듦 | DynamoDB 접근 |
| `aws/lambda/assistant.mjs` | 전체 교체 | 핸들러와 실제 의존성 연결 |
| `aws/lambda/package.json` | 새로 만듦 | `@anthropic-ai/sdk` 의존성 |
| `aws/lambda/test/helpers.mjs` + `*.test.mjs` | 새로 만듦 | 가짜 데이터·가짜 모델과 단위 테스트 |
| `aws/template.yaml`, `aws/.gitignore`, `aws/DEPLOY.md` | 수정 | 테이블·경로·권한, `node_modules` 제외, 배포 절차 |
| `js/assistant-markdown.js` + `js/test/assistant-markdown.test.mjs` | 새로 만듦 | 답변 서식 변환과 테스트 |
| `js/assistant-panel.js` | 전체 교체 | 패널 UI |
| `lectures.html`, `crm/index.html` | 수정 | 스크립트 태그, 데이터 변경 이벤트 수신 |

`<!-- file: 경로 -->` 표시 바로 아래 코드 블록은 그 파일의 **전체 내용**이다.

---

### Task 1: 조회 도구와 입력 검증

**Files:**
- Create: `aws/lambda/assistant-tools.mjs`
- Create: `aws/lambda/test/helpers.mjs`
- Test: `aws/lambda/test/assistant-tools.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - 상수 `PAYMENT_STATUSES`, `TAX_DEDUCTIONS`, `CLIENT_STATUSES`, `READ_TOOLS: Set<string>`, `WRITE_TOOLS: Set<string>`, `TOOLS: Array<{name, description, input_schema}>`
  - `calculateNetPayment(fee: number, taxDeduction: string): number`
  - `netPaymentOf(lecture): number`
  - `isDate(value): boolean`
  - `checkFields(input, spec): string | null` — 오류 메시지 또는 `null`. `spec` 값은 `'date' | 'string' | 'number' | 'strings' | string[]`(열거값)
  - `searchLectures(lectures, input)`, `aggregateLectures(lectures, input)`, `searchClients(clients, lectures, input)`
  - `runReadTool(name, input, data): Promise<object>` — 입력이 잘못되면 `Error`를 던진다. `data`는 `{ listLectures(): Promise<object[]>, listClients(): Promise<object[]> }`
  - 테스트 헬퍼 `fakeData(lectures, clients)`, `fakeModel(responses)`, `text(t)`, `use(id, name, input)`, `res(content, stop_reason)`

- [ ] **Step 1: 테스트 헬퍼 작성**

<!-- file: aws/lambda/test/helpers.mjs -->
```js
// 단위 테스트용 가짜 데이터 저장소와 가짜 모델
export function fakeData(lectures = [], clients = []) {
  const L = lectures.map((x) => ({ ...x }));
  const C = clients.map((x) => ({ ...x }));
  let n = 0;
  const update = (list) => async (id, fields) => {
    const item = list.find((x) => x.id === id);
    if (!item) throw new Error('not found');
    Object.assign(item, fields);
  };
  const create = (list) => async (fields) => {
    const item = { ...fields, id: 'new-' + (++n) };
    list.push(item);
    return item;
  };
  return {
    lectures: L,
    clients: C,
    listLectures: async () => L,
    listClients: async () => C,
    getLecture: async (id) => L.find((x) => x.id === id) ?? null,
    getClient: async (id) => C.find((x) => x.id === id) ?? null,
    createLecture: create(L),
    updateLecture: update(L),
    createClient: create(C),
    updateClient: update(C),
  };
}

// responses를 순서대로 돌려주는 가짜 모델. Error 객체를 넣으면 그 차례에 던진다.
export function fakeModel(responses) {
  const queue = [...responses];
  const calls = [];
  return {
    calls,
    create: async (messages) => {
      calls.push(JSON.parse(JSON.stringify(messages)));
      const next = queue.shift();
      if (!next) throw new Error('fakeModel: 준비된 응답이 없습니다');
      if (next instanceof Error) throw next;
      return next;
    },
  };
}

export const text = (t) => ({ type: 'text', text: t });
export const use = (id, name, input) => ({ type: 'tool_use', id, name, input });
export const res = (content, stop_reason = 'end_turn') => ({
  content,
  stop_reason,
  usage: { input_tokens: 1, output_tokens: 1 },
});

export const LECTURES = [
  { id: 'a', date: '2026-10-05', name: 'AI 리더십 워크숍', client: '가나전자', audience: '팀장 30명', contractor: '직접', location: '서울', duration: 4, fee: 2000000, taxDeduction: '3.3', paymentStatus: 'paid' },
  { id: 'b', date: '2026-10-20', name: '바이브코딩 실습', client: '다라중공업', contractor: '교육기관A', location: '울산', duration: 8, fee: 3000000, taxDeduction: 'vat', netPayment: 3300000, paymentStatus: 'pending' },
  { id: 'c', date: '2026-11-03', name: 'AI 리터러시', client: '가나전자', duration: 2, fee: 1000000, taxDeduction: 'none', paymentStatus: 'pending', notes: '신입사원 대상' },
  { id: 'd', date: '2025-12-10', name: '임원 특강', client: '마바식품', duration: 1.5, fee: 1500000, taxDeduction: '8.8', paymentStatus: 'partial' },
];

export const CLIENTS = [
  { id: 'c1', companyName: '가나전자', status: 'contract', contactName: '홍길동', followUpDate: '2026-11-05', interests: ['AI 리더십'] },
  { id: 'c2', companyName: '사아은행', status: 'lead', contactName: '김철수', followUpDate: '2026-12-01', memo: '내년 상반기 문의' },
  { id: 'c3', companyName: '마바식품', status: 'proposal', contactName: '이영희' },
];
```

- [ ] **Step 2: 실패하는 테스트 작성**

<!-- file: aws/lambda/test/assistant-tools.test.mjs -->
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS, READ_TOOLS, WRITE_TOOLS, calculateNetPayment, netPaymentOf, isDate, checkFields,
  searchLectures, aggregateLectures, searchClients, runReadTool,
} from '../assistant-tools.mjs';
import { fakeData, LECTURES, CLIENTS } from './helpers.mjs';

test('실지급액 계산은 화면과 같은 식을 쓴다', () => {
  assert.equal(calculateNetPayment(2000000, '3.3'), 1934000);
  assert.equal(calculateNetPayment(1500000, '8.8'), 1368000);
  assert.equal(calculateNetPayment(3000000, 'vat'), 3300000);
  assert.equal(calculateNetPayment(1000000, 'none'), 1000000);
  assert.equal(calculateNetPayment(0, '3.3'), 0);
  assert.equal(netPaymentOf({ fee: 2000000, taxDeduction: '3.3' }), 1934000);
  assert.equal(netPaymentOf({ fee: 2000000, taxDeduction: '3.3', netPayment: 1900000 }), 1900000);
});

test('isDate는 실제 날짜만 받는다', () => {
  assert.equal(isDate('2026-11-10'), true);
  assert.equal(isDate('2026-02-30'), false);
  assert.equal(isDate('20261110'), false);
  assert.equal(isDate(20261110), false);
});

test('checkFields는 모르는 필드·타입·열거값·음수를 거른다', () => {
  const spec = { d: 'date', s: 'string', n: 'number', e: ['x', 'y'], list: 'strings' };
  assert.equal(checkFields({ d: '2026-11-10', s: 'a', n: 1, e: 'x', list: ['a'] }, spec), null);
  assert.equal(checkFields({ s: null }, spec), null);
  assert.match(checkFields({ zzz: 1 }, spec), /알 수 없는 필드: zzz/);
  assert.match(checkFields({ d: '2026-13-01' }, spec), /d:/);
  assert.match(checkFields({ n: -1 }, spec), /n:/);
  assert.match(checkFields({ n: '5' }, spec), /n:/);
  assert.match(checkFields({ e: 'z' }, spec), /e:/);
  assert.match(checkFields({ list: 'a' }, spec), /list:/);
  assert.match(checkFields([], spec), /객체/);
});

test('search_lectures: 필터·정렬·합계', () => {
  const all = searchLectures(LECTURES, {});
  assert.deepEqual(all.items.map((l) => l.id), ['c', 'b', 'a', 'd']);
  assert.equal(all.total_count, 4);
  assert.equal(all.sum_fee, 7500000);
  assert.equal(all.sum_net, 7602000);
  assert.equal(all.sum_hours, 15.5);
  assert.equal(all.items.find((l) => l.id === 'a').netPayment, 1934000);

  const october = searchLectures(LECTURES, { date_from: '2026-10-01', date_to: '2026-10-31' });
  assert.deepEqual(october.items.map((l) => l.id), ['b', 'a']);

  assert.deepEqual(searchLectures(LECTURES, { client: '가나' }).items.map((l) => l.id), ['c', 'a']);
  assert.deepEqual(searchLectures(LECTURES, { text: '신입' }).items.map((l) => l.id), ['c']);
  assert.deepEqual(searchLectures(LECTURES, { payment_status: 'pending' }).items.map((l) => l.id), ['c', 'b']);
  assert.deepEqual(searchLectures(LECTURES, { sort: 'fee_desc' }).items.map((l) => l.id), ['b', 'a', 'd', 'c']);
});

test('search_lectures: limit은 목록만 줄이고 합계는 전체 기준', () => {
  const out = searchLectures(LECTURES, { limit: 2 });
  assert.equal(out.returned, 2);
  assert.equal(out.total_count, 4);
  assert.equal(out.sum_fee, 7500000);
});

test('aggregate_lectures: 월별 묶음은 시간순', () => {
  const out = aggregateLectures(LECTURES, { date_from: '2026-01-01', group_by: 'month' });
  assert.deepEqual(out.groups, [
    { key: '2026-10', count: 2, sum_fee: 5000000, sum_net: 5234000, sum_hours: 12 },
    { key: '2026-11', count: 1, sum_fee: 1000000, sum_net: 1000000, sum_hours: 2 },
  ]);
  assert.deepEqual(out.total, { count: 3, sum_fee: 6000000, sum_net: 6234000, sum_hours: 14 });
});

test('aggregate_lectures: 고객사별 묶음은 강의료 큰 순, 같으면 건수 많은 순', () => {
  const out = aggregateLectures(LECTURES, { group_by: 'client' });
  assert.deepEqual(out.groups.map((g) => [g.key, g.count, g.sum_fee]), [
    ['가나전자', 2, 3000000],
    ['다라중공업', 1, 3000000],
    ['마바식품', 1, 1500000],
  ]);
});

test('aggregate_lectures: 묶음 없이 합계만, 결과가 없으면 0', () => {
  assert.deepEqual(aggregateLectures(LECTURES, {}).groups, []);
  assert.equal(aggregateLectures(LECTURES, {}).total.count, 4);
  assert.deepEqual(aggregateLectures(LECTURES, { client: '없는회사', group_by: 'year' }), {
    group_by: 'year', groups: [], total: { count: 0, sum_fee: 0, sum_net: 0, sum_hours: 0 },
  });
});

test('search_clients: 상태·검색어·팔로업 기한, 강의 건수 포함', () => {
  const all = searchClients(CLIENTS, LECTURES, {});
  assert.equal(all.total_count, 3);
  assert.equal(all.items.find((c) => c.companyName === '가나전자').lecture_count, 2);
  assert.equal(all.items.find((c) => c.companyName === '사아은행').lecture_count, 0);

  assert.deepEqual(searchClients(CLIENTS, LECTURES, { followup_due_by: '2026-11-10' }).items.map((c) => c.id), ['c1']);
  assert.deepEqual(searchClients(CLIENTS, LECTURES, { status: 'lead' }).items.map((c) => c.id), ['c2']);
  assert.deepEqual(searchClients(CLIENTS, LECTURES, { text: '이영희' }).items.map((c) => c.id), ['c3']);
});

test('runReadTool: 도구별로 실행하고 잘못된 입력은 던진다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  assert.equal((await runReadTool('aggregate_lectures', { group_by: 'none' }, data)).total.count, 4);
  assert.equal((await runReadTool('search_lectures', { client: '마바' }, data)).total_count, 1);
  assert.equal((await runReadTool('search_clients', {}, data)).total_count, 3);
  await assert.rejects(runReadTool('search_lectures', { date_from: '어제' }, data), /date_from/);
  await assert.rejects(runReadTool('aggregate_lectures', { group_by: 'week' }, data), /group_by/);
  await assert.rejects(runReadTool('delete_lecture', {}, data), /알 수 없는 도구/);
});

test('TOOLS: 조회·변경 도구 7개가 모두 정의돼 있고 삭제 도구는 없다', () => {
  const names = TOOLS.map((t) => t.name).sort();
  assert.deepEqual(names, [...READ_TOOLS, ...WRITE_TOOLS].sort());
  assert.equal(names.length, 7);
  assert.equal(names.some((n) => n.includes('delete')), false);
  for (const t of TOOLS) {
    assert.ok(t.description.length > 10, t.name);
    assert.equal(t.input_schema.type, 'object', t.name);
    assert.equal(t.input_schema.additionalProperties, false, t.name);
  }
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '.../aws/lambda/assistant-tools.mjs'`

- [ ] **Step 4: 구현**

<!-- file: aws/lambda/assistant-tools.mjs -->
```js
// AI 비서 도구 — 스키마, 입력 검증, 조회 도구(검색·집계). AWS 의존 없음(단위 테스트 대상).

export const PAYMENT_STATUSES = ['pending', 'paid', 'partial'];
export const TAX_DEDUCTIONS = ['none', '3.3', '8.8', 'vat'];
export const CLIENT_STATUSES = ['lead', 'proposal', 'negotiation', 'contract', 'lost'];
const GROUP_BYS = ['none', 'year', 'month', 'client', 'contractor', 'payment_status'];
const SORTS = ['date_desc', 'date_asc', 'fee_desc'];

export const READ_TOOLS = new Set(['search_lectures', 'aggregate_lectures', 'search_clients']);
export const WRITE_TOOLS = new Set(['create_lecture', 'update_lecture', 'create_client', 'update_client']);

// ───────── 스키마 ─────────
const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });

const filterProps = {
  date_from: { type: 'string', description: '이 날짜부터(포함), YYYY-MM-DD' },
  date_to: { type: 'string', description: '이 날짜까지(포함), YYYY-MM-DD' },
  client: { type: 'string', description: '고객사명 일부(부분 일치)' },
  text: { type: 'string', description: '강의명·대상·장소·계약주체·메모에서 찾을 단어(부분 일치)' },
  payment_status: { type: 'string', enum: PAYMENT_STATUSES, description: 'pending=입금 대기, paid=입금 완료, partial=일부 입금' },
};

const lectureProps = {
  date: { type: 'string', description: '강의일자, YYYY-MM-DD' },
  name: { type: 'string', description: '강의명' },
  client: { type: 'string', description: '고객사' },
  duration: { type: 'number', description: '교육시간(시간 단위)' },
  audience: { type: 'string', description: '대상(예: 팀장 30명)' },
  contractor: { type: 'string', description: '계약 주체(발주·정산하는 곳)' },
  location: { type: 'string', description: '교육장소' },
  fee: { type: 'number', description: '강의료(원)' },
  taxDeduction: { type: 'string', enum: TAX_DEDUCTIONS, description: '세금공제: none 없음, 3.3·8.8 원천징수, vat 부가세 별도' },
  netPayment: { type: 'number', description: '실지급액(원). 생략하면 강의료와 세금공제로 계산한다' },
  paymentStatus: { type: 'string', enum: PAYMENT_STATUSES, description: '입금 여부' },
  notes: { type: 'string', description: '기타사항' },
};

const clientProps = {
  companyName: { type: 'string', description: '회사명' },
  status: { type: 'string', enum: CLIENT_STATUSES, description: '영업 단계: lead 잠재고객, proposal 제안중, negotiation 협상중, contract 계약완료, lost 실패' },
  contactName: { type: 'string', description: '담당자 이름' },
  contactTitle: { type: 'string', description: '담당자 직함' },
  contactPhone: { type: 'string', description: '담당자 연락처' },
  contactEmail: { type: 'string', description: '담당자 이메일' },
  memo: { type: 'string', description: '메모' },
  followUpDate: { type: 'string', description: '다음 연락일, YYYY-MM-DD' },
  interests: { type: 'array', items: { type: 'string' }, description: '관심 분야(예: AI 리더십, 바이브코딩)' },
};

const idProp = (what) => ({ id: { type: 'string', description: `${what}의 id. 먼저 조회해서 확인한 값만 쓴다` } });

export const TOOLS = [
  {
    name: 'search_lectures',
    description: '조건에 맞는 강의 목록을 찾는다. 결과의 total_count·sum_fee·sum_net·sum_hours는 limit과 무관하게 조건에 맞는 전체의 건수와 합계다. 수정할 강의의 id를 찾을 때도 쓴다.',
    input_schema: obj({
      ...filterProps,
      sort: { type: 'string', enum: SORTS, description: '정렬. 기본 date_desc(최신순)' },
      limit: { type: 'integer', description: '돌려줄 최대 건수. 기본 30, 최대 100' },
    }),
  },
  {
    name: 'aggregate_lectures',
    description: '조건에 맞는 강의를 묶어 건수(count), 강의료 합(sum_fee), 실지급액 합(sum_net), 교육시간 합(sum_hours)을 계산한다. 건수·합계·순위·추이가 필요하면 항상 이 도구를 쓴다. year·month는 시간순, 나머지는 강의료 큰 순으로 정렬된다.',
    input_schema: obj({
      ...filterProps,
      group_by: { type: 'string', enum: GROUP_BYS, description: '묶는 기준. none이면 전체 합계만' },
    }),
  },
  {
    name: 'search_clients',
    description: '고객사 목록을 찾는다. 각 고객사의 강의 건수(lecture_count)를 함께 돌려준다. 팔로업 기한이 지난 곳은 followup_due_by에 오늘 날짜를 넣어 찾는다.',
    input_schema: obj({
      text: { type: 'string', description: '회사명·담당자·메모에서 찾을 단어(부분 일치)' },
      status: clientProps.status,
      followup_due_by: { type: 'string', description: '다음 연락일이 이 날짜 이하인 곳만, YYYY-MM-DD' },
    }),
  },
  {
    name: 'create_lecture',
    description: '강의 이력을 새로 등록한다. 호출하면 소장에게 확인 카드가 뜨고, 승인해야 저장된다.',
    input_schema: obj(lectureProps, ['date', 'name', 'client']),
  },
  {
    name: 'update_lecture',
    description: '기존 강의의 일부 값을 바꾼다(입금 처리 포함). 바꿀 필드만 넣는다. 호출하면 확인 카드가 뜨고, 승인해야 저장된다. 값을 비우는 것은 지원하지 않는다.',
    input_schema: obj({ ...idProp('강의'), ...lectureProps }, ['id']),
  },
  {
    name: 'create_client',
    description: '고객사를 새로 등록한다. 호출하면 확인 카드가 뜨고, 승인해야 저장된다.',
    input_schema: obj(clientProps, ['companyName']),
  },
  {
    name: 'update_client',
    description: '기존 고객사의 일부 값을 바꾼다(영업 단계, 다음 연락일, 메모 등). 바꿀 필드만 넣는다. 호출하면 확인 카드가 뜨고, 승인해야 저장된다.',
    input_schema: obj({ ...idProp('고객사'), ...clientProps }, ['id']),
  },
];

// ───────── 입력 검증 ─────────
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// spec: { 필드명: 'date' | 'string' | 'number' | 'strings' | [열거값...] }. null·undefined는 생략으로 본다.
export function checkFields(input, spec) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return '입력이 객체가 아닙니다.';
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(spec, key)) return `알 수 없는 필드: ${key}`;
  }
  for (const [key, type] of Object.entries(spec)) {
    const v = input[key];
    if (v === undefined || v === null) continue;
    if (type === 'date') {
      if (!isDate(v)) return `${key}: YYYY-MM-DD 형식의 실제 날짜여야 합니다.`;
    } else if (type === 'string') {
      if (typeof v !== 'string') return `${key}: 문자열이어야 합니다.`;
      if (v.length > 2000) return `${key}: 2,000자 이하여야 합니다.`;
    } else if (type === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return `${key}: 0 이상의 숫자여야 합니다.`;
    } else if (type === 'strings') {
      if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) return `${key}: 문자열 목록이어야 합니다.`;
    } else if (Array.isArray(type)) {
      if (!type.includes(v)) return `${key}: ${type.join(', ')} 중 하나여야 합니다.`;
    }
  }
  return null;
}

const FILTER_SPEC = { date_from: 'date', date_to: 'date', client: 'string', text: 'string', payment_status: PAYMENT_STATUSES };
const READ_SPECS = {
  search_lectures: { ...FILTER_SPEC, sort: SORTS, limit: 'number' },
  aggregate_lectures: { ...FILTER_SPEC, group_by: GROUP_BYS },
  search_clients: { text: 'string', status: CLIENT_STATUSES, followup_due_by: 'date' },
};

// ───────── 계산 ─────────
// lectures.html의 calculateNetPayment와 같은 식
export function calculateNetPayment(fee, taxDeduction) {
  if (!fee || fee <= 0) return 0;
  switch (taxDeduction) {
    case '3.3': return Math.round(fee * 0.967);
    case '8.8': return Math.round(fee * 0.912);
    case 'vat': return Math.round(fee * 1.1);
    default: return fee;
  }
}

export function netPaymentOf(lecture) {
  return lecture.netPayment || calculateNetPayment(lecture.fee || 0, lecture.taxDeduction);
}

const norm = (s) => String(s ?? '').toLowerCase();

function filterLectures(lectures, f) {
  const client = norm(f.client);
  const text = norm(f.text);
  return lectures.filter((l) => {
    const date = l.date || '';
    if (f.date_from && date < f.date_from) return false;
    if (f.date_to && date > f.date_to) return false;
    if (client && !norm(l.client).includes(client)) return false;
    if (f.payment_status && l.paymentStatus !== f.payment_status) return false;
    if (text && !norm([l.name, l.audience, l.location, l.contractor, l.notes].join(' ')).includes(text)) return false;
    return true;
  });
}

function sums(list) {
  let sum_fee = 0, sum_net = 0, sum_hours = 0;
  for (const l of list) {
    sum_fee += l.fee || 0;
    sum_net += netPaymentOf(l);
    sum_hours += Number(l.duration) || 0;
  }
  return { count: list.length, sum_fee, sum_net, sum_hours };
}

function pickLecture(l) {
  const out = {
    id: l.id, date: l.date, name: l.name, client: l.client, audience: l.audience, contractor: l.contractor,
    location: l.location, duration: l.duration, fee: l.fee || 0, taxDeduction: l.taxDeduction,
    netPayment: netPaymentOf(l), paymentStatus: l.paymentStatus, notes: l.notes,
  };
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
  return out;
}

// ───────── 조회 도구 ─────────
export function searchLectures(lectures, input = {}) {
  const matched = filterLectures(lectures, input);
  const byDate = (a, b) => (a.date || '').localeCompare(b.date || '');
  const sorters = {
    date_desc: (a, b) => byDate(b, a),
    date_asc: byDate,
    fee_desc: (a, b) => (b.fee || 0) - (a.fee || 0) || byDate(b, a),
  };
  const sorted = [...matched].sort(sorters[input.sort || 'date_desc']);
  const limit = Math.min(Math.max(Math.floor(input.limit || 30), 1), 100);
  const items = sorted.slice(0, limit).map(pickLecture);
  const s = sums(matched);
  return { total_count: s.count, returned: items.length, sum_fee: s.sum_fee, sum_net: s.sum_net, sum_hours: s.sum_hours, items };
}

function groupKey(l, by) {
  switch (by) {
    case 'year': return (l.date || '').slice(0, 4) || '(날짜 없음)';
    case 'month': return (l.date || '').slice(0, 7) || '(날짜 없음)';
    case 'client': return l.client || '(고객사 없음)';
    case 'contractor': return l.contractor || '(계약주체 없음)';
    default: return l.paymentStatus || '(상태 없음)';
  }
}

export function aggregateLectures(lectures, input = {}) {
  const matched = filterLectures(lectures, input);
  const by = input.group_by || 'none';
  const total = sums(matched);
  if (by === 'none') return { group_by: by, groups: [], total };

  const buckets = new Map();
  for (const l of matched) {
    const key = groupKey(l, by);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(l);
  }
  const groups = [...buckets].map(([key, list]) => ({ key, ...sums(list) }));
  if (by === 'year' || by === 'month') groups.sort((a, b) => a.key.localeCompare(b.key));
  else groups.sort((a, b) => b.sum_fee - a.sum_fee || b.count - a.count || a.key.localeCompare(b.key, 'ko'));
  return { group_by: by, groups, total };
}

export function searchClients(clients, lectures, input = {}) {
  const text = norm(input.text);
  const counts = new Map();
  for (const l of lectures) {
    const key = (l.client || '').trim();
    if (key) counts.set(key, (counts.get(key) || 0) + 1);
  }
  const matched = clients.filter((c) => {
    if (input.status && (c.status || 'lead') !== input.status) return false;
    if (text && !norm([c.companyName, c.contactName, c.memo].join(' ')).includes(text)) return false;
    if (input.followup_due_by && (!c.followUpDate || c.followUpDate > input.followup_due_by)) return false;
    return true;
  });
  matched.sort((a, b) => (a.followUpDate || '9999').localeCompare(b.followUpDate || '9999')
    || (a.companyName || '').localeCompare(b.companyName || '', 'ko'));
  const items = matched.map((c) => {
    const out = {
      id: c.id, companyName: c.companyName, status: c.status || 'lead', contactName: c.contactName,
      contactTitle: c.contactTitle, contactPhone: c.contactPhone, contactEmail: c.contactEmail, memo: c.memo,
      followUpDate: c.followUpDate, interests: c.interests,
      lecture_count: counts.get((c.companyName || '').trim()) || 0,
    };
    for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k];
    return out;
  });
  return { total_count: items.length, items };
}

export async function runReadTool(name, input, data) {
  const spec = READ_SPECS[name];
  if (!spec) throw new Error(`알 수 없는 도구: ${name}`);
  const error = checkFields(input ?? {}, spec);
  if (error) throw new Error(error);
  const clean = Object.fromEntries(Object.entries(input ?? {}).filter(([, v]) => v !== null && v !== undefined));
  if (name === 'search_lectures') return searchLectures(await data.listLectures(), clean);
  if (name === 'aggregate_lectures') return aggregateLectures(await data.listLectures(), clean);
  return searchClients(await data.listClients(), await data.listLectures(), clean);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: PASS — `# pass 11`, `# fail 0`

- [ ] **Step 6: 커밋**

```bash
git add aws/lambda/assistant-tools.mjs aws/lambda/test/helpers.mjs aws/lambda/test/assistant-tools.test.mjs
git commit -m "feat(assistant): 조회 도구(검색·집계)와 입력 검증"
```

---

### Task 2: 변경 도구(검증·확인 카드·실행)

**Files:**
- Create: `aws/lambda/assistant-actions.mjs`
- Test: `aws/lambda/test/assistant-actions.test.mjs`

**Interfaces:**
- Consumes (Task 1): `calculateNetPayment`, `checkFields`, `PAYMENT_STATUSES`, `TAX_DEDUCTIONS`, `CLIENT_STATUSES`; 테스트 헬퍼 `fakeData`, `LECTURES`, `CLIENTS`
- Produces:
  - `validateAction(name, input): { ok: true, value } | { ok: false, error: string }`
  - `planAction(name, input, data): Promise<{ ok: false, error } | { ok: true, table: 'lectures' | 'clients', id: string | null, fields: object, card: { title: string, rows: Array<{ label, before?, after }> } }>`
  - `executeAction(name, input, data): Promise<{ ok: true, id: string, saved: object }>` — 실패하면 `Error`를 던진다
  - `data`는 `{ getLecture(id), getClient(id), createLecture(fields), updateLecture(id, fields), createClient(fields), updateClient(id, fields) }`. `create*`는 `id`가 들어간 항목을 돌려준다

- [ ] **Step 1: 실패하는 테스트 작성**

<!-- file: aws/lambda/test/assistant-actions.test.mjs -->
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAction, planAction, executeAction } from '../assistant-actions.mjs';
import { fakeData, LECTURES, CLIENTS } from './helpers.mjs';

test('validateAction: 필수 값·모르는 필드·날짜·빈 수정', () => {
  assert.equal(validateAction('create_lecture', { date: '2026-11-20', name: ' 팀장 과정 ', client: '가나전자' }).value.name, '팀장 과정');
  assert.match(validateAction('create_lecture', { date: '2026-11-20', name: '팀장 과정' }).error, /client/);
  assert.match(validateAction('create_lecture', { date: '2026-11-20', name: '  ', client: '가나전자' }).error, /name/);
  assert.match(validateAction('create_lecture', { date: '11/20', name: 'x', client: 'y' }).error, /date/);
  assert.match(validateAction('create_lecture', { date: '2026-11-20', name: 'x', client: 'y', price: 1 }).error, /알 수 없는 필드/);
  assert.match(validateAction('update_lecture', { id: 'a' }).error, /바꿀 값/);
  assert.match(validateAction('update_lecture', { paymentStatus: 'paid' }).error, /id/);
  assert.match(validateAction('delete_lecture', { id: 'a' }).error, /알 수 없는 도구/);
});

test('planAction create_lecture: 기본값을 채우고 실지급액을 계산한다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  const plan = await planAction('create_lecture', { date: '2026-11-20', name: '팀장 과정', client: '가나전자', fee: 2000000, taxDeduction: '3.3' }, data);
  assert.equal(plan.ok, true);
  assert.equal(plan.table, 'lectures');
  assert.deepEqual(plan.fields, {
    date: '2026-11-20', name: '팀장 과정', client: '가나전자', duration: 0, audience: '', contractor: '', location: '',
    fee: 2000000, taxDeduction: '3.3', netPayment: 1934000, paymentStatus: 'pending', notes: '',
  });
  assert.equal(plan.card.title, '강의 등록 · 2026-11-20 가나전자');
  assert.deepEqual(plan.card.rows.find((r) => r.label === '실지급액'), { label: '실지급액', after: '₩1,934,000' });
  assert.deepEqual(plan.card.rows.find((r) => r.label === '입금 여부'), { label: '입금 여부', after: '대기' });
  assert.equal(plan.card.rows.some((r) => r.label === '교육장소'), false);
});

test('planAction update_lecture: 바뀌는 필드만 이전 → 이후로 보여준다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  const plan = await planAction('update_lecture', { id: 'c', paymentStatus: 'paid', name: 'AI 리터러시' }, data);
  assert.equal(plan.ok, true);
  assert.equal(plan.id, 'c');
  assert.deepEqual(plan.fields, { paymentStatus: 'paid' });
  assert.equal(plan.card.title, '강의 수정 · 2026-11-03 가나전자 · AI 리터러시');
  assert.deepEqual(plan.card.rows, [{ label: '입금 여부', before: '대기', after: '완료' }]);
});

test('planAction update_lecture: 강의료가 바뀌면 실지급액을 다시 계산한다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  const plan = await planAction('update_lecture', { id: 'a', fee: 3000000 }, data);
  assert.deepEqual(plan.fields, { fee: 3000000, netPayment: 2901000 });
  assert.deepEqual(plan.card.rows, [
    { label: '강의료', before: '₩2,000,000', after: '₩3,000,000' },
    { label: '실지급액', before: '₩1,934,000', after: '₩2,901,000' },
  ]);
});

test('planAction: 없는 id, 바뀌는 값이 없는 수정은 거절한다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  assert.match((await planAction('update_lecture', { id: 'zzz', paymentStatus: 'paid' }, data)).error, /찾을 수 없습니다/);
  assert.match((await planAction('update_lecture', { id: 'a', paymentStatus: 'paid' }, data)).error, /현재 값과 같습니다/);
});

test('planAction 고객사: 등록 기본값과 수정 카드', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  const created = await planAction('create_client', { companyName: '새회사', interests: ['코칭'] }, data);
  assert.deepEqual(created.fields, {
    companyName: '새회사', status: 'lead', contactName: '', contactTitle: '', contactPhone: '', contactEmail: '',
    memo: '', followUpDate: '', interests: ['코칭'],
  });
  assert.equal(created.card.title, '고객사 등록 · 새회사');
  assert.deepEqual(created.card.rows.find((r) => r.label === '영업 단계'), { label: '영업 단계', after: '잠재고객' });

  const updated = await planAction('update_client', { id: 'c2', status: 'proposal', followUpDate: '2026-11-17' }, data);
  assert.equal(updated.table, 'clients');
  assert.equal(updated.card.title, '고객사 수정 · 사아은행');
  assert.deepEqual(updated.card.rows, [
    { label: '영업 단계', before: '잠재고객', after: '제안중' },
    { label: '팔로업 날짜', before: '2026-12-01', after: '2026-11-17' },
  ]);
});

test('executeAction: 등록은 새 항목을 만들고 수정은 바뀐 필드만 저장한다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  const created = await executeAction('create_lecture', { date: '2026-11-20', name: '팀장 과정', client: '가나전자', fee: 1000000 }, data);
  assert.equal(created.ok, true);
  assert.equal(data.lectures.length, 5);
  assert.equal(data.lectures.at(-1).id, created.id);
  assert.equal(data.lectures.at(-1).netPayment, 1000000);

  const updated = await executeAction('update_lecture', { id: 'c', paymentStatus: 'paid' }, data);
  assert.deepEqual(updated, { ok: true, id: 'c', saved: { paymentStatus: 'paid' } });
  assert.equal(data.lectures.find((l) => l.id === 'c').paymentStatus, 'paid');
  assert.equal(data.lectures.find((l) => l.id === 'c').name, 'AI 리터러시');

  await executeAction('update_client', { id: 'c3', memo: '12월 재연락' }, data);
  assert.equal(data.clients.find((c) => c.id === 'c3').memo, '12월 재연락');
});

test('executeAction: 잘못된 입력은 저장하지 않고 던진다', async () => {
  const data = fakeData(LECTURES, CLIENTS);
  await assert.rejects(executeAction('create_lecture', { date: '2026-11-20', name: 'x' }, data), /client/);
  await assert.rejects(executeAction('update_lecture', { id: 'zzz', fee: 1 }, data), /찾을 수 없습니다/);
  assert.equal(data.lectures.length, 4);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '.../aws/lambda/assistant-actions.mjs'`

- [ ] **Step 3: 구현**

<!-- file: aws/lambda/assistant-actions.mjs -->
```js
// AI 비서 변경 도구 — 검증, 저장할 값 결정, 확인 카드, 실행. AWS 의존 없음(단위 테스트 대상).
import {
  calculateNetPayment, netPaymentOf, checkFields, PAYMENT_STATUSES, TAX_DEDUCTIONS, CLIENT_STATUSES,
} from './assistant-tools.mjs';

const LECTURE_SPEC = {
  date: 'date', name: 'string', client: 'string', duration: 'number', audience: 'string', contractor: 'string',
  location: 'string', fee: 'number', taxDeduction: TAX_DEDUCTIONS, netPayment: 'number',
  paymentStatus: PAYMENT_STATUSES, notes: 'string',
};
const CLIENT_SPEC = {
  companyName: 'string', status: CLIENT_STATUSES, contactName: 'string', contactTitle: 'string',
  contactPhone: 'string', contactEmail: 'string', memo: 'string', followUpDate: 'date', interests: 'strings',
};
const SPECS = {
  create_lecture: LECTURE_SPEC,
  update_lecture: { id: 'string', ...LECTURE_SPEC },
  create_client: CLIENT_SPEC,
  update_client: { id: 'string', ...CLIENT_SPEC },
};
const REQUIRED = {
  create_lecture: ['date', 'name', 'client'],
  update_lecture: ['id'],
  create_client: ['companyName'],
  update_client: ['id'],
};

const LABELS = {
  date: '강의일자', name: '강의명', client: '고객사', duration: '교육시간', audience: '대상', contractor: '계약주체',
  location: '교육장소', fee: '강의료', taxDeduction: '세금공제', netPayment: '실지급액', paymentStatus: '입금 여부',
  notes: '기타사항', companyName: '회사명', status: '영업 단계', contactName: '담당자', contactTitle: '직함',
  contactPhone: '연락처', contactEmail: '이메일', memo: '메모', followUpDate: '팔로업 날짜', interests: '관심 분야',
};
const VALUE_LABELS = {
  paymentStatus: { pending: '대기', paid: '완료', partial: '일부입금' },
  taxDeduction: { none: '없음', '3.3': '3.3% 원천징수', '8.8': '8.8% 원천징수', vat: '부가세 별도' },
  status: { lead: '잠재고객', proposal: '제안중', negotiation: '협상중', contract: '계약완료', lost: '실패' },
};

function display(key, value) {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)) return '-';
  if (key === 'fee' || key === 'netPayment') return '₩' + Number(value).toLocaleString('en-US');
  if (key === 'duration') return value + '시간';
  if (VALUE_LABELS[key]) return VALUE_LABELS[key][value] || String(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function validateAction(name, input) {
  const spec = SPECS[name];
  if (!spec) return { ok: false, error: `알 수 없는 도구: ${name}` };
  const error = checkFields(input, spec);
  if (error) return { ok: false, error };

  // null·undefined는 생략, 문자열은 앞뒤 공백 제거, 빈 문자열은 생략(값 지우기는 지원하지 않음)
  const value = {};
  for (const [key, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    const cleaned = typeof v === 'string' ? v.trim() : v;
    if (cleaned === '') continue;
    value[key] = cleaned;
  }
  for (const key of REQUIRED[name]) {
    if (value[key] === undefined) return { ok: false, error: `${key}: 필수 값입니다.` };
  }
  if (name.startsWith('update_') && Object.keys(value).length < 2) return { ok: false, error: '바꿀 값이 하나도 없습니다.' };
  return { ok: true, value };
}

function lectureCreateFields(v) {
  const fee = v.fee ?? 0;
  const taxDeduction = v.taxDeduction ?? 'none';
  return {
    date: v.date, name: v.name, client: v.client, duration: v.duration ?? 0, audience: v.audience ?? '',
    contractor: v.contractor ?? '', location: v.location ?? '', fee, taxDeduction,
    netPayment: v.netPayment ?? calculateNetPayment(fee, taxDeduction),
    paymentStatus: v.paymentStatus ?? 'pending', notes: v.notes ?? '',
  };
}

function clientCreateFields(v) {
  return {
    companyName: v.companyName, status: v.status ?? 'lead', contactName: v.contactName ?? '',
    contactTitle: v.contactTitle ?? '', contactPhone: v.contactPhone ?? '', contactEmail: v.contactEmail ?? '',
    memo: v.memo ?? '', followUpDate: v.followUpDate ?? '', interests: v.interests ?? [],
  };
}

// 현재 값. 실지급액은 저장된 값이 없으면 화면처럼 강의료와 세금공제로 계산한 값을 쓴다
const currentValue = (name, current, key) => (name === 'update_lecture' && key === 'netPayment' ? netPaymentOf(current) : current[key]);

// 수정: id를 빼고, 강의료·세금공제가 바뀌면 실지급액을 다시 계산하고, 현재 값과 같은 필드는 뺀다
function updateFields(name, value, current) {
  const changes = { ...value };
  delete changes.id;
  if (name === 'update_lecture' && ('fee' in changes || 'taxDeduction' in changes) && !('netPayment' in changes)) {
    changes.netPayment = calculateNetPayment(changes.fee ?? current.fee ?? 0, changes.taxDeduction ?? current.taxDeduction);
  }
  for (const key of Object.keys(changes)) if (same(changes[key], currentValue(name, current, key))) delete changes[key];
  return changes;
}

const rowsForCreate = (fields) => Object.keys(fields)
  .filter((key) => !isEmpty(fields[key]) && !(key === 'duration' && fields[key] === 0) && !(key === 'fee' && fields[key] === 0) && !(key === 'netPayment' && fields[key] === 0))
  .map((key) => ({ label: LABELS[key], after: display(key, fields[key]) }));

const rowsForUpdate = (name, fields, current) => Object.keys(fields)
  .map((key) => ({ label: LABELS[key], before: display(key, currentValue(name, current, key)), after: display(key, fields[key]) }));

export async function planAction(name, input, data) {
  const checked = validateAction(name, input);
  if (!checked.ok) return checked;
  const v = checked.value;

  if (name === 'create_lecture') {
    const fields = lectureCreateFields(v);
    return { ok: true, table: 'lectures', id: null, fields, card: { title: `강의 등록 · ${fields.date} ${fields.client}`, rows: rowsForCreate(fields) } };
  }
  if (name === 'create_client') {
    const fields = clientCreateFields(v);
    return { ok: true, table: 'clients', id: null, fields, card: { title: `고객사 등록 · ${fields.companyName}`, rows: rowsForCreate(fields) } };
  }

  const isLecture = name === 'update_lecture';
  const current = isLecture ? await data.getLecture(v.id) : await data.getClient(v.id);
  if (!current) return { ok: false, error: `id가 ${v.id}인 ${isLecture ? '강의' : '고객사'}를 찾을 수 없습니다. 먼저 조회해서 id를 확인하세요.` };
  const fields = updateFields(name, v, current);
  if (!Object.keys(fields).length) return { ok: false, error: '바꾸려는 값이 현재 값과 같습니다.' };
  const title = isLecture
    ? `강의 수정 · ${current.date || ''} ${current.client || ''} · ${current.name || ''}`
    : `고객사 수정 · ${current.companyName || ''}`;
  return { ok: true, table: isLecture ? 'lectures' : 'clients', id: v.id, fields, card: { title, rows: rowsForUpdate(name, fields, current) } };
}

// 실행 직전에 다시 검증하고 현재 값을 다시 읽는다(확인 카드를 띄운 뒤 데이터가 바뀌었을 수 있다)
export async function executeAction(name, input, data) {
  const plan = await planAction(name, input, data);
  if (!plan.ok) throw new Error(plan.error);
  if (name === 'create_lecture') return { ok: true, id: (await data.createLecture(plan.fields)).id, saved: plan.fields };
  if (name === 'create_client') return { ok: true, id: (await data.createClient(plan.fields)).id, saved: plan.fields };
  if (name === 'update_lecture') await data.updateLecture(plan.id, plan.fields);
  else await data.updateClient(plan.id, plan.fields);
  return { ok: true, id: plan.id, saved: plan.fields };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: PASS — `# pass 19`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add aws/lambda/assistant-actions.mjs aws/lambda/test/assistant-actions.test.mjs
git commit -m "feat(assistant): 변경 도구 검증·확인 카드·실행"
```

---

### Task 3: 대화 상태 머신

**Files:**
- Create: `aws/lambda/assistant-loop.mjs`
- Test: `aws/lambda/test/assistant-loop.test.mjs`

**Interfaces:**
- Consumes (Task 1): `READ_TOOLS`, `WRITE_TOOLS`, `runReadTool(name, input, data)`; (Task 2): `planAction(name, input, data)`, `executeAction(name, input, data)`
- Produces:
  - `MAX_STEPS = 8`, `MAX_CONVERSATION_BYTES = 300000`
  - `newConversation(id): Conversation` — `{ id, status: 'idle', messages: [], events: [], pending: null, decisions: null, titles: {}, notices: [], error: null, updatedAt: 0 }`
  - `startTurn(conv, text)`, `queueDecisions(conv, decisions)`, `queueRetry(conv)` — 모두 `conv.status = 'running'`으로 만든다
  - `runLoop(conv, { model, data, save?, log? }): Promise<Conversation>` — `model.create(messages)`는 `{ content, stop_reason, usage }`를 돌려준다
  - `snapshot(conv): { status, view, events, pending, error? }`
  - `buildSystemPrompt(today: string): string`, `kstToday(now?: Date): string`

- [ ] **Step 1: 실패하는 테스트 작성**

<!-- file: aws/lambda/test/assistant-loop.test.mjs -->
```js
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '.../aws/lambda/assistant-loop.mjs'`

- [ ] **Step 3: 구현**

<!-- file: aws/lambda/assistant-loop.mjs -->
```js
// AI 비서 대화 상태 머신 — 모델 호출 루프, 확인 대기, 화면용 요약. AWS 의존 없음(단위 테스트 대상).
import { READ_TOOLS, WRITE_TOOLS, runReadTool } from './assistant-tools.mjs';
import { planAction, executeAction } from './assistant-actions.mjs';

export const MAX_STEPS = 8;
export const MAX_CONVERSATION_BYTES = 300_000;

const PROGRESS = {
  search_lectures: '강의 조회 중',
  aggregate_lectures: '강의 집계 중',
  search_clients: '고객사 조회 중',
  create_lecture: '강의 등록 준비 중',
  update_lecture: '강의 수정 준비 중',
  create_client: '고객사 등록 준비 중',
  update_client: '고객사 수정 준비 중',
};
const DECLINED = { declined: true, message: '사용자가 실행을 취소했습니다.' };

export function newConversation(id) {
  return { id, status: 'idle', messages: [], events: [], pending: null, decisions: null, titles: {}, notices: [], error: null, updatedAt: 0 };
}

export function kstToday(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function buildSystemPrompt(today) {
  return `당신은 AI 리더십연구소 김현 소장의 업무 비서입니다. 소장의 강의 이력과 고객사 데이터를 도구로 조회하고, 요청받은 변경을 도구로 제안합니다.

오늘 날짜(한국시간): ${today}

## 데이터
- 강의: date(강의일자), name(강의명), client(고객사), duration(교육시간, 시간 단위), audience(대상), contractor(계약 주체. 발주·정산하는 곳으로 고객사와 다를 수 있음), location(교육장소), fee(강의료, 원), taxDeduction(세금공제: none 없음 / 3.3 / 8.8 원천징수 / vat 부가세 별도), netPayment(실지급액, 원), paymentStatus(입금 여부: pending 대기 / paid 완료 / partial 일부입금), notes(기타사항)
- 고객사: companyName(회사명), status(영업 단계: lead 잠재고객 / proposal 제안중 / negotiation 협상중 / contract 계약완료 / lost 실패), contactName, contactTitle, contactPhone, contactEmail, memo, followUpDate(다음 연락일), interests(관심 분야)

## 일하는 방식
- 건수·합계·순위·추이 같은 숫자는 직접 세거나 더하지 않는다. aggregate_lectures나 search_lectures가 돌려준 값을 그대로 쓴다. 목록을 받아 암산하면 틀리기 쉽다.
- "이번 달", "지난달", "올해" 같은 표현은 오늘 날짜를 기준으로 날짜 범위로 바꿔 조회한다.
- 데이터에 없는 내용은 추측하지 않고 없다고 말한다.
- 데이터를 바꾸는 도구(create_*, update_*)를 호출하면 소장 화면에 확인 카드가 뜨고, 소장이 승인해야 저장된다. 그러니 변경 요청을 받으면 "진행할까요?"라고 되묻지 말고 바로 도구를 호출한다. 다만 대상이 여러 건으로 보이거나 필수 값(강의일자·강의명·고객사, 고객사 등록은 회사명)이 빠졌으면 먼저 물어본다.
- 수정할 때는 먼저 조회해서 대상의 id를 확인한다. id를 지어내지 않는다.
- 삭제와 값 비우기는 할 수 없다. 화면에서 직접 하도록 안내한다.
- 제안서·메일 초안은 소장의 강의 분야(AI 리더십, AI 리터러시, 바이브코딩)와 해당 고객사의 이력을 반영해, 바로 복사해 쓸 수 있는 완성된 글로 쓴다.
- 한국어로, 결론부터 간결하게 답한다. 금액은 원 단위에 쉼표를 넣는다. 여러 항목을 비교할 때만 표를 쓴다.`;
}

function toolResult(toolUseId, payload, isError = false) {
  const block = { type: 'tool_result', tool_use_id: toolUseId, content: typeof payload === 'string' ? payload : JSON.stringify(payload) };
  if (isError) block.is_error = true;
  return block;
}

function begin(conv) {
  conv.status = 'running';
  conv.events = [];
  conv.error = null;
}

function addEvent(conv, label) {
  if (conv.events[conv.events.length - 1] !== label) conv.events.push(label);
}

// 대기 중인 변경을 모두 취소로 닫는다(새 질문이 들어온 경우)
function declineAll(conv) {
  if (!conv.pending) return;
  conv.messages.push({
    role: 'user',
    content: [...conv.pending.readResults, ...conv.pending.actions.map((a) => toolResult(a.toolUseId, DECLINED))],
  });
  conv.pending = null;
  conv.decisions = null;
}

export function startTurn(conv, text) {
  declineAll(conv);
  conv.messages.push({ role: 'user', content: [{ type: 'text', text }] });
  begin(conv);
}

export function queueDecisions(conv, decisions) {
  conv.decisions = decisions;
  begin(conv);
}

export function queueRetry(conv) {
  begin(conv);
}

// 승인된 변경만 실행하고, 같은 턴의 조회 결과와 함께 하나의 user 메시지로 추가한다
async function applyDecisions(conv, data) {
  const approved = new Set((conv.decisions || []).filter((d) => d && d.approved === true).map((d) => d.toolUseId));
  const results = [...conv.pending.readResults];
  for (const action of conv.pending.actions) {
    if (!approved.has(action.toolUseId)) {
      results.push(toolResult(action.toolUseId, DECLINED));
      continue;
    }
    try {
      results.push(toolResult(action.toolUseId, await executeAction(action.name, action.input, data)));
    } catch (err) {
      results.push(toolResult(action.toolUseId, `실행 실패: ${err.message}`, true));
    }
  }
  conv.messages.push({ role: 'user', content: results });
  conv.pending = null;
  conv.decisions = null;
}

export async function runLoop(conv, { model, data, save = async () => {}, log = () => {} }) {
  if (conv.pending && conv.decisions) {
    await applyDecisions(conv, data);
    await save(conv);
  }

  for (let step = 1; step <= MAX_STEPS; step++) {
    const response = await model.create(conv.messages);
    log({ conversationId: conv.id, step, stop_reason: response.stop_reason, usage: response.usage });

    if (response.stop_reason === 'refusal') {
      conv.status = 'error';
      conv.error = '모델이 이 요청을 처리하지 않았습니다. 질문을 바꿔 다시 시도해 주세요.';
      await save(conv);
      return conv;
    }

    conv.messages.push({ role: 'assistant', content: response.content });
    const uses = response.content.filter((b) => b.type === 'tool_use');

    if (response.stop_reason === 'max_tokens' && uses.length) {
      // 도구 호출이 잘렸을 수 있다. 실행하지 않고 다시 시도하게 한다.
      conv.messages.push({
        role: 'user',
        content: uses.map((u) => toolResult(u.id, '출력 길이 제한으로 도구 호출이 완성되지 않았습니다. 더 짧게 다시 시도하세요.', true)),
      });
      await save(conv);
      continue;
    }

    if (response.stop_reason !== 'tool_use' || !uses.length) {
      if (response.stop_reason === 'max_tokens') {
        conv.notices.push({ at: conv.messages.length, text: '답변이 길이 제한에서 잘렸습니다. "이어서 써줘"라고 하면 계속합니다.' });
      }
      conv.status = 'idle';
      await save(conv);
      return conv;
    }

    const readResults = [];
    const actions = [];
    for (const u of uses) {
      addEvent(conv, PROGRESS[u.name] || `${u.name} 실행 중`);
      if (READ_TOOLS.has(u.name)) {
        try {
          readResults.push(toolResult(u.id, await runReadTool(u.name, u.input, data)));
        } catch (err) {
          readResults.push(toolResult(u.id, `조회 실패: ${err.message}`, true));
        }
      } else if (WRITE_TOOLS.has(u.name)) {
        let plan;
        try {
          plan = await planAction(u.name, u.input, data);
        } catch (err) {
          plan = { ok: false, error: err.message };
        }
        if (!plan.ok) {
          readResults.push(toolResult(u.id, `입력 오류: ${plan.error}`, true));
        } else {
          actions.push({ toolUseId: u.id, name: u.name, input: u.input, title: plan.card.title, rows: plan.card.rows });
          conv.titles[u.id] = { title: plan.card.title, table: plan.table };
        }
      } else {
        readResults.push(toolResult(u.id, `알 수 없는 도구: ${u.name}`, true));
      }
    }

    if (actions.length) {
      conv.pending = { actions, readResults };
      conv.status = 'needs_confirmation';
      await save(conv);
      return conv;
    }

    conv.messages.push({ role: 'user', content: readResults });
    await save(conv);
  }

  conv.notices.push({ at: conv.messages.length, text: `한 질문에 쓸 수 있는 단계(${MAX_STEPS}회)를 모두 썼습니다. 질문을 나눠서 다시 요청해 주세요.` });
  conv.status = 'idle';
  await save(conv);
  return conv;
}

// 화면용 요약. 사고 블록과 조회 도구의 원본 결과는 내보내지 않는다.
function buildView(conv) {
  const view = [];
  const noticesAt = (index) => conv.notices.filter((n) => n.at === index).forEach((n) => view.push({ role: 'notice', text: n.text }));

  conv.messages.forEach((message, index) => {
    noticesAt(index);
    const blocks = typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content;
    if (message.role === 'user') {
      for (const block of blocks) {
        if (block.type === 'text') {
          view.push({ role: 'user', text: block.text });
        } else if (block.type === 'tool_result' && conv.titles[block.tool_use_id]) {
          const { title, table } = conv.titles[block.tool_use_id];
          let outcome = 'done';
          if (block.is_error) outcome = 'failed';
          else {
            try { if (JSON.parse(block.content).declined) outcome = 'declined'; } catch { /* 문자열 결과 */ }
          }
          view.push({ role: 'action', toolUseId: block.tool_use_id, title, table, outcome });
        }
      }
    } else {
      const text = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n').trim();
      if (text) view.push({ role: 'assistant', text });
    }
  });
  conv.notices.filter((n) => n.at >= conv.messages.length).forEach((n) => view.push({ role: 'notice', text: n.text }));
  return view;
}

export function snapshot(conv) {
  const snap = {
    status: conv.status,
    view: buildView(conv),
    events: conv.events,
    pending: conv.pending
      ? conv.pending.actions.map(({ toolUseId, name, title, rows }) => ({ toolUseId, name, title, rows }))
      : [],
  };
  if (conv.error) snap.error = conv.error;
  return snap;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: PASS — `# pass 33`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add aws/lambda/assistant-loop.mjs aws/lambda/test/assistant-loop.test.mjs
git commit -m "feat(assistant): 대화 상태 머신(도구 루프·확인 대기·화면 요약)"
```

---

### Task 4: 요청 처리(접수·조회·작업)

**Files:**
- Create: `aws/lambda/assistant-app.mjs`
- Test: `aws/lambda/test/assistant-app.test.mjs`

**Interfaces:**
- Consumes (Task 3): `newConversation`, `startTurn`, `queueDecisions`, `queueRetry`, `runLoop`, `snapshot`, `MAX_CONVERSATION_BYTES`
- Produces: `STALE_MS = 150000`, `createApp({ store, data, makeModel, invokeWorker, explainError?, now?, log? })` → `{ accept(body), view(id), work(id) }`
  - `accept`·`view`는 `{ statusCode: number, body: object }`를 돌려준다. `work`는 값을 돌려주지 않는다.
  - `store`: `{ get(id): Promise<Conversation | null>, put(conv): Promise<void> }`
  - `makeModel(): Promise<{ create(messages) }>`, `invokeWorker(conversationId): Promise<void>`, `explainError(err): string`

- [ ] **Step 1: 실패하는 테스트 작성**

<!-- file: aws/lambda/test/assistant-app.test.mjs -->
```js
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '.../aws/lambda/assistant-app.mjs'`

- [ ] **Step 3: 구현**

<!-- file: aws/lambda/assistant-app.mjs -->
```js
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: PASS — `# pass 44`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add aws/lambda/assistant-app.mjs aws/lambda/test/assistant-app.test.mjs
git commit -m "feat(assistant): 접수·조회·작업 요청 처리"
```

---

### Task 5: AWS 연결(저장소·핸들러·템플릿)

**Files:**
- Create: `aws/lambda/assistant-store.mjs`, `aws/lambda/package.json`
- Modify (전체 교체): `aws/lambda/assistant.mjs`
- Modify: `aws/template.yaml`, `aws/.gitignore`, `aws/DEPLOY.md`

**Interfaces:**
- Consumes (Task 1): `TOOLS`; (Task 3): `buildSystemPrompt`, `kstToday`; (Task 4): `createApp`
- Produces: Lambda 핸들러 `assistant.handler`. HTTP 이벤트(`POST /assistant`, `GET /assistant/{id}`)와 작업 이벤트(`{ worker: true, conversationId }`)를 받는다.

이 태스크의 파일은 AWS·Anthropic 패키지를 import하므로 로컬 단위 테스트 대상이 아니다. 문법 검사와 SDK 로드 확인으로 검증하고, 실제 동작은 Task 8에서 배포 후 확인한다.

- [ ] **Step 1: 의존성 파일과 `.gitignore`**

<!-- file: aws/lambda/package.json -->
```json
{
  "name": "ailab-lambda",
  "private": true,
  "description": "AI Leadership Lab Lambda 함수들 (AWS SDK v3는 Lambda 런타임이 제공)",
  "scripts": {
    "test": "node --test test/*.test.mjs"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "latest"
  }
}
```

`aws/.gitignore`를 다음 내용으로 바꾼다.

<!-- file: aws/.gitignore -->
```
# 빌드 산출물
packaged.yaml
outputs.json

# Lambda 의존성 (배포 전에 npm install로 설치)
lambda/node_modules/
```

Run: `cd aws/lambda && npm install --no-audit --no-fund`
Expected: `added N packages`, `aws/lambda/package-lock.json` 생성

설치된 버전을 `package.json`에 고정한다.

Run: `cd aws/lambda && node -e "const v=require('./node_modules/@anthropic-ai/sdk/package.json').version;const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['@anthropic-ai/sdk']='^'+v;fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');console.log(v)"`
Expected: 설치된 버전 번호가 출력되고 `package.json`의 `"latest"`가 `"^<버전>"`으로 바뀐다

- [ ] **Step 2: 저장소 모듈**

<!-- file: aws/lambda/assistant-store.mjs -->
```js
// AI 비서 DynamoDB 접근 — 강의·고객 읽기/쓰기, 대화 읽기/쓰기
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const LECTURES = process.env.LECTURES_TABLE;
const CLIENTS = process.env.CLIENTS_TABLE;
const CONVERSATIONS = process.env.ASSISTANT_TABLE;
const TTL_SECONDS = 7 * 24 * 3600;

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

async function getItem(TableName, id) {
  const out = await ddb.send(new GetCommand({ TableName, Key: { id } }));
  return out.Item ?? null;
}

// 저장 형식은 index.mjs의 CRUD와 같다: id, createdAt, updatedAt
async function createItem(TableName, fields) {
  const now = new Date().toISOString();
  const item = { ...fields, id: randomUUID(), createdAt: now, updatedAt: now };
  await ddb.send(new PutCommand({ TableName, Item: item, ConditionExpression: 'attribute_not_exists(id)' }));
  return item;
}

// 없는 id로 새 항목이 생기지 않도록 attribute_exists 조건을 건다
async function updateItem(TableName, id, fields) {
  const entries = Object.entries({ ...fields, updatedAt: new Date().toISOString() });
  const names = {}, values = {}, sets = [];
  entries.forEach(([key, value], i) => {
    names[`#k${i}`] = key;
    values[`:v${i}`] = value;
    sets.push(`#k${i} = :v${i}`);
  });
  await ddb.send(new UpdateCommand({
    TableName,
    Key: { id },
    UpdateExpression: `SET ${sets.join(', ')}`,
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  }));
}

export const data = {
  listLectures: () => scanAll(LECTURES),
  listClients: () => scanAll(CLIENTS),
  getLecture: (id) => getItem(LECTURES, id),
  getClient: (id) => getItem(CLIENTS, id),
  createLecture: (fields) => createItem(LECTURES, fields),
  updateLecture: (id, fields) => updateItem(LECTURES, id, fields),
  createClient: (fields) => createItem(CLIENTS, fields),
  updateClient: (id, fields) => updateItem(CLIENTS, id, fields),
};

// 대화는 통째로 JSON 문자열로 저장한다(사고 블록 포함, 추가 전용). 7일 뒤 TTL로 삭제된다.
export const store = {
  async get(id) {
    const item = await getItem(CONVERSATIONS, id);
    return item ? JSON.parse(item.convJson) : null;
  },
  async put(conv) {
    await ddb.send(new PutCommand({
      TableName: CONVERSATIONS,
      Item: {
        id: conv.id,
        status: conv.status,
        updatedAt: conv.updatedAt,
        ttl: Math.floor(Date.now() / 1000) + TTL_SECONDS,
        convJson: JSON.stringify(conv),
      },
    }));
  },
};
```

- [ ] **Step 3: 핸들러 (기존 `assistant.mjs` 전체 교체)**

<!-- file: aws/lambda/assistant.mjs -->
```js
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
```

- [ ] **Step 4: 문법과 SDK 로드 확인**

Run: `node --check aws/lambda/assistant.mjs && node --check aws/lambda/assistant-store.mjs && echo SYNTAX_OK`
Expected: `SYNTAX_OK`

Run: `cd aws/lambda && node -e "import('@anthropic-ai/sdk').then(m=>{const c=new m.default({apiKey:'x'});console.log(typeof c.beta.messages.create, typeof m.default.APIError, typeof m.default.RateLimitError)})"`
Expected: `function function function`

Run: `node --test "aws/lambda/test/*.test.mjs"`
Expected: PASS — `# pass 44`, `# fail 0` (기존 테스트가 그대로 통과)

- [ ] **Step 5: `aws/template.yaml` — 대화 테이블 추가**

`AnalyticsTable` 리소스 정의가 끝난 바로 다음, `# ===== Cognito (관리자 1인 전용) =====` 주석 위에 넣는다.

```yaml
  # AI 비서 대화 (7일 뒤 TTL로 자동 삭제)
  AssistantTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub AILab-Assistant-${Stage}
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: id
          AttributeType: S
      KeySchema:
        - AttributeName: id
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

```

- [ ] **Step 6: `aws/template.yaml` — 비서 함수 교체**

`# ===== AI 비서 Lambda =====` 주석부터 `# ===== 방문자 집계 Lambda =====` 주석 직전까지의 `AssistantFunction` 블록 전체를 다음으로 바꾼다.

```yaml
  # ===== AI 비서 Lambda =====
  # 같은 함수가 HTTP 요청(접수·조회)과 비동기 작업(모델 루프)을 모두 처리한다
  AssistantFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub AILab-Assistant-${Stage}
      CodeUri: lambda/
      Handler: assistant.handler
      Timeout: 120
      MemorySize: 512
      Environment:
        Variables:
          LECTURES_TABLE: !Ref LecturesTable
          CLIENTS_TABLE: !Ref ClientsTable
          ASSISTANT_TABLE: !Ref AssistantTable
          MODEL_ID: claude-opus-5-5
          ANTHROPIC_KEY_PARAM: /ailab/anthropic-api-key
      # 작업이 시간 초과로 죽어도 Lambda가 자동으로 다시 실행하지 않게 한다(중복 저장 방지)
      EventInvokeConfig:
        MaximumRetryAttempts: 0
      Policies:
        - DynamoDBCrudPolicy:
            TableName: !Ref LecturesTable
        - DynamoDBCrudPolicy:
            TableName: !Ref ClientsTable
        - DynamoDBCrudPolicy:
            TableName: !Ref AssistantTable
        - Statement:
            - Effect: Allow
              Action: ssm:GetParameter
              Resource: !Sub arn:aws:ssm:${AWS::Region}:${AWS::AccountId}:parameter/ailab/anthropic-api-key
            # 자기 자신을 비동기로 호출한다. !GetAtt를 쓰면 순환 참조가 되므로 이름으로 ARN을 조립한다
            - Effect: Allow
              Action: lambda:InvokeFunction
              Resource: !Sub arn:aws:lambda:${AWS::Region}:${AWS::AccountId}:function:AILab-Assistant-${Stage}
      Events:
        Assistant:
          Type: HttpApi
          Properties:
            ApiId: !Ref Api
            Path: /assistant
            Method: POST
            Auth: { Authorizer: CognitoJwt }
        AssistantStatus:
          Type: HttpApi
          Properties:
            ApiId: !Ref Api
            Path: /assistant/{id}
            Method: GET
            Auth: { Authorizer: CognitoJwt }

```

- [ ] **Step 7: `aws/DEPLOY.md` — 설치 단계 추가**

`## 1. 인프라 배포` 코드 블록에서 `# 패키징 & 배포` 줄과 그다음 `cd aws` 줄을 다음으로 바꾼다.

```bash
# Lambda 의존성 설치 (@anthropic-ai/sdk — AI 비서가 사용)
cd aws/lambda && npm ci --omit=dev && cd ../..

# 패키징 & 배포 (한글 주석 때문에 AWS_CLI_FILE_ENCODING=UTF-8 필요)
cd aws
```

- [ ] **Step 8: 템플릿 구조 확인**

Run: `node -e "const s=require('fs').readFileSync('aws/template.yaml','utf8');for(const k of ['AssistantTable:','ASSISTANT_TABLE: !Ref AssistantTable','MODEL_ID: claude-opus-5-5','Path: /assistant/{id}','MaximumRetryAttempts: 0','lambda:InvokeFunction','TimeToLiveSpecification:'])console.log(s.includes(k)?'OK  ':'MISS',k);console.log(s.includes('claude-sonnet-5')?'MISS 옛 모델 ID가 남아 있음':'OK   옛 모델 ID 없음')"`
Expected: 8줄 모두 `OK`

- [ ] **Step 9: 커밋**

```bash
git add aws/lambda/assistant.mjs aws/lambda/assistant-store.mjs aws/lambda/package.json aws/lambda/package-lock.json aws/template.yaml aws/.gitignore aws/DEPLOY.md
git commit -m "feat(assistant): Opus 5.5 도구 루프로 Lambda 교체, 대화 테이블·상태 조회 경로 추가"
```

---

### Task 6: 답변 서식 변환

**Files:**
- Create: `js/assistant-markdown.js`
- Test: `js/test/assistant-markdown.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 브라우저에서는 `window.AilabMarkdown.render(text: string): string`(HTML), Node에서는 `require('../assistant-markdown.js').render`. 입력을 먼저 이스케이프하므로 결과 HTML에 사용자·모델이 쓴 태그가 살아남지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**

<!-- file: js/test/assistant-markdown.test.mjs -->
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { render } = createRequire(import.meta.url)('../assistant-markdown.js');

test('문단과 줄바꿈', () => {
  assert.equal(render('첫 줄\n둘째 줄\n\n다음 문단'), '<p>첫 줄<br>둘째 줄</p><p>다음 문단</p>');
  assert.equal(render(''), '');
  assert.equal(render(null), '');
});

test('HTML은 이스케이프한다', () => {
  assert.equal(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(render('| a<b> |\n|---|\n| "x" |'), '<table><thead><tr><th>a&lt;b&gt;</th></tr></thead><tbody><tr><td>&quot;x&quot;</td></tr></tbody></table>');
});

test('굵게와 코드', () => {
  assert.equal(render('**합계** 는 `sum_fee`'), '<p><strong>합계</strong> 는 <code>sum_fee</code></p>');
});

test('제목은 패널 크기에 맞게 h3부터', () => {
  assert.equal(render('# 큰 제목\n## 중간\n### 작은'), '<h3>큰 제목</h3><h4>중간</h4><h5>작은</h5>');
});

test('글머리표 목록과 번호 목록', () => {
  assert.equal(render('- 하나\n- **둘**\n\n1. 첫째\n2. 둘째'), '<ul><li>하나</li><li><strong>둘</strong></li></ul><ol><li>첫째</li><li>둘째</li></ol>');
});

test('표', () => {
  const md = '| 월 | 건수 | 강의료 |\n|---|---:|---:|\n| 2026-10 | 2 | 5,000,000 |\n| 2026-11 | 1 | 1,000,000 |';
  assert.equal(render(md),
    '<table><thead><tr><th>월</th><th>건수</th><th>강의료</th></tr></thead><tbody>'
    + '<tr><td>2026-10</td><td>2</td><td>5,000,000</td></tr>'
    + '<tr><td>2026-11</td><td>1</td><td>1,000,000</td></tr></tbody></table>');
});

test('구분선과 코드 블록', () => {
  assert.equal(render('위\n\n---\n\n아래'), '<p>위</p><hr><p>아래</p>');
  assert.equal(render('```\n제목: <안내>\n**그대로**\n```'), '<pre><code>제목: &lt;안내&gt;\n**그대로**</code></pre>');
});

test('표 모양이 아닌 세로선은 문단으로 둔다', () => {
  assert.equal(render('A | B'), '<p>A | B</p>');
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "js/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '../assistant-markdown.js'`

- [ ] **Step 3: 구현**

<!-- file: js/assistant-markdown.js -->
```js
/* AI 비서 답변용 가벼운 마크다운 변환.
 * 원문을 먼저 이스케이프한 뒤 변환하므로, 답변에 든 HTML 태그는 글자로만 보인다.
 * 브라우저: window.AilabMarkdown.render(text) / Node 테스트: require(...).render
 */
(function (root) {
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function inline(s) {
    return s.replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function cells(line) {
    return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(function (c) { return c.trim(); });
  }

  var RE_ROW = /^\s*\|.*\|\s*$/;
  var RE_SEP = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
  var RE_UL = /^\s*[-*•]\s+/;
  var RE_OL = /^\s*\d+[.)]\s+/;
  var RE_HR = /^\s*(-{3,}|\*{3,})\s*$/;
  var RE_FENCE = /^\s*```/;

  function render(text) {
    var lines = esc(text == null ? '' : text).split('\n');
    var html = '';
    var para = [];
    var i = 0;

    function flush() {
      if (para.length) {
        html += '<p>' + inline(para.join('<br>')) + '</p>';
        para = [];
      }
    }

    function list(tag, re) {
      flush();
      html += '<' + tag + '>';
      while (i < lines.length && re.test(lines[i])) {
        html += '<li>' + inline(lines[i].replace(re, '')) + '</li>';
        i++;
      }
      html += '</' + tag + '>';
    }

    while (i < lines.length) {
      var line = lines[i];

      if (RE_FENCE.test(line)) {
        flush();
        var code = [];
        i++;
        while (i < lines.length && !RE_FENCE.test(lines[i])) { code.push(lines[i]); i++; }
        i++; // 닫는 ```
        html += '<pre><code>' + code.join('\n') + '</code></pre>';
        continue;
      }

      var heading = line.match(/^(#{1,4})\s+(.*)$/);
      if (heading) {
        flush();
        var level = Math.min(heading[1].length + 2, 6);
        html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      if (RE_ROW.test(line) && i + 1 < lines.length && RE_SEP.test(lines[i + 1])) {
        flush();
        html += '<table><thead><tr>' + cells(line).map(function (c) { return '<th>' + inline(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
        i += 2;
        while (i < lines.length && RE_ROW.test(lines[i])) {
          html += '<tr>' + cells(lines[i]).map(function (c) { return '<td>' + inline(c) + '</td>'; }).join('') + '</tr>';
          i++;
        }
        html += '</tbody></table>';
        continue;
      }

      if (RE_HR.test(line)) { flush(); html += '<hr>'; i++; continue; }
      if (RE_UL.test(line)) { list('ul', RE_UL); continue; }
      if (RE_OL.test(line)) { list('ol', RE_OL); continue; }
      if (!line.trim()) { flush(); i++; continue; }

      para.push(line);
      i++;
    }
    flush();
    return html;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { render: render };
  else root.AilabMarkdown = { render: render };
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "js/test/*.test.mjs"`
Expected: PASS — `# pass 8`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/assistant-markdown.js js/test/assistant-markdown.test.mjs
git commit -m "feat(assistant): 답변 서식 변환(제목·목록·표·코드)"
```

---

### Task 7: 패널 UI와 페이지 연결

**Files:**
- Modify (전체 교체): `js/assistant-panel.js`
- Modify: `lectures.html` (스크립트 태그, 이벤트 수신), `crm/index.html` (스크립트 태그, 이벤트 수신)

**Interfaces:**
- Consumes (Task 6): `window.AilabMarkdown.render(text)`; (Task 4·5): `POST /assistant`, `GET /assistant/{id}`의 요청·응답 형식
- Produces: `window`에 `ailab:data-changed` 이벤트(`detail: { table: 'lectures' | 'clients' }`). 대화 id는 `sessionStorage['ailab_assistant_conversation']`.

- [ ] **Step 1: 패널 교체**

<!-- file: js/assistant-panel.js -->
```js
/* AI 비서 패널 — lectures.html / crm 공용
 * 사용: <script src="/js/assistant-markdown.js" defer></script>
 *       <script src="/js/assistant-panel.js" defer></script>
 * 전제: 페이지가 localStorage 'ailab_tokens'에 Cognito 토큰 저장 (lectures.html 로그인과 공유)
 * 서버가 대화를 보관하고(7일), 패널은 대화 id만 sessionStorage에 둔다.
 */
(function () {
  const API_URL = 'https://tnibst6km5.execute-api.ap-northeast-2.amazonaws.com/prod';
  const COGNITO_URL = 'https://cognito-idp.ap-northeast-2.amazonaws.com/';
  const CLIENT_ID = '7dpeoqp3n1870th6u6qbsj09mu';
  const TOKEN_KEY = 'ailab_tokens';
  const CONV_KEY = 'ailab_assistant_conversation';
  const WIDE_KEY = 'ailab_assistant_wide';
  const POLL_MS = 1500;

  const OUTCOME = { done: '완료', declined: '취소함', failed: '실패' };

  let conversationId = sessionStorage.getItem(CONV_KEY) || null;
  let pollTimer = null;
  let busy = false;
  let loaded = false;                 // 저장된 대화를 한 번 불러왔는지
  const announced = new Set();        // 이미 페이지에 알린 변경(toolUseId)
  let primed = false;                 // 첫 스냅숏의 완료 변경은 알리지 않는다(예전 것)

  /* ── 토큰 (lectures.html과 동일 로직) ── */
  function loadTokens() { try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch (e) { return null; } }
  function saveTokens(t) { localStorage.setItem(TOKEN_KEY, JSON.stringify(t)); }
  function parseJwt(t) {
    try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); }
    catch (e) { return {}; }
  }
  async function refreshTokens() {
    const t = loadTokens();
    if (!t || !t.refreshToken) return false;
    try {
      const res = await fetch(COGNITO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth' },
        body: JSON.stringify({ AuthFlow: 'REFRESH_TOKEN_AUTH', ClientId: CLIENT_ID, AuthParameters: { REFRESH_TOKEN: t.refreshToken } }),
      });
      const data = await res.json();
      if (!res.ok) throw data;
      const idToken = data.AuthenticationResult.IdToken;
      saveTokens({ idToken: idToken, refreshToken: t.refreshToken, exp: parseJwt(idToken).exp });
      return true;
    } catch (e) { return false; }
  }
  async function getToken() {
    let t = loadTokens();
    if (!t) return null;
    if (t.exp && t.exp * 1000 < Date.now() + 60000) {
      if (!await refreshTokens()) return null;
      t = loadTokens();
    }
    return t.idToken;
  }

  /* ── API ── */
  async function api(path, body, retried) {
    const token = await getToken();
    if (!token) throw new Error('로그인 후 사용할 수 있습니다.');
    const res = await fetch(API_URL + path, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && !retried && await refreshTokens()) return api(path, body, true);
    let data = {};
    try { data = await res.json(); } catch (e) { /* 본문 없음 */ }
    if (!res.ok) {
      const err = new Error(data.error || data.message || ('API 오류 ' + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ── 스타일 ── */
  const style = document.createElement('style');
  style.textContent = `
    .aip-fab{position:fixed;right:22px;bottom:22px;z-index:9000;width:56px;height:56px;border-radius:50%;
      border:none;cursor:pointer;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;
      box-shadow:0 8px 24px rgba(99,102,241,.45);font-size:22px;display:flex;align-items:center;justify-content:center;
      transition:transform .2s ease;}
    .aip-fab:hover{transform:scale(1.08);}
    .aip-panel{position:fixed;right:22px;bottom:90px;z-index:9001;width:min(420px,calc(100vw - 44px));
      height:min(600px,calc(100vh - 130px));display:none;flex-direction:column;border-radius:16px;overflow:hidden;
      background:rgba(17,20,38,.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px rgba(0,0,0,.5);
      font-family:'Pretendard',-apple-system,sans-serif;color:#e2e8f0;}
    .aip-panel.open{display:flex;}
    .aip-panel.wide{width:min(820px,calc(100vw - 44px));height:calc(100vh - 130px);}
    .aip-head{padding:12px 14px 12px 18px;background:rgba(99,102,241,.15);border-bottom:1px solid rgba(255,255,255,.08);
      display:flex;justify-content:space-between;align-items:center;gap:8px;}
    .aip-head b{font-size:15px;}
    .aip-head small{display:block;font-weight:400;font-size:11.5px;color:#94a3b8;margin-top:1px;}
    .aip-tools{display:flex;gap:2px;flex-shrink:0;}
    .aip-tools button{background:none;border:none;color:#94a3b8;font-size:12px;cursor:pointer;padding:6px 8px;border-radius:8px;font-family:inherit;}
    .aip-tools button:hover{background:rgba(255,255,255,.08);color:#fff;}
    .aip-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
    .aip-msg{max-width:92%;padding:10px 14px;border-radius:12px;font-size:13.5px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere;}
    .aip-msg.user{align-self:flex-end;background:#6366f1;color:#fff;border-bottom-right-radius:4px;}
    .aip-msg.ai{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px;}
    .aip-msg.ai p{margin:0 0 6px;} .aip-msg.ai p:last-child{margin:0;}
    .aip-msg.ai ul,.aip-msg.ai ol{margin:4px 0 6px 20px;} .aip-msg.ai li{margin-bottom:3px;}
    .aip-msg.ai h3,.aip-msg.ai h4,.aip-msg.ai h5,.aip-msg.ai h6{margin:10px 0 4px;font-size:14px;color:#fff;}
    .aip-msg.ai h3:first-child,.aip-msg.ai h4:first-child,.aip-msg.ai h5:first-child{margin-top:0;}
    .aip-msg.ai code{background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:12.5px;}
    .aip-msg.ai pre{margin:6px 0;padding:10px;border-radius:8px;background:rgba(0,0,0,.3);overflow-x:auto;white-space:pre-wrap;}
    .aip-msg.ai pre code{background:none;padding:0;}
    .aip-msg.ai hr{border:none;border-top:1px solid rgba(255,255,255,.12);margin:8px 0;}
    .aip-tablewrap{overflow-x:auto;margin:6px 0;}
    .aip-msg.ai table{border-collapse:collapse;font-size:12.5px;white-space:nowrap;}
    .aip-msg.ai th,.aip-msg.ai td{padding:5px 9px;border:1px solid rgba(255,255,255,.12);text-align:left;}
    .aip-msg.ai th{background:rgba(255,255,255,.08);font-weight:600;}
    .aip-copy{display:block;margin-top:8px;background:none;border:none;color:#94a3b8;font-size:11.5px;cursor:pointer;padding:0;font-family:inherit;}
    .aip-copy:hover{color:#fff;}
    .aip-msg.err{align-self:flex-start;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;}
    .aip-msg.err button{display:block;margin-top:8px;padding:5px 12px;border-radius:8px;border:1px solid rgba(252,165,165,.5);
      background:none;color:#fca5a5;cursor:pointer;font-size:12px;font-family:inherit;}
    .aip-note{align-self:center;font-size:12px;color:#94a3b8;text-align:center;padding:2px 8px;}
    .aip-act{align-self:flex-start;font-size:12.5px;padding:6px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.14);color:#cbd5e1;}
    .aip-act.done{border-color:rgba(16,185,129,.5);color:#6ee7b7;}
    .aip-act.failed{border-color:rgba(239,68,68,.5);color:#fca5a5;}
    .aip-progress{align-self:flex-start;color:#94a3b8;font-size:12.5px;padding:4px 8px;line-height:1.7;}
    .aip-progress .now::after{content:'…';}
    .aip-card{align-self:stretch;border:1px solid rgba(129,140,248,.5);background:rgba(99,102,241,.1);border-radius:12px;padding:12px 14px;font-size:13px;}
    .aip-card-title{font-weight:600;color:#fff;margin-bottom:8px;display:flex;gap:8px;align-items:flex-start;}
    .aip-card-title input{margin-top:3px;accent-color:#6366f1;}
    .aip-card table{width:100%;border-collapse:collapse;}
    .aip-card td{padding:4px 0;vertical-align:top;line-height:1.5;}
    .aip-card td:first-child{color:#94a3b8;width:84px;white-space:nowrap;}
    .aip-card .before{color:#94a3b8;text-decoration:line-through;margin-right:4px;}
    .aip-confirm{align-self:stretch;display:flex;gap:8px;justify-content:flex-end;}
    .aip-confirm button{padding:8px 16px;border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;border:1px solid rgba(255,255,255,.2);background:none;color:#e2e8f0;}
    .aip-confirm .go{background:#6366f1;border-color:#6366f1;color:#fff;font-weight:600;}
    .aip-confirm button:disabled{opacity:.5;cursor:default;}
    .aip-suggest{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;}
    .aip-suggest button{font-size:11.5px;padding:5px 10px;border-radius:99px;cursor:pointer;font-family:inherit;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#cbd5e1;}
    .aip-suggest button:hover{border-color:#818cf8;color:#fff;}
    .aip-input{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.08);}
    .aip-input textarea{flex:1;resize:none;height:44px;padding:11px 12px;border-radius:10px;font-size:13.5px;
      background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:#e2e8f0;font-family:inherit;}
    .aip-input textarea:focus{outline:2px solid #6366f1;}
    .aip-send{width:44px;height:44px;border-radius:10px;border:none;cursor:pointer;flex-shrink:0;
      background:#6366f1;color:#fff;font-size:16px;}
    .aip-send:disabled{opacity:.5;cursor:default;}
  `;
  document.head.appendChild(style);

  /* ── 뼈대 ── */
  const fab = document.createElement('button');
  fab.className = 'aip-fab';
  fab.setAttribute('aria-label', 'AI 비서 열기');
  fab.textContent = '✦';

  const panel = document.createElement('div');
  panel.className = 'aip-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'AI 비서');
  panel.innerHTML = `
    <div class="aip-head">
      <div><b>AI 비서</b><small>강의 이력·고객 데이터 조회와 등록·수정</small></div>
      <div class="aip-tools">
        <button type="button" class="aip-new">새 대화</button>
        <button type="button" class="aip-wide" aria-pressed="false">넓게</button>
        <button type="button" class="aip-close" aria-label="닫기">✕</button>
      </div>
    </div>
    <div class="aip-msgs" aria-live="polite"></div>
    <div class="aip-suggest">
      <button type="button">이번 달 강의 실적 요약해줘</button>
      <button type="button">입금 대기 중인 강의료 합계는?</button>
      <button type="button">팔로업 기한 지난 고객사 알려줘</button>
    </div>
    <div class="aip-input">
      <textarea placeholder="무엇이든 물어보거나 시켜보세요… (Enter 전송)" rows="1" aria-label="질문 입력"></textarea>
      <button type="button" class="aip-send" aria-label="전송">➤</button>
    </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const msgsEl = panel.querySelector('.aip-msgs');
  const inputEl = panel.querySelector('textarea');
  const sendBtn = panel.querySelector('.aip-send');
  const suggestEl = panel.querySelector('.aip-suggest');
  const wideBtn = panel.querySelector('.aip-wide');

  /* ── 그리기 ── */
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }

  function add(cls, html) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    msgsEl.appendChild(el);
    return el;
  }

  function addAnswer(text) {
    const el = add('aip-msg ai', window.AilabMarkdown.render(text));
    el.querySelectorAll('table').forEach((table) => {
      const wrap = document.createElement('div');
      wrap.className = 'aip-tablewrap';
      table.replaceWith(wrap);
      wrap.appendChild(table);
    });
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'aip-copy';
    copy.textContent = '복사';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text); copy.textContent = '복사됨'; }
      catch (e) { copy.textContent = '복사 실패'; }
      setTimeout(() => { copy.textContent = '복사'; }, 1500);
    });
    el.appendChild(copy);
  }

  function addError(message, onRetry) {
    const el = add('aip-msg err', esc(message));
    if (onRetry) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '다시 시도';
      btn.addEventListener('click', onRetry);
      el.appendChild(btn);
    }
  }

  function addProgress(events) {
    const steps = events.length ? events : ['생각 중'];
    add('aip-progress', steps.map((e, i) => `<div class="${i === steps.length - 1 ? 'now' : ''}">${esc(e)}</div>`).join(''));
  }

  function addPending(pending) {
    const many = pending.length > 1;
    pending.forEach((p) => {
      const rows = p.rows.map((r) => `<tr><td>${esc(r.label)}</td><td>${
        r.before !== undefined ? `<span class="before">${esc(r.before)}</span>→ ` : ''}${esc(r.after)}</td></tr>`).join('');
      add('aip-card', `<div class="aip-card-title">${
        many ? `<input type="checkbox" checked data-id="${esc(p.toolUseId)}" aria-label="이 변경 실행">` : ''
      }<span>${esc(p.title)}</span></div><table>${rows}</table>`);
    });
    const bar = add('aip-confirm', `<button type="button" class="no">${many ? '모두 취소' : '취소'}</button>
      <button type="button" class="go">${many ? '선택한 것 실행' : '실행'}</button>`);
    const decide = (approveChecked) => {
      bar.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      const decisions = pending.map((p) => {
        const box = many ? msgsEl.querySelector(`input[data-id="${CSS.escape(p.toolUseId)}"]`) : null;
        return { toolUseId: p.toolUseId, approved: approveChecked && (box ? box.checked : true) };
      });
      post({ conversationId, decisions });
    };
    bar.querySelector('.go').addEventListener('click', () => decide(true));
    bar.querySelector('.no').addEventListener('click', () => decide(false));
  }

  function greet() {
    add('aip-msg ai', window.AilabMarkdown.render(
      '안녕하세요, 소장님. 강의 이력과 고객 데이터를 조회하고, 등록·수정도 도와드립니다.\n데이터를 바꿀 때는 먼저 확인 카드를 보여드립니다.'));
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
  }

  function render(snap) {
    msgsEl.innerHTML = '';
    if (!snap.view.length) greet();
    for (const v of snap.view) {
      if (v.role === 'user') add('aip-msg user', esc(v.text).replace(/\n/g, '<br>'));
      else if (v.role === 'assistant') addAnswer(v.text);
      else if (v.role === 'action') add('aip-act ' + v.outcome, `${esc(v.title)} — ${OUTCOME[v.outcome] || esc(v.outcome)}`);
      else if (v.role === 'notice') add('aip-note', esc(v.text));
    }
    if (snap.status === 'running') addProgress(snap.events || []);
    if (snap.status === 'needs_confirmation') addPending(snap.pending || []);
    if (snap.status === 'error') addError(snap.error || '오류가 발생했습니다.', () => post({ conversationId, retry: true }));
    suggestEl.style.display = snap.view.length ? 'none' : 'flex';
    setBusy(snap.status === 'running');
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // 비서가 데이터를 바꿨으면 페이지에 알려 목록을 다시 불러오게 한다
  function announce(snap) {
    for (const v of snap.view) {
      if (v.role !== 'action' || v.outcome !== 'done' || announced.has(v.toolUseId)) continue;
      announced.add(v.toolUseId);
      if (primed) window.dispatchEvent(new CustomEvent('ailab:data-changed', { detail: { table: v.table } }));
    }
    primed = true;
  }

  /* ── 대화 ── */
  function setConversation(id) {
    conversationId = id;
    if (id) sessionStorage.setItem(CONV_KEY, id);
    else sessionStorage.removeItem(CONV_KEY);
  }

  function resetConversation() {
    clearTimeout(pollTimer);
    setConversation(null);
    announced.clear();
    primed = true;
    render({ status: 'idle', view: [], events: [], pending: [] });
  }

  async function refresh() {
    clearTimeout(pollTimer);
    if (!conversationId) return;
    let snap;
    try {
      snap = await api('/assistant/' + encodeURIComponent(conversationId));
    } catch (err) {
      if (err.status === 404) { resetConversation(); return; }
      addError(err.message, refresh);
      setBusy(false);
      return;
    }
    render(snap);
    announce(snap);
    if (snap.status === 'running') pollTimer = setTimeout(refresh, POLL_MS);
  }

  async function post(body, isRetryAfter404) {
    setBusy(true);
    try {
      const out = await api('/assistant', body);
      setConversation(out.conversationId);
      await refresh();
    } catch (err) {
      // 보관 기간이 지난 대화면 새 대화로 한 번 다시 보낸다
      if (err.status === 404 && body.text && !isRetryAfter404) {
        setConversation(null);
        announced.clear();
        return post({ text: body.text }, true);
      }
      setBusy(false);
      addError(err.message, () => post(body));
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  function send(textOverride) {
    const text = (typeof textOverride === 'string' ? textOverride : inputEl.value).trim();
    if (!text || busy) return;
    inputEl.value = '';
    suggestEl.style.display = 'none';
    msgsEl.querySelectorAll('.aip-card, .aip-confirm').forEach((el) => el.remove());
    add('aip-msg user', esc(text).replace(/\n/g, '<br>'));
    addProgress([]);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    post(conversationId ? { conversationId, text } : { text });
  }

  /* ── 이벤트 ── */
  function setWide(on) {
    panel.classList.toggle('wide', on);
    wideBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    wideBtn.textContent = on ? '좁게' : '넓게';
    try { localStorage.setItem(WIDE_KEY, on ? '1' : ''); } catch (e) { /* 저장 불가 */ }
  }
  setWide(localStorage.getItem(WIDE_KEY) === '1');

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (!panel.classList.contains('open')) return;
    if (!loaded) {
      loaded = true;
      if (conversationId) refresh();
      else { primed = true; render({ status: 'idle', view: [], events: [], pending: [] }); }
    }
    inputEl.focus();
  });
  panel.querySelector('.aip-close').addEventListener('click', () => panel.classList.remove('open'));
  panel.querySelector('.aip-new').addEventListener('click', resetConversation);
  wideBtn.addEventListener('click', () => setWide(!panel.classList.contains('wide')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open') && panel.contains(document.activeElement)) panel.classList.remove('open');
  });

  suggestEl.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') send(e.target.textContent);
  });
  sendBtn.addEventListener('click', () => send());
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
})();
```

- [ ] **Step 2: `lectures.html` 연결**

파일 끝의 스크립트 태그를 바꾼다.

이전:
```html
    <!-- AI 비서 패널 -->
    <script src="js/assistant-panel.js" defer></script>
```
이후:
```html
    <!-- AI 비서 패널 -->
    <script src="js/assistant-markdown.js" defer></script>
    <script src="js/assistant-panel.js" defer></script>
```

`// ================ 모바일 헤더 메뉴 ================` 주석 바로 위에 추가한다.

```js
        // AI 비서가 강의 데이터를 바꾸면 목록을 다시 불러온다
        window.addEventListener('ailab:data-changed', function(e) {
            if (e.detail && e.detail.table === 'lectures') loadLectures();
        });

```

- [ ] **Step 3: `crm/index.html` 연결**

파일 끝의 스크립트 태그를 바꾼다.

이전:
```html
<!-- AI 비서 패널 -->
<script src="/js/assistant-panel.js" defer></script>
```
이후:
```html
<!-- AI 비서 패널 -->
<script src="/js/assistant-markdown.js" defer></script>
<script src="/js/assistant-panel.js" defer></script>
```

`function lectureCountFor(name) {` 줄 바로 위에 추가한다(`boot` 함수 다음).

```js
  // AI 비서가 강의·고객 데이터를 바꾸면 다시 불러온다
  window.addEventListener('ailab:data-changed', () => { boot(); });

```

- [ ] **Step 4: 화면 검증 스크립트 작성(저장소 밖 임시 폴더)**

`puppeteer-core`가 설치된 임시 폴더에 `panel-check.mjs`로 저장한다. API를 가로채 서버 없이 패널 흐름을 확인한다.

```js
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2];                      // 저장소 루트의 절대 경로
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const tokens = { idToken: `${b64({ alg: 'none' })}.${b64({ email: 'admin@example.com', exp })}.x`, refreshToken: 'fake', exp };
const lectures = [{ id: 'L1', date: '2026-11-03', name: 'AI 리터러시', client: '가나전자', fee: 1000000, taxDeduction: 'none', paymentStatus: 'pending' }];

// 가짜 서버: 질문 → 진행 1회 → 확인 대기 → 승인 → 완료
const TABLE = '| 월 | 건수 |\n|---|---:|\n| 2026-10 | 2 |\n| 2026-11 | 1 |';
let step = 0, posts = [], lectureLoads = 0;
const user = { role: 'user', text: '11월 3일 강의 입금 완료로 바꾸고 월별 건수 알려줘' };
const card = { toolUseId: 'w1', name: 'update_lecture', title: '강의 수정 · 2026-11-03 가나전자 · AI 리터러시', rows: [{ label: '입금 여부', before: '대기', after: '완료' }] };
const snaps = [
  { status: 'running', view: [user], events: ['강의 조회 중'], pending: [] },
  { status: 'needs_confirmation', view: [user, { role: 'assistant', text: '입금 완료로 바꾸겠습니다.' }], events: ['강의 조회 중', '강의 수정 준비 중'], pending: [card] },
  { status: 'running', view: [user, { role: 'assistant', text: '입금 완료로 바꾸겠습니다.' }], events: [], pending: [] },
  { status: 'idle', view: [user, { role: 'assistant', text: '입금 완료로 바꾸겠습니다.' }, { role: 'action', toolUseId: 'w1', title: card.title, table: 'lectures', outcome: 'done' }, { role: 'assistant', text: '## 결과\n**입금 완료**로 바꿨습니다.\n\n' + TABLE + '\n\n<img src=x onerror=alert(1)>' }], events: [], pending: [] },
];

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', async (d) => { errors.push('dialog: ' + d.message()); await d.dismiss(); });
await page.setRequestInterception(true);
page.on('request', (r) => {
  const u = r.url();
  const json = (status, o) => r.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
  if (u.includes('execute-api') && r.method() === 'OPTIONS') return r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (u.endsWith('/prod/lectures')) { lectureLoads++; return json(200, { items: lectures }); }
  if (u.endsWith('/prod/assistant') && r.method() === 'POST') { const body = JSON.parse(r.postData()); posts.push(body); if (body.decisions) step = 2; return json(202, { conversationId: 'conv-1' }); }
  if (u.includes('/prod/assistant/')) { const snap = snaps[step]; if (step === 0 || step === 2) step++; return json(200, snap); }
  if (u.includes('execute-api') || u.includes('cognito-idp')) return r.abort();
  r.continue();
});
await page.evaluateOnNewDocument((t) => localStorage.setItem('ailab_tokens', JSON.stringify(t)), tokens);
await page.goto(pathToFileURL(ROOT + '/lectures.html').href, { waitUntil: 'load' });
await new Promise((r) => setTimeout(r, 1500));
const loadsBefore = lectureLoads;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, ok) => console.log(ok ? 'OK  ' : 'FAIL', name);

await page.click('.aip-fab');
check('열면 인사말과 추천 질문이 보인다', await page.evaluate(() => !!document.querySelector('.aip-msg.ai') && getComputedStyle(document.querySelector('.aip-suggest')).display !== 'none'));
await page.type('.aip-input textarea', user.text);
await page.keyboard.press('Enter');
await wait(600);
check('진행 단계가 보인다', await page.evaluate(() => (document.querySelector('.aip-progress') || {}).textContent === '강의 조회 중'));
await wait(2000);
check('확인 카드에 이전 → 이후가 보인다', await page.evaluate(() => { const c = document.querySelector('.aip-card'); return !!c && c.textContent.includes('입금 여부') && c.querySelector('.before').textContent === '대기' && c.textContent.includes('완료'); }));
check('승인 전에는 목록을 다시 불러오지 않는다', lectureLoads === loadsBefore);
await page.click('.aip-confirm .go');
await wait(2500);
check('승인 요청이 전송됐다', JSON.stringify(posts.at(-1)) === JSON.stringify({ conversationId: 'conv-1', decisions: [{ toolUseId: 'w1', approved: true }] }));
check('완료 표시가 보인다', await page.evaluate(() => (document.querySelector('.aip-act.done') || {}).textContent.includes('완료')));
check('표·제목·굵게가 서식으로 보인다', await page.evaluate(() => { const a = [...document.querySelectorAll('.aip-msg.ai')].at(-1); return !!a.querySelector('table td') && !!a.querySelector('h4') && !!a.querySelector('strong') && !!a.querySelector('.aip-tablewrap'); }));
check('답변 속 HTML은 실행되지 않는다', await page.evaluate(() => !document.querySelector('.aip-msg img')) && !errors.some((e) => e.startsWith('dialog')));
check('변경 후 강의 목록을 다시 불러왔다', lectureLoads === loadsBefore + 1);
check('대화 id를 sessionStorage에 저장했다', await page.evaluate(() => sessionStorage.getItem('ailab_assistant_conversation') === 'conv-1'));
await page.click('.aip-new');
check('새 대화는 화면과 저장된 id를 비운다', await page.evaluate(() => sessionStorage.getItem('ailab_assistant_conversation') === null && document.querySelectorAll('.aip-msg.user').length === 0));
check('콘솔 오류 없음', errors.length === 0);
if (errors.length) console.log(errors);
await page.screenshot({ path: 'panel-check.jpg', type: 'jpeg', quality: 70 });
await browser.close();
```

- [ ] **Step 5: 화면 검증 실행**

Run: `node panel-check.mjs "<저장소 루트 절대 경로>"`
Expected: 12줄 모두 `OK`

`panel-check.jpg`를 열어 패널이 깨지지 않았는지 눈으로 확인한다.

- [ ] **Step 6: 전체 테스트와 커밋**

Run: `node --test "aws/lambda/test/*.test.mjs" && node --test "js/test/*.test.mjs"`
Expected: 두 번 모두 `# fail 0`

```bash
git add js/assistant-panel.js lectures.html crm/index.html
git commit -m "feat(assistant): 패널 재작성(진행 표시·확인 카드·서식·대화 유지)"
```

---

### Task 8: 배포와 실제 확인

**Files:** 없음(배포와 확인만)

**Interfaces:**
- Consumes: Task 1~7의 커밋 전체
- Produces: 배포된 스택과 사이트

이 태스크는 사용자가 "배포해줘"라고 지시한 뒤에만 진행한다. 실제 모델 호출은 비용이 발생한다.

- [ ] **Step 1: Lambda 의존성 설치(배포용)**

Run: `cd aws/lambda && npm ci --omit=dev --no-audit --no-fund`
Expected: `added N packages`

- [ ] **Step 2: 패키징과 변경 세트 확인**

```bash
cd aws
export AWS_CLI_FILE_ENCODING=UTF-8 AWS_DEFAULT_REGION=ap-northeast-2
ACC=$(aws sts get-caller-identity --query Account --output text)
aws cloudformation package --template-file template.yaml --s3-bucket "ailab-cfn-artifacts-$ACC" --output-template-file packaged.yaml
aws cloudformation deploy --template-file packaged.yaml --stack-name ailab-api-prod --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --no-execute-changeset
```

마지막 명령이 출력한 변경 세트를 조회한다.

```bash
CS=$(aws cloudformation list-change-sets --stack-name ailab-api-prod --query "Summaries[?Status=='CREATE_COMPLETE'] | sort_by(@,&CreationTime)[-1].ChangeSetName" --output text)
aws cloudformation describe-change-set --stack-name ailab-api-prod --change-set-name "$CS" --query "Changes[].ResourceChange.{action:Action,id:LogicalResourceId,type:ResourceType,replace:Replacement}" --output table
```

Expected: `AssistantTable` Add, 비서 관련 경로·권한·역할 Add/Modify, Lambda 3개 Modify. `LecturesTable`·`ClientsTable`·`AdminUserPool`에 `Replacement: True`가 있으면 **중단하고 사용자에게 알린다.**

- [ ] **Step 3: 변경 세트 실행**

```bash
aws cloudformation execute-change-set --stack-name ailab-api-prod --change-set-name "$CS"
aws cloudformation wait stack-update-complete --stack-name ailab-api-prod
aws cloudformation describe-stacks --stack-name ailab-api-prod --query "Stacks[0].StackStatus" --output text
```

Expected: `UPDATE_COMPLETE`

- [ ] **Step 4: 배포 후 확인(로그인 없이 가능한 것)**

```bash
API=https://tnibst6km5.execute-api.ap-northeast-2.amazonaws.com/prod
curl -s -o /dev/null -w '%{http_code}\n' -X POST -d '{"text":"hi"}' $API/assistant
curl -s -o /dev/null -w '%{http_code}\n' $API/assistant/abc
curl -s $API/public/lectures | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).items.length>0?'lectures OK':'lectures EMPTY'))"
aws lambda get-function-configuration --function-name AILab-Assistant-prod --query "{timeout:Timeout,model:Environment.Variables.MODEL_ID,table:Environment.Variables.ASSISTANT_TABLE}" --output json
```

Expected: `401`, `401`, `lectures OK`, `{"timeout": 120, "model": "claude-opus-5-5", "table": "AILab-Assistant-prod"}`

- [ ] **Step 5: 사이트 배포**

```bash
git push origin main
```

배포본에 새 패널이 올라왔는지 확인한다.

Run: `curl -s "https://leadership.ai.kr/js/assistant-panel.js?cb=$RANDOM" | grep -c "ailab_assistant_conversation"`
Expected: `1` 이상 (보통 push 후 1분 안)

- [ ] **Step 6: 실제 모델 호출 확인**

실제 로그인이 필요하다. 사용자에게 다음 중 하나를 요청한다.

- 사용자가 직접 `https://leadership.ai.kr/lectures.html`에서 패널을 열어 아래 세 가지를 해본다.
- 또는 사용자가 허락하면 일회용 Cognito 테스트 계정을 만들어 확인하고 삭제한다.

확인할 것:

1. "올해 월별 강의 건수와 강의료 합계 알려줘" → 진행 단계가 보이고, 표의 합계가 강의 이력 화면 하단 합계와 일치한다.
2. "테스트 고객사 '검증용회사'를 잠재고객으로 등록해줘" → 확인 카드가 뜨고, [취소]를 누르면 CRM에 생기지 않는다.
3. 같은 요청을 다시 해서 [실행] → CRM 목록에 나타난다. 확인 뒤 CRM 화면에서 직접 삭제한다.

CloudWatch 로그에서 단계별 `usage`가 남는지 확인한다.

```bash
aws logs tail /aws/lambda/AILab-Assistant-prod --since 15m --format short | grep '"usage"' | tail -5
```

Expected: `"step":1`, `"stop_reason"`, `"usage"`가 든 JSON 줄

---

## Self-Review 결과

- **설계 대비 누락 없음:** 동작 흐름(Task 3·4), API 세 가지 요청과 오류 코드(Task 4), 대화 저장·TTL(Task 5), 도구 7개와 검증(Task 1·2), 작업 루프 규칙(Task 3), 모델 호출 파라미터(Task 5), 패널 기능 전부(Task 6·7), 파일 구성(전 태스크), 테스트(Task 1~4·6·7), 배포(Task 8).
- **설계와 달라진 점:** 없음. 설계 문서는 이 계획을 쓰며 세 군데(엄격 스키마 미사용, `retry` 요청, 화면 요약 형식)를 먼저 고쳤다.
- **이름 일치 확인:** `planAction`·`executeAction`·`runReadTool`·`startTurn`·`queueDecisions`·`queueRetry`·`runLoop`·`snapshot`·`createApp`의 인자와 반환 형식이 정의한 태스크와 쓰는 태스크에서 같다. `data` 객체의 메서드 8개 이름이 `helpers.mjs`와 `assistant-store.mjs`에서 같다.
