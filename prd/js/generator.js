// ============================================================
// generator.js — 키워드 기반 PRD 자동 생성 로직
// ============================================================

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
  s = s.replace(/(을|를|이|가|은|는|에서|에게|에|의|으로|로|와|과|도|만|랑|이랑)\s+/g, ' ');
  s = s.replace(/\s*(하고 싶어요|하고 싶어|하고 싶은|만들고 싶어요|만들고 싶어|만들고 싶은|필요해요|필요해|원해요|원해|좀|좀요|해줘|해주세요)\s*/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s || raw.trim();
}

function stripTrailingJosa(word) {
  return word.replace(/(을|를|이|가|은|는|에서|에게|에|의|으로|로|와|과|도|만|랑|이랑)$/, '');
}

function generateFromKeyword(keyword) {
  const catId = detectCategory(keyword);
  const cat   = CATS[catId];
  const kw    = normalizeKeyword(keyword) || '이 주제';
  const interp = s => s.replace(/\[KW\]/g, kw);

  let name = pick(cat.names);
  if (catId === 'generic') {
    const simpleKw = stripTrailingJosa(kw.split(/[\s,]+/)[0]);
    name = Math.random() < 0.5 ? `${simpleKw} 로그` : `오늘의 ${simpleKw}`;
  }

  // ★ FIX: 기존에는 features 3개만 선택 → 최대 5개로 변경
  const featureCount = Math.min(5, cat.features.length);
  // ★ FIX: 기존에는 screens 4개만 선택 → 카테고리 화면 전체 사용
  const screenCount  = cat.screens.length;

  return {
    name,
    oneLine:       interp(pick(cat.oneLiners)),
    targetUser:    interp(pick(cat.targets)),
    problem:       interp(pick(cat.problems)),
    solution:      interp(pick(cat.solutions)),
    features:      pickN(cat.features, featureCount).map(f => ({ ...f })),
    screens:       pickN(cat.screens,  screenCount).map(s => ({ ...s })),
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
