// Firebase App, DB 및 Auth 공통 모듈 연동 (캐시 무효화 버전: v=261002_5)
import { db, auth } from "./firebase-db.js?v=261002_5";
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// 15개국어 진료 예약 폼 번역 및 개인정보 수집 이용 안내문 전용 모듈 연동 (코드 경량화 및 모듈화 적용)
import { i18n, privacyContents } from "./i18n-reservation.js?v=261002_5";

document.addEventListener("DOMContentLoaded", () => {


  // 솔라피(Solapi) API 연동에 필요한 키 정의 및 설정 상수
  // 평생 무료 서버 규칙을 준수하면서 Secret Key를 안전하게 보호하기 위한 프록시 옵션 (Cloudflare Workers 연동용)
  const SOLAPI_PROXY_URL = ""; // 예: "https://igpartners-alimtalk.workers.dev/send"
  const SOLAPI_API_KEY = "NCS6QTA1RKWBG0P5";         // 솔라피에서 발급받은 API Key
  const SOLAPI_API_SECRET = "YO0S9SMY2XTAKI3ZRH93X7FB4UC0BIGS";   // 솔라피에서 발급받은 API Secret Key
  const SOLAPI_PF_ID = "KA01PF260722073645289pLAZp0cKRLD"; // 솔라피 콘솔에서 발급받은 카카오톡 채널 고유 연동 프로필 ID (pfId)
  // 카카오 검수 승인 완료된 신규 알림톡 템플릿 ID (예약희망시간 포함)
  const SOLAPI_TEMPLATE_ID = "KA01TP260917074840400ff0zrEUDfKQ";
  const SOLAPI_SENDER_NUMBER = "01028196392";   // 솔라피에 등록 및 발송 등록된 발신번호 (예: 01012345678)

  // 새로운 예약 신청 알림톡을 실시간으로 전달받을 관리자 휴대폰 번호 목록 (DB 연동으로 변경됨에 따라 하드코딩 상수는 제거 처리)

  // 솔라피 API 호출 시 사용할 HMAC-SHA256 인증 헤더 생성 함수 (Web Crypto API 활용)
  const createSolapiAuthHeader = async (apiKey, apiSecret) => {
    const date = new Date().toISOString();
    const salt = Math.random().toString(36).substring(2, 15);

    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const messageData = encoder.encode(date + salt);

    // HMAC SHA-256 서명 생성
    const cryptoKey = await window.crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const signatureBuffer = await window.crypto.subtle.sign(
      "HMAC",
      cryptoKey,
      messageData
    );

    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
  };

  // 솔라피 API를 호출하여 등록된 관리자 휴대폰으로 10가지 예약 정보 알림톡을 다중 전송하는 비동기 함수
  const sendSolapiAlimtalk = async (lang, name, clinicName, gender, visaType, dob, reservationDate, reservationTime, symptoms, address, phone) => {
    // API 연동용 인증키 유효성 사전 검사
    if (SOLAPI_API_KEY === "YOUR_SOLAPI_API_KEY" || SOLAPI_API_SECRET === "YOUR_SOLAPI_API_SECRET") {
      console.warn("솔라피 API Key 또는 Secret이 설정되지 않았습니다. 실서비스 연동을 위해 키를 입력해 주세요.");
      return { status: "not_configured", error: "솔라피 API Key/Secret 미설정" };
    }

    // Firestore DB의 settings/solapi 문서에서 실시간으로 알림톡 수신 관리자 연락처 로드
    let adminPhones = [];
    try {
      const solapiDocRef = doc(db, "settings", "solapi");
      const solapiDocSnap = await getDoc(solapiDocRef);
      if (solapiDocSnap.exists() && solapiDocSnap.data().adminPhones) {
        adminPhones = solapiDocSnap.data().adminPhones;
      }
    } catch (err) {
      console.error("Firestore에서 알림톡 수신자 정보를 가져오는 데 실패했습니다:", err);
    }

    // DB에 수신자 설정 데이터가 없으면 기존 소스코드에 하드코딩되었던 번호를 백업용(Fallback)으로 적용함
    if (adminPhones.length === 0) {
      adminPhones = ["01028196392", "01096011085"];
    }

    // 알림 수신 대상인 관리자 전화번호 설정 유효성 검사
    if (!adminPhones || adminPhones.length === 0) {
      console.warn("알림을 수신할 관리자 연락처가 설정되지 않았습니다.");
      return { status: "not_configured", error: "관리자 연락처 미설정" };
    }

    // 알림톡 필수 발송 파라미터가 유효한지 체크
    if (
      SOLAPI_PF_ID === "YOUR_KAKAO_PF_ID" ||
      SOLAPI_TEMPLATE_ID === "YOUR_TEMPLATE_ID" ||
      SOLAPI_SENDER_NUMBER === "YOUR_SENDER_NUMBER" ||
      !SOLAPI_PF_ID ||
      !SOLAPI_TEMPLATE_ID ||
      !SOLAPI_SENDER_NUMBER
    ) {
      console.warn("카카오톡 프로필 ID, 템플릿 ID, 혹은 발신번호 설정이 플레이스홀더 상태이거나 누락되었습니다.");
      return { status: "not_configured", error: "알림톡 프로필/템플릿/발신번호 미설정" };
    }

    try {
      // API 인증 헤더 생성
      const authHeader = await createSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);

      // 각 예약 변수가 실제 데이터값으로 치환된 최종 발송용 텍스트 본문 생성 (줄바꿈 호환성을 위해 명시적 \n 결합 구조 사용)
      // 솔라피 승인 템플릿 문구와 100% 일치하도록 '병원' 단어 포함 본문 생성
      const messageText = "[새로운 병원 진료 예약 접수 알림]\n" +
        "• 예약언어: " + lang + "\n" + // 템플릿 검증 일치를 위해 '선택언어' -> '예약언어'로 단어 지정
        "• 환자이름: " + name + "\n" +
        "• 신청병원: " + clinicName + "\n" +
        "• 성별: " + gender + "\n" +
        "• 비자타입: " + visaType + "\n" +
        "• 생년월일: " + dob + "\n" +
        "• 예약희망일: " + reservationDate + "\n" +
        "• 예약희망시간: " + (reservationTime || "-") + "\n" +
        "• 증상: " + symptoms + "\n" + // 템플릿 검증 통과를 위해 symptoms의 임의 가공(...) 처리를 완전히 배제]
        "• 주소: " + address + "\n" +
        "• 연락처: " + phone;

      // 설정된 모든 관리자 연락처별로 전송할 메시지 객체 배열을 생성
      const messages = adminPhones.map(adminPhone => {
        // 전화번호 포맷 정규화 (솔라피 수신번호는 하이픈 제외 숫자로만 구성 권장)
        const cleanAdminPhone = adminPhone.replace(/[^0-9]/g, "");

        return {
          to: cleanAdminPhone,
          from: SOLAPI_SENDER_NUMBER,
          type: "ATA", // 솔라피 카카오 알림톡 정식 규격 타입인 ATA로 지정]
          text: messageText, // 변수가 최종 치환된 텍스트 본문을 필수 전달]
          kakaoOptions: {
            pfId: SOLAPI_PF_ID,
            templateId: SOLAPI_TEMPLATE_ID,
            // 관리자용 승인 알림톡 템플릿에 맞추어 10가지 예약 상세 필드를 변수로 매핑
            variables: {
              "#{선택언어}": lang,
              "#{이름}": name,
              "#{선택병원}": clinicName,
              "#{성별}": gender,
              "#{비자타입}": visaType,
              "#{생년월일}": dob,
              "#{예약희망일}": reservationDate,
              "#{예약희망시간}": reservationTime || "-",
              "#{증상}": symptoms, // variables 치환 시에도 증상 값 원본을 그대로 전송]
              "#{주소}": address,
              "#{연락처}": phone
            }
          }
        };
      });

      // 솔라피 다중 전송 requestBody 정의
      const requestBody = {
        messages: messages
      };

      // 솔라피 다중 메시지 전송 API 엔드포인트 호출
      const response = await fetch("https://api.solapi.com/messages/v4/send-many", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.errorMessage || `HTTP status ${response.status}`);
      }

      console.log("관리자 알림톡 발송 완료:", responseData);
      return { status: "success" };
    } catch (err) {
      console.error("관리자 알림톡 발송 중 예외 오류 발생:", err);
      return { status: "fail", error: err.message };
    }
  };



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
  mapTextAndPlaceholder("label-time", dict.labelTime);
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
  // 예약희망시간 드롭다운 기본 안내 문구 다국어 바인딩
  const timePlaceholder = document.getElementById("time-placeholder");
  if (timePlaceholder) timePlaceholder.textContent = dict.timePlaceholder;

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
  // 로그인 사용자 프로필 데이터를 예약 폼에 자동 입력해주는 연동 함수
  // =========================================================================
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          const inputName = document.getElementById("input-name");
          const inputVisaType = document.getElementById("input-visa-type");
          const inputAlienNo = document.getElementById("input-alien-no");
          const inputVisaExpiry = document.getElementById("input-visa-expiry");
          const inputDob = document.getElementById("input-dob");
          const inputAddress = document.getElementById("input-address");
          const inputPhone = document.getElementById("input-phone");

          if (inputName && uData.name && !inputName.value) inputName.value = uData.name;
          if (inputVisaType && uData.visaType && !inputVisaType.value) inputVisaType.value = uData.visaType;
          if (inputAlienNo && uData.alienNo && !inputAlienNo.value) inputAlienNo.value = uData.alienNo;
          if (inputVisaExpiry && uData.visaExpiry && !inputVisaExpiry.value) inputVisaExpiry.value = uData.visaExpiry;
          if (inputDob && uData.dob && !inputDob.value) inputDob.value = uData.dob;
          if (inputAddress && uData.address && !inputAddress.value) inputAddress.value = uData.address;
          if (inputPhone && uData.phone && !inputPhone.value) inputPhone.value = uData.phone;
          
          console.log("로그인 회원 프로필 정보 예약 폼 자동 완성 완료:", user.uid);
        }
      } catch (err) {
        console.error("예약 폼 프로필 정보 자동 채우기 중 예외 발생:", err);
      }
    }
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
    const reservationTime = document.getElementById("input-time") ? document.getElementById("input-time").value : "";
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
      // 예약 알림톡 선발송 - 솔라피 API를 통해 알림톡을 전송하고 발송 상태 결과를 사전에 획득함
      const alimtalkResult = await sendSolapiAlimtalk(
        currentLang, // 선택언어
        name,        // 이름
        selectedClinicLocalized || selectedClinic, // 선택병원
        gender,      // 성별
        visaType,    // 비자타입
        dob,         // 생년월일
        reservationDate, // 예약희망일
        reservationTime, // 예약희망시간
        symptoms,    // 증상
        address,     // 주소
        phone        // 연락처
      );

      // Firestore에 예약 데이터 저장 - alimtalkStatus 및 alimtalkError를 문서 최초 생성 시 원자적(Atomic)으로 저장하여 단일 트랜잭션 기록 완료
      const reservationPayload = {
        uid: userUid,
        clinic: selectedClinic, // 영문 식별 병원명 저장
        name: name,
        gender: gender,
        alienNo: alienNo || "",
        visaType: visaType,
        visaExpiry: visaExpiry,
        dob: dob,
        reservationDate: reservationDate,
        reservationTime: reservationTime,
        address: address,
        symptoms: symptoms,
        // 유입경로는 초기 비어있으며 관리자 페이지에서 입력 및 관리됨
        inflow: "",
        phone: phone,
        lang: currentLang, // 예약 진행 언어셋
        status: "pending",
        alimtalkStatus: alimtalkResult ? alimtalkResult.status : "fail",
        alimtalkError: (alimtalkResult && alimtalkResult.error) ? alimtalkResult.error : null,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "reservations"), reservationPayload);
      console.log("Reservation recorded with ID: ", docRef.id, "alimtalkStatus:", reservationPayload.alimtalkStatus);

      // 백업용 후속 문서 업데이트 로직 - 단일 기록 성공 후 동기화 보장
      if (alimtalkResult) {
        try {
          const updateData = {
            alimtalkStatus: alimtalkResult.status
          };
          if (alimtalkResult.error) {
            updateData.alimtalkError = alimtalkResult.error;
          }
          const docDocRef = doc(db, "reservations", docRef.id);
          await updateDoc(docDocRef, updateData);
          console.log("Firestore 예약 문서에 알림톡 상태 보조 업데이트 완료:", updateData);
        } catch (updateErr) {
          console.log("Firestore 보조 업데이트 건너뜀 (이미 addDoc에 원자적 기록됨):", updateErr.message);
        }
      }

      // 예약 신청 완료 알림 팝업 실행
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
