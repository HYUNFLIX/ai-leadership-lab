// ============================================================
// steps.js — 각 단계(Step) 렌더러
// ============================================================

// 결과 화면의 현재 탭 상태 (preview / markdown / prompt)
let resultView = 'preview';

// ── 단계별 입력 완성도 계산 ──────────────────────────────────
function getStepCompletion(stepIndex) {
  const d = state.data;
  switch (stepIndex) {
    case 0: return null;
    case 1: {
      let filled = 0, total = 2;
      if (d.name.trim()) filled++;
      if (d.oneLine.trim()) filled++;
      return { filled, total };
    }
    case 2: {
      let filled = 0, total = 3;
      if (d.targetUser.trim()) filled++;
      if (d.problem.trim()) filled++;
      if (d.solution.trim()) filled++;
      return { filled, total };
    }
    case 3: {
      const valid = d.features.filter(f => f.title.trim());
      return { filled: valid.length, total: d.features.length };
    }
    case 4: {
      const valid = d.screens.filter(s => s.title.trim());
      return { filled: valid.length, total: d.screens.length };
    }
    case 5: {
      let filled = 0, total = 3;
      if (d.designMood.length) filled++;
      if (d.designRef.trim()) filled++;
      if (d.designColor.trim()) filled++;
      return { filled, total };
    }
    case 6: {
      let filled = 0, total = 2;
      if (d.platform) filled++;
      if (d.techNeeds.length) filled++;
      return { filled, total };
    }
    case 7: {
      let filled = 0, total = 2;
      if (d.outOfScope.trim()) filled++;
      if (d.successMetric.trim()) filled++;
      return { filled, total };
    }
    case 8: return null;
    default: return null;
  }
}

