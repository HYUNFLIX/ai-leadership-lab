// ============================================================
// Firebase Configuration
// 아래 firebaseConfig 객체에 본인의 Firebase 프로젝트 설정을 채워 넣으세요.
// Firebase Console > 프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyBsYhirjhAxINaZhYMdPavYxYht4qROqRs",
    authDomain: "book-concert-967de.firebaseapp.com",
    projectId: "book-concert-967de",
    storageBucket: "book-concert-967de.firebasestorage.app",
    messagingSenderId: "814514997129",
    appId: "1:814514997129:web:87942dd13339b46a780358"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const participantsRef = db.collection("participants");

// ============================================================
// Global State
// ============================================================
let currentDocId = null;       // 조회된 문서 ID (수정/삭제용)
let adminUnsubscribe = null;   // onSnapshot 리스너 해제 함수

// ============================================================
// DOM Elements
// ============================================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Tabs
const tabRegister = $("#tabRegister");
const tabCheck = $("#tabCheck");
const panelRegister = $("#panelRegister");
const panelCheck = $("#panelCheck");

// Registration form
const formRegister = $("#formRegister");
const regName = $("#regName");
const regPhone = $("#regPhone");
const regEmail = $("#regEmail");
const regCount = $("#regCount");
const btnRegister = $("#btnRegister");

// Check form
const formCheck = $("#formCheck");
const chkName = $("#chkName");
const chkPhone = $("#chkPhone");
const btnCheck = $("#btnCheck");
const checkResult = $("#checkResult");
const checkNoResult = $("#checkNoResult");

// Result display
const resName = $("#resName");
const resPhone = $("#resPhone");
const resEmail = $("#resEmail");
const resCount = $("#resCount");
const resTimestamp = $("#resTimestamp");
const btnEdit = $("#btnEdit");
const btnDelete = $("#btnDelete");

// Admin login modal
const modalAdminLogin = $("#modalAdminLogin");
const formAdminLogin = $("#formAdminLogin");
const adminEmail = $("#adminEmail");
const adminPassword = $("#adminPassword");
const btnAdminLogin = $("#btnAdminLogin");
const btnOpenAdminLogin = $("#btnOpenAdminLogin");

// Admin dashboard
const sectionParticipant = $("#sectionParticipant");
const sectionAdmin = $("#sectionAdmin");
const adminTableBody = $("#adminTableBody");
const adminEmpty = $("#adminEmpty");
const adminTotalCount = $("#adminTotalCount");
const btnLogout = $("#btnLogout");

// Edit modal
const modalEdit = $("#modalEdit");
const formEdit = $("#formEdit");
const editName = $("#editName");
const editPhone = $("#editPhone");
const editEmail = $("#editEmail");
const editCount = $("#editCount");
const btnSaveEdit = $("#btnSaveEdit");

// ============================================================
// Tab Switching
// ============================================================
function switchTab(tab) {
    if (tab === "register") {
        tabRegister.classList.add("active");
        tabCheck.classList.remove("active");
        panelRegister.classList.remove("hidden");
        panelCheck.classList.add("hidden");
    } else {
        tabCheck.classList.add("active");
        tabRegister.classList.remove("active");
        panelCheck.classList.remove("hidden");
        panelRegister.classList.add("hidden");
    }
    // Reset check results
    checkResult.classList.add("hidden");
    checkNoResult.classList.add("hidden");
    currentDocId = null;
}
window.switchTab = switchTab;

// ============================================================
// Modal Helpers
// ============================================================
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("hidden");
    // Trigger reflow for animation
    requestAnimationFrame(() => {
        modal.classList.add("show");
    });
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("show");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 200);
}
window.openModal = openModal;
window.closeModal = closeModal;

// Close modal on overlay click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            closeModal(overlay.id);
        }
    });
});

// ============================================================
// Utility: Phone number formatting
// ============================================================
function normalizePhone(phone) {
    return phone.replace(/[^0-9]/g, "");
}

function formatPhone(phone) {
    const nums = normalizePhone(phone);
    if (nums.length === 11) {
        return nums.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    } else if (nums.length === 10) {
        return nums.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    }
    return phone;
}

