// clients 컬렉션 export — 인증이 필요하므로 "로그인된 CRM 페이지"의 브라우저 콘솔에서 실행
//
// 사용법:
//   1. https://leadership.ai.kr/crm/ 접속 → 로그인
//   2. F12 → Console 탭 → 이 파일 내용 전체를 붙여넣고 Enter
//   3. clients.json 파일이 자동 다운로드됨 → aws/migrate/ 폴더에 저장
(async () => {
  const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
  const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

  const firebaseConfig = {
    apiKey: 'AIzaSyDwcyLezAW4nTlfmv6FYzjEe8RgDUgJXuY',
    authDomain: 'ai-leadership-lectures-d509b.firebaseapp.com',
    projectId: 'ai-leadership-lectures-d509b',
    storageBucket: 'ai-leadership-lectures-d509b.firebasestorage.app',
    messagingSenderId: '132724154110',
    appId: '1:132724154110:web:ab5f507a6aee2f583d8faf',
  };
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const snap = await getDocs(collection(db, 'clients'));
  const items = snap.docs.map((d) => {
    const data = d.data();
    // Firestore Timestamp → ISO 문자열
    for (const k of Object.keys(data)) {
      if (data[k] && typeof data[k].toDate === 'function') data[k] = data[k].toDate().toISOString();
    }
    return { id: d.id, ...data };
  });

  const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'clients.json';
  a.click();
  console.log(`clients.json 다운로드 — ${items.length}건`);
})();
