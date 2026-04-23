// ============================================================
// State
// ============================================================
const STORAGE_KEY = 'prd-generator-v1';

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
    // ensure features/screens arrays exist
    if (!s.data.features) s.data.features = defaultState.data.features;
    if (!s.data.screens) s.data.screens = defaultState.data.screens;
    return s;
  } catch(e) { return null; }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  const el = document.getElementById('savedTime');
  const t = new Date();
  el.textContent = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
}

// ============================================================
// AI Auto-fill Generator (keyword-based, no API needed)
// ============================================================
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};

const CATS = {
  report: {
    keywords:['보고서','레포트','업무보고','리포트','주간보고','월간보고','report'],
    names:['리포트랩','AutoReport','업무리포트','빠른보고서','Report Pro','보고도우미'],
    oneLiners:['반복되는 업무 보고서를 템플릿 기반으로 빠르게 작성하는 도구','주간·월간 보고서 초안을 AI가 자동 생성해주는 앱','핵심 내용만 입력하면 정돈된 보고서로 바꿔주는 문서 도우미'],
    targets:['주간·월간 보고서 작성에 시간을 많이 쓰는 실무 담당자','팀의 보고서 품질과 속도를 함께 높이고 싶은 팀장급','같은 양식 보고서를 반복 작성하는 사업 운영 담당자'],
    problems:['매주 같은 양식의 보고서를 처음부터 쓰는 시간이 아깝다','내용은 있지만 정돈된 문서로 만드는 데 시간이 오래 걸린다','팀별 양식이 달라 취합·표준화가 어렵다'],
    solutions:['템플릿을 저장해두고 핵심만 입력하면 완성본이 나오게 한다','AI 초안을 생성해 담당자는 검토·보완에만 집중한다','지난 보고서에서 재활용할 문장을 자동 추천한다'],
    features:[
      {title:'템플릿 저장',desc:'자주 쓰는 양식 저장하고 불러오기'},
      {title:'AI 초안 생성',desc:'입력 내용 기반 전체 보고서 자동 작성'},
      {title:'핵심 요약 입력',desc:'개조식 내용만 적어도 문장으로 변환'},
      {title:'과거 보고서 검색',desc:'이전 작업물에서 문장 재활용'},
      {title:'Word/PDF 내보내기',desc:'회사 양식으로 다운로드'},
      {title:'히스토리',desc:'작성한 보고서 버전 관리'}
    ],
    screens:[
      {title:'홈',desc:'최근 보고서와 새로 쓰기'},
      {title:'새 보고서',desc:'템플릿 선택 → 내용 입력 → 생성'},
      {title:'에디터',desc:'AI 초안을 다듬는 편집 화면'},
      {title:'템플릿 관리',desc:'양식 추가·수정'},
      {title:'아카이브',desc:'과거 보고서 검색'}
    ],
    moods:['minimal','serious'], ref:'Notion의 정돈됨 + MS Word의 익숙함', color:'화이트 베이스 + 딥 네이비 + 회색 강조', platform:'web',
    tech:['auth','db','ai','upload'], scope:'결재 시스템 연동, 실시간 공동 편집, 다국어 번역', metric:'보고서 1건 작성 시간이 50% 이상 단축'
  },
  survey: {
    keywords:['설문','피드백','수요조사','만족도','응답','survey','feedback'],
    names:['서베이핏','설문인사이트','피드백랩','AskAnalyze','응답요약'],
    oneLiners:['수집한 설문 응답을 AI로 요약하고 인사이트를 뽑아주는 앱','Google 폼 결과를 붙여넣으면 자동 분석 리포트가 나오는 도구','정량+정성 응답을 한 화면에 시각화하는 설문 분석 대시보드'],
    targets:['정기 만족도 조사를 진행하는 교육·사업 운영 담당자','수강생·고객 의견을 빠르게 요약해야 하는 기획 담당자','수백 건의 자유 응답을 정리해야 하는 실무자'],
    problems:['자유 응답 수백 개를 일일이 읽고 요약하는 게 막막하다','같은 지표를 매번 수작업으로 정리하는 게 반복 업무다','숫자 분석과 텍스트 분석이 따로 놀아 종합 인사이트가 어렵다'],
    solutions:['자유 응답을 AI가 주제별로 묶고 대표 의견을 추출한다','정량 점수는 차트, 정성 응답은 요약 카드로 한 화면에 보여준다','결과를 템플릿 리포트로 자동 내보내 공유 부담을 줄인다'],
    features:[
      {title:'응답 업로드',desc:'CSV·구글폼 연동'},
      {title:'자유 응답 요약',desc:'AI가 주제 묶고 대표 답변 추출'},
      {title:'감정 분석',desc:'긍정·부정·중립 비율 시각화'},
      {title:'통계 대시보드',desc:'객관식 응답 차트'},
      {title:'키워드 클라우드',desc:'자주 나온 단어 강조'},
      {title:'리포트 내보내기',desc:'PPT·PDF 자동 생성'}
    ],
    screens:[
      {title:'설문 목록',desc:'진행 중/완료 설문'},
      {title:'분석 대시보드',desc:'차트 + 요약 카드'},
      {title:'자유 응답 상세',desc:'주제별 답변 묶음'},
      {title:'리포트 미리보기',desc:'내보내기 전 확인'}
    ],
    moods:['modern','minimal'], ref:'Google Looker Studio + Notion', color:'화이트 + 청록색 포인트', platform:'web',
    tech:['auth','db','ai','search','upload'], scope:'설문 자체 제작·수집 기능, 실시간 공동 편집', metric:'자유 응답 분석 시간 80% 단축'
  },
  presentation: {
    keywords:['PPT','발표','슬라이드','프레젠','발표자료','presentation','ppt','deck'],
    names:['슬라이드랩','PPT헬퍼','AutoSlide','DeckBuilder','발표도우미'],
    oneLiners:['보고서·기획안을 입력하면 발표용 슬라이드 초안을 만들어주는 앱','단어 몇 개만 적어도 구조화된 PPT 아웃라인이 나오는 도구','내 발표 스타일에 맞춰 슬라이드를 구성해주는 AI 도우미'],
    targets:['자료 만드는 시간이 아까운 기획·사업 담당자','매주 발표 자료를 새로 만들어야 하는 실무자','디자인보다 메시지에 집중하고 싶은 발표자'],
    problems:['PPT 제작 시간이 내용 고민 시간을 압도한다','자료 구조가 매번 달라져 익숙해지기 어렵다','디자인에 시간을 뺏겨 퇴근이 늦어진다'],
    solutions:['텍스트 입력만으로 슬라이드 구조와 문구를 자동 생성한다','자주 쓰는 레이아웃을 저장해 재사용한다','생성 결과를 Gemini Canvas 등으로 내보내 빠르게 다듬는다'],
    features:[
      {title:'아웃라인 생성',desc:'주제 입력 시 목차 자동 구성'},
      {title:'슬라이드 초안',desc:'각 장 제목과 핵심 불릿 생성'},
      {title:'스타일 프리셋',desc:'미니멀·컬러풀·공식 3종'},
      {title:'이미지 추천',desc:'슬라이드별 이미지 제안'},
      {title:'내보내기',desc:'PPT·Google Slides·PDF'},
      {title:'과거 자료 리믹스',desc:'기존 자료 요소 재활용'}
    ],
    screens:[
      {title:'새 자료',desc:'주제·청중·목적 입력'},
      {title:'아웃라인',desc:'목차 편집 화면'},
      {title:'슬라이드 미리보기',desc:'초안 확인·편집'},
      {title:'스타일',desc:'프리셋 선택'}
    ],
    moods:['modern','bold'], ref:'Gamma + Canva의 자동화', color:'화이트 + 선명한 블루 포인트', platform:'web',
    tech:['ai','upload','auth'], scope:'복잡한 애니메이션, 실시간 협업 편집, 영상 내장', metric:'슬라이드 초안 생성까지 30초 이내'
  },
  certificate: {
    keywords:['수료증','인증서','자격증','certificate','증서','배지','badge'],
    names:['수료증메이커','CertifyMe','배지팩토리','인증랩','OneCert'],
    oneLiners:['엑셀 명단만 넣으면 수료증을 일괄 생성·이메일 발송하는 도구','교육 수료생 정보를 받아 PDF 수료증을 한 번에 뽑는 앱','디자인 템플릿 + 개인별 데이터로 인증서를 자동 제작하는 서비스'],
    targets:['교육 수료생 수료증을 매 기수 발급하는 교육 담당자','이벤트·강좌 완료자 배지를 운영하는 담당자','수작업 인증서 제작에 지친 사업 운영자'],
    problems:['명단이 많을수록 수료증을 한 장씩 만드는 게 끝이 없다','이름 오타와 날짜 실수가 반복된다','디자인 툴에 익숙하지 않아 제작이 부담스럽다'],
    solutions:['CSV 업로드 → 템플릿 매칭 → 일괄 PDF 생성','이메일 자동 발송까지 원스톱','공용 템플릿 라이브러리에서 디자인 바로 사용'],
    features:[
      {title:'템플릿 갤러리',desc:'용도별 디자인 선택'},
      {title:'CSV 업로드',desc:'명단 한 번에 불러오기'},
      {title:'일괄 생성',desc:'수백 장 PDF 자동 제작'},
      {title:'자동 이메일 발송',desc:'수료자별 메일 전송'},
      {title:'QR 검증',desc:'진위 확인용 QR 삽입'},
      {title:'발급 이력',desc:'수료 기록 조회'}
    ],
    screens:[
      {title:'홈',desc:'새로 만들기와 최근 발급 현황'},
      {title:'템플릿 선택',desc:'디자인 고르기'},
      {title:'명단 업로드',desc:'CSV·엑셀'},
      {title:'미리보기',desc:'생성 전 확인'},
      {title:'발송 설정',desc:'이메일 제목·본문'}
    ],
    moods:['minimal','serious'], ref:'Canva 자동화 + 토스의 친숙함', color:'화이트 + 금색 포인트', platform:'web',
    tech:['auth','db','upload','notification'], scope:'결제 기능, 오프라인 인쇄 주문, 블록체인 검증', metric:'수료증 100장 발급 시간 10분 이내'
  },
  proposal: {
    keywords:['제안서','기획안','사업계획','사업계획서','성과평가','proposal'],
    names:['제안랩','ProposalHub','기획초안','Pitch','사업기획도우미'],
    oneLiners:['핵심 아이디어만 적으면 제안서 구조와 초안을 만들어주는 도구','협약기업 발굴용 제안서를 템플릿 기반으로 완성하는 앱','사업계획서 작성 시간을 절반으로 줄여주는 AI 기획 도우미'],
    targets:['주기적으로 협약·후원 제안서를 쓰는 사업 담당자','사업계획서 작성에 시간을 많이 쓰는 기획팀','제안서 품질 편차를 줄이고 싶은 팀 리더'],
    problems:['제안서 구조를 매번 처음부터 고민하는 시간이 아깝다','담당자마다 제안서 수준 차이가 커서 일관성이 없다','기관 소개·실적 자료를 매번 다시 찾아 붙인다'],
    solutions:['용도별 제안서 구조를 템플릿화하고 AI가 문장을 채운다','기관 기본 정보를 저장해두고 제안서마다 자동 삽입','과거 제안서에서 실적·사례를 검색해 바로 인용'],
    features:[
      {title:'템플릿 라이브러리',desc:'협약·후원·사업계획 유형별'},
      {title:'AI 문장 생성',desc:'핵심 아이디어 → 본문 문장'},
      {title:'기관 정보 자동 삽입',desc:'회사 소개·실적 불러오기'},
      {title:'검토 체크리스트',desc:'필수 항목 누락 방지'},
      {title:'Word·PDF 내보내기',desc:'즉시 제출 가능'},
      {title:'과거 제안서 검색',desc:'재사용 문장 찾기'}
    ],
    screens:[
      {title:'홈',desc:'진행 중 제안서'},
      {title:'새 제안서',desc:'용도·대상 선택'},
      {title:'에디터',desc:'섹션별 AI 도우미'},
      {title:'체크리스트',desc:'제출 전 점검'},
      {title:'아카이브',desc:'과거 제안서'}
    ],
    moods:['serious','minimal'], ref:'Notion의 정리된 에디터', color:'화이트 + 딥 네이비', platform:'web',
    tech:['auth','db','ai','upload','search'], scope:'자동 심사 스코어링, 전자결재 연동', metric:'제안서 초안 완성까지 30분 이내'
  },
  landing: {
    keywords:['홍보','랜딩','페이지','소개','공고','모집','landing','프로그램소개'],
    names:['랜딩랩','홍보페이지','OnePageBuilder','Promo','한페이지'],
    oneLiners:['교육 프로그램·사업 설명을 한 페이지 홍보 사이트로 만드는 도구','텍스트와 이미지 몇 개만 넣으면 랜딩페이지가 완성되는 앱','행사·강좌·모집 공고용 한 페이지 웹사이트 제작기'],
    targets:['교육·사업 프로그램을 홍보하는 운영 담당자','매 분기 신규 프로그램 랜딩이 필요한 마케팅 담당자','외주 비용을 줄이고 직접 만들고 싶은 실무자'],
    problems:['디자이너·개발자 없이 홍보 페이지 만들기 어렵다','매번 비슷한 구조인데 처음부터 다시 만든다','모바일·PC 모두 예쁘게 나오도록 신경 쓰기 번거롭다'],
    solutions:['섹션 조립식으로 핵심 내용만 입력해도 페이지 완성','자주 쓰는 레이아웃을 템플릿으로 저장','모바일 최적화가 기본 적용'],
    features:[
      {title:'섹션 조립',desc:'히어로·소개·일정·FAQ 등'},
      {title:'AI 홍보 문구',desc:'입력 내용 기반 문장 다듬기'},
      {title:'이미지 업로드',desc:'드래그로 배경·포인트'},
      {title:'신청 폼',desc:'수강·참여 신청 받기'},
      {title:'공개 링크',desc:'바로 공유 가능한 URL'},
      {title:'방문 통계',desc:'조회수·신청 전환율'}
    ],
    screens:[
      {title:'홈',desc:'내 페이지 목록'},
      {title:'편집기',desc:'섹션 추가·수정'},
      {title:'미리보기',desc:'모바일·PC 전환'},
      {title:'통계',desc:'방문·신청 현황'}
    ],
    moods:['modern','bold'], ref:'Linktree + 토스의 랜딩 감성', color:'선명한 브랜드 컬러 + 화이트', platform:'web',
    tech:['auth','db','upload','notification'], scope:'쇼핑몰 결제, 회원제 커뮤니티, 다국어', metric:'페이지 1개 제작 시간 1시간 이내'
  },
  manual: {
    keywords:['매뉴얼','가이드','메뉴얼','manual','guide','안내서','위키','wiki','온보딩'],
    names:['매뉴얼랩','GuideHub','안내서','One Manual','사내위키'],
    oneLiners:['조직 내부 업무 매뉴얼을 체계적으로 관리하는 사내 위키','신규 입사자용 온보딩 가이드를 쉽게 만들고 공유하는 앱','복잡한 절차를 단계별로 정리한 매뉴얼 사이트를 빠르게 구축하는 도구'],
    targets:['사내 매뉴얼을 관리하는 운영·HR 담당자','교육 과정 안내서를 만드는 교육 담당자','업무 노하우를 문서화하고 싶은 팀 리더'],
    problems:['매뉴얼이 여러 파일에 흩어져 있어 최신본을 찾기 어렵다','워드·PDF는 검색이 힘들어 정작 필요할 때 못 쓴다','신규 입사자에게 매번 같은 설명을 반복한다'],
    solutions:['카테고리·태그로 구조화하고 검색 가능한 웹페이지로 통합','버전 관리로 항상 최신본 유지','AI가 질문에 해당하는 문서를 찾아 답변'],
    features:[
      {title:'카테고리 구조',desc:'목차 형태로 정리'},
      {title:'전문 검색',desc:'본문 내 키워드 검색'},
      {title:'AI 질문 응답',desc:'매뉴얼 기반 Q&A'},
      {title:'마크다운 에디터',desc:'간단한 문서 작성'},
      {title:'버전 관리',desc:'변경 이력 확인'},
      {title:'공유 권한',desc:'내부·외부 구분'}
    ],
    screens:[
      {title:'홈',desc:'최근 문서·인기 검색어'},
      {title:'카테고리',desc:'섹션별 문서 목록'},
      {title:'문서 상세',desc:'내용 + AI 질문창'},
      {title:'편집기',desc:'마크다운 작성'}
    ],
    moods:['minimal','serious'], ref:'Notion + GitBook의 정돈됨', color:'오프화이트 + 네이비 포인트', platform:'web',
    tech:['auth','db','search','ai'], scope:'실시간 공동 편집, 외부 CMS 연동', metric:'AI로 해결되는 질문 비율 60% 이상'
  },
  dashboard: {
    keywords:['대시보드','성과','데이터','KPI','dashboard','analytics','통계','지표'],
    names:['데이터허브','Insight','성과판','Metric','지표뷰'],
    oneLiners:['사업 운영 데이터를 한눈에 보는 성과 대시보드','엑셀 자료를 업로드하면 자동으로 차트와 요약이 나오는 분석 도구','교육 프로그램 성과를 시각화하고 의사결정을 돕는 대시보드'],
    targets:['정기 성과 보고가 필요한 사업 운영 담당자','여러 엑셀로 분산된 데이터를 통합하고 싶은 실무자','수강생·회원 현황을 쉽게 파악하고 싶은 교육 담당자'],
    problems:['엑셀을 매번 피벗으로 정리하는 게 반복 업무다','숫자만 봐서는 패턴을 찾기 어렵다','공유할 때마다 스크린샷을 찍어 보낸다'],
    solutions:['CSV 업로드만으로 자동 시각화','AI가 핵심 인사이트를 문장으로 요약','공개 링크로 실시간 공유'],
    features:[
      {title:'CSV·엑셀 업로드',desc:'데이터 소스 연결'},
      {title:'자동 차트',desc:'컬럼 기반 추천 시각화'},
      {title:'AI 인사이트',desc:'데이터 요약 문장'},
      {title:'필터·기간',desc:'조건별 조회'},
      {title:'공유 링크',desc:'실시간 대시보드 URL'},
      {title:'PDF 리포트',desc:'월간 요약 자동 생성'}
    ],
    screens:[
      {title:'홈',desc:'최근 대시보드'},
      {title:'대시보드 뷰',desc:'차트 + 인사이트'},
      {title:'편집기',desc:'차트 추가·레이아웃'},
      {title:'데이터 관리',desc:'업로드한 파일'}
    ],
    moods:['modern','minimal'], ref:'Looker Studio + Linear의 UI 감각', color:'다크 그레이 + 네온 포인트', platform:'web',
    tech:['auth','db','ai','upload'], scope:'실시간 DB 연동, 고급 통계 모델링', metric:'데이터 업로드 → 인사이트 확인까지 3분 이내'
  },
  sns: {
    keywords:['SNS','인스타','블로그','카드뉴스','소셜','instagram','blog','콘텐츠'],
    names:['콘텐츠랩','소셜핏','CardMaker','SNS헬퍼','PostStudio'],
    oneLiners:['사업 홍보용 인스타·블로그 콘텐츠를 AI로 자동 생성하는 도구','주제 하나만 넣으면 카드뉴스 10장이 완성되는 앱','블로그 글과 인스타 콘텐츠를 한 번에 만드는 콘텐츠 허브'],
    targets:['운영 사업을 꾸준히 홍보해야 하는 마케팅 담당자','SNS 콘텐츠 제작에 시간이 부족한 1인 운영자','글쓰기가 부담스러운 홍보 담당자'],
    problems:['매일 새 콘텐츠 아이템을 고민하는 게 스트레스다','글쓰기와 디자인을 혼자 병행하기 힘들다','플랫폼별 포맷을 다시 만드는 게 번거롭다'],
    solutions:['주제 입력만으로 문구·카드·해시태그 자동 생성','하나의 주제를 플랫폼별 포맷으로 동시 변환','콘텐츠 캘린더로 발행 일정 관리'],
    features:[
      {title:'주제 기반 생성',desc:'키워드 → 글·카드·해시태그'},
      {title:'카드뉴스 자동 디자인',desc:'템플릿 기반 이미지 생성'},
      {title:'블로그 초안',desc:'장문 글 자동 작성'},
      {title:'플랫폼 변환',desc:'인스타↔블로그 포맷'},
      {title:'발행 캘린더',desc:'월별 게시 일정'},
      {title:'성과 기록',desc:'좋아요·조회수 수동 입력'}
    ],
    screens:[
      {title:'홈',desc:'발행 캘린더'},
      {title:'새 콘텐츠',desc:'주제·플랫폼 선택'},
      {title:'편집기',desc:'글·이미지 편집'},
      {title:'아카이브',desc:'지난 콘텐츠'}
    ],
    moods:['playful','bold'], ref:'망고보드 + Notion 캘린더', color:'페일 옐로우 + 블랙 포인트', platform:'web',
    tech:['auth','db','ai','upload'], scope:'자동 발행 API, 광고 집행, 인플루언서 매칭', metric:'콘텐츠 1건 제작 시간 10분 이내'
  },
  automation: {
    keywords:['자동화','반복','루틴','automation','매크로','워크플로우','workflow'],
    names:['오토플로우','WorkFlow','반복탈출','AutoTask','루틴봇'],
    oneLiners:['반복되는 사무 업무를 버튼 하나로 실행하는 자동화 도구','엑셀·이메일·폼을 연결해 업무 흐름을 자동화하는 앱','매일 같은 일에 드는 시간을 없애주는 개인 업무 자동화'],
    targets:['매일 반복되는 서류·이메일 업무에 지친 실무자','여러 도구를 오가며 같은 작업을 반복하는 운영 담당자','개발을 몰라도 자동화를 시도하고 싶은 직장인'],
    problems:['같은 클릭을 매일 반복하는 시간이 낭비다','Zapier·Make는 영어라서 이해가 어렵다','자동화 조건을 직관적으로 설정할 방법이 없다'],
    solutions:['한국어 시나리오 선택으로 자동화 구성','미리 만들어진 템플릿(수료증 발송·문의 응답 등)','실행 결과 로그로 안심하고 운영'],
    features:[
      {title:'시나리오 템플릿',desc:'자주 쓰는 사무 플로우'},
      {title:'조건 설정',desc:'언제·무엇을 트리거'},
      {title:'수동 실행',desc:'버튼으로 즉시 돌리기'},
      {title:'스케줄',desc:'주기적 자동 실행'},
      {title:'실행 로그',desc:'성공·실패 기록'},
      {title:'실패 알림',desc:'문제 발생 시 안내'}
    ],
    screens:[
      {title:'홈',desc:'내 자동화 목록'},
      {title:'템플릿 갤러리',desc:'업무별 플로우'},
      {title:'플로우 편집기',desc:'단계별 설정'},
      {title:'실행 로그',desc:'결과 확인'}
    ],
    moods:['modern','minimal'], ref:'Zapier의 한국어·간소화 버전', color:'화이트 + 연한 민트 포인트', platform:'web',
    tech:['auth','db','notification'], scope:'대규모 엔터프라이즈 연동, 복잡 조건부 분기', metric:'월 10시간 이상 반복 업무 시간 절감'
  },
  pet: {
    keywords: ['반려','강아지','고양이','댕댕','냥이','펫','멍멍','pet','dog','cat','산책'],
    names: ['댕댕로그','펫다이어리','뭉실뭉실','냥냥일지','발자국','Pawtrack','멍냥수첩','오늘의 댕댕'],
    oneLiners: [
      '반려동물의 일상과 건강을 귀엽게 기록하는 펫 다이어리',
      '우리 아이의 산책·식사·건강을 한 곳에서 챙기는 반려 생활 앱',
      '반려인들이 일상을 공유하고 돌봄 팁을 나누는 커뮤니티'
    ],
    targets: ['처음 반려동물을 키우는 20-40대 초보 반려인','바쁜 일상 속에서 반려동물 돌봄을 체계화하고 싶은 1인 가구','여러 반려동물을 돌보는 다묘·다견 가정'],
    problems: ['산책·식사·병원 기록이 흩어져 있어 챙기기 어렵다','반려동물 관련 정보가 여기저기 흩어져 있어 정작 필요할 때 찾기 힘들다','기존 기록 앱은 사람 중심이라 반려동물 특성에 안 맞는다'],
    solutions: ['아이별로 산책·식사·건강을 한 번에 기록하고 달력으로 돌봄 패턴을 보여준다','원탭으로 기록하는 위젯과 자동 리마인더로 기록 습관을 만든다','커뮤니티에서 비슷한 상황의 반려인끼리 경험을 나눌 수 있게 한다'],
    features: [
      {title:'산책 기록',desc:'시간·거리·경로 원탭 기록'},
      {title:'식사 체크리스트',desc:'오늘 먹은 사료와 간식 기록'},
      {title:'건강 달력',desc:'예방접종·미용·병원 일정 관리'},
      {title:'성장 앨범',desc:'월별 사진과 체중 기록'},
      {title:'반려인 Q&A',desc:'초보 반려인 질문 게시판'},
      {title:'돌봄 체크리스트',desc:'매일 해야 할 항목 자동 알림'}
    ],
    screens: [
      {title:'홈',desc:'오늘의 돌봄 할 일과 빠른 기록 버튼'},
      {title:'아이 프로필',desc:'이름·종·생일·특이사항'},
      {title:'기록 달력',desc:'월별 돌봄 기록 시각화'},
      {title:'커뮤니티',desc:'질문·팁 게시판'},
      {title:'앨범',desc:'월별·태그별 사진 모아보기'}
    ],
    moods:['playful','warm'], ref:'토스 + 인스타그램의 따뜻한 혼합', color:'베이지 베이스 + 파스텔 민트 포인트', platform:'mobile-web',
    tech:['upload','notification','social'], scope:'동물병원 예약, 수의사 상담, 분양/입양 매칭', metric:'매일 1회 이상 기록하는 사용자 60%'
  },
  food: {
    keywords:['요리','레시피','음식','맛집','식단','쿠킹','밥','recipe','cook','food'],
    names:['오늘의 한끼','냉장고 레시피','뚝딱요리','집밥일지','맛집수첩','Kitchen','요리노트'],
    oneLiners:['냉장고 재료만으로 만들 수 있는 레시피를 추천해주는 앱','오늘 뭐 먹지 고민을 5초 안에 끝내주는 메뉴 추천기','내가 먹은 음식을 기록하고 나만의 레시피북을 만드는 앱'],
    targets:['매일 저녁 메뉴를 고민하는 자취생과 1-2인 가구','건강한 집밥을 챙기고 싶은 30-40대 직장인','요리를 배우기 시작한 초보 쿠커'],
    problems:['장보고 남은 재료를 어떻게 활용할지 몰라 버리게 된다','매일 뭐 먹을지 고민하는 시간이 스트레스다','레시피는 많지만 나에게 맞는 걸 찾기 어렵다'],
    solutions:['냉장고 재료를 입력하면 가능한 레시피 3가지를 추천한다','오늘의 메뉴를 원탭으로 제안받아 고민 시간을 없앤다','내가 만든 요리를 사진과 함께 쌓아 나만의 레시피북을 만든다'],
    features:[
      {title:'재료 기반 추천',desc:'가진 재료 입력 시 레시피 3개 추천'},
      {title:'오늘의 메뉴 랜덤',desc:'고민될 때 한 번에 뽑아주는 추천'},
      {title:'나만의 레시피북',desc:'만든 요리 사진+메모 저장'},
      {title:'장보기 리스트',desc:'레시피에서 자동으로 장볼 목록 생성'},
      {title:'식단 캘린더',desc:'주간 식단 미리 계획'},
      {title:'즐겨찾기',desc:'자주 하는 요리 빠른 접근'}
    ],
    screens:[
      {title:'홈',desc:'오늘의 추천 메뉴와 빠른 검색'},
      {title:'재료 입력',desc:'냉장고 재료 체크/입력'},
      {title:'레시피 상세',desc:'재료·조리 과정·소요 시간'},
      {title:'내 레시피북',desc:'저장한 요리 사진 그리드'},
      {title:'식단 캘린더',desc:'주간 식단 관리'}
    ],
    moods:['warm','editorial'], ref:'만개의 레시피 + 오늘의집의 감성', color:'웜 화이트 + 따뜻한 머스터드 포인트', platform:'mobile-web',
    tech:['upload','search'], scope:'식재료 배송, 외부 주문 연동, AI 영양 분석', metric:'주 3회 이상 레시피를 조회하는 사용자 비율'
  },
  fitness: {
    keywords:['운동','헬스','다이어트','피트','요가','러닝','홈트','workout','fitness','gym','diet'],
    names:['1일1운동','홈트메이트','핏로그','데일리무브','운동일지','FitDay','오늘운동'],
    oneLiners:['하루 10분 홈트레이닝 루틴을 제공하고 꾸준함을 도와주는 앱','내 몸 상태에 맞는 운동을 추천하고 기록하는 피트니스 다이어리','혼자서도 포기 안 하게 만드는 운동 습관 트래커'],
    targets:['운동을 시작하려다 작심삼일로 끝나는 20-30대','헬스장 갈 시간이 없는 바쁜 직장인','집에서 꾸준히 운동하고 싶은 초보자'],
    problems:['운동 앱이 너무 복잡해서 시작하기 전에 포기한다','혼자 하니 동기부여가 안 돼서 금방 그만둔다','내 수준에 맞는 운동이 뭔지 모른다'],
    solutions:['오늘 할 운동 하나만 딱 제시해서 고민 없이 시작하게 한다','연속 기록(스트릭)과 가벼운 알림으로 습관을 유지하게 한다','운동 후 짧은 체크만으로 성장을 시각화한다'],
    features:[
      {title:'오늘의 운동',desc:'하루 10분 루틴 자동 제안'},
      {title:'영상 가이드',desc:'동작별 짧은 가이드 영상'},
      {title:'스트릭 & 뱃지',desc:'연속 기록과 달성 뱃지'},
      {title:'체형 기록',desc:'몸무게·둘레 주간 기록'},
      {title:'커스텀 루틴',desc:'나만의 루틴 만들기'},
      {title:'쉬는 날 설정',desc:'주 n회 목표와 휴식일 자동 반영'}
    ],
    screens:[
      {title:'홈',desc:'오늘의 운동 시작 버튼과 스트릭'},
      {title:'운동 플레이어',desc:'타이머와 동작 가이드'},
      {title:'기록',desc:'주/월별 운동 달력'},
      {title:'체형 변화',desc:'몸무게·사진 기록 그래프'},
      {title:'설정',desc:'목표와 알림 설정'}
    ],
    moods:['modern','bold'], ref:'나이키 트레이닝 클럽의 간결함', color:'블랙 + 네온 라임 포인트', platform:'app',
    tech:['auth','notification'], scope:'식단 기록, 웨어러블 연동, 개인 PT 매칭', metric:'주 3회 이상 운동 기록하는 사용자 비율 40%'
  },
  study: {
    keywords:['공부','학습','영어','스터디','강의','언어','study','learn','english'],
    names:['러닝로그','매일학습','스터디핏','오늘배운것','1일1배움','LearnLog','공부수첩'],
    oneLiners:['강의와 책에서 배운 내용을 한 줄로 요약하고 복습하는 학습 기록장','스터디원과 함께 공부 시간을 기록하고 동기부여하는 앱','어떤 내용을 배웠는지 잊지 않게 도와주는 개인 지식 저장소'],
    targets:['온라인 강의를 많이 듣지만 쌓이는 느낌이 없는 학습자','공부 습관을 만들고 싶은 수험생과 직장인','스스로 공부 계획을 세우는 독학러'],
    problems:['강의 들어도 정리를 안 하니 기억에 안 남는다','정리는 부담스러워서 포기하게 된다','내가 뭘 배웠는지 총정리할 길이 없다'],
    solutions:['3초 안에 "오늘 배운 것" 한 줄 기록으로 부담 없이 시작','에빙하우스 망각곡선에 맞춰 1/3/7/30일 후 복습 알림','태그로 주제를 묶어 나만의 지식 지도를 만든다'],
    features:[
      {title:'빠른 한 줄 기록',desc:'3초 안에 오늘 배운 것 기록'},
      {title:'복습 스케줄',desc:'1·3·7·30일 자동 알림'},
      {title:'태그·주제 묶기',desc:'카테고리별 정리'},
      {title:'공부 스트릭',desc:'연속 기록 캘린더'},
      {title:'오늘의 복습',desc:'복습할 항목 홈에 표시'},
      {title:'주간 회고',desc:'이번 주 배운 것 요약 리포트'}
    ],
    screens:[
      {title:'홈',desc:'오늘 복습할 항목과 빠른 기록'},
      {title:'전체 로그',desc:'시간순 리스트와 태그 필터'},
      {title:'상세/편집',desc:'한 줄·메모·출처 편집'},
      {title:'주간 회고',desc:'이번 주 리포트'}
    ],
    moods:['minimal','editorial'], ref:'Notion의 미니멀함 + 토스의 친근함', color:'오프화이트 베이스 + 딥 네이비 텍스트', platform:'mobile-web',
    tech:['auth','notification','search'], scope:'강의 연동, AI 자동 요약, 퀴즈 생성', metric:'주 5회 이상 기록하는 사용자 30%'
  },
  reading: {
    keywords:['책','독서','읽기','도서','book','read'],
    names:['한줄독서','책수첩','오늘의 페이지','독서로그','북다이어리','ReadLog'],
    oneLiners:['읽은 책과 좋았던 문장을 가볍게 기록하는 독서 다이어리','하루 10분 독서 습관을 만들어주는 앱','내 독서 취향을 분석하고 다음 책을 추천해주는 앱'],
    targets:['책을 읽어도 기억이 잘 안 나는 독서 초보자','꾸준히 읽고 싶지만 시간이 부족한 직장인','자기만의 독서 취향을 정리하고 싶은 독자'],
    problems:['다 읽고 나면 내용이 잘 기억 안 난다','좋았던 문장을 어디에 메모했는지 못 찾는다','다음에 무슨 책을 읽을지 항상 고민이다'],
    solutions:['읽은 페이지수와 한줄평을 빠르게 기록','좋았던 문장을 사진으로 찍으면 자동 저장','내 취향 기반으로 다음 책을 추천'],
    features:[
      {title:'읽는 중 기록',desc:'오늘 읽은 페이지와 한 줄 감상'},
      {title:'문장 스크랩',desc:'사진 촬영으로 문장 자동 저장'},
      {title:'독서 달력',desc:'월별 독서 시간 시각화'},
      {title:'책장',desc:'읽은 책/읽는 중/읽고 싶은 책'},
      {title:'추천',desc:'취향 기반 다음 책 추천'}
    ],
    screens:[
      {title:'홈',desc:'읽는 중인 책과 오늘의 기록 버튼'},
      {title:'책 상세',desc:'진도·메모·문장 스크랩'},
      {title:'내 책장',desc:'책 상태별 탭'},
      {title:'문장 모음',desc:'스크랩한 문장 카드 피드'}
    ],
    moods:['editorial','warm'], ref:'밀리의 서재 + 매거진 에디토리얼 스타일', color:'크림 베이지 + 딥 브라운', platform:'mobile-web',
    tech:['upload','search'], scope:'전자책 뷰어, 오디오북, 독서 모임 매칭', metric:'주 3회 이상 기록하는 사용자'
  },
  travel: {
    keywords:['여행','trip','travel','여행지','숙박'],
    names:['트래블로그','여행수첩','오늘의 여정','떠나자','TripDiary','journey'],
    oneLiners:['여행 중 찍은 사진과 순간을 하루 단위로 기록하는 여행 다이어리','다녀온 여행지를 지도 위에 남기는 나만의 여행 지도','여행 계획을 쉽게 짜고 친구들과 공유하는 앱'],
    targets:['여행을 자주 다니지만 기록은 잘 안 하는 20-30대','여행 갈 때마다 계획 짜기 어려워하는 여행 초보','다녀온 여행을 SNS 외에 제대로 남기고 싶은 여행자'],
    problems:['여행에서 돌아오면 기억이 점점 흐려진다','여행 계획을 여러 앱에 흩어놔 관리가 어렵다','다녀온 여행지를 한눈에 보기 어렵다'],
    solutions:['하루 단위로 사진·감상을 묶어 "오늘의 여정" 카드를 만든다','방문한 도시를 지도에 핀으로 남긴다','계획·숙소·일정을 한 여행에 묶어 관리한다'],
    features:[
      {title:'일별 여정 기록',desc:'하루 카드로 사진+메모'},
      {title:'여행 지도',desc:'방문한 도시 핀으로 표시'},
      {title:'계획 보드',desc:'가고 싶은 곳 담아두기'},
      {title:'여행 앨범',desc:'여행별 사진 모음'},
      {title:'일정 타임라인',desc:'일자별 스케줄'}
    ],
    screens:[
      {title:'홈',desc:'진행 중 여행과 과거 여행 카드'},
      {title:'여행 상세',desc:'일별 카드와 지도'},
      {title:'전체 지도',desc:'가본 도시 시각화'},
      {title:'새 여행 만들기',desc:'여행지·기간 입력'}
    ],
    moods:['editorial','dreamy'], ref:'Airbnb 감성 + 폴라로이드 무드', color:'선셋 오렌지 + 아이보리', platform:'mobile-web',
    tech:['upload','map'], scope:'항공권·숙소 예약, 현지 가이드 매칭', metric:'여행 1건당 3개 이상 카드 기록'
  },
  money: {
    keywords:['가계부','용돈','돈','지출','소비','저축','금융','money','budget','saving'],
    names:['오늘의 지출','가벼운 가계부','머니로그','1일1지출','용돈일기','MoneyLog'],
    oneLiners:['오늘 쓴 돈 한 줄로 기록하는 초간단 가계부','목표 저축액까지 남은 돈을 시각화해주는 저축 앱','소비 습관을 분석하고 새는 돈을 찾아주는 앱'],
    targets:['가계부를 써보려 했지만 매번 3일 만에 포기하는 사람','저축 목표가 있지만 진도 체크가 안 되는 2030','소비 패턴을 점검하고 싶은 사회 초년생'],
    problems:['기존 가계부 앱은 카테고리가 너무 많고 복잡하다','매일 쓰지 않으면 의미가 없는데 귀찮다','돈이 어디로 나갔는지 월말에만 알게 된다'],
    solutions:['금액+한 단어만 적으면 자동 분류되는 초단순 입력','주간 리포트로 어디에 많이 썼는지 시각화','저축 목표를 설정하면 남은 금액을 매일 보여준다'],
    features:[
      {title:'3초 지출 기록',desc:'금액+한 단어 입력'},
      {title:'자동 분류',desc:'키워드로 카테고리 추정'},
      {title:'주간 리포트',desc:'카테고리별 사용액 차트'},
      {title:'저축 목표',desc:'목표 금액과 진행률'},
      {title:'절약 팁',desc:'소비 패턴 기반 제안'}
    ],
    screens:[
      {title:'홈',desc:'오늘 쓴 돈과 이번 달 합계'},
      {title:'지출 목록',desc:'날짜별 리스트'},
      {title:'리포트',desc:'주간·월간 차트'},
      {title:'목표',desc:'저축 목표 관리'}
    ],
    moods:['minimal','modern'], ref:'토스의 깔끔함', color:'화이트 베이스 + 파란색 포인트', platform:'mobile-web',
    tech:['auth','db'], scope:'은행 연동 자동 기록, 투자 관리, 세금 계산', metric:'주 5회 이상 기록하는 사용자 50%'
  },
  todo: {
    keywords:['할일','투두','루틴','todo','task','습관','habit'],
    names:['데일리포커스','오늘할것','3가지','루틴메이트','FocusList','TodayOnly'],
    oneLiners:['하루에 3가지만 집중하게 만드는 초미니멀 할 일 앱','매일 반복하는 루틴을 체크하고 스트릭을 쌓는 습관 트래커','복잡한 투두 앱이 싫은 사람을 위한 심플 할 일 관리'],
    targets:['투두 앱이 너무 많아 오히려 부담스러운 사람','매일 같은 루틴을 챙기고 싶은 자기관리러','우선순위를 자주 놓치는 직장인'],
    problems:['투두 리스트가 끝없이 쌓여 오히려 아무것도 못한다','루틴을 챙기려 해도 기록이 흩어져 꾸준함이 안 생긴다','뭐가 진짜 중요한지 헷갈린다'],
    solutions:['하루 3개만 등록 가능하게 제한해 우선순위를 강제','루틴 체크 스트릭으로 시각적 동기부여','못 한 항목은 내일로 한 번만 이월 가능'],
    features:[
      {title:'오늘의 3가지',desc:'하루 최대 3개 할 일'},
      {title:'루틴 체크',desc:'매일 반복 항목 체크리스트'},
      {title:'스트릭',desc:'연속 달성 기록'},
      {title:'내일로 미루기',desc:'한 번만 이월 가능'},
      {title:'주간 돌아보기',desc:'달성률 리포트'}
    ],
    screens:[
      {title:'홈',desc:'오늘의 3가지와 루틴'},
      {title:'히스토리',desc:'달력 뷰 달성률'},
      {title:'설정',desc:'루틴 관리와 알림'}
    ],
    moods:['minimal'], ref:'Things 3의 간결함', color:'화이트 + 딥블랙 + 오렌지 포인트', platform:'mobile-web',
    tech:['notification'], scope:'팀 협업, 프로젝트 관리, 캘린더 연동', metric:'3가지 모두 달성하는 날이 주 4회 이상'
  },
  community: {
    keywords:['모임','커뮤니티','소셜','친구','meetup','community','social'],
    names:['동네러','모임메이트','취향모임','오늘모임','MeetSpot'],
    oneLiners:['같은 동네에서 취향 맞는 사람들과 소규모 모임을 만드는 앱','관심사 기반으로 연결되는 작은 커뮤니티','새로운 동네에서 친구를 만드는 소셜 앱'],
    targets:['새로 이사 왔거나 동네 친구가 필요한 20-40대','취향 맞는 사람들과 소규모로 만나고 싶은 사람','큰 커뮤니티의 피로감을 느끼는 사용자'],
    problems:['기존 커뮤니티 앱은 너무 크거나 상업적이다','낯선 사람을 만나기에 허들이 높다','취향이 맞는 사람을 찾기 어렵다'],
    solutions:['반경 2km, 3-6명 소규모 모임으로 부담을 낮춘다','취향 태그로 나와 비슷한 사람을 쉽게 발견','모임 후기로 신뢰를 쌓는다'],
    features:[
      {title:'근처 모임 찾기',desc:'위치 기반 모임 리스트'},
      {title:'모임 만들기',desc:'제목·날짜·인원·태그'},
      {title:'참여 신청',desc:'승인 후 채팅방 입장'},
      {title:'모임 채팅',desc:'참여자 간 소통'},
      {title:'후기·평점',desc:'모임 후 서로 평가'}
    ],
    screens:[
      {title:'홈 피드',desc:'근처 모임 카드 리스트'},
      {title:'모임 상세',desc:'내용·참여자·신청'},
      {title:'모임 만들기',desc:'입력 폼'},
      {title:'내 모임',desc:'참여·주최 리스트'},
      {title:'프로필',desc:'취향 태그와 후기'}
    ],
    moods:['warm','playful'], ref:'당근마켓 + 문토의 친근함', color:'크림 베이지 + 산호빛 레드', platform:'app',
    tech:['auth','map','chat','social','notification'], scope:'결제·수익 모델, 대규모 이벤트, 라이브 스트림', metric:'월 1회 이상 모임 참여하는 사용자 40%'
  },
  journal: {
    keywords:['일기','기록','다이어리','diary','journal','무드'],
    names:['오늘의 나','하루한페이지','무드로그','감정일기','Today','Daily'],
    oneLiners:['오늘 하루를 감정 이모지와 한 줄로 기록하는 일기 앱','매일의 기분을 색으로 표현하는 무드 다이어리','질문에 답하는 형식으로 쉽게 쓰는 하루 기록'],
    targets:['일기를 쓰고 싶지만 부담되는 사람','자기 감정을 돌아보고 싶은 20-30대','습관 형성을 위한 가벼운 기록이 필요한 사람'],
    problems:['일기를 쓰려면 뭘 써야 할지 막막하다','길게 쓰려다 부담돼서 결국 안 쓴다','지난 감정들을 돌아볼 방법이 없다'],
    solutions:['매일 다른 질문 하나로 자연스럽게 쓰게 한다','이모지와 한 줄만으로도 충분한 가벼운 기록','월별 무드 달력으로 감정 패턴 시각화'],
    features:[
      {title:'오늘의 질문',desc:'매일 다른 질문 제공'},
      {title:'무드 선택',desc:'감정 이모지와 색상'},
      {title:'무드 캘린더',desc:'월별 감정 색상 달력'},
      {title:'사진 첨부',desc:'오늘의 사진 1장'},
      {title:'과거 돌아보기',desc:'작년 오늘 보여주기'}
    ],
    screens:[
      {title:'오늘 쓰기',desc:'질문·무드·사진·한 줄'},
      {title:'달력',desc:'월별 무드 시각화'},
      {title:'기록 상세',desc:'그날의 내용 보기'},
      {title:'설정',desc:'알림 시간 설정'}
    ],
    moods:['warm','dreamy'], ref:'오늘의 집 감성 + 무민 다이어리', color:'파스텔 라벤더 + 크림 화이트', platform:'app',
    tech:['notification','upload'], scope:'AI 감정 분석, 상담 연결, 소셜 공유', metric:'주 4회 이상 기록하는 사용자'
  },
  hobby: {
    keywords:['취미','hobby','diy','만들기','crafting','아트'],
    names:['취미로그','오늘의 취미','핸드메이드','HobbyNote','Craft'],
    oneLiners:['내가 만든 작품과 과정을 기록하는 취미 포트폴리오','새로운 취미를 추천받고 체험하는 앱','같은 취미를 가진 사람들과 작품을 공유하는 커뮤니티'],
    targets:['취미를 시작했는데 기록할 곳이 마땅찮은 사람','새로운 취미를 찾고 싶은 사람','자신의 작품을 자랑하고 싶은 취미인'],
    problems:['만든 것들이 사진첩에 묻혀 흔적이 안 남는다','취미를 같이 할 사람을 찾기 어렵다','새로운 취미를 시도하기 어렵다'],
    solutions:['작품을 카테고리별로 정리하는 포트폴리오','취향 기반 새 취미 추천','작품 피드로 서로 영감 주고받기'],
    features:[
      {title:'작품 기록',desc:'사진·재료·소요 시간'},
      {title:'카테고리 분류',desc:'취미별 포트폴리오'},
      {title:'진행 과정',desc:'Before·After 기록'},
      {title:'영감 피드',desc:'다른 사람의 작품'},
      {title:'취미 추천',desc:'내 취향 기반 추천'}
    ],
    screens:[
      {title:'내 포트폴리오',desc:'작품 그리드 뷰'},
      {title:'작품 상세',desc:'사진·재료·과정'},
      {title:'피드',desc:'공유된 작품 둘러보기'},
      {title:'추천',desc:'새 취미 제안'}
    ],
    moods:['playful','editorial'], ref:'핀터레스트 + 오늘의집', color:'크래프트 베이지 + 딥 그린', platform:'mobile-web',
    tech:['upload','social','search'], scope:'재료 판매, 클래스 예약, 라이브 스트림', metric:'월 3회 이상 작품 업로드'
  },
  management: {
    keywords:['관리','명단','명부','데이터베이스','db','대시보드','현황','목록','리스트','crud','수료생','교육생','수강생','학생','기수','교육과정','강좌','과정','협약','협약기업','제휴','파트너','출석','출결','만족도','설문 관리','강사','강의','운영','회원 관리','고객 관리'],
    names:['하나의 명부','기수관리 콘솔','HRD Console','교육운영보드','수료현황판','TrainingOps','명단지기','컨소시엄 운영판'],
    oneLiners:['[KW] 데이터를 한 화면에서 등록·수정·검색하는 실무 관리 앱','엑셀에 흩어진 [KW] 기록을 한곳에 모아 필터·정렬·내보내기까지 되는 운영 도구','[KW] 현황을 목록과 요약 대시보드로 한눈에 보는 심플한 관리 시스템'],
    targets:['[KW] 업무를 엑셀로 반복 관리하는 HRD 컨소시엄 운영 담당자','여러 기수·과정을 동시에 운영하며 현황 파악이 필요한 교육 기획자','[KW] 데이터를 수작업으로 집계해 보고서를 만드는 실무자'],
    problems:['엑셀 파일이 버전별로 쌓여 어떤 게 최신인지 헷갈린다','검색·필터가 불편해 담당자마다 같은 데이터를 중복 관리한다','보고용 집계를 낼 때마다 수작업으로 카운트해야 한다'],
    solutions:['하나의 목록 화면에서 등록·수정·삭제(CRUD)를 바로 처리한다','검색·필터·정렬로 원하는 항목을 즉시 찾아볼 수 있게 한다','카드형 요약 대시보드로 핵심 지표(총원·수료율·기수별)를 한눈에 보여준다'],
    features:[
      {title:'목록 조회',desc:'테이블/카드 뷰 + 검색·필터'},
      {title:'상세·인라인 편집',desc:'항목 클릭 시 상세 보기와 바로 수정'},
      {title:'신규 등록 폼',desc:'필수값 검증 + 드롭다운 선택'},
      {title:'상태 라벨',desc:'진행중·수료·이탈 등 상태 관리'},
      {title:'요약 대시보드',desc:'총원·수료율·기수별 카운트 카드'},
      {title:'CSV 내보내기·가져오기',desc:'엑셀 파일 연동'}
    ],
    screens:[
      {title:'목록 (메인)',desc:'전체 데이터 + 검색창 + 필터'},
      {title:'상세',desc:'한 건의 모든 정보 조회/수정'},
      {title:'등록 폼',desc:'신규 항목 추가'},
      {title:'요약 대시보드',desc:'주요 지표 카드'}
    ],
    moods:['clean','editorial'], ref:'Notion 데이터베이스 + 에어테이블의 실무감', color:'화이트 + 딥 네이비 포인트', platform:'web',
    tech:['auth','database','export'], scope:'결제, 대량 이메일 발송, 외부 SSO 연동', metric:'담당자 1명이 월 100건 이상 기록을 관리'
  },
  generic: {
    keywords:[],
    names:['DailyApp','마이로그','스마트앱','OneTouch','Lite'],
    oneLiners:['[KW]을(를) 손쉽게 관리할 수 있는 심플한 앱','[KW]을(를) 즐기는 사람들을 위한 기록+커뮤니티 앱','바쁜 일상 속에서도 [KW]을(를) 꾸준히 챙기게 해주는 앱'],
    targets:['[KW]에 관심이 있지만 체계적으로 관리하지 못하는 20-40대','[KW]을(를) 시작하는 초보자','혼자 하기 어려워 동기부여가 필요한 사람'],
    problems:['[KW] 관련 정보와 기록이 여기저기 흩어져 있다','기존 앱은 기능이 너무 복잡해 시작하기 부담된다','혼자 하면 금방 포기하게 된다'],
    solutions:['[KW]에 필요한 핵심 기능만 모은 심플한 앱을 제공한다','원탭 입력으로 기록 부담을 최소화한다','스트릭과 커뮤니티로 꾸준함을 돕는다'],
    features:[
      {title:'빠른 기록',desc:'3초 안에 입력'},
      {title:'대시보드',desc:'한눈에 보는 현황'},
      {title:'카테고리·태그',desc:'내용 정리'},
      {title:'알림',desc:'꾸준함을 위한 리마인더'},
      {title:'공유',desc:'지인·커뮤니티 공유'}
    ],
    screens:[
      {title:'홈',desc:'오늘의 현황과 빠른 입력'},
      {title:'목록',desc:'전체 기록 필터링'},
      {title:'상세/편집',desc:'내용 보기와 수정'},
      {title:'설정',desc:'알림·테마 설정'}
    ],
    moods:['minimal','modern'], ref:'토스의 간결함', color:'화이트 + 네이비 포인트', platform:'mobile-web',
    tech:['auth','notification'], scope:'고급 분석, 결제, AI 추천', metric:'주 3회 이상 접속 사용자 30%'
  }
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
  const cat = CATS[catId];
  const kw = normalizeKeyword(keyword) || '이 주제';

  const interp = s => s.replace(/\[KW\]/g, kw);

  let name = pick(cat.names);
  if (catId === 'generic') {
    const simpleKw = stripTrailingJosa(kw.split(/[\s,]+/)[0]);
    name = Math.random() < 0.5 ? `${simpleKw} 로그` : `오늘의 ${simpleKw}`;
  }

  return {
    name,
    oneLine: interp(pick(cat.oneLiners)),
    targetUser: interp(pick(cat.targets)),
    problem: interp(pick(cat.problems)),
    solution: interp(pick(cat.solutions)),
    features: pickN(cat.features, 3).map(f => ({...f})),
    screens: pickN(cat.screens, Math.min(4, cat.screens.length)).map(s => ({...s})),
    designMood: [...cat.moods],
    designRef: cat.ref,
    designColor: cat.color,
    platform: cat.platform,
    techNeeds: [...cat.tech],
    outOfScope: cat.scope,
    successMetric: cat.metric,
    _sourceKeyword: keyword,
    _category: catId
  };
}

