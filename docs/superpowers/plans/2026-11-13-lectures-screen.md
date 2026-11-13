# 강의 이력 화면 개선(1단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 강의 이력 화면에서 목록이 먼저 보이고, 요약·미수금·월별 추이를 바로 확인하며, 등록·복제·삭제 되돌리기를 한 화면에서 처리하게 만든다.

**Architecture:** 계산(요약·월별 합계·자동완성 후보)은 DOM과 무관한 `js/lecture-stats.js`로 빼서 단위 테스트한다. `lectures.html`은 등록 폼과 대시보드 섹션을 없애고, 기존 수정 창을 등록·복제에도 쓰며, 목록 위에 요약 줄과 월별 막대를 둔다. 로그인·토큰·API 코드는 건드리지 않는다.

**Tech Stack:** 정적 HTML/CSS/JS(빌드 없음), `node:test`, 화면 검증은 `puppeteer-core` + 가짜 API.

설계 문서: `docs/superpowers/specs/2026-11-12-admin-screens-design.md` (1단계 절)

## Global Constraints

- `lectures.html`의 첫 번째 `<script>` 블록(Cognito 로그인, 토큰, `api()`, `loadLectures`의 API 호출)은 기능을 바꾸지 않는다. 이 계획이 명시한 줄만 고친다.
- 프레임워크·빌드 단계·새 외부 라이브러리를 넣지 않는다.
- 화면에 넣는 값은 모두 `escapeHtml`을 거치거나 `textContent`로 넣는다. 행 버튼은 `data-action`·`data-id`와 이벤트 위임으로 동작한다.
- 기존 기능을 유지한다: 수정, 필터(검색·연도·월·입금상태), 정렬, Excel 다운로드, JSON 내보내기·가져오기, 모바일 카드 목록과 30건씩 보기, AI 비서 패널과 `ailab:data-changed` 수신.
- 실지급액 계산식은 `calculateNetPayment`와 같다: `3.3` → ×0.967, `8.8` → ×0.912, `vat` → ×1.1, 그 외 → 원금, 반올림. 저장된 `netPayment`가 있으면 그 값을 쓴다.
- 미수금 = 입금 여부가 `pending` 또는 `partial`인 강의의 실지급액 합.
- 테스트 명령(저장소 루트): `node --test "js/test/*.test.mjs"`.
- 커밋 메시지는 한국어 conventional commits이고 마지막 줄에 `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- `git push`는 사용자가 지시할 때만 한다.

## File Structure

| 파일 | 상태 | 책임 |
|---|---|---|
| `js/lecture-stats.js` | 새로 만듦 | 순수 계산: 실지급액, 요약, 월별 합계, 자동완성 후보 |
| `js/test/lecture-stats.test.mjs` | 새로 만듦 | 위 계산의 단위 테스트 |
| `lectures.html` | 수정 | 화면 구성, 등록·복제 창, 삭제 되돌리기, 요약 줄, 월별 추이, 도구줄, 버그 수정 |

`<!-- file: 경로 -->` 표시 바로 아래 코드 블록은 그 파일의 **전체 내용**이다.
`<!-- scratch: 이름 -->` 표시 아래 코드 블록은 저장소 밖 임시 폴더에 두는 검증 스크립트다.

---

### Task 1: 계산 모듈

**Files:**
- Create: `js/lecture-stats.js`
- Test: `js/test/lecture-stats.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces: 브라우저에서는 `window.LectureStats`, Node에서는 `require('../lecture-stats.js')`
  - `netPaymentOf(lecture): number`
  - `isOutstanding(lecture): boolean`
  - `summarize(lectures): { count, sumFee, sumNet, sumHours, outstandingCount, outstandingNet }`
  - `monthlyTotals(lectures, year: string): Array<{ month: '01'..'12', count, sumFee, sumNet }>` — 항상 12개
  - `suggestions(lectures, field: string, limit = 50): string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

<!-- file: js/test/lecture-stats.test.mjs -->
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { netPaymentOf, isOutstanding, summarize, monthlyTotals, suggestions } = createRequire(import.meta.url)('../lecture-stats.js');

const L = [
  { id: 'a', date: '2026-10-05', name: 'AI 리더십 워크숍', client: '가나전자', location: '서울', duration: 4, fee: 2000000, taxDeduction: '3.3', paymentStatus: 'paid' },
  { id: 'b', date: '2026-10-20', name: '바이브코딩 실습', client: '다라중공업', location: '울산', duration: 8, fee: 3000000, taxDeduction: 'vat', netPayment: 3300000, paymentStatus: 'pending' },
  { id: 'c', date: '2026-11-03', name: 'AI 리터러시', client: '가나전자', location: '서울', duration: 2, fee: 1000000, taxDeduction: 'none', paymentStatus: 'partial' },
  { id: 'd', date: '2025-12-10', name: '임원 특강', client: ' 마바식품 ', duration: 1.5, fee: 1500000, taxDeduction: '8.8', paymentStatus: 'paid' },
  { id: 'e', name: '날짜 없는 강의', client: '가나전자', fee: 0 },
];

test('netPaymentOf: 저장된 값이 우선, 없으면 세금공제로 계산', () => {
  assert.equal(netPaymentOf(L[0]), 1934000);
  assert.equal(netPaymentOf(L[1]), 3300000);
  assert.equal(netPaymentOf(L[3]), 1368000);
  assert.equal(netPaymentOf({ fee: 1000000, taxDeduction: 'vat' }), 1100000);
  assert.equal(netPaymentOf({}), 0);
});

test('isOutstanding: 대기와 일부입금만 미수', () => {
  assert.equal(isOutstanding({ paymentStatus: 'pending' }), true);
  assert.equal(isOutstanding({ paymentStatus: 'partial' }), true);
  assert.equal(isOutstanding({ paymentStatus: 'paid' }), false);
  assert.equal(isOutstanding({}), false);
});

test('summarize: 건수·합계·미수금', () => {
  assert.deepEqual(summarize(L), {
    count: 5, sumFee: 7500000, sumNet: 7602000, sumHours: 15.5, outstandingCount: 2, outstandingNet: 4300000,
  });
  assert.deepEqual(summarize([]), { count: 0, sumFee: 0, sumNet: 0, sumHours: 0, outstandingCount: 0, outstandingNet: 0 });
});

test('monthlyTotals: 항상 12개, 해당 연도만 센다', () => {
  const months = monthlyTotals(L, '2026');
  assert.equal(months.length, 12);
  assert.deepEqual(months.map((m) => m.month), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  assert.deepEqual(months[9], { month: '10', count: 2, sumFee: 5000000, sumNet: 5234000 });
  assert.deepEqual(months[10], { month: '11', count: 1, sumFee: 1000000, sumNet: 1000000 });
  assert.deepEqual(months[0], { month: '01', count: 0, sumFee: 0, sumNet: 0 });
  assert.equal(monthlyTotals(L, '2025')[11].count, 1);
  assert.equal(monthlyTotals(L, '2024').every((m) => m.count === 0), true);
});

test('suggestions: 많이 쓴 순, 같으면 가나다순, 빈 값 제외, 앞뒤 공백 제거', () => {
  assert.deepEqual(suggestions(L, 'client'), ['가나전자', '다라중공업', '마바식품']);
  assert.deepEqual(suggestions(L, 'location'), ['서울', '울산']);
  assert.deepEqual(suggestions(L, 'client', 1), ['가나전자']);
  assert.deepEqual(suggestions(L, 'contractor'), []);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test "js/test/*.test.mjs"`
Expected: FAIL — `Cannot find module '../lecture-stats.js'` (기존 `assistant-markdown` 테스트 8개는 통과)

- [ ] **Step 3: 구현**

