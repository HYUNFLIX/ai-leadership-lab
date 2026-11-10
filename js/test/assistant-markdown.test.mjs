import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { render } = createRequire(import.meta.url)('../assistant-markdown.js');

test('문단과 줄바꿈', () => {
  assert.equal(render('첫 줄\n둘째 줄\n\n다음 문단'), '<p>첫 줄<br>둘째 줄</p><p>다음 문단</p>');
  assert.equal(render(''), '');
  assert.equal(render(null), '');
});

test('HTML은 이스케이프한다', () => {
  assert.equal(render('<script>alert(1)</script>'), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(render('| a<b> |\n|---|\n| "x" |'), '<table><thead><tr><th>a&lt;b&gt;</th></tr></thead><tbody><tr><td>&quot;x&quot;</td></tr></tbody></table>');
});

test('굵게와 코드', () => {
  assert.equal(render('**합계** 는 `sum_fee`'), '<p><strong>합계</strong> 는 <code>sum_fee</code></p>');
});

test('제목은 패널 크기에 맞게 h3부터', () => {
  assert.equal(render('# 큰 제목\n## 중간\n### 작은'), '<h3>큰 제목</h3><h4>중간</h4><h5>작은</h5>');
});

test('글머리표 목록과 번호 목록', () => {
  assert.equal(render('- 하나\n- **둘**\n\n1. 첫째\n2. 둘째'), '<ul><li>하나</li><li><strong>둘</strong></li></ul><ol><li>첫째</li><li>둘째</li></ol>');
});

test('표', () => {
  const md = '| 월 | 건수 | 강의료 |\n|---|---:|---:|\n| 2026-10 | 2 | 5,000,000 |\n| 2026-11 | 1 | 1,000,000 |';
  assert.equal(render(md),
    '<table><thead><tr><th>월</th><th>건수</th><th>강의료</th></tr></thead><tbody>'
    + '<tr><td>2026-10</td><td>2</td><td>5,000,000</td></tr>'
    + '<tr><td>2026-11</td><td>1</td><td>1,000,000</td></tr></tbody></table>');
});

test('구분선과 코드 블록', () => {
  assert.equal(render('위\n\n---\n\n아래'), '<p>위</p><hr><p>아래</p>');
  assert.equal(render('```\n제목: <안내>\n**그대로**\n```'), '<pre><code>제목: &lt;안내&gt;\n**그대로**</code></pre>');
});

test('표 모양이 아닌 세로선은 문단으로 둔다', () => {
  assert.equal(render('A | B'), '<p>A | B</p>');
});
