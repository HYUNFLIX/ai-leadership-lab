// 인증 미들웨어 - 세션 기반
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

module.exports = { requireAuth };
