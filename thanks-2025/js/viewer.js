/* =============================================
   3D Word Cloud Viewer - Three.js
   2025 감사합니다 워드클라우드
   ============================================= */

// 글로벌 변수
let scene, camera, renderer;
let textLabels = [];
let names = [];
let autoRotate = true;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let sphereRadius = 300;
let targetRotation = { x: 0, y: 0 };
let currentRotation = { x: 0, y: 0 };

// 카테고리별 색상
const categoryColors = {
    colleague: '#818cf8',  // Indigo
    mentor: '#c084fc',     // Purple
    client: '#22d3ee',     // Cyan
    partner: '#4ade80',    // Green
    friend: '#fbbf24',     // Yellow
    family: '#fb7185',     // Pink
    other: '#9ca3af'       // Gray
};

// DOM 요소
const container = document.getElementById('canvas-container');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResult = document.getElementById('search-result');
const autoRotateBtn = document.getElementById('auto-rotate-btn');
const resetBtn = document.getElementById('reset-btn');
const countNumber = document.getElementById('count-number');
const namePopup = document.getElementById('name-popup');
const popupName = document.getElementById('popup-name');
const closePopup = document.getElementById('close-popup');

// 초기화
async function init() {
    // 샘플 데이터 초기화
    await initSampleData();

    // 씬 설정
    setupScene();

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
    }, 1500);

    // 애니메이션 시작
    animate();
}

// Three.js 씬 설정
function setupScene() {
    // 씬 생성
    scene = new THREE.Scene();

    // 카메라 설정
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.z = 600;

    // 렌더러 설정
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    // 파티클 배경 추가
    createParticleBackground();

    // 중앙 글로우 구체
    createGlowSphere();
}

// 파티클 배경
function createParticleBackground() {
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 2000;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 1.5,
        color: 0x6366f1,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);
}

// 중앙 글로우 구체
function createGlowSphere() {
    const geometry = new THREE.SphereGeometry(50, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.1
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // 외곽 글로우
    const glowGeometry = new THREE.SphereGeometry(60, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.05,
        side: THREE.BackSide
    });
    const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glowSphere);
}

// 이름 로드
async function loadNames() {
    names = await DataManager.getNames();
    updateNameCount();
    createTextLabels();
}

// 실시간 업데이트 구독
function subscribeToUpdates() {
    DataManager.subscribe(async (updatedNames) => {
        names = updatedNames;
        updateNameCount();
        createTextLabels();
    });
}

// 이름 카운트 업데이트
function updateNameCount() {
    countNumber.textContent = names.length;
}

// 텍스트 라벨 생성
function createTextLabels() {
    // 기존 라벨 제거
    textLabels.forEach(label => {
        if (label.element && label.element.parentNode) {
            label.element.parentNode.removeChild(label.element);
        }
    });
    textLabels = [];

    if (names.length === 0) return;

    // 구 위에 점들을 균등하게 배치 (피보나치 격자)
    const points = fibonacciSphere(names.length, sphereRadius);

    names.forEach((nameData, index) => {
        const point = points[index];

        // HTML 라벨 생성
        const label = document.createElement('div');
        label.className = 'text-label';
        label.textContent = nameData.name;

        // 카테고리별 색상
        const color = categoryColors[nameData.category] || categoryColors.other;
        label.style.color = color;

        // 크기 랜덤화 (더 다양하게)
        const size = 14 + Math.random() * 16;
        label.style.fontSize = `${size}px`;

        // 클릭 이벤트
        label.addEventListener('click', () => showNamePopup(nameData));

        container.appendChild(label);

        textLabels.push({
            element: label,
            position: new THREE.Vector3(point.x, point.y, point.z),
            originalPosition: new THREE.Vector3(point.x, point.y, point.z),
            nameData: nameData
        });
    });
}

// 피보나치 구 (균등 분포)
function fibonacciSphere(samples, radius) {
    const points = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // 황금각

    for (let i = 0; i < samples; i++) {
        const y = 1 - (i / (samples - 1)) * 2; // -1 to 1
        const radiusAtY = Math.sqrt(1 - y * y);

        const theta = phi * i;

        const x = Math.cos(theta) * radiusAtY;
        const z = Math.sin(theta) * radiusAtY;

        points.push({
            x: x * radius,
            y: y * radius,
            z: z * radius
        });
    }

    return points;
}

// 이름 팝업 표시
function showNamePopup(nameData) {
    popupName.textContent = nameData.name;
    namePopup.classList.remove('hidden');
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 윈도우 리사이즈
    window.addEventListener('resize', onWindowResize);

    // 마우스 이벤트
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('mouseleave', onMouseUp);

    // 터치 이벤트
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    // 스크롤 (줌)
    container.addEventListener('wheel', onWheel, { passive: false });

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

    // 자동 회전 토글
    autoRotateBtn.addEventListener('click', toggleAutoRotate);

    // 초기화 버튼
    resetBtn.addEventListener('click', resetView);

    // 팝업 닫기
    closePopup.addEventListener('click', () => {
        namePopup.classList.add('hidden');
    });
    namePopup.addEventListener('click', (e) => {
        if (e.target === namePopup) {
            namePopup.classList.add('hidden');
        }
    });
}

