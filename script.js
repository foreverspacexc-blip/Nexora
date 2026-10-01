const CONFIG = {
    SUPABASE_URL: "https://ysliushmitzoyahakeow.supabase.co",
    SUPABASE_ANON_KEY: "sb_publishable_GO_cBCqm82xZ3pSF5gU4pw_Ya8EDgPa",
    TABLE: "youtube_boxes",
    STORAGE_BUCKET: "box-covers",
    COL: {
        name: "name",
        creator: "creator",
        url: "ytUrl",
        script: "script",
        cover: "cover"
    },
    EXTERNAL_URL: "https://discord.gg/Hvyf8crug",
    WAIT_SECONDS: 5,
    BANNER_URL: "https://raw.githubusercontent.com/foreverspacexc-blip/OTHERHUB/refs/heads/main/file_00000000c050820ba6dbf0f36861a066.png",
    COVER: {
        W: 800,
        H: 450,
        QUALITY: 0.70
    },
    PAGE_SIZE: 12,
    ADMIN_EMAILS: [
        "foreverspacexc@gmail.com",
        "aten131012@gmail.com"
    ]
};

const COL = CONFIG.COL;

let db = null;
let hasOpenedTab = false;
let countdownTimer = null;
let unlocked = false;
let isAdmin = false;
let boxes = [];
let query = "";
let sortDesc = true;
let cameFromList = false;
let openId = null;
let coverFile = null;
let currentPage = 1;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

function getDb() {
    if (db) return db;

    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("โหลด Supabase SDK ไม่สำเร็จ");
    }

    db = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SUPABASE_ANON_KEY
    );

    return db;
}

function h(tag, props = {}, ...kids) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value == null || value === false) continue;

        if (key === "class") {
            el.className = value;
        } else if (key === "text") {
            el.textContent = value;
        } else if (key === "style") {
            el.style.cssText = value;
        } else if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2), value);
        } else {
            el.setAttribute(key, value === true ? "" : value);
        }
    }

    kids.flat().forEach((child) => {
        if (child !== null && child !== undefined && child !== false) {
            el.append(child);
        }
    });

    return el;
}

function toast(message, error = false) {
    const el = $("toast");
    if (!el) return;

    el.textContent = message;
    el.classList.toggle("err", !!error);
    el.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        el.classList.remove("show");
    }, error ? 4500 : 2200);
}

async function copyText(text, successMessage = "คัดลอกแล้ว ✓") {
    if (!text) {
        toast("ไม่มีข้อมูลให้คัดลอก", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        toast(successMessage);
        return;
    } catch (_) {}

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let success = false;

    try {
        success = document.execCommand("copy");
    } catch (_) {}

    textarea.remove();

    toast(
        success ? successMessage : "ไม่สามารถคัดลอกได้",
        !success
    );
}

function extractYoutubeId(url) {
    if (!url) return null;

    const value = String(url).trim();

    const match = value.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
    );

    return match ? match[1] : null;
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("โหลดรูปไม่สำเร็จ"));

        img.src = src;
    });
}

function fmtBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getCurrentHashId() {
    const match = location.hash.match(/^#\/box\/(.+)$/);
    return match ? decodeURIComponent(match[1]) : null;
}

function getBoxId(box) {
    if (box?.id !== undefined && box?.id !== null) {
        return box.id;
    }

    return boxes.indexOf(box);
}

function getBoxLink(box) {
    return `${location.origin}${location.pathname}${location.search}#/box/${encodeURIComponent(getBoxId(box))}`;
}

function isAllowedAdminEmail(email) {
    return CONFIG.ADMIN_EMAILS.includes(
        String(email || "").trim().toLowerCase()
    );
}

async function updateAdminState(user) {
    const email = user?.email?.trim().toLowerCase() || "";

    isAdmin = !!user && isAllowedAdminEmail(email);

    $("btn-show-login").hidden = isAdmin;
    $("btn-admin-panel").hidden = !isAdmin;
    $("btn-logout").hidden = !user;
    $("admin-form-container").hidden = !isAdmin;

    if (user && !isAdmin) {
        toast("บัญชี Google นี้ไม่มีสิทธิ์ Admin", true);
    }
}

async function initAuth() {
    const client = getDb();

    const {
        data: { session }
    } = await client.auth.getSession();

    await updateAdminState(session?.user || null);

    client.auth.onAuthStateChange(async (event, sessionState) => {
        await updateAdminState(sessionState?.user || null);

        if (event === "SIGNED_IN" && sessionState?.user) {
            if (isAllowedAdminEmail(sessionState.user.email)) {
                $("login-modal").classList.remove("open");
                toast("เข้าสู่ระบบ Admin สำเร็จ ✓");
            }
        }

        if (event === "SIGNED_OUT") {
            $("admin-form-container").hidden = true;
            toast("ออกจากระบบแล้ว");
        }
    });
}

async function loginWithGoogle() {
    try {
        const client = getDb();

        const { error } = await client.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: window.location.origin + window.location.pathname
            }
        });

        if (error) throw error;
    } catch (error) {
        console.error(error);
        toast(
            "เข้าสู่ระบบ Google ไม่สำเร็จ: " + (error.message || error),
            true
        );
    }
}

async function logoutAdmin() {
    try {
        const { error } = await getDb().auth.signOut();

        if (error) throw error;
    } catch (error) {
        console.error(error);
        toast("ออกจากระบบไม่สำเร็จ", true);
    }
}

document.querySelectorAll("[data-banner]").forEach((img) => {
    img.addEventListener("error", () => {
        img.style.display = "none";
    });

    img.src = CONFIG.BANNER_URL;
});

const unlockScreen = $("unlock-screen");
const mainScreen = $("main-screen");
const btnOpenTab = $("btn-open-tab");
const btnUnlock = $("btn-unlock");
const statusText = $("status-text");
const container = $("box-container");
const detailView = $("detail-view");

btnOpenTab.addEventListener("click", () => {
    window.open(CONFIG.EXTERNAL_URL, "_blank", "noopener,noreferrer");

    hasOpenedTab = true;

    statusText.textContent =
        `กรุณากลับมาที่หน้านี้เพื่อเริ่มนับเวลา ${CONFIG.WAIT_SECONDS} วินาที`;

    startCountdown();
});

function startCountdown() {
    if (!hasOpenedTab || countdownTimer) return;

    let timeLeft = CONFIG.WAIT_SECONDS;

    btnOpenTab.disabled = true;
    btnOpenTab.className = "btn btn-ghost";
    btnOpenTab.textContent = `รอ (${timeLeft}) วิ`;

    countdownTimer = setInterval(() => {
        timeLeft--;

        if (timeLeft > 0) {
            btnOpenTab.textContent = `รอ (${timeLeft}) วิ`;
            return;
        }

        clearInterval(countdownTimer);
        countdownTimer = null;

        btnOpenTab.textContent = "1. เปิดลิงก์ภายนอกสำเร็จ ✓";
        statusText.textContent =
            "ระบบตรวจสอบเสร็จสิ้น! สามารถกดปลดล็อกได้แล้ว";

        btnUnlock.disabled = false;
        btnUnlock.textContent = "2. ปลดล็อก";
        btnUnlock.className = "btn btn-primary";
    }, 1000);
}

window.addEventListener("focus", startCountdown);

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        startCountdown();
    }
});

btnUnlock.addEventListener("click", async () => {
    if (btnUnlock.disabled) return;

    unlocked = true;

    unlockScreen.classList.remove("active");
    mainScreen.classList.add("active");

    window.scrollTo(0, 0);

    await fetchBoxes();
});

function renderSkeleton() {
    container.replaceChildren(
        ...Array.from({ length: 6 }, () =>
            h(
                "div",
                { class: "skeleton" },
                h("div", { class: "sk-thumb" }),
                h("div", { class: "sk-line" }),
                h("div", { class: "sk-line short" })
            )
        )
    );

    $("result-count").textContent = "";
    $("pagination").replaceChildren();
}

