/* =============================================
   CRM - 고객사 관리 시스템
   ============================================= */

// 상태값 정의
const STATUS_CONFIG = {
    lead: { label: '잠재고객', color: 'indigo' },
    proposal: { label: '제안중', color: 'amber' },
    negotiation: { label: '협상중', color: 'blue' },
    contract: { label: '계약완료', color: 'emerald' },
    lost: { label: '실패', color: 'red' }
};

const INTEREST_LABELS = {
    'ai-leadership': 'AI 리더십',
    'digital-transformation': '디지털 전환',
    'innovation': '혁신',
    'leadership': '리더십',
    'communication': '소통',
    'team-building': '팀빌딩'
};

const HISTORY_TYPE_ICONS = {
    call: 'ri-phone-line',
    meeting: 'ri-team-line',
    email: 'ri-mail-line',
    other: 'ri-chat-3-line'
};

// 전역 상태
let clients = [];
let currentClientId = null;
let currentView = 'kanban';

// DOM 요소
const kanbanView = document.getElementById('kanban-view');
const listView = document.getElementById('list-view');
const kanbanViewBtn = document.getElementById('kanban-view-btn');
const listViewBtn = document.getElementById('list-view-btn');
const searchInput = document.getElementById('search-input');
const filterStatus = document.getElementById('filter-status');
const filterInterest = document.getElementById('filter-interest');
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const clientModal = document.getElementById('client-modal');
const detailModal = document.getElementById('detail-modal');
const clientForm = document.getElementById('client-form');

// 초기화
async function init() {
    setupEventListeners();
    await loadClients();
    subscribeToUpdates();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 뷰 전환
    kanbanViewBtn.addEventListener('click', () => switchView('kanban'));
    listViewBtn.addEventListener('click', () => switchView('list'));

    // 검색 & 필터
    searchInput.addEventListener('input', debounce(renderCurrentView, 300));
    filterStatus.addEventListener('change', renderCurrentView);
    filterInterest.addEventListener('change', renderCurrentView);

    // 내보내기 메뉴
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => exportMenu.classList.add('hidden'));

    // 폼 제출
    clientForm.addEventListener('submit', handleFormSubmit);

    // 모달 외부 클릭 닫기
    clientModal.addEventListener('click', (e) => {
        if (e.target === clientModal) closeModal();
    });
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal) closeDetailModal();
    });

    // 드래그 앤 드롭
    setupDragAndDrop();
}

// 디바운스
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 고객 데이터 로드
async function loadClients() {
    clients = await CRMDataManager.getClients();
    renderCurrentView();
    updateStats();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    CRMDataManager.subscribe((updatedClients) => {
        clients = updatedClients;
        renderCurrentView();
        updateStats();
    });
}

// 뷰 전환
function switchView(view) {
    currentView = view;

    if (view === 'kanban') {
        kanbanView.classList.remove('hidden');
        listView.classList.add('hidden');
        kanbanViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    } else {
        kanbanView.classList.add('hidden');
        listView.classList.remove('hidden');
        kanbanViewBtn.classList.remove('active');
        listViewBtn.classList.add('active');
    }

    renderCurrentView();
}

// 현재 뷰 렌더링
function renderCurrentView() {
    const filtered = getFilteredClients();

    if (currentView === 'kanban') {
        renderKanban(filtered);
    } else {
        renderList(filtered);
    }
}

// 필터링된 고객 목록 가져오기
function getFilteredClients() {
    const searchQuery = searchInput.value.toLowerCase().trim();
    const statusFilter = filterStatus.value;
    const interestFilter = filterInterest.value;

    return clients.filter(client => {
        // 검색어 필터
        const matchesSearch = !searchQuery ||
            client.companyName?.toLowerCase().includes(searchQuery) ||
            client.contactName?.toLowerCase().includes(searchQuery) ||
            client.email?.toLowerCase().includes(searchQuery);

        // 상태 필터
        const matchesStatus = statusFilter === 'all' || client.status === statusFilter;

        // 관심사 필터
        const matchesInterest = interestFilter === 'all' ||
            (Array.isArray(client.interests) && client.interests.includes(interestFilter));

        return matchesSearch && matchesStatus && matchesInterest;
    });
}

