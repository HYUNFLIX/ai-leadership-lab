/* =============================================
   Admin Page - 이름 관리
   2025 감사합니다 워드클라우드
   ============================================= */

// DOM 요소
const addNameForm = document.getElementById('add-name-form');
const nameInput = document.getElementById('name-input');
const categorySelect = document.getElementById('category-select');
const messageInput = document.getElementById('message-input');
const bulkAddBtn = document.getElementById('bulk-add-btn');
const bulkModal = document.getElementById('bulk-modal');
const bulkInput = document.getElementById('bulk-input');
const bulkSubmitBtn = document.getElementById('bulk-submit-btn');
const searchList = document.getElementById('search-list');
const filterCategory = document.getElementById('filter-category');
const nameList = document.getElementById('name-list');
const emptyState = document.getElementById('empty-state');
const exportBtn = document.getElementById('export-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

// 통계 요소
const statTotal = document.getElementById('stat-total');
const statColleague = document.getElementById('stat-colleague');
const statMentor = document.getElementById('stat-mentor');
const statOther = document.getElementById('stat-other');

// 카테고리 한글 매핑
const categoryLabels = {
    colleague: '동료',
    mentor: '멘토',
    client: '고객',
    partner: '파트너',
    friend: '친구',
    family: '가족',
    other: '기타'
};

// 현재 이름 목록
let names = [];

// 초기화
async function init() {
    // 샘플 데이터 초기화
    await initSampleData();

    // 이벤트 리스너 설정
    setupEventListeners();

    // 데이터 로드
    await loadNames();

    // 실시간 업데이트 구독
    subscribeToUpdates();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 이름 추가 폼
    addNameForm.addEventListener('submit', handleAddName);

    // 여러 명 추가 토글
    bulkAddBtn.addEventListener('click', () => {
        bulkModal.classList.toggle('hidden');
    });

    // 여러 명 추가 제출
    bulkSubmitBtn.addEventListener('click', handleBulkAdd);

    // 검색
    searchList.addEventListener('input', filterNames);

    // 카테고리 필터
    filterCategory.addEventListener('change', filterNames);

    // 내보내기
    exportBtn.addEventListener('click', handleExport);

    // 전체 삭제
    clearAllBtn.addEventListener('click', handleClearAll);
}

// 이름 로드
async function loadNames() {
    names = await DataManager.getNames();
    updateUI();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    DataManager.subscribe((updatedNames) => {
        names = updatedNames;
        updateUI();
    });
}

// UI 업데이트
function updateUI() {
    updateStats();
    renderNameList();
}

// 통계 업데이트
function updateStats() {
    statTotal.textContent = names.length;
    statColleague.textContent = names.filter(n => n.category === 'colleague').length;
    statMentor.textContent = names.filter(n => n.category === 'mentor').length;

    const otherCount = names.filter(n =>
        !['colleague', 'mentor'].includes(n.category)
    ).length;
    statOther.textContent = otherCount;
}

// 이름 목록 렌더링
function renderNameList() {
    const searchQuery = searchList.value.toLowerCase();
    const categoryFilter = filterCategory.value;

    // 필터링
    let filteredNames = names.filter(n => {
        const matchesSearch = n.name.toLowerCase().includes(searchQuery);
        const matchesCategory = categoryFilter === 'all' || n.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // 정렬 (최신순)
    filteredNames.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 빈 상태 처리
    if (names.length === 0) {
        emptyState.classList.remove('hidden');
        nameList.classList.add('hidden');
    } else {
        emptyState.classList.add('hidden');
        nameList.classList.remove('hidden');
    }

    // 목록 렌더링
    nameList.innerHTML = filteredNames.map(n => `
        <div class="name-card fade-in" data-id="${n.id}">
            <div>
                <div class="name">${escapeHtml(n.name)}</div>
                <span class="category-badge category-${n.category}">${categoryLabels[n.category] || '기타'}</span>
            </div>
            <button class="delete-btn" onclick="deleteName('${n.id}')" title="삭제">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    `).join('');
}

// 이름 추가 처리
async function handleAddName(e) {
    e.preventDefault();

    const name = nameInput.value.trim();
    if (!name) return;

    const category = categorySelect.value;
    const message = messageInput.value.trim();

    await DataManager.addName({ name, category, message });

    // 폼 초기화
    nameInput.value = '';
    messageInput.value = '';
    nameInput.focus();

    showToast(`"${name}"님이 추가되었습니다!`);
}

// 여러 명 추가 처리
async function handleBulkAdd() {
    const text = bulkInput.value.trim();
    if (!text) return;

    const names = text.split('\n')
        .map(n => n.trim())
        .filter(n => n.length > 0);

    if (names.length === 0) return;

    await DataManager.addNames(names);

    bulkInput.value = '';
    bulkModal.classList.add('hidden');

    showToast(`${names.length}명이 추가되었습니다!`);
}

// 이름 삭제
async function deleteName(id) {
    const nameData = names.find(n => n.id === id);
    if (!nameData) return;

    if (confirm(`"${nameData.name}"님을 삭제하시겠습니까?`)) {
        await DataManager.deleteName(id);
        showToast(`"${nameData.name}"님이 삭제되었습니다.`, 'warning');
    }
}

// 필터링
function filterNames() {
    renderNameList();
}

// 내보내기
async function handleExport() {
    const data = await DataManager.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `thanks-2025-names-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('데이터가 내보내기 되었습니다!');
}

// 전체 삭제
async function handleClearAll() {
    if (names.length === 0) {
        showToast('삭제할 데이터가 없습니다.', 'warning');
        return;
    }

    const confirmed = confirm(`정말로 ${names.length}명의 모든 이름을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`);

    if (confirmed) {
        await DataManager.clearAll();
        showToast('모든 데이터가 삭제되었습니다.', 'warning');
    }
}

// 토스트 알림
function showToast(message, type = 'success') {
    toastMessage.textContent = message;

    // 타입에 따른 색상
    toast.className = 'fixed bottom-6 right-6 text-white px-6 py-3 rounded-xl shadow-lg transform transition-all duration-300 z-50';

    if (type === 'success') {
        toast.classList.add('bg-green-600');
    } else if (type === 'warning') {
        toast.classList.add('bg-orange-600');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600');
    }

    toast.classList.add('toast-show');

    setTimeout(() => {
        toast.classList.remove('toast-show');
    }, 3000);
}

// HTML 이스케이프
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 시작
document.addEventListener('DOMContentLoaded', init);