function renderError(error) {
    console.error(error);

    container.replaceChildren(
        h(
            "div",
            { class: "state err" },
            h("div", { class: "emoji", text: "⚠️" }),
            h(
                "p",
                {
                    text:
                        "โหลดข้อมูลไม่สำเร็จ: " +
                        (error?.message || error || "Unknown error")
                }
            ),
            h("button", {
                class: "btn btn-ghost btn-sm",
                text: "ลองใหม่",
                onclick: fetchBoxes
            })
        )
    );

    $("result-count").textContent = "";
    $("pagination").replaceChildren();
}

async function fetchBoxes() {
    renderSkeleton();

    try {
        const { data, error } = await getDb()
            .from(CONFIG.TABLE)
            .select("*");

        if (error) throw error;

        boxes = Array.isArray(data) ? data : [];

        currentPage = 1;

        renderList();
        route();
    } catch (error) {
        renderError(error);
    }
}

function orderKey(box, index) {
    if (box?.id !== undefined && box?.id !== null) {
        const numberId = Number(box.id);

        if (!Number.isNaN(numberId)) {
            return numberId;
        }
    }

    const created = Date.parse(box?.created_at || "");

    return Number.isNaN(created) ? index : created;
}

function getFilteredBoxes() {
    const sorted = boxes
        .map((box, index) => ({
            box,
            key: orderKey(box, index)
        }))
        .sort((a, b) =>
            sortDesc
                ? b.key - a.key
                : a.key - b.key
        )
        .map((item) => item.box);

    const search = query.trim().toLowerCase();

    if (!search) return sorted;

    return sorted.filter((box) => {
        const name = String(box[COL.name] || "").toLowerCase();
        const creator = String(box[COL.creator] || "").toLowerCase();

        return `${name} ${creator}`.includes(search);
    });
}

function coverFor(box) {
    const cover = box?.[COL.cover];

    if (
        cover &&
        /^(data:image\/|https?:\/\/)/i.test(String(cover))
    ) {
        return cover;
    }

    const youtubeId = extractYoutubeId(box?.[COL.url]);

    if (youtubeId) {
        return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
    }

    return "";
}

function makeThumb(src, alt) {
    const wrapper = h(
        "div",
        { class: "thumb" },
        h("div", {
            class: "thumb-ph",
            text: "🎮"
        })
    );

    if (src) {
        const img = h("img", {
            src,
            alt: alt || "",
            loading: "lazy",
            decoding: "async"
        });

        img.addEventListener("error", () => {
            img.remove();
        });

        wrapper.append(img);
    }

    return wrapper;
}

function renderPagination(totalItems) {
    const pagination = $("pagination");
    pagination.replaceChildren();

    const totalPages = Math.ceil(
        totalItems / CONFIG.PAGE_SIZE
    );

    if (totalPages <= 1) return;

    const createPageButton = (label, page, active = false) => {
        return h("button", {
            class: active
                ? "btn btn-primary btn-sm"
                : "btn btn-ghost btn-sm",
            text: label,
            type: "button",
            "aria-current": active ? "page" : null,
            onclick: () => {
                currentPage = page;
                renderList();

                window.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            }
        });
    };

    if (currentPage > 1) {
        pagination.append(
            createPageButton("‹", currentPage - 1)
        );
    }

    const pages = [];

    if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        pages.push(1);

        if (currentPage > 4) {
            pages.push("...");
        }

        const start = Math.max(2, currentPage - 1);
        const end = Math.min(
            totalPages - 1,
            currentPage + 1
        );

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (currentPage < totalPages - 3) {
            pages.push("...");
        }

        pages.push(totalPages);
    }

    pages.forEach((page) => {
        if (page === "...") {
            pagination.append(
                h("span", {
                    class: "pagination-dots",
                    text: "..."
                })
            );
        } else {
            pagination.append(
                createPageButton(
                    String(page),
                    page,
                    page === currentPage
                )
            );
        }
    });

    if (currentPage < totalPages) {
        pagination.append(
            createPageButton("›", currentPage + 1)
        );
    }
}