// 칸반 뷰 렌더링
function renderKanban(filteredClients) {
    const columns = document.querySelectorAll('.kanban-column');

    columns.forEach(column => {
        const status = column.dataset.status;
        const cardsContainer = column.querySelector('.kanban-cards');
        const countEl = column.querySelector('.kanban-count');

        const statusClients = filteredClients
            .filter(c => c.status === status)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        countEl.textContent = statusClients.length;

        cardsContainer.innerHTML = statusClients.map(client => `
            <div class="kanban-card glass rounded-xl p-4 cursor-pointer"
                 data-id="${client.id}"
                 draggable="true"
                 onclick="openDetailModal('${client.id}')">
                <div class="flex items-start justify-between mb-2">
                    <h4 class="font-semibold text-sm">${escapeHtml(client.companyName)}</h4>
                    ${client.contractAmount ? `
                        <span class="text-xs text-emerald-400 font-medium">
                            ${formatAmount(client.contractAmount)}
                        </span>
                    ` : ''}
                </div>
                ${client.contactName ? `
                    <div class="text-xs text-gray-400 mb-2">
                        <i class="ri-user-line mr-1"></i>
                        ${escapeHtml(client.contactName)}${client.contactTitle ? ` (${escapeHtml(client.contactTitle)})` : ''}
                    </div>
                ` : ''}
                ${client.interests && client.interests.length > 0 ? `
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${client.interests.slice(0, 2).map(i => `
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10">${INTEREST_LABELS[i] || i}</span>
                        `).join('')}
                        ${client.interests.length > 2 ? `
                            <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/10">+${client.interests.length - 2}</span>
                        ` : ''}
                    </div>
                ` : ''}
                <div class="flex items-center justify-between text-[10px] text-gray-500">
                    <span><i class="ri-time-line mr-1"></i>${formatDate(client.lastContactDate)}</span>
                    ${client.phone ? `<span><i class="ri-phone-line"></i></span>` : ''}
                </div>
            </div>
        `).join('');
    });
}

