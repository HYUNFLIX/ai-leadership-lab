/* =============================================
   Word Cloud Viewer - DOM-based Smooth Animation
   2025 감사합니다 워드클라우드
   ============================================= */

// 글로벌 변수
let names = [];
let wordElements = [];
let animationFrameId = null;

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
    '#06b6d4', '#0891b2', // Cyan
    '#8b5cf6', '#7c3aed', // Purple
    '#ec4899', '#db2777', // Pink
    '#f59e0b', '#d97706', // Amber
    '#10b981', '#059669', // Emerald
    '#6366f1', '#4f46e5', // Indigo
    '#f43f5e', '#e11d48', // Rose
    '#14b8a6', '#0d9488', // Teal
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

    // 기존 요소 제거
    container.innerHTML = '';
    wordElements = [];

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    const containerRect = container.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;

    // 폰트 크기 범위
    const minSize = isMobile ? 12 : 16;
    const maxSize = isMobile ? 28 : 42;

    // 각 이름에 대해 요소 생성
    names.forEach((nameData, index) => {
        const word = document.createElement('div');
        word.className = 'word-item';
        word.textContent = nameData.name;
        word.dataset.name = nameData.name;

        // 랜덤 초기 크기
        const baseSize = minSize + Math.random() * (maxSize - minSize);
        const color = colors[Math.floor(Math.random() * colors.length)];

        // 위치 계산 (원형 분포)
        const angle = (index / names.length) * Math.PI * 2;
        const radiusX = containerRect.width * 0.35;
        const radiusY = containerRect.height * 0.35;
        const offsetX = Math.cos(angle) * radiusX * (0.3 + Math.random() * 0.7);
        const offsetY = Math.sin(angle) * radiusY * (0.3 + Math.random() * 0.7);

        // 초기 스타일
        word.style.cssText = `
            position: absolute;
            left: 50%;
            top: 50%;
            font-size: ${baseSize}px;
            font-weight: 600;
            color: ${color};
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            transition: transform 0.3s ease, text-shadow 0.3s ease;
            transform: translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px));
            text-shadow: 0 0 20px ${color}40;
        `;

        // 애니메이션 데이터 저장
        const wordData = {
            element: word,
            baseSize: baseSize,
            currentSize: baseSize,
            targetSize: baseSize,
            color: color,
            offsetX: offsetX,
            offsetY: offsetY,
            phase: Math.random() * Math.PI * 2,
            speed: 0.5 + Math.random() * 0.5,
            sizePhase: Math.random() * Math.PI * 2,
            sizeSpeed: 0.3 + Math.random() * 0.4,
        };

        // 호버 이벤트
        word.addEventListener('mouseenter', () => {
            word.style.transform = `translate(calc(-50% + ${wordData.offsetX}px), calc(-50% + ${wordData.offsetY}px)) scale(1.5)`;
            word.style.textShadow = `0 0 30px ${wordData.color}, 0 0 60px ${wordData.color}`;
            word.style.zIndex = '10';
        });

        word.addEventListener('mouseleave', () => {
            word.style.transform = `translate(calc(-50% + ${wordData.offsetX}px), calc(-50% + ${wordData.offsetY}px)) scale(1)`;
            word.style.textShadow = `0 0 20px ${wordData.color}40`;
            word.style.zIndex = '1';
        });

        // 클릭 이벤트
        word.addEventListener('click', () => {
            showNamePopup(nameData);
        });

        container.appendChild(word);
        wordElements.push(wordData);
    });

    // 애니메이션 시작
    startAnimation();
}

// 애니메이션 루프
function startAnimation() {
    let lastTime = performance.now();

    function animate(currentTime) {
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        const isMobile = window.innerWidth < 768;
        const minSize = isMobile ? 12 : 16;
        const maxSize = isMobile ? 28 : 42;

        wordElements.forEach((wordData) => {
            // 크기 애니메이션 (사인파로 부드럽게)
            wordData.sizePhase += deltaTime * wordData.sizeSpeed;
            const sizeFactor = 0.7 + Math.sin(wordData.sizePhase) * 0.3;
            const newSize = wordData.baseSize * sizeFactor;

            // 크기 적용 (부드러운 변화)
            wordData.currentSize += (newSize - wordData.currentSize) * 0.05;
            wordData.element.style.fontSize = `${wordData.currentSize}px`;
        });

        animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);
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
            renderWordCloud();
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

    // 매칭되는 이름 찾기
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

        // 하이라이트 효과
        highlightWords(matchedNames.map(n => n.name));

        // 1.5초 후 팝업
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

// 이름 하이라이트
function highlightWords(wordList) {
    wordElements.forEach((wordData) => {
        const name = wordData.element.dataset.name;
        if (wordList.includes(name)) {
            wordData.element.style.transform = `translate(calc(-50% + ${wordData.offsetX}px), calc(-50% + ${wordData.offsetY}px)) scale(2)`;
            wordData.element.style.textShadow = `0 0 40px ${wordData.color}, 0 0 80px ${wordData.color}`;
            wordData.element.style.zIndex = '20';

            // 깜빡임 효과
            wordData.element.style.animation = 'pulse-glow 0.5s ease-in-out infinite';
        }
    });

    setTimeout(() => {
        wordElements.forEach((wordData) => {
            wordData.element.style.animation = '';
            wordData.element.style.transform = `translate(calc(-50% + ${wordData.offsetX}px), calc(-50% + ${wordData.offsetY}px)) scale(1)`;
            wordData.element.style.textShadow = `0 0 20px ${wordData.color}40`;
            wordData.element.style.zIndex = '1';
        });
    }, 3000);
}

// 하이라이트 제거
function clearHighlight() {
    searchResult.classList.add('hidden');
    const notFoundSection = document.getElementById('not-found-section');
    if (notFoundSection) {
        notFoundSection.classList.add('hidden');
    }
}

// 시작
document.addEventListener('DOMContentLoaded', init);
