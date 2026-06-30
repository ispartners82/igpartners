import { db, auth } from "./firebase-db.js?v=2.0.7";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * 폼 라벨, 힌트문구, 모달 및 다국어 팝업 얼럿을 다각도로 처리하기 위한 사전 정의
 */
const i18n = {
  ko: {
    /* ─── 한국어 전용 UI 텍스트 (베트남어 제거) ─── */
    formTitle: "진료 예약 정보 입력",
    formSubtitle: "예약을 신속하게 완료하기 위해 아래 폼을 정확하게 작성해 주세요.",
    bookingAt: "📅 예약 진행 병원:",
    noClinic: "병원을 먼저 선택해 주셔야 예약을 진행할 수 있습니다. (병원 선택 화면으로 복귀합니다.)",
    loginRequired: "예약을 진행하려면 먼저 로그인이 필요합니다.",
    /* 폼 라벨 - 한국어만 표시 */
    labelName: "이름 (여권 영문 성명) *",
    placeholderName: "예: HONG GILDONG",
    labelGender: "성별 *",
    genderPlaceholder: "성별을 선택해 주세요",
    genderMale: "남성",
    genderFemale: "여성",
    labelVisaType: "비자 타입 *",
    placeholderVisaType: "예: C-3-9, D-2, E-9 등",
    labelAlienNo: "외국인등록번호 (소지 시 기재)",
    placeholderAlienNo: "예: 950101-1****** (뒷자리 첫번호만 기재 가능)",
    labelVisaExpiry: "체류 만료일 *",
    labelDob: "생년월일 *",
    labelDate: "진료 희망 예약 날짜 *",
    labelAddress: "현재 체류 주소 *",
    placeholderAddress: "예: 서울특별시 강남구 테헤란로 123",
    labelSymptoms: "현재 증상 *",
    placeholderSymptoms: "진료를 원하시는 주요 증상을 자세히 기재해 주세요 (예: 치통, 피부 발진, 감기 등)",
    labelPhone: "연락처 *",
    placeholderPhone: "예: 010-1234-5678",
    /* 동의 및 버튼 - 한국어만 표시 */
    agreementLabel: "개인정보 수집 및 이용에 동의합니다.",
    openPrivacy: "[자세히 보기]",
    btnBack: "돌아가기",
    btnSubmit: "예약 신청하기",
    submitting: "처리 중...",
    submitSuccess: "진료 예약 신청이 성공적으로 접수되었습니다.\n관리자 승인 후 가입하신 이메일 또는 연락처로 신속히 안내 연락드리겠습니다. 감사합니다.",
    submitError: "예약 신청 처리 도중 예기치 못한 시스템 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.",
    agreeRequired: "개인정보 수집 및 이용 약관에 동의해 주셔야 예약을 신청하실 수 있습니다.",
    privacyTitle: "🔒 개인정보 처리방침"
  },
  vi: {
    /* ─── 베트남어 전용 UI 텍스트 (한국어 제거) ─── */
    formTitle: "Nhập Thông Tin Đặt Lịch",
    formSubtitle: "Vui lòng điền đầy đủ thông tin bên dưới để tiến hành đặt lịch hẹn.",
    bookingAt: "📅 Đang đặt lịch tại:",
    noClinic: "Vui lòng chọn bệnh viện trước khi điền thông tin. (Quay lại trang chọn bệnh viện.)",
    loginRequired: "Vui lòng đăng nhập trước khi đặt lịch.",
    /* 폼 라벨 - 베트남어만 표시 */
    labelName: "Họ và tên (Khớp với Hộ chiếu) *",
    placeholderName: "Ví dụ: NGUYEN VAN A",
    labelGender: "Giới tính *",
    genderPlaceholder: "Chọn giới tính",
    genderMale: "Nam",
    genderFemale: "Nữ",
    labelVisaType: "Loại Visa *",
    placeholderVisaType: "Ví dụ: C-3-9",
    labelAlienNo: "Số đăng ký người nước ngoài",
    placeholderAlienNo: "Ví dụ: 950101-2******",
    labelVisaExpiry: "Ngày hết hạn lưu trú *",
    labelDob: "Ngày sinh *",
    labelDate: "Ngày đặt lịch *",
    labelAddress: "Địa chỉ hiện tại *",
    placeholderAddress: "Ví dụ: Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Triệu chứng hiện tại *",
    placeholderSymptoms: "Vui lòng mô tả chi tiết các triệu chứng của bạn (ví dụ: đau răng, ngứa da,...)",
    labelPhone: "Số điện thoại *",
    placeholderPhone: "Ví dụ: 010-1234-5678",
    /* 동의 및 버튼 - 베트남어만 표시 */
    agreementLabel: "Tôi đồng ý với việc thu thập và sử dụng thông tin cá nhân.",
    openPrivacy: "[Xem chi tiết]",
    btnBack: "Quay lại",
    btnSubmit: "Đặt lịch",
    submitting: "Đang xử lý...",
    submitSuccess: "Đăng ký đặt lịch hẹn của bạn đã được ghi nhận thành công.\nChúng tôi sẽ liên hệ lại sau khi quản trị viên phê duyệt. Xin cảm ơn.",
    submitError: "Đã xảy ra lỗi trong quá trình đặt lịch.\nVui lòng thử lại sau.",
    agreeRequired: "Bạn phải đồng ý với chính sách bảo mật để tiếp tục đặt lịch.",
    privacyTitle: "🔒 Chính sách bảo mật"
  },
  en: {
    /* ─── 영어 전용 UI 텍스트 (베트남어/한국어 제거) ─── */
    formTitle: "Enter Booking Details",
    formSubtitle: "Please fill out all the fields below to proceed with your clinic appointment.",
    bookingAt: "📅 Booking at:",
    noClinic: "Please select a clinic before entering information. (Returning to clinic selection page.)",
    loginRequired: "Please sign in before booking an appointment.",
    /* 폼 라벨 - 영어만 표시 */
    labelName: "Full Name (matching Passport) *",
    placeholderName: "e.g. HONG GILDONG",
    labelGender: "Gender *",
    genderPlaceholder: "Select your gender",
    genderMale: "Male",
    genderFemale: "Female",
    labelVisaType: "Visa Type *",
    placeholderVisaType: "e.g. C-3-9, D-2",
    labelAlienNo: "Alien Registration Number (ARC, if held)",
    placeholderAlienNo: "e.g. 950101-2******",
    labelVisaExpiry: "Visa Expiry Date *",
    labelDob: "Date of Birth *",
    labelDate: "Preferred Appointment Date *",
    labelAddress: "Current Address in Korea *",
    placeholderAddress: "e.g. Seoul, Gangnam-gu, Teheran-ro 123",
    labelSymptoms: "Current Symptoms *",
    placeholderSymptoms: "Please describe your symptoms in detail (e.g. toothache, skin rash, cold, etc.)",
    labelPhone: "Phone Number *",
    placeholderPhone: "e.g. 010-1234-5678",
    /* 동의 및 버튼 - 영어만 표시 */
    agreementLabel: "I agree to the collection and use of personal information.",
    openPrivacy: "[View Details]",
    btnBack: "Go Back",
    btnSubmit: "Book Appointment",
    submitting: "Processing...",
    submitSuccess: "Your appointment request has been submitted successfully.\nWe will contact you shortly after administrator approval. Thank you.",
    submitError: "An error occurred during submission.\nPlease try again later.",
    agreeRequired: "You must agree to the privacy policy to proceed with booking.",
    privacyTitle: "🔒 Privacy Policy"
  },
  ja: {
    /* ─── 일본어 전용 UI 텍스트 (베트남어/한국어 제거) ─── */
    formTitle: "診療予約情報入力",
    formSubtitle: "予約を迅速に完了するために、以下のフォームを正確に入力してください。",
    bookingAt: "📅 予約進行中の病院:",
    noClinic: "予約を進行するには、先に病院を選択する必要があります。（病院選択画面に戻ります。）",
    loginRequired: "予約を進めるにはログインしてください。",
    /* 폼 라벨 - 일본어만 표시 */
    labelName: "お名前 (パスポート英語表記と同じ) *",
    placeholderName: "例: HONG GILDONG",
    labelGender: "性別 *",
    genderPlaceholder: "性別を選択してください",
    genderMale: "男性",
    genderFemale: "女性",
    labelVisaType: "ビザの種類 *",
    placeholderVisaType: "例: C-3-9, D-2",
    labelAlienNo: "外国人登録番号 (所持している場合のみ記載)",
    placeholderAlienNo: "例: 950101-1******",
    labelVisaExpiry: "在留期間満了日 *",
    labelDob: "生年月日 *",
    labelDate: "予約希望日 *",
    labelAddress: "韓国内の現住所 *",
    placeholderAddress: "例: ソウル市江南区テヘラン路123",
    labelSymptoms: "現在の症状 *",
    placeholderSymptoms: "ご希望の主な症状を詳しく記入してください（例: 歯痛、湿疹、風邪など）",
    labelPhone: "ご連絡先 (携帯電話番号) *",
    placeholderPhone: "例: 010-1234-5678",
    /* 동의 및 버튼 - 일본어만 표시 */
    agreementLabel: "個人情報の収集および利用に同意します。",
    openPrivacy: "[詳細表示]",
    btnBack: "戻る",
    btnSubmit: "予約する",
    submitting: "処理中...",
    submitSuccess: "診療予約の申請が正常に受理されました。\n管理者の承認後、ご登録のアドレスまたは連絡先にご案内いたします。ありがとうございます。",
    submitError: "予約申請の処理中にエラーが発生しました。\nしばらくしてからもう一度お試しください。",
    agreeRequired: "個人情報の収集および利用に関する利用規約に同意していただく必要があります。",
    privacyTitle: "🔒 個人情報保護方針"
  }
};