// ── 자동 생성 미리보기 (개선 3) ──────────────────────────────
function renderGeneratedPreview(card, generated, keyword) {
  card.innerHTML = '';
  card.appendChild(titleBlock(
    '자동 생성 완료',
    `"${keyword}" PRD 초안이 준비됐어요`,
    '아래 내용을 확인하고, 이대로 시작하거나 다시 생성할 수 있어요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';

  const preview = document.createElement('div');
  preview.className = 'gen-preview';
  preview.innerHTML = `
    <div class="gen-preview-row">
      <div class="gen-preview-label">프로젝트</div>
      <div class="gen-preview-value"><strong>${generated.name}</strong> · ${generated.oneLine}</div>
    </div>
    <div class="gen-preview-row">
      <div class="gen-preview-label">타겟</div>
      <div class="gen-preview-value">${generated.targetUser}</div>
    </div>
    <div class="gen-preview-row">
      <div class="gen-preview-label">핵심 기능</div>
      <div class="gen-preview-value">${generated.features.map(f => f.title).join(', ')}</div>
    </div>
    <div class="gen-preview-row">
      <div class="gen-preview-label">주요 화면</div>
      <div class="gen-preview-value">${generated.screens.map(s => s.title).join(' → ')}</div>
    </div>
    <div class="gen-preview-row">
      <div class="gen-preview-label">디자인</div>
      <div class="gen-preview-value">${(generated.designMood || []).map(v => { const m = moods.find(x => x.v === v); return m ? m.t : v; }).join(', ')} · ${generated.designColor}</div>
    </div>
    <div class="gen-preview-row">
      <div class="gen-preview-label">플랫폼</div>
      <div class="gen-preview-value">${{'web':'웹사이트','mobile-web':'모바일 웹','app':'모바일 앱','desktop':'데스크톱'}[generated.platform] || generated.platform}</div>
    </div>
  `;
  content.appendChild(preview);
  card.appendChild(content);

  const nav = document.createElement('div');
  nav.className = 'nav';

  const reroll = button('🎲 다시 생성', 'btn-ghost', async () => {
    card.innerHTML = '';
    card.appendChild(titleBlock('자동 생성 완료', `"${keyword}" PRD를 다시 생성 중...`, ''));
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'step-content';
    loadingDiv.innerHTML = `<div class="magic-loading"><div class="magic-loading-bar${getGeminiKey() ? ' ai' : ''}"></div></div>`;
    card.appendChild(loadingDiv);
    const newGenerated = await autoGenerate(keyword);
    state.data._pendingGenerated = newGenerated;
    renderGeneratedPreview(card, newGenerated, keyword);
  });
  nav.appendChild(reroll);

  const rightGroup = document.createElement('div');
  rightGroup.style.cssText = 'display:flex;gap:8px;';

  rightGroup.appendChild(button('← 처음으로', 'btn-outline', () => {
    delete state.data._pendingGenerated;
    delete state.data._pendingKeyword;
    state.step = 0;
    render();
  }));

  rightGroup.appendChild(button('이걸로 시작 →', 'btn-accent', () => {
    const gen = state.data._pendingGenerated || generated;
    delete state.data._pendingGenerated;
    delete state.data._pendingKeyword;
    Object.assign(state.data, gen);
    state.step = 1;
    render();
    toast('AI가 전체 단계를 채웠어요. 하나씩 확인하며 수정해 보세요');
  }));

  nav.appendChild(rightGroup);
  card.appendChild(nav);
}

// ── Step 0: 시작 ──────────────────────────────────────────────

function renderStart(card) {
  card.appendChild(titleBlock(
    'STEP 01 / 09',
    '업무에서 쓸 도구, 무엇부터 만들까요?',
    '9단계를 차례로 채우면 PRD가 완성됩니다. 직접 쓰거나 키워드 한 줄로 시작해 보세요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';

  // ─ 작성 방식 토글 박스 ─
  const magic = document.createElement('div');
  magic.className = 'magic';
  magic.innerHTML = `
    <div class="magic-badge"><span class="magic-badge-dot"></span>작성 방식 선택</div>
    <div class="mode-toggle" role="tablist">
      <button type="button" class="mode-tab active" data-mode="manual"><span class="mode-tab-num">01</span>직접 작성</button>
      <button type="button" class="mode-tab" data-mode="auto"><span class="mode-tab-num">02</span>자동 생성</button>
    </div>
  `;

  // 자동 생성 패널
  const autoPanel = document.createElement('div');
  autoPanel.className = 'mode-panel';
  autoPanel.dataset.panel = 'auto';
  autoPanel.innerHTML = `
    <h3>어떤 업무 도구를 만들어 볼까요?</h3>
    <p>평소 번거롭던 업무나 만들어보고 싶던 도구를 한두 단어로 적어주세요.
       엔터를 누르면 AI가 전체 PRD 초안(타겟·기능·화면·디자인)을 자동으로 채워줍니다.</p>
  `;

  const inputRow = document.createElement('div');
  inputRow.className = 'magic-input-row';

  const kwInput = document.createElement('input');
  kwInput.className = 'magic-input';
  kwInput.placeholder = '예: 교육생 명단 관리, 협약기업 DB';
  kwInput.id = 'kwInput';

  const genBtn = document.createElement('button');
  genBtn.className = 'magic-btn';
  genBtn.innerHTML = '<span>✨</span> 자동 생성';

  const doGenerate = async (kw) => {
    if (!kw) { kw = kwInput.value.trim(); }
    if (!kw) { kwInput.focus(); toast('만들고 싶은 걸 적어주세요'); return; }

    const useAI = !!getGeminiKey();
    magic.innerHTML = `
      <div class="magic-loading">
        <strong>"${kw}"</strong>에 딱 맞는 PRD 초안을 ${useAI ? 'AI가 ' : ''}생성 중이에요...
        <div class="magic-loading-bar${useAI ? ' ai' : ''}"></div>
      </div>`;

    try {
      const generated = await autoGenerate(kw);
      state.data._pendingGenerated = generated;
      state.data._pendingKeyword = kw;
      renderGeneratedPreview(card, generated, kw);
    } catch (e) {
      toast('생성에 실패했어요. 다시 시도해주세요');
      render();
    }
  };

  genBtn.addEventListener('click', () => doGenerate());
  kwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doGenerate(); });

  inputRow.appendChild(kwInput);
  inputRow.appendChild(genBtn);
  autoPanel.appendChild(inputRow);

  // 예시 키워드 칩
  const examples = document.createElement('div');
  examples.className = 'magic-examples';
  pickN(EXAMPLE_KEYWORDS, 6).forEach(kw => {
    const chip = document.createElement('span');
    chip.className = 'magic-example';
    chip.textContent = kw;
    chip.addEventListener('click', () => { kwInput.value = kw; kwInput.focus(); });
    examples.appendChild(chip);
  });
  autoPanel.appendChild(examples);

  magic.appendChild(autoPanel);

  // 직접 작성 패널
  const manualPanel = document.createElement('div');
  manualPanel.className = 'mode-panel active';
  manualPanel.dataset.panel = 'manual';
  manualPanel.innerHTML = `
    <div class="manual-box">
      <h4>처음부터 내 손으로 채워볼게요</h4>
      <p>9단계를 하나씩 넘기며 PRD를 완성합니다.
         자동 생성 없이 본인 아이디어를 천천히 정리하고 싶을 때 선택하세요.</p>
      <button type="button" class="manual-start-btn" id="manualStartBtn">시작하기 →</button>
    </div>
  `;
  manualPanel.querySelector('#manualStartBtn').addEventListener('click', () => {
    state.step = 1;
    render();
    toast('빈 PRD에서 시작합니다. 9단계를 직접 채워보세요');
  });
  magic.appendChild(manualPanel);

  // 탭 전환
  magic.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      magic.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      magic.querySelectorAll('.mode-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === mode));
      if (mode === 'auto') setTimeout(() => { const el = document.getElementById('kwInput'); if (el) el.focus(); }, 200);
    });
  });

  content.appendChild(magic);
  content.appendChild(tipBox('<strong>강사 Tip:</strong> 학생들에게 "내 업무 중 가장 번거로운 일"을 키워드로 먼저 떠올리게 한 뒤, <strong>9단계를 하나씩 넘기며</strong> 본인 맥락에 맞게 수정하도록 유도하세요. 그 수정 과정이 핵심 학습 포인트입니다.'));
  card.appendChild(content);
}

