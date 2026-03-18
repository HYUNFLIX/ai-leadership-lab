// ============================================================
// API-based Book Concert App (Firebase 제거 버전)
// ============================================================

// Global State
let currentDocId = null;
let REGISTRATION_CLOSED = false;

// DOM Elements
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
const resTimestamp = $("#resTimestamp");
const btnEdit = $("#btnEdit");
const btnDelete = $("#btnDelete");

// Edit modal
const modalEdit = $("#modalEdit");
const formEdit = $("#formEdit");
const editName = $("#editName");
const editPhone = $("#editPhone");
const editEmail = $("#editEmail");
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
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

// ============================================================
// Phone Auto-Formatting
// ============================================================
function autoFormatPhone(e) {
    const input = e.target;
    const cursor = input.selectionStart;
    const prevLen = input.value.length;
    const nums = input.value.replace(/[^0-9]/g, "").slice(0, 11);
    let formatted = nums;
    if (nums.length > 7) {
        formatted = nums.replace(/(\d{3})(\d{4})(\d{0,4})/, "$1-$2-$3");
    } else if (nums.length > 3) {
        formatted = nums.replace(/(\d{3})(\d{0,4})/, "$1-$2");
    }
    input.value = formatted;
    const diff = formatted.length - prevLen;
    input.setSelectionRange(cursor + diff, cursor + diff);
}

[regPhone, chkPhone, editPhone].forEach((el) => {
    if (el) el.addEventListener("input", autoFormatPhone);
});

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
// Registration Closed - 서버에서 체크
// ============================================================
const _origFormHTML = $("#panelRegister") ? $("#panelRegister").innerHTML : "";

async function checkRegistrationStatus() {
    try {
        const res = await fetch("/api/participants/settings");
        const data = await res.json();
        REGISTRATION_CLOSED = data.closed;
        applyClosedUI(data.closed);
    } catch (error) {
        console.error("Settings read error:", error);
    }
}

function applyClosedUI(closed) {
    const panelReg = $("#panelRegister");
    if (!panelReg) return;

    if (closed) {
        panelReg.innerHTML = `
            <div class="text-center py-12">
                <div class="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
                    <svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-slate-900 mb-2">신청이 마감되었습니다</h3>
                <p class="text-sm text-slate-500 leading-relaxed">많은 관심에 감사드립니다.<br>다음 행사에서 만나 뵙겠습니다.</p>
            </div>
        `;
        document.querySelectorAll('a[href="#sectionParticipant"], .btn-pill-primary').forEach((btn) => {
            btn.dataset.origText = btn.textContent.trim();
            btn.dataset.origHref = btn.getAttribute("href") || "";
            btn.textContent = "신청 마감";
            btn.classList.add("pointer-events-none", "opacity-50", "cta-closed");
            btn.removeAttribute("href");
        });
        const mobileCta = document.getElementById("mobileCta");
        if (mobileCta) mobileCta.style.display = "none";
    } else {
        if (!$("#formRegister")) {
            panelReg.innerHTML = _origFormHTML;
            const newRegPhone = $("#regPhone");
            if (newRegPhone) newRegPhone.addEventListener("input", autoFormatPhone);
        }
        document.querySelectorAll(".cta-closed").forEach((btn) => {
            btn.textContent = btn.dataset.origText || "참가 신청하기";
            btn.setAttribute("href", btn.dataset.origHref || "#sectionParticipant");
            btn.classList.remove("pointer-events-none", "opacity-50", "cta-closed");
        });
        const mobileCta = document.getElementById("mobileCta");
        if (mobileCta) mobileCta.style.display = "";
    }
}

// 초기 체크 + 주기적 폴링 (30초)
checkRegistrationStatus();
setInterval(checkRegistrationStatus, 30000);