// ============================================================
// Step definitions
// ============================================================
const steps = [
  { id: 'start', title: '시작하기', short: '시작', render: renderStart },
  { id: 'intro', title: '프로젝트 소개', short: '소개', render: renderIntro },
  { id: 'user', title: '누구를 위한 건가요', short: '타겟', render: renderUser },
  { id: 'features', title: '핵심 기능', short: '기능', render: renderFeatures },
  { id: 'screens', title: '주요 화면', short: '화면', render: renderScreens },
  { id: 'design', title: '디자인 무드', short: '디자인', render: renderDesign },
  { id: 'tech', title: '기술 선택', short: '기술', render: renderTech },
  { id: 'scope', title: 'MVP 범위', short: '범위', render: renderScope },
  { id: 'result', title: '완성된 PRD', short: '완성', render: renderResult }
];

// ============================================================
// Render
// ============================================================
function render() {
  renderProgress();
  const card = document.getElementById('card');
  const step = steps[state.step];
  card.innerHTML = '';
  step.render(card);
  saveState();
}

function renderProgress() {
  const pg = document.getElementById('progress');
  pg.innerHTML = '';
  steps.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'progress-step' + (i === state.step ? ' active' : '') + (i < state.step ? ' done' : '');
    el.title = `${i+1}. ${s.title}`;
    const num = String(i + 1).padStart(2, '0');
    el.innerHTML = `<div class="progress-step-num">${num}</div><div class="progress-step-label">${s.short}</div>`;
    el.addEventListener('click', () => {
      if (i <= state.step || canAdvanceTo(i)) {
        state.step = i;
        render();
      }
    });
    pg.appendChild(el);
  });
}

