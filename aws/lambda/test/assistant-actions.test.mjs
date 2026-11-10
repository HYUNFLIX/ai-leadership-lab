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