<!-- file: js/lecture-stats.js -->
```js
/* 강의 이력 화면의 순수 계산 — 요약, 월별 합계, 자동완성 후보. DOM을 건드리지 않는다.
 * 브라우저: window.LectureStats / Node 테스트: require(...)
 */
(function (root) {
  // lectures.html의 calculateNetPayment와 같은 식
  function calculateNetPayment(fee, taxDeduction) {
    if (!fee || fee <= 0) return 0;
    switch (taxDeduction) {
      case '3.3': return Math.round(fee * 0.967);
      case '8.8': return Math.round(fee * 0.912);
      case 'vat': return Math.round(fee * 1.1);
      default: return fee;
    }
  }

  function netPaymentOf(lecture) {
    return lecture.netPayment || calculateNetPayment(lecture.fee || 0, lecture.taxDeduction);
  }

  // 일부입금은 받은 금액을 따로 기록하지 않으므로 전액을 미수로 본다
  function isOutstanding(lecture) {
    return lecture.paymentStatus === 'pending' || lecture.paymentStatus === 'partial';
  }

  function summarize(lectures) {
    var out = { count: lectures.length, sumFee: 0, sumNet: 0, sumHours: 0, outstandingCount: 0, outstandingNet: 0 };
    lectures.forEach(function (l) {
      var net = netPaymentOf(l);
      out.sumFee += l.fee || 0;
      out.sumNet += net;
      out.sumHours += Number(l.duration) || 0;
      if (isOutstanding(l)) {
        out.outstandingCount += 1;
        out.outstandingNet += net;
      }
    });
    return out;
  }

  function monthlyTotals(lectures, year) {
    var months = [];
    for (var m = 1; m <= 12; m++) months.push({ month: (m < 10 ? '0' : '') + m, count: 0, sumFee: 0, sumNet: 0 });
    lectures.forEach(function (l) {
      var date = l.date || '';
      if (date.slice(0, 4) !== String(year)) return;
      var index = parseInt(date.slice(5, 7), 10) - 1;
      if (!(index >= 0 && index < 12)) return;
      months[index].count += 1;
      months[index].sumFee += l.fee || 0;
      months[index].sumNet += netPaymentOf(l);
    });
    return months;
  }

  function suggestions(lectures, field, limit) {
    var counts = {};
    lectures.forEach(function (l) {
      var value = typeof l[field] === 'string' ? l[field].trim() : '';
      if (value) counts[value] = (counts[value] || 0) + 1;
    });
    return Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b, 'ko'); })
      .slice(0, limit || 50);
  }

  var api = { netPaymentOf: netPaymentOf, isOutstanding: isOutstanding, summarize: summarize, monthlyTotals: monthlyTotals, suggestions: suggestions };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LectureStats = api;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test "js/test/*.test.mjs"`
Expected: PASS — `# pass 13`, `# fail 0`

- [ ] **Step 5: 커밋**

```bash
git add js/lecture-stats.js js/test/lecture-stats.test.mjs
git commit -m "feat(lectures): 요약·월별 합계·자동완성 후보 계산 모듈"
```

---

### Task 2: 알림·이스케이프·행 버튼·삭제 되돌리기

**Files:**
- Modify: `lectures.html` (두 번째 `<script>` 블록과 CSS)

**Interfaces:**
- Consumes: 첫 번째 스크립트의 전역 `api(path, opts)`, `loadLectures()`, `window.getLectures()`, `window.deleteLectureFromDB(id)`
- Produces:
  - `showToast(message, type = 'success', options = {}): () => void` — `options`: `{ actionLabel, onAction, duration }`. 닫는 함수를 돌려준다
  - `escapeHtml(value): string` — `& < > " '`를 모두 바꾼다(본문과 속성 모두에 쓴다)
  - 행 버튼 규약: `<button data-action="edit|clone|delete" data-id="...">`. `clone`은 Task 3에서 동작을 붙인다
  - `deleteLecture(id)`, `restoreLecture(lecture)`

- [ ] **Step 1: 알림 함수 교체**

`function showToast(message, type = 'success') {`부터 그 함수의 닫는 `}`까지를 다음으로 바꾼다.

```js
        // 알림. options.actionLabel을 주면 버튼이 붙고, 누르면 onAction을 호출한다. 닫는 함수를 돌려준다.
        function showToast(message, type = 'success', options = {}) {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
            toast.innerHTML = `
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    ${type === 'success'
                        ? '<path d="M20 6L9 17l-5-5"/>'
                        : '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>'}
                </svg>
                <span></span>
            `;
            toast.querySelector('span').textContent = message;

            let timer = null;
            const close = () => {
                clearTimeout(timer);
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            };
            if (options.actionLabel) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'toast-action';
                button.textContent = options.actionLabel;
                button.addEventListener('click', () => { close(); options.onAction(); });
                toast.appendChild(button);
            }
            container.appendChild(toast);
            timer = setTimeout(close, options.duration || 3000);
            return close;
        }
```

CSS: `.toast.error {` 규칙의 닫는 `}` 다음에 추가한다.

```css

        .toast-action {
            margin-left: 0.5rem;
            padding: 0.25rem 0.625rem;
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            background: var(--bg-secondary);
            color: var(--primary);
            font-family: inherit;
            font-size: 0.8125rem;
            font-weight: 600;
            cursor: pointer;
        }

        .toast-action:hover {
            background: var(--bg-tertiary);
        }
```

- [ ] **Step 2: 이스케이프 함수 교체**

`function escapeHtml(str) {`부터 닫는 `}`까지를 다음으로 바꾼다.

```js
        // 본문과 속성 값 모두에 쓸 수 있게 따옴표까지 바꾼다
        function escapeHtml(value) {
            if (value === null || value === undefined) return '';
            return String(value)
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        }
```

`getPaymentBadge`의 마지막 줄을 바꾼다.

이전: `            return badges[status] || status || '-';`
이후: `            return badges[status] || escapeHtml(status) || '-';`

- [ ] **Step 3: 행 버튼을 `data-action`으로 바꾸고 복제 버튼 추가**

`renderLectures` 안의 `<td class="col-actions">` 블록에서 두 버튼을 다음 세 버튼으로 바꾼다.

이전:
```js
                            <button class="btn-icon" onclick="editLecture('${lecture.id}')" title="수정">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10.5 1.5a2.121 2.121 0 113 3L5 13l-4 1 1-4 8.5-8.5z"/>
                                </svg>
                            </button>
                            <button class="btn-icon danger" onclick="deleteLecture('${lecture.id}')" title="삭제">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 3h12M4.5 3V2a1 1 0 011-1h3a1 1 0 011 1v1M11 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3"/>
                                </svg>
                            </button>
```
이후:
```js
                            <button type="button" class="btn-icon" data-action="edit" data-id="${escapeHtml(lecture.id)}" title="수정" aria-label="수정">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M10.5 1.5a2.121 2.121 0 113 3L5 13l-4 1 1-4 8.5-8.5z"/>
                                </svg>
                            </button>
                            <button type="button" class="btn-icon" data-action="clone" data-id="${escapeHtml(lecture.id)}" title="복제해서 새로 등록" aria-label="복제">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <rect x="4.5" y="4.5" width="8" height="8" rx="1.5"/><path d="M9.5 4.5V3a1.5 1.5 0 00-1.5-1.5H3A1.5 1.5 0 001.5 3v5A1.5 1.5 0 003 9.5h1.5"/>
                                </svg>
                            </button>
                            <button type="button" class="btn-icon danger" data-action="delete" data-id="${escapeHtml(lecture.id)}" title="삭제" aria-label="삭제">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                                    <path d="M1 3h12M4.5 3V2a1 1 0 011-1h3a1 1 0 011 1v1M11 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3"/>
                                </svg>
                            </button>
```

CSS에서 버튼 세 개가 들어가도록 폭을 넓힌다.

이전: `        .table .col-actions { width: 90px; }`
이후: `        .table .col-actions { width: 132px; }`

이전(`.table {` 규칙 안): `            min-width: 1200px;`
이후: `            min-width: 1240px;`

- [ ] **Step 4: 이벤트 위임과 삭제 되돌리기**

`async function deleteLecture(id) {`부터 닫는 `}`까지를 다음으로 바꾼다.

```js
        // 확인 창 대신 되돌리기: 바로 삭제하고 8초 동안 되돌릴 수 있게 한다
        async function deleteLecture(id) {
            const lecture = window.getLectures().find(l => l.id === id);
            if (!lecture) return;
            const deleted = await window.deleteLectureFromDB(id);
            if (!deleted) return;
            showToast('강의를 삭제했습니다.', 'success', {
                actionLabel: '되돌리기',
                duration: 8000,
                onAction: () => restoreLecture(lecture)
            });
        }

        // 같은 id와 등록 시각으로 다시 만든다(POST /lectures가 id·createdAt을 그대로 받는다)
        async function restoreLecture(lecture) {
            try {
                await api('/lectures', { method: 'POST', body: JSON.stringify(lecture) });
                showToast('삭제를 되돌렸습니다.', 'success');
                await loadLectures();
            } catch (error) {
                console.error('Restore error:', error);
                showToast('되돌리기에 실패했습니다: ' + error.message, 'error');
            }
        }

        // 행 버튼(수정·복제·삭제)
        document.getElementById('lectureTableBody').addEventListener('click', function(e) {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const id = button.dataset.id;
            if (button.dataset.action === 'edit') editLecture(id);
            else if (button.dataset.action === 'clone') cloneLecture(id);
            else if (button.dataset.action === 'delete') deleteLecture(id);
        });
```

첫 번째 스크립트의 `window.deleteLectureFromDB`에서 성공 알림 한 줄을 지운다(되돌리기 알림과 겹치지 않게).

