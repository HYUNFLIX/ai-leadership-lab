// 방문자 집계 — 쿠키·개인 식별 정보 없이 일별 카운터만 올린다 (관리자: /crm/visitors.html)
(function () {
  try {
    if (navigator.webdriver || location.hostname !== 'leadership.ai.kr') return;
    // 관리자 본인(로그인 토큰 보유) 방문은 세지 않음
    if (localStorage.getItem('ailab_tokens')) return;

    var today = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    var newVisitor = localStorage.getItem('ailab_seen') !== today;
    if (newVisitor) localStorage.setItem('ailab_seen', today);
    var newSession = !sessionStorage.getItem('ailab_session');
    if (newSession) sessionStorage.setItem('ailab_session', '1');

    // 유입처: utm_source → 외부 리퍼러 도메인 → 직접 방문
    var source = new URLSearchParams(location.search).get('utm_source') || '';
    if (!source && document.referrer) {
      var host = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (host !== location.hostname) source = host;
    }

    var body = JSON.stringify({
      p: location.pathname,
      r: source,
      n: newVisitor ? 1 : 0,
      s: newSession ? 1 : 0,
      d: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'm' : 'd',
    });
    var url = 'https://tnibst6km5.execute-api.ap-northeast-2.amazonaws.com/prod/public/track';
    if (!(navigator.sendBeacon && navigator.sendBeacon(url, body))) {
      fetch(url, { method: 'POST', body: body, keepalive: true, mode: 'no-cors' });
    }
  } catch (e) { /* 집계 실패는 무시 */ }
})();