function renderList() {
    const filtered = getFilteredBoxes();

    const total = boxes.length;
    const filteredTotal = filtered.length;

    const totalPages = Math.max(
        1,
        Math.ceil(filteredTotal / CONFIG.PAGE_SIZE)
    );

    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    const start = (currentPage - 1) * CONFIG.PAGE_SIZE;
    const pageItems = filtered.slice(
        start,
        start + CONFIG.PAGE_SIZE
    );

    const orderText = sortDesc
        ? "ใหม่ → เก่า"
        : "เก่า → ใหม่";

    $("result-count").textContent =
        (query.trim()
            ? `พบ ${filteredTotal} จาก ${total} รายการ`
            : `ทั้งหมด ${total} รายการ`) +
        ` · เรียง ${orderText}`;

    if (total === 0) {
        container.replaceChildren(
            h(
                "div",
                { class: "state" },
                h("div", {
                    class: "emoji",
                    text: "📦"
                }),
                h("p", {
                    text: "ยังไม่มีกล่องถูกสร้างขึ้น"
                })
            )
        );

        $("pagination").replaceChildren();
        return;
    }

    if (filteredTotal === 0) {
        container.replaceChildren(
            h(
                "div",
                { class: "state" },
                h("div", {
                    class: "emoji",
                    text: "🔍"
                }),
                h("p", {
                    text: `ไม่พบ "${query.trim()}"`
                })
            )
        );

        $("pagination").replaceChildren();
        return;
    }

    container.replaceChildren(
        ...pageItems.map((box, index) => {
            const name = box[COL.name] || "ไม่มีชื่อ";

            const chips = [];

            if (extractYoutubeId(box[COL.url])) {
                chips.push(
                    h("span", {
                        class: "chip",
                        text: "▶ วิดีโอ"
                    })
                );
            }

            if (String(box[COL.script] || "").trim()) {
                chips.push(
                    h("span", {
                        class: "chip",
                        text: "</> สคริป"
                    })
                );
            }

            const card = h(
                "article",
                {
                    class: "card",
                    tabindex: "0",
                    role: "button",
                    "aria-label": name,
                    style: `--i:${Math.min(index, 12)}`
                },
                makeThumb(
                    coverFor(box),
                    name
                ),
                h(
                    "div",
                    { class: "card-body" },
                    h("h3", {
                        class: "card-title",
                        text: name
                    }),
                    h(
                        "div",
                        { class: "chips" },
                        chips
                    )
                )
            );

            const open = () => {
                cameFromList = true;

                location.hash =
                    "#/box/" +
                    encodeURIComponent(getBoxId(box));
            };

            card.addEventListener("click", open);

            card.addEventListener("keydown", (event) => {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    event.preventDefault();
                    open();
                }
            });

            return card;
        })
    );

    renderPagination(filteredTotal);
}

const searchInput = $("search-input");
const searchClear = $("search-clear");

searchInput.addEventListener("input", () => {
    query = searchInput.value;
    searchClear.hidden = !query;

    currentPage = 1;

    if (unlocked) {
        renderList();
    }
});

searchClear.addEventListener("click", () => {
    searchInput.value = "";
    query = "";
    currentPage = 1;

    searchClear.hidden = true;

    renderList();
    searchInput.focus();
});

$("btn-sort").addEventListener("click", () => {
    sortDesc = !sortDesc;
    currentPage = 1;

    $("sort-label").textContent =
        sortDesc
            ? "ใหม่ → เก่า"
            : "เก่า → ใหม่";

    renderList();
});

function route() {
    if (!unlocked) return;

    const id = getCurrentHashId();

    if (id !== null) {
        openDetail(id);
    } else {
        closeDetail();
    }
}

window.addEventListener("hashchange", route);

function createDeleteButton(box) {
    if (!isAdmin) return null;

    return h("button", {
        class: "btn btn-danger btn-sm",
        text: "ลบ Box",
        type: "button",
        onclick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteBox(box);
        }
    });
}