지울 줄: `                showToast('강의가 삭제되었습니다.', 'success');` (`await api('/lectures/' + encodeURIComponent(id), { method: 'DELETE' });` 바로 다음 줄)

- [ ] **Step 5: 문법 확인**

Run: `node -e "const s=require('fs').readFileSync('lectures.html','utf8');const m=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];m.forEach((x,i)=>{new Function(x[1]);console.log('script',i+1,'OK')});console.log(s.includes('onclick=\"editLecture(')?'MISS 인라인 onclick 남음':'OK 인라인 행 onclick 없음')"`
Expected: `script 1 OK`, `script 2 OK`, `OK 인라인 행 onclick 없음`

(이 시점에는 `cloneLecture`가 아직 없어 복제 버튼을 누르면 오류가 난다. Task 3에서 만든다.)

- [ ] **Step 6: 커밋**

```bash
git add lectures.html
git commit -m "feat(lectures): 삭제 되돌리기, 행 버튼 이벤트 위임, 속성 이스케이프"
```

---

### Task 3: 등록·복제를 수정 창으로, 등록 폼 제거, 자동완성

**Files:**
- Modify: `lectures.html`

**Interfaces:**
- Consumes (Task 1): `window.LectureStats.suggestions`; (Task 2): 행 버튼 규약, `showToast`
- Produces: `openCreate(prefill = {})`, `cloneLecture(id)`, `editLecture(id)`(기존 이름 유지), `saveEdit()`(등록·수정 겸용), `updateSuggestions()`

- [ ] **Step 1: 등록 폼 섹션과 대시보드 섹션의 마크업 제거**

`<!-- Dashboard -->` 줄부터 `<!-- Lecture List Section -->` 줄 바로 앞까지를 지운다(대시보드 섹션과 "강의 등록" 섹션).

Run:
```bash
node -e "
const fs=require('fs');let s=fs.readFileSync('lectures.html','utf8');
const a=s.indexOf('        <!-- Dashboard -->'), b=s.indexOf('        <!-- Lecture List Section -->');
if(a<0||b<0||a>b) throw new Error('표시 주석을 찾지 못함');
s=s.slice(0,a)+s.slice(b);fs.writeFileSync('lectures.html',s);
console.log('removed', b-a, 'chars', s.includes('id=\"lectureForm\"')?'MISS 폼 남음':'OK 폼 없음', s.includes('id=\"dashboardContent\"')?'MISS 대시보드 남음':'OK 대시보드 없음');"
```
Expected: `removed <숫자> chars OK 폼 없음 OK 대시보드 없음`

- [ ] **Step 2: 지운 마크업을 참조하던 코드 정리**

(a) `DOMContentLoaded` 리스너에서 메인 폼용 세 줄을 지운다.

지울 줄:
```js
            // Main form
            document.getElementById('fee').addEventListener('input', () => updateNetPaymentDisplay('fee', 'taxDeduction', 'netPayment'));
            document.getElementById('taxDeduction').addEventListener('change', () => updateNetPaymentDisplay('fee', 'taxDeduction', 'netPayment'));

```

(b) `// ================ Form Handling ================` 주석(없으면 `document.getElementById('lectureForm').addEventListener('submit', async function(e) {` 줄)부터 그 리스너의 닫는 `});`까지를 지운다. 바로 다음 줄은 `// ================ Sorting & Filtering ================`여야 한다.

Run:
```bash
node -e "
const fs=require('fs');let s=fs.readFileSync('lectures.html','utf8');
const a=s.indexOf(\"        document.getElementById('lectureForm').addEventListener('submit'\"), b=s.indexOf('        // ================ Sorting & Filtering ================');
if(a<0||b<0||a>b) throw new Error('위치를 찾지 못함');
let start=a; const before=s.lastIndexOf('\n        // ====', a); if(before>0 && a-before<120) start=before+1;
s=s.slice(0,start)+s.slice(b);fs.writeFileSync('lectures.html',s);console.log('removed', b-start, 'chars');"
```
Expected: `removed <숫자> chars`

(c) `toggleDashboard` 함수 전체(`function toggleDashboard() {`부터 닫는 `}`와 그 뒤 빈 줄)를 지운다.

(d) 첫 번째 스크립트의 `window.addLecture`에서 없어진 버튼 대신 창의 저장 버튼을 쓴다.

이전(두 군데): `document.getElementById('submitBtn').disabled = true;` / `document.getElementById('submitBtn').disabled = false;`
이후: `document.getElementById('saveEditBtn').disabled = true;` / `document.getElementById('saveEditBtn').disabled = false;`

- [ ] **Step 3: 창 마크업 — 제목 id, 자동완성 연결**

이전: `                <h3 class="modal-title">강의 수정</h3>`
이후: `                <h3 class="modal-title" id="modalTitle">강의 수정</h3>`

입력칸 네 개에 `list` 속성을 붙인다.

- `id="editLectureName" required>` → `id="editLectureName" list="dlName" autocomplete="off" required>`
- `id="editClient" required>` → `id="editClient" list="dlClient" autocomplete="off" required>`
- `id="editContractor">` → `id="editContractor" list="dlContractor" autocomplete="off">`
- `id="editLocation">` → `id="editLocation" list="dlLocation" autocomplete="off">`

`<!-- Toast Container -->` 줄 바로 위에 추가한다.

```html
    <!-- 자동완성 후보 (기존 강의에서 많이 쓴 값) -->
    <datalist id="dlName"></datalist>
    <datalist id="dlClient"></datalist>
    <datalist id="dlContractor"></datalist>
    <datalist id="dlLocation"></datalist>

```

- [ ] **Step 4: 창 함수 — 등록·수정·복제 겸용**

`function editLecture(id) {`부터 `async function saveEdit() {` 함수의 닫는 `}`까지(두 함수 전체)를 다음으로 바꾼다.

```js
        // 창에 값을 채운다. 빈 객체를 주면 빈 창이 된다.
        function fillModal(lecture) {
            document.getElementById('editLectureDate').value = lecture.date || '';
            document.getElementById('editDuration').value = lecture.duration || '';
            document.getElementById('editLectureName').value = lecture.name || '';
            document.getElementById('editClient').value = lecture.client || '';
            document.getElementById('editAudience').value = lecture.audience || '';
            document.getElementById('editContractor').value = lecture.contractor || '';
            document.getElementById('editLocation').value = lecture.location || '';
            document.getElementById('editFee').value = lecture.fee || '';
            document.getElementById('editTaxDeduction').value = lecture.taxDeduction || 'none';
            document.getElementById('editPaymentStatus').value = lecture.paymentStatus || 'pending';
            document.getElementById('editNotes').value = lecture.notes || '';
            if (lecture.netPayment) document.getElementById('editNetPayment').value = lecture.netPayment;
            else updateNetPaymentDisplay('editFee', 'editTaxDeduction', 'editNetPayment');
        }

        function openModal(id, title, saveLabel) {
            document.getElementById('editId').value = id;
            document.getElementById('modalTitle').textContent = title;
            document.getElementById('saveEditBtn').textContent = saveLabel;
            document.getElementById('editModal').classList.add('active');
        }

        // 등록. prefill을 주면 그 값으로 채운다(복제).
        function openCreate(prefill = {}) {
            fillModal(prefill);
            openModal('', '강의 등록', '등록');
            document.getElementById('editLectureDate').focus();
        }

        function editLecture(id) {
            const lecture = window.getLectures().find(l => l.id === id);
            if (!lecture) return;
            fillModal(lecture);
            openModal(lecture.id, '강의 수정', '저장');
        }

        // 복제: 날짜·입금 여부·기타사항·실지급액은 새로 정한다
        function cloneLecture(id) {
            const lecture = window.getLectures().find(l => l.id === id);
            if (!lecture) return;
            openCreate({
                name: lecture.name, client: lecture.client, audience: lecture.audience,
                contractor: lecture.contractor, location: lecture.location, duration: lecture.duration,
                fee: lecture.fee, taxDeduction: lecture.taxDeduction
            });
        }

        // 등록과 수정 겸용: editId가 비어 있으면 등록
        async function saveEdit() {
            const form = document.getElementById('editForm');
            if (!form.reportValidity()) return;
            const id = document.getElementById('editId').value;

            const fee = parseInt(document.getElementById('editFee').value) || 0;
            const taxDeduction = document.getElementById('editTaxDeduction').value;
            const manualNetPayment = parseInt(document.getElementById('editNetPayment').value);
            const netPayment = manualNetPayment || calculateNetPayment(fee, taxDeduction);

            const lectureData = {
                date: document.getElementById('editLectureDate').value,
                duration: parseFloat(document.getElementById('editDuration').value) || 0,
                name: document.getElementById('editLectureName').value.trim(),
                client: document.getElementById('editClient').value.trim(),
                audience: document.getElementById('editAudience').value.trim(),
                contractor: document.getElementById('editContractor').value.trim(),
                location: document.getElementById('editLocation').value.trim(),
                fee: fee,
                taxDeduction: taxDeduction,
                netPayment: netPayment,
                paymentStatus: document.getElementById('editPaymentStatus').value,
                notes: document.getElementById('editNotes').value
            };

            const success = id ? await window.updateLecture(id, lectureData) : await window.addLecture(lectureData);
            if (success) closeModal();
        }

        // 자동완성 후보를 기존 강의에서 다시 만든다
        function updateSuggestions() {
            const lectures = window.getLectures();
            const fields = { dlName: 'name', dlClient: 'client', dlContractor: 'contractor', dlLocation: 'location' };
            Object.keys(fields).forEach(function(listId) {
                const list = document.getElementById(listId);
                list.textContent = '';
                LectureStats.suggestions(lectures, fields[listId]).forEach(function(value) {
                    const option = document.createElement('option');
                    option.value = value;
                    list.appendChild(option);
                });
            });
        }
```

