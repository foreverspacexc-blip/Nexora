// =====================================================
//  ตั้งค่า — แก้เฉพาะส่วนนี้
// =====================================================
const CONFIG = {
    // Supabase Dashboard → Project Settings → API → Project URL
    SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_GO_cBCqm82xZ3pSF5gU4pw_Ya8EDgPa",

    TABLE: "youtube_boxes",
    // ชื่อคอลัมน์ในตารางของคุณ (ต้องตรงตัวพิมพ์เล็ก-ใหญ่)
    COL: { name: "nan", creator: "cre", url: "ytU" },

    // ลิงก์ที่ให้ผู้ใช้เปิด (ใส่ลิงก์เชิญ Discord เต็มๆ เช่น https://discord.gg/xxxxxx)
    EXTERNAL_URL: "https://discord.gg",
    WAIT_SECONDS: 5
};

// =====================================================
//  Supabase client (ไม่ตั้งชื่อตัวแปรว่า "supabase" เพื่อไม่ชนกับ SDK)
// =====================================================
let db = null;

function getDb() {
    if (db) return db;
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("โหลด Supabase SDK ไม่สำเร็จ (เช็คอินเทอร์เน็ต / ลิงก์ <script> ใน index.html)");
    }
    if (CONFIG.SUPABASE_URL.includes("YOUR-PROJECT-REF")) {
        throw new Error("ยังไม่ได้ใส่ SUPABASE_URL ใน script.js");
    }
    db = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return db;
}

// =====================================================
//  สถานะ + อ้างอิง element
// =====================================================
let hasOpenedTab = false;
let countdownTimer = null;
let isAdmin = false;
let boxes = [];

const unlockScreen = document.getElementById("unlock-screen");
const mainScreen = document.getElementById("main-screen");
const btnOpenTab = document.getElementById("btn-open-tab");
const btnUnlock = document.getElementById("btn-unlock");
const statusText = document.getElementById("status-text");
const container = document.getElementById("box-container");

// =====================================================
//  ระบบปลดล็อก: เปิดลิงก์ → กลับมาที่หน้านี้ → นับ 5 วิ → ปลดล็อก
// =====================================================
btnOpenTab.addEventListener("click", () => {
    window.open(CONFIG.EXTERNAL_URL, "_blank");
    hasOpenedTab = true;
    statusText.innerText = `กรุณากลับมาที่หน้านี้เพื่อเริ่มนับเวลา ${CONFIG.WAIT_SECONDS} วินาที`;
});

function startCountdown() {
    if (!hasOpenedTab || countdownTimer) return;

    let timeLeft = CONFIG.WAIT_SECONDS;
    btnOpenTab.innerText = `รอ (${timeLeft}) วิ`;
    btnOpenTab.setAttribute("disabled", "true");
    btnOpenTab.className = "btn btn-gray";

    countdownTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            btnOpenTab.innerText = `รอ (${timeLeft}) วิ`;
        } else {
            clearInterval(countdownTimer);
            btnOpenTab.innerText = "1. เปิดลิงก์ภายนอกสำเร็จ";
            statusText.innerText = "ระบบตรวจสอบเสร็จสิ้น! สามารถกดปลดล็อกได้แล้ว";
            btnUnlock.removeAttribute("disabled");
            btnUnlock.innerText = "2. ปลดล็อก";
            btnUnlock.className = "btn btn-green";
        }
    }, 1000);
}

// รองรับทั้งเดสก์ท็อป (focus) และมือถือ (visibilitychange)
window.addEventListener("focus", startCountdown);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") startCountdown();
});

btnUnlock.addEventListener("click", () => {
    unlockScreen.classList.remove("active");
    mainScreen.classList.add("active");
    fetchBoxes();
});

// =====================================================
//  โหลด / แสดงผล Box
// =====================================================
function showMessage(text, color) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.style.cssText = `grid-column:1/-1;text-align:center;color:${color || "#888"};`;
    p.textContent = text;
    container.appendChild(p);
}

async function fetchBoxes() {
    showMessage("กำลังโหลดข้อมูลจากฐานข้อมูลออนไลน์...");
    try {
        const { data, error } = await getDb()
            .from(CONFIG.TABLE)
            .select("*")
            .order("id", { ascending: true });
        if (error) throw error;
        boxes = data || [];
        renderBoxes();
    } catch (err) {
        console.error("Error fetching data:", err);
        showMessage("โหลดข้อมูลไม่สำเร็จ: " + (err.message || err), "red");
    }
}

function extractYoutubeId(url) {
    if (!url) return null;
    const m = String(url).match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
}

