# AI Leadership Lab Website

## 📁 프로젝트 구조

```
ai-leadership-lab/
├── index.html          # 메인 HTML 파일
├── css/
│   └── styles.css      # 모든 스타일시트
├── js/
│   └── main.js         # JavaScript 로직
├── images/            # 이미지 파일들 (추가 필요)
│   ├── logo.png
│   ├── profile.jpg
│   └── ...
└── README.md          # 이 파일
```

## 🎨 디자인 개선 사항

### 1. **현대적인 디자인 시스템**
- **CSS 변수 활용**: 일관된 컬러, 간격, 타이포그래피
- **그라데이션 효과**: 브랜드 아이덴티티 강화
- **마이크로 인터랙션**: 호버 효과, 트랜지션, 애니메이션
- **카드 기반 레이아웃**: 정보 구조화와 시각적 계층

### 2. **향상된 UX/UI**
- **로딩 화면**: 부드러운 진입 경험
- **스크롤 인디케이터**: 사용자 안내
- **백 투 탑 버튼**: 편의성 향상
- **타이핑 애니메이션**: 생동감 있는 인터페이스
- **숫자 카운터 애니메이션**: 시각적 임팩트

### 3. **반응형 디자인**
- 모바일 우선 접근법
- 터치 친화적인 인터페이스
- 적응형 네비게이션 메뉴
- 유연한 그리드 시스템

### 4. **성능 최적화**
- Lazy loading 이미지
- Debounce/Throttle 스크롤 이벤트
- CSS 애니메이션 활용 (JavaScript 대신)
- 최소한의 외부 의존성

### 5. **접근성 개선**
- 시맨틱 HTML 구조
- ARIA 레이블
- 키보드 네비게이션 지원
- 고대비 모드 지원

## 🚀 시작하기

### 1. 파일 구조 설정
```bash
# 프로젝트 폴더 생성
mkdir ai-leadership-lab
cd ai-leadership-lab

# 폴더 구조 생성
mkdir css js images

# 파일 복사
# index.html을 루트에
# styles.css를 css/ 폴더에
# main.js를 js/ 폴더에
```

### 2. 이미지 추가
필요한 이미지들을 `images/` 폴더에 추가:
- 로고 이미지
- 김현 소장 프로필 사진
- 프로젝트 로고들

### 3. 이미지 경로 수정
HTML 파일에서 플레이스홀더 이미지 URL을 실제 이미지 경로로 변경:
```html
<!-- 예시 -->
<img src="images/profile.jpg" alt="김현 소장">
```

## 📝 커스터마이징

### 색상 변경
`css/styles.css` 파일 상단의 CSS 변수 수정:
```css
:root {
  --primary: #6366f1;      /* 메인 색상 */
  --secondary: #a855f7;    /* 보조 색상 */
  /* ... */
}
```

### 폰트 변경
```css
:root {
  --font-primary: 'YourFont', sans-serif;
}
```

### 애니메이션 속도
```css
:root {
  --transition-base: all 0.3s ease;  /* 기본 트랜지션 */
  --transition-slow: all 0.5s ease;  /* 느린 트랜지션 */
}
```

## 🌐 배포 방법

### GitHub Pages
1. GitHub 저장소 생성
2. 파일 업로드
3. Settings > Pages에서 배포 설정

### Netlify
1. [Netlify](https://www.netlify.com)에 로그인
2. 프로젝트 폴더 드래그 앤 드롭
3. 자동 배포 완료

### Vercel
1. [Vercel](https://vercel.com)에 로그인
2. 프로젝트 임포트
3. 배포 설정 확인

## 🔧 추가 개선 제안

### 단기 개선사항
- [ ] 실제 이미지 추가
- [ ] 파비콘 제작 및 추가
- [ ] Open Graph 메타태그 이미지
- [ ] Google Analytics 추가
- [ ] 사이트맵 생성

### 장기 개선사항
- [ ] 다크모드 구현
- [ ] 다국어 지원 (i18n)
- [ ] PWA 전환
- [ ] 블로그 섹션 추가
- [ ] 뉴스레터 구독 기능

## 📊 성능 체크리스트

- [ ] Lighthouse 점수 90+ 달성
- [ ] 이미지 최적화 (WebP 포맷)
- [ ] CSS/JS 압축
- [ ] CDN 활용
- [ ] 브라우저 캐싱 설정

## 🤝 문의

- 이메일: hyunnet@gmail.com
- 전화: 010-6613-5782

---

**AI Leadership Lab** - AI 시대의 리더십을 정의합니다.
