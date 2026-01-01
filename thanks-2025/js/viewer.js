/* =============================================
   Word Cloud Viewer - Readable Scrollable Layout
   2025 감사합니다 워드클라우드
   ============================================= */

let names = [];
let wordElements = [];
let currentZoom = 1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

const container = document.getElementById('wordcloud-container');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResult = document.getElementById('search-result');
const countNumber = document.getElementById('count-number');
const namePopup = document.getElementById('name-popup');
const popupName = document.getElementById('popup-name');
const closePopup = document.getElementById('close-popup');

// 색상 팔레트
const colors = [
    '#06b6d4', '#22d3ee',
    '#8b5cf6', '#a78bfa',
    '#ec4899', '#f472b6',
    '#f59e0b', '#fbbf24',
    '#10b981', '#34d399',
    '#6366f1', '#818cf8',
    '#f43f5e', '#fb7185',
    '#14b8a6', '#2dd4bf',
];

// 초기화
async function init() {
    await initSampleData();
    setupEventListeners();
    await loadNames();
    subscribeToUpdates();

    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }, 800);
}

// 이름 로드
async function loadNames() {
    names = await DataManager.getNames();
    updateNameCount();
    renderWordCloud();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    DataManager.subscribe(async (updatedNames) => {
        names = updatedNames;
        updateNameCount();
        renderWordCloud();
    });
}

// 이름 카운트 업데이트
function updateNameCount() {
    countNumber.textContent = names.length;
}