// ============================================================
// 1. 참가 신청 (Create)
// ============================================================
if (formRegister) formRegister.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (REGISTRATION_CLOSED) {
        alert("신청이 마감되었습니다.\n많은 관심에 감사드립니다.");
        return;
    }

    const name = regName.value.trim();
    const phone = regPhone.value.trim();
    const email = regEmail.value.trim();

    if (!validateRegistration(name, phone, email)) return;

    const consent = document.getElementById("regConsent");
    const photoConsent = document.getElementById("regPhotoConsent");
    if (consent && !consent.checked) {
        alert("개인정보 수집·이용에 동의해 주세요.");
        return;
    }
    if (photoConsent && !photoConsent.checked) {
        alert("행사 촬영 및 활용에 동의해 주세요.");
        return;
    }

    btnRegister.disabled = true;
    btnRegister.textContent = "신청 중...";

    try {
        const res = await fetch("/api/participants/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone: normalizePhone(phone), email })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "신청 중 오류가 발생했습니다.");
            return;
        }

        alert("참가 신청이 완료되었습니다!\n인사이트 공유회에서 만나 뵙겠습니다.");
        formRegister.reset();
    } catch (error) {
        console.error("Registration error:", error);
        alert("신청 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.");
    } finally {
        btnRegister.disabled = false;
        btnRegister.textContent = "참가 신청하기";
    }
});

// ============================================================
// 2. 신청 조회 (Read)
// ============================================================
formCheck.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = chkName.value.trim();
    const phone = chkPhone.value.trim();

    if (!name) { alert("이름을 입력해 주세요."); return; }
    if (!phone) { alert("전화번호를 입력해 주세요."); return; }

    btnCheck.disabled = true;
    btnCheck.textContent = "조회 중...";
    checkResult.classList.add("hidden");
    checkNoResult.classList.add("hidden");

    try {
        const res = await fetch("/api/participants/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone })
        });
        const result = await res.json();

        if (!result.found) {
            checkNoResult.classList.remove("hidden");
            currentDocId = null;
        } else {
            const data = result.data;
            currentDocId = data.id;

            resName.textContent = data.name;
            resPhone.textContent = formatPhone(data.phone);
            resEmail.textContent = data.email;
            resTimestamp.textContent = formatTimestamp(data.created_at);

            checkResult.classList.remove("hidden");
            checkResult.classList.add("animate-fade-in");
        }
    } catch (error) {
        console.error("Query error:", error);
        alert("조회 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.");
    } finally {
        btnCheck.disabled = false;
        btnCheck.textContent = "내 신청 조회하기";
    }
});

// ============================================================
// 3. 신청 수정 (Update)
// ============================================================
btnEdit.addEventListener("click", () => {
    if (!currentDocId) return;
    editName.value = resName.textContent;
    editPhone.value = resPhone.textContent;
    editEmail.value = resEmail.textContent;
    openModal("modalEdit");
});

formEdit.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentDocId) return;

    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const email = editEmail.value.trim();

    if (!validateRegistration(name, phone, email)) return;

    btnSaveEdit.disabled = true;
    btnSaveEdit.textContent = "저장 중...";

    try {
        const res = await fetch(`/api/participants/${currentDocId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone, email })
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || "수정 중 오류가 발생했습니다.");
            return;
        }

        alert("수정이 완료되었습니다.");
        closeModal("modalEdit");

        resName.textContent = name;
        resPhone.textContent = formatPhone(phone);
        resEmail.textContent = email;
    } catch (error) {
        console.error("Update error:", error);
        alert("수정 중 오류가 발생했습니다.");
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
        await fetch(`/api/participants/${currentDocId}`, { method: "DELETE" });
        alert("신청이 취소되었습니다.");
        currentDocId = null;
        checkResult.classList.add("hidden");
        checkNoResult.classList.add("hidden");
        formCheck.reset();
    } catch (error) {
        console.error("Delete error:", error);
        alert("취소 중 오류가 발생했습니다.");
    }
});
