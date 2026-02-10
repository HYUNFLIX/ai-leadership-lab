// ============================================================
// Firebase Configuration
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
const participantsRef = db.collection("participants");

// ============================================================
// Global State
// ============================================================
let currentDocId = null;

// ============================================================
// DOM Elements
// ============================================================
const $ = (sel) => document.querySelector(sel);

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
    requestAnimationFrame(() => modal.classList.add("show"));
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 200);
}
window.openModal = openModal;
window.closeModal = closeModal;

document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
    });
});

// ============================================================
// Utility Functions
// ============================================================
function normalizePhone(phone) {
    return phone.replace(/[^0-9]/g, "");
}

function formatPhone(phone) {
    const nums = normalizePhone(phone);
    if (nums.length === 11) return nums.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (nums.length === 10) return nums.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
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

    if (!name) { alert("이름을 입력해 주세요."); return; }
    if (!phone) { alert("전화번호를 입력해 주세요."); return; }

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
// 3. 신청 수정 (Update)
// ============================================================
btnEdit.addEventListener("click", async () => {
    if (!currentDocId) return;

    try {
        const doc = await participantsRef.doc(currentDocId).get();
        if (!doc.exists) { alert("신청 내역을 찾을 수 없습니다."); return; }
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
