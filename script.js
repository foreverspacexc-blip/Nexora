// =====================================================
//  ตั้งค่า — แก้เฉพาะส่วนนี้
// =====================================================
const CONFIG = {
    SUPABASE_URL: "https://ysliushmitzoyahakeow.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_GO_cBCqm82xZ3pSF5gU4pw_Ya8EDgPa",

    TABLE: "youtube_boxes",
    // ชื่อคอลัมน์ในตาราง (ต้องตรงตัวพิมพ์เล็ก-ใหญ่)
    COL: { name: "name", creator: "creator", url: "ytUrl", script: "script", cover: "cover" },

    // ลิงก์ที่ให้ผู้ใช้เปิดในหน้าปลดล็อก (ใส่ลิงก์เชิญ Discord เต็มๆ เช่น https://discord.gg/xxxxxx)
    EXTERNAL_URL: "https://discord.gg/Hvyf8crug",
    WAIT_SECONDS: 5,

    // รูปแบนเนอร์ NEXORA
    BANNER_URL: "https://raw.githubusercontent.com/foreverspacexc-blip/OTHERHUB/refs/heads/main/file_00000000c050820ba6dbf0f36861a066.png",

    // ขนาดรูปปกที่ระบบจะย่อให้ตอน Admin อัปโหลด
    COVER: { W: 800, H: 450, QUALITY: 0.82 },

    // บัญชี Admin (⚠️ อยู่ในโค้ดฝั่งหน้าเว็บ ใครกด View Source ก็เห็น)
    ADMIN: { user: "Aten", pass: "Aten67678*" }
};
const COL = CONFIG.COL;

// =====================================================
//  Supabase client
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
//  ตัวช่วย
// =====================================================
const $ = (id) => document.getElementById(id);

// สร้าง element แบบปลอดภัย (ใช้ textContent เสมอ ไม่ใช้ innerHTML กับข้อมูลผู้ใช้)
function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "style") el.style.cssText = v;
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) el.append(c); });
    return el;
}

let toastTimer;
function toast(msg, isErr) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.toggle("err", !!isErr);
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), isErr ? 4500 : 2200);
}

async function copyText(text, okMsg) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (_) {
        // fallback สำหรับหน้าเว็บที่ไม่ใช่ https / เบราว์เซอร์เก่า
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (_) {}
        ta.remove();
        if (!ok) { toast("ไม่สามารถคัดลอกได้", true); return; }
    }
    toast(okMsg || "คัดลอกแล้ว ✓");
}

function extractYoutubeId(url) {
    if (!url) return null;
    const m = String(url).match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
    );
    return m ? m[1] : null;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("load image failed"));
        img.src = src;
    });
}

function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
}

// =====================================================
//  สถานะ
// =====================================================
let hasOpenedTab = false;
let countdownTimer = null;
let unlocked = false;
let isAdmin = false;
let boxes = [];
let query = "";
let sortDesc = true;       // true = ล่าสุด → เก่าสุด
let cameFromList = false;  // เปิดรายละเอียดจากการกดในหน้ารายการ (ใช้ตัดสินใจตอนกดย้อนกลับ)
let openId = null;
let coverValue = "";       // ค่ารูปปกที่จะบันทึก (data URL หรือ http URL)

const unlockScreen = $("unlock-screen");
const mainScreen = $("main-screen");
const btnOpenTab = $("btn-open-tab");
const btnUnlock = $("btn-unlock");
const statusText = $("status-text");
const container = $("box-container");
const detailView = $("detail-view");

// รูปแบนเนอร์
document.querySelectorAll("[data-banner]").forEach((img) => {
    img.addEventListener("error", () => { img.style.display = "none"; });
    img.src = CONFIG.BANNER_URL;
});

// =====================================================
//  ระบบปลดล็อก: เปิดลิงก์ → กลับมาที่หน้านี้ → นับเวลา → ปลดล็อก
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
    btnOpenTab.disabled = true;
    btnOpenTab.className = "btn btn-ghost";

    countdownTimer = setInterval(() => {
        timeLeft--;
        if (timeLeft > 0) {
            btnOpenTab.innerText = `รอ (${timeLeft}) วิ`;
        } else {
            clearInterval(countdownTimer);
            btnOpenTab.innerText = "1. เปิดลิงก์ภายนอกสำเร็จ ✓";
            statusText.innerText = "ระบบตรวจสอบเสร็จสิ้น! สามารถกดปลดล็อกได้แล้ว";
            btnUnlock.disabled = false;
            btnUnlock.innerText = "2. ปลดล็อก";
            btnUnlock.className = "btn btn-primary";
        }
    }, 1000);
}

