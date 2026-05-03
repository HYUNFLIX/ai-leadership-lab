// ============================================================
// generator.js — 키워드 기반 PRD 자동 생성 로직 (Gemini API + 템플릿 폴백)
// ============================================================

const GEMINI_KEY_STORAGE = 'prd-gemini-api-key';

function getGeminiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}
function setGeminiKey(key) {
  if (key) localStorage.setItem(GEMINI_KEY_STORAGE, key);
  else localStorage.removeItem(GEMINI_KEY_STORAGE);
  updateApiKeyUI();
}
function updateApiKeyUI() {
  const label = document.getElementById('apiKeyLabel');
  const btn = document.getElementById('apiKeyBtn');
  if (!label || !btn) return;
  if (getGeminiKey()) {
    label.textContent = 'AI 연결됨';
    btn.classList.add('connected');
  } else {
    label.textContent = 'API 키 설정';
    btn.classList.remove('connected');
  }
}

function showApiKeyDialog() {
  const existing = document.querySelector('.api-key-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'api-key-overlay';
  const current = getGeminiKey();
  overlay.innerHTML = `
    <div class="api-key-dialog">
      <h3>Gemini API 키 설정</h3>
      <p>Google AI Studio에서 발급받은 API 키를 입력하면<br>AI가 키워드를 이해하고 맞춤 PRD를 생성합니다.</p>
      <p style="font-size:12px;color:var(--ink-soft);">키가 없으면 <a href="https://aistudio.google.com/apikey" target="_blank" style="color:var(--accent);">Google AI Studio</a>에서 무료로 발급받으세요.</p>
      <input type="password" class="input api-key-input" placeholder="AIzaSy..." value="${current}" />
      <div class="api-key-actions">
        <button class="btn btn-ghost api-key-cancel">취소</button>
        ${current ? '<button class="btn btn-outline api-key-remove">키 삭제</button>' : ''}
        <button class="btn btn-primary api-key-save">저장</button>
      </div>
    </div>`;

  overlay.querySelector('.api-key-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  if (current) {
    overlay.querySelector('.api-key-remove').addEventListener('click', () => {
      setGeminiKey('');
      overlay.remove();
      toast('API 키가 삭제되었어요');
    });
  }
  overlay.querySelector('.api-key-save').addEventListener('click', async () => {
    const val = overlay.querySelector('.api-key-input').value.trim();
    if (!val) { toast('API 키를 입력해주세요'); return; }
    const saveBtn = overlay.querySelector('.api-key-save');
    saveBtn.textContent = '확인 중...';
    saveBtn.disabled = true;
    const ok = await testGeminiKey(val);
    if (ok) {
      setGeminiKey(val);
      overlay.remove();
      toast('API 키가 저장되었어요');
    } else {
      saveBtn.textContent = '저장';
      saveBtn.disabled = false;
      toast('API 키가 유효하지 않아요. 다시 확인해주세요');
    }
  });

  document.body.appendChild(overlay);
  overlay.querySelector('.api-key-input').focus();
}

async function testGeminiKey(key) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }) }
    );
    return res.ok;
  } catch { return false; }
}

// ── Gemini API를 이용한 PRD 생성 ──────────────────────────────

const GEMINI_PRD_PROMPT = `당신은 비개발자 직장인이 바이브코딩으로 만들 제품의 PRD(Product Requirements Document)를 작성하는 전문가입니다.

사용자가 키워드를 입력하면, 그 키워드에 딱 맞는 실무용 웹/앱 제품의 PRD 초안을 JSON으로 생성하세요.

반드시 아래 JSON 형식으로만 응답하세요. 설명이나 마크다운 없이 순수 JSON만 출력하세요.

{
  "name": "제품명 (영문 또는 한글, 짧고 기억하기 쉬운 이름)",
  "oneLine": "한 줄 설명 (이 제품이 무엇인지 한 문장으로)",
  "targetUser": "타겟 사용자 (누구를 위한 건지 구체적으로. 직무, 상황, 현재 겪는 불편함 포함. 2~3문장)",
  "problem": "문제 정의 (타겟이 현재 겪는 핵심 문제. 구체적 상황과 결과 포함. 2~3문장)",
  "solution": "솔루션 (이 제품이 문제를 어떻게 해결하는지. 구체적 메커니즘 포함. 2~3문장)",
  "features": [
    {"title": "기능명", "desc": "이 기능이 무엇을 하는지 구체적으로. 사용자가 어떤 행동을 하면 어떤 결과가 나오는지 포함. 2문장"},
    ... (5~6개)
  ],
  "screens": [
    {"title": "화면명", "desc": "이 화면에서 사용자가 무엇을 보고 무엇을 할 수 있는지. 1~2문장"},
    ... (4~6개, 사용자 흐름 순서대로)
  ],
  "designMood": ["minimal", "modern"] 또는 ["serious", "minimal"] 등 (2개, 선택지: minimal, modern, serious, playful, bold),
  "designRef": "참고할 서비스 (예: Notion의 깔끔함 + 토스의 간결함)",
  "designColor": "색상 방향 (hex 코드 포함, 예: 화이트 베이스 + 블루(#3B82F6) 포인트)",
  "platform": "web" 또는 "mobile-web" 또는 "app",
  "techNeeds": ["auth", "db"] 등 (선택지: auth, db, ai, search, upload, notification, realtime, map),
  "outOfScope": "v1에서 제외할 범위 (복잡한 기능들, 쉼표로 구분)",
  "successMetric": "성공 지표 (구체적 숫자 포함, 2~3개 지표를 쉼표로 구분)"
}

중요:
- 비개발자 직장인이 이해할 수 있는 쉬운 언어로 작성
- 기능과 화면 설명은 구체적이고 실용적으로 (추상적 표현 금지)
- 한국 직장인/교육기관 맥락에 맞게 작성
- JSON 외의 텍스트를 절대 포함하지 마세요`;

