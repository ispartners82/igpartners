/**
 * [한글 주석: 15개 국어 정보 정의 - 국기 이미지 URL, 원어명, 한국어명]
 */
const LANG_LIST = [
  { code: 'ko', native: '한국어', koName: '한국어', flag: 'https://flagcdn.com/w80/kr.png' },
  { code: 'ja', native: '日本語', koName: '일본어', flag: 'https://flagcdn.com/w80/jp.png' },
  { code: 'vi', native: 'Tiếng Việt', koName: '베트남어', flag: 'https://flagcdn.com/w80/vn.png' },
  { code: 'en', native: 'English', koName: '영어', flag: 'https://flagcdn.com/w80/gb.png' },
  { code: 'zh', native: '中文 (简体)', koName: '중국어', flag: 'https://flagcdn.com/w80/cn.png' },
  { code: 'ru', native: 'Русский', koName: '러시아어', flag: 'https://flagcdn.com/w80/ru.png' },
  { code: 'my', native: 'မြန်မာစာ', koName: '미얀마어', flag: 'https://flagcdn.com/w80/mm.png' },
  { code: 'km', native: 'ភាសាខ្មែរ', koName: '캄보디아어', flag: 'https://flagcdn.com/w80/kh.png' },
  { code: 'mn', native: 'Монгол хэл', koName: '몽골어', flag: 'https://flagcdn.com/w80/mn.png' },
  { code: 'th', native: 'ภาษาไทย', koName: '태국어', flag: 'https://flagcdn.com/w80/th.png' },
  { code: 'lo', native: 'ພາສາລາວ', koName: '라오스어', flag: 'https://flagcdn.com/w80/la.png' },
  { code: 'ne', native: 'नेपाली', koName: '네팔어', flag: 'https://flagcdn.com/w80/np.png' },
  { code: 'id', native: 'Bahasa Indonesia', koName: '인도네시아어', flag: 'https://flagcdn.com/w80/id.png' },
  { code: 'si', native: 'සිංහල', koName: '스리랑카어', flag: 'https://flagcdn.com/w80/lk.png' },
  { code: 'bn', native: 'বাংলা', koName: '방글라데시어', flag: 'https://flagcdn.com/w80/bd.png' }
];

/**
 * [한글 주석: 상단 메뉴 항목별 15개국어 번역 딕셔너리 데이터베이스]
 */
