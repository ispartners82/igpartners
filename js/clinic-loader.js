import { db } from "./firebase-db.js?v=2.0.7";
// [성능 최적화] 병원 목록은 관리자가 수정할 때만 변경되므로 실시간 리스너(onSnapshot) 대신
// getDocs 일회성 조회를 사용하여 불필요한 Firestore 연결 유지와 비용을 제거합니다.
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * UI 정적 문자열 및 오류 알림을 관리하기 위한 다국어(I18n) 사전 정의
 */
const i18n = {
  // 한국어 번역 리소스
  ko: {
    loading: "병원 목록을 불러오는 중입니다...",
    empty: "등록된 병원이 없습니다.",
    selectBtn: "지금 예약하기",
    loginRequired: "예약을 진행하려면 먼저 로그인해 주세요.",
    pageTitle: "병원 선택",
    pageSubtitle: "진료 예약을 진행할 병원을 선택해 주세요.",
    changeLang: "언어 변경", /* 신규 추가: 언어선택 복원용 텍스트 */
    modalTitle: "🔒 로그인 필요",
    modalDescMain: "로그인이 필요한 서비스입니다.",
    modalDescSub: "예약 신청 및 확인을 위해 구글 로그인을 완료해 주세요.",
    modalClose: "닫기",
    modalTrigger: "로그인"
  },
  // 베트남어 번역 리소스
  vi: {
    loading: "Đang tải danh sách bệnh viện...",
    empty: "Không có bệnh viện nào.",
    selectBtn: "Đặt lịch ngay",
    loginRequired: "Vui lòng đăng nhập trước khi đặt lịch.",
    pageTitle: "Chọn Bệnh Viện",
    pageSubtitle: "Vui lòng chọn bệnh viện mong muốn để tiến hành đặt lịch hẹn.",
    changeLang: "Thay đổi ngôn ngữ", /* 신규 추가: 언어선택 복원용 텍스트 */
    modalTitle: "🔒 Yêu cầu đăng nhập",
    modalDescMain: "Dịch vụ này yêu cầu đăng nhập bằng tài khoản Google.",
    modalDescSub: "Vui lòng đăng nhập để tiếp tục đặt lịch hẹn và xem lịch sử đặt hẹn của bạn.",
    modalClose: "Đóng",
    modalTrigger: "Đăng nhập"
  },
  // 영어 번역 리소스
  en: {
    loading: "Loading clinic list...",
    empty: "No clinics found.",
    selectBtn: "Book Now",
    loginRequired: "Please log in before booking.",
    pageTitle: "Select Clinic",
    pageSubtitle: "Please select a clinic to proceed with your booking.",
    changeLang: "Change Language", /* 신규 추가: 언어선택 복원용 텍스트 */
    modalTitle: "🔒 Login Required",
    modalDescMain: "This service requires a Google account login.",
    modalDescSub: "Please sign in to proceed with clinic reservation and view history.",
    modalClose: "Close",
    modalTrigger: "Sign in"
  },
  // 일본어 번역 리소스
  ja: {
    loading: "病院リストを読み込んでいます...",
    empty: "登録された病院がありません。",
    selectBtn: "今すぐ予約",
    loginRequired: "予約を進めるにはログインしてください。",
    pageTitle: "病院選択",
    pageSubtitle: "予約を進める病院を選択してください。",
    changeLang: "言語変更", /* 신규 추가: 언어선택 복원용 텍스트 */
    modalTitle: "🔒 ログインが必要",
    modalDescMain: "ログインが必要なサービスです。",
    modalDescSub: "予約の申請および履歴確認のためにグローバルログインを行ってください。",
    modalClose: "閉じる",
    modalTrigger: "ログイン"
  },
  // 중국어 간체 번역 리소스
  zh: {
    loading: "正在加载医院列表...",
    empty: "没有注册的医院。",
    selectBtn: "立即预约",
    loginRequired: "请先登录以进行预约。",
    pageTitle: "选择医院",
    pageSubtitle: "请选择您要进行诊疗预约的医院。",
    changeLang: "更改语言",
    modalTitle: "🔒 需要登录",
    modalDescMain: "此服务需要登录。",
    modalDescSub: "请完成谷歌登录以申请和确认预约。",
    modalClose: "关闭",
    modalTrigger: "登录"
  },
  // 러시아어 번역 리소스
  ru: {
    loading: "Загрузка списка клиник...",
    empty: "Нет зарегистрированных клиник.",
    selectBtn: "Забронировать сейчас",
    loginRequired: "Пожалуйста, войдите в систему, чтобы продолжить бронирование.",
    pageTitle: "Выбор клиники",
    pageSubtitle: "Пожалуйста, выберите клинику для записи на прием.",
    changeLang: "Сменить язык",
    modalTitle: "🔒 Требуется вход",
    modalDescMain: "Для этого сервиса требуется вход в систему.",
    modalDescSub: "Пожалуйста, войдите через Google для отправки и проверки бронирования.",
    modalClose: "Закрыть",
    modalTrigger: "Войти"
  },
  // 미얀마어 번역 리소스
  my: {
    loading: "ဆေးရုံစာရင်းကို ဖွင့်နေပါသည်...",
    empty: "မှတ်ပုံတင်ထားသော ဆေးရုံမရှိပါ။",
    selectBtn: "ယခုပဲ ကြိုတင်ကတ်ပြားယူရန်",
    loginRequired: "ကြိုတင်ကတ်ပြားရယူရန် ကျေးဇူးပြု၍ အရင် လော့ဂ်အင်ဝင်ပေးပါ။",
    pageTitle: "ဆေးရုံရွေးချယ်ရန်",
    pageSubtitle: "ကုသမှုခံယူရန် ဆေးရုံကို ရွေးချယ်ပေးပါ။",
    changeLang: "ဘာသာစကားပြောင်းရန်",
    modalTitle: "🔒 လော့ဂ်အင်ဝင်ရန် လိုအပ်သည်",
    modalDescMain: "ဤဝန်ဆောင်မှုကို အသုံးပြုရန် လော့ဂ်အင်ဝင်ရန် လိုအပ်ပါသည်။",
    modalDescSub: "ကြိုတင်စာင်းသွင်းမှုနှင့် အခြေအနေများကို စစ်ဆေးရန် Google အကောင့်ဖြင့် လော့ဂ်အင်ဝင်ပေးပါ။",
    modalClose: "ပိတ်ရန်",
    modalTrigger: "လော့ဂ်အင်ဝင်ရန်"
  },
  // 캄보디아어 (Khmer) 번역 리소스
  km: {
    loading: "កំពុងផ្ទុកបញ្ជីមន្ទីរពេទ្យ...",
    empty: "មិនមានមន្ទីរពេទ្យដែលបានចុះឈ្មោះទេ។",
    selectBtn: "កក់ឥឡូវនេះ",
    loginRequired: "សូមចូលគណនីរបស់អ្នកជាមុនសិន ដើម្បីធ្វើការកក់ទុក។",
    pageTitle: "ជ្រើសរើសមន្ទីរពេទ្យ",
    pageSubtitle: "សូមជ្រើសរើសមន្ทีរពេទ្យដែលអ្នកចង់ទៅពិនិត្យ។",
    changeLang: "ផ្លាស់ប្តូរភាសា",
    modalTitle: "🔒 ត្រូវការចូលគណនី",
    modalDescMain: "សេវាកម្មនេះតម្រូវឱ្យមានការចូលគណនី។",
    modalDescSub: "សូមចូលគណនី Google ដើម្បីដាក់ពាក្យ និងពិនិត្យមើលការកក់ទុករបស់អ្នក។",
    modalClose: "បិទ",
    modalTrigger: "ចូលគណនី"
  },
  // 몽골어 번역 리소스
  mn: {
    loading: "Эмнэлгийн жагсаалтыг ачаалж байна...",
    empty: "Бүртгэлтэй эмнэлэг байхгүй байна.",
    selectBtn: "Одоо захиалах",
    loginRequired: "Захиалга хийхийн тулд эхлээд нэвтэрнэ үү.",
    pageTitle: "Эмнэлэг сонгох",
    pageSubtitle: "Эмчилгээний захиалга хийх эмнэлгээ сонгоно уу.",
    changeLang: "Хэл өөрчлөх",
    modalTitle: "🔒 Нэвтрэх шаардлагатай",
    modalDescMain: "Энэхүү үйлчилгээг ашиглахад нэвтрэх шаардлагатай.",
    modalDescSub: "Захиалга хийх болон захиалгын түүхийг шалгахын тулд Google хаягаар нэвтэрнэ үү.",
    modalClose: "Хаах",
    modalTrigger: "Нэвтрэх"
  },
  // 태국어 번역 리소스
  th: {
    loading: "กำลังโหลดรายชื่อโรงพยาบาล...",
    empty: "ไม่มีโรงพยาบาลที่ลงทะเบียนไว้",
    selectBtn: "จองเลย",
    loginRequired: "กรุณาเข้าสู่ระบบก่อนทำการจอง",
    pageTitle: "เลือกโรงพยาบาล",
    pageSubtitle: "กรุณาเลือกโรงพยาบาลที่คุณต้องการเข้ารับการรักษา",
    changeLang: "เปลี่ยนภาษา",
    modalTitle: "🔒 จำเป็นต้องเข้าสู่ระบบ",
    modalDescMain: "บริการนี้จำเป็นต้องเข้าสู่ระบบ",
    modalDescSub: "กรุณาเข้าสู่ระบบด้วย Google เพื่อจองและตรวจสอบประวัติการจอง",
    modalClose: "ปิด",
    modalTrigger: "เข้าสู่ระบบ"
  },
  // 라오스어 번역 리소스
  lo: {
    loading: "ກຳລັງໂຫລດລາຍຊື່ໂຮງໝໍ...",
    empty: "ບໍ່ມີໂຮງໝໍທີ່ລົງທະບຽນ.",
    selectBtn: "ຈອງຕອນນີ້",
    loginRequired: "ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນເພື່ອດຳເນີນການຈອງ.",
    pageTitle: "ເລືອກໂຮງໝໍ",
    pageSubtitle: "ກະລຸນາເລືອກໂຮງໝໍທີ່ທ່ານຕ້ອງການເຂົ້າຮັບການກວດ.",
    changeLang: "ປ່ຽນພາສາ",
    modalTitle: "🔒 ຕ້ອງມີການເຂົ້າສູ່ລະບົບ",
    modalDescMain: "ບໍລິການນີ້ຕ້ອງການການເຂົ້າສູ່ລະບົບ.",
    modalDescSub: "ກະລຸນາເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ Google ເພື່ອຈອງ ແລະ ກວດສອບປະຫວັດການຈອງ.",
    modalClose: "ປິດ",
    modalTrigger: "ເຂົ້າສູ່ລະບົບ"
  },
  // 네팔어 번역 리소스
  ne: {
    loading: "अस्पतालहरूको सूची लोड हुँदैछ...",
    empty: "कुनै पनि अस्पताल दर्ता गरिएको छैन।",
    selectBtn: "अहिले नै बुक गर्नुहोस्",
    loginRequired: "कृपया बुकिङ जारी राख्न पहिले लगइन गर्नुहोस्।",
    pageTitle: "अस्पताल छनोट गर्नुहोस्",
    pageSubtitle: "कृपया उपचारको लागि अस्पताल छनोट गर्नुहोस्।",
    changeLang: "भाषा परिवर्तन गर्नुहोस्",
    modalTitle: "🔒 लगइन आवश्यक छ",
    modalDescMain: "यो सेवा प्रयोग गर्न लगइन आवश्यक छ।",
    modalDescSub: "बुकिङ आवेदन दिन र बुकिङ इतिहास हेर्न कृपया गुगल लगइन गर्नुहोस्।",
    modalClose: "बन्द गर्नुहोस्",
    modalTrigger: "लगइन"
  },
  // 인도네시아어 번역 리소스
  id: {
    loading: "Memuat daftar rumah sakit...",
    empty: "Tidak ada rumah sakit yang terdaftar.",
    selectBtn: "Pesan Sekarang",
    loginRequired: "Silakan masuk terlebih dahulu untuk melanjutkan pemesanan.",
    pageTitle: "Pilih Rumah Sakit",
    pageSubtitle: "Silakan pilih rumah sakit untuk melakukan reservasi medis.",
    changeLang: "Ubah Bahasa",
    modalTitle: "🔒 Diperlukan Masuk",
    modalDescMain: "Layanan ini memerlukan masuk log terlebih dahulu.",
    modalDescSub: "Silakan masuk dengan akun Google Anda untuk melakukan dan memeriksa reservasi.",
    modalClose: "Tutup",
    modalTrigger: "Masuk"
  },
  // 스리랑카어 (Sinhala) 번역 리소스
  si: {
    loading: "රෝහල් ලැයිස්තුව පූරණය වෙමින් පවතී...",
    empty: "ලියාපදිංចි රෝහල් කිසිවක් නැත.",
    selectBtn: "දැන්ම වෙන්කරවා ගන්න",
    loginRequired: "වෙන්කරවා ගැනීම සඳහා කරුණாකර පළමුව ලොග් වන්න.",
    pageTitle: "රෝහල තෝරන්න",
    pageSubtitle: "කරුණාකර ප්‍රතිකාර සඳහා රෝහලක් තෝරාගන්න.",
    changeLang: "භාෂාව වෙනස් කරන්න",
    modalTitle: "🔒 ඇතුල්වීම අවශ්‍යයි",
    modalDescMain: "මෙම සේවාව සඳහා ලොග් වීම අවශ්‍ය වේ.",
    modalDescSub: "වෙන්කරවා ගැනීම් සිදු කිරීමට සහ පරීක්ෂා කිරීමට කරුණาකර Google ගිණුමෙන් ලොග් වන්න.",
    modalClose: "වසා දමන්න",
    modalTrigger: "ලොග් වන්න"
  },
  // 방글라데시어 (Bengali) 번역 리소스
  bn: {
    loading: "হাসপাতালের তালিকা লোড হচ্ছে...",
    empty: "কোন নিবন্ধিত হাসপাতাল নেই।",
    selectBtn: "এখনই বুক করুন",
    loginRequired: "বুকিং করতে অনুগ্রহ করে প্রথমে লগইন করুন।",
    pageTitle: "হাসপাতাল নির্বাচন করুন",
    pageSubtitle: "চিকিত্সার জন্য অনুগ্রহ করে একটি hospital নির্বাচন করুন।",
    changeLang: "ভাষা পরিবর্তন করুন",
    modalTitle: "🔒 লগইন প্রয়োজন",
    modalDescMain: "এই পরিষেবাটির জন্য লগইন করা প্রয়োজন।",
    modalDescSub: "বুকিং আবেদন করতে এবং বুকিংয়ের তথ্য দেখতে অনুগ্রহ করে গুগল লগইন করুন।",
    modalClose: "বন্ধ করুন",
    modalTrigger: "লগইন"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("clinic-list-container");
  if (!container) return;

  // 1. 현재 로컬스토리지에 저장된 선택 언어 추출 (기본값: 베트남어 'vi')
  const currentLang = localStorage.getItem("selected_lang") || "vi";
  const dict = i18n[currentLang] || i18n.vi;

  // 2. 화면 내 고정 UI 텍스트 언어팩 매핑 주입
  const pageTitle = document.getElementById("clinic-page-title");
  const pageSubtitle = document.getElementById("clinic-page-subtitle");
  const textChangeLang = document.getElementById("text-change-lang"); // 신규 추가: 언어변경 텍스트 태그 캐싱

  if (pageTitle) pageTitle.textContent = dict.pageTitle;
  if (pageSubtitle) pageSubtitle.textContent = dict.pageSubtitle;
  if (textChangeLang) textChangeLang.textContent = dict.changeLang; // 언어 설정에 맞는 텍스트 주입

  // 로그인 안내 모달 텍스트 치환
  const modalTitle = document.getElementById("modal-title-text");
  const modalDescMain = document.getElementById("modal-desc-main");
  const modalDescSub = document.getElementById("modal-desc-sub");
  const modalClose = document.getElementById("btn-close-login-modal");
  const modalTrigger = document.getElementById("btn-trigger-login");
  if (modalTitle) modalTitle.textContent = dict.modalTitle;
  if (modalDescMain) modalDescMain.innerHTML = dict.modalDescMain;
  if (modalDescSub) modalDescSub.innerHTML = dict.modalDescSub;
  if (modalClose) modalClose.textContent = dict.modalClose;
  if (modalTrigger) modalTrigger.textContent = dict.modalTrigger;

  // 로딩 상태 안내 주입
  container.innerHTML = `<div class="table-loading" style="grid-column: span 3; text-align: center; padding: 3rem; color: #a5b4fc;">${dict.loading}</div>`;

  // 3. Firestore에서 병원 데이터 로드 시작
  // [한글 주석: 관리자가 순서 이동(Swap) 조정한 순번 order 오름차순 기준으로 병원 목록을 쿼리 정렬]
  const q = query(collection(db, "clinics"), orderBy("order", "asc"));

  (async () => {
    try {
      // [한글 주석: 세션 스토리지 기반 병원 목록 캐싱 적용으로 불필요한 Firestore DB 읽기 0회로 최적화]
      const cachedData = sessionStorage.getItem("cached_clinics_list");
      let clinicsData = [];

      if (cachedData) {
        clinicsData = JSON.parse(cachedData);
        console.log("Clinics list loaded from Session Cache (0 Firestore Read cost)");
      } else {
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((docSnap) => {
          clinicsData.push(docSnap.data());
        });
        sessionStorage.setItem("cached_clinics_list", JSON.stringify(clinicsData));
        console.log("Clinics list loaded from Firestore DB and cached");
      }

      container.innerHTML = "";

      if (clinicsData.length === 0) {
        container.innerHTML = `<div class="table-empty" style="grid-column: span 3; text-align: center; padding: 3rem; color: #9ca3af;">${dict.empty}</div>`;
        return;
      }

      clinicsData.forEach((clinic) => {
        // 언어에 맞는 병원 필드 동적 매핑 (만약 전용 다국어 필드가 없으면 하위 호환을 위해 기본값 fallback)
        const clinicName = clinic[`name_${currentLang}`] || clinic.name || "";
        const clinicDesc = clinic[`desc_${currentLang}`] || clinic.desc || "";
        const clinicAddress = clinic[`address_${currentLang}`] || clinic.address || "";

        // 진료과목 배지 HTML 구성 (다국어 진료과목 필드 지원 연계)
        const deptBadges = (clinic[`depts_${currentLang}`] || clinic.depts || [])
          .map(dept => `<span class="dept-badge">${dept}</span>`)
          .join("");

        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinicAddress)}`;

        const card = document.createElement("article");
        card.className = "clinic-card";
        card.innerHTML = `
          <div class="clinic-img-wrapper">
            <img class="clinic-img" src="${clinic.image || '/img/clinic_1_dermatology.png'}" alt="${clinicName}" onerror="this.src='/img/clinic_1_dermatology.png'">
          </div>
          <div class="clinic-content">
            <h2 class="clinic-title">${clinicName}</h2>
            <div class="clinic-depts">
              ${deptBadges}
            </div>
            <p class="clinic-desc">${clinicDesc}</p>
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="clinic-address-link" style="text-decoration: none; color: inherit; display: block; margin-top: auto;">
              <div class="clinic-address">
                <svg class="address-icon" viewBox="0 0 24 24" width="14" height="14">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                <span style="display:inline-block; margin-left: 4px;">${clinicAddress}</span>
              </div>
            </a>
            <button class="clinic-select-btn" onclick="selectClinic('${clinic.englishName || clinic.name}', '${clinicName.replace(/'/g, "\\'")}')">${dict.selectBtn}</button>
          </div>
        `;
        container.appendChild(card);
      });
    } catch (err) {
      console.error("병원 목록 로드 실패:", err);
      container.innerHTML = `<div class="table-empty" style="grid-column: span 3; text-align: center; padding: 3rem; color: #9ca3af;">${dict.empty}</div>`;
    }
  })();
});

/**
 * 전역 병원 선택 핸들러 (로그인 검증 및 세션 바인딩)
 * @param {string} clinicEnglishName - 데이터베이스 식별용 영문 병원명
 * @param {string} clinicLocalizedName - UI에 출력될 번역 완료된 병원명
 */
window.selectClinic = function(clinicEnglishName, clinicLocalizedName) {
  const currentLang = localStorage.getItem("selected_lang") || "vi";
  const dict = i18n[currentLang] || i18n.vi;

  if (!window.isLoggedIn) {
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal();
    } else {
      alert(dict.loginRequired);
    }
    return;
  }
  
  console.log("Selected Clinic (EN):", clinicEnglishName);
  console.log("Selected Clinic (Local):", clinicLocalizedName);
  
  // 로컬스토리지에 식별 이름 및 번역 이름을 동시 저장하여 예약 폼에서 사용
  localStorage.setItem('selected_clinic', clinicEnglishName);
  localStorage.setItem('selected_clinic_localized', clinicLocalizedName);
  
  // 공통 예약 입력폼 페이지로 이동
  location.href = './booking-form.html';
};
