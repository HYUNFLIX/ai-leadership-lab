/* =============================================
   CRM Firebase Configuration
   고객사 관리 시스템 - Firebase 연동
   ============================================= */

// Firebase 설정 (ai-leadership-lectures 프로젝트)
const firebaseConfig = {
    apiKey: "AIzaSyAAPuPVGtv5MkNNOlUvY9aevKQhh6VdtA8",
    authDomain: "thanks-2025-f9429.firebaseapp.com",
    databaseURL: "https://thanks-2025-f9429-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "thanks-2025-f9429",
    storageBucket: "thanks-2025-f9429.firebasestorage.app",
    messagingSenderId: "710804200562",
    appId: "1:710804200562:web:5b7a4a65273c93022c76eb"
};

// Firebase 사용 여부
const USE_FIREBASE = true;

// Firebase 초기화
let database = null;
let clientsRef = null;
let historyRef = null;

if (USE_FIREBASE && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        clientsRef = database.ref('crm/clients');
        historyRef = database.ref('crm/history');
        console.log('CRM Firebase 연결 성공!');
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
    }
}

/* =============================================
   CRM Data Manager
   ============================================= */

const CRMDataManager = {
    STORAGE_KEY: 'crm_clients',
    HISTORY_KEY: 'crm_history',

    // 모든 고객사 가져오기
    async getClients() {
        if (USE_FIREBASE && clientsRef) {
            return new Promise((resolve) => {
                clientsRef.once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const clients = Object.entries(data).map(([key, val]) => ({
                            ...val,
                            firebaseKey: key
                        }));
                        resolve(clients);
                    } else {
                        resolve([]);
                    }
                });
            });
        } else {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        }
    },

    // 고객사 추가
    async addClient(clientData) {
        const newClient = {
            id: Date.now().toString(),
            companyName: clientData.companyName,
            contactName: clientData.contactName || '',
            contactTitle: clientData.contactTitle || '',
            phone: clientData.phone || '',
            email: clientData.email || '',
            status: clientData.status || 'lead',
            interests: clientData.interests || [],
            contractAmount: clientData.contractAmount || 0,
            lastContactDate: clientData.lastContactDate || new Date().toISOString().split('T')[0],
            notes: clientData.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (USE_FIREBASE && clientsRef) {
            const ref = await clientsRef.push(newClient);
            newClient.firebaseKey = ref.key;
        } else {
            const clients = await this.getClients();
            clients.push(newClient);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
        }

        return newClient;
    },

    // 고객사 수정
    async updateClient(id, updates) {
        updates.updatedAt = new Date().toISOString();

        if (USE_FIREBASE && clientsRef) {
            const snapshot = await clientsRef.orderByChild('id').equalTo(id).once('value');
            const data = snapshot.val();
            if (data) {
                const key = Object.keys(data)[0];
                await clientsRef.child(key).update(updates);
            }
        } else {
            const clients = await this.getClients();
            const index = clients.findIndex(c => c.id === id);
            if (index !== -1) {
                clients[index] = { ...clients[index], ...updates };
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clients));
            }
        }
    },

    // 고객사 삭제
    async deleteClient(id) {
        if (USE_FIREBASE && clientsRef) {
            const snapshot = await clientsRef.orderByChild('id').equalTo(id).once('value');
            const data = snapshot.val();
            if (data) {
                const key = Object.keys(data)[0];
                await clientsRef.child(key).remove();
            }
        } else {
            const clients = await this.getClients();
            const filtered = clients.filter(c => c.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
        }
    },

    // 상담 이력 추가
    async addHistory(clientId, historyData) {
        const newHistory = {
            id: Date.now().toString(),
            clientId: clientId,
            type: historyData.type || 'call', // call, meeting, email, other
            date: historyData.date || new Date().toISOString().split('T')[0],
            content: historyData.content || '',
            createdAt: new Date().toISOString()
        };

        if (USE_FIREBASE && historyRef) {
            await historyRef.push(newHistory);
        } else {
            const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            history.push(newHistory);
            localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
        }

        // 마지막 연락일 업데이트
        await this.updateClient(clientId, { lastContactDate: newHistory.date });

        return newHistory;
    },

    // 고객사별 상담 이력 가져오기
    async getHistoryByClient(clientId) {
        if (USE_FIREBASE && historyRef) {
            return new Promise((resolve) => {
                historyRef.orderByChild('clientId').equalTo(clientId).once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const history = Object.values(data);
                        history.sort((a, b) => new Date(b.date) - new Date(a.date));
                        resolve(history);
                    } else {
                        resolve([]);
                    }
                });
            });
        } else {
            const history = JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
            return history.filter(h => h.clientId === clientId).sort((a, b) => new Date(b.date) - new Date(a.date));
        }
    },

    // 실시간 업데이트 구독
    subscribe(callback) {
        if (USE_FIREBASE && clientsRef) {
            clientsRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const clients = Object.entries(data).map(([key, val]) => ({
                        ...val,
                        firebaseKey: key
                    }));
                    callback(clients);
                } else {
                    callback([]);
                }
            });
        }
    },

    // 구독 해제
    unsubscribe() {
        if (USE_FIREBASE && clientsRef) {
            clientsRef.off();
        }
    },

    // CSV 내보내기
    async exportToCSV() {
        const clients = await this.getClients();
        const statusLabels = {
            lead: '잠재고객',
            proposal: '제안중',
            negotiation: '협상중',
            contract: '계약완료',
            lost: '실패'
        };

        const headers = ['회사명', '담당자', '직책', '전화번호', '이메일', '상태', '관심 주제', '계약금액', '마지막연락일', '메모', '등록일'];
        const rows = clients.map(c => [
            c.companyName,
            c.contactName,
            c.contactTitle,
            c.phone,
            c.email,
            statusLabels[c.status] || c.status,
            Array.isArray(c.interests) ? c.interests.join(', ') : c.interests,
            c.contractAmount,
            c.lastContactDate,
            c.notes?.replace(/\n/g, ' '),
            c.createdAt?.split('T')[0]
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell || ''}"`).join(','))
            .join('\n');

        return '\uFEFF' + csvContent; // BOM for Excel
    },

    // JSON 내보내기
    async exportToJSON() {
        const clients = await this.getClients();
        return JSON.stringify(clients, null, 2);
    }
};
