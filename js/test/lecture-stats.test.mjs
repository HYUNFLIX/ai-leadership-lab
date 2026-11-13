import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { netPaymentOf, isOutstanding, summarize, monthlyTotals, suggestions } = createRequire(import.meta.url)('../lecture-stats.js');

const L = [
  { id: 'a', date: '2026-10-05', name: 'AI 리더십 워크숍', client: '가나전자', location: '서울', duration: 4, fee: 2000000, taxDeduction: '3.3', paymentStatus: 'paid' },
  { id: 'b', date: '2026-10-20', name: '바이브코딩 실습', client: '다라중공업', location: '울산', duration: 8, fee: 3000000, taxDeduction: 'vat', netPayment: 3300000, paymentStatus: 'pending' },
  { id: 'c', date: '2026-11-03', name: 'AI 리터러시', client: '가나전자', location: '서울', duration: 2, fee: 1000000, taxDeduction: 'none', paymentStatus: 'partial' },
  { id: 'd', date: '2025-12-10', name: '임원 특강', client: ' 마바식품 ', duration: 1.5, fee: 1500000, taxDeduction: '8.8', paymentStatus: 'paid' },
  { id: 'e', name: '날짜 없는 강의', client: '가나전자', fee: 0 },
];

test('netPaymentOf: 저장된 값이 우선, 없으면 세금공제로 계산', () => {
  assert.equal(netPaymentOf(L[0]), 1934000);
  assert.equal(netPaymentOf(L[1]), 3300000);
  assert.equal(netPaymentOf(L[3]), 1368000);
  assert.equal(netPaymentOf({ fee: 1000000, taxDeduction: 'vat' }), 1100000);
  assert.equal(netPaymentOf({}), 0);
});

test('isOutstanding: 대기와 일부입금만 미수', () => {
  assert.equal(isOutstanding({ paymentStatus: 'pending' }), true);
  assert.equal(isOutstanding({ paymentStatus: 'partial' }), true);
  assert.equal(isOutstanding({ paymentStatus: 'paid' }), false);
  assert.equal(isOutstanding({}), false);
});

test('summarize: 건수·합계·미수금', () => {
  assert.deepEqual(summarize(L), {
    count: 5, sumFee: 7500000, sumNet: 7602000, sumHours: 15.5, outstandingCount: 2, outstandingNet: 4300000,
  });
  assert.deepEqual(summarize([]), { count: 0, sumFee: 0, sumNet: 0, sumHours: 0, outstandingCount: 0, outstandingNet: 0 });
});

test('monthlyTotals: 항상 12개, 해당 연도만 센다', () => {
  const months = monthlyTotals(L, '2026');
  assert.equal(months.length, 12);
  assert.deepEqual(months.map((m) => m.month), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  assert.deepEqual(months[9], { month: '10', count: 2, sumFee: 5000000, sumNet: 5234000 });
  assert.deepEqual(months[10], { month: '11', count: 1, sumFee: 1000000, sumNet: 1000000 });
  assert.deepEqual(months[0], { month: '01', count: 0, sumFee: 0, sumNet: 0 });
  assert.equal(monthlyTotals(L, '2025')[11].count, 1);
  assert.equal(monthlyTotals(L, '2024').every((m) => m.count === 0), true);
});

test('suggestions: 많이 쓴 순, 같으면 가나다순, 빈 값 제외, 앞뒤 공백 제거', () => {
  assert.deepEqual(suggestions(L, 'client'), ['가나전자', '다라중공업', '마바식품']);
  assert.deepEqual(suggestions(L, 'location'), ['서울', '울산']);
  assert.deepEqual(suggestions(L, 'client', 1), ['가나전자']);
  assert.deepEqual(suggestions(L, 'contractor'), []);
});
