// ตั้งค่าตัวเชื่อมโยงไปยังฐานข้อมูล Supabase ของคุณ
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GO_cBCqm82xZ3pSF5gU4pw_Ya8EDgPa";

// เริ่มต้นใช้งาน Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let hasOpenedTab = false;
let countdownTimer = null;
let isAdmin = false;
let boxes = []; 

// --- ระบบปลดล็อกเมื่อเปิดแท็บใหม่และสลับกลับมาหน้าเว็บ ---
const unlockScreen = document.getElementById('unlock-screen');
const mainScreen = document.getElementById('main-screen');
const btnOpenTab = document.getElementById('btn-open-tab');
const btnUnlock = document.getElementById('btn-unlock');
const statusText = document.getElementById('status-text');

// เมื่อกดปุ่มที่ 1 ให้เด้งไปลิงก์ Discord ทันที
btnOpenTab.addEventListener('click', () => {
    window.open('https://discord.gg/Hvyf8crug', '_blank'); 
    hasOpenedTab = true;
    statusText.innerText = "กรุณากลับมาที่หน้านี้เพื่อเริ่มนับเวลา 5 วินาที";
});

// ตรวจจับเมื่อผู้ใช้สลับหน้าจอกลับมาที่เว็บเรา
window.addEventListener('focus', () => {
    // ถ้าผู้ใช้เคยกดปุ่มเปิดลิงก์แล้ว และตัวนับเวลายังไม่ทำงาน ให้เริ่มนับถอยหลัง
    if (hasOpenedTab && !countdownTimer) {
        let timeLeft = 5;
        
        // อัปเดตข้อความปุ่มแรกทันทีเมื่อกลับเข้ามา
        btnOpenTab.innerText = `รอ (${timeLeft}) วิ`;
        btnOpenTab.setAttribute('disabled', 'true'); // ล็อกปุ่มแรกไว้ไม่ให้กดซ้ำ
        btnOpenTab.className = "btn btn-gray"; // เปลี่ยนปุ่มแรกเป็นสีเทาชั่วคราว
        
        countdownTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                btnOpenTab.innerText = `รอ (${timeLeft}) วิ`;
            } else {
                clearInterval(countdownTimer);
                btnOpenTab.innerText = "1. เปิดลิงก์ภายนอกสำเร็จ";
                statusText.innerText = "ระบบตรวจสอบเสร็จสิ้น! สามารถกดปลดล็อกได้แล้ว";
                
                // เปลี่ยนปุ่มปลดล็อก (ปุ่มที่ 2) เป็นสีเขียวและเปิดใช้งาน
                btnUnlock.removeAttribute('disabled');
                btnUnlock.className = "btn btn-green";
            }
        }, 1000);
    }
});

// กดปุ่มปลดล็อกเพื่อเข้าหน้าหลัก
btnUnlock.addEventListener('click', () => {
    unlockScreen.classList.remove('active');
    mainScreen.classList.add('active');
    fetchBoxesFromSupabase(); // เรียกโหลดข้อมูลจาก Cloud เมื่อผ่านเข้าสู่หน้าหลัก
});


// --- ฟังก์ชันดึงข้อมูลจาก Cloud Supabase ---
async function fetchBoxesFromSupabase() {
    const container = document.getElementById('box-container');
    container.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">กำลังโหลดข้อมูลจากฐานข้อมูลออนไลน์...</p>';

    const { data, error } = await supabase
        .from('youtube_boxes')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error fetching data:', error);
        container.innerHTML = '<p style="color:red; text-align:center;">ไม่สามารถเชื่อมต่อ Cloud ได้ กรุณาเช็ค ANON KEY ในสคริปต์</p>';
        return;
    }

    boxes = data;
    renderBoxes();
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match.length === 11) ? match : null;
}

