/* =============================================
   Word Cloud Viewer - Smooth Size Animation
   2025 감사합니다 워드클라우드
   ============================================= */

let names = [];
let wordElements = [];

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
    '#06b6d4', '#0891b2',
    '#8b5cf6', '#7c3aed',
    '#ec4899', '#db2777',
    '#f59e0b', '#d97706',
    '#10b981', '#059669',
    '#6366f1', '#4f46e5',
    '#f43f5e', '#e11d48',
    '#14b8a6', '#0d9488',
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

    const containerRect = container.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    const minSize = isMobile ? 14 : 18;
    const maxSize = isMobile ? 32 : 48;

    names.forEach((nameData, index) => {
        const word = document.createElement('div');
        word.className = 'word-item';
        word.textContent = nameData.name;
        word.dataset.name = nameData.name;

        // 랜덤 크기
        const baseSize = minSize + Math.random() * (maxSize - minSize);
        const color = colors[Math.floor(Math.random() * colors.length)];

        // 위치 (원형 분포)
        const angle = (index / names.length) * Math.PI * 2;
        const radiusX = containerRect.width * 0.38;
        const radiusY = containerRect.height * 0.35;
        const offsetX = Math.cos(angle) * radiusX * (0.3 + Math.random() * 0.7);
        const offsetY = Math.sin(angle) * radiusY * (0.3 + Math.random() * 0.7);

        // 랜덤 애니메이션 시간 (3초~6초)
        const duration = 3 + Math.random() * 3;
        // 랜덤 딜레이
        const delay = Math.random() * -duration;

        word.style.cssText = `
            position: absolute;
            left: calc(50% + ${offsetX}px);
            top: calc(50% + ${offsetY}px);
            transform: translate(-50%, -50%);
            font-size: ${baseSize}px;
            font-weight: 600;
            color: ${color};
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            text-shadow: 0 0 20px ${color}50;
            animation: breathe ${duration}s ease-in-out ${delay}s infinite;
            transition: transform 0.3s ease, text-shadow 0.3s ease, filter 0.3s ease;
        `;

        word.dataset.color = color;
        word.dataset.offsetX = offsetX;
        word.dataset.offsetY = offsetY;

        // 호버 이벤트 - 크게 확대
        word.addEventListener('mouseenter', () => {
            word.style.animation = 'none';
            word.style.transform = 'translate(-50%, -50%) scale(1.8)';
            word.style.textShadow = `0 0 40px ${color}, 0 0 80px ${color}`;
            word.style.filter = 'brightness(1.3)';
            word.style.zIndex = '100';
        });

        word.addEventListener('mouseleave', () => {
            word.style.transform = 'translate(-50%, -50%) scale(1)';
            word.style.textShadow = `0 0 20px ${color}50`;
            word.style.filter = 'brightness(1)';
            word.style.zIndex = '1';
            // 애니메이션 다시 시작
            setTimeout(() => {
                word.style.animation = `breathe ${duration}s ease-in-out ${delay}s infinite`;
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

// 이벤트 리스너
function setupEventListeners() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
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
            element.style.transform = 'translate(-50%, -50%) scale(2.5)';
            element.style.textShadow = `0 0 50px ${color}, 0 0 100px ${color}`;
            element.style.filter = 'brightness(1.5)';
            element.style.zIndex = '100';
        }
    });

    setTimeout(() => {
        wordElements.forEach(({ element, color }) => {
            element.style.transform = 'translate(-50%, -50%) scale(1)';
            element.style.textShadow = `0 0 20px ${color}50`;
            element.style.filter = 'brightness(1)';
            element.style.zIndex = '1';
            const duration = 3 + Math.random() * 3;
            element.style.animation = `breathe ${duration}s ease-in-out infinite`;
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