function canAdvanceTo(i) { return i <= Math.min(state.step + 1, steps.length - 1); }

function navFooter(nextLabel = '다음', onNext, {prevLabel = '이전', hidePrev = false, nextClass = 'btn-primary'} = {}) {
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
  const name = state.data.name || '(미정)';
  const oneLine = state.data.oneLine || '(한 줄 설명 아직)';
  d.innerHTML = `<strong>${name}</strong> · ${oneLine}`;
  return d;
}

// ============================================================
// Step 0: Start
// ============================================================
const EXAMPLE_KEYWORDS = ['교육생 명단 관리','기수별 수료 현황판','협약기업 DB','교육과정 일정 관리','출석 체크 앱','만족도 조사 결과 대시보드','강사 프로필 관리','수강신청 관리','교재·자료 라이브러리','업무 보고서 자동 작성','회의록 정리 도우미','인스타 카드뉴스 문구 생성'];

function renderStart(card) {
  card.appendChild(titleBlock(
    'STEP 01 / 09',
    '업무에서 쓸 도구, 무엇부터 만들까요?',
    '위 9단계를 차례로 채우면 PRD가 완성됩니다. 직접 쓰거나 키워드 한 줄로 시작해 보세요.'
  ));

  const content = document.createElement('div');
  content.className = 'step-content';

  // ===== Mode toggle panel =====
  const magic = document.createElement('div');
  magic.className = 'magic';
  magic.innerHTML = `
    <div class="magic-badge"><span class="magic-badge-dot"></span>작성 방식 선택</div>
    <div class="mode-toggle" role="tablist">
      <button type="button" class="mode-tab active" data-mode="manual"><span class="mode-tab-num">01</span>직접 작성</button>
      <button type="button" class="mode-tab" data-mode="auto"><span class="mode-tab-num">02</span>자동 생성</button>
    </div>
  `;

  // --- Auto panel ---
  const autoPanel = document.createElement('div');
  autoPanel.className = 'mode-panel';
  autoPanel.dataset.panel = 'auto';
  autoPanel.innerHTML = `
    <h3>어떤 업무 도구를 만들어 볼까요?</h3>
    <p>평소 번거롭던 업무나 만들어보고 싶던 도구를 한두 단어로 적어주세요. 엔터를 누르면 AI가 전체 PRD 초안(타겟·기능·화면·디자인)을 자동으로 채워줍니다.</p>
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

  const doGenerate = () => {
    const kw = kwInput.value.trim();
    if (!kw) { kwInput.focus(); toast('만들고 싶은 걸 적어주세요'); return; }

    magic.innerHTML = `
      <div class="magic-loading">
        AI가 <strong>"${kw}"</strong>에 딱 맞는 PRD를 생성 중이에요...
        <div class="magic-loading-bar"></div>
      </div>`;
    setTimeout(() => {
      const generated = generateFromKeyword(kw);
      Object.assign(state.data, generated);
      state.step = 1;
      render();
      toast(`AI가 전체 단계를 채웠어요. 하나씩 확인하며 내 아이디어로 수정해 보세요`);
    }, 900 + Math.random() * 600);
  };

  genBtn.addEventListener('click', doGenerate);
  kwInput.addEventListener('keydown', e => { if (e.key === 'Enter') doGenerate(); });

  inputRow.appendChild(kwInput);
  inputRow.appendChild(genBtn);
  autoPanel.appendChild(inputRow);

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

  // --- Manual panel (default) ---
  const manualPanel = document.createElement('div');
  manualPanel.className = 'mode-panel active';
  manualPanel.dataset.panel = 'manual';
  manualPanel.innerHTML = `
    <div class="manual-box">
      <h4>처음부터 내 손으로 채워볼게요</h4>
      <p>9단계를 하나씩 넘기며 PRD를 완성합니다. 자동 생성 없이 본인 아이디어를 천천히 정리하고 싶을 때 선택하세요.</p>
      <button type="button" class="manual-start-btn" id="manualStartBtn">시작하기 →</button>
    </div>
  `;
  manualPanel.querySelector('#manualStartBtn').addEventListener('click', () => {
    state.step = 1;
    render();
    toast('빈 PRD에서 시작합니다. 9단계를 직접 채워보세요');
  });
  magic.appendChild(manualPanel);

  // --- Tab switching ---
  magic.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      magic.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
      magic.querySelectorAll('.mode-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === mode));
      if (mode === 'auto') setTimeout(() => kwInput.focus(), 200);
    });
  });

  content.appendChild(magic);

  content.appendChild(tipBox('<strong>강사 Tip:</strong> 학생들에게 "내 업무 중 가장 번거로운 일"을 키워드로 먼저 떠올리게 한 뒤, <strong>9단계를 하나씩 넘기며</strong> 본인 맥락에 맞게 수정하도록 유도하세요. 그 수정 과정이 핵심 학습 포인트입니다.'));
  card.appendChild(content);
}

// ============================================================
// Step 1: Intro
// ============================================================
function renderIntro(card) {
  card.appendChild(titleBlock('STEP 02 / 09', '프로젝트를 한 줄로 소개해주세요', '제품의 이름과 "이게 뭐 하는 거다" 한 줄만 정하면 돼요. 나중에 바꿀 수 있어요.'));

  const content = document.createElement('div');
  content.className = 'step-content';

  content.appendChild(field('프로젝트 이름', '별명도 괜찮아요. 예: 데일리 포커스, 동네러, MyShop', input('name', '예: 데일리 포커스', state.data.name)));

  content.appendChild(field('한 줄 설명', '"___를 위한 ___ 앱" 형식으로 써보세요', textarea('oneLine', '예: 매일 3가지만 집중하게 해주는 초미니멀 투두 앱', state.data.oneLine, 2)));

  content.appendChild(tipBox('<strong>좋은 한 줄 설명의 공식:</strong> [누구]를 위한 [무엇]을 하는 [어떤 방식의] 서비스. 구체적일수록 AI가 더 정확하게 만들어요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ============================================================
// Step 2: User & problem
// ============================================================
function renderUser(card) {
  card.appendChild(titleBlock('STEP 03 / 09', '누구의 어떤 문제를 해결하나요?', '타겟 사용자가 명확할수록, 그들의 고민을 잘 알수록, 제품의 방향이 뚜렷해져요.'));
  const content = document.createElement('div');
  content.className = 'step-content';

  content.appendChild(summaryPeek());

  content.appendChild(field('타겟 사용자', '누가 이 제품을 쓰나요? 구체적일수록 좋아요', textarea('targetUser', '예: 할 일이 너무 많아 우선순위를 놓치는 30대 직장인', state.data.targetUser, 2)));

  content.appendChild(field('그들이 겪는 문제', '지금 이걸 어떻게 해결하고 있고, 무엇이 불편한가요?', textarea('problem', '예: 기존 투두앱은 기능이 너무 많아 오히려 복잡하고, 매일 봐야 할 목록이 50개가 넘어간다', state.data.problem, 3)));

  content.appendChild(field('우리의 해결 방식', '이 제품이 어떻게 그 문제를 풀어내나요?', textarea('solution', '예: 하루에 딱 3개만 등록할 수 있게 강제하여 진짜 중요한 일에 집중하게 만든다', state.data.solution, 2)));

  content.appendChild(tipBox('<strong>"왜 이게 필요한가"</strong>를 명확히 하는 게 핵심이에요. AI는 왜를 알면 디테일도 알아서 채워줘요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ============================================================
// Step 3: Features
// ============================================================
function renderFeatures(card) {
  card.appendChild(titleBlock('STEP 04 / 09', '핵심 기능 3-5개', 'MVP(최소 기능)로 꼭 필요한 기능만 골라 주세요. 많을수록 좋은 게 아니에요.'));
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

// ============================================================
// Step 4: Screens
// ============================================================
function renderScreens(card) {
  card.appendChild(titleBlock('STEP 05 / 09', '어떤 화면들이 필요한가요?', '사용자가 보게 될 화면(페이지)을 간단히 나열해 보세요. 홈, 상세, 설정 같은 식으로요.'));
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

// ============================================================
// Step 5: Design mood
// ============================================================
const moods = [
  { v: 'minimal', t: '미니멀', d: '여백이 많고 깔끔한' },
  { v: 'playful', t: '유쾌한', d: '밝고 재밌는 톤' },
  { v: 'editorial', t: '에디토리얼', d: '잡지 같은 타이포' },
  { v: 'warm', t: '따뜻한', d: '베이지/오렌지 톤' },
  { v: 'modern', t: '모던', d: '심플하고 차가운' },
  { v: 'retro', t: '레트로', d: '복고 감성' },
  { v: 'bold', t: '볼드', d: '굵은 폰트, 강한 컬러' },
  { v: 'dreamy', t: '몽환적', d: '파스텔, 그라디언트' },
  { v: 'serious', t: '진중한', d: '비즈니스스러운' }
];

function renderDesign(card) {
  card.appendChild(titleBlock('STEP 06 / 09', '어떤 느낌의 디자인인가요?', '비개발자에게 가장 어려운 단계지만, 가장 중요해요. AI는 "느낌"을 단어로 줘야 이해해요.'));
  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('무드 (여러 개 선택 가능)', '원하는 느낌을 골라주세요', chipGroup('designMood', moods, true)));

  content.appendChild(field('참고하고 싶은 서비스', '"XXX 같은 느낌으로" - 벤치마크가 있으면 AI가 훨씬 쉽게 이해해요', input('designRef', '예: 토스, Notion, Linear, Apple Music 같은 느낌', state.data.designRef)));

  content.appendChild(field('색상 방향', '대표 컬러나 톤을 자유롭게 적어주세요', input('designColor', '예: 파스텔 연두 + 흰색 베이스, 또는 네이비 + 골드', state.data.designColor)));

  content.appendChild(tipBox('<strong>AI가 가장 헷갈리는 부분:</strong> "예쁘게", "깔끔하게"는 의미가 없어요. "Stripe 같은 느낌", "Linear처럼" 같은 구체적인 벤치마크가 최고예요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ============================================================
// Step 6: Tech
// ============================================================
const techOptions = [
  { v: 'auth', t: '로그인 / 회원가입', d: '이메일, 카카오, 구글 등' },
  { v: 'db', t: '데이터 저장', d: '사용자 데이터를 서버에 저장' },
  { v: 'payment', t: '결제', d: '유료 기능, 구독' },
  { v: 'upload', t: '파일 업로드', d: '이미지, 영상 등 업로드' },
  { v: 'notification', t: '알림', d: '이메일, 푸시 알림' },
  { v: 'ai', t: 'AI 기능', d: '챗봇, 자동 생성, 추천' },
  { v: 'map', t: '지도', d: '위치 기반 기능' },
  { v: 'chat', t: '실시간 채팅', d: '사용자 간 메시지' },
  { v: 'social', t: '소셜 기능', d: '좋아요, 댓글, 팔로우' },
  { v: 'search', t: '검색', d: '키워드/필터 검색' }
];

function renderTech(card) {
  card.appendChild(titleBlock('STEP 07 / 09', '기술적으로 필요한 것들', '어려운 기술 용어는 필요 없어요. 필요한 "능력"만 체크해주세요.'));
  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('플랫폼', '이 제품은 어디서 실행되나요?', chipGroup('platform', [
    { v: 'web', t: '웹사이트', d: '' },
    { v: 'mobile-web', t: '모바일 친화 웹', d: '' },
    { v: 'app', t: '모바일 앱', d: '' },
    { v: 'desktop', t: '데스크톱 앱', d: '' }
  ], false)));

  content.appendChild(field('필요한 기능/기술', '해당되는 항목만 체크해주세요 (선택 안 해도 됨)', checkGroup('techNeeds', techOptions)));

  content.appendChild(tipBox('체크 안 한 것은 안 만들어요. <strong>"나중에 필요할 수도?"는 빼세요.</strong> MVP는 가벼울수록 빨리 완성돼요.'));

  card.appendChild(content);
  card.appendChild(navFooter('다음 →'));
}

// ============================================================
// Step 7: Scope
// ============================================================
function renderScope(card) {
  card.appendChild(titleBlock('STEP 08 / 09', '이번에는 포함하지 않을 것', '"안 할 것"을 명확히 해야 AI도 욕심 내지 않고 집중해서 만들어요.'));
  const content = document.createElement('div');
  content.className = 'step-content';
  content.appendChild(summaryPeek());

  content.appendChild(field('MVP에서 제외할 기능 / 나중에 할 것', '우선순위가 낮거나, 이번 버전에서는 안 만들 기능', textarea('outOfScope', '예: 다국어 지원, 다크모드, 상세 통계, 팀 기능 등', state.data.outOfScope, 3)));

  content.appendChild(field('성공의 기준 (선택)', '이 제품이 잘 만들어졌다는 걸 어떻게 알 수 있을까요?', textarea('successMetric', '예: 주 3회 이상 접속하는 사용자 100명 확보, 또는 내가 매일 쓰고 싶은 앱', state.data.successMetric, 2)));

  content.appendChild(tipBox('<strong>AI에게 "안 할 것"을 알려주는 이유:</strong> AI는 주어진 요구사항에 더해 "있으면 좋을 것 같은" 기능을 추가하려는 경향이 있어요. 명시적으로 제외해야 깔끔해요.'));

  card.appendChild(content);
  card.appendChild(navFooter('PRD 생성 →', null, { nextClass: 'btn-accent' }));
}

// ============================================================
// Step 8: Result
// ============================================================
let resultView = 'preview';

function renderResult(card) {
  card.appendChild(titleBlock('STEP 09 / 09', '완성되었어요!', '아래 PRD를 복사해 Claude, Cursor, ChatGPT, Google AI Studio 같은 도구에 붙여넣으면 바로 제품 만들기를 시작할 수 있어요.'));

  const content = document.createElement('div');
  content.className = 'step-content';

  // Tabs + actions
  const head = document.createElement('div');
  head.className = 'result-head';

  const tabs = document.createElement('div');
  tabs.className = 'result-tabs';
  ['preview', 'markdown', 'prompt'].forEach(v => {
    const b = document.createElement('button');
    b.className = 'result-tab' + (resultView === v ? ' active' : '');
    b.textContent = { preview: '미리보기', markdown: '마크다운', prompt: 'AI 프롬프트' }[v];
    b.addEventListener('click', () => { resultView = v; render(); });
    tabs.appendChild(b);
  });
  head.appendChild(tabs);

  const actions = document.createElement('div');
  actions.className = 'result-actions';
  actions.appendChild(button('📋 복사', 'btn-primary', () => {
    const text = resultView === 'prompt' ? generatePrompt() : generateMarkdown();
    navigator.clipboard.writeText(text);
    toast('클립보드에 복사되었어요!');
  }));
  actions.appendChild(button('⬇ 다운로드', 'btn-outline', () => {
    const text = generateMarkdown();
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.data.name || 'PRD'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }));
  head.appendChild(actions);
  content.appendChild(head);

  // View body
  if (resultView === 'preview') {
    const prev = document.createElement('div');
    prev.className = 'result-preview';
    prev.innerHTML = markdownToHtml(generateMarkdown());
    content.appendChild(prev);
  } else if (resultView === 'markdown') {
    const out = document.createElement('pre');
    out.className = 'result-output';
    out.textContent = generateMarkdown();
    content.appendChild(out);
  } else {
    const out = document.createElement('pre');
    out.className = 'result-output';
    out.textContent = generatePrompt();
    content.appendChild(out);

    const note = document.createElement('p');
    note.style.cssText = 'font-size:12px;color:var(--ink-faint);margin-top:10px;text-align:center;';
    note.innerHTML = '💡 이 버전은 Claude, Cursor 같은 코딩 AI에 바로 붙여넣도록 최적화된 프롬프트예요.';
    content.appendChild(note);
  }

  // ===== AI tools to use the PRD with =====
  const tools = document.createElement('div');
  tools.className = 'ai-tools';
  tools.innerHTML = `
    <div class="ai-tools-head">
      <div class="ai-tools-title">이 PRD를 어디에 붙여넣을까요?</div>
      <div class="ai-tools-sub">클릭하면 바로 이동합니다</div>
    </div>
  `;

  const toolList = [
    { name: 'Claude', url: 'https://claude.ai', mark: 'C', bg: '#cc785c', desc: '긴 PRD를 한 번에 읽고 단계별로 구현해줘요. 실무 설명이 친절함.', badge: '추천' },
    { name: 'Gemini Canvas', url: 'https://gemini.google.com', mark: '✦', bg: '#1e88e5', desc: 'Gemini의 Canvas 기능으로 PRD를 넣으면 문서·코드·슬라이드를 실시간으로 편집하며 다듬어요.', badge: '실습' },
    { name: 'Google AI Studio', url: 'https://aistudio.google.com', mark: 'G', bg: '#4285f4', desc: 'Build 모드에서 PRD만 붙이면 앱 초안이 자동 생성. 무료로 시작 가능.', badge: '무료' },
    { name: 'ChatGPT', url: 'https://chat.openai.com', mark: 'G', bg: '#10a37f', desc: '가장 익숙한 AI 챗. Canvas 기능으로 PRD 기반 코드와 문서를 바로 받아볼 수 있어요.', badge: '' },
    { name: 'Cursor', url: 'https://cursor.com', mark: 'Cu', bg: '#1a1a2e', desc: 'AI 내장 코드 에디터. PRD를 Rules에 넣으면 프로젝트 전체 맥락으로 작업 가능.', badge: '' },
    { name: 'Lovable', url: 'https://lovable.dev', mark: '♡', bg: '#ff5a8a', desc: 'PRD만 붙이면 전체 웹앱을 만들어주는 노코드형 AI 빌더. 홍보 페이지 만들 때 빠름.', badge: '' }
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
        <div class="ai-tool-url">${t.url.replace('https://','')}</div>
      </div>
    `;
    toolGrid.appendChild(a);
  });
  tools.appendChild(toolGrid);

  const howto = document.createElement('p');
  howto.style.cssText = 'font-size:12px;color:var(--ink-faint);margin-top:12px;line-height:1.6;';
  howto.innerHTML = '💡 <strong>추천 순서:</strong> ① 위에서 <strong>"AI 프롬프트"</strong> 탭 선택 → 복사 → ② 원하는 도구 열기 → 붙여넣기 → ③ AI가 질문하면 답하면서 차근차근 완성.';
  tools.appendChild(howto);

  content.appendChild(tools);

  card.appendChild(content);

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

