/* AI 비서 패널 — lectures.html / crm 공용
 * 사용: <script src="/js/assistant-panel.js" defer></script>
 * 전제: 페이지가 localStorage 'ailab_tokens'에 Cognito 토큰 저장 (lectures.html 로그인과 공유)
 */
(function () {
  const API_URL = 'https://tnibst6km5.execute-api.ap-northeast-2.amazonaws.com/prod';
  const COGNITO_URL = 'https://cognito-idp.ap-northeast-2.amazonaws.com/';
  const CLIENT_ID = '7dpeoqp3n1870th6u6qbsj09mu';
  const TOKEN_KEY = 'ailab_tokens';

  const history = []; // {role, content}

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

  /* ── 마크다운 라이트 렌더 ── */
  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function md(text) {
    const lines = esc(text).split('\n');
    let html = '', inList = false;
    for (const line of lines) {
      const li = line.match(/^\s*[-*•]\s+(.*)/);
      if (li) {
        if (!inList) { html += '<ul>'; inList = true; }
        html += '<li>' + li[1] + '</li>';
      } else {
        if (inList) { html += '</ul>'; inList = false; }
        html += line ? '<p>' + line + '</p>' : '';
      }
    }
    if (inList) html += '</ul>';
    return html
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  /* ── UI ── */
  const style = document.createElement('style');
  style.textContent = `
    .aip-fab{position:fixed;right:22px;bottom:22px;z-index:9000;width:56px;height:56px;border-radius:50%;
      border:none;cursor:pointer;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;
      box-shadow:0 8px 24px rgba(99,102,241,.45);font-size:22px;display:flex;align-items:center;justify-content:center;
      transition:transform .2s ease;}
    .aip-fab:hover{transform:scale(1.08);}
    .aip-panel{position:fixed;right:22px;bottom:90px;z-index:9001;width:min(400px,calc(100vw - 44px));
      height:min(560px,calc(100vh - 130px));display:none;flex-direction:column;border-radius:16px;overflow:hidden;
      background:rgba(17,20,38,.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
      border:1px solid rgba(255,255,255,.14);box-shadow:0 24px 60px rgba(0,0,0,.5);
      font-family:'Pretendard',-apple-system,sans-serif;color:#e2e8f0;}
    .aip-panel.open{display:flex;}
    .aip-head{padding:14px 18px;background:rgba(99,102,241,.15);border-bottom:1px solid rgba(255,255,255,.08);
      display:flex;justify-content:space-between;align-items:center;}
    .aip-head b{font-size:15px;}
    .aip-head small{display:block;font-weight:400;font-size:11.5px;color:#94a3b8;margin-top:1px;}
    .aip-close{background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;padding:4px;}
    .aip-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;}
    .aip-msg{max-width:88%;padding:10px 14px;border-radius:12px;font-size:13.5px;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;}
    .aip-msg.user{align-self:flex-end;background:#6366f1;color:#fff;border-bottom-right-radius:4px;}
    .aip-msg.ai{align-self:flex-start;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);border-bottom-left-radius:4px;}
    .aip-msg.ai p{margin:0 0 6px;} .aip-msg.ai p:last-child{margin:0;}
    .aip-msg.ai ul{margin:4px 0 6px 18px;} .aip-msg.ai li{margin-bottom:3px;}
    .aip-msg.ai code{background:rgba(255,255,255,.1);padding:1px 5px;border-radius:4px;font-size:12.5px;}
    .aip-msg.err{align-self:flex-start;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.3);color:#fca5a5;}
    .aip-typing{align-self:flex-start;color:#94a3b8;font-size:12.5px;padding:4px 8px;}
    .aip-suggest{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 10px;}
    .aip-suggest button{font-size:11.5px;padding:5px 10px;border-radius:99px;cursor:pointer;
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

  const fab = document.createElement('button');
  fab.className = 'aip-fab';
  fab.setAttribute('aria-label', 'AI 비서 열기');
  fab.innerHTML = '✦';

  const panel = document.createElement('div');
  panel.className = 'aip-panel';
  panel.innerHTML = `
    <div class="aip-head">
      <div><b>AI 비서</b><small>강의 이력·고객 데이터 기반</small></div>
      <button class="aip-close" aria-label="닫기">✕</button>
    </div>
    <div class="aip-msgs"></div>
    <div class="aip-suggest">
      <button>올해 강의 실적 요약해줘</button>
      <button>지급 대기 중인 강의료는?</button>
      <button>가장 많이 출강한 곳 TOP5</button>
    </div>
    <div class="aip-input">
      <textarea placeholder="무엇이든 물어보세요… (Enter 전송)" rows="1"></textarea>
      <button class="aip-send" aria-label="전송">➤</button>
    </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const msgsEl = panel.querySelector('.aip-msgs');
  const inputEl = panel.querySelector('textarea');
  const sendBtn = panel.querySelector('.aip-send');
  const suggestEl = panel.querySelector('.aip-suggest');

  function addMsg(cls, html) {
    const el = document.createElement('div');
    el.className = 'aip-msg ' + cls;
    el.innerHTML = html;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
  }

  fab.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      if (!msgsEl.children.length) {
        addMsg('ai', md('안녕하세요, 소장님. 강의 이력과 고객 데이터를 바탕으로 도와드릴게요.\n무엇이 궁금하신가요?'));
      }
      inputEl.focus();
    }
  });
  panel.querySelector('.aip-close').addEventListener('click', () => panel.classList.remove('open'));

  suggestEl.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') { inputEl.value = e.target.textContent; send(); }
  });

  async function send() {
    const text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;
    inputEl.value = '';
    suggestEl.style.display = 'none';
    addMsg('user', esc(text));
    history.push({ role: 'user', content: text });
    sendBtn.disabled = true;

    const typing = document.createElement('div');
    typing.className = 'aip-typing';
    typing.textContent = '생각 중…';
    msgsEl.appendChild(typing);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const token = await getToken();
      if (!token) throw new Error('로그인 후 사용할 수 있습니다.');
      const res = await fetch(API_URL + '/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'API 오류 ' + res.status);
      history.push({ role: 'assistant', content: data.reply });
      typing.remove();
      addMsg('ai', md(data.reply));
    } catch (err) {
      typing.remove();
      addMsg('err', esc(err.message || '오류가 발생했습니다.'));
      history.pop(); // 실패한 user 메시지는 히스토리에서 제거
    } finally {
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
})();