- [ ] **Step 5: 스크립트 태그와 호출 연결**

계산 모듈은 인라인 스크립트가 쓰므로 **첫 번째 인라인 `<script>` 블록보다 앞**에서 `defer` 없이 불러온다. `<div class="toast-container" id="toastContainer"></div>` 줄 다음, 첫 `<script>` 태그 바로 위에 추가한다.

```html
    <script src="js/lecture-stats.js"></script>
```

첫 번째 스크립트의 `loadLectures`에서 `updateYearFilter();` 줄 다음에 추가한다.

```js
                updateSuggestions();
```

목록 섹션 머리의 제목 줄을 바꿔 등록 버튼을 넣는다.

이전: `                <h2 class="section-title">강의 이력</h2>`
이후:
```html
                <div class="section-heading">
                    <h2 class="section-title">강의 이력</h2>
                    <button type="button" class="btn btn-primary" id="createBtn" onclick="openCreate()">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                            <path d="M8 3v10M3 8h10"/>
                        </svg>
                        강의 등록
                    </button>
                </div>
```

CSS: `.section-title {` 규칙의 닫는 `}` 다음에 추가한다.

```css

        .section-heading {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
```

- [ ] **Step 6: 문법과 잔여 참조 확인**

Run: `node -e "const s=require('fs').readFileSync('lectures.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((x,i)=>{new Function(x[1]);console.log('script',i+1,'OK')});for(const k of ['submitBtn','lectureForm','toggleDashboard','dashboardContent',\"getElementById('fee')\"])console.log(s.includes(k)?'MISS 남음: '+k:'OK   없음: '+k)"`
Expected: `script 1 OK`, `script 2 OK`, 다섯 줄 모두 `OK`

- [ ] **Step 7: 커밋**

```bash
git add lectures.html
git commit -m "feat(lectures): 등록·복제를 수정 창으로 통합, 등록 폼 제거, 자동완성"
```

---

### Task 4: 요약 줄, 미수금 필터, 월별 추이, 기본 연도

**Files:**
- Modify: `lectures.html`

**Interfaces:**
- Consumes (Task 1): `LectureStats.summarize`, `LectureStats.monthlyTotals`, `LectureStats.isOutstanding`; 기존 `lastFiltered`, `formatCurrency`, `applyFilters`
- Produces: `updateDashboard(filtered)`(이름 유지, 요약 줄을 그린다), `renderMonthlyChart()`, 입금상태 필터 값 `outstanding`

- [ ] **Step 1: 마크업 — 요약 줄과 월별 추이**

`        <!-- Lecture List Section -->` 줄 바로 위에 추가한다.

```html
        <!-- 요약 줄: 현재 필터에 걸린 강의 기준 -->
        <div class="summary-bar" id="summaryBar" aria-label="현재 목록 요약">
            <div class="summary-item">
                <span class="summary-label">강의</span>
                <span class="summary-value" id="sumCount">-</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">강의료</span>
                <span class="summary-value" id="sumFee">-</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">실지급액</span>
                <span class="summary-value" id="sumNet">-</span>
            </div>
            <button type="button" class="summary-item summary-outstanding" id="outstandingBtn" aria-pressed="false" title="누르면 입금 대기·일부입금 강의만 봅니다">
                <span class="summary-label">미수금 <span id="sumOutstandingCount"></span></span>
                <span class="summary-value" id="sumOutstanding">-</span>
            </button>
            <div class="summary-item">
                <span class="summary-label">교육시간</span>
                <span class="summary-value" id="sumHours">-</span>
            </div>
        </div>

        <!-- 월별 추이: 선택한 연도의 월별 강의료 -->
        <div class="chart-card" id="chartCard" hidden>
            <button type="button" class="chart-toggle" id="chartToggle" aria-expanded="true" aria-controls="chartBody">
                <span id="chartTitle">월별 강의료</span>
                <svg class="toggle-icon" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M4 6l4 4 4-4"/>
                </svg>
            </button>
            <div class="chart-body" id="chartBody">
                <div id="monthlyChart"></div>
                <p class="chart-detail" id="chartDetail" aria-live="polite"></p>
            </div>
        </div>

```

입금상태 필터에 미수 항목을 추가한다.

이전: `                            <option value="partial">일부입금</option>` (`id="paymentFilter"` 선택 상자 안의 것)
이후:
```html
                            <option value="partial">일부입금</option>
                            <option value="outstanding">미수(대기+일부)</option>
```

(수정 창의 `id="editPaymentStatus"` 선택 상자는 건드리지 않는다.)

- [ ] **Step 2: CSS — 대시보드 스타일을 요약 줄·차트 스타일로 교체**

Run (옛 대시보드 CSS 두 구역 제거):
```bash
node -e "
const fs=require('fs');let s=fs.readFileSync('lectures.html','utf8');
function cut(from,to){const a=s.indexOf(from),b=s.indexOf(to);if(a<0||b<0||a>b)throw new Error('구역 없음: '+from);s=s.slice(0,a)+s.slice(b);return b-a;}
console.log('removed', cut('        /* ================ Dashboard ================ */','        /* ================ Section ================ */'), cut('        /* Dashboard Toggle */','        /* ================ Utilities ================ */'));
fs.writeFileSync('lectures.html',s);"
```
Expected: `removed <숫자> <숫자>`

반응형 블록의 옛 규칙을 지운다.

지울 블록:
```css
            .dashboard {
                grid-template-columns: repeat(2, 1fr);
            }

```

`        /* ================ Section ================ */` 줄 바로 위에 추가한다.

```css
        /* ================ Summary & Chart ================ */
        .summary-bar {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .summary-item {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            padding: 1rem 1.25rem;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow);
            text-align: left;
            font-family: inherit;
            color: inherit;
            min-width: 0;
        }

        .summary-label {
            font-size: 0.8125rem;
            color: var(--text-secondary);
        }

        .summary-value {
            font-size: 1.375rem;
            font-weight: 700;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .summary-outstanding {
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
        }

        .summary-outstanding .summary-value {
            color: var(--warning);
        }

        .summary-outstanding:hover,
        .summary-outstanding[aria-pressed="true"] {
            border-color: var(--warning);
            background: rgba(245, 158, 11, 0.08);
        }

        .chart-card {
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow);
            margin-bottom: 1rem;
        }

        .chart-toggle {
            width: 100%;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.875rem 1.25rem;
            background: none;
            border: none;
            font-family: inherit;
            font-size: 0.9375rem;
            font-weight: 600;
            color: var(--text-primary);
            cursor: pointer;
        }

        .chart-toggle .toggle-icon {
            transition: transform 0.2s;
        }

        .chart-toggle[aria-expanded="true"] .toggle-icon {
            transform: rotate(180deg);
        }

        .chart-body {
            padding: 0 1.25rem 1rem;
        }

        .chart-body[hidden] {
            display: none;
        }

        #monthlyChart svg {
            display: block;
            width: 100%;
            height: auto;
        }

        #monthlyChart .bar {
            fill: var(--primary);
            opacity: 0.75;
            cursor: pointer;
        }

        #monthlyChart .bar:hover,
        #monthlyChart .bar:focus,
        #monthlyChart .bar.selected {
            opacity: 1;
            outline: none;
        }

        #monthlyChart .bar.empty {
            fill: var(--border-color);
        }

        #monthlyChart text {
            fill: var(--text-secondary);
            font-size: 11px;
            font-family: var(--font-primary);
        }

        .chart-detail {
            margin-top: 0.5rem;
            min-height: 1.4em;
            font-size: 0.8125rem;
            color: var(--text-secondary);
        }

```

