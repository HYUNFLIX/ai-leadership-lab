// 스크롤 프로그레스 바
window.addEventListener('scroll', () => {
    const scrollTop = document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const progress = (scrollTop / scrollHeight) * 100;
    document.documentElement.style.setProperty('--scroll-progress', progress + '%');
});

// Top 버튼 표시/숨김
const topBtn = document.getElementById('topBtn');
window.addEventListener('scroll', () => {
    if (window.scrollY > 500) {
        topBtn.classList.add('visible');
    } else {
        topBtn.classList.remove('visible');
    }
});

topBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

// 모바일 메뉴
const menuBtn = document.getElementById('menuBtn');
const closeMenuBtn = document.getElementById('closeMenuBtn');
const mobileMenu = document.getElementById('mobileMenu');
const menuOverlay = document.getElementById('menuOverlay');

function openMenu() {
    mobileMenu.classList.add('active');
    menuOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeMenu() {
    mobileMenu.classList.remove('active');
    menuOverlay.classList.add('hidden');
    document.body.style.overflow = '';
}

menuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', closeMenu);

// 모바일 메뉴 링크 클릭 시 메뉴 닫기
mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// 아코디언
document.querySelectorAll('.accordion-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const accordionId = this.getAttribute('data-accordion');
        const content = document.getElementById(accordionId);
        const isActive = this.classList.contains('active');

        // 모든 아코디언 닫기 (같은 섹션 내에서만)
        const section = this.closest('section');
        if (section) {
            section.querySelectorAll('.accordion-btn').forEach(b => {
                b.classList.remove('active');
            });
            section.querySelectorAll('.accordion-content').forEach(c => {
                c.classList.remove('active');
            });
        }

        // 클릭한 아코디언 토글
        if (!isActive) {
            this.classList.add('active');
            content.classList.add('active');
        }
    });
});

// 스크롤 애니메이션
const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in-up').forEach(el => {
    observer.observe(el);
});

// 네비게이션 스크롤 시 스타일 변경
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('shadow-lg');
    } else {
        navbar.classList.remove('shadow-lg');
    }
});

// ==================== 접근성 기능 ====================

// 섹션 목록 정의
const sections = [
    { id: 'hero', name: '처음' },
    { id: 'stats', name: '현황' },
    { id: 'law', name: '한우법' },
    { id: 'feed', name: '사료가격' },
    { id: 'import', name: '수입대응' },
    { id: 'policy', name: '정책협약' },
    { id: 'compensation', name: '보상제도' },
    { id: 'prevention', name: '방역관리' },
    { id: 'other', name: '기타활동' }
];

let currentSectionIndex = 0;

// 1. 글꼴 크기 조절
const fontSmall = document.getElementById('fontSmall');
const fontMedium = document.getElementById('fontMedium');
const fontLarge = document.getElementById('fontLarge');

function setFontSize(size) {
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add(`font-${size}`);

    // 버튼 상태 업데이트
    document.querySelectorAll('.font-size-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`font${size.charAt(0).toUpperCase() + size.slice(1)}`).classList.add('active');

    // 로컬 스토리지에 저장
    localStorage.setItem('fontSize', size);
}

// 저장된 글꼴 크기 복원
const savedFontSize = localStorage.getItem('fontSize') || 'medium';
setFontSize(savedFontSize);

fontSmall.addEventListener('click', () => setFontSize('small'));
fontMedium.addEventListener('click', () => setFontSize('medium'));
fontLarge.addEventListener('click', () => setFontSize('large'));

// 2. 고대비 모드
const contrastToggle = document.getElementById('contrastToggle');

function toggleHighContrast() {
    document.documentElement.classList.toggle('high-contrast');
    const isHighContrast = document.documentElement.classList.contains('high-contrast');
    localStorage.setItem('highContrast', isHighContrast);

    // 버튼 텍스트 업데이트
    contrastToggle.querySelector('span:last-child').textContent = isHighContrast ? '일반' : '고대비';
}

// 저장된 고대비 모드 복원
if (localStorage.getItem('highContrast') === 'true') {
    document.documentElement.classList.add('high-contrast');
    contrastToggle.querySelector('span:last-child').textContent = '일반';
}

contrastToggle.addEventListener('click', toggleHighContrast);

// 3. 음성으로 듣기 (TTS)
const ttsToggle = document.getElementById('ttsToggle');
let isTTSActive = false;
let currentUtterance = null;

function stopTTS() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    isTTSActive = false;
    ttsToggle.classList.remove('active');
    ttsToggle.querySelector('span:last-child').textContent = '음성';
}