function renderBoxes() {
    const container = document.getElementById('box-container');
    container.innerHTML = ''; 

    if (boxes.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#888;">ยังไม่มีกล่องวิดีโอถูกสร้างขึ้น</p>';
        return;
    }

    boxes.forEach((box) => {
        const boxDiv = document.createElement('div');
        boxDiv.className = 'video-box';

        const ytId = extractYoutubeId(box.ytU);
        const embedUrl = ytId ? `https://youtube.com{ytId}` : box.ytUrl;

        boxDiv.innerHTML = `
            <h4>ชื่อ: ${box.nan || 'ไม่มีชื่อ'}</h4>
            <p><strong>ผู้สร้าง:</strong> ${box.cre || 'ไม่ระบุ'}</p>
            <div class="video-container">
                <iframe src="${embedUrl}" frameborder="0" allowfullscreen></iframe>
            </div>
            <button class="btn btn-blue btn-sm" onclick="copyText('${box.ytU}')">Copy Link</button>
        `;
        container.appendChild(boxDiv);
    });
}

window.copyText = function(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert("คัดลอกลิงก์สำเร็จแล้ว!");
    }).catch(err => {
        alert("ไม่สามารถคัดลอกได้อัตโนมัติ: " + err);
    });
};


// --- ระบบ Admin Login ("Aten" / "Aten67678*") ---
const loginModal = document.getElementById('login-modal');
const btnShowLogin = document.getElementById('btn-show-login');
const btnCloseLogin = document.getElementById('btn-close-login');
const btnSubmitLogin = document.getElementById('btn-submit-login');
const adminFormContainer = document.getElementById('admin-form-container');
const btnAdminPanel = document.getElementById('btn-admin-panel');
const btnLogout = document.getElementById('btn-logout');

btnShowLogin.addEventListener('click', () => loginModal.classList.add('open'));
btnCloseLogin.addEventListener('click', () => loginModal.classList.remove('open'));

btnSubmitLogin.addEventListener('click', () => {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;

    if (user === "Aten" && pass === "Aten67678*") {
        isAdmin = true;
        alert("เข้าสู่ระบบแอดมินสำเร็จ!");
        loginModal.classList.remove('open');
        
        btnShowLogin.style.display = 'none';
        btnAdminPanel.style.display = 'inline-block';
        btnLogout.style.display = 'inline-block';
        adminFormContainer.style.display = 'block';
    } else {
        alert("รหัสผ่านไม่ถูกต้อง!");
    }
});

btnAdminPanel.addEventListener('click', () => {
    adminFormContainer.style.display = adminFormContainer.style.display === 'none' ? 'block' : 'none';
});

btnLogout.addEventListener('click', () => {
    isAdmin = false;
    btnShowLogin.style.display = 'inline-block';
    btnAdminPanel.style.display = 'none';
    btnLogout.style.display = 'none';
    adminFormContainer.style.display = 'none';
    alert("ออกจากระบบแอดมินแล้ว");
});


// --- ระบบแอดมินส่งข้อมูลบันทึกลงฐานข้อมูลออนไลน์ Supabase ---
document.getElementById('btn-add-box').addEventListener('click', async () => {
    if (!isAdmin) return;

    const nameValue = document.getElementById('input-name').value;
    const creatorValue = document.getElementById('input-creator').value;
    const ytUrlValue = document.getElementById('input-yt-link').value;

    if (!nameValue || !creatorValue || !ytUrlValue) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    const { error } = await supabase
        .from('youtube_boxes')
        .insert([{ nan: nameValue, cre: creatorValue, ytU: ytUrlValue }]);

    if (error) {
        console.error('Error inserting data:', error);
        alert('เกิดข้อผิดพลาดในการเซฟข้อมูลลง Cloud เช็คการตั้งค่า RLS ในตารางอีกครั้ง');
        return;
    }

    document.getElementById('input-name').value = '';
    document.getElementById('input-creator').value = '';
    document.getElementById('input-yt-link').value = '';

    fetchBoxesFromSupabase();
    alert("สร้างกล่องและแชร์ให้ทุกคนเห็นบนหน้าเว็บเรียบร้อย!");
});
