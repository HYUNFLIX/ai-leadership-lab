const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const { initializeDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// 데이터베이스 초기화
// ============================================
initializeDatabase();

// ============================================
// 미들웨어
// ============================================
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
  secret: process.env.SESSION_SECRET || 'ai-leadership-lab-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.USE_HTTPS === 'true'
  }
}));

// ============================================
// API 라우트
// ============================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/lectures', require('./routes/lectures'));
app.use('/api/participants', require('./routes/participants'));
app.use('/api/thanks', require('./routes/thanks'));

// ============================================
// 정적 파일 서빙 (프론트엔드)
// ============================================
const publicPath = path.join(__dirname, '..');
app.use(express.static(publicPath, {
  extensions: ['html'],
  index: 'index.html'
}));

// SPA 라우팅: 존재하지 않는 경로는 index.html로
app.get('*', (req, res) => {
  // API 요청이 아닌 경우에만
  if (!req.path.startsWith('/api/')) {
    const filePath = path.join(publicPath, req.path);
    const fs = require('fs');
    if (fs.existsSync(filePath + '.html')) {
      return res.sendFile(filePath + '.html');
    }
    if (fs.existsSync(path.join(filePath, 'index.html'))) {
      return res.sendFile(path.join(filePath, 'index.html'));
    }
    // 404 페이지
    const notFoundPage = path.join(publicPath, '404.html');
    if (fs.existsSync(notFoundPage)) {
      return res.status(404).sendFile(notFoundPage);
    }
    res.status(404).send('Page not found');
  }
});

// ============================================
// 에러 핸들링
// ============================================
app.use((err, req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// ============================================
// 서버 시작
// ============================================
app.listen(PORT, () => {
  console.log(`
  ==========================================
   AI Leadership Lab Server
   http://localhost:${PORT}
  ==========================================
   관리자 로그인: admin@aileadershiplab.com
   초기 비밀번호: admin1234
  ==========================================
  `);
});
