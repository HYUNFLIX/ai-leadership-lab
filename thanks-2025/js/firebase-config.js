/* =============================================
   Firebase Configuration
   실시간 데이터베이스를 사용하려면 아래 설정을 입력하세요
   ============================================= */

// Firebase 설정
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
let namesRef = null;
let requestsRef = null;

if (USE_FIREBASE && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        namesRef = database.ref('thanks2025/names');
        requestsRef = database.ref('thanks2025/requests');
        console.log('Firebase 연결 성공!');
    } catch (error) {
        console.error('Firebase 초기화 실패:', error);
    }
}

/* =============================================
   Data Manager - Firebase 또는 LocalStorage 사용
   ============================================= */

const DataManager = {
    // LocalStorage 키
    STORAGE_KEY: 'thanks2025_names',

    // 모든 이름 가져오기
    async getNames() {
        if (USE_FIREBASE && namesRef) {
            return new Promise((resolve) => {
                namesRef.once('value', (snapshot) => {
                    const data = snapshot.val();
                    resolve(data ? Object.values(data) : []);
                });
            });
        } else {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        }
    },

    // 이름 추가
    async addName(nameData) {
        const newEntry = {
            id: Date.now().toString(),
            name: nameData.name,
            category: nameData.category || 'other',
            message: nameData.message || '',
            createdAt: new Date().toISOString()
        };

        if (USE_FIREBASE && namesRef) {
            await namesRef.push(newEntry);
        } else {
            const names = await this.getNames();
            names.push(newEntry);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(names));
        }

        return newEntry;
    },

    // 여러 이름 추가
    async addNames(namesArray) {
        const results = [];
        for (const name of namesArray) {
            const entry = await this.addName({ name, category: 'other' });
            results.push(entry);
        }
        return results;
    },

    // 이름 삭제
    async deleteName(id) {
        if (USE_FIREBASE && namesRef) {
            const snapshot = await namesRef.orderByChild('id').equalTo(id).once('value');
            const key = Object.keys(snapshot.val() || {})[0];
            if (key) {
                await namesRef.child(key).remove();
            }
        } else {
            const names = await this.getNames();
            const filtered = names.filter(n => n.id !== id);
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
        }
    },

    // 전체 삭제
    async clearAll() {
        if (USE_FIREBASE && namesRef) {
            await namesRef.remove();
        } else {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    },

    // 실시간 업데이트 구독 (Firebase만 해당)
    subscribe(callback) {
        if (USE_FIREBASE && namesRef) {
            namesRef.on('value', (snapshot) => {
                const data = snapshot.val();
                callback(data ? Object.values(data) : []);
            });
        } else {
            // LocalStorage는 storage 이벤트로 다른 탭 변경 감지
            window.addEventListener('storage', async (e) => {
                if (e.key === this.STORAGE_KEY) {
                    const names = await this.getNames();
                    callback(names);
                }
            });
        }
    },

    // 구독 해제
    unsubscribe() {
        if (USE_FIREBASE && namesRef) {
            namesRef.off();
        }
    },

    // 내보내기 (JSON)
    async exportData() {
        const names = await this.getNames();
        return JSON.stringify(names, null, 2);
    },

    // 가져오기 (JSON)
    async importData(jsonString) {
        const names = JSON.parse(jsonString);
        if (USE_FIREBASE && namesRef) {
            await namesRef.remove();
            for (const name of names) {
                await namesRef.push(name);
            }
        } else {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(names));
        }
    },

    // 이름 등록 요청 저장
    async saveRequest(requestName) {
        const request = {
            name: requestName,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        if (USE_FIREBASE && requestsRef) {
            await requestsRef.push(request);
        } else {
            const requests = JSON.parse(localStorage.getItem('thanks2025_requests') || '[]');
            requests.push(request);
            localStorage.setItem('thanks2025_requests', JSON.stringify(requests));
        }

        return request;
    },

    // 요청 목록 가져오기
    async getRequests() {
        if (USE_FIREBASE && requestsRef) {
            return new Promise((resolve) => {
                requestsRef.once('value', (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        resolve(Object.entries(data).map(([key, val]) => ({ ...val, key })));
                    } else {
                        resolve([]);
                    }
                });
            });
        } else {
            return JSON.parse(localStorage.getItem('thanks2025_requests') || '[]');
        }
    },

    // 요청 삭제
    async deleteRequest(key) {
        if (USE_FIREBASE && requestsRef) {
            await requestsRef.child(key).remove();
        }
    }
};

// 샘플 데이터 (처음 사용 시)
const SAMPLE_NAMES = [
    { name: '김철수', category: 'colleague', message: '항상 든든한 동료' },
    { name: '이영희', category: 'mentor', message: '많은 가르침을 주셨습니다' },
    { name: '박지민', category: 'friend', message: '좋은 친구' },
    { name: '최민수', category: 'partner', message: '훌륭한 비즈니스 파트너' },
    { name: '정수진', category: 'client', message: '감사한 고객님' },
    { name: '강현우', category: 'colleague', message: '함께 일해서 좋았습니다' },
    { name: '윤서연', category: 'mentor', message: '멘토링 감사합니다' },
    { name: '임재현', category: 'friend', message: '오랜 친구' },
    { name: '한소영', category: 'family', message: '사랑하는 가족' },
    { name: '송민호', category: 'partner', message: '훌륭한 협업' }
];

// 샘플 데이터 초기화 함수
async function initSampleData() {
    const names = await DataManager.getNames();
    if (names.length === 0) {
        for (const sample of SAMPLE_NAMES) {
            await DataManager.addName(sample);
        }
        console.log('샘플 데이터가 추가되었습니다.');
    }
}