function formatTimestamp(ts) {
    if (!ts) return "-";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// ============================================================
// Validation
// ============================================================
function validateRegistration(name, phone, email) {
    if (!name.trim()) {
        alert("이름을 입력해 주세요.");
        return false;
    }
    const phoneNorm = normalizePhone(phone);
    if (phoneNorm.length < 10 || phoneNorm.length > 11) {
        alert("올바른 전화번호를 입력해 주세요. (예: 010-1234-5678)");
        return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("올바른 이메일 주소를 입력해 주세요.");
        return false;
    }
    return true;
}

// ============================================================
// 1. 참가 신청 (Create)
// ============================================================
formRegister.addEventListener("submit", async () => {
    const name = regName.value.trim();
    const phone = regPhone.value.trim();
    const email = regEmail.value.trim();
    const count = parseInt(regCount.value, 10);

    if (!validateRegistration(name, phone, email)) return;

    btnRegister.disabled = true;
    btnRegister.textContent = "신청 중...";

    try {
        // 중복 체크
        const phoneNorm = normalizePhone(phone);
        const existing = await participantsRef
            .where("phone", "==", phoneNorm)
            .where("name", "==", name)
            .get();

        if (!existing.empty) {
            alert("이미 동일한 이름과 전화번호로 신청된 내역이 있습니다.\n'신청 확인/수정' 탭에서 확인해 주세요.");
            return;
        }

        await participantsRef.add({
            name: name,
            phone: phoneNorm,
            email: email,
            count: count,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            status: "confirmed"
        });

        alert("참가 신청이 완료되었습니다!\n북 콘서트에서 만나 뵙겠습니다.");
        formRegister.reset();
    } catch (error) {
        console.error("Registration error:", error);
        alert("신청 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.\n\n오류: " + error.message);
    } finally {
        btnRegister.disabled = false;
        btnRegister.textContent = "참가 신청하기";
    }
});

// ============================================================
// 2. 신청 조회 (Read)
// ============================================================
formCheck.addEventListener("submit", async () => {
    const name = chkName.value.trim();
    const phone = chkPhone.value.trim();

    if (!name) {
        alert("이름을 입력해 주세요.");
        return;
    }
    if (!phone) {
        alert("전화번호를 입력해 주세요.");
        return;
    }

    btnCheck.disabled = true;
    btnCheck.textContent = "조회 중...";
    checkResult.classList.add("hidden");
    checkNoResult.classList.add("hidden");

    try {
        const phoneNorm = normalizePhone(phone);
        const snapshot = await participantsRef
            .where("name", "==", name)
            .where("phone", "==", phoneNorm)
            .get();

        if (snapshot.empty) {
            checkNoResult.classList.remove("hidden");
            currentDocId = null;
        } else {
            const doc = snapshot.docs[0];
            const data = doc.data();
            currentDocId = doc.id;

            resName.textContent = data.name;
            resPhone.textContent = formatPhone(data.phone);
            resEmail.textContent = data.email;
            resCount.textContent = data.count + "명";
            resTimestamp.textContent = formatTimestamp(data.timestamp);

            checkResult.classList.remove("hidden");
            checkResult.classList.add("animate-fade-in");
        }
    } catch (error) {
        console.error("Query error:", error);
        alert("조회 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.\n\n오류: " + error.message);
    } finally {
        btnCheck.disabled = false;
        btnCheck.textContent = "내 신청 조회하기";
    }
});

// ============================================================
// 3. 신청 수정 (Update) - Open edit modal
// ============================================================
btnEdit.addEventListener("click", async () => {
    if (!currentDocId) return;

    try {
        const doc = await participantsRef.doc(currentDocId).get();
        if (!doc.exists) {
            alert("신청 내역을 찾을 수 없습니다.");
            return;
        }
        const data = doc.data();
        editName.value = data.name;
        editPhone.value = formatPhone(data.phone);
        editEmail.value = data.email;
        editCount.value = data.count;
        openModal("modalEdit");
    } catch (error) {
        console.error("Edit fetch error:", error);
        alert("정보를 불러오는 중 오류가 발생했습니다.");
    }
});

// Save edited data
formEdit.addEventListener("submit", async () => {
    if (!currentDocId) return;

    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const email = editEmail.value.trim();
    const count = parseInt(editCount.value, 10);

    if (!validateRegistration(name, phone, email)) return;

    btnSaveEdit.disabled = true;
    btnSaveEdit.textContent = "저장 중...";

    try {
        await participantsRef.doc(currentDocId).update({
            name: name,
            phone: normalizePhone(phone),
            email: email,
            count: count
        });

        alert("수정이 완료되었습니다.");
        closeModal("modalEdit");

        // Refresh display
        resName.textContent = name;
        resPhone.textContent = formatPhone(phone);
        resEmail.textContent = email;
        resCount.textContent = count + "명";
    } catch (error) {
        console.error("Update error:", error);
        alert("수정 중 오류가 발생했습니다.\n\n오류: " + error.message);
    } finally {
        btnSaveEdit.disabled = false;
        btnSaveEdit.textContent = "수정 완료";
    }
});

// ============================================================
// 4. 신청 취소 (Delete)
// ============================================================
btnDelete.addEventListener("click", async () => {
    if (!currentDocId) return;

    if (!confirm("정말 신청을 취소하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;

    try {
        await participantsRef.doc(currentDocId).delete();
        alert("신청이 취소되었습니다.");
        currentDocId = null;
        checkResult.classList.add("hidden");
        checkNoResult.classList.add("hidden");
        formCheck.reset();
    } catch (error) {
        console.error("Delete error:", error);
        alert("취소 중 오류가 발생했습니다.\n\n오류: " + error.message);
    }
});

// ============================================================
// 5. 관리자 로그인
// ============================================================
btnOpenAdminLogin.addEventListener("click", () => {
    openModal("modalAdminLogin");
});

formAdminLogin.addEventListener("submit", async () => {
    const email = adminEmail.value.trim();
    const password = adminPassword.value.trim();

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력해 주세요.");
        return;
    }

    btnAdminLogin.disabled = true;
    btnAdminLogin.textContent = "로그인 중...";

    try {
        await auth.signInWithEmailAndPassword(email, password);
        closeModal("modalAdminLogin");
        formAdminLogin.reset();
    } catch (error) {
        console.error("Login error:", error);
        let message = "로그인에 실패했습니다.";
        switch (error.code) {
            case "auth/user-not-found":
                message = "등록되지 않은 이메일입니다.";
                break;
            case "auth/wrong-password":
            case "auth/invalid-credential":
                message = "비밀번호가 올바르지 않습니다.";
                break;
            case "auth/invalid-email":
                message = "이메일 형식이 올바르지 않습니다.";
                break;
            case "auth/too-many-requests":
                message = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
                break;
            default:
                message = "로그인 오류: " + error.message;
        }
        alert(message);
    } finally {
        btnAdminLogin.disabled = false;
        btnAdminLogin.textContent = "로그인";
    }
});

// ============================================================
// 6. 관리자 로그아웃
// ============================================================
btnLogout.addEventListener("click", async () => {
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// ============================================================
// 7. Auth State Observer - 보안의 핵심
// ============================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        // 관리자 로그인 상태
        showAdminMode();
    } else {
        // 비로그인 상태
        hideAdminMode();
    }
});

function showAdminMode() {
    sectionAdmin.classList.remove("hidden");
    btnOpenAdminLogin.textContent = "관리자 모드";
    btnOpenAdminLogin.classList.add("text-indigo-600", "font-semibold");
    btnOpenAdminLogin.classList.remove("text-slate-400");
    btnOpenAdminLogin.onclick = () => {
        document.getElementById("sectionAdmin").scrollIntoView({ behavior: "smooth" });
    };
    startRealtimeListener();
}

function hideAdminMode() {
    sectionAdmin.classList.add("hidden");
    btnOpenAdminLogin.textContent = "관리자";
    btnOpenAdminLogin.classList.remove("text-indigo-600", "font-semibold");
    btnOpenAdminLogin.classList.add("text-slate-400");
    btnOpenAdminLogin.onclick = () => openModal("modalAdminLogin");
    stopRealtimeListener();
}

// ============================================================
// 8. 실시간 관리자 리스트 (onSnapshot)
// ============================================================
function startRealtimeListener() {
    if (adminUnsubscribe) return; // 이미 리스닝 중

    adminUnsubscribe = participantsRef
        .orderBy("timestamp", "desc")
        .onSnapshot(
            (snapshot) => {
                adminTableBody.innerHTML = "";
                let totalPeople = 0;

                if (snapshot.empty) {
                    adminEmpty.classList.remove("hidden");
                    adminTotalCount.textContent = "0명";
                    return;
                }

                adminEmpty.classList.add("hidden");

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    totalPeople += data.count || 1;
                    const row = createAdminRow(doc.id, data);
                    adminTableBody.appendChild(row);
                });

                adminTotalCount.textContent = `${snapshot.size}건 / ${totalPeople}명`;
            },
            (error) => {
                console.error("Realtime listener error:", error);
            }
        );
}