const MENU_TRANSLATIONS = {
  ko: { langSelect: '언어선택', home: '홈', about: '회사소개', services: '제공 서비스', interpretation: '의료통역', booking: '진료 예약', partners: '협력 회사', community: '커뮤니티', myRes: '📅 예약내역', admin: '👑 관리자', stats: '📊 예약통계', logout: '로그아웃', login: '로그인' },
  ja: { langSelect: '言語選択', home: 'ホーム', about: '会社紹介', services: '提供サービス', interpretation: '医療通訳', booking: '診療予約', partners: 'パートナー', community: 'コミュニティ', myRes: '📅 予約履歴', admin: '👑 관리자', stats: '📊 予約統計', logout: 'ログアウト', login: 'ログイン' },
  vi: { langSelect: 'Chọn ngôn ngữ', home: 'Trang chủ', about: 'Giới thiệu', services: 'Dịch vụ', interpretation: 'Thông dịch y tế', booking: 'Đặt lịch khám', partners: 'Đối tác', community: 'Cộng đồng', myRes: '📅 Lịch đặt', admin: '👑 Quản trị', stats: '📊 Thống kê', logout: 'Đăng xuất', login: 'Đăng nhập' },
  en: { langSelect: 'Language', home: 'Home', about: 'About Us', services: 'Services', interpretation: 'Medical Interpretation', booking: 'Book Appointment', partners: 'Partners', community: 'Community', myRes: '📅 My Bookings', admin: '👑 Admin', stats: '📊 Stats', logout: 'Logout', login: 'Login' },
  zh: { langSelect: '选择语言', home: '首页', about: '公司介绍', services: '服务项目', interpretation: '医疗翻译', booking: '预约诊疗', partners: '合作伙伴', community: '社区', myRes: '📅 预约记录', admin: '👑 管理员', stats: '📊 统计', logout: '退出', login: '登录' },
  ru: { langSelect: 'Выбор языка', home: 'Главная', about: 'О компании', services: 'Услуги', interpretation: 'Мед. перевод', booking: 'Запись на прием', partners: 'Партнеры', community: 'Сообщество', myRes: '📅 Мои записи', admin: '👑 Админ', stats: '📊 Статистика', logout: 'Выйти', login: 'Войти' },
  my: { langSelect: 'ဘာသာစကား', home: 'ပင်မစာမျက်နှာ', about: 'ကုမ္ပဏီအကြောင်း', services: 'ဝန်ဆောင်မှုများ', interpretation: 'ဆေးဘက်ဆိုင်ရာစကားပြန်', booking: 'ရက်ချိန်းယူရန်', partners: 'မိတ်ဖက်များ', community: 'အသိုင်းအဝိုင်း', myRes: '📅 ရက်ချိန်းများ', admin: '👑 အဓိက', stats: '📊 စာရင်းအင်း', logout: 'ထွက်ရန်', login: 'ဝင်ရောက်ရန်' },
  km: { langSelect: 'ជ្រើសរើសភាសា', home: 'ទំព័រដើម', about: 'អំពីក្រុមហ៊ុន', services: 'សេវាកម្ម', interpretation: 'អ្នកបកប្រែវេជ្ជសាស្ត្រ', booking: 'កក់ការជួបពិភាក្សា', partners: 'ដៃគូ', community: 'សហគមន៍', myRes: '📅 ការកក់របស់ខ្ញុំ', admin: '👑 អ្នកគ្រប់គ្រង', stats: '📊 ស្ថិតិ', logout: 'ចាកចេញ', login: 'ចូល' },
  mn: { langSelect: 'Хэл сонгох', home: 'Нүүр', about: 'Компанийн тухай', services: 'Үйлчилгээ', interpretation: 'Эмнελгийн орчуулга', booking: 'Цаг захиалах', partners: 'Харилцагч', community: 'Бүлгэм', myRes: '📅 Миний захиалга', admin: '👑 Админ', stats: '📊 Статистик', logout: 'Гарах', login: 'Нэвтрэх' },
  th: { langSelect: 'เลือกภาษา', home: 'หน้าแรก', about: 'เกี่ยวกับเรา', services: 'บริการ', interpretation: 'ล่ามการแพทย์', booking: 'นัดหมายแพทย์', partners: 'พันธมิตร', community: 'ชุมชน', myRes: '📅 การนัดหมายของฉัน', admin: '👑 ผู้ดูแลระบบ', stats: '📊 สถิติ', logout: 'ออกจากระบบ', login: 'เข้าสู่ระบบ' },
  lo: { langSelect: 'ເລືອກພາສາ', home: 'ໜ້າທຳອິດ', about: 'ກ່ຽວກັບພວກເຮົາ', services: 'ບໍລິການ', interpretation: 'ລ່າມການແພດ', booking: 'ນັດໝາຍ', partners: 'ພັນທະມິດ', community: 'ຊຸມຊົນ', myRes: '📅 ການນັດໝາຍຂອງຂ້ອຍ', admin: '👑 ຜູ້ดูแลระบบ', stats: '📊 ສະຖິຕິ', logout: 'ອອກຈາກລະບົບ', login: 'ເຂົ້າสู่ລະບົບ' },
  ne: { langSelect: 'भाषा छान्नुहोस्', home: 'गृहपृष्ठ', about: 'हाम्रो बारेमा', services: 'सेवाहरू', interpretation: 'मेडिकल दोभाषे', booking: 'अपोइन्टमेन्ट', partners: 'भागीदारहरू', community: 'समुदाय', myRes: '📅 मेरो अपोइन्टमेन्ट', admin: '👑 प्रशासक', stats: '📊 तथ्याङ्क', logout: 'लगआउट', login: 'लगइन' },
  id: { langSelect: 'Pilih Bahasa', home: 'Beranda', about: 'Tentang Kami', services: 'Layanan', interpretation: 'Penerjemah Medis', booking: 'Buat Janji', partners: 'Mitra', community: 'Komunitas', myRes: '📅 Janji Saya', admin: '👑 Admin', stats: '📊 Statistik', logout: 'Keluar', login: 'Masuk' },
  si: { langSelect: 'භාෂාව තෝරන්න', home: 'මුල් පිටුව', about: 'අප ගැන', services: 'සේවා', interpretation: 'වෛද්‍ය පරිවර්තක', booking: 'වෙන්කරවා ගැනීම', partners: 'පාර්ශවකරුවන්', community: 'ප්‍රජාව', myRes: '📅 මගේ වෙන්කිරීම්', admin: '👑 පරිපාලක', stats: '📊 සංඛ්‍යාලේඛන', logout: 'ලොග්අවුට්', login: 'ලොගින්' },
  bn: { langSelect: 'ভাষা নির্বাচন', home: 'হোম', about: 'আমাদের সম্পর্কে', services: 'সেবাসমূহ', interpretation: 'মেডিকেল দোভাষী', booking: 'অ্যাপয়েন্টমেন্ট', partners: 'পার্টনার', community: 'কম্যুনিটি', myRes: '📅 আমার বুকিং', admin: '👑 অ্যাডমিন', stats: '📊 পরিসংখ্যান', logout: 'লগআউট', login: 'লগইন' }
};

/**
 * [한글 주석: 전역 언어 변경 및 상단 메뉴 텍스트 실시간 동적 번역 적용 함수]
 * @param {string} langCode 선택된 2글자 언어 코드 (ko, en, ja, vi 등)
 */
/**
 * [한글 주석: 전역 언어 변경 및 상단 메뉴 텍스트 실시간 동적 번역 적용 함수]
 * @param {string} langCode 선택된 2글자 언어 코드 (ko, en, ja, vi 등)
 */
window.changeGlobalLanguage = function(langCode) {
  if (!langCode || !MENU_TRANSLATIONS[langCode]) langCode = 'ko';
  localStorage.setItem("app_selected_language", langCode);

  // 1. 메뉴 텍스트 및 국기/타이틀 실시간 다국어 번역 갱신
  applyNavTranslations(langCode);

  // 2. 15개국어 드롭다운 패널 내부의 선택 체크표시(✓) 및 active 스타일 이동
  bindLangDropdownList();

  // 3. 언어 선택 시 드롭다운 패널 자동 닫기
  const langPanel = document.getElementById("nav-lang-menu-panel");
  if (langPanel) {
    langPanel.classList.remove("show", "active");
  }
};

/**
 * [한글 주석: 현재 선택된 언어에 맞춰 상단 네비게이션 메인 메뉴 DOM의 텍스트를 실시간으로 갱신하는 함수]
 * @param {string} langCode 선택된 언어 코드
 */
