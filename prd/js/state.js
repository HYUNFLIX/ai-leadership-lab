// ============================================================
// state.js — 앱 상태 관리 (localStorage 저장/불러오기)
// ============================================================

const STORAGE_KEY = 'prd-generator-v2';

const defaultState = {
  step: 0,
  data: {
    name: '',
    oneLine: '',
    targetUser: '',
    problem: '',
    solution: '',
    features: [
      { title: '', desc: '' },
      { title: '', desc: '' },
      { title: '', desc: '' }
    ],
    screens: [{ title: '', desc: '' }],
    designMood: [],
    designRef: '',
    designColor: '',
    platform: 'web',
    techNeeds: [],
    outOfScope: '',
    successMetric: ''
  }
};

let state = loadState() || structuredClone(defaultState);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.data.features || !s.data.features.length) s.data.features = structuredClone(defaultState.data.features);
    if (!s.data.screens  || !s.data.screens.length)  s.data.screens  = structuredClone(defaultState.data.screens);
    if (!Array.isArray(s.data.designMood)) s.data.designMood = [];
    if (!Array.isArray(s.data.techNeeds))  s.data.techNeeds  = [];
    return s;
  } catch (e) { return null; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById('savedTime');
  if (el) {
    const t = new Date();
    el.textContent = [t.getHours(), t.getMinutes(), t.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  }
}