function openDetail(id) {
    const box = boxes.find(
        (item) =>
            String(getBoxId(item)) === String(id)
    );

    if (!box) {
        if (boxes.length) {
            history.replaceState(
                null,
                "",
                location.pathname + location.search
            );
        }

        closeDetail();
        return;
    }

    openId = String(id);

    const name = box[COL.name] || "ไม่มีชื่อ";
    const creator = box[COL.creator] || "ไม่ระบุ";
    const youtubeUrl = box[COL.url] || "";
    const youtubeId = extractYoutubeId(youtubeUrl);
    const script = box[COL.script] || "";
    const cover = coverFor(box);
    const boxLink = getBoxLink(box);

    const topActions = [
        h("button", {
            class: "btn btn-ghost btn-sm",
            text: "🔗 คัดลอกลิงก์ Box",
            type: "button",
            onclick: () =>
                copyText(
                    boxLink,
                    "คัดลอกลิงก์ Box แล้ว ✓"
                )
        })
    ];

    const deleteButton = createDeleteButton(box);

    if (deleteButton) {
        topActions.push(deleteButton);
    }

    const head = h(
        "div",
        { class: "d-head" },
        cover
            ? h("img", {
                  class: "d-head-bg",
                  src: cover,
                  alt: ""
              })
            : null,
        h(
            "div",
            { class: "d-thumb" },
            makeThumb(cover, name)
        ),
        h(
            "div",
            { class: "d-info" },
            h("h2", {
                class: "d-title",
                text: name
            }),
            h(
                "div",
                { class: "d-creator" },
                h("span", {
                    class: "avatar",
                    text:
                        (
                            creator.trim()[0] ||
                            "?"
                        ).toUpperCase()
                }),
                h(
                    "span",
                    {},
                    "ผู้สร้าง: ",
                    h("b", {
                        text: creator
                    })
                )
            ),
            h(
                "div",
                { class: "row-actions" },
                topActions
            )
        )
    );

    const sections = [head];

    if (youtubeId) {
        sections.push(
            h(
                "section",
                {},
                h("div", {
                    class: "section-label",
                    text: "วิดีโอ"
                }),
                h(
                    "div",
                    { class: "video" },
                    h("iframe", {
                        src:
                            `https://www.youtube.com/embed/${youtubeId}?rel=0`,
                        title: name,
                        allow:
                            "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture",
                        allowfullscreen: true,
                        referrerpolicy:
                            "strict-origin-when-cross-origin"
                    })
                ),
                h(
                    "div",
                    { class: "row-actions" },
                    h("button", {
                        class: "btn btn-ghost btn-sm",
                        text: "คัดลอกลิงก์วิดีโอ",
                        type: "button",
                        onclick: () =>
                            copyText(
                                youtubeUrl,
                                "คัดลอกลิงก์วิดีโอแล้ว ✓"
                            )
                    }),
                    h("a", {
                        class: "btn btn-ghost btn-sm",
                        href:
                            `https://www.youtube.com/watch?v=${youtubeId}`,
                        target: "_blank",
                        rel: "noopener noreferrer",
                        text: "เปิดใน YouTube ↗"
                    })
                )
            )
        );
    }

    if (String(script).trim()) {
        sections.push(
            h(
                "section",
                {},
                h("div", {
                    class: "section-label",
                    text: "สคริป"
                }),
                h(
                    "div",
                    { class: "code" },
                    h(
                        "div",
                        { class: "code-head" },
                        h("span", {
                            class: "code-lang",
                            text: "SCRIPT"
                        }),
                        h("button", {
                            class: "btn btn-primary btn-sm",
                            text: "คัดลอกสคริป",
                            type: "button",
                            onclick: () =>
                                copyText(
                                    script,
                                    "คัดลอกสคริปแล้ว ✓"
                                )
                        })
                    ),
                    h(
                        "pre",
                        {},
                        h("code", {
                            text: script
                        })
                    )
                )
            )
        );
    }

    if (!youtubeId && !String(script).trim()) {
        sections.push(
            h("div", {
                class: "empty-note",
                text:
                    "รายการนี้ยังไม่มีวิดีโอหรือสคริป"
            })
        );
    }

    const body = $("detail-body");

    body.replaceChildren(...sections);

    $("detail-bar-title").textContent = name;

    detailView.hidden = false;
    detailView.scrollTop = 0;

    document.body.classList.add("noscroll");
}