// รองรับทั้งเดสก์ท็อป (focus) และมือถือ (visibilitychange)
window.addEventListener("focus", startCountdown);
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") startCountdown();
});

btnUnlock.addEventListener("click", () => {
    unlocked = true;
    unlockScreen.classList.remove("active");
    mainScreen.classList.add("active");
    window.scrollTo(0, 0);
    fetchBoxes();
});

// =====================================================
//  โหลดข้อมูล
// =====================================================
function renderSkeleton() {
    container.replaceChildren(
        ...Array.from({ length: 6 }, () =>
            h("div", { class: "skeleton" },
                h("div", { class: "sk-thumb" }),
                h("div", { class: "sk-line" }),
                h("div", { class: "sk-line short" })
            )
        )
    );
    $("result-count").textContent = "";
}

function renderError(err) {
    console.error("Error fetching data:", err);
    container.replaceChildren(
        h("div", { class: "state err" },
            h("div", { class: "emoji", text: "⚠️" }),
            h("p", { text: "โหลดข้อมูลไม่สำเร็จ: " + (err && err.message ? err.message : err) }),
            h("button", { class: "btn btn-ghost btn-sm", text: "ลองใหม่", onclick: fetchBoxes })
        )
    );
    $("result-count").textContent = "";
}

async function fetchBoxes() {
    renderSkeleton();
    try {
        const { data, error } = await getDb().from(CONFIG.TABLE).select("*");
        if (error) throw error;
        boxes = data || [];
        renderList();
        route();
    } catch (err) {
        renderError(err);
    }
}

// =====================================================
//  เรียงลำดับ + ค้นหา
// =====================================================
function orderKey(b, i) {
    const n = Number(b.id);
    if (b.id != null && !isNaN(n)) return n;
    const t = Date.parse(b.created_at);
    return isNaN(t) ? i : t;
}

function visibleBoxes() {
    const arr = boxes.map((b, i) => ({ b, k: orderKey(b, i) }));
    arr.sort((x, y) => (sortDesc ? y.k - x.k : x.k - y.k));
    let list = arr.map((x) => x.b);

    const q = query.trim().toLowerCase();
    if (q) {
        list = list.filter((b) =>
            ((b[COL.name] || "") + " " + (b[COL.creator] || "")).toLowerCase().includes(q)
        );
    }
    return list;
}

const idOf = (b) => (b.id != null ? b.id : boxes.indexOf(b));

function coverFor(box) {
    const c = box[COL.cover];
    if (c && /^(data:image\/|https?:\/\/)/i.test(c)) return c;
    const yt = extractYoutubeId(box[COL.url]);
    return yt ? `https://img.youtube.com/vi/${yt}/hqdefault.jpg` : "";
}

function makeThumb(src, alt) {
    const wrap = h("div", { class: "thumb" }, h("div", { class: "thumb-ph", text: "🎮" }));
    if (src) {
        const img = h("img", { src, alt: alt || "", loading: "lazy", decoding: "async" });
        img.addEventListener("error", () => img.remove());
        wrap.append(img);
    }
    return wrap;
}

function renderList() {
    const list = visibleBoxes();
    const total = boxes.length;
    const orderText = sortDesc ? "ใหม่ → เก่า" : "เก่า → ใหม่";
    $("result-count").textContent = (query.trim()
        ? `พบ ${list.length} จาก ${total} รายการ`
        : `ทั้งหมด ${total} รายการ`) + ` · เรียง ${orderText}`;

    if (total === 0) {
        container.replaceChildren(
            h("div", { class: "state" },
                h("div", { class: "emoji", text: "📦" }),
                h("p", { text: "ยังไม่มีกล่องถูกสร้างขึ้น" })
            )
        );
        return;
    }
    if (list.length === 0) {
        container.replaceChildren(
            h("div", { class: "state" },
                h("div", { class: "emoji", text: "🔍" }),
                h("p", { text: `ไม่พบ "${query.trim()}"` })
            )
        );
        return;
    }

    container.replaceChildren(
        ...list.map((box, i) => {
            const name = box[COL.name] || "ไม่มีชื่อ";
            const chips = [];
            if (extractYoutubeId(box[COL.url])) chips.push(h("span", { class: "chip", text: "▶ วิดีโอ" }));
            if ((box[COL.script] || "").trim()) chips.push(h("span", { class: "chip", text: "</> สคริป" }));

            const card = h("article", {
                class: "card", tabindex: "0", role: "button", "aria-label": name,
                style: `--i:${Math.min(i, 12)}`
            },
                makeThumb(coverFor(box), name),
                h("div", { class: "card-body" },
                    h("h3", { class: "card-title", text: name }),
                    h("div", { class: "chips" }, chips)
                )
            );
            const open = () => { cameFromList = true; location.hash = "#/box/" + encodeURIComponent(idOf(box)); };
            card.addEventListener("click", open);
            card.addEventListener("keydown", (e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
            });
            return card;
        })
    );
}