// 리스트 뷰 렌더링
function renderList(filteredClients) {
    const tableBody = document.getElementById('client-table-body');
    const emptyList = document.getElementById('empty-list');

    if (filteredClients.length === 0) {
        tableBody.innerHTML = '';
        emptyList.classList.remove('hidden');
        return;
    }

    emptyList.classList.add('hidden');

    // 정렬 (최신 업데이트순)
    filteredClients.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    tableBody.innerHTML = filteredClients.map(client => `
        <tr class="hover:bg-white/5 cursor-pointer transition-colors" onclick="openDetailModal('${client.id}')">
            <td class="px-4 py-3">
                <div class="font-medium">${escapeHtml(client.companyName)}</div>
                ${client.interests && client.interests.length > 0 ? `
                    <div class="text-xs text-gray-500 mt-1">
                        ${client.interests.map(i => INTEREST_LABELS[i] || i).join(', ')}
                    </div>
                ` : ''}
            </td>
            <td class="px-4 py-3">
                <div>${escapeHtml(client.contactName || '-')}</div>
                ${client.contactTitle ? `<div class="text-xs text-gray-500">${escapeHtml(client.contactTitle)}</div>` : ''}
            </td>
            <td class="px-4 py-3 text-sm">
                ${client.phone ? `<div><i class="ri-phone-line mr-1 text-gray-500"></i>${escapeHtml(client.phone)}</div>` : ''}
                ${client.email ? `<div class="text-gray-400"><i class="ri-mail-line mr-1"></i>${escapeHtml(client.email)}</div>` : ''}
                ${!client.phone && !client.email ? '-' : ''}
            </td>
            <td class="px-4 py-3">
                <span class="px-3 py-1 rounded-full text-xs status-badge-${client.status}">
                    ${STATUS_CONFIG[client.status]?.label || client.status}
                </span>
            </td>
            <td class="px-4 py-3 text-emerald-400 font-medium">
                ${client.contractAmount ? formatAmount(client.contractAmount) : '-'}
            </td>
            <td class="px-4 py-3 text-sm text-gray-400">
                ${formatDate(client.lastContactDate)}
            </td>
            <td class="px-4 py-3 text-center">
                <button onclick="event.stopPropagation(); openEditModal('${client.id}')"
                        class="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                    <i class="ri-edit-line"></i>
                </button>
                <button onclick="event.stopPropagation(); confirmDelete('${client.id}')"
                        class="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// 통계 업데이트
function updateStats() {
    document.getElementById('stat-lead').textContent = clients.filter(c => c.status === 'lead').length;
    document.getElementById('stat-proposal').textContent = clients.filter(c => c.status === 'proposal').length;
    document.getElementById('stat-negotiation').textContent = clients.filter(c => c.status === 'negotiation').length;
    document.getElementById('stat-contract').textContent = clients.filter(c => c.status === 'contract').length;

    const totalAmount = clients
        .filter(c => c.status === 'contract')
        .reduce((sum, c) => sum + (parseInt(c.contractAmount) || 0), 0);
    document.getElementById('stat-total-amount').textContent = formatAmount(totalAmount);
}

// 드래그 앤 드롭 설정
function setupDragAndDrop() {
    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.add('dragging');
            e.dataTransfer.setData('text/plain', e.target.dataset.id);
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('kanban-card')) {
            e.target.classList.remove('dragging');
        }
        document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
    });

    document.querySelectorAll('.kanban-column').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.classList.add('drag-over');
        });

        column.addEventListener('dragleave', (e) => {
            if (!column.contains(e.relatedTarget)) {
                column.classList.remove('drag-over');
            }
        });

        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');

            const clientId = e.dataTransfer.getData('text/plain');
            const newStatus = column.dataset.status;

            const client = clients.find(c => c.id === clientId);
            if (client && client.status !== newStatus) {
                await CRMDataManager.updateClient(clientId, { status: newStatus });
                showToast(`${client.companyName}이(가) "${STATUS_CONFIG[newStatus].label}"로 이동되었습니다.`);
                await loadClients();
            }
        });
    });
}

// 모달 열기 (추가)
function openAddModal() {
    document.getElementById('modal-title').textContent = '고객사 추가';
    document.getElementById('client-id').value = '';
    clientForm.reset();
    document.getElementById('last-contact').value = new Date().toISOString().split('T')[0];
    clientModal.classList.add('active');
}

// 모달 열기 (수정)
function openEditModal(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('modal-title').textContent = '고객사 수정';
    document.getElementById('client-id').value = client.id;
    document.getElementById('company-name').value = client.companyName || '';
    document.getElementById('client-status').value = client.status || 'lead';
    document.getElementById('contact-name').value = client.contactName || '';
    document.getElementById('contact-title').value = client.contactTitle || '';
    document.getElementById('contact-phone').value = client.phone || '';
    document.getElementById('contact-email').value = client.email || '';
    document.getElementById('contract-amount').value = client.contractAmount || '';
    document.getElementById('last-contact').value = client.lastContactDate || '';
    document.getElementById('client-notes').value = client.notes || '';

    // 관심사 체크박스
    document.querySelectorAll('input[name="interests"]').forEach(cb => {
        cb.checked = Array.isArray(client.interests) && client.interests.includes(cb.value);
    });

    clientModal.classList.add('active');
}

// 모달 닫기
function closeModal() {
    clientModal.classList.remove('active');
}

// 폼 제출 처리
async function handleFormSubmit(e) {
    e.preventDefault();

    const clientId = document.getElementById('client-id').value;
    const interests = Array.from(document.querySelectorAll('input[name="interests"]:checked')).map(cb => cb.value);

    const clientData = {
        companyName: document.getElementById('company-name').value.trim(),
        status: document.getElementById('client-status').value,
        contactName: document.getElementById('contact-name').value.trim(),
        contactTitle: document.getElementById('contact-title').value.trim(),
        phone: document.getElementById('contact-phone').value.trim(),
        email: document.getElementById('contact-email').value.trim(),
        contractAmount: parseInt(document.getElementById('contract-amount').value) || 0,
        lastContactDate: document.getElementById('last-contact').value,
        notes: document.getElementById('client-notes').value.trim(),
        interests: interests
    };

    if (clientId) {
        // 수정
        await CRMDataManager.updateClient(clientId, clientData);
        showToast(`${clientData.companyName} 정보가 수정되었습니다.`);
    } else {
        // 추가
        await CRMDataManager.addClient(clientData);
        showToast(`${clientData.companyName}이(가) 추가되었습니다.`);
    }

    closeModal();
    await loadClients();
}

// 상세 모달 열기
async function openDetailModal(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    currentClientId = id;

    document.getElementById('detail-company-name').textContent = client.companyName;
    document.getElementById('detail-status').textContent = STATUS_CONFIG[client.status]?.label || client.status;
    document.getElementById('detail-status').className = `px-3 py-1 rounded-full text-sm status-badge-${client.status}`;
    document.getElementById('detail-contact').textContent = client.contactName ?
        `${client.contactName}${client.contactTitle ? ` (${client.contactTitle})` : ''}` : '-';

    const phoneEl = document.getElementById('detail-phone');
    phoneEl.textContent = client.phone || '-';
    phoneEl.href = client.phone ? `tel:${client.phone}` : '#';

    const emailEl = document.getElementById('detail-email');
    emailEl.textContent = client.email || '-';
    emailEl.href = client.email ? `mailto:${client.email}` : '#';

    document.getElementById('detail-amount').textContent = client.contractAmount ? formatAmount(client.contractAmount) : '-';
    document.getElementById('detail-last-contact').textContent = formatDate(client.lastContactDate);

    // 관심사
    const interestsEl = document.getElementById('detail-interests');
    if (client.interests && client.interests.length > 0) {
        interestsEl.innerHTML = client.interests.map(i =>
            `<span class="px-3 py-1 rounded-full text-sm glass">${INTEREST_LABELS[i] || i}</span>`
        ).join('');
    } else {
        interestsEl.innerHTML = '<span class="text-gray-500">-</span>';
    }

    // 메모
    document.getElementById('detail-notes').textContent = client.notes || '메모가 없습니다.';

    // 상담 이력 로드
    await loadHistory(id);

    detailModal.classList.add('active');
}

// 상세 모달 닫기
function closeDetailModal() {
    detailModal.classList.remove('active');
    currentClientId = null;
}

// 현재 고객 수정
function editCurrentClient() {
    if (currentClientId) {
        closeDetailModal();
        openEditModal(currentClientId);
    }
}

// 현재 고객 삭제
function deleteCurrentClient() {
    if (currentClientId) {
        confirmDelete(currentClientId);
    }
}

// 삭제 확인
async function confirmDelete(id) {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    if (confirm(`"${client.companyName}"을(를) 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        await CRMDataManager.deleteClient(id);
        showToast(`${client.companyName}이(가) 삭제되었습니다.`, 'warning');
        closeDetailModal();
        await loadClients();
    }
}

