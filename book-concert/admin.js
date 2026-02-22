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

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const participantsRef = db.collection("participants");

// ============================================================
// State
// ============================================================
let unsubscribe = null;       // onSnapshot 리스너 해제
let allDocs = [];             // 전체 문서 캐시 (검색 필터용)
let editingDocId = null;      // 수정 중인 문서 ID
const settingsRef = db.collection("settings").doc("registration");

// ============================================================
// DOM
// ============================================================
const $ = (sel) => document.querySelector(sel);

// Screens
const loginScreen = $("#loginScreen");
const dashboardScreen = $("#dashboardScreen");

// Login
const formLogin = $("#formLogin");
const loginEmail = $("#loginEmail");
const loginPassword = $("#loginPassword");
const btnLogin = $("#btnLogin");

// Dashboard
const adminUserEmail = $("#adminUserEmail");
const btnLogout = $("#btnLogout");
const tableBody = $("#tableBody");
const emptyState = $("#emptyState");
const searchNoResult = $("#searchNoResult");
const searchInput = $("#searchInput");
const btnExportCSV = $("#btnExportCSV");

// Stats
const statTotalDocs = $("#statTotalDocs");
const statTodayDocs = $("#statTodayDocs");

// Edit Modal
const modalEdit = $("#modalEdit");
const formEdit = $("#formEdit");
const editName = $("#editName");
const editPhone = $("#editPhone");
const editEmail = $("#editEmail");
const editStatus = $("#editStatus");
const btnSaveEdit = $("#btnSaveEdit");
const btnCloseEdit = $("#btnCloseEdit");
const btnCancelEdit = $("#btnCancelEdit");

// ============================================================
// Auth State Observer
// ============================================================
auth.onAuthStateChanged((user) => {
    if (user) {
        loginScreen.classList.add("hidden");
        dashboardScreen.classList.remove("hidden");
        dashboardScreen.classList.add("fade-in");
        adminUserEmail.textContent = user.email;
        startRealtimeListener();
        initRegToggle();
    } else {
        dashboardScreen.classList.add("hidden");
        loginScreen.classList.remove("hidden");
        stopRealtimeListener();
    }
});

// ============================================================
// Registration Toggle (신청 마감 온/오프)
// ============================================================
function initRegToggle() {
    const toggle = document.getElementById("regToggle");
    const statusText = document.getElementById("regStatusText");
    const statusSub = document.getElementById("regStatusSub");
    const statusIcon = document.getElementById("regStatusIcon");

    // Listen to settings in realtime
    settingsRef.onSnapshot((doc) => {
        const closed = doc.exists ? doc.data().closed : false;
        toggle.checked = !closed;
        toggle.disabled = false;
        updateToggleUI(!closed);
    }, (error) => {
        console.error("Settings listener error:", error);
        statusText.textContent = "오류";
        statusSub.textContent = "설정을 불러올 수 없습니다";
    });

    // Toggle change handler
    toggle.addEventListener("change", async () => {
        const isOpen = toggle.checked;
        toggle.disabled = true;
        try {
            await settingsRef.set({ closed: !isOpen }, { merge: true });
        } catch (error) {
            console.error("Toggle error:", error);
            alert("상태 변경 중 오류가 발생했습니다.\n\n오류: " + error.message);
            toggle.checked = !isOpen; // revert
        } finally {
            toggle.disabled = false;
        }
    });

    function updateToggleUI(isOpen) {
        if (isOpen) {
            statusText.textContent = "접수 중";
            statusSub.textContent = "신청을 받고 있습니다";
            statusIcon.className = "w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center";
            statusIcon.innerHTML = '<svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>';
        } else {
            statusText.textContent = "마감됨";
            statusSub.textContent = "신청이 중단되었습니다";
            statusIcon.className = "w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center";
            statusIcon.innerHTML = '<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>';
        }
    }
}

