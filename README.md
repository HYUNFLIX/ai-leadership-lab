# AI Leadership Lab Website
**🌐 도메인: https://leadership.ai.kr/**

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
├── 404.html           # 404 에러 페이지
├── sitemap.xml        # SEO 사이트맵
├── robots.txt         # 검색 엔진 설정
├── CNAME             # GitHub Pages 도메인
├── .htaccess         # Apache 서버 설정
└── README.md         # 이 파일
```

## 🚀 도메인 설정 가이드 (leadership.ai.kr)

### 1. **DNS 설정 (도메인 업체에서)**

#### A. GitHub Pages 사용 시
```
Type: A
Name: @
Value: 185.199.108.153
       185.199.109.153
       185.199.110.153
       185.199.111.153

Type: CNAME
Name: www
Value: {username}.github.io
```

#### B. 일반 호스팅 사용 시
```
Type: A
Name: @
Value: [호스팅 서버 IP]

Type: CNAME
Name: www
Value: leadership.ai.kr
```

### 2. **GitHub Pages 배포**

1. GitHub에 새 저장소 생성
2. 저장소 이름: `leadership-ai-kr` 또는 원하는 이름
3. 파일 업로드
4. Settings > Pages 설정:
   - Source: Deploy from a branch
   - Branch: main / root
   - Custom domain: leadership.ai.kr
5. HTTPS 강제 적용 체크

### 3. **SSL 인증서**

- GitHub Pages: 자동 Let's Encrypt SSL
- 일반 호스팅: Let's Encrypt 또는 호스팅 업체 SSL 사용

## 📋 업로드 전 체크리스트

- [ ] 실제 이미지 파일 추가
  - [ ] 김현 소장 프로필 사진 (`images/director.jpg`)
  - [ ] 로고 이미지 (`images/logo.png`)
  - [ ] Open Graph 이미지 (`images/og-image.jpg`)
  - [ ] 파비콘 (`favicon.ico`, `favicon-32x32.png`, `favicon-16x16.png`)
- [ ] 이미지 경로 수정 (플레이스홀더 → 실제 경로)
- [ ] 연락처 정보 확인
- [ ] 도메인 설정 완료
- [ ] SSL 인증서 활성화

## 🔍 SEO 최적화 체크리스트

- [x] 메타 태그 설정
- [x] Open Graph 태그
- [x] Twitter Card 태그
- [x] Canonical URL
- [x] JSON-LD 구조화 데이터
- [x] Sitemap.xml
- [x] Robots.txt
- [ ] Google Search Console 등록
- [ ] Naver Webmaster Tools 등록
- [ ] Google Analytics 설치

## 📊 성능 최적화

### 이미지 최적화
```bash
# WebP 변환 (imagemagick 필요)
convert image.jpg -quality 80 image.webp

# 또는 온라인 도구 사용
# https://squoosh.app/
```

### 파일 압축
```bash
# CSS 압축
npx csso css/styles.css -o css/styles.min.css

# JS 압축
npx terser js/main.js -o js/main.min.js
```

## 🎨 커스터마이징

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
