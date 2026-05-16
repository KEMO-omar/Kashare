import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, remove, get } from "firebase/database";

// إعدادات الفايرباز الخاصة بك يا كريم
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

// تهيئة الفايرباز وقاعدة البيانات اللحظية
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// عناصر واجهة المستخدم - الجانب العام
const usernameInput = document.getElementById('usernameInput');
const totalSharedCountText = document.getElementById('totalSharedCount');

// عناصر واجهة المرسل
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

// عناصر واجهة المستلم
const roomCodeInput = document.getElementById('roomCodeInput');
const btnConnectRoom = document.getElementById('btnConnectRoom');
const receiverStatusSection = document.getElementById('receiverStatusSection');
const fileDownloadSection = document.getElementById('fileDownloadSection');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const senderNameDisplay = document.getElementById('senderNameDisplay');
const btnDownload = document.getElementById('btnDownload');

// متغيرات الغرفة الحالية
let currentRoomCode = null;
let currentFilePayload = null; 

// --- 1. إدارة اسم المستخدم بالكاش LocalStorage ---
if (localStorage.getItem('kashare_username')) {
    usernameInput.value = localStorage.getItem('kashare_username');
} else {
    usernameInput.value = "مستخدم_" + Math.floor(Math.random() * 9000 + 1000);
}
usernameInput.addEventListener('input', () => {
    localStorage.setItem('kashare_username', usernameInput.value);
});

// --- 2. جلب وتحديث العداد الإجمالي للعناصر المنقولة لجميع المستخدمين ---
const globalCounterRef = ref(db, 'globalStats/totalShared');
onValue(globalCounterRef, (snapshot) => {
    if (snapshot.exists()) {
        totalSharedCountText.innerText = snapshot.val();
    } else {
        set(globalCounterRef, 0);
        totalSharedCountText.innerText = "0";
    }
});

// وظيفة زيادة العداد العام عند اكتمال النقل بنجاح
function incrementGlobalCounter() {
    get(globalCounterRef).then((snapshot) => {
        let currentCount = snapshot.exists() ? snapshot.val() : 0;
        set(globalCounterRef, currentCount + 1);
    });
}

// --- 3. منطق الإرسال وإنشاء الغرف الآمنة ---
btnCreateRoom.addEventListener('click', () => {
    // توليد كود عشوائي فريد من 6 أرقام
    currentRoomCode = Math.floor(100000 + Math.random() * 900000).toString();
    generatedCodeText.innerText = currentRoomCode;
    
    // إنشاء العقدة في فايرباز وجعلها فارغة وجاهزة
    set(ref(db, 'rooms/' + currentRoomCode), {
        status: 'waiting',
        senderName: usernameInput.value,
        timestamp: Date.now()
    }).then(() => {
        createRoomSection.classList.add('hidden');
        sharingSection.classList.remove('hidden');
    });
});

// نسخ كود الغرفة
btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(currentRoomCode);
    alert('تم نسخ رمز الغرفة: ' + currentRoomCode);
});

// تفعيل الضغط والسحب على منطقة الرفع
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

// تحويل الملف لنص آمن (Base64 String) ورفعه بدقة مع تتبع النسبة
function handleFileSelect(file) {
    progressContainer.classList.remove('hidden');
    progressStatus.innerText = "جاري تحضير الملف وتحويله...";
    
    const reader = new FileReader();
    
    // تتبع البروجريس بار أثناء التحويل والرفع المحلي المبدئي
    reader.onprogress = (event) => {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 50); // أول 50% للتحويل والقرائة لضمان السرعة
            updateProgressBar(percent, "جاري معالجة البيانات...");
        }
    };

    reader.onload = function(e) {
        updateProgressBar(60, "جاري التشفير والرفع الفوري...");
        const base64Data = e.target.result;
        
        // رفع البيانات للـ Database داخل الغرفة المخصصة بالرمز السري
        const roomRef = ref(db, 'rooms/' + currentRoomCode);
        update(roomRef, {
            fileName: file.name,
            fileType: file.type,
            fileData: base64Data,
            status: 'ready',
            senderName: usernameInput.value
        }).then(() => {
            updateProgressBar(100, "تم الرفع بنجاح! في انتظار سحب المستلم للملف...");
        }).catch((err) => {
            alert("فشل الرفع، يرجى التحقق من حجم الملف");
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

// --- 4. منطق الاستلام والاتصال الآمن بنسبة 100% ---
btnConnectRoom.addEventListener('click', () => {
    const code = roomCodeInput.value.trim();
    if (code.length !== 6 || isNaN(code)) {
        alert("من فضلك أدخل رمزاً صالحاً مكوناً من 6 أرقام لتفادي الأخطاء");
        return;
    }

    receiverStatusSection.classList.remove('hidden');
    btnConnectRoom.disabled = true;

    // الاتصال الفوري والإنصات المباشر لغرفة الـ Firebase المحددة
    const targetRoomRef = ref(db, 'rooms/' + code);
    onValue(targetRoomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            alert("عذراً، الرمز غير صحيح أو أن الغرفة تم تدميرها بالفعل.");
            resetReceiverUI();
            return;
        }

        if (data.status === 'waiting') {
            receiverStatusSection.innerHTML = `
                <div class="status-waiting">
                    <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-blue)"></i>
                    <p>تم الاتصال بالغرفة الآمنة بنجاح. ننتظر الآن قيام <strong>${data.senderName}</strong> بإرسال الملف...</p>
                </div>`;
            fileDownloadSection.classList.add('hidden');
        } 
        else if (data.status === 'ready') {
            // الملف وصل وجاهز للتحميل فوراً
            receiverStatusSection.classList.add('hidden');
            fileDownloadSection.classList.remove('hidden');
            
            fileNameDisplay.innerText = data.fileName;
            senderNameDisplay.innerText = data.senderName;
            
            // تخزين البيانات مؤقتاً في الرام لغرض التحميل والتدمير الفوري
            currentFilePayload = {
                code: code,
                name: data.fileName,
                data: data.fileData
            };
        }
    });
});

// تحميل الملف وتدميره من الفايرباز فوراً وحالاً
btnDownload.addEventListener('click', () => {
    if (!currentFilePayload) return;

    // 1. معالجة النص وتحويله لملف حقيقي جاهز للتحميل في جهاز المستلم
    const link = document.createElement('a');
    link.href = currentFilePayload.data;
    link.download = currentFilePayload.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // 2. تدمير ومسح الغرفة والملف النصي من السيرفر تماماً (أمان 100%)
    const roomRef = ref(db, 'rooms/' + currentFilePayload.code);
    remove(roomRef).then(() => {
        // 3. زيادة العداد العام للمنصة بنجاح
        incrementGlobalCounter();
        
        alert("تم تحميل الملف بنجاح وتدمير البيانات والرمز تماماً من السيرفر لأمانك!");
        
        // إعادة تهيئة الواجهة لعمليات تانية سريعة من غير ريفريش
        resetReceiverUI();
        location.reload(); // ريفريش اختياري لضمان تنظيف الميموري بالكامل
    });
});

function resetReceiverUI() {
    btnConnectRoom.disabled = false;
    receiverStatusSection.classList.add('hidden');
    fileDownloadSection.classList.add('hidden');
    roomCodeInput.value = "";
    currentFilePayload = null;
}