// ช่องค้นหา + ปุ่มเรียงลำดับ
const searchInput = $("search-input");
const searchClear = $("search-clear");
searchInput.addEventListener("input", () => {
    query = searchInput.value;
    searchClear.hidden = !query;
    if (unlocked && boxes.length) renderList();
});
searchClear.addEventListener("click", () => {
    searchInput.value = ""; query = ""; searchClear.hidden = true;
    renderList(); searchInput.focus();
});
$("btn-sort").addEventListener("click", () => {
    sortDesc = !sortDesc;
    $("sort-label").textContent = sortDesc ? "ใหม่ → เก่า" : "เก่า → ใหม่";
    renderList();
});

// =====================================================
//  หน้ารายละเอียด (ใช้ #/box/ID เพื่อให้ปุ่มย้อนกลับของมือถือใช้ได้)
// =====================================================
function route() {
    const m = location.hash.match(/^#\/box\/(.+)$/);
    if (m && unlocked) openDetail(decodeURIComponent(m[1]));
    else closeDetail();
}
window.addEventListener("hashchange", route);

function openDetail(id) {
    const box = boxes.find((b) => String(idOf(b)) === String(id));
    if (!box) {
        if (boxes.length) history.replaceState(null, "", location.pathname + location.search);
        return closeDetail();
    }
    if (openId === String(id) && !detailView.hidden) return;
    openId = String(id);

    const name = box[COL.name] || "ไม่มีชื่อ";
    const creator = box[COL.creator] || "ไม่ระบุ";
    const link = box[COL.url] || "";
    const ytId = extractYoutubeId(link);
    const script = box[COL.script] || "";
    const cover = coverFor(box);

    const head = h("div", { class: "d-head" },
        cover ? h("img", { class: "d-head-bg", src: cover, alt: "" }) : null,
        h("div", { class: "d-thumb" }, makeThumb(cover, name)),
        h("div", { class: "d-info" },
            h("h2", { class: "d-title", text: name }),
            h("div", { class: "d-creator" },
                h("span", { class: "avatar", text: (creator.trim()[0] || "?").toUpperCase() }),
                h("span", {}, "ผู้สร้าง: ", h("b", { text: creator }))
            )
        )
    );

    const videoSec = ytId
        ? h("section", {},
            h("div", { class: "section-label", text: "วิดีโอ" }),
            h("div", { class: "video" },
                h("iframe", {
                    src: `https://www.youtube.com/embed/${ytId}?rel=0`,
                    title: name,
                    allow: "accelerometer; encrypted-media; gyroscope; picture-in-picture",
                    allowfullscreen: true,
                    referrerpolicy: "strict-origin-when-cross-origin"
                })
            ),
            h("div", { class: "row-actions" },
                h("button", { class: "btn btn-ghost btn-sm", text: "คัดลอกลิงก์วิดีโอ", onclick: () => copyText(link, "คัดลอกลิงก์วิดีโอแล้ว ✓") }),
                h("a", { class: "btn btn-ghost btn-sm", href: `https://www.youtube.com/watch?v=${ytId}`, target: "_blank", rel: "noopener noreferrer", text: "เปิดใน YouTube ↗" })
            )
        )
        : null;

    const scriptSec = script.trim()
        ? h("section", {},
            h("div", { class: "section-label", text: "สคริป" }),
            h("div", { class: "code" },
                h("div", { class: "code-head" },
                    h("span", { class: "code-lang", text: "SCRIPT" }),
                    h("button", { class: "btn btn-primary btn-sm", text: "คัดลอกสคริป", onclick: () => copyText(script, "คัดลอกสคริปแล้ว ✓") })
                ),
                h("pre", {}, h("code", { text: script }))
            )
        )
        : null;

    const body = $("detail-body");
    body.replaceChildren(head, videoSec, scriptSec);
    if (!videoSec && !scriptSec) {
        body.append(h("div", { class: "empty-note", text: "รายการนี้ยังไม่มีวิดีโอหรือสคริป" }));
    }

    $("detail-bar-title").textContent = name;
    detailView.hidden = false;
    detailView.scrollTop = 0;
    document.body.classList.add("noscroll");
}

function closeDetail() {
    if (detailView.hidden && openId === null) return;
    detailView.hidden = true;
    $("detail-body").replaceChildren(); // ถอด iframe ออกเพื่อหยุดเสียงวิดีโอ
    openId = null;
    document.body.classList.remove("noscroll");
}

$("btn-detail-back").addEventListener("click", () => {
    if (cameFromList) {
        cameFromList = false;
        history.back();
    } else {
        history.replaceState(null, "", location.pathname + location.search);
        route();
    }
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if ($("login-modal").classList.contains("open")) $("login-modal").classList.remove("open");
        else if (!detailView.hidden) $("btn-detail-back").click();
    }
});

