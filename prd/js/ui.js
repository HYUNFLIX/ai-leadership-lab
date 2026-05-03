// ============================================================
// ui.js — 공통 UI 헬퍼 함수 (입력 요소, 칩, 체크박스, 리스트 등)
// ============================================================

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function button(text, cls, onClick) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function titleBlock(label, title, desc) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="step-label">${label}</div>
    <h2 class="step-title">${title}</h2>
    <p class="step-desc">${desc}</p>
  `;
  return wrap;
}

function tipBox(text) {
  const d = document.createElement('div');
  d.className = 'tip';
  d.innerHTML = `<span class="tip-icon">Tip.</span><span>${text}</span>`;
  return d;
}

function summaryPeek() {
  const d = document.createElement('div');
  d.className = 'summary-peek';
  const name    = state.data.name    || '(미정)';
  const oneLine = state.data.oneLine || '(한 줄 설명 아직)';
  d.innerHTML = `<strong>${name}</strong> · ${oneLine}`;
  return d;
}

function navFooter(nextLabel = '다음', onNext, { prevLabel = '이전', hidePrev = false, nextClass = 'btn-primary' } = {}) {
  const nav = document.createElement('div');
  nav.className = 'nav';

  if (!hidePrev) {
    const prev = button(prevLabel, 'btn-ghost', () => {
      if (state.step > 0) { state.step--; render(); }
    });
    nav.appendChild(prev);
  } else {
    nav.appendChild(document.createElement('div'));
  }

  const next = button(nextLabel, nextClass, onNext || (() => {
    if (state.step < steps.length - 1) { state.step++; render(); }
  }));
  nav.appendChild(next);
  return nav;
}

// ── 폼 필드 ──────────────────────────────────────────────────

function field(label, hint, inputEl, required = false) {
  const d = document.createElement('div');
  d.className = 'field';
  d.innerHTML =
    `<label class="field-label">${label}${required ? '<span class="req">*</span>' : ''}</label>` +
    (hint ? `<div class="field-hint">${hint}</div>` : '');
  d.appendChild(inputEl);
  return d;
}

function input(key, placeholder, value) {
  const i = document.createElement('input');
  i.className = 'input';
  i.placeholder = placeholder;
  i.value = value || '';
  i.addEventListener('input', e => { state.data[key] = e.target.value; saveState(); });
  return i;
}

function textarea(key, placeholder, value, rows = 3) {
  const t = document.createElement('textarea');
  t.className = 'textarea';
  t.placeholder = placeholder;
  t.value = value || '';
  t.rows = rows;
  t.addEventListener('input', e => { state.data[key] = e.target.value; saveState(); });
  return t;
}

// ── 칩 그룹 (★ FIX: 칩 클릭 시 전체 render() 호출 제거 → classList만 토글) ──

function chipGroup(key, options, multi) {
  const g = document.createElement('div');
  g.className = 'chip-group';

  options.forEach(opt => {
    const current  = state.data[key];
    const selected = multi
      ? (Array.isArray(current) && current.includes(opt.v))
      : (current === opt.v);

    const c = document.createElement('div');
    c.className = 'chip' + (selected ? ' active' : '');
    c.innerHTML = `<strong>${opt.t}</strong>${opt.d ? ` <span style="opacity:0.6">· ${opt.d}</span>` : ''}`;

    c.addEventListener('click', () => {
      if (multi) {
        const arr = Array.isArray(state.data[key]) ? state.data[key] : [];
        if (arr.includes(opt.v)) {
          state.data[key] = arr.filter(x => x !== opt.v);
          c.classList.remove('active');
        } else {
          state.data[key] = [...arr, opt.v];
          c.classList.add('active');
        }
      } else {
        // 단일 선택: 같은 그룹의 active 전부 해제
        g.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
        state.data[key] = opt.v;
        c.classList.add('active');
      }
      saveState();
    });

    g.appendChild(c);
  });

  return g;
}

// ── 체크박스 그룹 (★ FIX: 전체 render() 호출 제거 → classList만 토글) ──

function checkGroup(key, options) {
  const g = document.createElement('div');
  g.className = 'check-group';

  options.forEach(opt => {
    const current  = Array.isArray(state.data[key]) ? state.data[key] : [];
    const selected = current.includes(opt.v);

    const c = document.createElement('div');
    c.className = 'check' + (selected ? ' active' : '');
    c.innerHTML = `
      <div class="check-box"></div>
      <div>
        <div class="check-label">${opt.t}</div>
        <div class="check-desc">${opt.d}</div>
      </div>`;

    c.addEventListener('click', () => {
      const arr = Array.isArray(state.data[key]) ? state.data[key] : [];
      if (arr.includes(opt.v)) {
        state.data[key] = arr.filter(x => x !== opt.v);
        c.classList.remove('active');
      } else {
        state.data[key] = [...arr, opt.v];
        c.classList.add('active');
      }
      saveState();
    });

    g.appendChild(c);
  });

  return g;
}

// ── 동적 리스트 (기능, 화면) ─────────────────────────────────

function renderDList(container, items, ph1, ph2, max) {
  container.innerHTML = '';

  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'dlist-item';
    row.innerHTML = `<div class="dlist-index">${String(i + 1).padStart(2, '0')}</div>`;

    const inputs = document.createElement('div');
    inputs.className = 'dlist-inputs';

    const t = document.createElement('input');
    t.className = 'input';
    t.placeholder = ph1;
    t.value = item.title || '';
    t.addEventListener('input', e => { item.title = e.target.value; saveState(); });
    inputs.appendChild(t);

    const d = document.createElement('input');
    d.className = 'input';
    d.placeholder = ph2;
    d.value = item.desc || '';
    d.style.fontSize = '13px';
    d.addEventListener('input', e => { item.desc = e.target.value; saveState(); });
    inputs.appendChild(d);

    row.appendChild(inputs);

    const rm = document.createElement('button');
    rm.className = 'dlist-remove';
    rm.innerHTML = '×';
    rm.title = '삭제';
    rm.addEventListener('click', () => {
      if (items.length <= 1) { toast('최소 1개는 있어야 해요'); return; }
      items.splice(i, 1);
      renderDList(container, items, ph1, ph2, max);
      saveState();
    });
    row.appendChild(rm);

    container.appendChild(row);
  });

  if (items.length < max) {
    const add = document.createElement('button');
    add.className = 'dlist-add';
    add.textContent = '+ 항목 추가';
    add.addEventListener('click', () => {
      items.push({ title: '', desc: '' });
      renderDList(container, items, ph1, ph2, max);
      saveState();
    });
    container.appendChild(add);
  }
}
