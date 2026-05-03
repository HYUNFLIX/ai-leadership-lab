// ============================================================
// markdown.js — PRD 마크다운 생성, AI 프롬프트 생성, 미리보기 렌더링
// ============================================================

function generateMarkdown() {
  const d = state.data;

  const platformLabel = {
    'web':        '반응형 웹사이트 (데스크톱 우선)',
    'mobile-web': '모바일 친화 반응형 웹',
    'app':        '모바일 앱 (iOS/Android)',
    'desktop':    '데스크톱 앱'
  }[d.platform] || '웹사이트';

  const moodText = (d.designMood || []).map(v => {
    const m = moods.find(x => x.v === v);
    return m ? `${m.t}(${m.d})` : v;
  }).join(', ');

  const techText = (d.techNeeds || []).map(v => {
    const t = techOptions.find(x => x.v === v);
    return t ? `**${t.t}** ${t.d}` : '';
  }).filter(Boolean).join(', ');

  const features = (d.features || [])
    .filter(f => f.title || f.desc)
    .map(f => `**${f.title || '(제목 없음)'}** ${f.desc || ''}`)
    .join('\n\n');

  const validScreens = (d.screens || []).filter(s => s.title || s.desc);
  const screenFlow = validScreens.map(s => s.title || '(이름 없음)').join(' → ');
  const screenDetail = validScreens
    .map((s, i) => `**${i + 1}단계 ${s.title || '(이름 없음)'}** ${s.desc || ''}`)
    .join('\n\n');

  const sections = [];

  // 1. 개요
  const overviewParts = [`**제품명** ${d.name || '이름 미정'}`, `**한 줄 설명** ${d.oneLine || ''}`];
  if (d.problem)  overviewParts.push(`**문제 정의** ${d.problem}`);
  if (d.solution) overviewParts.push(`**솔루션** ${d.solution}`);
  sections.push(`# PRD: ${d.name || '이름 미정'}\n\n## 개요\n\n${overviewParts.join('\n\n')}`);

  // 2. 타겟 사용자
  if (d.targetUser) sections.push(`## 타겟 사용자\n\n${d.targetUser}`);

  // 3. 핵심 기능
  if (features) sections.push(`## 핵심 기능\n\n${features}`);

  // 4. 사용자 흐름
  if (validScreens.length) {
    sections.push(`## 사용자 흐름\n\n\`\`\`\n${screenFlow}\n\`\`\`\n\n${screenDetail}`);
  }

  // 5. 디자인 방향
  const designLines = [];
  if (moodText)      designLines.push(`${moodText} 톤.`);
  if (d.designColor) designLines.push(`${d.designColor}.`);
  if (d.designRef)   designLines.push(`참고: ${d.designRef}.`);
  if (designLines.length) sections.push(`## 디자인 방향\n\n${designLines.join(' ')}`);

  // 6. 플랫폼
  const platformParts = [platformLabel];
  if (techText) platformParts.push(`필요 기술: ${techText}.`);
  sections.push(`## 플랫폼\n\n${platformParts.join('. ')}`);

  // 7. 성공 지표
  if (d.successMetric) sections.push(`## 성공 지표\n\n${d.successMetric}`);

  // 8. 범위 외
  if (d.outOfScope) sections.push(`## 범위 외 (v1 제외)\n\n${d.outOfScope}`);

  return sections.join('\n\n---\n\n') + '\n';
}

function generatePrompt() {
  const md = generateMarkdown();
  return `아래 PRD를 바탕으로 이 제품을 만들어주세요.

- 아키텍처(파일 구조, 기술 스택)를 먼저 제안하고
- 첫 번째 작동하는 버전의 범위를 정한 뒤
- 단계별로 차근차근 구현해주세요
- 애매한 부분은 질문해주세요
- 저는 비개발자이므로 쉽게 설명해주세요

---

${md}`;
}

// 마크다운 → HTML (preview 탭용)
function markdownToHtml(md) {
  // 인라인 요소 먼저 변환
  let html = md
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  const lines  = html.split('\n');
  const out    = [];
  let inList   = null;

  for (const line of lines) {
    const h1 = line.match(/^# (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h3 = line.match(/^### (.+)$/);
    const bq = line.match(/^> (.+)$/);
    const hr = line.match(/^---$/);
    const ol = line.match(/^(\d+)\. (.+)$/);
    const ul = line.match(/^- (.+)$/);

    // 리스트 밖 블록이면 열려있는 리스트 닫기
    const isListItem = ol || ul;
    if (!isListItem && inList) {
      out.push(`</${inList}>`);
      inList = null;
    }

    if (h1)  { out.push(`<h1>${h1[1]}</h1>`); }
    else if (h2) { out.push(`<h2>${h2[1]}</h2>`); }
    else if (h3) { out.push(`<h3>${h3[1]}</h3>`); }
    else if (bq) { out.push(`<blockquote>${bq[1]}</blockquote>`); }
    else if (hr) { out.push('<hr>'); }
    else if (ol) {
      if (inList !== 'ol') { if (inList) out.push(`</${inList}>`); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${ol[2]}</li>`);
    }
    else if (ul) {
      if (inList !== 'ul') { if (inList) out.push(`</${inList}>`); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${ul[1]}</li>`);
    }
    else if (line.trim()) {
      out.push(`<p>${line}</p>`);
    }
    else {
      out.push('');
    }
  }

  if (inList) out.push(`</${inList}>`);
  return out.join('\n');
}