// 워드클라우드 렌더링
function renderWordCloud() {
    if (names.length === 0) return;

    container.innerHTML = '';
    wordElements = [];

    const isMobile = window.innerWidth < 768;

    // Flex 컨테이너 스타일 적용
    container.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-content: flex-start;
        gap: ${isMobile ? '4px' : '10px'};
    `;

    // 이름 섞기
    const shuffledNames = [...names].sort(() => Math.random() - 0.5);

    shuffledNames.forEach((nameData, index) => {
        const word = document.createElement('span');
        word.className = 'word-item';
        word.textContent = nameData.name;
        word.dataset.name = nameData.name;

        // 랜덤 크기 (3단계)
        const sizeClass = Math.floor(Math.random() * 3);
        let fontSize;
        if (isMobile) {
            // 모바일: 작은 글씨로 한 줄에 많이 보이게
            fontSize = sizeClass === 0 ? 9 : sizeClass === 1 ? 10 : 11;
        } else {
            fontSize = sizeClass === 0 ? 15 : sizeClass === 1 ? 20 : 26;
        }

        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = (Math.random() * 3).toFixed(2);

        word.style.cssText = `
            font-size: ${fontSize}px;
            font-weight: 500;
            color: ${color};
            padding: ${isMobile ? '3px 6px' : '8px 16px'};
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            border-radius: ${isMobile ? '12px' : '25px'};
            background: ${color}20;
            border: 1px solid ${color}30;
            transition: all 0.3s ease;
            animation: pulse ${2 + Math.random() * 2}s ease-in-out ${delay}s infinite;
        `;

        word.dataset.color = color;

        // 호버 이벤트
        word.addEventListener('mouseenter', () => {
            word.style.transform = 'scale(1.4)';
            word.style.background = `${color}50`;
            word.style.boxShadow = `0 0 25px ${color}70`;
            word.style.zIndex = '100';
        });

        word.addEventListener('mouseleave', () => {
            word.style.transform = 'scale(1)';
            word.style.background = `${color}20`;
            word.style.boxShadow = 'none';
            word.style.zIndex = '1';
        });

        // 터치 이벤트 (모바일)
        word.addEventListener('touchstart', (e) => {
            word.style.transform = 'scale(1.3)';
            word.style.background = `${color}50`;
            word.style.boxShadow = `0 0 25px ${color}70`;
        });

        word.addEventListener('touchend', () => {
            setTimeout(() => {
                word.style.transform = 'scale(1)';
                word.style.background = `${color}20`;
                word.style.boxShadow = 'none';
            }, 300);
        });

        // 클릭
        word.addEventListener('click', () => {
            showNamePopup(nameData);
        });

        container.appendChild(word);
        wordElements.push({ element: word, nameData, color });
    });
}

// 이름 팝업
function showNamePopup(nameData) {
    popupName.textContent = nameData.name;
    namePopup.classList.remove('hidden');
}

// 줌 기능
function setupZoom() {
    // 마우스 휠 줌 (데스크톱)
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom + delta));
        applyZoom();
    }, { passive: false });

    // 핀치 줌 (모바일)
    let initialDistance = 0;
    let initialZoom = 1;

    container.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            initialDistance = getDistance(e.touches[0], e.touches[1]);
            initialZoom = currentZoom;
        }
    });

    container.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            const currentDistance = getDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialDistance;
            currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialZoom * scale));
            applyZoom();
        }
    }, { passive: false });
}

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function applyZoom() {
    container.style.transform = `scale(${currentZoom})`;
    container.style.transformOrigin = 'center top';
}

// 이벤트 리스너
function setupEventListeners() {
    // 줌 설정
    setupZoom();

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            currentZoom = 1;
            applyZoom();
            renderWordCloud();
        }, 300);
    });

    searchBtn.addEventListener('click', searchName);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchName();
    });
    searchInput.addEventListener('input', () => {
        if (searchInput.value === '') {
            clearHighlight();
        }
    });

    closePopup.addEventListener('click', () => {
        namePopup.classList.add('hidden');
    });
    namePopup.addEventListener('click', (e) => {
        if (e.target === namePopup) {
            namePopup.classList.add('hidden');
        }
    });

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

// 검색
function searchName() {
    const query = searchInput.value.trim();
    if (!query) return;

    const queryLower = query.toLowerCase();
    clearHighlight();

    const notFoundSection = document.getElementById('not-found-section');
    notFoundSection.classList.add('hidden');

    const matchedNames = names.filter(n =>
        n.name.toLowerCase().includes(queryLower)
    );

    searchResult.classList.remove('hidden');

    if (matchedNames.length > 0) {
        const firstName = matchedNames[0].name;
        if (matchedNames.length === 1) {
            searchResult.innerHTML = `🎉 <strong>${firstName}</strong>님을 찾았습니다!`;
        } else {
            searchResult.innerHTML = `🎉 ${matchedNames.length}명의 이름을 찾았습니다!`;
        }
        searchResult.style.color = '#4ade80';

        highlightWords(matchedNames.map(n => n.name));

        setTimeout(() => {
            showNamePopup(matchedNames[0]);
        }, 1500);

    } else {
        searchResult.textContent = '해당 이름을 찾을 수 없습니다.';
        searchResult.style.color = '#f87171';

        const requestNameInput = document.getElementById('request-name');
        if (requestNameInput) {
            requestNameInput.value = query;
        }

        notFoundSection.classList.remove('hidden');
    }

    setTimeout(() => {
        searchResult.classList.add('hidden');
    }, 5000);
}

// 하이라이트
function highlightWords(wordList) {
    wordElements.forEach(({ element, color }) => {
        const name = element.dataset.name;
        if (wordList.includes(name)) {
            element.style.animation = 'none';
            element.style.transform = 'scale(1.8)';
            element.style.background = `${color}70`;
            element.style.boxShadow = `0 0 35px ${color}`;
            element.style.zIndex = '100';

            // 스크롤하여 보이게
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });

    setTimeout(() => {
        wordElements.forEach(({ element, color }) => {
            element.style.transform = 'scale(1)';
            element.style.background = `${color}20`;
            element.style.boxShadow = 'none';
            element.style.zIndex = '1';
            element.style.animation = `pulse ${2 + Math.random() * 2}s ease-in-out infinite`;
        });
    }, 3000);
}

function clearHighlight() {
    searchResult.classList.add('hidden');
    const notFoundSection = document.getElementById('not-found-section');
    if (notFoundSection) {
        notFoundSection.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', init);