// 윈도우 리사이즈
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 마우스 다운
function onMouseDown(event) {
    isDragging = true;
    autoRotate = false;
    autoRotateBtn.textContent = '▶️ 자동 회전';
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

// 마우스 이동
function onMouseMove(event) {
    if (!isDragging) return;

    const deltaX = event.clientX - previousMousePosition.x;
    const deltaY = event.clientY - previousMousePosition.y;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
}

// 마우스 업
function onMouseUp() {
    isDragging = false;
}

// 터치 시작
function onTouchStart(event) {
    if (event.touches.length === 1) {
        isDragging = true;
        autoRotate = false;
        autoRotateBtn.textContent = '▶️ 자동 회전';
        previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    }
}

// 터치 이동
function onTouchMove(event) {
    if (!isDragging || event.touches.length !== 1) return;
    event.preventDefault();

    const deltaX = event.touches[0].clientX - previousMousePosition.x;
    const deltaY = event.touches[0].clientY - previousMousePosition.y;

    targetRotation.y += deltaX * 0.005;
    targetRotation.x += deltaY * 0.005;

    previousMousePosition = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY
    };
}

// 터치 종료
function onTouchEnd() {
    isDragging = false;
}

// 휠 (줌)
function onWheel(event) {
    event.preventDefault();
    camera.position.z += event.deltaY * 0.5;
    camera.position.z = Math.max(200, Math.min(1000, camera.position.z));
}

// 이름 검색
function searchName() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) return;

    clearHighlight();

    let found = false;
    textLabels.forEach(label => {
        if (label.nameData.name.toLowerCase().includes(query)) {
            label.element.classList.add('highlighted');
            found = true;

            // 해당 위치로 카메라 이동
            const pos = label.position;
            targetRotation.y = Math.atan2(pos.x, pos.z);
            targetRotation.x = -Math.asin(pos.y / sphereRadius);
        }
    });

    searchResult.classList.remove('hidden');
    if (found) {
        const count = textLabels.filter(l => l.nameData.name.toLowerCase().includes(query)).length;
        searchResult.textContent = `${count}명의 이름을 찾았습니다!`;
        searchResult.style.color = '#4ade80';
    } else {
        searchResult.textContent = '해당 이름을 찾을 수 없습니다.';
        searchResult.style.color = '#f87171';
    }

    setTimeout(() => {
        searchResult.classList.add('hidden');
    }, 3000);
}

// 하이라이트 제거
function clearHighlight() {
    textLabels.forEach(label => {
        label.element.classList.remove('highlighted');
    });
    searchResult.classList.add('hidden');
}

// 자동 회전 토글
function toggleAutoRotate() {
    autoRotate = !autoRotate;
    autoRotateBtn.textContent = autoRotate ? '🔄 자동 회전' : '▶️ 자동 회전';
}

// 뷰 초기화
function resetView() {
    targetRotation = { x: 0, y: 0 };
    camera.position.z = 600;
    clearHighlight();
    searchInput.value = '';
}

// 애니메이션 루프
function animate() {
    requestAnimationFrame(animate);

    // 자동 회전
    if (autoRotate) {
        targetRotation.y += 0.002;
    }

    // 부드러운 회전 보간
    currentRotation.x += (targetRotation.x - currentRotation.x) * 0.05;
    currentRotation.y += (targetRotation.y - currentRotation.y) * 0.05;

    // 텍스트 라벨 업데이트
    updateTextLabels();

    // 렌더링
    renderer.render(scene, camera);
}

// 텍스트 라벨 위치 업데이트
function updateTextLabels() {
    textLabels.forEach(label => {
        // 회전 적용
        const pos = label.originalPosition.clone();

        // X축 회전
        const cosX = Math.cos(currentRotation.x);
        const sinX = Math.sin(currentRotation.x);
        const y1 = pos.y * cosX - pos.z * sinX;
        const z1 = pos.y * sinX + pos.z * cosX;
        pos.y = y1;
        pos.z = z1;

        // Y축 회전
        const cosY = Math.cos(currentRotation.y);
        const sinY = Math.sin(currentRotation.y);
        const x2 = pos.x * cosY + pos.z * sinY;
        const z2 = -pos.x * sinY + pos.z * cosY;
        pos.x = x2;
        pos.z = z2;

        label.position.copy(pos);

        // 3D to 2D 변환
        const vector = pos.clone();
        vector.project(camera);

        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;

        // 뒤에 있는 라벨은 숨기기
        const isBehind = pos.z > 0;
        const opacity = isBehind ? 0.2 : 1;
        const scale = isBehind ? 0.7 : 1;
        const zIndex = isBehind ? 1 : 10;

        // 거리에 따른 크기 조절
        const distance = camera.position.z - pos.z;
        const distanceScale = Math.max(0.5, Math.min(1.5, 600 / distance));

        label.element.style.transform = `translate(-50%, -50%) scale(${scale * distanceScale})`;
        label.element.style.left = `${x}px`;
        label.element.style.top = `${y}px`;
        label.element.style.opacity = opacity;
        label.element.style.zIndex = zIndex;
    });
}

// 시작
document.addEventListener('DOMContentLoaded', init);
