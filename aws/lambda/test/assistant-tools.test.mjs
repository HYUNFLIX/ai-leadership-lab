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