// ============================================================
// Login
// ============================================================
formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail.value.trim();
    const password = loginPassword.value.trim();

    if (!email || !password) {
        alert("이메일과 비밀번호를 입력해 주세요.");
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "로그인 중...";

    try {
        await auth.signInWithEmailAndPassword(email, password);
        formLogin.reset();
    } catch (error) {
        console.error("Login error:", error);
        let msg = "로그인에 실패했습니다.";
        switch (error.code) {
            case "auth/user-not-found": msg = "등록되지 않은 이메일입니다."; break;
            case "auth/wrong-password":
            case "auth/invalid-credential": msg = "비밀번호가 올바르지 않습니다."; break;
            case "auth/invalid-email": msg = "이메일 형식이 올바르지 않습니다."; break;
            case "auth/too-many-requests": msg = "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요."; break;
            default: msg = "로그인 오류: " + error.message;
        }
        alert(msg);
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = "로그인";
    }
});

// ============================================================
// Logout
// ============================================================
btnLogout.addEventListener("click", async () => {
    if (!confirm("로그아웃 하시겠습니까?")) return;
    try {
        await auth.signOut();
    } catch (error) {
        console.error("Logout error:", error);
    }
});

// ============================================================
// Realtime Listener (onSnapshot)
// ============================================================
function startRealtimeListener() {
    if (unsubscribe) return;

    unsubscribe = participantsRef
        .orderBy("timestamp", "desc")
        .onSnapshot(
            (snapshot) => {
                allDocs = [];
                snapshot.forEach((doc) => {
                    allDocs.push({ id: doc.id, ...doc.data() });
                });
                updateStats(allDocs);
                renderTable(filterDocs(allDocs));
            },
            (error) => {
                console.error("Realtime listener error:", error);
                alert("데이터 로드 중 오류가 발생했습니다.\n\n오류: " + error.message);
            }
        );
}

function stopRealtimeListener() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    allDocs = [];
    tableBody.innerHTML = "";
}

// ============================================================
// Stats Calculation
// ============================================================
function updateStats(docs) {
    const totalDocs = docs.length;
    let todayDocs = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    docs.forEach((d) => {
        if (d.timestamp) {
            const ts = d.timestamp.toDate ? d.timestamp.toDate() : new Date(d.timestamp);
            if (ts >= today) todayDocs++;
        }
    });

    statTotalDocs.textContent = totalDocs;
    statTodayDocs.textContent = todayDocs;
}

// ============================================================
// Search / Filter
// ============================================================
searchInput.addEventListener("input", () => {
    renderTable(filterDocs(allDocs));
});

function filterDocs(docs) {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((d) => {
        const name = (d.name || "").toLowerCase();
        const phone = normalizePhone(d.phone || "");
        const email = (d.email || "").toLowerCase();
        return name.includes(q) || phone.includes(q) || email.includes(q) || formatPhone(d.phone || "").includes(q);
    });
}

