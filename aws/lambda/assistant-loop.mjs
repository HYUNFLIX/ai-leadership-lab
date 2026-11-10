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
