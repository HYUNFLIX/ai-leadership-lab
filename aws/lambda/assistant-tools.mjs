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