반응형 블록(`@media (max-width: 768px) {`) 안, `.container {` 규칙 다음에 추가한다.

```css

            .summary-bar {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }

            .summary-item {
                padding: 0.75rem 0.875rem;
            }

            .summary-value {
                font-size: 1.0625rem;
            }
```

- [ ] **Step 3: 필터에 미수 값 반영**

`applyFilters` 안의 입금상태 조건을 바꾼다.

이전:
```js
            if (paymentFilter !== 'all') {
                filtered = filtered.filter(l => l.paymentStatus === paymentFilter);
            }

            // Apply sorting
```
이후:
```js
            if (paymentFilter === 'outstanding') {
                filtered = filtered.filter(LectureStats.isOutstanding);
            } else if (paymentFilter !== 'all') {
                filtered = filtered.filter(l => l.paymentStatus === paymentFilter);
            }

            // Apply sorting
```

같은 함수 끝의 호출을 바꾼다.

이전:
```js
            renderLectures(filtered);
            updateDashboard(filtered);
        }
```
이후:
```js
            renderLectures(filtered);
            updateDashboard(filtered);
            renderMonthlyChart();
        }
```

- [ ] **Step 4: 요약 줄과 월별 추이 함수**

`function updateDashboard(filtered) {`부터 닫는 `}`까지를 다음으로 바꾼다.

```js
        // 요약 줄: 현재 필터에 걸린 강의 기준
        function updateDashboard(filtered) {
            const s = LectureStats.summarize(filtered || lastFiltered);
            document.getElementById('sumCount').textContent = s.count.toLocaleString() + '건';
            document.getElementById('sumFee').textContent = s.sumFee ? formatCurrency(s.sumFee) : '₩0';
            document.getElementById('sumNet').textContent = s.sumNet ? formatCurrency(s.sumNet) : '₩0';
            document.getElementById('sumOutstanding').textContent = s.outstandingNet ? formatCurrency(s.outstandingNet) : '₩0';
            document.getElementById('sumOutstandingCount').textContent = s.outstandingCount ? `(${s.outstandingCount}건)` : '';
            document.getElementById('sumHours').textContent = s.sumHours.toLocaleString() + '시간';
            document.getElementById('outstandingBtn').setAttribute('aria-pressed',
                document.getElementById('paymentFilter').value === 'outstanding' ? 'true' : 'false');
        }

        // 미수금을 누르면 미수만 보고, 다시 누르면 전체로 돌아간다
        document.getElementById('outstandingBtn').addEventListener('click', function() {
            const select = document.getElementById('paymentFilter');
            select.value = select.value === 'outstanding' ? 'all' : 'outstanding';
            applyFilters();
        });

        // 월별 추이: 선택한 연도의 월별 강의료(다른 필터와 무관하게 그 연도 전체)
        const CHART_KEY = 'ailab_lectures_chart';

        function setChartOpen(open) {
            document.getElementById('chartToggle').setAttribute('aria-expanded', open ? 'true' : 'false');
            document.getElementById('chartBody').hidden = !open;
        }

        document.getElementById('chartToggle').addEventListener('click', function() {
            const open = this.getAttribute('aria-expanded') !== 'true';
            setChartOpen(open);
            try { localStorage.setItem(CHART_KEY, open ? 'open' : 'closed'); } catch (e) { /* 저장 불가 */ }
        });
        setChartOpen(localStorage.getItem(CHART_KEY) !== 'closed');

        function renderMonthlyChart() {
            const year = document.getElementById('yearFilter').value;
            const card = document.getElementById('chartCard');
            if (year === 'all') { card.hidden = true; return; }
            card.hidden = false;

            const months = LectureStats.monthlyTotals(window.getLectures(), year);
            const total = months.reduce((sum, m) => sum + m.sumFee, 0);
            document.getElementById('chartTitle').textContent = `${year}년 월별 강의료 · 합계 ${total ? formatCurrency(total) : '₩0'}`;

            const selectedMonth = document.getElementById('monthFilter').value;
            const W = 720, H = 150, top = 8, bottom = 22, slot = W / 12, barW = slot * 0.62;
            const max = Math.max(1, ...months.map(m => m.sumFee));
            const bars = months.map((m, i) => {
                const h = m.sumFee ? Math.max(3, (H - top - bottom) * m.sumFee / max) : 3;
                const x = slot * i + (slot - barW) / 2;
                const cls = 'bar' + (m.sumFee ? '' : ' empty') + (m.month === selectedMonth ? ' selected' : '');
                const label = `${parseInt(m.month)}월: ${m.count}건, 강의료 ${m.sumFee ? formatCurrency(m.sumFee) : '₩0'}, 실지급액 ${m.sumNet ? formatCurrency(m.sumNet) : '₩0'}`;
                return `<rect class="${cls}" x="${x.toFixed(1)}" y="${(H - bottom - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" tabindex="0" role="img" aria-label="${escapeHtml(label)}" data-label="${escapeHtml(label)}"></rect>`
                    + `<text x="${(slot * i + slot / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${parseInt(m.month)}월</text>`;
            }).join('');
            document.getElementById('monthlyChart').innerHTML =
                `<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="${escapeHtml(year)}년 월별 강의료 막대 차트">${bars}</svg>`;
            document.getElementById('chartDetail').textContent = '막대에 마우스를 올리거나 누르면 그 달의 건수와 금액이 보입니다.';
        }

        // 막대에 올리거나 누르면 그 달의 내용을 보여준다
        ['mouseover', 'focusin', 'click'].forEach(function(type) {
            document.getElementById('monthlyChart').addEventListener(type, function(e) {
                const bar = e.target.closest('.bar');
                if (bar) document.getElementById('chartDetail').textContent = bar.dataset.label;
            });
        });
```

- [ ] **Step 5: 기본 연도를 올해로, 중복 호출 제거**

첫 번째 스크립트의 `loadLectures`를 고친다.

이전:
```js
                updateYearFilter();
                updateSuggestions();
                applyFilters();
                updateDashboard();
```
이후:
```js
                updateYearFilter();
                selectDefaultYear();
                updateSuggestions();
                applyFilters();
```

(`updateDashboard()`를 인자 없이 한 번 더 부르던 줄을 지운다. `applyFilters`가 이미 걸러진 목록으로 부른다.)

두 번째 스크립트의 `function updateYearFilter() {` 바로 위에 추가한다.

```js
        // 처음 한 번만: 연도 필터의 기본값을 올해(한국시간)로. 올해 데이터가 없으면 전체 그대로.
        let defaultYearApplied = false;
        function selectDefaultYear() {
            if (defaultYearApplied) return;
            defaultYearApplied = true;
            const thisYear = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 4);
            const select = document.getElementById('yearFilter');
            if ([...select.options].some(o => o.value === thisYear)) {
                select.value = thisYear;
                updateMonthFilter();
            }
        }

```

- [ ] **Step 6: 문법과 잔여 참조 확인**

Run: `node -e "const s=require('fs').readFileSync('lectures.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((x,i)=>{new Function(x[1]);console.log('script',i+1,'OK')});for(const k of ['totalLectures','totalRevenue','paidCount','stat-card','dashboard-section'])console.log(s.includes(k)?'MISS 남음: '+k:'OK   없음: '+k)"`
Expected: `script 1 OK`, `script 2 OK`, 다섯 줄 모두 `OK`

- [ ] **Step 7: 커밋**

```bash
git add lectures.html
git commit -m "feat(lectures): 요약 줄·미수금 필터·월별 추이, 기본 연도를 올해로"
```

---

### Task 5: 도구줄 정리, Excel 내보내기 수정, 표 머리글 고정

**Files:**
- Modify: `lectures.html`

**Interfaces:**
- Consumes: 기존 `exportToExcel`, `exportData`, `importData`, `lastFiltered`
- Produces: 도구줄의 "더보기" 메뉴(`<details class="more-menu" id="moreMenu">`), CSS 변수 `--header-height`

- [ ] **Step 1: 상단 메뉴에서 내보내기·가져오기 제거**

`<div class="header-actions" id="headerActions">` 안에서 다음 블록(버튼 둘과 파일 입력)을 지운다.

```html
                <button class="btn btn-secondary" onclick="exportData()">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 1v10M4 7l4 4 4-4M2 13h12"/>
                    </svg>
                    내보내기
                </button>
                <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M8 11V1M4 5l4-4 4 4M2 13h12"/>
                    </svg>
                    가져오기
                </button>
                <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