function speakCurrentSection() {
    if (!window.speechSynthesis) {
        alert('이 브라우저에서는 음성 읽기가 지원되지 않습니다.');
        return;
    }

    const currentSection = sections[currentSectionIndex];
    const sectionEl = document.getElementById(currentSection.id);

    if (!sectionEl) return;

    // 섹션의 텍스트 내용 가져오기
    const textContent = sectionEl.innerText.substring(0, 1000); // 처음 1000자만

    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(textContent);
    currentUtterance.lang = 'ko-KR';
    currentUtterance.rate = 0.9;

    currentUtterance.onend = () => {
        if (isTTSActive && currentSectionIndex < sections.length - 1) {
            // 다음 섹션으로 자동 이동
            currentSectionIndex++;
            updatePageIndicator();
            setTimeout(speakCurrentSection, 500);
        } else {
            stopTTS();
        }
    };

    window.speechSynthesis.speak(currentUtterance);
}

function toggleTTS() {
    if (isTTSActive) {
        stopTTS();
    } else {
        isTTSActive = true;
        ttsToggle.classList.add('active');
        ttsToggle.querySelector('span:last-child').textContent = '중지';
        speakCurrentSection();
    }
}

ttsToggle.addEventListener('click', toggleTTS);

// 4. 모두 펼치기/접기
const expandAll = document.getElementById('expandAll');
let isExpanded = false;

function toggleExpandAll() {
    isExpanded = !isExpanded;

    const accordionBtns = document.querySelectorAll('.accordion-btn');
    const accordionContents = document.querySelectorAll('.accordion-content');

    accordionBtns.forEach(btn => {
        if (isExpanded) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    accordionContents.forEach(content => {
        if (isExpanded) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });

    expandAll.classList.toggle('active', isExpanded);
    expandAll.querySelector('span:last-child').textContent = isExpanded ? '접기' : '펼치기';
}

expandAll.addEventListener('click', toggleExpandAll);

// 5. 인쇄하기
const printBtn = document.getElementById('printBtn');

printBtn.addEventListener('click', () => {
    // 인쇄 전 모든 아코디언 펼치기
    document.querySelectorAll('.accordion-btn').forEach(btn => btn.classList.add('active'));
    document.querySelectorAll('.accordion-content').forEach(content => content.classList.add('active'));

    setTimeout(() => {
        window.print();
    }, 100);
});

// 6. 플로팅 목차 - 현재 섹션 하이라이트
const tocLinks = document.querySelectorAll('.toc-link');

function updateTocHighlight() {
    const scrollPosition = window.scrollY + window.innerHeight / 3;

    let activeSection = sections[0].id;

    sections.forEach(section => {
        const el = document.getElementById(section.id);
        if (el && el.offsetTop <= scrollPosition) {
            activeSection = section.id;
        }
    });

    tocLinks.forEach(link => {
        if (link.getAttribute('data-section') === activeSection) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // 현재 섹션 인덱스 업데이트
    currentSectionIndex = sections.findIndex(s => s.id === activeSection);
    updatePageIndicator();
}

window.addEventListener('scroll', updateTocHighlight);

// 7. 페이지 위치 안내
const currentSectionName = document.getElementById('currentSectionName');
const pageProgress = document.getElementById('pageProgress');
const prevSection = document.getElementById('prevSection');
const nextSection = document.getElementById('nextSection');

function updatePageIndicator() {
    const section = sections[currentSectionIndex];
    currentSectionName.textContent = section.name;
    pageProgress.textContent = `${currentSectionIndex + 1} / ${sections.length}`;
}

function goToPrevSection() {
    if (currentSectionIndex > 0) {
        currentSectionIndex--;
        const targetSection = document.getElementById(sections[currentSectionIndex].id);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
        updatePageIndicator();
    }
}

function goToNextSection() {
    if (currentSectionIndex < sections.length - 1) {
        currentSectionIndex++;
        const targetSection = document.getElementById(sections[currentSectionIndex].id);
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
        updatePageIndicator();
    }
}

prevSection.addEventListener('click', goToPrevSection);
nextSection.addEventListener('click', goToNextSection);

// 초기화
updateTocHighlight();
updatePageIndicator();
