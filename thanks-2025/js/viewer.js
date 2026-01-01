/* =============================================
   Tag Cloud Viewer
   2025 감사합니다 워드클라우드
   ============================================= */

// 글로벌 변수
let names = [];
let tagElements = [];
let mouseX = 0;
let mouseY = 0;
let isMouseInCloud = false;

const tagCloud = document.getElementById('tag-cloud');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResult = document.getElementById('search-result');
const countNumber = document.getElementById('count-number');
const namePopup = document.getElementById('name-popup');
const popupName = document.getElementById('popup-name');
const closePopup = document.getElementById('close-popup');

// 카테고리별 색상 클래스
const categoryClasses = {
    colleague: 'tag-colleague',
    mentor: 'tag-mentor',
    client: 'tag-client',
    partner: 'tag-partner',
    friend: 'tag-friend',
    family: 'tag-family',
    other: 'tag-other'
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
    }, 800);
}

// 이름 로드
async function loadNames() {
    names = await DataManager.getNames();
    updateNameCount();
    createTagCloud();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    DataManager.subscribe(async (updatedNames) => {
        names = updatedNames;
        updateNameCount();
        createTagCloud();
    });
}

// 이름 카운트 업데이트
function updateNameCount() {
    countNumber.textContent = names.length;
}

// 태그 클라우드 생성
function createTagCloud() {
    // 기존 요소 제거
    tagCloud.innerHTML = '';
    tagElements = [];

    if (names.length === 0) {
        tagCloud.innerHTML = '<p class="text-center text-gray-500 py-12">아직 등록된 이름이 없습니다.</p>';
        return;
    }

    // 이름을 섞어서 다양하게 표시
    const shuffledNames = [...names].sort(() => Math.random() - 0.5);

    // 태그 컨테이너 (flex wrap)
    const container = document.createElement('div');
    container.className = 'tag-container';

    shuffledNames.forEach((nameData, index) => {
        const tag = document.createElement('button');
        tag.className = `name-tag ${categoryClasses[nameData.category] || 'tag-other'}`;
        tag.textContent = nameData.name;
        tag.dataset.index = names.findIndex(n => n.name === nameData.name);

        // 클릭 이벤트
        tag.addEventListener('click', () => showNamePopup(nameData));

        container.appendChild(tag);
        tagElements.push(tag);
    });

    tagCloud.appendChild(container);
}

// 이름 팝업 표시
function showNamePopup(nameData) {
    popupName.textContent = nameData.name;
    namePopup.classList.remove('hidden');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 마우스 움직임 추적 (웨이브 효과용)
    tagCloud.addEventListener('mousemove', handleMouseMove);
    tagCloud.addEventListener('mouseenter', () => { isMouseInCloud = true; });
    tagCloud.addEventListener('mouseleave', () => {
        isMouseInCloud = false;
        resetAllTags();
    });

    // 터치 이벤트 (모바일)
    tagCloud.addEventListener('touchmove', handleTouchMove, { passive: true });
    tagCloud.addEventListener('touchend', resetAllTags);

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

    // 매칭되는 태그 찾기
    const matchedTags = tagElements.filter((tag) => {
        const index = parseInt(tag.dataset.index);
        return names[index].name.toLowerCase().includes(queryLower);
    });

    searchResult.classList.remove('hidden');

    if (matchedTags.length > 0) {
        // 찾음 - 하이라이트 효과
        matchedTags.forEach(tag => {
            tag.classList.add('tag-found');
            // 화면에 보이도록 스크롤
            if (matchedTags.indexOf(tag) === 0) {
                tag.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });

        // 결과 메시지
        const firstName = names[parseInt(matchedTags[0].dataset.index)].name;
        if (matchedTags.length === 1) {
            searchResult.innerHTML = `🎉 <strong>${firstName}</strong>님을 찾았습니다!`;
        } else {
            searchResult.innerHTML = `🎉 ${matchedTags.length}명의 이름을 찾았습니다!`;
        }
        searchResult.style.color = '#4ade80';

        // 1.5초 후 감사 팝업 표시
        setTimeout(() => {
            const nameData = names[parseInt(matchedTags[0].dataset.index)];
            showNamePopup(nameData);
        }, 1500);

        // 5초 후 하이라이트 제거
        setTimeout(() => {
            matchedTags.forEach(tag => {
                tag.classList.remove('tag-found');
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
    tagElements.forEach(tag => {
        tag.classList.remove('tag-found');
    });
    searchResult.classList.add('hidden');

    const notFoundSection = document.getElementById('not-found-section');
    if (notFoundSection) {
        notFoundSection.classList.add('hidden');
    }
}

// 마우스 움직임 처리 - 웨이브 효과
function handleMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
    applyWaveEffect();
}

// 터치 움직임 처리
function handleTouchMove(e) {
    if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
        applyWaveEffect();
    }
}

// 웨이브 효과 적용 - 마우스 근처 태그들이 반응
function applyWaveEffect() {
    const maxDistance = 150; // 효과 반경

    tagElements.forEach(tag => {
        const rect = tag.getBoundingClientRect();
        const tagCenterX = rect.left + rect.width / 2;
        const tagCenterY = rect.top + rect.height / 2;

        // 마우스와 태그 사이의 거리 계산
        const dx = mouseX - tagCenterX;
        const dy = mouseY - tagCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
            // 거리에 따른 효과 강도 (가까울수록 강함)
            const intensity = 1 - (distance / maxDistance);

            // 스케일 효과
            const scale = 1 + (intensity * 0.3);

            // 밀어내는 효과 (마우스에서 멀어지는 방향)
            const pushX = (dx / distance) * intensity * -15;
            const pushY = (dy / distance) * intensity * -15;

            // 밝기 효과
            const brightness = 1 + (intensity * 0.5);

            tag.style.transform = `translate(${pushX}px, ${pushY}px) scale(${scale})`;
            tag.style.filter = `brightness(${brightness})`;
            tag.style.zIndex = Math.round(intensity * 100);
        } else {
            tag.style.transform = '';
            tag.style.filter = '';
            tag.style.zIndex = '';
        }
    });
}

// 모든 태그 초기화
function resetAllTags() {
    tagElements.forEach(tag => {
        tag.style.transform = '';
        tag.style.filter = '';
        tag.style.zIndex = '';
    });
}

// 시작
document.addEventListener('DOMContentLoaded', init);
