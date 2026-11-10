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