// ============================================================
// Table Rendering
// ============================================================
function renderTable(docs) {
    tableBody.innerHTML = "";
    emptyState.classList.add("hidden");
    searchNoResult.classList.add("hidden");

    if (allDocs.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }

    if (docs.length === 0) {
        searchNoResult.classList.remove("hidden");
        return;
    }

    docs.forEach((data, idx) => {
        const tr = document.createElement("tr");
        const statusClass = data.status === "confirmed" ? "badge-confirmed"
            : data.status === "pending" ? "badge-pending"
            : data.status === "cancelled" ? "badge-cancelled"
            : "badge-confirmed";
        const statusLabel = data.status === "confirmed" ? "확인됨"
            : data.status === "pending" ? "대기중"
            : data.status === "cancelled" ? "취소됨"
            : "확인됨";

        tr.innerHTML = `
            <td class="px-4 sm:px-6 py-4 text-slate-400 text-xs">${idx + 1}</td>
            <td class="px-4 sm:px-6 py-4 font-medium text-slate-900 whitespace-nowrap">${escapeHtml(data.name)}</td>
            <td class="px-4 sm:px-6 py-4 text-slate-600 whitespace-nowrap">${escapeHtml(formatPhone(data.phone))}</td>
            <td class="px-4 sm:px-6 py-4 text-slate-600 whitespace-nowrap hidden md:table-cell">${escapeHtml(data.email)}</td>
            <td class="px-4 sm:px-6 py-4 text-slate-500 text-xs whitespace-nowrap hidden sm:table-cell">${formatTimestamp(data.timestamp)}</td>
            <td class="px-4 sm:px-6 py-4 text-center">
                <span class="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusClass}">${statusLabel}</span>
            </td>
            <td class="px-4 sm:px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-1">
                    <button class="btn-edit text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-md transition-colors" data-id="${data.id}">
                        수정
                    </button>
                    <button class="btn-delete text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-md transition-colors" data-id="${data.id}" data-name="${escapeHtml(data.name)}">
                        삭제
                    </button>
                </div>
            </td>
        `;

        // Edit button
        tr.querySelector(".btn-edit").addEventListener("click", () => openEditModal(data.id));

        // Delete button
        tr.querySelector(".btn-delete").addEventListener("click", () => handleDelete(data.id, data.name));

        tableBody.appendChild(tr);
    });
}

// ============================================================
// Delete
// ============================================================
async function handleDelete(docId, name) {
    if (!confirm(`"${name}" 님의 신청을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    try {
        await participantsRef.doc(docId).delete();
    } catch (error) {
        console.error("Delete error:", error);
        alert("삭제 중 오류가 발생했습니다.\n\n오류: " + error.message);
    }
}

// ============================================================
// Edit Modal
// ============================================================
function openEditModal(docId) {
    const data = allDocs.find((d) => d.id === docId);
    if (!data) return;

    editingDocId = docId;
    editName.value = data.name || "";
    editPhone.value = formatPhone(data.phone || "");
    editEmail.value = data.email || "";
    editStatus.value = data.status || "confirmed";

    openModal("modalEdit");
}

formEdit.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!editingDocId) return;

    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const email = editEmail.value.trim();
    const status = editStatus.value;

    if (!name) { alert("이름을 입력해 주세요."); return; }
    if (!phone) { alert("전화번호를 입력해 주세요."); return; }
    if (!email) { alert("이메일을 입력해 주세요."); return; }

    btnSaveEdit.disabled = true;
    btnSaveEdit.textContent = "저장 중...";

    try {
        await participantsRef.doc(editingDocId).update({
            name,
            phone: normalizePhone(phone),
            email,
            status
        });
        closeModal("modalEdit");
        editingDocId = null;
    } catch (error) {
        console.error("Update error:", error);
        alert("수정 중 오류가 발생했습니다.\n\n오류: " + error.message);
    } finally {
        btnSaveEdit.disabled = false;
        btnSaveEdit.textContent = "저장";
    }
});

btnCloseEdit.addEventListener("click", () => closeModal("modalEdit"));
btnCancelEdit.addEventListener("click", () => closeModal("modalEdit"));

// ============================================================
// CSV Export
// ============================================================
btnExportCSV.addEventListener("click", () => {
    if (allDocs.length === 0) {
        alert("내보낼 데이터가 없습니다.");
        return;
    }

    const BOM = "\uFEFF";
    const headers = ["No.", "이름", "전화번호", "이메일", "신청일시", "상태"];
    const rows = allDocs.map((d, i) => [
        i + 1,
        d.name,
        formatPhone(d.phone),
        d.email,
        formatTimestamp(d.timestamp),
        d.status === "confirmed" ? "확인됨" : d.status === "pending" ? "대기중" : d.status === "cancelled" ? "취소됨" : d.status
    ]);

    let csv = BOM + headers.join(",") + "\n";
    rows.forEach((row) => {
        csv += row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `북콘서트_신청자_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
});

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

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
