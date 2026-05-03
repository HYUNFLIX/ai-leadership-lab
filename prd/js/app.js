// ============================================================
// app.js — 메인 진입점: 단계 정의, 렌더 루프, 이벤트 리스너
// ============================================================

// 단계 정의 (render 함수는 steps.js에서 전역 선언됨)
const steps = [
  { id: 'start',   title: '시작하기',       short: '시작',   render: renderStart   },
  { id: 'intro',   title: '프로젝트 소개',  short: '소개',   render: renderIntro   },
  { id: 'user',    title: '누구를 위한 건가요', short: '타겟', render: renderUser   },
  { id: 'features',title: '핵심 기능',      short: '기능',   render: renderFeatures },
  { id: 'screens', title: '주요 화면',      short: '화면',   render: renderScreens  },
  { id: 'design',  title: '디자인 무드',    short: '디자인', render: renderDesign   },
  { id: 'tech',    title: '기술 선택',      short: '기술',   render: renderTech     },
  { id: 'scope',   title: 'MVP 범위',       short: '범위',   render: renderScope    },
  { id: 'result',  title: '완성된 PRD',     short: '완성',   render: renderResult   }
];

// ─ 진행 표시줄 ─────────────────────────────────────────────

function renderProgress() {
  const pg = document.getElementById('progress');
  pg.innerHTML = '';
  steps.forEach((s, i) => {
    const el = document.createElement('div');
    el.className =
      'progress-step' +
      (i === state.step ? ' active' : '') +
      (i < state.step ? ' done' : '');
    el.title = `${i + 1}. ${s.title}`;

    // 진행률 표시 (개선 4)
    const comp = (typeof getStepCompletion === 'function') ? getStepCompletion(i) : null;
    let compHtml = '';
    if (comp && i < state.step) {
      const pct = Math.round((comp.filled / comp.total) * 100);
      const cls = pct === 100 ? 'full' : (pct > 0 ? 'partial' : 'empty');
      compHtml = `<div class="progress-step-fill ${cls}">${comp.filled}/${comp.total}</div>`;
    }

    el.innerHTML = `
      <div class="progress-step-num">${String(i + 1).padStart(2, '0')}</div>
      <div class="progress-step-label">${s.short}</div>
      ${compHtml}`;
    el.addEventListener('click', () => {
      if (i <= state.step || i <= state.step + 1) {
        state.step = i;
        render();
      }
    });
    pg.appendChild(el);
  });
}

// ─ 메인 렌더 함수 ───────────────────────────────────────────

function render() {
  renderProgress();
  const card = document.getElementById('card');
  card.innerHTML = '';
  steps[state.step].render(card);
  saveState();
  // 카드 최상단으로 스크롤
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ─ 이벤트 리스너 ────────────────────────────────────────────

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('모든 입력을 초기화할까요?')) {
    localStorage.removeItem('prd-generator-v2');
    state = structuredClone(defaultState);
    render();
    toast('초기화되었어요');
  }
});

document.getElementById('brandLink').addEventListener('click', () => {
  if (state.step === 0) return;
  state.step = 0;
  render();
});

// ─ 초기 렌더 ────────────────────────────────────────────────
render();
