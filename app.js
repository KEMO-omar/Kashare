// الكود اللي أنت بعتهولي بالظبط لتهيئة الفايرباز
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, set, onValue, remove, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCSgvi4tyeoQKSw-o8SZ_oFms0zfjgR6kU",
  authDomain: "alhady.firebaseapp.com",
  databaseURL: "https://alhady-default-rtdb.firebaseio.com",
  projectId: "alhady",
  storageBucket: "alhady.firebasestorage.app",
  messagingSenderId: "839424225673",
  appId: "1:839424225673:web:4b68a4ad74e5a2526bf158",
  measurementId: "G-5GE3K43796"
};

// تهيئة التطبيق والتحليلات بناءً على كودك
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// ربط قاعدة البيانات اللحظية بمشروع alhady
const db = getDatabase(app);

// --- باقي عناصر الواجهة والتحكم لـ KaShare ---
const usernameInput = document.getElementById('usernameInput');
const totalSharedCountText = document.getElementById('totalSharedCount');

const btnCreateRoom = document.getElementById('btnCreateRoom');
const createRoomSection = document.getElementById('createRoomSection');
const sharingSection = document.getElementById('sharingSection');
const generatedCodeText = document.getElementById('generatedCode');
const btnCopyCode = document.getElementById('btnCopyCode');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressPercent = document.getElementById('progressPercent');
const progressStatus = document.getElementById('progressStatus');

const roomCodeInput = document.getElementById('roomCodeInput');
const btnConnectRoom = document.getElementById('btnConnectRoom');
const receiverStatusSection = document.getElementById('receiverStatusSection');
const fileDownloadSection = document.getElementById('fileDownloadSection');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const senderNameDisplay = document.getElementById('senderNameDisplay');
const btnDownload = document.getElementById('btnDownload');

let currentRoomCode = null;
let currentFilePayload = null; 

// 1. كاش اسم المستخدم
if (localStorage.getItem('kashare_username')) {
    usernameInput.value = localStorage.getItem('kashare_username');
} else {
    usernameInput.value = "مستخدم_" + Math.floor(Math.random() * 9000 + 1000);
}
usernameInput.addEventListener('input', () => {
    localStorage.setItem('kashare_username', usernameInput.value);
});

// 2. عداد العناصر المنقولة من الفايرباز
const globalCounterRef = ref(db, 'globalStats/totalShared');
onValue(globalCounterRef, (snapshot) => {
    if (snapshot.exists()) {
        totalSharedCountText.innerText = snapshot.val();
    } else {
        set(globalCounterRef, 0);
        totalSharedCountText.innerText = "0";
    }
});

function incrementGlobalCounter() {
    get(globalCounterRef).then((snapshot) => {
        let currentCount = snapshot.exists() ? snapshot.val() : 0;
        set(globalCounterRef, currentCount + 1);
    });
}

// 3. إنشاء الغرفة وتوليد الرمز
btnCreateRoom.addEventListener('click', () => {
    currentRoomCode = Math.floor(100000 + Math.random() * 900000).toString();
    generatedCodeText.innerText = currentRoomCode;
    
    createRoomSection.classList.add('hidden');
    sharingSection.classList.remove('hidden');

    const roomRef = ref(db, 'rooms/' + currentRoomCode);
    set(roomRef, {
        status: 'waiting',
        senderName: usernameInput.value,
        timestamp: Date.now(),
        fileName: "",
        fileData: "",
        fileType: ""
    }).catch((err) => {
        console.error("Firebase Error: ", err);
        alert("تأكد من إعدادات الـ Rules في سرفر alhady");
    });
});

btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    alert('تم نسخ رمز الغرفة: ' + currentRoomCode);
});

// 4. معالجة السحب والرفع وتحويل الملف لنص
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    progressContainer.classList.remove('hidden');
    updateProgressBar(10, "جاري تحضير الملف...");
    
    const reader = new FileReader();
    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 40) + 10;
            updateProgressBar(percent, "جاري معالجة البيانات...");
        }
    };

    reader.onload = function(e) {
        updateProgressBar(60, "جاري التشفير والرفع...");
        const base64Data = e.target.result;
        
        const roomRef = ref(db, 'rooms/' + currentRoomCode);
        set(roomRef, {
            fileName: file.name,
            fileType: file.type,
            fileData: base64Data,
            status: 'ready',
            senderName: usernameInput.value,
            timestamp: Date.now()
        }).then(() => {
            updateProgressBar(100, "تم الرفع! في انتظار الطرف الآخر...");
        }).catch((err) => {
            alert("فشل الرفع، تأكد من حجم الملف");
            progressContainer.classList.add('hidden');
        });
    };
    reader.readAsDataURL(file);
}

function updateProgressBar(percent, statusText) {
    progressFill.style.width = percent + '%';
    progressPercent.innerText = percent + '%';
    progressStatus.innerText = statusText;
}

// 5. الاستلام الآمن والتحميل الفوري ثم الحذف
btnConnectRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (code.length !== 6 || isNaN(code)) {
        alert("أدخل رمزاً صالحاً مكوناً من 6 أرقام");
        return;
    }

    receiverStatusSection.classList.remove('hidden');
    btnConnectRoom.disabled = true;

    const targetRoomRef = ref(db, 'rooms/' + code);
    onValue(targetRoomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert("الرمز غير صحيح أو تم تدمير الغرفة مسبقاً.");
            resetReceiverUI();
            return;
        }

        if (data.status === 'waiting') {
            receiverStatusSection.innerHTML = `
                <div class="status-waiting">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-blue)"></i>
                    <p>متصل.. ننتظر قيام <strong>${data.senderName}</strong> برفع الملف...</p>
                </div>`;
            fileDownloadSection.classList.add('hidden');
        } 
        else if (data.status === 'ready') {
            receiverStatusSection.classList.add('hidden');
            fileDownloadSection.classList.remove('hidden');
            
            fileNameDisplay.innerText = data.fileName;
            senderNameDisplay.innerText = data.senderName;
            
            currentFilePayload = {
                code: code,
                name: data.fileName,
                data: data.fileData
            };
        }
    });
});

btnDownload.addEventListener('click', () => {
    if (!currentFilePayload) return;

    const link = document.createElement('a');
    link.href = currentFilePayload.data;
    link.download = currentFilePayload.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // تدمير البيانات تماماً فور التنزيل
    const roomRef = ref(db, 'rooms/' + currentFilePayload.code);
    remove(roomRef).then(() => {
        incrementGlobalCounter();
        alert("تم التحميل بنجاح وتم حذف الملف نهائياً من السيرفر!");
        resetReceiverUI();
    });
});

function resetReceiverUI() {
    btnConnectRoom.disabled = false;
    receiverStatusSection.classList.add('hidden');
    fileDownloadSection.classList.add('hidden');
    roomCodeInput.value = "";
    currentFilePayload = null;
}