/**
 * 개인정보 약관 텍스트 (다국어 렌더링용)
 */
const privacyContents = {
  ko: `
    <div class="privacy-section">
      <h3>📌 개인정보 수집 목적 및 중요성</h3>
      <p>의료 안전 확보 및 한국 병원에서의 정확한 진료 접수 절차 이행을 위해 제공하는 정보는 다음과 같은 중대한 가치를 가집니다:</p>
      <ul>
        <li><strong>성명 및 성별:</strong> 환자의 신원을 정확히 식별하고, 병원 전자의무기록(EMR)의 중복을 예방합니다.</li>
        <li><strong>생년월일 및 신원식별자(체류기간):</strong> 한국 의료법 및 출입국관리법에 따른 외국인 환자 진료 접수 시 필수적인 법적 본인 식별 정보입니다.</li>
        <li><strong>연락처 및 주소:</strong> 예약 확정 안내 송신, 병원 일정 변동에 대한 비상 소통용입니다.</li>
        <li><strong>현재 증상:</strong> 사전 진료 분과 배정 및 맞춤형 진료를 위한 중요 의료 정보로 보안 하에 전송됩니다.</li>
      </ul>
    </div>
  `,
  vi: `
    <div class="privacy-section">
      <h3>📌 Mục đích và Tầm quan trọng của việc thu thập thông tin</h3>
      <p>Để đảm bảo an toàn y tế và thực hiện đúng thủ tục tiếp nhận tại bệnh viện Hàn Quốc, các thông tin bạn cung cấp có vai trò đặc biệt quan trọng như sau:</p>
      <ul>
        <li><strong>Họ và tên, Giới tính:</strong> Xác định chính xác danh tính bệnh nhân, ngăn ngừa nhầm lẫn hồ sơ bệnh án (EMR).</li>
        <li><strong>Ngày sinh, Số hộ chiếu/Số đăng ký người nước ngoài:</strong> Đây là phương thức xác thực danh tính bắt buộc theo Luật Y tế Hàn Quốc.</li>
        <li><strong>Số điện thoại, Địa chỉ hiện tại:</strong> Dùng để gửi thông báo xác nhận lịch hẹn, liên lạc khẩn cấp khi có thay đổi.</li>
        <li><strong>Triệu chứng hiện tại:</strong> Giúp đội ngũ y tế đánh giá sơ bộ mức độ nghiêm trọng và phân bổ phòng khám phù hợp.</li>
      </ul>
    </div>
  `,
  en: `
    <div class="privacy-section">
      <h3>📌 Purpose and Importance of Collecting Information</h3>
      <p>In order to ensure medical safety and complete accurate reception procedures at Korean clinics, the information you provide plays an important role:</p>
      <ul>
        <li><strong>Full Name, Gender:</strong> To accurately identify patients and prevent duplicate electronic medical records (EMR).</li>
        <li><strong>DOB & Identification (Visa expiry):</strong> Required identification for medical registration under Korean Medical Law and Immigration Law.</li>
        <li><strong>Phone Number, Current Address:</strong> For appointment confirmation, emergency contact regarding schedule changes.</li>
        <li><strong>Current Symptoms:</strong> Crucial medical data for proper clinical department pre-assignment and preparation.</li>
      </ul>
    </div>
  `,
  ja: `
    <div class="privacy-section">
      <h3>📌 個人情報収集の目的と重要性</h3>
      <p>医療安全の確保および韓国の病院における正確な診療受付手続き履行のため、提供された情報は以下の通り極めて重要な役割を持ちます：</p>
      <ul>
        <li><strong>氏名および性別:</strong> 患者の身元を正確に特定し、電子カルテ（EMR）の重複や誤りを防ぎます。</li>
        <li><strong>生年月日および外国人登録番号:</strong> 韓国の医療法に基づく外国人患者診療受付時の必須かつ法的な本人確認情報です。</li>
        <li><strong>連絡先および住所:</strong> 予約確定案内の送付、病院都合による予約スケジュールの緊急連絡先です。</li>
        <li><strong>現在の症状:</strong> 事前診療科の決定および個別診療準備のための、厳格に管理される情報です。</li>
      </ul>
    </div>
  `
};