function closeDetail() {
    if (
        detailView.hidden &&
        openId === null
    ) {
        return;
    }

    detailView.hidden = true;
    $("detail-body").replaceChildren();

    openId = null;

    document.body.classList.remove("noscroll");
}

$("btn-detail-back").addEventListener("click", () => {
    if (cameFromList) {
        cameFromList = false;

        if (history.length > 1) {
            history.back();
        } else {
            history.replaceState(
                null,
                "",
                location.pathname + location.search
            );
            route();
        }
    } else {
        history.replaceState(
            null,
            "",
            location.pathname + location.search
        );

        route();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;

    if ($("login-modal").classList.contains("open")) {
        $("login-modal").classList.remove("open");
        return;
    }

    if (!detailView.hidden) {
        $("btn-detail-back").click();
    }
});

$("btn-show-login").addEventListener("click", () => {
    $("login-modal").classList.add("open");
});

$("btn-close-login").addEventListener("click", () => {
    $("login-modal").classList.remove("open");
});

$("btn-google-login").addEventListener(
    "click",
    loginWithGoogle
);

$("btn-admin-panel").addEventListener("click", () => {
    if (!isAdmin) return;

    const form = $("admin-form-container");

    form.hidden = !form.hidden;
});

$("btn-logout").addEventListener(
    "click",
    logoutAdmin
);

$("login-modal").addEventListener("click", (event) => {
    if (event.target === $("login-modal")) {
        $("login-modal").classList.remove("open");
    }
});

const fileInput = $("input-cover-file");
const urlInput = $("input-cover-url");
const previewBox = $("cover-preview");
const coverInfo = $("cover-info");

function setPreview(src) {
    previewBox.replaceChildren();

    if (!src) {
        previewBox.textContent = "ยังไม่มีรูป";
        return;
    }

    const img = h("img", {
        src,
        alt: "ตัวอย่างรูปปก"
    });

    previewBox.append(img);
}

function setCoverInfo(message, type = "") {
    coverInfo.textContent = message || "";
    coverInfo.className =
        "hint cover-info" +
        (type ? ` ${type}` : "");
}

async function compressCover(file) {
    if (!file || !file.type.startsWith("image/")) {
        throw new Error("ไฟล์ไม่ใช่รูปภาพ");
    }

    const objectUrl = URL.createObjectURL(file);

    try {
        const image = await loadImage(objectUrl);

        const targetWidth = CONFIG.COVER.W;
        const targetHeight = CONFIG.COVER.H;
        const targetRatio =
            targetWidth / targetHeight;

        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        const sourceRatio =
            sourceWidth / sourceHeight;

        let cropWidth;
        let cropHeight;

        if (sourceRatio > targetRatio) {
            cropHeight = sourceHeight;
            cropWidth =
                sourceHeight * targetRatio;
        } else {
            cropWidth = sourceWidth;
            cropHeight =
                sourceWidth / targetRatio;
        }

        const sourceX =
            (sourceWidth - cropWidth) / 2;

        const sourceY =
            (sourceHeight - cropHeight) / 2;

        const canvas =
            document.createElement("canvas");

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const context =
            canvas.getContext("2d");

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        context.drawImage(
            image,
            sourceX,
            sourceY,
            cropWidth,
            cropHeight,
            0,
            0,
            targetWidth,
            targetHeight
        );

        const blob = await new Promise(
            (resolve, reject) => {
                canvas.toBlob(
                    (result) => {
                        if (result) {
                            resolve(result);
                        } else {
                            reject(
                                new Error(
                                    "สร้าง WebP ไม่สำเร็จ"
                                )
                            );
                        }
                    },
                    "image/webp",
                    CONFIG.COVER.QUALITY
                );
            }
        );

        return {
            blob,
            sourceWidth,
            sourceHeight
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

fileInput.addEventListener(
    "change",
    async () => {
        const file = fileInput.files?.[0];

        if (!file) return;

        coverFile = null;
        urlInput.value = "";

        setCoverInfo("กำลังบีบอัดรูป...");

        try {
            const result =
                await compressCover(file);

            coverFile = {
                blob: result.blob,
                original: file
            };

            const ratio =
                result.sourceWidth /
                result.sourceHeight;

            const ratioIs16x9 =
                Math.abs(
                    ratio - 16 / 9
                ) <= 0.02;

            setPreview(
                URL.createObjectURL(
                    result.blob
                )
            );

            setCoverInfo(
                `${result.sourceWidth}×${result.sourceHeight} px (${fmtBytes(file.size)}) → ${CONFIG.COVER.W}×${CONFIG.COVER.H} WebP (${fmtBytes(result.blob.size)})` +
                    (
                        ratioIs16x9
                            ? ""
                            : " · ระบบครอปตรงกลางเป็น 16:9"
                    ),
                ratioIs16x9
                    ? "ok"
                    : "warn"
            );
        } catch (error) {
            console.error(error);

            coverFile = null;
            fileInput.value = "";
            setPreview("");
            setCoverInfo(
                "ประมวลผลรูปไม่สำเร็จ",
                "bad"
            );
        }
    }
);

urlInput.addEventListener(
    "change",
    async () => {
        const url =
            urlInput.value.trim();

        if (!url) {
            coverFile = null;
            setPreview("");
            setCoverInfo("");
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            coverFile = null;
            setPreview("");
            setCoverInfo(
                "ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://",
                "bad"
            );
            return;
        }

        fileInput.value = "";
        coverFile = null;

        setCoverInfo(
            "กำลังตรวจสอบรูป..."
        );

        try {
            const image =
                await loadImage(url);

            setPreview(url);

            const ratio =
                image.naturalWidth /
                image.naturalHeight;

            const is16x9 =
                Math.abs(
                    ratio - 16 / 9
                ) <= 0.02;

            setCoverInfo(
                `${image.naturalWidth}×${image.naturalHeight} px · ใช้ลิงก์รูปโดยตรง` +
                    (
                        is16x9
                            ? ""
                            : " · แนะนำรูป 16:9"
                    ),
                is16x9
                    ? "ok"
                    : "warn"
            );
        } catch (error) {
            console.error(error);

            urlInput.value = "";
            setPreview("");
            setCoverInfo(
                "โหลดรูปจากลิงก์นี้ไม่ได้",
                "bad"
            );
        }
    }
);

function resetAdminForm() {
    $("input-name").value = "";
    $("input-creator").value = "";
    $("input-yt-link").value = "";
    $("input-script").value = "";

    fileInput.value = "";
    urlInput.value = "";

    coverFile = null;

    setPreview("");
    setCoverInfo("");
}

async function uploadCover(blob) {
    if (!blob) return "";

    const client = getDb();

    const fileName =
        `${crypto.randomUUID()}.webp`;

    const path =
        `covers/${fileName}`;

    const { error } =
        await client.storage
            .from(CONFIG.STORAGE_BUCKET)
            .upload(path, blob, {
                contentType: "image/webp",
                cacheControl: "31536000",
                upsert: false
            });

    if (error) throw error;

    const {
        data: publicData
    } = client.storage
        .from(CONFIG.STORAGE_BUCKET)
        .getPublicUrl(path);

    return publicData.publicUrl;
}

async function deleteStorageCover(url) {
    if (!url) return;

    try {
        const marker =
            `/storage/v1/object/public/${CONFIG.STORAGE_BUCKET}/`;

        const index =
            String(url).indexOf(marker);

        if (index === -1) return;

        const path =
            String(url).slice(
                index + marker.length
            );

        if (!path) return;

        await getDb()
            .storage
            .from(CONFIG.STORAGE_BUCKET)
            .remove([path]);
    } catch (error) {
        console.warn(
            "Storage delete failed:",
            error
        );
    }
}

$("btn-add-box").addEventListener(
    "click",
    async () => {
        if (!isAdmin) {
            toast(
                "ไม่มีสิทธิ์ Admin",
                true
            );
            return;
        }

        const name =
            $("input-name").value.trim();

        const creator =
            $("input-creator").value.trim();

        const youtube =
            $("input-yt-link").value.trim();

        const script =
            $("input-script")
                .value
                .replace(/\r\n/g, "\n");

        const coverUrl =
            urlInput.value.trim();

        if (!name || !creator) {
            toast(
                "กรุณากรอกชื่อและชื่อผู้สร้าง",
                true
            );
            return;
        }

        if (
            youtube &&
            !extractYoutubeId(youtube)
        ) {
            toast(
                "ลิงก์ YouTube ไม่ถูกต้อง",
                true
            );
            return;
        }

        if (
            coverUrl &&
            !/^https?:\/\//i.test(
                coverUrl
            )
        ) {
            toast(
                "ลิงก์รูปไม่ถูกต้อง",
                true
            );
            return;
        }

        const button =
            $("btn-add-box");

        const originalText =
            button.textContent;

        button.disabled = true;
        button.textContent =
            "กำลังบันทึก...";

        try {
            let finalCover = coverUrl;

            if (coverFile?.blob) {
                button.textContent =
                    "กำลังอัปโหลดรูป...";

                finalCover =
                    await uploadCover(
                        coverFile.blob
                    );
            }

            button.textContent =
                "กำลังสร้าง Box...";

            const payload = {
                [COL.name]: name,
                [COL.creator]: creator,
                [COL.url]: youtube,
                [COL.script]:
                    script.trim()
                        ? script
                        : "",
                [COL.cover]:
                    finalCover || ""
            };

            const {
                error
            } = await getDb()
                .from(CONFIG.TABLE)
                .insert([payload]);

            if (error) throw error;

            resetAdminForm();

            query = "";
            searchInput.value = "";
            searchClear.hidden = true;

            sortDesc = true;
            currentPage = 1;

            $("sort-label").textContent =
                "ใหม่ → เก่า";

            await fetchBoxes();

            toast(
                "สร้าง Box เรียบร้อย ✓"
            );
        } catch (error) {
            console.error(error);

            toast(
                "บันทึกไม่สำเร็จ: " +
                    (
                        error?.message ||
                        error
                    ),
                true
            );
        } finally {
            button.disabled = false;
            button.textContent =
                originalText;
        }
    }
);

async function deleteBox(box) {
    if (!isAdmin) {
        toast(
            "ไม่มีสิทธิ์ Admin",
            true
        );
        return;
    }

    const name =
        box[COL.name] ||
        "Box นี้";

    const confirmed =
        window.confirm(
            `ต้องการลบ "${name}" ใช่หรือไม่?\n\nข้อมูล Box จะถูกลบออกจากฐานข้อมูล`
        );

    if (!confirmed) return;

    try {
        const id = getBoxId(box);

        if (
            id === undefined ||
            id === null
        ) {
            throw new Error(
                "ไม่พบ ID ของ Box"
            );
        }

        const {
            error
        } = await getDb()
            .from(CONFIG.TABLE)
            .delete()
            .eq("id", id);

        if (error) throw error;

        await deleteStorageCover(
            box[COL.cover]
        );

        toast(
            "ลบ Box เรียบร้อย ✓"
        );

        if (
            String(openId) ===
            String(id)
        ) {
            history.replaceState(
                null,
                "",
                location.pathname +
                    location.search
            );

            closeDetail();
        }

        await fetchBoxes();
    } catch (error) {
        console.error(error);

        toast(
            "ลบ Box ไม่สำเร็จ: " +
                (
                    error?.message ||
                    error
                ),
            true
        );
    }
}

document.addEventListener(
    "DOMContentLoaded",
    async () => {
        try {
            await initAuth();
        } catch (error) {
            console.error(error);
            toast(
                "เริ่มระบบ Admin ไม่สำเร็จ",
                true
            );
        }

        if (
            getCurrentHashId() !== null
        ) {
            statusText.textContent =
                "กรุณาเปิดลิงก์ภายนอกเพื่อปลดล็อก Box นี้";
        }
    }
);