function renderBoxes() {
    container.innerHTML = "";
    if (boxes.length === 0) {
        showMessage("ยังไม่มีกล่องวิดีโอถูกสร้างขึ้น");
        return;
    }

    boxes.forEach((box) => {
        const name = box[CONFIG.COL.name] || "ไม่มีชื่อ";
        const creator = box[CONFIG.COL.creator] || "ไม่ระบุ";
        const link = box[CONFIG.COL.url] || "";
        const ytId = extractYoutubeId(link);

        const div = document.createElement("div");
        div.className = "video-box";

        const h4 = document.createElement("h4");
        h4.textContent = "ชื่อ: " + name;

        const p = document.createElement("p");
        const strong = document.createElement("strong");
        strong.textContent = "ผู้สร้าง:";
        p.append(strong, " " + creator);

        div.append(h4, p);

        if (ytId) {
            const wrap = document.createElement("div");
            wrap.className = "video-container";
            const iframe = document.createElement("iframe");
            iframe.src = `https://www.youtube.com/embed/${ytId}`;
            iframe.title = name;
            iframe.loading = "lazy";
            iframe.allowFullscreen = true;
            iframe.setAttribute("frameborder", "0");
            iframe.setAttribute("allow", "accelerometer; encrypted-media; gyroscope; picture-in-picture");
            wrap.appendChild(iframe);
            div.appendChild(wrap);
        } else {
            const bad = document.createElement("p");
            bad.style.color = "#c00";
            bad.textContent = "ลิงก์ YouTube ไม่ถูกต้อง";
            div.appendChild(bad);
        }

        const btn = document.createElement("button");
        btn.className = "btn btn-blue btn-sm";
        btn.textContent = "Copy Link";
        btn.addEventListener("click", () => copyText(link));
        div.appendChild(btn);

        container.appendChild(div);
    });
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (_) {
        // fallback สำหรับหน้าเว็บที่ไม่ใช่ https
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (!ok) { alert("ไม่สามารถคัดลอกได้"); return; }
    }
    alert("คัดลอกลิงก์สำเร็จแล้ว!");
}

// =====================================================
//  Admin Login
//  ⚠️ ชื่อผู้ใช้/รหัสผ่านฝั่งหน้าเว็บ ใครกด View Source ก็เห็น
// =====================================================
const loginModal = document.getElementById("login-modal");
const btnShowLogin = document.getElementById("btn-show-login");
const btnCloseLogin = document.getElementById("btn-close-login");
const btnSubmitLogin = document.getElementById("btn-submit-login");
const adminFormContainer = document.getElementById("admin-form-container");
const btnAdminPanel = document.getElementById("btn-admin-panel");
const btnLogout = document.getElementById("btn-logout");

btnShowLogin.addEventListener("click", () => loginModal.classList.add("open"));
btnCloseLogin.addEventListener("click", () => loginModal.classList.remove("open"));

btnSubmitLogin.addEventListener("click", () => {
    const user = document.getElementById("login-user").value;
    const pass = document.getElementById("login-pass").value;

    if (user === "Aten" && pass === "Aten67678*") {
        isAdmin = true;
        alert("เข้าสู่ระบบแอดมินสำเร็จ!");
        loginModal.classList.remove("open");
        document.getElementById("login-pass").value = "";

        btnShowLogin.style.display = "none";
        btnAdminPanel.style.display = "inline-block";
        btnLogout.style.display = "inline-block";
        adminFormContainer.style.display = "block";
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
});

btnAdminPanel.addEventListener("click", () => {
    adminFormContainer.style.display =
        adminFormContainer.style.display === "none" ? "block" : "none";
});

btnLogout.addEventListener("click", () => {
    isAdmin = false;
    btnShowLogin.style.display = "inline-block";
    btnAdminPanel.style.display = "none";
    btnLogout.style.display = "none";
    adminFormContainer.style.display = "none";
    alert("ออกจากระบบแอดมินแล้ว");
});

// =====================================================
//  Admin: เพิ่ม Box ลงฐานข้อมูล
// =====================================================
const btnAddBox = document.getElementById("btn-add-box");

btnAddBox.addEventListener("click", async () => {
    if (!isAdmin) return;

    const nameValue = document.getElementById("input-name").value.trim();
    const creatorValue = document.getElementById("input-creator").value.trim();
    const ytUrlValue = document.getElementById("input-yt-link").value.trim();

    if (!nameValue || !creatorValue || !ytUrlValue) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }
    if (!extractYoutubeId(ytUrlValue)) {
        alert("ลิงก์ YouTube ไม่ถูกต้อง");
        return;
    }

    btnAddBox.disabled = true;
    try {
        const { error } = await getDb()
            .from(CONFIG.TABLE)
            .insert([{
                [CONFIG.COL.name]: nameValue,
                [CONFIG.COL.creator]: creatorValue,
                [CONFIG.COL.url]: ytUrlValue
            }]);
        if (error) throw error;

        document.getElementById("input-name").value = "";
        document.getElementById("input-creator").value = "";
        document.getElementById("input-yt-link").value = "";

        await fetchBoxes();
        alert("สร้างกล่องและแชร์ให้ทุกคนเห็นบนหน้าเว็บเรียบร้อย!");
    } catch (err) {
        console.error("Error inserting data:", err);
        alert("บันทึกไม่สำเร็จ: " + (err.message || err) + "\n(เช็คชื่อคอลัมน์ และ RLS policy ของตาราง)");
    } finally {
        btnAddBox.disabled = false;
    }
});