// ── Step 1: 프로젝트 소개 ─────────────────────────────────────

function renderIntro(card) {
  card.appendChild(titleBlock(
    'STEP 02 / 09',
    '프로젝트를 한 줄로 소개해주세요',
    '제품의 이름과 "이게 뭐 하는 거다" 한 줄만 정하면 돼요. 나중에 바꿀 수 있어요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';

  content.appendChild(field('프로젝트 이름', '별명도 괜찮아요. 예: 데일리 포커스, 동네러, MyShop',
    input('name', '예: 데일리 포커스', state.data.name), true));

  content.appendChild(field('한 줄 설명', '"___를 위한 ___ 앱" 형식으로 써보세요',
    textarea('oneLine', '예: 매일 3가지만 집중하게 해주는 초미니멀 투두 앱', state.data.oneLine, 2)));

  content.appendChild(tipBox('<strong>좋은 한 줄 설명의 공식:</strong> [누구]를 위한 [무엇]을 하는 [어떤 방식의] 서비스. 구체적일수록 AI가 더 정확하게 만들어요.'));

  card.appendChild(content);

  card.appendChild(navFooter('다음 →', () => {
    if (!state.data.name.trim()) {
      toast('프로젝트 이름은 꼭 입력해주세요');
      return;
    }
    state.step++;
    render();
  }));
}

// ── Step 2: 타겟 & 문제 ──────────────────────────────────────

function renderUser(card) {
  card.appendChild(titleBlock(
    'STEP 03 / 09',
    '누구의 어떤 문제를 해결하나요?',
    '타겟 사용자가 명확할수록, 그들의 고민을 잘 알수록, 제품의 방향이 뚜렷해져요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('타겟 사용자', '누가 이 제품을 쓰나요? 구체적일수록 좋아요',
    textarea('targetUser', '예: 할 일이 너무 많아 우선순위를 놓치는 30대 직장인', state.data.targetUser, 2), true));

  content.appendChild(field('그들이 겪는 문제', '지금 이걸 어떻게 해결하고 있고, 무엇이 불편한가요?',
    textarea('problem', '예: 기존 투두앱은 기능이 너무 많아 오히려 복잡하고, 매일 봐야 할 목록이 50개가 넘어간다', state.data.problem, 3)));

  content.appendChild(field('우리의 해결 방식', '이 제품이 어떻게 그 문제를 풀어내나요?',
    textarea('solution', '예: 하루에 딱 3개만 등록할 수 있게 강제하여 진짜 중요한 일에 집중하게 만든다', state.data.solution, 2)));

  content.appendChild(tipBox('<strong>"왜 이게 필요한가"</strong>를 명확히 하는 게 핵심이에요. AI는 왜를 알면 디테일도 알아서 채워줘요.'));

  card.appendChild(content);

  card.appendChild(navFooter('다음 →', () => {
    if (!state.data.targetUser.trim()) {
      toast('타겟 사용자는 꼭 입력해주세요');
      return;
    }
    state.step++;
    render();
  }));
}

// ── Step 3: 핵심 기능 ─────────────────────────────────────────

function renderFeatures(card) {
  card.appendChild(titleBlock(
    'STEP 04 / 09',
    '핵심 기능 3-5개',
    'MVP(최소 기능)로 꼭 필요한 기능만 골라 주세요. 많을수록 좋은 게 아니에요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  const list = document.createElement('div');
  list.className = 'dlist';
  list.id = 'featureList';
  renderDList(list, state.data.features, '기능 이름 (예: 오늘의 3가지)', '기능 설명 (예: 하루 최대 3개까지만 등록 가능)', 5);
  content.appendChild(list);

  content.appendChild(tipBox('<strong>MVP의 철학:</strong> "이것만 있어도 쓸 만한가?"를 기준으로 3개만 고르면 완성도가 높아져요. 나머지는 나중에 추가해도 돼요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ── Step 4: 주요 화면 ─────────────────────────────────────────

function renderScreens(card) {
  card.appendChild(titleBlock(
    'STEP 05 / 09',
    '어떤 화면들이 필요한가요?',
    '사용자가 보게 될 화면(페이지)을 간단히 나열해 보세요. 홈, 상세, 설정 같은 식으로요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  const list = document.createElement('div');
  list.className = 'dlist';
  list.id = 'screenList';
  renderDList(list, state.data.screens, '화면 이름 (예: 홈)', '화면 설명 (예: 오늘의 할 일 3개 표시)', 8);
  content.appendChild(list);

  content.appendChild(tipBox('보통 MVP는 <strong>3-5개 화면</strong>으로 충분해요. 너무 많으면 완성하기 어려워요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ── Step 5: 디자인 무드 ───────────────────────────────────────

function renderDesign(card) {
  card.appendChild(titleBlock(
    'STEP 06 / 09',
    '어떤 느낌의 디자인인가요?',
    '비개발자에게 가장 어려운 단계지만, 가장 중요해요. AI는 "느낌"을 단어로 줘야 이해해요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('무드 (여러 개 선택 가능)', '원하는 느낌을 골라주세요',
    chipGroup('designMood', moods, true)));

  content.appendChild(field('참고하고 싶은 서비스', '"XXX 같은 느낌으로" — 벤치마크가 있으면 AI가 훨씬 쉽게 이해해요',
    input('designRef', '예: 토스, Notion, Linear, Apple Music 같은 느낌', state.data.designRef)));

  content.appendChild(field('색상 방향', '대표 컬러나 톤을 자유롭게 적어주세요',
    input('designColor', '예: 파스텔 연두 + 흰색 베이스, 또는 네이비 + 골드', state.data.designColor)));

  content.appendChild(tipBox('<strong>AI가 가장 헷갈리는 부분:</strong> "예쁘게", "깔끔하게"는 의미가 없어요. "Stripe 같은 느낌", "Linear처럼" 같은 구체적인 벤치마크가 최고예요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ── Step 6: 기술 선택 ─────────────────────────────────────────

function renderTech(card) {
  card.appendChild(titleBlock(
    'STEP 07 / 09',
    '기술적으로 필요한 것들',
    '어려운 기술 용어는 필요 없어요. 필요한 "능력"만 체크해주세요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('플랫폼', '이 제품은 어디서 실행되나요?',
    chipGroup('platform', [
      { v: 'web',        t: '웹사이트',       d: '' },
      { v: 'mobile-web', t: '모바일 친화 웹',  d: '' },
      { v: 'app',        t: '모바일 앱',       d: '' },
      { v: 'desktop',    t: '데스크톱 앱',     d: '' }
    ], false)));

  content.appendChild(field('필요한 기능/기술', '해당되는 항목만 체크해주세요 (선택 안 해도 됨)',
    checkGroup('techNeeds', techOptions)));

  content.appendChild(tipBox('체크 안 한 것은 안 만들어요. <strong>"나중에 필요할 수도?"는 빼세요.</strong> MVP는 가벼울수록 빨리 완성돼요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ── Step 7: MVP 범위 ──────────────────────────────────────────

function renderScope(card) {
  card.appendChild(titleBlock(
    'STEP 08 / 09',
    '이번에는 포함하지 않을 것',
    '"안 할 것"을 명확히 해야 AI도 욕심 내지 않고 집중해서 만들어요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('MVP에서 제외할 기능 / 나중에 할 것', '우선순위가 낮거나, 이번 버전에서는 안 만들 기능',
    textarea('outOfScope', '예: 다국어 지원, 다크모드, 상세 통계, 팀 기능 등', state.data.outOfScope, 3)));

  content.appendChild(field('성공의 기준 (선택)', '이 제품이 잘 만들어졌다는 걸 어떻게 알 수 있을까요?',
    textarea('successMetric', '예: 주 3회 이상 접속하는 사용자 100명 확보, 또는 내가 매일 쓰고 싶은 앱', state.data.successMetric, 2)));

  content.appendChild(tipBox('<strong>AI에게 "안 할 것"을 알려주는 이유:</strong> AI는 주어진 요구사항에 더해 "있으면 좋을 것 같은" 기능을 추가하려는 경향이 있어요. 명시적으로 제외해야 깔끔해요.'));

  card.appendChild(content);
  card.appendChild(navFooter('PRD 생성 →', null, { nextClass: 'btn-accent' }));
}

// ── Step 8: 결과 ──────────────────────────────────────────────

function renderResult(card) {
  card.appendChild(titleBlock(
    'STEP 09 / 09',
    '완성되었어요!',
    '아래 PRD를 복사해 Claude, Cursor, ChatGPT, Google AI Studio 같은 도구에 붙여넣으면 바로 제품 만들기를 시작할 수 있어요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';

  // 탭 + 액션 버튼
  const head = document.createElement('div');
  head.className = 'result-head';

  const tabs = document.createElement('div');
  tabs.className = 'result-tabs';

  const viewContainer = document.createElement('div');
  viewContainer.id = 'resultViewContainer';

  function renderResultView() {
    viewContainer.innerHTML = '';
    if (resultView === 'preview') {
      const prev = document.createElement('div');
      prev.className = 'result-preview';
      prev.innerHTML = markdownToHtml(generateMarkdown());
      viewContainer.appendChild(prev);
    } else {
      const out = document.createElement('pre');
      out.className = 'result-output';
      out.textContent = resultView === 'prompt' ? generatePrompt() : generateMarkdown();
      viewContainer.appendChild(out);

      if (resultView === 'prompt') {
        const note = document.createElement('p');
        note.style.cssText = 'font-size:12px;color:var(--ink-faint);margin-top:10px;text-align:center;';
        note.innerHTML = '💡 이 버전은 Claude, Cursor 같은 코딩 AI에 바로 붙여넣도록 최적화된 프롬프트예요.';
        viewContainer.appendChild(note);
      }
    }
  }

  [
    { v: 'preview',  label: '미리보기' },
    { v: 'markdown', label: '마크다운' },
    { v: 'prompt',   label: 'AI 프롬프트' }
  ].forEach(({ v, label }) => {
    const b = document.createElement('button');
    b.className = 'result-tab' + (resultView === v ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      resultView = v;
      tabs.querySelectorAll('.result-tab').forEach(t => t.classList.remove('active'));
      b.classList.add('active');
      renderResultView();
    });
    tabs.appendChild(b);
  });
  head.appendChild(tabs);

  const actions = document.createElement('div');
  actions.className = 'result-actions';
  actions.appendChild(button('📋 복사', 'btn-primary', () => {
    const text = resultView === 'prompt' ? generatePrompt() : generateMarkdown();
    navigator.clipboard.writeText(text).then(() => toast('클립보드에 복사되었어요!'));
  }));
  actions.appendChild(button('⬇ 다운로드', 'btn-outline', () => {
    const text = generateMarkdown();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${state.data.name || 'PRD'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }));
  head.appendChild(actions);
  content.appendChild(head);

  renderResultView();
  content.appendChild(viewContainer);

  // AI 도구 링크
  const tools = document.createElement('div');
  tools.className = 'ai-tools';
  tools.innerHTML = `
    <div class="ai-tools-head">
      <div class="ai-tools-title">이 PRD를 어디에 붙여넣을까요?</div>
      <div class="ai-tools-sub">클릭하면 바로 이동합니다</div>
    </div>
  `;

  const toolList = [
    { name: 'Claude',           url: 'https://claude.ai',              mark: 'C',  bg: '#cc785c', desc: '긴 PRD를 한 번에 읽고 단계별로 구현해줘요. 실무 설명이 친절함.', badge: '추천' },
    { name: 'Gemini Canvas',    url: 'https://gemini.google.com',      mark: '✦', bg: '#1e88e5', desc: 'Canvas 기능으로 PRD를 넣으면 문서·코드·슬라이드를 실시간으로 편집하며 다듬어요.', badge: '실습' },
    { name: 'Google AI Studio', url: 'https://aistudio.google.com',    mark: 'G',  bg: '#4285f4', desc: 'Build 모드에서 PRD만 붙이면 앱 초안이 자동 생성. 무료로 시작 가능.', badge: '무료' },
    { name: 'ChatGPT',          url: 'https://chat.openai.com',        mark: 'G',  bg: '#10a37f', desc: '가장 익숙한 AI 챗. Canvas 기능으로 PRD 기반 코드와 문서를 바로 받아볼 수 있어요.', badge: '' },
    { name: 'Cursor',           url: 'https://cursor.com',             mark: 'Cu', bg: '#1a1a2e', desc: 'AI 내장 코드 에디터. PRD를 Rules에 넣으면 프로젝트 전체 맥락으로 작업 가능.', badge: '' },
    { name: 'Lovable',          url: 'https://lovable.dev',            mark: '♡', bg: '#ff5a8a', desc: 'PRD만 붙이면 전체 웹앱을 만들어주는 노코드형 AI 빌더. 홍보 페이지 만들 때 빠름.', badge: '' }
  ];

  const toolGrid = document.createElement('div');
  toolGrid.className = 'ai-tools-grid';
  toolList.forEach(t => {
    const a = document.createElement('a');
    a.className = 'ai-tool';
    a.href = t.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `
      <div class="ai-tool-icon" style="background:${t.bg}">${t.mark}</div>
      <div class="ai-tool-body">
        <div class="ai-tool-name">${t.name}${t.badge ? `<span class="ai-tool-badge">${t.badge}</span>` : ''}</div>
        <div class="ai-tool-desc">${t.desc}</div>
        <div class="ai-tool-url">${t.url.replace('https://', '')}</div>
      </div>`;
    toolGrid.appendChild(a);
  });
  tools.appendChild(toolGrid);

  const howto = document.createElement('p');
  howto.style.cssText = 'font-size:12px;color:var(--ink-faint);margin-top:12px;line-height:1.6;';
  howto.innerHTML = '💡 <strong>추천 순서:</strong> ① 위에서 <strong>"AI 프롬프트"</strong> 탭 선택 → 복사 → ② 원하는 도구 열기 → 붙여넣기 → ③ AI가 질문하면 답하면서 차근차근 완성.';
  tools.appendChild(howto);
  content.appendChild(tools);

  card.appendChild(content);

  // 하단 네비
  const nav = document.createElement('div');
  nav.className = 'nav';
  nav.appendChild(button('← 단계별로 수정', 'btn-ghost', () => { state.step = 1; render(); }));

  const rightGroup = document.createElement('div');
  rightGroup.style.cssText = 'display:flex;gap:8px;';

  if (state.data._sourceKeyword) {
    const reroll = document.createElement('button');
    reroll.className = 'reroll-btn';
    reroll.innerHTML = `🎲 "${state.data._sourceKeyword}" 다시 생성`;
    reroll.addEventListener('click', () => {
      const generated = generateFromKeyword(state.data._sourceKeyword);
      Object.assign(state.data, generated);
      render();
      toast('다른 아이디어로 다시 생성했어요');
    });
    rightGroup.appendChild(reroll);
  }

  rightGroup.appendChild(button('새 PRD', 'btn-outline', () => {
    if (confirm('현재 PRD를 초기화하고 새로 시작할까요?')) {
      state = structuredClone(defaultState);
      render();
    }
  }));
  nav.appendChild(rightGroup);
  card.appendChild(nav);
}