```

- [ ] **Step 2: 도구줄에 "더보기" 메뉴**

목록 도구줄의 Excel 버튼을 바꾼다.

이전:
```html
                    <button class="btn btn-secondary" onclick="exportToExcel()">
                        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M8 1v10M4 7l4 4 4-4M2 13h12"/>
                        </svg>
                        Excel 다운로드
                    </button>
```
이후:
```html
                    <details class="more-menu" id="moreMenu">
                        <summary class="btn btn-secondary">더보기</summary>
                        <div class="more-menu-list">
                            <button type="button" onclick="exportToExcel()">Excel 다운로드 (보이는 목록)</button>
                            <button type="button" onclick="exportData()">JSON 내보내기 (전체)</button>
                            <button type="button" onclick="document.getElementById('importFile').click()">JSON 가져오기</button>
                        </div>
                    </details>
                    <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">
```

CSS: `        /* ================ Table ================ */` 줄 바로 위에 추가한다.

```css
        .more-menu {
            position: relative;
        }

        .more-menu summary {
            list-style: none;
            user-select: none;
        }

        .more-menu summary::-webkit-details-marker {
            display: none;
        }

        .more-menu-list {
            position: absolute;
            right: 0;
            top: calc(100% + 0.375rem);
            z-index: 20;
            min-width: 220px;
            padding: 0.375rem;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            box-shadow: var(--shadow-lg);
            display: flex;
            flex-direction: column;
        }

        .more-menu-list button {
            padding: 0.625rem 0.75rem;
            border: none;
            border-radius: calc(var(--radius) - 2px);
            background: none;
            text-align: left;
            font-family: inherit;
            font-size: 0.875rem;
            color: var(--text-primary);
            cursor: pointer;
        }

        .more-menu-list button:hover {
            background: var(--bg-tertiary);
        }

```

반응형 블록에서 필터 격자 규칙을 넓혀 "더보기"도 한 줄을 차지하게 한다.

이전:
```css
            .filters .search-group,
            .filters > .btn {
                grid-column: 1 / -1;
            }

            .filters > .btn {
                justify-content: center;
            }
```
이후:
```css
            .filters .search-group,
            .filters > .more-menu {
                grid-column: 1 / -1;
            }

            .filters > .more-menu summary {
                justify-content: center;
                width: 100%;
            }

            .more-menu-list {
                left: 0;
            }

            .section-heading {
                width: 100%;
                justify-content: space-between;
            }
```

두 번째 스크립트의 `// ================ 모바일 헤더 메뉴 ================` 주석 바로 위에 추가한다.

```js
        // "더보기" 메뉴: 항목을 누르거나 바깥을 누르면 닫는다
        document.addEventListener('click', function(e) {
            const menu = document.getElementById('moreMenu');
            if (menu.open && (!menu.contains(e.target) || e.target.closest('.more-menu-list button'))) menu.open = false;
        });

```

- [ ] **Step 3: Excel 다운로드가 화면의 목록을 그대로 쓰게**

`exportToExcel` 안에서 필터를 다시 계산하던 부분을 바꾼다.

이전:
```js
            const lectures = window.getLectures();
            const yearFilter = document.getElementById('yearFilter').value;
            const monthFilter = document.getElementById('monthFilter').value;
            const paymentFilter = document.getElementById('paymentFilter').value;

            // Apply current filters
            let filtered = [...lectures];
            if (yearFilter !== 'all') {
                filtered = filtered.filter(l => l.date && l.date.startsWith(yearFilter));
            }
            if (monthFilter !== 'all' && yearFilter !== 'all') {
                filtered = filtered.filter(l => l.date && l.date.substring(5, 7) === monthFilter);
            }
            if (paymentFilter !== 'all') {
                filtered = filtered.filter(l => l.paymentStatus === paymentFilter);
            }

            // Sort by date descending
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

```
이후:
```js
            const yearFilter = document.getElementById('yearFilter').value;
            const monthFilter = document.getElementById('monthFilter').value;

            // 화면에 보이는 목록 그대로(검색어·필터·정렬 포함)
            const filtered = lastFiltered.slice();

```

- [ ] **Step 4: 표 머리글 고정(넓은 화면)**

CSS: `        /* Fixed column widths */` 줄 바로 위에 추가한다.

```css
        /* 표가 가로 스크롤 없이 들어가는 폭에서는 머리글을 상단 메뉴 아래에 고정한다 */
        @media (min-width: 1400px) {
            .table-wrapper {
                overflow-x: visible;
            }

            .table th {
                top: var(--header-height, 77px);
            }
        }

```

두 번째 스크립트의 `// "더보기" 메뉴:` 주석 바로 위에 추가한다.

```js
        // 표 머리글 고정 위치 = 상단 메뉴 높이
        function syncHeaderHeight() {
            const header = document.querySelector('.header');
            if (header) document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
        }
        window.addEventListener('resize', syncHeaderHeight);
        window.addEventListener('ailab:data-changed', syncHeaderHeight);
        syncHeaderHeight();

```

로그인 직후에도 높이를 맞추도록 `updateUserUI`의 마지막에 호출을 넣는다(헤더는 로그인 전에는 숨겨져 높이가 0이다).

이전:
```js
                document.getElementById('userName').textContent = user.email;
            }
        }
```
이후:
```js
                document.getElementById('userName').textContent = user.email;
            }
            if (typeof syncHeaderHeight === 'function') syncHeaderHeight();
        }
```

설계 문서의 고정 기준 폭을 실제 값으로 고친다(`docs/superpowers/specs/2026-11-12-admin-screens-design.md`).

이전: `- 표 머리글은 스크롤해도 상단 메뉴 바로 아래에 고정된다(1281px 이상. 그보다 좁으면 표가`
이후: `- 표 머리글은 스크롤해도 상단 메뉴 바로 아래에 고정된다(1400px 이상. 그보다 좁으면 표가`

- [ ] **Step 5: 문법 확인과 커밋**

Run: `node -e "const s=require('fs').readFileSync('lectures.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((x,i)=>{new Function(x[1]);console.log('script',i+1,'OK')});console.log((s.match(/id=\"importFile\"/g)||[]).length===1?'OK   importFile 1개':'MISS importFile 개수')"`
Expected: `script 1 OK`, `script 2 OK`, `OK   importFile 1개`

```bash
git add lectures.html docs/superpowers/specs/2026-11-12-admin-screens-design.md
git commit -m "feat(lectures): 도구줄 더보기 메뉴, Excel은 보이는 목록 그대로, 표 머리글 고정"
```

---

### Task 6: 화면 검증

**Files:** 없음(검증만. 문제가 나오면 해당 태스크의 코드를 고치고 다시 커밋한다)

**Interfaces:**
- Consumes: Task 1~5의 결과 전체

- [ ] **Step 1: 검증 스크립트 준비**

`puppeteer-core`가 설치된 임시 폴더에 저장한다. 가짜 API(메모리 안의 강의 목록, GET·POST·PUT·DELETE)로 화면을 띄워 확인한다.

<!-- scratch: lectures-check.mjs -->
```js
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';

const ROOT = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 3600;
const tokens = { idToken: `${b64({ alg: 'none' })}.${b64({ email: 'admin@example.com', exp })}.x`, refreshToken: 'fake', exp };
const THIS_YEAR = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 4);
const LAST_YEAR = String(Number(THIS_YEAR) - 1);

// 전부 가상 데이터
const co = ['가나전자', '다라중공업', '마바식품', '사아은행', '자차제약'];
const nm = ['AI 리더십 워크숍', '생성형 AI 리터러시', '바이브코딩 실습'];
function seed() {
  const list = Array.from({ length: 70 }, (_, i) => ({
    id: 'L' + i, createdAt: '2026-01-01T00:00:00.000Z',
    date: `${i < 50 ? THIS_YEAR : LAST_YEAR}-${String(i % 12 + 1).padStart(2, '0')}-${String(i % 27 + 1).padStart(2, '0')}`,
    duration: 2 + (i % 4), name: nm[i % 3], client: co[i % 5], audience: '팀장 30명', contractor: i % 2 ? '직접' : '교육기관A',
    location: i % 3 ? '서울 본사' : '온라인(Zoom)', fee: 1000000 + (i % 7) * 500000, taxDeduction: ['3.3', '8.8', 'vat', 'none'][i % 4],
    paymentStatus: ['paid', 'paid', 'pending', 'partial'][i % 4], notes: '',
  }));
  list.push({ id: 'X1', date: `${THIS_YEAR}-06-15`, name: '"><img src=x onerror=alert(1)>', client: `O'Reilly "Media"`, fee: 500000, taxDeduction: 'none', paymentStatus: '<b>이상값</b>', duration: 1 });
  return list;
}
const net = (l) => l.netPayment || (!l.fee ? 0 : l.taxDeduction === '3.3' ? Math.round(l.fee * 0.967) : l.taxDeduction === '8.8' ? Math.round(l.fee * 0.912) : l.taxDeduction === 'vat' ? Math.round(l.fee * 1.1) : l.fee);
const won = (n) => new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n);