function applyNavTranslations(langCode) {
  const t = MENU_TRANSLATIONS[langCode] || MENU_TRANSLATIONS.ko;
  const currentLang = LANG_LIST.find(l => l.code === langCode) || LANG_LIST[0];

  // 0. [한글 주석] 긴 다국어(미얀마, 스리랑카, 캄보디아, 라오스, 네팔, 태국, 방글라데시) 컴팩트 모드 클래스 토글
  const longLanguages = ['my', 'si', 'km', 'lo', 'ne', 'th', 'bn'];
  const globalHeader = document.getElementById("global-header");
  if (longLanguages.includes(langCode)) {
    if (globalHeader) globalHeader.classList.add("lang-compact-mode");
    document.body.classList.add("lang-compact-mode");
  } else {
    if (globalHeader) globalHeader.classList.remove("lang-compact-mode");
    document.body.classList.remove("lang-compact-mode");
  }

  // 1. 드롭다운 대표 텍스트 및 국기 아이콘 갱신
  const langTextEl = document.getElementById("nav-lang-selected-text");
  const langFlagEl = document.getElementById("nav-lang-selected-flag");
  if (langTextEl) langTextEl.textContent = t.langSelect;
  if (langFlagEl) langFlagEl.src = currentLang.flag;

  // 2. 메인 네비게이션 메뉴 텍스트 번역 적용
  const menuHome = document.querySelector("#nav-menu a[href='/index.html']:not(#btn-partners)");
  const menuAbout = document.querySelector("#nav-menu a[href='/about.html']:not([href*='#'])");
  const menuServices = document.querySelector("#nav-menu a[href='/about.html#services']:not(.btn-nav-booking)");
  const menuInterpretation = document.querySelector("#nav-menu a[href='/about.html#services'].btn-nav-booking");
  const menuBooking = document.querySelector("#nav-menu a[href='/booking-lang.html']");
  const menuPartners = document.querySelector("#nav-menu a[href='/index.html#partners']");
  const menuCommunity = document.querySelector("#nav-menu a[href='/community.html']");

  if (menuHome) menuHome.textContent = t.home;
  if (menuAbout) menuAbout.textContent = t.about;
  if (menuServices) menuServices.textContent = t.services;
  if (menuInterpretation) menuInterpretation.textContent = t.interpretation;
  if (menuBooking) menuBooking.textContent = t.booking;
  if (menuPartners) menuPartners.textContent = t.partners;
  if (menuCommunity) menuCommunity.textContent = t.community;

  // 3. 우측 인증 뱃지 및 액션 버튼 번역 적용
  const btnMyRes = document.getElementById("btn-my-reservations");
  const btnAdmin = document.getElementById("btn-admin-dashboard");
  const btnStats = document.getElementById("btn-stats-dashboard");
  const btnLogout = document.getElementById("btn-logout");
  const btnLogin = document.getElementById("btn-login");

  if (btnMyRes) btnMyRes.textContent = t.myRes;
  if (btnAdmin) btnAdmin.textContent = t.admin;
  if (btnStats) btnStats.textContent = t.stats;
  if (btnLogout) btnLogout.textContent = t.logout;
  if (btnLogin) btnLogin.textContent = t.login;

  // 4. 언어 변경 전역 이벤트 전파 (다른 컴포넌트 동기화용)
  window.dispatchEvent(new CustomEvent("appLanguageChanged", { detail: { lang: langCode, t: t } }));
}

/**
 * [한글 주석: 15개 언어 세로 수직 드롭다운 목록 HTML 조각 생성 함수]
 */
function createLangDropdownHTML() {
  const currentLangCode = localStorage.getItem("app_selected_language") || "ko";
  const currentLang = LANG_LIST.find(l => l.code === currentLangCode) || LANG_LIST[0];
  const t = MENU_TRANSLATIONS[currentLangCode] || MENU_TRANSLATIONS.ko;

  let listHtml = "";
  LANG_LIST.forEach(l => {
    const isSelected = l.code === currentLangCode;
    listHtml += `
      <button class="lang-dropdown-item ${isSelected ? 'active' : ''}" data-lang="${l.code}" onclick="window.changeGlobalLanguage('${l.code}')" type="button">
        <img class="lang-dropdown-flag" src="${l.flag}" alt="${l.native}">
        <div class="lang-dropdown-name-group">
          <span class="lang-dropdown-native">${l.native}</span>
          <span class="lang-dropdown-ko">${l.koName}</span>
        </div>
        ${isSelected ? '<span class="lang-dropdown-check">✓</span>' : ''}
      </button>
    `;
  });

  return `
    <li class="nav-item nav-lang-dropdown-wrapper" id="nav-lang-dropdown-container">
      <div class="nav-lang-trigger" id="nav-lang-trigger">
        <img id="nav-lang-selected-flag" class="nav-lang-flag" src="${currentLang.flag}" alt="${currentLang.native}">
        <span id="nav-lang-selected-text" class="nav-lang-text">${t.langSelect}</span>
        <span class="nav-lang-arrow">▾</span>
      </div>
      <div class="nav-lang-menu-panel" id="nav-lang-menu-panel">
        <div class="nav-lang-panel-header">
          <span>🌐 Select Language / 언어선택</span>
        </div>
        <div class="nav-lang-scroll-list" id="nav-lang-scroll-list">
          ${listHtml}
        </div>
      </div>
    </li>
  `;
}

/**
 * [한글 주석: 15개 언어 세로 목록을 정적/동적 드롭다운 영역에 동적으로 렌더링하고 이벤트를 바인딩하는 함수]
 */
