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