// ============================================================
// Field helpers
// ============================================================
function field(label, hint, inputEl, required = false) {
  const d = document.createElement('div');
  d.className = 'field';
  d.innerHTML = `<label class="field-label">${label}${required ? '<span class="req">*</span>' : ''}</label>` +
    (hint ? `<div class="field-hint">${hint}</div>` : '');
  d.appendChild(inputEl);
  return d;
}

function input(key, placeholder, value) {
  const i = document.createElement('input');
  i.className = 'input';
  i.placeholder = placeholder;
  i.value = value || '';
  i.addEventListener('input', (e) => { state.data[key] = e.target.value; saveState(); });
  return i;
}

function textarea(key, placeholder, value, rows = 3) {
  const t = document.createElement('textarea');
  t.className = 'textarea';
  t.placeholder = placeholder;
  t.value = value || '';
  t.rows = rows;
  t.addEventListener('input', (e) => { state.data[key] = e.target.value; saveState(); });
  return t;
}

function chipGroup(key, options, multi) {
  const g = document.createElement('div');
  g.className = 'chip-group';
  options.forEach(opt => {
    const c = document.createElement('div');
    c.className = 'chip';
    const current = state.data[key];
    const selected = multi ? (Array.isArray(current) && current.includes(opt.v)) : (current === opt.v);
    if (selected) c.classList.add('active');
    c.innerHTML = `<strong>${opt.t}</strong>${opt.d ? ` <span style="opacity:0.6">· ${opt.d}</span>` : ''}`;
    c.addEventListener('click', () => {
      if (multi) {
        const arr = Array.isArray(state.data[key]) ? state.data[key] : [];
        if (arr.includes(opt.v)) state.data[key] = arr.filter(x => x !== opt.v);
        else state.data[key] = [...arr, opt.v];
      } else {
        state.data[key] = opt.v;
      }
      render();
    });
    g.appendChild(c);
  });
  return g;
}

