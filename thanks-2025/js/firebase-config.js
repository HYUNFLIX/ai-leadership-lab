/* =============================================
   API-based Data Manager (Firebase 제거 버전)
   서버 API를 통해 데이터를 관리합니다
   ============================================= */

const DataManager = {
    // 모든 이름 가져오기
    async getNames() {
        try {
            const res = await fetch('/api/thanks/names');
            return await res.json();
        } catch (error) {
            console.error('이름 로드 실패:', error);
            return [];
        }
    },

    // 이름 추가
    async addName(nameData) {
        try {
            const res = await fetch('/api/thanks/names', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: nameData.name,
                    category: nameData.category || 'other',
                    message: nameData.message || ''
                })
            });
            return await res.json();
        } catch (error) {
            console.error('이름 추가 실패:', error);
            throw error;
        }
    },

    // 여러 이름 추가
    async addNames(namesArray) {
        try {
            const res = await fetch('/api/thanks/names/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ names: namesArray.map(n => typeof n === 'string' ? { name: n } : n) })
            });
            return await res.json();
        } catch (error) {
            console.error('이름 일괄 추가 실패:', error);
            throw error;
        }
    },

    // 이름 삭제
    async deleteName(id) {
        try {
            await fetch(`/api/thanks/names/${id}`, { method: 'DELETE' });
        } catch (error) {
            console.error('이름 삭제 실패:', error);
            throw error;
        }
    },

    // 전체 삭제
    async clearAll() {
        try {
            await fetch('/api/thanks/names', { method: 'DELETE' });
        } catch (error) {
            console.error('전체 삭제 실패:', error);
            throw error;
        }
    },

    // 실시간 업데이트 구독 (폴링 방식)
    subscribe(callback) {
        // 5초마다 폴링
        this._pollInterval = setInterval(async () => {
            const names = await this.getNames();
            callback(names);
        }, 5000);
    },

    // 구독 해제
    unsubscribe() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
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
        await fetch('/api/thanks/names/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: names })
        });
    },

    // 이름 등록 요청 저장
    async saveRequest(requestName) {
        try {
            const res = await fetch('/api/thanks/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: requestName })
            });
            return await res.json();
        } catch (error) {
            console.error('요청 저장 실패:', error);
            throw error;
        }
    },

    // 요청 목록 가져오기
    async getRequests() {
        try {
            const res = await fetch('/api/thanks/requests');
            return await res.json();
        } catch (error) {
            console.error('요청 로드 실패:', error);
            return [];
        }
    },

    // 요청 삭제
    async deleteRequest(id) {
        await fetch(`/api/thanks/requests/${id}`, { method: 'DELETE' });
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
