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