function bindLangDropdownList() {
  const scrollList = document.getElementById("nav-lang-scroll-list");
  if (!scrollList) return;

  const currentLangCode = localStorage.getItem("app_selected_language") || "ko";

  let listHtml = "";
  LANG_LIST.forEach(l => {
    const isSelected = l.code === currentLangCode;
    listHtml += `
      <button class="lang-dropdown-item ${isSelected ? 'active' : ''}" data-lang="${l.code}" onclick="window.changeGlobalLanguage('${l.code}')" type="button">
        <img class="lang-dropdown-flag" src="${l.flag}" alt="${l.native}">
        <div class="lang-dropdown-name-group">
          <span class="lang-dropdown-native">${l.native}</span>
          <span class="lang-dropdown-ko">${l.koName}</span>
        </div>
        ${isSelected ? '<span class="lang-dropdown-check">✓</span>' : ''}
      </button>
    `;
  });
  scrollList.innerHTML = listHtml;

  // [한글 주석: 이벤트 위임을 통한 클릭 확실 바인딩]
  scrollList.onclick = function(e) {
    const btn = e.target.closest(".lang-dropdown-item");
    if (btn) {
      const code = btn.getAttribute("data-lang");
      if (code) {
        window.changeGlobalLanguage(code);
      }
    }
  };
}

// [한글 주석: DOM 트리가 이미 로드되어 있거나 빠른 파싱 환경에서 0ms 만에 즉시 언어 목록 주입]
try {
  bindLangDropdownList();
} catch (e) {}

/**
 * [한글 주석: 언어 선택 드롭다운 패널 열기/닫기 토글 전용 전역 함수 (100% 무조건 작동 보장)]
 * @param {Event} e 클릭 이벤트 객체
 */