function stopRealtimeListener() {
    if (adminUnsubscribe) {
        adminUnsubscribe();
        adminUnsubscribe = null;
    }
    adminTableBody.innerHTML = "";
}

function createAdminRow(docId, data) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
        <td class="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">${escapeHtml(data.name)}</td>
        <td class="px-6 py-4 text-slate-600 whitespace-nowrap">${escapeHtml(formatPhone(data.phone))}</td>
        <td class="px-6 py-4 text-slate-600 whitespace-nowrap hidden md:table-cell">${escapeHtml(data.email)}</td>
        <td class="px-6 py-4 text-center text-slate-600">${data.count || 1}</td>
        <td class="px-6 py-4 text-slate-500 text-xs whitespace-nowrap hidden sm:table-cell">${formatTimestamp(data.timestamp)}</td>
        <td class="px-6 py-4 text-center">
            <button class="admin-delete-btn text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-md transition-colors"
                    data-id="${docId}" data-name="${escapeHtml(data.name)}">
                삭제
            </button>
        </td>
    `;

    // 삭제 버튼 이벤트
    const deleteBtn = tr.querySelector(".admin-delete-btn");
    deleteBtn.addEventListener("click", async () => {
        const name = deleteBtn.dataset.name;
        if (!confirm(`"${name}" 님의 신청을 삭제하시겠습니까?`)) return;

        try {
            await participantsRef.doc(docId).delete();
        } catch (error) {
            console.error("Admin delete error:", error);
            alert("삭제 중 오류가 발생했습니다.\n\n오류: " + error.message);
        }
    });

    return tr;
}

// ============================================================
// Utility: XSS Prevention
// ============================================================
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
