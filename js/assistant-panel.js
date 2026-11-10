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
