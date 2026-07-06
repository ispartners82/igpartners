import { db } from "./firebase-db.js?v=2.0.7";
// [성능 최적화] 병원 목록은 관리자가 수정할 때만 변경되므로 실시간 리스너(onSnapshot) 대신
// getDocs 일회성 조회를 사용하여 불필요한 Firestore 연결 유지와 비용을 제거합니다.
import { collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * UI 정적 문자열 및 오류 알림을 관리하기 위한 다국어(I18n) 사전 정의
 */
const i18n = {
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
  // [성능 최적화] onSnapshot 실시간 리스너 대신 getDocs 일회성 조회 사용
  // - 병원 목록은 관리자가 수정할 때만 바뀌므로 실시간 감시가 필요 없습니다.
  // - onSnapshot은 탭을 열어 두는 동안 지속적으로 Firestore 연결을 유지하며 읽기 과금이 발생합니다.
  const q = query(collection(db, "clinics"), orderBy("createdAt", "asc"));

  (async () => {
    try {
      const querySnapshot = await getDocs(q);
      container.innerHTML = "";

      if (querySnapshot.empty) {
        container.innerHTML = `<div class="table-empty" style="grid-column: span 3; text-align: center; padding: 3rem; color: #9ca3af;">${dict.empty}</div>`;
        return;
      }

      querySnapshot.forEach((docSnap) => {
        const clinic = docSnap.data();
        
        // 언어에 맞는 병원 필드 동적 매핑 (만약 전용 다국어 필드가 없으면 하위 호환을 위해 기본값 fallback)
        const clinicName = clinic[`name_${currentLang}`] || clinic.name || "";
        const clinicDesc = clinic[`desc_${currentLang}`] || clinic.desc || "";
        const clinicAddress = clinic[`address_${currentLang}`] || clinic.address || "";

        // 진료과목 배지 HTML 구성
        const deptBadges = (clinic.depts || [])
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