function checkGroup(key, options) {
  const g = document.createElement('div');
  g.className = 'check-group';
  options.forEach(opt => {
    const current = Array.isArray(state.data[key]) ? state.data[key] : [];
    const selected = current.includes(opt.v);
    const c = document.createElement('div');
    c.className = 'check' + (selected ? ' active' : '');
    c.innerHTML = `
      <div class="check-box"></div>
      <div>
        <div class="check-label">${opt.t}</div>
        <div class="check-desc">${opt.d}</div>
      </div>
    `;
    c.addEventListener('click', () => {
      const arr = Array.isArray(state.data[key]) ? state.data[key] : [];
      if (arr.includes(opt.v)) state.data[key] = arr.filter(x => x !== opt.v);
      else state.data[key] = [...arr, opt.v];
      render();
    });
    g.appendChild(c);
  });
  return g;
}

function renderDList(container, items, ph1, ph2, max) {
  container.innerHTML = '';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'dlist-item';
    row.innerHTML = `<div class="dlist-index">${String(i+1).padStart(2,'0')}</div>`;
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

// ============================================================
// Markdown generator
// ============================================================
function generateMarkdown() {
  const d = state.data;
  const date = new Date().toISOString().split('T')[0];

  const platformLabel = {
    'web': '웹사이트 (PC 우선)',
    'mobile-web': '모바일 친화 웹',
    'app': '모바일 앱',
    'desktop': '데스크톱 앱'
  }[d.platform] || '웹사이트';

  const moodText = (d.designMood || []).map(v => {
    const m = moods.find(x => x.v === v); return m ? m.t : v;
  }).join(', ');

  const techText = (d.techNeeds || []).map(v => {
    const t = techOptions.find(x => x.v === v); return t ? `- **${t.t}** — ${t.d}` : '';
  }).filter(Boolean).join('\n');

  const features = (d.features || []).filter(f => f.title || f.desc).map((f, i) =>
    `**${i+1}. ${f.title || '(제목 없음)'}**\n   ${f.desc || ''}`
  ).join('\n\n');

  const screens = (d.screens || []).filter(s => s.title || s.desc).map((s, i) =>
    `${i+1}. **${s.title || '(이름 없음)'}** — ${s.desc || ''}`
  ).join('\n');

  let md = `# ${d.name || '이름 미정'}

> ${d.oneLine || '한 줄 설명'}

**작성일:** ${date}

---

## 1. 왜 만드는가

### 타겟 사용자
${d.targetUser || '_미작성_'}

### 해결하려는 문제
${d.problem || '_미작성_'}

### 우리의 해결 방식
${d.solution || '_미작성_'}

---

## 2. 핵심 기능 (MVP)

${features || '_기능이 아직 입력되지 않았습니다_'}

---

## 3. 주요 화면 구성

${screens || '_화면이 아직 입력되지 않았습니다_'}

---

## 4. 디자인 방향

- **플랫폼:** ${platformLabel}
- **무드:** ${moodText || '_미지정_'}
- **참고:** ${d.designRef || '_없음_'}
- **컬러:** ${d.designColor || '_자유롭게_'}

---

## 5. 기술 요구사항

${techText || '_특별한 기능 없음 (정적 콘텐츠 위주)_'}

---

## 6. MVP 범위

### 이번 버전에서 제외 (Out of Scope)
${d.outOfScope || '_미지정_'}

### 성공의 기준
${d.successMetric || '_미지정_'}

---

_이 문서는 PRD 생성기로 작성되었습니다._
`;

  return md;
}

function generatePrompt() {
  const md = generateMarkdown();
  return `아래는 제가 만들고 싶은 제품의 PRD(제품 요구사항 문서)입니다.
이 내용을 바탕으로 다음을 해주세요:

1. 전체 아키텍처를 먼저 제안해주세요 (파일 구조, 주요 페이지, 사용할 기술 스택)
2. 저는 개발 경험이 없는 실무 직장인이므로, 선택한 기술의 이유를 한국어로 쉽게 설명해주세요
3. 가장 먼저 만들 "첫 번째 작동하는 버전"의 범위를 제안해주세요
4. 확인이 필요한 부분이나 애매한 부분이 있다면 질문해주세요
5. 준비되면 단계별로 차근차근 만들어 봅시다

---

${md}
---

위 내용을 바탕으로 단계별로 만들어주세요. 한 번에 너무 많이 만들지 말고, 작동하는 것부터 조금씩 쌓아가는 방식으로 부탁합니다.`;
}

// Simple markdown -> HTML for preview
function markdownToHtml(md) {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  // Lists
  const lines = html.split('\n');
  const out = [];
  let inList = null;
  for (const line of lines) {
    const ol = line.match(/^(\d+)\. (.+)$/);
    const ul = line.match(/^- (.+)$/);
    if (ol) {
      if (inList !== 'ol') { if (inList) out.push(`</${inList}>`); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${ol[2]}</li>`);
    } else if (ul) {
      if (inList !== 'ul') { if (inList) out.push(`</${inList}>`); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${ul[1]}</li>`);
    } else {
      if (inList) { out.push(`</${inList}>`); inList = null; }
      if (line.trim() && !line.startsWith('<')) out.push(`<p>${line}</p>`);
      else out.push(line);
    }
  }
  if (inList) out.push(`</${inList}>`);
  return out.join('\n');
}

// ============================================================
// Utility
// ============================================================
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('모든 입력을 초기화할까요?')) {
    localStorage.removeItem(STORAGE_KEY);
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

// Initial render
render();
saveState();