async function generateWithGemini(keyword) {
  const key = getGeminiKey();
  if (!key) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `키워드: "${keyword}"\n\n위 키워드에 맞는 제품 PRD를 JSON으로 생성하세요.` }] }],
        systemInstruction: { parts: [{ text: GEMINI_PRD_PROMPT }] },
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
      })
    }
  );

  if (!res.ok) throw new Error(`Gemini API 오류: ${res.status}`);

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('JSON 파싱 실패');

  const parsed = JSON.parse(jsonMatch[0]);

  const validMoods = ['minimal','modern','serious','playful','bold'];
  const validTech = ['auth','db','ai','search','upload','notification','realtime','map'];
  const validPlatforms = ['web','mobile-web','app','desktop'];

  return {
    name:          parsed.name || keyword,
    oneLine:       parsed.oneLine || '',
    targetUser:    parsed.targetUser || '',
    problem:       parsed.problem || '',
    solution:      parsed.solution || '',
    features:      (parsed.features || []).map(f => ({ title: f.title || '', desc: f.desc || '' })),
    screens:       (parsed.screens || []).map(s => ({ title: s.title || '', desc: s.desc || '' })),
    designMood:    (parsed.designMood || ['minimal','modern']).filter(m => validMoods.includes(m)),
    designRef:     parsed.designRef || '',
    designColor:   parsed.designColor || '',
    platform:      validPlatforms.includes(parsed.platform) ? parsed.platform : 'web',
    techNeeds:     (parsed.techNeeds || ['auth','db']).filter(t => validTech.includes(t)),
    outOfScope:    parsed.outOfScope || '',
    successMetric: parsed.successMetric || '',
    _sourceKeyword: keyword,
    _category:      'gemini'
  };
}

// ── 템플릿 기반 폴백 생성 ─────────────────────────────────────

const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out  = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};

function detectCategory(keyword) {
  const lower = keyword.toLowerCase();
  for (const [id, cat] of Object.entries(CATS)) {
    if (id === 'generic') continue;
    if (cat.keywords.some(k => lower.includes(k.toLowerCase()))) return id;
  }
  return 'generic';
}

function normalizeKeyword(raw) {
  let s = (raw || '').trim();
  s = s.replace(/\s*(하고 싶어요|하고 싶어|하고 싶은|만들고 싶어요|만들고 싶어|만들고 싶은|필요해요|필요해|원해요|원해|좀|좀요|해줘|해주세요)\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || raw.trim();
}

function generateFromKeyword(keyword) {
  const catId = detectCategory(keyword);
  const cat   = CATS[catId];
  const kw    = normalizeKeyword(keyword) || '이 주제';
  const interp = s => s.replace(/\[KW\]/g, kw);

  let name = pick(cat.names);
  if (catId === 'generic') {
    const simpleKw = kw.split(/[\s,]+/).slice(0, 2).join(' ');
    const prefixes = ['Smart', 'One', 'My'];
    const suffixes = ['허브', '매니저', '보드', '헬퍼'];
    name = Math.random() < 0.5
      ? `${pick(prefixes)} ${simpleKw}`
      : `${simpleKw} ${pick(suffixes)}`;
  }

  const featureCount = Math.min(5, cat.features.length);
  const screenCount  = cat.screens.length;

  return {
    name,
    oneLine:       interp(pick(cat.oneLiners)),
    targetUser:    interp(pick(cat.targets)),
    problem:       interp(pick(cat.problems)),
    solution:      interp(pick(cat.solutions)),
    features:      pickN(cat.features, featureCount).map(f => ({ title: f.title, desc: interp(f.desc) })),
    screens:       pickN(cat.screens,  screenCount).map(s => ({ title: s.title, desc: interp(s.desc) })),
    designMood:    [...cat.moods],
    designRef:     cat.ref,
    designColor:   cat.color,
    platform:      cat.platform,
    techNeeds:     [...cat.tech],
    outOfScope:    cat.scope,
    successMetric: cat.metric,
    _sourceKeyword: keyword,
    _category:      catId
  };
}

// ── 통합 생성 함수 (Gemini 우선, 실패 시 템플릿 폴백) ─────────

async function autoGenerate(keyword) {
  if (getGeminiKey()) {
    try {
      return await generateWithGemini(keyword);
    } catch (e) {
      console.warn('Gemini 생성 실패, 템플릿으로 폴백:', e.message);
      toast('AI 생성에 실패해서 템플릿으로 대체했어요');
    }
  }
  return generateFromKeyword(keyword);
}