window.toggleLangDropdown = function(e) {
  if (e) {
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
  }
  const langPanel = document.getElementById("nav-lang-menu-panel");
  if (langPanel) {
    const isShowing = langPanel.classList.contains("show") || langPanel.classList.contains("active");
    if (isShowing) {
      langPanel.classList.remove("show", "active");
    } else {
      langPanel.classList.add("show", "active");
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // 공통 헤더 컨테이너 요소 조회
  const globalHeader = document.getElementById("global-header");
  if (!globalHeader) {
    console.warn("공통 헤더 컨테이너(#global-header)를 찾을 수 없습니다.");
    return;
  }

  // 15개 언어 목록 바인딩
  bindLangDropdownList();

  // 저장된 언어로 메뉴 번역 적용
  const savedLang = localStorage.getItem("app_selected_language") || "ko";
  applyNavTranslations(savedLang);

  // [한글 주석: 데스크톱 및 모바일 퀵 메뉴 언어선택 버튼 클릭 토글 이벤트 안전 바인딩]
  const langTrigger = document.getElementById("nav-lang-trigger");
  const quickLangTrigger = document.getElementById("quick-btn-lang");
  const langPanel = document.getElementById("nav-lang-menu-panel");

  if (langPanel) {
    if (langTrigger) {
      // [한글 주석: 인라인 onclick과의 중복 이벤트를 예방하고 확실하게 토글 함수를 연결]
      langTrigger.onclick = window.toggleLangDropdown;
    }

    if (quickLangTrigger) {
      quickLangTrigger.onclick = window.toggleLangDropdown;
    }

    // [한글 주석: 언어 선택 패널 및 트리거 영역 외 외부 클릭 시 드롭다운 패널 자동으로 닫기 처리]
    document.addEventListener("click", (e) => {
      const target = e.target;
      const isInsideTrigger = langTrigger && langTrigger.contains(target);
      const isInsideQuick = quickLangTrigger && quickLangTrigger.contains(target);
      const isInsidePanel = langPanel && langPanel.contains(target);

      if (!isInsideTrigger && !isInsideQuick && !isInsidePanel) {
        langPanel.classList.remove("show", "active");
      }
    });
  }

  // [한글 주석: 무한 루프를 완전 차단하고 탭 active 하이라이트만 0.01초 만에 스마트 스위칭하는 독립 함수]
  function updateActiveNavLinks(targetUrl) {
    // [한글 주석: 경로와 해시 분리 가드 엔진 - targetUrl에 해시가 붙어오더라도 순수 경로와 해시를 완전 분리 판별해 매칭 오류 원천 차단]
    const urlString = targetUrl || (window.location.pathname + window.location.hash);
    const [pathPart, hashPart] = urlString.split("#");

    const currentPath = pathPart;
    const currentHash = hashPart ? `#${hashPart}` : "";

    const isIndexPage = (currentPath === "/" || currentPath.endsWith("index.html"));
    const isPartnersHash = currentHash === "#partners";
    const isHomeActive = isIndexPage && !isPartnersHash;
    const isPartnersActive = isIndexPage && isPartnersHash;

    const isAboutPage = currentPath.includes("about.html");
    const isServicesHash = currentHash === "#services";
    const isAboutActive = isAboutPage && !isServicesHash;
    const isServicesActive = isAboutPage && isServicesHash;
    const isBookingActive = currentPath.includes("booking-");

    const links = document.querySelectorAll(".common-navbar a");
    links.forEach(link => {
      const href = link.getAttribute("href");
      if (!href) return;

      let isActive = false;
      if (href === "/index.html" && isHomeActive) isActive = true;
      else if (href === "/about.html" && isAboutActive) isActive = true;
      else if (href === "/about.html#services" && isServicesActive) isActive = true;
      else if (href === "/booking-lang.html" && isBookingActive) isActive = true;
      else if (href === "/index.html#partners" && isPartnersActive) isActive = true;
      else if (href === "/my-reservations.html" && currentPath.endsWith("my-reservations.html")) isActive = true;
      else if (href === "/admin.html" && currentPath.endsWith("admin.html")) isActive = true;
      else if (href === "/stats.html" && currentPath.endsWith("stats.html")) isActive = true;
      else if (href === "/community.html" && currentPath.includes("community.html")) isActive = true;

      if (link.classList.contains("nav-link") || link.classList.contains("quick-icon-btn") || link.classList.contains("btn-nav-action")) {
        link.classList.toggle("active", isActive);
      }
    });

    // [한글 주석: 뷰 스위칭 시 우측 프로필/관리자 버튼 2개의 상태를 0.001초 만에 최적화 복원]
    syncAuthBadgeInstantly();
  }

  // [한글 주석: 0초 캐시 복원 엔진 - 페이지/뷰 스위칭 시 우측 관리자 버튼 2개 및 모바일 퀵메뉴가 0.1초 늦게 튀어나오며 발생하던 상단 메뉴 흔들림/사라짐 랙을 100% 원천 차단]
  function syncAuthBadgeInstantly() {
    try {
      const authUserElem = document.getElementById("auth-user");
      const btnLoginElem = document.getElementById("btn-login");
      const btnAdminElem = document.getElementById("btn-admin-dashboard");
      const btnStatsElem = document.getElementById("btn-stats-dashboard");
      const userNameElem = document.getElementById("user-name");
      const userPhotoElem = document.getElementById("user-photo");

      // [한글 주석: 모바일 전용 퀵 버튼 요소 추가 제어]
      const quickBtnMyReservations = document.getElementById("quick-btn-my-reservations");
      const quickBtnAdminDashboard = document.getElementById("quick-btn-admin-dashboard");
      const quickBtnStatsDashboard = document.getElementById("quick-btn-stats-dashboard");
      const quickBtnLogin = document.getElementById("quick-btn-login");

      const userCacheStr = sessionStorage.getItem("auth_user_cache");
      if (userCacheStr) {
        const userObj = JSON.parse(userCacheStr);
        if (authUserElem) authUserElem.style.display = "flex";
        if (btnLoginElem) btnLoginElem.style.display = "none";
        if (userNameElem) userNameElem.textContent = userObj.displayName || "관리자";
        if (userPhotoElem && userObj.photoURL) userPhotoElem.src = userObj.photoURL;

        // [한글 주석: 로그인 세션 복원 시 모바일 퀵 버튼 상태도 동시에 즉시 0ms로 노출 조정]
        if (quickBtnMyReservations) quickBtnMyReservations.style.display = "inline-flex";
        if (quickBtnLogin) quickBtnLogin.style.display = "none";

        // 세션 캐시에 기록된 관리자 권한 확인 후 0초 만에 인메모리 노출
        const permCacheStr = sessionStorage.getItem(`admin_permissions_${userObj.uid}`);
        if (permCacheStr) {
          const permObj = JSON.parse(permCacheStr);
          if (permObj && permObj.permissions) {
            const isAdmin = !!permObj.permissions.isAdmin;
            const hasStats = !!(permObj.permissions.hasStats || permObj.permissions.isAdmin);

            if (btnAdminElem) btnAdminElem.style.display = isAdmin ? "inline-block" : "none";
            if (btnStatsElem) btnStatsElem.style.display = hasStats ? "inline-block" : "none";

            // [한글 주석: 모바일용 퀵 버튼 관리자/통계 상태 동시 0ms 제어]
            if (quickBtnAdminDashboard) quickBtnAdminDashboard.style.display = isAdmin ? "inline-flex" : "none";
            if (quickBtnStatsDashboard) quickBtnStatsDashboard.style.display = hasStats ? "inline-flex" : "none";
          }
        }
      } else {
        // [한글 주석: 로그인 세션 캐시가 없는 상태(비로그인)일 때의 모바일 퀵버튼 노출 상태 0ms 세팅]
        if (quickBtnMyReservations) quickBtnMyReservations.style.display = "none";
        if (quickBtnAdminDashboard) quickBtnAdminDashboard.style.display = "none";
        if (quickBtnStatsDashboard) quickBtnStatsDashboard.style.display = "none";
        if (quickBtnLogin) quickBtnLogin.style.display = "inline-flex";

        // [한글 주석: 비로그인 상태일 때 데스크톱용 상단 네비게이션 로그인 바인딩 영역도 즉시 리셋하여 이전 사용자의 프로필, 예약내역 배지 등이 노출되는 버그를 예방함]
        if (authUserElem) authUserElem.style.display = "none";
        if (btnLoginElem) {
          btnLoginElem.style.display = "block";
          btnLoginElem.disabled = false;
          btnLoginElem.textContent = "로그인";
        }
        if (userNameElem) userNameElem.textContent = "";
        if (userPhotoElem) userPhotoElem.src = "";
        if (btnAdminElem) btnAdminElem.style.display = "none";
        if (btnStatsElem) btnStatsElem.style.display = "none";
      }
    } catch (e) {
      console.warn("syncAuthBadgeInstantly warning:", e);
    }
  }

  // 렌더링 즉시 0ms 장착
  syncAuthBadgeInstantly();

  // 모바일 햄버거 메뉴 및 서랍장 관련 요소 캐싱
  const navToggle = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  const navContainer = document.querySelector(".nav-container");
  const authArea = document.getElementById("nav-auth-area");

  // =========================================================================
  // 1. 화면 가로 크기(Breakpoint: 1024px)에 반응하는 동적 레이아웃 제어 로직
  // =========================================================================
  function handleResponsiveLayout() {
    if (!authArea || !navMenu || !navContainer) return;

    if (window.innerWidth <= 1024) {
      // [모바일/태블릿 모드] 인증 영역(로그인/로그아웃 뱃지)을 모바일 서랍 메뉴 내부 최하단으로 강제 병합
      if (!navMenu.contains(authArea)) {
        navMenu.appendChild(authArea);
        console.log("인증 영역이 모바일 서랍 메뉴 내부로 병합되었습니다.");
      }
    } else {
      // [데스크톱 모드] 인증 영역을 다시 상단 바 우측 원래의 위치로 원복
      if (!navContainer.contains(authArea)) {
        // 햄버거 토글 버튼 바로 앞 영역에 삽입
        navContainer.insertBefore(authArea, navToggle);
        console.log("인증 영역이 데스크톱 상단 우측으로 원복되었습니다.");
      }
    }
  }

  // 창 크기 조절 이벤트 바인딩 및 즉시 1회 실행
  window.addEventListener("resize", handleResponsiveLayout);
  handleResponsiveLayout();

  // =========================================================================
  // 2. 모바일 햄버거 메뉴 토글 기능
  // =========================================================================
  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      navToggle.classList.toggle("active");
      navMenu.classList.toggle("active");
    });

    // 메뉴 클릭 시 모바일 메뉴 자동 닫힘 (해시 태그 스크롤링 시 유용)
    const navLinks = document.querySelectorAll(".nav-link");
    navLinks.forEach(link => {
      link.addEventListener("click", () => {
        navToggle.classList.remove("active");
        navMenu.classList.remove("active");
      });
    });
  }

  // =========================================================================
  // 3. 스크롤 반응 네비게이션 제어
  // =========================================================================
  window.addEventListener("scroll", () => {
    const navbar = document.querySelector(".common-navbar");
    if (navbar) {
      if (window.scrollY > 50) {
        navbar.classList.add("navbar-scrolled");
      } else {
        navbar.classList.remove("navbar-scrolled");
      }
    }
  });

  // =========================================================================
  // 4. 공통 푸터(Footer) 동적 주입 로직
  // =========================================================================
  const globalFooter = document.getElementById("global-footer");
  if (globalFooter) {
    // [한글 주석: 모든 페이지의 하단 정보를 단일 파일에서 제어할 수 있도록 동적으로 마크업을 주입합니다.]
    globalFooter.innerHTML = `
      <div class="footer-container">
        <!-- 푸터 브랜드 설명 -->
        <div class="footer-brand">
          <span class="footer-logo-txt">IGPartners</span>
          <p class="footer-brand-desc">
            국내 최초의 글로벌 헬스케어 매칭 게이트웨이로서, 다국적 외국인 환자와 전문 의료진을 가장 안전하고 부드럽게 잇는 교두보가 되어 드리겠습니다.
          </p>
        </div>

        <!-- 푸터 내 퀵링크 그룹 -->
        <div class="footer-links">
          <div class="footer-link-group">
            <h4>서비스 안내</h4>
            <ul>
              <li><a href="/about.html">회사소개</a></li>
              <li><a href="/about.html#services">제공 서비스</a></li>
              <li><a href="/index.html#partners">협력사 네트워크</a></li>
            </ul>
          </div>
          <div class="footer-link-group">
            <h4>진료 예약</h4>
            <ul>
              <li><a href="/booking-lang.html">예약신청 하기</a></li>
              <li><a href="/my-reservations.html">내 예약 조회</a></li>
            </ul>
          </div>
          <div class="footer-link-group">
            <h4>고객 지원</h4>
            <ul>
              <li><a href="#">개인정보처리방침</a></li>
              <li><a href="mailto:support@igpartners.co.kr">이메일 문의</a></li>
            </ul>
          </div>
        </div>
      </div>

      <!-- 푸터 라이선스 및 저작권 정보 -->
      <div class="footer-bottom">
        <p>&copy; 2026 IGPartners Inc. All rights reserved.</p>
        <!-- [한글 주석: 캡처본 요구사항에 맞춰 일관성 있게 구성된 최신 법인명 및 법인등록번호 표기] -->
        <p>법인명: 주식회사 아이지파트너스 | 법인등록번호: 167-86-04055 | 대구 수성구 알파시티 1로 4길 8</p>
      </div>
    `;
  }

  // =========================================================================
  // 5. 개인정보 처리방침 모달 동적 주입 및 이벤트 바인딩
  // =========================================================================
  const privacyModalHtml = `
    <div id="privacy-policy-modal" class="modal-backdrop" style="display: none;">
      <div class="modal-content" style="max-width: 600px; border: 1px solid rgba(0, 243, 255, 0.25);">
        <!-- 모달 헤더: 닫기 X 버튼 배치 -->
        <div class="modal-header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          <h2 style="color: #ffffff; font-size: 1.3rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 0.5rem;">🔒 개인정보 처리방침</h2>
          <button id="btn-close-privacy-modal-x" class="modal-close-x" style="color: rgba(255,255,255,0.6); font-size: 1.8rem; cursor: pointer; background: none; border: none;">&times;</button>
        </div>
        <!-- 모달 바디: 수집 목적 및 개인정보 규정 (스크롤 지원) -->
        <div class="modal-body" style="padding: 2rem; overflow-y: auto; max-height: 55vh; line-height: 1.6;">
          <h3 style="font-size: 1.1rem; color: #00f3ff; margin-top: 0; margin-bottom: 1rem; font-weight: 700;">📌 개인정보 수집 목적 및 중요성</h3>
          <p style="font-size: 0.9rem; color: rgba(255,255,255,0.8); margin-bottom: 1.25rem;">
            의료 안전 확보 및 한국 병원에서의 정확한 진료 접수 절차 이행을 위해 제공하는 정보는 다음과 같은 중대한 가치를 가집니다:
          </p>
          <ul style="list-style-type: disc; padding-left: 1.25rem; font-size: 0.85rem; color: rgba(255,255,255,0.9); display: flex; flex-direction: column; gap: 0.8rem; margin-bottom: 2rem;">
            <li><strong>성명 및 성별:</strong> 환자의 신원을 정확히 식별하고, 병원 전자의무기록(EMR)의 중복을 예방합니다.</li>
            <li><strong>생년월일 및 신원식별자(체류기간):</strong> 한국 의료법 및 출입국관리법에 따른 외국인 환자 진료 접수 시 필수적인 법적 본인 식별 정보입니다.</li>
            <li><strong>연락처 및 주소:</strong> 예약 확정 안내 송신, 병원 일정 변동에 대한 비상 소통용입니다.</li>
            <li><strong>현재 증상:</strong> 사전 진료 분과 배정 및 맞춤형 진료를 위한 중요 의료 정보로 보안 하에 전송됩니다.</li>
          </ul>

          <h3 style="font-size: 1.1rem; color: #00f3ff; margin-bottom: 1rem; font-weight: 700;">⚖️ 개인정보 처리방침 규정</h3>
          <ol style="list-style-type: decimal; padding-left: 1.25rem; font-size: 0.85rem; color: rgba(255,255,255,0.8); display: flex; flex-direction: column; gap: 0.8rem;">
            <li><strong>개인정보의 수집 및 이용 목적:</strong> 구글 계정을 이용한 회원가입 및 본인 인증, 한국 내 진료 대행 예약 신청, 예약 변경 및 안내 메시지 발송.</li>
            <li><strong>수집하는 개인정보 항목:</strong> [필수] 구글 이메일, 이름, 프로필 사진, 생년월일, 연락처, 주소, 현재 임상 증상.</li>
            <li><strong>개인정보의 보유 및 이용 기간:</strong> 회원 탈퇴 시 혹은 예약 목적 달성 후 1년 간 보관 후 안전하게 파기 (다만, 관계 법령에 규정이 있는 경우 법적 의무 기간 동안 별도 안전 보관).</li>
            <li><strong>동의를 거부할 권리 및 불이익:</strong> 이용자는 개인정보 수집 및 이용 동의를 거부할 수 있으나, 거부 시 회원가입 및 실시간 예약 대행 서비스의 전체 이용이 제한됩니다.</li>
          </ol>
        </div>
        <!-- 모달 푸터: 확인 버튼 -->
        <div class="modal-footer" style="padding: 1.25rem 2rem; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; justify-content: center; gap: 1rem;">
          <button id="btn-close-privacy-modal" class="btn-close-privacy-btn" style="padding: 0.75rem 2.5rem; font-size: 0.95rem; font-weight: 700; color: #ffffff; background: linear-gradient(135deg, #6366f1 0%, #3b82f6 100%); border: none; border-radius: 10px; cursor: pointer; transition: all 0.3s ease;">확인</button>
        </div>
      </div>
    </div>
  `;

  // body 하단에 삽입
  document.body.insertAdjacentHTML("beforeend", privacyModalHtml);

  // 이벤트 대상 요소 캐싱
  const privacyLink = Array.from(document.querySelectorAll("a")).find(el => el.textContent.trim() === "개인정보처리방침");
  const privacyModal = document.getElementById("privacy-policy-modal");
  const btnClosePrivacyX = document.getElementById("btn-close-privacy-modal-x");
  const btnClosePrivacy = document.getElementById("btn-close-privacy-modal");

  if (privacyLink && privacyModal) {
    // 1. 개인정보처리방침 클릭 시 모달 노출
    privacyLink.addEventListener("click", (e) => {
      e.preventDefault();
      privacyModal.style.display = "flex";
      document.body.classList.add("modal-open"); // 배경 스크롤 잠금 효과
    });

    const closeModal = () => {
      privacyModal.style.display = "none";
      document.body.classList.remove("modal-open");
    };

    // 2. 닫기 트리거(X 버튼, 확인 버튼, 배경 클릭) 이벤트 연결
    btnClosePrivacyX.addEventListener("click", closeModal);
    btnClosePrivacy.addEventListener("click", closeModal);
    privacyModal.addEventListener("click", (e) => {
      if (e.target === privacyModal) closeModal();
    });
  }

  // [한글 주석: SPA 동적 뷰 스위처 엔진 - 상단 메뉴바가 1ms도 사라지지 않고 제자리에 부동 고정된 채 아래 내용만 즉시 전환]
  async function loadViewSeamlessly(targetUrl, hashTag = "") {
    try {
      // 1. 주소창 URL을 하드 새로고침 없이 즉시 갱신
      const fullUrl = hashTag ? `${targetUrl}${hashTag}` : targetUrl;
      history.pushState(null, null, fullUrl);

      // 2. 백그라운드 비동기 타겟 HTML 뷰 수집
      const response = await fetch(targetUrl);
      if (!response.ok) {
        location.href = fullUrl;
        return;
      }

      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      // 3. 메인 콘텐츠 컨테이너 추출 및 인메모리 교체 (상단 global-header는 1ms도 손대지 않고 100% 온전히 유지)
      // [한글 주석: 파싱된 타겟 HTML 문서에서 상단 #global-header를 사전에 제거하여 상단 메뉴바가 덮어씌워지고 사라지는 버그를 원천 차단]
      const targetHeader = doc.querySelector("#global-header");
      if (targetHeader) {
        targetHeader.remove();
      }

      // [한글 주석: #app-view-container 및 메인 컨테이너 영역만 정밀하게 1대1 교체하여 상단 헤더 100% 동결 보장]
      const newMain = doc.querySelector("#app-view-container") || doc.querySelector(".container.admin-container") || doc.querySelector(".container") || doc.querySelector("main");
      const currentMain = document.querySelector("#app-view-container") || document.querySelector(".container.admin-container") || document.querySelector(".container") || document.querySelector("main");

      if (newMain && currentMain) {
        currentMain.innerHTML = newMain.innerHTML;
      } else {
        location.href = fullUrl;
        return;
      }

      // [한글 주석: 무한 루프를 완전 차단하기 위해 popstate dispatch 이벤트를 제거하고 active 하이라이트만 직접 스마트 갱신]
      window.dispatchEvent(new Event("hashchange"));
      // [한글 주석: 계정 프로필 노드 영구 보존 락 - 뷰 전환 시 구글 계정 및 모바일 네비게이션이 0.001초도 비어있지 않도록 즉시 동기화 보존]
      updateActiveNavLinks(fullUrl);
      syncAuthBadgeInstantly();
      if (typeof handleResponsiveLayout === "function") {
        handleResponsiveLayout();
      }

      // 5. 해시 앵커(#partners, #services 등)가 있을 경우 스무스 스크롤 이동
      if (hashTag) {
        const targetSec = document.querySelector(hashTag);
        if (targetSec) {
          targetSec.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // [한글 주석: 페이지별 전용 스크립트 강제 재실행 엔진 - SPA 전환 시 기존 DOM이 소멸하고 신규 DOM이 생성되므로 페이지 개별 스크립트는 매번 반드시 재생성 및 재실행해야 함]
      const scripts = doc.querySelectorAll("script");
      scripts.forEach(s => {
        const src = s.getAttribute("src");
        if (src) {
          // 공통 전역 싱글톤 스크립트는 중복 실행 방지를 위해 절대 건드리지 않음
          if (src.includes("navigation.js") || src.includes("auth.js") || src.includes("firebase-config.js")) {
            return;
          }

          // 기존에 삽입되었던 동일한 경로의 스크립트 엘리먼트 제거 (메모리 및 DOM 정리)
          // 쿼리 스트링(?v=...) 부분을 무시하고 매칭하기 위해 src의 절대경로 패턴으로 확인
          const cleanSrc = src.split("?")[0];
          const existingScripts = document.querySelectorAll("script");
          existingScripts.forEach(el => {
            const elSrc = el.getAttribute("src");
            if (elSrc && elSrc.includes(cleanSrc)) {
              el.remove();
            }
          });

          // 강제 재실행을 위해 새로운 script 태그 생성 및 캐시 방지용 타임스탬프 부착
          const scriptElem = document.createElement("script");
          scriptElem.src = cleanSrc + "?t=" + new Date().getTime();
          scriptElem.type = s.type || "text/javascript";
          document.body.appendChild(scriptElem);
        } else if (s.textContent && !s.textContent.includes("loadViewSeamlessly")) {
          // [한글 주석: src가 없는 인라인 복원 스크립트도 뷰 전환 시 신규 DOM을 대상으로 0ms 즉시 구동되도록 재생성 실행]
          const scriptElem = document.createElement("script");
          scriptElem.textContent = s.textContent;
          scriptElem.type = s.type || "text/javascript";
          document.body.appendChild(scriptElem);
        }
      });

    } catch (e) {
      console.warn("SPA View load failed, fallbacking to hard navigate:", e);
      location.href = targetUrl;
    }
  }

  // 상단 네비게이션 메뉴 클릭 스마트 인터셉터
  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;

    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("javascript:") || href.startsWith("tel:") || href.startsWith("mailto:")) return;

    // 외부 링크는 기본 동작 수행
    if (href.startsWith("http://") || href.startsWith("https://")) return;

    // 파싱된 경로 및 해시 분리
    const [pathPart, hashPart] = href.split("#");
    const targetPath = pathPart || window.location.pathname;
    const targetHash = hashPart ? `#${hashPart}` : "";

    // 1) 동일 페이지 해시 이동 처리
    if (targetPath === window.location.pathname || (targetPath === "/index.html" && window.location.pathname === "/") || (targetPath === "/" && window.location.pathname === "/index.html")) {
      if (targetHash) {
        e.preventDefault();
        history.pushState(null, null, targetHash);
        const targetElem = document.querySelector(targetHash);
        if (targetElem) {
          targetElem.scrollIntoView({ behavior: "smooth" });
        }
        window.dispatchEvent(new Event("hashchange"));
      } else {
        e.preventDefault();
        history.pushState(null, null, targetPath);
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.dispatchEvent(new Event("hashchange"));
      }
      return;
    }

    // 2) 다른 HTML 페이지로 이동 시 브라우저 표준 고속 페이지 이동 수행 (페이지별 독립적인 body 클래스 및 DOM 구조 100% 보증)
    // [한글 주석: AJAX 파싱 뷰 교체로 인한 body 클래스 유실 및 2단 카페 레이아웃 붕괴 현상을 원천 차단]
    // 브라우저 기본 링크 이동 동작(native navigation)이 수행되도록 기본 이벤트를 방지하지 않습니다.
  });

  // [한글 주석: 동일 페이지 해시 이동(pushState) 시에도 탭 하이라이트가 누락 없이 스마트 동기화되도록 전역 hashchange 이벤트 연결]
  window.addEventListener("hashchange", () => {
    updateActiveNavLinks();
  });
});
