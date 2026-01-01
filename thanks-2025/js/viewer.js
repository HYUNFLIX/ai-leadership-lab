/* =============================================
   Word Cloud Viewer - Using WordCloud2.js
   2025 감사합니다 워드클라우드
   ============================================= */

// 글로벌 변수
let names = [];
let wordCloudInstance = null;
let namePositions = new Map(); // 이름별 위치 저장

const canvas = document.getElementById('wordcloud-canvas');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResult = document.getElementById('search-result');
const countNumber = document.getElementById('count-number');
const namePopup = document.getElementById('name-popup');
const popupName = document.getElementById('popup-name');
const closePopup = document.getElementById('close-popup');
const tooltip = document.getElementById('tooltip');
const tooltipName = document.getElementById('tooltip-name');

// 그라데이션 색상 팔레트
const colorPalettes = [
    ['#06b6d4', '#0891b2', '#0e7490'], // Cyan
    ['#8b5cf6', '#7c3aed', '#6d28d9'], // Purple
    ['#ec4899', '#db2777', '#be185d'], // Pink
    ['#f59e0b', '#d97706', '#b45309'], // Amber
    ['#10b981', '#059669', '#047857'], // Emerald
    ['#6366f1', '#4f46e5', '#4338ca'], // Indigo
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

// 캔버스 크기 설정
function setupCanvas() {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
}

// 워드클라우드 렌더링
function renderWordCloud() {
    if (names.length === 0) return;

    setupCanvas();
    namePositions.clear();

    // 워드 리스트 생성 (이름, 가중치)
    const wordList = names.map((nameData, index) => {
        // 가중치를 다양하게 (1~3 사이 랜덤 + 약간의 편차)
        const weight = 1 + Math.random() * 2;
        return [nameData.name, weight, nameData];
    });

    // 색상 함수
    const getColor = (word, weight, fontSize, distance, theta) => {
        const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        return palette[Math.floor(Math.random() * palette.length)];
    };

    // 폰트 크기 계산
    const isMobile = window.innerWidth < 768;
    const baseSize = isMobile ? 14 : 20;
    const maxSize = isMobile ? 32 : 48;

    // WordCloud2 옵션
    const options = {
        list: wordList,
        gridSize: isMobile ? 8 : 12,
        weightFactor: (size) => {
            return baseSize + (size * (maxSize - baseSize) / 3);
        },
        fontFamily: 'Pretendard, -apple-system, sans-serif',
        fontWeight: '600',
        color: getColor,
        backgroundColor: 'transparent',
        rotateRatio: 0.3,
        rotationSteps: 2,
        shuffle: true,
        drawOutOfBound: false,
        shrinkToFit: true,
        shape: 'circle',
        ellipticity: 0.8,
        hover: handleWordHover,
        click: handleWordClick,
    };

    // 기존 클라우드 제거
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 새 워드클라우드 생성
    WordCloud(canvas, options);
}

// 호버 핸들러
function handleWordHover(item, dimension, event) {
    if (item) {
        const [name, weight, nameData] = item;
        tooltipName.textContent = name;
        tooltip.style.opacity = '1';
        tooltip.style.left = (event.clientX + 15) + 'px';
        tooltip.style.top = (event.clientY - 10) + 'px';
        canvas.style.cursor = 'pointer';
    } else {
        tooltip.style.opacity = '0';
        canvas.style.cursor = 'default';
    }
}

// 클릭 핸들러
function handleWordClick(item, dimension, event) {
    if (item) {
        const [name, weight, nameData] = item;
        showNamePopup(nameData);
    }
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

    // 마우스 움직임 추적 (툴팁 위치)
    canvas.addEventListener('mousemove', (e) => {
        if (tooltip.style.opacity === '1') {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY - 10) + 'px';
        }
    });
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
        // 찾음
        const firstName = matchedNames[0].name;
        if (matchedNames.length === 1) {
            searchResult.innerHTML = `🎉 <strong>${firstName}</strong>님을 찾았습니다!`;
        } else {
            searchResult.innerHTML = `🎉 ${matchedNames.length}명의 이름을 찾았습니다!`;
        }
        searchResult.style.color = '#4ade80';

        // 하이라이트 효과 (깜빡임)
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

// 이름 하이라이트 (워드클라우드 다시 그리기)
function highlightWords(wordList) {
    // 워드클라우드를 다시 그려서 특정 단어 강조
    // 간단한 깜빡임 효과를 위해 캔버스에 오버레이 추가

    const overlay = document.createElement('div');
    overlay.className = 'search-highlight-overlay';
    overlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at center, rgba(74, 222, 128, 0.2) 0%, transparent 70%);
        pointer-events: none;
        animation: pulse-highlight 1s ease-in-out 3;
    `;

    canvas.parentElement.appendChild(overlay);

    setTimeout(() => {
        overlay.remove();
    }, 3000);
}

// 하이라이트 제거
function clearHighlight() {
    searchResult.classList.add('hidden');
    const notFoundSection = document.getElementById('not-found-section');
    if (notFoundSection) {
        notFoundSection.classList.add('hidden');
    }

    // 오버레이 제거
    const overlay = canvas.parentElement.querySelector('.search-highlight-overlay');
    if (overlay) overlay.remove();
}

// 시작
document.addEventListener('DOMContentLoaded', init);