// =====================================================
//  Admin Login
//  ⚠️ ชื่อผู้ใช้/รหัสผ่านฝั่งหน้าเว็บ ใครกด View Source ก็เห็น
// =====================================================
const loginModal = $("login-modal");
const btnShowLogin = $("btn-show-login");
const btnAdminPanel = $("btn-admin-panel");
const btnLogout = $("btn-logout");
const adminForm = $("admin-form-container");

btnShowLogin.addEventListener("click", () => {
    loginModal.classList.add("open");
    setTimeout(() => $("login-user").focus(), 50);
});
$("btn-close-login").addEventListener("click", () => loginModal.classList.remove("open"));

function submitLogin() {
    const user = $("login-user").value;
    const pass = $("login-pass").value;

    if (user === CONFIG.ADMIN.user && pass === CONFIG.ADMIN.pass) {
        isAdmin = true;
        loginModal.classList.remove("open");
        $("login-pass").value = "";
        btnShowLogin.hidden = true;
        btnAdminPanel.hidden = false;
        btnLogout.hidden = false;
        adminForm.hidden = false;
        toast("เข้าสู่ระบบแอดมินสำเร็จ ✓");
    } else {
        toast("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", true);
    }
}
$("btn-submit-login").addEventListener("click", submitLogin);
["login-user", "login-pass"].forEach((id) =>
    $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") submitLogin(); })
);

btnAdminPanel.addEventListener("click", () => { adminForm.hidden = !adminForm.hidden; });

btnLogout.addEventListener("click", () => {
    isAdmin = false;
    btnShowLogin.hidden = false;
    btnAdminPanel.hidden = true;
    btnLogout.hidden = true;
    adminForm.hidden = true;
    toast("ออกจากระบบแอดมินแล้ว");
});

// =====================================================
//  Admin: รูปปก (ย่อ + ครอป 16:9 ในเบราว์เซอร์ ไม่ต้องตั้งค่า Storage)
// =====================================================
const fileInput = $("input-cover-file");
const urlInput = $("input-cover-url");
const previewBox = $("cover-preview");
const coverInfo = $("cover-info");

function setPreview(src) {
    previewBox.replaceChildren();
    if (src) previewBox.append(h("img", { src, alt: "ตัวอย่างรูปปก" }));
    else previewBox.textContent = "ยังไม่มีรูป";
}
function setInfo(text, kind) {
    coverInfo.textContent = text || "";
    coverInfo.className = "hint cover-info" + (kind ? " " + kind : "");
}

async function fileToCover(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = await loadImage(url);
        const { W, H, QUALITY } = CONFIG.COVER;
        const sw = img.naturalWidth, sh = img.naturalHeight;
        const target = W / H;
        let cw, ch;
        if (sw / sh > target) { ch = sh; cw = sh * target; } else { cw = sw; ch = sw / target; }
        const sx = (sw - cw) / 2, sy = (sh - ch) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, cw, ch, 0, 0, W, H);

        const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
        return { dataUrl, sw, sh, bytes: Math.round(dataUrl.length * 0.75) };
    } finally {
        URL.revokeObjectURL(url);
    }
}

