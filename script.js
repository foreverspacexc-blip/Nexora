// ตั้งค่าตัวเชื่อมโยงไปยังฐานข้อมูล Supabase ของคุณ
const SUPABASE_URL = "https://ysliushmitzoyahakeow.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_GO_cBCqm82xZ3pSF5gU4pw_Ya8EDgPa";

// เริ่มต้นใช้งาน Supabase Client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let hasOpenedTab = false;
let countdownTimer = null;
let isAdmin = false;
let boxes = []; 

const unlockScreen = document.getElementById('unlock-screen');
const mainScreen = document.getElementById('main-screen');
const btnOpenTab = document.getElementById('btn-open-tab');
const btnUnlock = document.getElementById('btn-unlock');
const statusText = document.getElementById('status-text');

btnOpenTab.addEventListener('click', () => {
    window.open('https://google.com', '_blank'); // สามารถเปลี่ยนลิงก์ภายนอกที่คุณต้องการให้กดได้ที่นี่
    hasOpenedTab = true;
    statusText.innerText = "กรุณากลับมาที่หน้านี้เพื่อเริ่มนับเวลา 5 วินาที";
});

window.addEventListener('focus', () => {
    if (hasOpenedTab && !countdownTimer) {
        let timeLeft = 5;
        statusText.innerText = `กำลังตรวจสอบการเข้าชม... กรุณารอ ${timeLeft} วินาที`;
        
        countdownTimer = setInterval(() => {
            timeLeft--;
            if (timeLeft > 0) {
                statusText.innerText = `กำลังตรวจสอบการเข้าชม... กรุณารอ ${timeLeft} วินาที`;
            } else {
                clearInterval(countdownTimer);
                statusText.innerText = "ระบบตรวจสอบเสร็จสิ้น! สามารถกดปลดล็อกได้แล้ว";
                btnUnlock.removeAttribute('disabled');
                btnUnlock.className = "btn btn-green";
            }
        }, 1000);
    }
});

btnUnlock.addEventListener('click', () => {
    unlockScreen.classList.remove('active');
    mainScreen.classList.add('active');
    fetchBoxesFromSupabase(); // เรียกโหลดข้อมูลจาก Cloud เมื่อผ่านเข้าสู่หน้าหลัก
});


// --- ฟังก์ชันดึงข้อมูลจาก Cloud Supabase ---
async function fetchBoxesFromSupabase() {
    const container = document.getElementById('box-container');
    container.innerHTML = '<p style="grid-column: 1/-1; text-align:center;">กำลังโหลดข้อมูลจากฐานข้อมูลออนไลน์...</p>';

    // เรียกดึงข้อมูลจากตาราง youtube_boxes โดยเรียงลำดับตาม ID
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

// ฟังก์ชันแกะไอดีจากลิงก์ YouTube เพื่อนำมาเล่นแบบฝังตัวบนหน้าเว็บ (Embed)
function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match.length === 11) ? match[2] : null;
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

        // แมปชื่อตัวแปรให้ตรงกับหัวข้อคอลัมน์ใน Supabase ของคุณ (nan, cre, ytU)
        const ytId = extractYoutubeId(box.ytU);
        const embedUrl = ytId ? `https://youtube.com{ytId}` : box.ytU;

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

// ฟังก์ชันคัดลอกลิงก์เมื่อผู้ใช้กดปุ่ม
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

    // ยิงชุดข้อมูลแมปเข้าคอลัมน์ nan, cre, ytU ของคุณบน Cloud
    const { error } = await supabase
        .from('youtube_boxes')
        .insert([{ nan: nameValue, cre: creatorValue, ytU: ytUrlValue }]);

    if (error) {
        console.error('Error inserting data:', error);
        alert('เกิดข้อผิดพลาดในการเซฟข้อมูลลง Cloud เช็คการตั้งค่า RLS ในตารางอีกครั้ง');
        return;
    }

    // ล้างค่าในช่องกรอกข้อมูลเก่า
    document.getElementById('input-name').value = '';
    document.getElementById('input-creator').value = '';
    document.getElementById('input-yt-link').value = '';

    // โหลดหน้าข้อมูลใหม่เพื่อรีเฟรชกล่องล่าสุด
    fetchBoxesFromSupabase();
    alert("สร้างกล่องและแชร์ให้ทุกคนเห็นบนหน้าเว็บเรียบร้อย!");
});