// 상담 이력 로드
async function loadHistory(clientId) {
    const history = await CRMDataManager.getHistoryByClient(clientId);
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');

    if (history.length === 0) {
        historyList.innerHTML = '';
        historyEmpty.classList.remove('hidden');
        return;
    }

    historyEmpty.classList.add('hidden');
    historyList.innerHTML = history.map(h => `
        <div class="glass rounded-xl p-4">
            <div class="flex items-center gap-2 mb-2">
                <i class="${HISTORY_TYPE_ICONS[h.type] || 'ri-chat-3-line'} text-indigo-400"></i>
                <span class="text-sm font-medium">${getHistoryTypeLabel(h.type)}</span>
                <span class="text-xs text-gray-500 ml-auto">${formatDate(h.date)}</span>
            </div>
            <p class="text-sm text-gray-300">${escapeHtml(h.content)}</p>
        </div>
    `).join('');
}

function getHistoryTypeLabel(type) {
    const labels = { call: '전화', meeting: '미팅', email: '이메일', other: '기타' };
    return labels[type] || type;
}

// 상담 이력 폼 열기/닫기
function openHistoryForm() {
    document.getElementById('history-form').classList.remove('hidden');
    document.getElementById('history-date').value = new Date().toISOString().split('T')[0];
}

function closeHistoryForm() {
    document.getElementById('history-form').classList.add('hidden');
    document.getElementById('history-content').value = '';
}

// 상담 이력 저장
async function saveHistory() {
    const type = document.getElementById('history-type').value;
    const date = document.getElementById('history-date').value;
    const content = document.getElementById('history-content').value.trim();

    if (!content) {
        showToast('상담 내용을 입력해주세요.', 'error');
        return;
    }

    await CRMDataManager.addHistory(currentClientId, { type, date, content });
    showToast('상담 이력이 추가되었습니다.');
    closeHistoryForm();
    await loadHistory(currentClientId);
    await loadClients(); // 마지막 연락일 업데이트 반영
}

// CSV 내보내기
async function exportCSV() {
    const csv = await CRMDataManager.exportToCSV();
    downloadFile(csv, `crm-clients-${getDateString()}.csv`, 'text/csv;charset=utf-8');
    showToast('CSV 파일이 다운로드되었습니다.');
}

// JSON 내보내기
async function exportJSON() {
    const json = await CRMDataManager.exportToJSON();
    downloadFile(json, `crm-clients-${getDateString()}.json`, 'application/json');
    showToast('JSON 파일이 다운로드되었습니다.');
}

// 파일 다운로드
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 유틸리티 함수들
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatAmount(amount) {
    if (!amount) return '-';
    return amount.toLocaleString() + '만원';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getDateString() {
    return new Date().toISOString().split('T')[0];
}

// 토스트 알림
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');

    toastMessage.textContent = message;
    toast.className = 'toast fixed bottom-6 right-6 px-6 py-3 rounded-xl shadow-lg z-50';

    if (type === 'success') {
        toast.classList.add('bg-emerald-600');
    } else if (type === 'warning') {
        toast.classList.add('bg-amber-600');
    } else if (type === 'error') {
        toast.classList.add('bg-red-600');
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 시작
document.addEventListener('DOMContentLoaded', init);