fileInput.addEventListener("change", async () => {
    const f = fileInput.files[0];
    if (!f) return;
    setInfo("กำลังประมวลผลรูป...");
    try {
        const r = await fileToCover(f);
        const { W, H } = CONFIG.COVER;
        coverValue = r.dataUrl;
        urlInput.value = "";
        setPreview(r.dataUrl);

        let msg = `ต้นฉบับ ${r.sw}×${r.sh} px (${fmtBytes(f.size)}) → บันทึกเป็น ${W}×${H} px (~${fmtBytes(r.bytes)})`;
        let kind = "ok";
        if (r.sw < W || r.sh < H) { msg += " · รูปเล็กกว่าที่แนะนำ อาจดูเบลอ"; kind = "warn"; }
        else if (Math.abs(r.sw / r.sh - 16 / 9) > 0.02) { msg += " · ไม่ใช่ 16:9 ระบบครอปตรงกลางให้"; kind = "warn"; }
        setInfo(msg, kind);
    } catch (err) {
        console.error(err);
        coverValue = ""; setPreview("");
        setInfo("อ่านไฟล์รูปไม่ได้ ลองใช้ไฟล์ JPG / PNG / WEBP", "bad");
    }
});

urlInput.addEventListener("change", async () => {
    const u = urlInput.value.trim();
    if (!u) { coverValue = ""; setPreview(""); setInfo(""); return; }
    if (!/^https?:\/\//i.test(u)) { coverValue = ""; setInfo("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://", "bad"); return; }
    fileInput.value = "";
    setInfo("กำลังโหลดรูปจากลิงก์...");
    try {
        const img = await loadImage(u);
        coverValue = u;
        setPreview(u);
        const ratioOk = Math.abs(img.naturalWidth / img.naturalHeight - 16 / 9) <= 0.02;
        setInfo(`รูปจากลิงก์ ${img.naturalWidth}×${img.naturalHeight} px — ใช้ตามต้นฉบับ${ratioOk ? "" : " (ไม่ใช่ 16:9 ภาพจะถูกครอปตอนแสดง)"}`, ratioOk ? "ok" : "warn");
    } catch (_) {
        coverValue = ""; setPreview("");
        setInfo("โหลดรูปจากลิงก์นี้ไม่ได้", "bad");
    }
});

function resetAdminForm() {
    ["input-name", "input-creator", "input-yt-link", "input-script"].forEach((id) => { $(id).value = ""; });
    fileInput.value = ""; urlInput.value = "";
    coverValue = ""; setPreview(""); setInfo("");
}

// =====================================================
//  Admin: เพิ่มกล่องลงฐานข้อมูล
// =====================================================
const btnAddBox = $("btn-add-box");

btnAddBox.addEventListener("click", async () => {
    if (!isAdmin) return;

    const nameValue = $("input-name").value.trim();
    const creatorValue = $("input-creator").value.trim();
    const ytValue = $("input-yt-link").value.trim();
    const scriptValue = $("input-script").value.replace(/\r\n/g, "\n");

    if (!nameValue || !creatorValue) {
        toast("กรุณากรอกชื่อและชื่อผู้สร้าง", true);
        return;
    }
    if (ytValue && !extractYoutubeId(ytValue)) {
        toast("ลิงก์ YouTube ไม่ถูกต้อง", true);
        return;
    }

    const label = btnAddBox.textContent;
    btnAddBox.disabled = true;
    btnAddBox.textContent = "กำลังบันทึก...";
    try {
        const { error } = await getDb().from(CONFIG.TABLE).insert([{
            [COL.name]: nameValue,
            [COL.creator]: creatorValue,
            [COL.url]: ytValue,
            [COL.script]: scriptValue.trim() ? scriptValue : "",
            [COL.cover]: coverValue
        }]);
        if (error) throw error;

        resetAdminForm();
        // กลับไปมุมมอง "ล่าสุดก่อน" และล้างคำค้นหา เพื่อให้เห็นกล่องใหม่ทันที
        query = ""; searchInput.value = ""; searchClear.hidden = true;
        sortDesc = true; $("sort-label").textContent = "ใหม่ → เก่า";
        await fetchBoxes();
        toast("สร้างกล่องเรียบร้อย ✓");
    } catch (err) {
        console.error("Error inserting data:", err);
        let msg = "บันทึกไม่สำเร็จ: " + (err.message || err);
        if (/column|schema cache/i.test(msg)) msg += " — ต้องรัน setup.sql เพื่อเพิ่มคอลัมน์ cover / script ก่อน";
        toast(msg, true);
    } finally {
        btnAddBox.disabled = false;
        btnAddBox.textContent = label;
    }
});