const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--allow-file-access-from-files', '--hide-scrollbars'] });
let failures = 0;
const check = (name, ok, extra) => { if (!ok) failures++; console.log(ok ? 'OK  ' : 'FAIL', name, ok ? '' : (extra === undefined ? '' : JSON.stringify(extra))); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(viewport) {
  const db = seed();
  const calls = [];
  const errors = [];
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('dialog', async (d) => { errors.push('dialog: ' + d.message()); await d.dismiss(); });
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    const u = r.url(), m = r.method();
    const json = (status, o) => r.respond({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (u.includes('execute-api') && m === 'OPTIONS') return r.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const path = u.split('/prod')[1] || '';
    if (path === '/lectures' && m === 'GET') return json(200, { items: db });
    if (path === '/lectures' && m === 'POST') { const body = JSON.parse(r.postData()); calls.push({ m, body }); const item = { ...body, id: body.id || 'N' + calls.length }; db.push(item); return json(201, { item }); }
    if (path.startsWith('/lectures/') && m === 'PUT') { const id = decodeURIComponent(path.slice(10)); const body = JSON.parse(r.postData()); calls.push({ m, id, body }); Object.assign(db.find((l) => l.id === id), body); return json(200, { ok: true }); }
    if (path.startsWith('/lectures/') && m === 'DELETE') { const id = decodeURIComponent(path.slice(10)); calls.push({ m, id }); db.splice(db.findIndex((l) => l.id === id), 1); return json(200, { ok: true }); }
    if (u.includes('execute-api') || u.includes('cognito-idp')) return r.abort();
    if (u.includes('cdn.sheetjs.com')) return r.respond({ status: 200, contentType: 'application/javascript', body: 'window.XLSX={utils:{book_new:()=>({}),json_to_sheet:(rows)=>{window.__xlsRows=rows;return {}},book_append_sheet(){}},writeFile(wb,name){window.__xlsName=name}};' });
    r.continue();
  });
  await page.evaluateOnNewDocument((t) => localStorage.setItem('ailab_tokens', JSON.stringify(t)), tokens);
  await page.goto(pathToFileURL(ROOT + '/lectures.html').href, { waitUntil: 'load' });
  await wait(1500);
  return { page, db, calls, errors };
}

const rowsOf = (page) => page.evaluate(() => document.querySelectorAll('#lectureTableBody tr:not(.load-more-row)').length);
const text = (page, sel) => page.evaluate((s) => (document.querySelector(s) || {}).textContent, sel);
const setFilter = (page, id, value) => page.evaluate((i, v) => { const el = document.getElementById(i); el.value = v; el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, id, value);

// ───────── 데스크톱 ─────────
{
  const { page, db, calls, errors } = await open({ width: 1440, height: 900 });
  const thisYear = db.filter((l) => l.date.startsWith(THIS_YEAR));
  const outstanding = thisYear.filter((l) => l.paymentStatus === 'pending' || l.paymentStatus === 'partial');

  check('등록 폼과 대시보드 섹션이 없다', await page.evaluate(() => !document.getElementById('lectureForm') && !document.querySelector('.dashboard-section')));
  check('기본 연도가 올해다', await page.evaluate(() => document.getElementById('yearFilter').value) === THIS_YEAR);
  check('목록이 올해 건수와 같다', await rowsOf(page) === thisYear.length, await rowsOf(page));
  check('요약: 건수', await text(page, '#sumCount') === thisYear.length + '건', await text(page, '#sumCount'));
  check('요약: 강의료 합', await text(page, '#sumFee') === won(thisYear.reduce((s, l) => s + l.fee, 0)), await text(page, '#sumFee'));
  check('요약: 실지급액 합', await text(page, '#sumNet') === won(thisYear.reduce((s, l) => s + net(l), 0)), await text(page, '#sumNet'));
  check('요약: 미수금과 건수', await text(page, '#sumOutstanding') === won(outstanding.reduce((s, l) => s + net(l), 0)) && await text(page, '#sumOutstandingCount') === `(${outstanding.length}건)`, [await text(page, '#sumOutstanding'), await text(page, '#sumOutstandingCount')]);
  check('목록이 첫 화면 안에서 시작한다', await page.evaluate(() => document.getElementById('lectureTable').getBoundingClientRect().top < innerHeight));

  check('월별 추이: 막대 12개', await page.evaluate(() => !document.getElementById('chartCard').hidden && document.querySelectorAll('#monthlyChart .bar').length === 12));
  await page.hover('#monthlyChart .bar:not(.empty)');
  check('월별 추이: 막대에 올리면 내용이 보인다', /월: \d+건, 강의료/.test(await text(page, '#chartDetail')), await text(page, '#chartDetail'));
  await page.click('#chartToggle');
  check('월별 추이: 접힘 상태를 기억한다', await page.evaluate(() => document.getElementById('chartBody').hidden && localStorage.getItem('ailab_lectures_chart') === 'closed'));
  await page.click('#chartToggle');
  await setFilter(page, 'yearFilter', 'all');
  check('연도가 전체면 월별 추이를 숨긴다', await page.evaluate(() => document.getElementById('chartCard').hidden));
  check('전체 연도의 건수', await rowsOf(page) === db.length, await rowsOf(page));
  await setFilter(page, 'yearFilter', THIS_YEAR);

  await page.click('#outstandingBtn');
  check('미수금을 누르면 미수만 보인다', await page.evaluate(() => document.getElementById('paymentFilter').value) === 'outstanding' && await rowsOf(page) === outstanding.length && await page.evaluate(() => document.getElementById('outstandingBtn').getAttribute('aria-pressed')) === 'true', await rowsOf(page));
  await page.click('#outstandingBtn');
  check('다시 누르면 전체로 돌아간다', await page.evaluate(() => document.getElementById('paymentFilter').value) === 'all' && await rowsOf(page) === thisYear.length);

  // XSS
  check('따옴표·태그가 든 값이 화면을 깨지 않는다', await page.evaluate(() => !document.querySelector('#lectureTableBody img') && !document.querySelector('#lectureTableBody b')) && !errors.some((e) => e.startsWith('dialog')));
  check('title 속성에 원문이 그대로 들어 있다', await page.evaluate(() => [...document.querySelectorAll('#lectureTableBody td.col-client')].some((td) => td.getAttribute('title') === `O'Reilly "Media"`)));

  // 등록
  await page.click('#createBtn');
  check('등록 창: 제목·버튼·빈 값', await text(page, '#modalTitle') === '강의 등록' && await text(page, '#saveEditBtn') === '등록' && await page.evaluate(() => document.getElementById('editLectureName').value === '' && document.getElementById('editId').value === ''));
  await page.click('#saveEditBtn');
  await wait(300);
  check('필수 값 없이는 저장하지 않는다', calls.length === 0 && await page.evaluate(() => document.getElementById('editModal').classList.contains('active')));
  await page.evaluate((y) => { document.getElementById('editLectureDate').value = y + '-11-20'; }, THIS_YEAR);
  await page.type('#editLectureName', '팀장 과정');
  await page.type('#editClient', '새회사');
  await page.type('#editFee', '2000000');
  await page.select('#editTaxDeduction', '3.3');
  check('실지급액 자동 계산', await page.evaluate(() => document.getElementById('editNetPayment').value) === '1934000');
  await page.click('#saveEditBtn');
  await wait(800);
  check('등록: POST 본문', calls.length === 1 && calls[0].m === 'POST' && calls[0].body.name === '팀장 과정' && calls[0].body.client === '새회사' && calls[0].body.netPayment === 1934000 && calls[0].body.paymentStatus === 'pending' && !('id' in calls[0].body), calls[0]);
  check('등록 후 창이 닫히고 목록이 늘었다', await page.evaluate(() => !document.getElementById('editModal').classList.contains('active')) && await rowsOf(page) === thisYear.length + 1);
  check('자동완성 후보에 기존 값이 있다', await page.evaluate(() => [...document.querySelectorAll('#dlClient option')].some((o) => o.value === '가나전자') && document.getElementById('editClient').getAttribute('list') === 'dlClient'));

  // 복제
  await page.click('#lectureTableBody button[data-action="clone"][data-id="L2"]');
  check('복제: 내용은 채우고 날짜는 비운다', await page.evaluate(() => document.getElementById('editLectureName').value === '바이브코딩 실습' && document.getElementById('editClient').value === '마바식품' && document.getElementById('editLectureDate').value === '' && document.getElementById('editPaymentStatus').value === 'pending' && document.getElementById('editId').value === '') && await text(page, '#modalTitle') === '강의 등록');
  await page.keyboard.press('Escape');

  // 수정
  await page.click('#lectureTableBody button[data-action="edit"][data-id="L2"]');
  check('수정 창: 제목·버튼', await text(page, '#modalTitle') === '강의 수정' && await text(page, '#saveEditBtn') === '저장');
  await page.select('#editPaymentStatus', 'paid');
  await page.click('#saveEditBtn');
  await wait(800);
  check('수정: PUT', calls.at(-1).m === 'PUT' && calls.at(-1).id === 'L2' && calls.at(-1).body.paymentStatus === 'paid', calls.at(-1));

  // 삭제와 되돌리기
  const before = await rowsOf(page);
  await page.click('#lectureTableBody button[data-action="delete"][data-id="L6"]');
  await wait(800);
  check('삭제: 확인 창 없이 DELETE', calls.at(-1).m === 'DELETE' && calls.at(-1).id === 'L6' && await rowsOf(page) === before - 1 && !errors.some((e) => e.startsWith('dialog')));
  check('되돌리기 알림이 보인다', await text(page, '.toast-action') === '되돌리기');
  await page.click('.toast-action');
  await wait(800);
  check('되돌리기: 같은 id로 다시 만든다', calls.at(-1).m === 'POST' && calls.at(-1).body.id === 'L6' && calls.at(-1).body.createdAt === '2026-01-01T00:00:00.000Z' && await rowsOf(page) === before, calls.at(-1));

  // Excel
  await setFilter(page, 'searchInput', '가나');
  const shown = await rowsOf(page);
  await page.click('#moreMenu summary');
  await page.evaluate(() => document.querySelector('#moreMenu .more-menu-list button').click());
  await wait(300);
  check('Excel: 검색어가 반영된 보이는 목록 + 합계 행', await page.evaluate(() => (window.__xlsRows || []).length) === shown + 1 && shown > 0 && shown < thisYear.length, [shown, await page.evaluate(() => (window.__xlsRows || []).length)]);
  check('더보기 메뉴가 닫힌다', await page.evaluate(() => !document.getElementById('moreMenu').open));
  await setFilter(page, 'searchInput', '');

  // 머리글 고정
  await page.evaluate(() => scrollTo(0, document.getElementById('lectureTable').getBoundingClientRect().top + scrollY + 1500));
  await wait(300);
  check('스크롤해도 표 머리글이 상단 메뉴 아래에 보인다', await page.evaluate(() => { const th = document.querySelector('#lectureTable thead th').getBoundingClientRect(); const h = document.querySelector('.header').getBoundingClientRect(); return Math.abs(th.top - h.bottom) < 3; }), await page.evaluate(() => [document.querySelector('#lectureTable thead th').getBoundingClientRect().top, document.querySelector('.header').getBoundingClientRect().bottom]));
  check('가로 넘침 없음(1440)', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('콘솔 오류 없음(데스크톱)', errors.length === 0, errors);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'lectures-desktop.jpg', type: 'jpeg', quality: 70 });
  await page.close();
}

// ───────── 모바일 ─────────
{
  const { page, errors } = await open({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  check('모바일: 가로 넘침 없음', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  check('모바일: 요약 줄이 2열로 넘치지 않는다', await page.evaluate(() => [...document.querySelectorAll('.summary-item')].every((el) => el.getBoundingClientRect().right <= innerWidth + 0.5)));
  check('모바일: 카드에 버튼 3개, 30건씩', await page.evaluate(() => document.querySelectorAll('#lectureTableBody tr:first-child button[data-action]').length === 3 && document.querySelectorAll('#lectureTableBody tr:not(.load-more-row)').length === 30 && !!document.querySelector('.load-more-row')));
  check('모바일: 카드가 화면 밖으로 나가지 않는다', await page.evaluate(() => [...document.querySelectorAll('#lectureTableBody tr')].every((tr) => [...tr.children].every((td) => !td.offsetParent || td.getBoundingClientRect().right <= innerWidth + 0.5))));
  await page.tap('#createBtn');
  check('모바일: 등록 창이 열린다', await page.evaluate(() => document.getElementById('editModal').classList.contains('active')));
  await page.keyboard.press('Escape');
  await page.tap('#moreMenu summary');
  check('모바일: 더보기 메뉴가 화면 안에 열린다', await page.evaluate(() => { const r = document.querySelector('.more-menu-list').getBoundingClientRect(); return document.getElementById('moreMenu').open && r.left >= 0 && r.right <= innerWidth + 0.5; }));
  check('콘솔 오류 없음(모바일)', errors.length === 0, errors);
  await page.evaluate(() => { document.getElementById('moreMenu').open = false; scrollTo(0, 0); });
  await page.screenshot({ path: 'lectures-mobile.jpg', type: 'jpeg', quality: 70 });
  await page.close();
}

await browser.close();
console.log(failures ? `\n실패 ${failures}건` : '\n모두 통과');
process.exitCode = failures ? 1 : 0;
```

- [ ] **Step 2: 실행**

Run: `node lectures-check.mjs "<저장소 루트 절대 경로>"`
Expected: 모든 줄이 `OK`, 마지막 줄 `모두 통과`

`lectures-desktop.jpg`와 `lectures-mobile.jpg`를 열어 배치가 깨지지 않았는지 눈으로 확인한다.

- [ ] **Step 3: 기존 검증 다시 실행**

Run: `node --test "js/test/*.test.mjs" && node --test "aws/lambda/test/*.test.mjs"`
Expected: 두 번 모두 `# fail 0`

AI 비서 패널 검증(`panel-check.mjs`, 이전 계획의 Task 7)을 다시 돌려 12항목이 모두 `OK`인지 확인한다. 패널은 `lectures.html`을 띄워 검사하므로 이번 변경의 회귀를 함께 잡는다.

- [ ] **Step 4: 실패가 있었다면**

실패한 항목의 원인을 해당 태스크의 코드에서 고치고, 검증을 다시 통과시킨 뒤 커밋한다.

```bash
git add lectures.html
git commit -m "fix(lectures): 화면 검증에서 드러난 문제 수정"
```

---

## Self-Review 결과

- **설계 대비:** 화면 구성(Task 3·4), 요약 줄 다섯 값과 미수금 필터(Task 4), 월별 추이와 접힘 기억(Task 4), 기본 연도·머리글 고정·도구줄(Task 4·5), 등록·수정·복제 한 창과 자동완성(Task 3), 삭제 되돌리기(Task 2), 고칠 문제 네 가지(Task 2·5), 파일 구성(Task 1). 누락 없음.
- **설계와 달라진 점:** 머리글 고정 기준을 1281px에서 1400px로 바꿨다. 버튼이 세 개가 되며 표 최소 폭이 1240px가 돼, 가로 스크롤 없이 들어가는 폭이 그만큼 넓어졌기 때문이다. Task 5에서 설계 문서도 함께 고친다.
- **이름 일치:** `showToast`의 세 번째 인자, `data-action` 값(`edit`·`clone`·`delete`), `openCreate`·`cloneLecture`·`editLecture`·`saveEdit`·`updateSuggestions`·`selectDefaultYear`·`renderMonthlyChart`·`syncHeaderHeight`, 요소 id(`createBtn`·`modalTitle`·`outstandingBtn`·`chartCard`·`chartToggle`·`chartBody`·`monthlyChart`·`chartDetail`·`moreMenu`·`sumCount`·`sumFee`·`sumNet`·`sumOutstanding`·`sumOutstandingCount`·`sumHours`)가 만드는 태스크와 검증 스크립트에서 같다.

## 실행 중 달라진 점 (2026-11-13)

화면 검증(Task 6)에서 드러나 계획의 코드와 다르게 고친 것:

- **알림 위치**: 알림이 오른쪽 아래 AI 비서 버튼에 가려 "되돌리기"를 누를 수 없었다. 알림 영역을 버튼 위(`bottom: 5.75rem`)로 올렸다.
- **월별 추이 크기**: SVG를 고정 좌표(720×150)로 그려 폭에 맞춰 확대하면 데스크톱에서는 너무 커지고 모바일에서는 글자가 작아졌다. 실제 폭에 맞춰 높이 120px로 그리고, 창 폭이 바뀌거나 펼칠 때 다시 그린다.
- **월별 추이 기본 상태**: 저장된 선택이 없으면 768px 초과에서는 펼치고 그 이하에서는 접는다.
- **모바일 요약 줄**: 교육시간 칸을 숨기고 건수 옆에 함께 보여줘 2×2로 줄였다.