document.addEventListener("DOMContentLoaded", () => {
  const clinicNameText = document.getElementById("clinic-name-text");
  const reservationForm = document.getElementById("reservation-form");
  const btnBack = document.getElementById("btn-back");

  // 1. 현재 로컬스토리지에 설정된 언어셋 확인
  const currentLang = localStorage.getItem("selected_lang") || "vi";
  const dict = i18n[currentLang] || i18n.vi;

  // 2. LocalStorage에서 선택한 병원 영문식별명 및 다국어 렌더링명 가져오기
  const selectedClinic = localStorage.getItem("selected_clinic");
  const selectedClinicLocalized = localStorage.getItem("selected_clinic_localized");

  if (!selectedClinic) {
    alert(dict.noClinic);
    location.href = "/booking-clinic.html";
    return;
  }

  // 화면에 선택한 병원 다국어명 우선 렌더링
  if (clinicNameText) {
    clinicNameText.textContent = selectedClinicLocalized || selectedClinic;
  }

  // 3. UI 폼 텍스트 엘리먼트 다국어 패킹 주입
  const formTitle = document.getElementById("form-page-title");
  const formSubtitle = document.getElementById("form-page-subtitle");
  const bookingBadgeLabel = document.getElementById("booking-badge-label");

  if (formTitle) formTitle.textContent = dict.formTitle;
  if (formSubtitle) formSubtitle.textContent = dict.formSubtitle;
  if (bookingBadgeLabel) bookingBadgeLabel.textContent = dict.bookingAt;

  // 폼 라벨 및 플레이스홀더 동적 매핑
  const mapTextAndPlaceholder = (elId, textVal, placeholderVal = null) => {
    const el = document.getElementById(elId);
    if (el) {
      if (el.tagName === "LABEL") {
        // label 내 필수 표시 span(*) 보존 처리
        el.innerHTML = `${textVal} <span class="required">*</span>`;
      } else {
        el.textContent = textVal;
      }
    }
    if (placeholderVal) {
      const inputEl = document.getElementById(elId.replace("label-", "input-"));
      if (inputEl) inputEl.placeholder = placeholderVal;
    }
  };

  mapTextAndPlaceholder("label-name", dict.labelName, dict.placeholderName);
  mapTextAndPlaceholder("label-gender", dict.labelGender);
  mapTextAndPlaceholder("label-visa-type", dict.labelVisaType, dict.placeholderVisaType);
  mapTextAndPlaceholder("label-alien-no", dict.labelAlienNo.replace(" *", ""), dict.placeholderAlienNo); // 필수 필드 아님
  mapTextAndPlaceholder("label-visa-expiry", dict.labelVisaExpiry);
  mapTextAndPlaceholder("label-dob", dict.labelDob);
  mapTextAndPlaceholder("label-date", dict.labelDate);
  mapTextAndPlaceholder("label-address", dict.labelAddress, dict.placeholderAddress);
  mapTextAndPlaceholder("label-symptoms", dict.labelSymptoms, dict.placeholderSymptoms);
  mapTextAndPlaceholder("label-phone", dict.labelPhone, dict.placeholderPhone);

  // 성별 드롭다운 옵션 번역 주입
  const genderPlaceholder = document.getElementById("gender-placeholder");
  const genderMale = document.getElementById("gender-male");
  const genderFemale = document.getElementById("gender-female");
  if (genderPlaceholder) genderPlaceholder.textContent = dict.genderPlaceholder;
  if (genderMale) genderMale.textContent = dict.genderMale;
  if (genderFemale) genderFemale.textContent = dict.genderFemale;

  // 개인정보 동의 문구 및 상세보기 주입
  const agreementCheck = document.getElementById("agreement-check");
  const agreementLabelText = document.getElementById("agreement-label-text");
  if (agreementLabelText) {
    agreementLabelText.innerHTML = `
      ${dict.agreementLabel}
      <a href="#" id="open-privacy-modal" style="color: #a5b4fc; text-decoration: underline; margin-left: 5px; font-weight: 700;">${dict.openPrivacy}</a>
      <span class="required">*</span>
    `;
  }

  // 액션 단추 번역 주입
  if (btnBack) btnBack.textContent = dict.btnBack;
  const btnSubmit = document.getElementById("btn-submit");
  if (btnSubmit) btnSubmit.textContent = dict.btnSubmit;

  // 돌아가기 버튼 클릭 이벤트
  btnBack.addEventListener("click", () => {
    location.href = "/booking-clinic.html";
  });

  // =========================================================================
  // 4. 개인정보 동의 모달 팝업 제어
  // =========================================================================
  const privacyModal = document.getElementById("privacy-modal");
  const openPrivacyModalBtn = document.getElementById("open-privacy-modal");
  const btnCloseModalX = document.getElementById("btn-close-modal-x");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const privacyModalTitle = document.getElementById("privacy-modal-title");
  const privacyModalBody = document.getElementById("privacy-modal-body-content");

  if (openPrivacyModalBtn && privacyModal) {
    openPrivacyModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // 모달 내용 바인딩
      if (privacyModalTitle) privacyModalTitle.textContent = dict.privacyTitle;
      if (privacyModalBody) privacyModalBody.innerHTML = privacyContents[currentLang] || privacyContents.vi;
      privacyModal.style.display = "flex";
    });
  }

  const hideModal = () => {
    if (privacyModal) privacyModal.style.display = "none";
  };

  if (btnCloseModalX) btnCloseModalX.addEventListener("click", hideModal);
  if (btnCloseModal) btnCloseModal.addEventListener("click", hideModal);

  // 모달 영역 바깥 클릭 시 닫기
  window.addEventListener("click", (e) => {
    if (e.target === privacyModal) {
      hideModal();
    }
  });

  // =========================================================================
  // 5. 예약 폼 제출 이벤트 핸들러
  // =========================================================================
  reservationForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentUser = auth.currentUser;
    if (!currentUser) {
      if (typeof window.showLoginModal === "function") {
        window.showLoginModal();
      } else {
        alert(dict.loginRequired);
        location.href = "/index.html";
      }
      return;
    }
    const userUid = currentUser.uid;

    // 입력값 변수 캐싱
    const name = document.getElementById("input-name").value.trim();
    const gender = document.getElementById("input-gender").value;
    const alienNo = document.getElementById("input-alien-no").value.trim();
    const visaType = document.getElementById("input-visa-type").value.trim();
    const visaExpiry = document.getElementById("input-visa-expiry").value;
    const dob = document.getElementById("input-dob").value;
    const reservationDate = document.getElementById("input-date").value;
    const address = document.getElementById("input-address").value.trim();
    const symptoms = document.getElementById("input-symptoms").value.trim();
    const phone = document.getElementById("input-phone").value.trim();
    const isAgreed = document.getElementById("agreement-check").checked;

    if (!isAgreed) {
       alert(dict.agreeRequired);
       return;
    }

    // 예약하기 버튼 비활성화 (중복 제출 방지)
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = dict.submitting;
    }

    try {
      // Firestore에 예약 데이터 저장 (선택된 예약언어 정보 lang 필드 매핑)
      const docRef = await addDoc(collection(db, "reservations"), {
        uid: userUid, 
        clinic: selectedClinic, // 영문 식별 병원명 저장
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        visaType: visaType,
        visaExpiry: visaExpiry,
        dob: dob,
        reservationDate: reservationDate,
        address: address,
        symptoms: symptoms,
        phone: phone,
        lang: currentLang, // 예약 진행 언어셋
        status: "pending",
        createdAt: serverTimestamp()
      });

      console.log("Reservation recorded with ID: ", docRef.id);
      alert(dict.submitSuccess);

      // 성공 시 예약 내역 확인 페이지로 리다이렉트
      location.href = "/my-reservations.html";

    } catch (error) {
      console.error("Error adding reservation: ", error);
      alert(dict.submitError);
      
      // 버튼 복구
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = dict.btnSubmit;
      }
    }
  });
});
