/* =============================================
   2D Floating Word Cloud - CSS Animation
   2025 감사합니다 워드클라우드
   ============================================= */

// 글로벌 변수
let names = [];
let nameElements = [];
const container = document.getElementById('cloud-container');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResult = document.getElementById('search-result');
const countNumber = document.getElementById('count-number');
const namePopup = document.getElementById('name-popup');
const popupName = document.getElementById('popup-name');
const closePopup = document.getElementById('close-popup');

// 카테고리별 색상
const categoryColors = {
    colleague: '#818cf8',  // Indigo
    mentor: '#c084fc',     // Purple
    client: '#22d3ee',     // Cyan
    partner: '#4ade80',    // Green
    friend: '#fbbf24',     // Yellow
    family: '#fb7185',     // Pink
    other: '#9ca3af'       // Gray
};

// 초기화
async function init() {
    // 샘플 데이터 초기화
    await initSampleData();

    // 이벤트 리스너
    setupEventListeners();

    // 이름 로드 및 구독
    await loadNames();
    subscribeToUpdates();

    // 로더 숨기기
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }, 1000);
}

// 이름 로드
async function loadNames() {
    names = await DataManager.getNames();
    updateNameCount();
    createFloatingNames();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    DataManager.subscribe(async (updatedNames) => {
        names = updatedNames;
        updateNameCount();
        createFloatingNames();
    });
}

// 이름 카운트 업데이트
function updateNameCount() {
    countNumber.textContent = names.length;
}

// 플로팅 이름 생성
function createFloatingNames() {
    // 기존 요소 제거
    nameElements.forEach(el => el.remove());
    nameElements = [];

    if (names.length === 0) return;

    const isMobile = window.innerWidth < 768;

    // 안전 영역 계산 (헤더, 검색바 피하기)
    const safeTop = isMobile ? 140 : 160;
    const safeBottom = 40;
    const safeSide = 20;

    names.forEach((nameData, index) => {
        const el = document.createElement('div');
        el.className = 'floating-name';
        el.textContent = nameData.name;
        el.dataset.index = index;

        // 카테고리별 색상
        const color = categoryColors[nameData.category] || categoryColors.other;
        el.style.color = color;

        // 랜덤 크기 (모바일 대응)
        const baseSize = isMobile ? 14 : 18;
        const sizeVariation = isMobile ? 14 : 20;
        const size = baseSize + Math.random() * sizeVariation;
        el.style.fontSize = `${size}px`;

        // 랜덤 위치
        const x = safeSide + Math.random() * (window.innerWidth - safeSide * 2 - 100);
        const y = safeTop + Math.random() * (window.innerHeight - safeTop - safeBottom - 50);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;

        // 랜덤 애니메이션 설정
        const duration = 15 + Math.random() * 20; // 15~35초
        const delay = Math.random() * -30; // 시작 위치 다양화
        el.style.animationDuration = `${duration}s`;
        el.style.animationDelay = `${delay}s`;

        // 랜덤 플로팅 방향 (8가지 방향 중 하나)
        const directions = ['float-1', 'float-2', 'float-3', 'float-4', 'float-5', 'float-6', 'float-7', 'float-8'];
        const direction = directions[Math.floor(Math.random() * directions.length)];
        el.classList.add(direction);

        // 클릭 이벤트
        el.addEventListener('click', () => showNamePopup(nameData));

        container.appendChild(el);
        nameElements.push(el);
    });
}

// 이름 팝업 표시
function showNamePopup(nameData) {
    popupName.textContent = nameData.name;
    namePopup.classList.remove('hidden');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 윈도우 리사이즈
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            createFloatingNames();
        }, 300);
    });

    // 검색
    searchBtn.addEventListener('click', searchName);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchName();
    });
    searchInput.addEventListener('input', () => {
        if (searchInput.value === '') {
            clearHighlight();
        }
    });

    // 팝업 닫기
    closePopup.addEventListener('click', () => {
        namePopup.classList.add('hidden');
    });
    namePopup.addEventListener('click', (e) => {
        if (e.target === namePopup) {
            namePopup.classList.add('hidden');
        }
    });

    // 이름 등록 요청 제출
    const submitRequest = document.getElementById('submit-request');
    const requestNameInput = document.getElementById('request-name');
    const requestForm = document.getElementById('request-form');
    const requestSuccess = document.getElementById('request-success');

    if (submitRequest) {
        submitRequest.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const name = requestNameInput.value.trim();
            if (!name) {
                requestNameInput.focus();
                return;
            }

            submitRequest.disabled = true;
            submitRequest.textContent = '요청 중...';

            try {
                await DataManager.saveRequest(name);
                requestForm.classList.add('hidden');
                requestSuccess.classList.remove('hidden');

                setTimeout(() => {
                    requestNameInput.value = '';
                    requestForm.classList.remove('hidden');
                    requestSuccess.classList.add('hidden');
                    document.getElementById('not-found-section').classList.add('hidden');
                    submitRequest.disabled = false;
                    submitRequest.textContent = '등록 요청하기';
                }, 3000);
            } catch (error) {
                console.error('요청 저장 실패:', error);
                alert('요청 저장에 실패했습니다. 다시 시도해주세요.');
                submitRequest.disabled = false;
                submitRequest.textContent = '등록 요청하기';
            }
        });
    }
}

// 이름 검색
function searchName() {
    const query = searchInput.value.trim();
    if (!query) return;

    const queryLower = query.toLowerCase();
    clearHighlight();

    const notFoundSection = document.getElementById('not-found-section');
    notFoundSection.classList.add('hidden');

    // 매칭되는 요소 찾기
    const matchedElements = nameElements.filter((el, index) => {
        return names[index].name.toLowerCase().includes(queryLower);
    });

    searchResult.classList.remove('hidden');

    if (matchedElements.length > 0) {
        // 찾음 - 하이라이트 효과
        matchedElements.forEach(el => {
            el.classList.add('found-highlight');
        });

        // 결과 메시지
        const firstName = names[parseInt(matchedElements[0].dataset.index)].name;
        if (matchedElements.length === 1) {
            searchResult.innerHTML = `🎉 <strong>${firstName}</strong>님을 찾았습니다!`;
        } else {
            searchResult.innerHTML = `🎉 ${matchedElements.length}명의 이름을 찾았습니다!`;
        }
        searchResult.style.color = '#4ade80';

        // 1.5초 후 감사 팝업 표시
        setTimeout(() => {
            const nameData = names[parseInt(matchedElements[0].dataset.index)];
            showNamePopup(nameData);
        }, 1500);

        // 5초 후 하이라이트 제거
        setTimeout(() => {
            matchedElements.forEach(el => {
                el.classList.remove('found-highlight');
            });
        }, 5000);

    } else {
        // 못 찾음
        searchResult.textContent = '해당 이름을 찾을 수 없습니다.';
        searchResult.style.color = '#f87171';

        const requestNameInput = document.getElementById('request-name');
        if (requestNameInput) {
            requestNameInput.value = query;
        }

        notFoundSection.classList.remove('hidden');
    }

    // 5초 후 검색 결과 숨김
    setTimeout(() => {
        searchResult.classList.add('hidden');
    }, 5000);
}

// 하이라이트 제거
function clearHighlight() {
    nameElements.forEach(el => {
        el.classList.remove('found-highlight');
    });
    searchResult.classList.add('hidden');

    const notFoundSection = document.getElementById('not-found-section');
    if (notFoundSection) {
        notFoundSection.classList.add('hidden');
    }
}

// 시작
document.addEventListener('DOMContentLoaded', init);
