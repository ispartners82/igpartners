import { auth, db } from "/js/firebase-db.js?v=2.0.7";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * [한글 주석] IGPartners 회원가입 & 로그인 모듈
 * - 구글 로그인 방식을 대체하여 아이디/비밀번호 기반 회원가입 및 로그인 기능을 수행합니다.
 * - 회원가입 시 수집 항목: 아이디, 비밀번호, 비밀번호 재확인, 국가(선호언어), 이름, 생년월일, 외국인등록번호, 체류주소, 이메일, 연락처, 비자타입, 비자만료일
 * - Firestore `users/{uid}` 컬렉션 문서로 회원 프로필 데이터를 저장하여 안전하게 관리합니다.
 * - 세션 캐싱(sessionStorage)으로 DB 읽기를 최소화하며 무료 요금제(Spark Plan) 법칙을 완벽히 지킵니다.
 */

document.addEventListener("DOMContentLoaded", () => {

  // =========================================================================
  // 1. 회원가입 / 로그인 통합 모달 UI 동적 생성 및 관리
  // =========================================================================

  /**
   * [한글 주석] 회원가입 및 로그인 모달 HTML 돔 구조가 없을 경우 동적 생성해주는 함수
   */
  function ensureAuthModalCreated() {
    if (document.getElementById("auth-modal")) return;

    const modalHTML = `
      <div id="auth-modal" class="auth-modal-backdrop" style="display: none;">
        <div class="auth-modal-card">
          <button type="button" class="auth-modal-close" id="btn-close-auth-modal">&times;</button>
          
          <!-- 로그인 / 회원가입 탭 헤더 -->
          <div class="auth-nav-tabs">
            <button type="button" class="auth-tab-btn active" id="tab-btn-login">로그인 (Sign In)</button>
            <button type="button" class="auth-tab-btn" id="tab-btn-signup">회원가입 (Sign Up)</button>
          </div>

          <!-- 로그인 폼 영역 -->
          <div id="auth-section-login">
            <form id="form-auth-login">
              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="login-input-account">아이디 또는 이메일 (ID or Email) <span class="req">*</span></label>
                <input type="text" id="login-input-account" required placeholder="아이디 또는 이메일 주소를 입력해 주세요">
              </div>
              <div class="auth-form-group" style="margin-bottom: 1.5rem;">
                <label for="login-input-password">비밀번호 (Password) <span class="req">*</span></label>
                <input type="password" id="login-input-password" required placeholder="비밀번호를 입력해 주세요">
              </div>
              <button type="submit" class="auth-submit-btn" id="btn-submit-login">로그인 (Sign In)</button>
            </form>
          </div>

          <!-- 회원가입 폼 영역 (12개 입력 항목) -->
          <div id="auth-section-signup" style="display: none;">
            <form id="form-auth-signup">
              <div class="auth-form-grid">
                
                <!-- 1. 국가(선호언어) 선택 (최상단 배치) -->
                <div class="auth-form-group auth-field-full">
                  <label for="signup-country-lang">국가 (선호언어) / Country (Language) <span class="req">*</span></label>
                  <select id="signup-country-lang" required>
                    <option value="ko" selected>🇰🇷 대한민국 (한국어 / Korean)</option>
                    <option value="ja">🇯🇵 일본 (日本語 / Japanese)</option>
                    <option value="vi">🇻🇳 베트남 (Tiếng Việt / Vietnamese)</option>
                    <option value="en">🇺🇸 미국/기타 (English)</option>
                    <option value="zh">🇨🇳 중국 (中文 / Chinese)</option>
                    <option value="ru">🇷🇺 러시아 (Русский / Russian)</option>
                    <option value="my">🇲🇲 미얀마 (မြန်မာစာ / Myanmar)</option>
                    <option value="km">🇰🇭 캄보디아 (ភាសាខ្មែរ / Khmer)</option>
                    <option value="mn">🇲🇳 몽골 (Mongolian)</option>
                    <option value="th">🇹🇭 태국 (ภาษาไทย / Thai)</option>
                    <option value="lo">🇱🇦 라오스 (ພາສາລາວ / Lao)</option>
                    <option value="ne">🇳🇵 네팔 (नेपाली / Nepali)</option>
                    <option value="id">🇮🇩 인도네시아 (Bahasa Indonesia)</option>
                    <option value="si">🇱🇰 스리랑카 (සිංහල / Sinhala)</option>
                    <option value="bn">🇧🇩 방글라데시 (বাংলা / Bengali)</option>
                  </select>
                </div>

                <!-- 2. 아이디 -->
                <div class="auth-form-group">
                  <label for="signup-login-id">아이디 (ID) <span class="req">*</span></label>
                  <input type="text" id="signup-login-id" required placeholder="예: user123">
                </div>

                <!-- 3. 이메일 -->
                <div class="auth-form-group">
                  <label for="signup-email">이메일 (Email) <span class="req">*</span></label>
                  <input type="email" id="signup-email" required placeholder="예: user@gmail.com">
                </div>

                <!-- 4. 비밀번호 -->
                <div class="auth-form-group">
                  <label for="signup-password">비밀번호 (Password) <span class="req">*</span></label>
                  <input type="password" id="signup-password" required placeholder="6자 이상 입력">
                </div>

                <!-- 5. 비밀번호 재입력 -->
                <div class="auth-form-group">
                  <label for="signup-password-confirm">비밀번호 확인 (Confirm Password) <span class="req">*</span></label>
                  <input type="password" id="signup-password-confirm" required placeholder="비밀번호 재입력">
                </div>

                <!-- 6. 이름 -->
                <div class="auth-form-group">
                  <label for="signup-name">이름 (성명) / Full Name <span class="req">*</span></label>
                  <input type="text" id="signup-name" required placeholder="예: 홍길동">
                </div>

                <!-- 7. 생년월일 -->
                <div class="auth-form-group">
                  <label for="signup-dob">생년월일 (Date of Birth) <span class="req">*</span></label>
                  <input type="date" id="signup-dob" required>
                </div>

                <!-- 8. 외국인등록번호(주민등록번호) -->
                <div class="auth-form-group">
                  <label for="signup-alien-no">외국인등록번호(주민번호) / ARC (Resident No.) <span class="req">*</span></label>
                  <input type="text" id="signup-alien-no" required placeholder="예: 950101-1******">
                </div>

                <!-- 9. 연락처 -->
                <div class="auth-form-group">
                  <label for="signup-phone">연락처 (Phone Number) <span class="req">*</span></label>
                  <input type="tel" id="signup-phone" required placeholder="예: 010-1234-5678">
                </div>

                <!-- 10. 비자 타입 -->
                <div class="auth-form-group">
                  <label for="signup-visa-type">비자 타입 (Visa Type) <span class="req">*</span></label>
                  <input type="text" id="signup-visa-type" required placeholder="예: 내국인,D-2, E-9 등">
                </div>

                <!-- 11. 체류(비자) 만료일 -->
                <div class="auth-form-group" id="signup-visa-expiry-group">
                  <label for="signup-visa-expiry">체류(비자) 만료일 (Visa Expiry Date) <span class="req">*</span></label>
                  <input type="date" id="signup-visa-expiry" required>
                </div>

                <!-- 12. 현재 체류 주소 (전체 너비) -->
                <div class="auth-form-group auth-field-full">
                  <label for="signup-address">현재 체류 주소 (Current Address) <span class="req">*</span></label>
                  <input type="text" id="signup-address" required placeholder="예: 대구광역시 수성구 알파시티로 1로 4길 8">
                </div>

              </div>

              <!-- [한글 주석: 개인정보 수집 및 이용 동의 체크박스 영역] -->
              <div class="auth-privacy-wrapper">
                <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.88rem; color: rgba(255, 255, 255, 0.9);">
                  <input type="checkbox" id="signup-privacy-agree" required style="width: 17px; height: 17px; accent-color: #3b82f6; cursor: pointer;">
                  <label for="signup-privacy-agree" style="cursor: pointer; margin: 0;">개인정보 수집 및 이용에 동의합니다.</label>
                  <button type="button" id="btn-open-privacy-detail" class="privacy-detail-btn" onclick="window.showPrivacyPolicyModal(event)">[자세히 보기 / View Details]</button>
                  <span class="req" style="color: #ef4444;">*</span>
                </div>
              </div>

              <button type="submit" class="auth-submit-btn" id="btn-submit-signup">회원가입 완료 (Complete Registration)</button>
            </form>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
    ensurePrivacyModalCreated();
    bindAuthModalEvents();
  }

  /**
   * [한글 주석] 약관 상세 팝업 모달을 여는 전역 오픈 함수
   */
  window.showPrivacyPolicyModal = function(e) {
    if (e) {
      if (typeof e.preventDefault === "function") e.preventDefault();
      if (typeof e.stopPropagation === "function") e.stopPropagation();
    }
    ensurePrivacyModalCreated();
    const privacyModal = document.getElementById("privacy-policy-modal");
    if (privacyModal) {
      privacyModal.style.setProperty("display", "flex", "important");
      privacyModal.style.setProperty("z-index", "999999", "important");
    }
  };

  /**
   * [한글 주석] 개인정보 수집 및 이용 동의 약관 상세 모달 HTML 동적 생성 함수
   */
  function ensurePrivacyModalCreated() {
    if (document.getElementById("privacy-policy-modal")) return;

    const privacyModalHTML = `
      <div id="privacy-policy-modal" class="auth-modal-backdrop" style="display: none; z-index: 999999 !important;">
        <div class="privacy-modal-card" style="z-index: 1000000 !important;">
          <button type="button" class="auth-modal-close" id="btn-close-privacy-modal" style="top: 1.2rem; right: 1.2rem;">&times;</button>
          <h3>📜 개인정보 수집 및 이용 약관 <br><span style="font-size: 0.95rem; color: #94a3b8; font-weight: 500;">Privacy Policy & Terms of Service</span></h3>
          
          <div class="privacy-content-box">
            <p>IS Partners 서비스(이하 '회사')는 외국인 환자 의료 예약 및 보건 의료 행정 지원 서비스를 제공함에 있어 「개인정보 보호법」 제15조, 제17조 및 제22조에 따라 이용자의 개인정보를 수집·이용하고자 합니다. 내용을 자세히 읽으신 후 동의하여 주시기 바랍니다.</p>
            
            <h4>1. 개인정보의 수집 및 이용 목적 (Purpose of Collection & Use)</h4>
            <ul>
              <li><strong>회원 관리 및 식별:</strong> 회원가입, 본인 식별, 이용자 구분, 부정 이용 방지, 가입 의사 확인</li>
              <li><strong>의료 진료 예약 중계 서비스 제공:</strong> 의료기관 진료 예약 신청, 진료 접수, 병원 및 약국 관련 정보 안내, 예약 변경/취소 알림 서비스</li>
              <li><strong>글로벌 고객 케어 및 행정 지원:</strong> 다국어 통번역 서비스, 비자 및 체류 기간에 맞춘 의료 행정 지원, 긴급 의료 상담 연락</li>
            </ul>

            <h4>2. 수집하는 개인정보의 항목 (Personal Data Collected)</h4>
            <ul>
              <li><strong>필수 수집 항목:</strong> 아이디, 이메일 주소, 비밀번호, 국가(선호언어), 이름(영문/한글 성명), 생년월일, 외국인등록번호(또는 주민등록번호), 연락처, 비자 타입, 체류(비자) 만료일(외국인 필수), 현재 체류 주소</li>
              <li><strong>서비스 이용 과정 생성 항목:</strong> 접속 IP 정보, 서비스 이용 기록, 예약 신청 및 취소 히스토리</li>
            </ul>

            <h4>3. 개인정보의 보유 및 이용 기간 (Retention & Use Period)</h4>
            <ul>
              <li>원칙적으로 이용자의 <strong>회원 탈퇴 요청 시 해당 개인정보는 지체 없이 파기</strong>됩니다.</li>
              <li>단, 관련 법령에 따라 보존할 필요가 있는 경우 법정 기간 동안 안전하게 보관됩니다:
                <ul>
                  <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
                  <li>웹사이트 방문 기록 및 접속 로그: 3개월 (통신비밀보호법)</li>
                </ul>
              </li>
            </ul>

            <h4>4. 동의 거부 권리 및 불이익 안내 (Right to Refuse & Disadvantages)</h4>
            <p>이용자는 본 개인정보 수집 및 이용 동의를 거부할 권리가 있습니다. 단, 본 동의 항목은 의료 서비스 제공을 위한 <strong>최소한의 필수 수집 항목</strong>이므로 동의를 거부하실 경우 회원가입 및 진료 예약 서비스 이용이 제한될 수 있습니다.</p>
          </div>

          <div style="margin-top: 1.5rem; text-align: center;">
            <button type="button" class="auth-submit-btn" id="btn-confirm-privacy-modal" style="max-width: 200px; margin: 0 auto; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);">확인 (Confirm)</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", privacyModalHTML);

    const privacyModal = document.getElementById("privacy-policy-modal");
    const btnClosePrivacy = document.getElementById("btn-close-privacy-modal");
    const btnConfirmPrivacy = document.getElementById("btn-confirm-privacy-modal");

    if (btnClosePrivacy) {
      btnClosePrivacy.addEventListener("click", () => {
        if (privacyModal) privacyModal.style.display = "none";
      });
    }
    if (btnConfirmPrivacy) {
      btnConfirmPrivacy.addEventListener("click", () => {
        if (privacyModal) privacyModal.style.display = "none";
      });
    }
  }

  /**
   * [한글 주석] 국가(선호언어) 선택 변경에 따른 비자 타입 및 체류 만료일 동적 제어
   */
  function handleCountryLangChange() {
    const selectLang = document.getElementById("signup-country-lang");
    const visaTypeInput = document.getElementById("signup-visa-type");
    const visaExpiryInput = document.getElementById("signup-visa-expiry");
    const visaExpiryGroup = document.getElementById("signup-visa-expiry-group");

    if (!selectLang) return;

    if (selectLang.value === "ko") {
      // 한국어 선택 시: 비자 타입 '내국인' 자동입력, 체류 만료일 숨김 및 required 해제
      if (visaTypeInput) visaTypeInput.value = "내국인";
      if (visaExpiryGroup) visaExpiryGroup.style.display = "none";
      if (visaExpiryInput) {
        visaExpiryInput.required = false;
        visaExpiryInput.value = "";
      }
    } else {
      // 외국어 선택 시: 만료일 표시 및 required 지정, 비자 타입 초기화
      if (visaTypeInput && visaTypeInput.value === "내국인") visaTypeInput.value = "";
      if (visaExpiryGroup) visaExpiryGroup.style.display = "flex";
      if (visaExpiryInput) visaExpiryInput.required = true;
    }
  }

  /**
   * [한글 주석] 모달 내부 탭 스위처 및 닫기 이벤트 핸들러 바인딩
   */
  function bindAuthModalEvents() {
    const modal = document.getElementById("auth-modal");
    const btnClose = document.getElementById("btn-close-auth-modal");
    const tabLogin = document.getElementById("tab-btn-login");
    const tabSignup = document.getElementById("tab-btn-signup");
    const secLogin = document.getElementById("auth-section-login");
    const secSignup = document.getElementById("auth-section-signup");
    const formLogin = document.getElementById("form-auth-login");
    const formSignup = document.getElementById("form-auth-signup");
    const selectLang = document.getElementById("signup-country-lang");

    if (btnClose) {
      btnClose.addEventListener("click", hideAuthModal);
    }
    // [한글 주석] 지시사항에 따라 모달 밖 백드롭 영역 클릭 닫기는 제거함 (X 버튼으로만 닫기 허용)

    if (selectLang) {
      selectLang.addEventListener("change", handleCountryLangChange);
      handleCountryLangChange(); // 초기 렌더링 시 상태 자동 적용
    }

    const btnOpenPrivacy = document.getElementById("btn-open-privacy-detail");
    if (btnOpenPrivacy) {
      btnOpenPrivacy.addEventListener("click", (e) => {
        if (typeof window.showPrivacyPolicyModal === "function") {
          window.showPrivacyPolicyModal(e);
        }
      });
    }

    // 탭 클릭 이벤트
    if (tabLogin && tabSignup) {
      tabLogin.addEventListener("click", () => {
        tabLogin.classList.add("active");
        tabSignup.classList.remove("active");
        secLogin.style.display = "block";
        secSignup.style.display = "none";
      });

      tabSignup.addEventListener("click", () => {
        tabSignup.classList.add("active");
        tabLogin.classList.remove("active");
        secSignup.style.display = "block";
        secLogin.style.display = "none";
      });
    }

    // 로그인 폼 제출 이벤트
    if (formLogin) {
      formLogin.addEventListener("submit", handleLoginSubmit);
    }

    // 회원가입 폼 제출 이벤트
    if (formSignup) {
      formSignup.addEventListener("submit", handleSignUpSubmit);
    }
  }

  /**
   * [한글 주석] 로그인/회원가입 모달 열기 함수 (전역 노출)
   * @param {string} initialTab - "login" 또는 "signup"
   */
  function showAuthModal(initialTab = "login") {
    ensureAuthModalCreated();
    const modal = document.getElementById("auth-modal");
    const tabLogin = document.getElementById("tab-btn-login");
    const tabSignup = document.getElementById("tab-btn-signup");

    if (modal) {
      modal.style.display = "flex";
      document.body.classList.add("modal-open");
      if (initialTab === "signup" && tabSignup) {
        tabSignup.click();
      } else if (tabLogin) {
        tabLogin.click();
      }
    }
  }
  window.showAuthModal = showAuthModal;
  window.showLoginModal = showAuthModal; // 하위 호환성 유지

  /**
   * [한글 주석] 로그인/회원가입 모달 닫기 함수 (전역 노출)
   */
  function hideAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
      modal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
  }
  window.hideAuthModal = hideAuthModal;
  window.hideLoginModal = hideAuthModal; // 하위 호환성 유지

  // =========================================================================
  // 2. 회원가입 & 로그인 실질 로직 핸들러
  // =========================================================================

  /**
   * [한글 주석] 로그인 폼 제출 처리 핸들러
   * - 아이디 또는 이메일과 비밀번호로 로그인 처리합니다.
   */
  async function handleLoginSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-submit-login");
    const accountInput = document.getElementById("login-input-account").value.trim();
    const passwordInput = document.getElementById("login-input-password").value;

    if (!accountInput || !passwordInput) {
      alert("아이디(또는 이메일)와 비밀번호를 모두 입력해 주세요.");
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "로그인 중...";
      }

      await setPersistence(auth, browserSessionPersistence);

      let targetEmail = accountInput;

      // 만약 입력값에 '@'가 없다면 (아이디 입력 시) Firestore에서 해당 loginId의 이메일을 검색
      if (!accountInput.includes("@")) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("loginId", "==", accountInput));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          throw new Error("auth/user-not-found");
        }
        const userDocData = querySnap.docs[0].data();
        targetEmail = userDocData.email;
      }

      // Firebase Auth 로그인 실행
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, passwordInput);
      console.log("ID/PW 로그인 성공:", userCredential.user.uid);

      hideAuthModal();
      alert("로그인되었습니다.");
    } catch (error) {
      console.error("로그인 실패:", error);
      let msg = "로그인에 실패했습니다. 아이디 및 비밀번호를 확인해 주세요.";
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.message === "auth/user-not-found") {
        msg = "등록되지 않은 아이디(이메일)이거나 비밀번호가 일치하지 않습니다.";
      } else if (error.code === "auth/wrong-password") {
        msg = "비밀번호가 일치하지 않습니다.";
      }
      alert(msg);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "로그인";
      }
    }
  }

  /**
   * [한글 주석] 회원가입 폼 제출 처리 핸들러
   * - 12가지 필수 수집 항목에 대해 유효성을 검사하고 계정 생성 및 프로필 데이터를 Firestore에 저장합니다.
   */
  async function handleSignUpSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-submit-signup");

    const loginId = document.getElementById("signup-login-id").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;
    const passwordConfirm = document.getElementById("signup-password-confirm").value;
    const countryLanguage = document.getElementById("signup-country-lang").value;
    const name = document.getElementById("signup-name").value.trim();
    const dob = document.getElementById("signup-dob").value;
    const alienNo = document.getElementById("signup-alien-no").value.trim();
    const phone = document.getElementById("signup-phone").value.trim();
    const visaType = document.getElementById("signup-visa-type").value.trim();
    const visaExpiry = document.getElementById("signup-visa-expiry").value;
    const address = document.getElementById("signup-address").value.trim();

    // 유효성 검증
    const chkPrivacy = document.getElementById("signup-privacy-agree");
    if (!chkPrivacy || !chkPrivacy.checked) {
      alert("개인정보 수집 및 이용 동의에 체크해 주세요.\n(Please agree to the collection and use of personal information.)");
      if (chkPrivacy) chkPrivacy.focus();
      return;
    }

    if (password !== passwordConfirm) {
      alert("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      alert("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "가입 처리 중...";
      }

      // 1. 아이디 중복 체크 (안전한 try-catch 방어)
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("loginId", "==", loginId));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          alert("이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.");
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = "회원가입 완료";
          }
          return;
        }
      } catch (checkErr) {
        console.warn("아이디 중복 검사 경고 (보안 규칙 등):", checkErr);
      }

      // 2. Firebase Auth 이메일/비밀번호 계정 생성
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Firestore users/{uid} 에 사용자 12가지 상세 데이터 저장
      // [한글 주석] ispartners82@gmail.com 계정 또는 ispartners82 아이디로 가입 시 최고 관리자(super_admin) 등급 자동 부여
      const isSuperAdminAccount = (email.toLowerCase() === "ispartners82@gmail.com" || loginId.toLowerCase() === "ispartners82");
      const assignedRole = isSuperAdminAccount ? "super_admin" : "user";

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        loginId: loginId,
        email: email,
        name: name,
        countryLanguage: countryLanguage,
        dob: dob,
        alienNo: alienNo,
        phone: phone,
        visaType: visaType,
        visaExpiry: visaExpiry,
        address: address,
        role: assignedRole,
        createdAt: new Date().toISOString()
      });

      console.log("신규 회원가입 및 프로필 저장 완료:", user.uid);
      alert("회원가입이 성공적으로 완료되었습니다! 환영합니다.");
      hideAuthModal();

    } catch (error) {
      console.error("회원가입 실패 원인 상세:", error);
      let msg = "회원가입 중 오류가 발생했습니다.";

      if (error.code === "auth/email-already-in-use") {
        msg = "이미 등록된 이메일 주소입니다. 다른 이메일 주소를 입력해 주세요.";
      } else if (error.code === "auth/invalid-email") {
        msg = "유효하지 않은 이메일 형식입니다. 정확한 이메일을 입력해 주세요.";
      } else if (error.code === "auth/weak-password") {
        msg = "비밀번호가 너무 취약합니다. 6자리 이상의 안전한 비밀번호를 사용해 주세요.";
      } else if (error.code === "auth/operation-not-allowed") {
        msg = "Firebase 콘솔 설정 오류가 발견되었습니다.\n\n[해결 방법]\nFirebase 콘솔 > Authentication > Sign-in method 메뉴에서 '이메일/비밀번호' 로그인 제공업체를 [사용 설정]으로 활성화해야 회원가입 기능이 작동합니다.";
      } else if (error.code === "permission-denied" || (error.message && error.message.includes("permission"))) {
        msg = "데이터베이스 저장 권한 오류가 발생했습니다. 보안 규칙 설정을 확인해 주세요.";
      } else {
        msg = `회원가입 오류가 발생했습니다.\n(상세 메시지: ${error.message || error.code || "알 수 없는 오류"})`;
      }

      alert(msg);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "회원가입 완료";
      }
    }
  }

  // =========================================================================
  // 3. 글로벌 클릭 리스너 (로그인 / 로그아웃 버튼 대응)
  // =========================================================================
  document.addEventListener("click", async (e) => {
    const target = e.target;
    if (!target) return;

    // 로그인 버튼 클릭 시 모달 팝업 열기
    if (target.id === "btn-login" || target.closest("#btn-login") || target.id === "quick-btn-login" || target.closest("#quick-btn-login")) {
      showAuthModal("login");
    }

    // 로그아웃 버튼 클릭 시 세션 종료
    if (target.id === "btn-logout" || target.closest("#btn-logout")) {
      try {
        if (confirm("로그아웃 하시겠습니까?")) {
          sessionStorage.clear();
          await signOut(auth);
          console.log("User signed out.");
          alert("로그아웃되었습니다.");
        }
      } catch (error) {
        console.error("Sign-out error:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    }
  });

  // =========================================================================
  // 4. Auth 상태 변화 모니터링 (세션 유지 & UI 바인딩)
  // =========================================================================

  /**
   * [성능 최적화] 사용자 역할(role) 세션 캐싱 함수
   */
  async function getCachedUserRole(uid) {
    const cacheKey = `user_role_cache_${uid}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) return cached;

    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const role = userDocSnap.data().role || "user";
        sessionStorage.setItem(cacheKey, role);
        return role;
      }
    } catch (e) {
      console.error("사용자 역할 조회 실패:", e);
    }
    return null;
  }

  /**
   * [성능 최적화] 권한(isAdmin, hasStats) 캐싱 함수
   */
  async function getCachedRolePermissions(userRole) {
    if (!userRole) return { isAdmin: false, hasStats: false };
    const cacheKey = `role_permissions_cache_${userRole}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
      try { return JSON.parse(cached); } catch (e) { }
    }

    let isAdmin = false;
    let hasStats = false;
    try {
      const roleDocRef = doc(db, "roles", userRole);
      const roleDocSnap = await getDoc(roleDocRef);
      if (roleDocSnap.exists()) {
        const roleData = roleDocSnap.data();
        isAdmin = roleData.isAdmin !== undefined ? roleData.isAdmin : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
        hasStats = roleData.hasStats !== undefined ? roleData.hasStats : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
      } else {
        isAdmin = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
        hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
      }
    } catch (e) {
      isAdmin = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
      hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
    }

    const perms = { isAdmin, hasStats };
    try { sessionStorage.setItem(cacheKey, JSON.stringify(perms)); } catch (e) { }
    return perms;
  }

  function clearUserRoleCache(uid) {
    if (uid) {
      sessionStorage.removeItem(`user_role_cache_${uid}`);
      sessionStorage.removeItem(`admin_permissions_cache_${uid}`);
    }
    sessionStorage.clear();
  }
  window.clearUserRoleCache = clearUserRoleCache;

  // 실시간 인증 상태 변경 감지
  onAuthStateChanged(auth, async (user) => {
    const btnLogin = document.getElementById("btn-login");
    const authUserArea = document.getElementById("auth-user");
    const userPhoto = document.getElementById("user-photo");
    const userName = document.getElementById("user-name");
    const btnAdminDashboard = document.getElementById("btn-admin-dashboard");

    const quickBtnMyReservations = document.getElementById("quick-btn-my-reservations");
    const quickBtnAdminDashboard = document.getElementById("quick-btn-admin-dashboard");
    const quickBtnLogin = document.getElementById("quick-btn-login");

    if (user) {
      window.isLoggedIn = true;

      // Firestore에서 유저 프로필 가져와 이름 표출
      let displayName = user.displayName;
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const uData = userDocSnap.data();
          displayName = uData.name || uData.loginId || user.email;
        }
      } catch (err) {
        console.error("User profile load error:", err);
      }

      sessionStorage.setItem("auth_user_cache", JSON.stringify({
        uid: user.uid,
        displayName: displayName || "사용자",
        photoURL: user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c"
      }));

      if (userPhoto) {
        userPhoto.src = user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c";
        userPhoto.onerror = () => {
          userPhoto.src = "https://lh3.googleusercontent.com/a/default-user=s96-c";
        };
      }

      if (userName) {
        userName.textContent = displayName || "사용자";
      }

      if (authUserArea) authUserArea.style.display = "flex";
      if (btnLogin) {
        btnLogin.style.display = "none";
        btnLogin.disabled = false;
        btnLogin.textContent = "로그인";
      }

      if (quickBtnMyReservations) quickBtnMyReservations.style.display = "inline-flex";
      if (quickBtnLogin) quickBtnLogin.style.display = "none";

      // [한글 주석: 로그인한 회원에게만 상단 '커뮤니티' 메뉴 노출 처리]
      const communityMenuItems = document.querySelectorAll(".nav-community-item, #nav-item-community");
      communityMenuItems.forEach(item => {
        item.style.display = "inline-block";
        item.classList.add("logged-in");
      });

      try {
        const userRole = await getCachedUserRole(user.uid);
        let isAdmin = false;
        let hasStats = false;
        let roleLabel = "일반회원";

        if (userRole) {
          const perms = await getCachedRolePermissions(userRole);
          isAdmin = perms.isAdmin;
          hasStats = perms.hasStats;

          // 역할 키별 한국어 명칭 동적 결정
          try {
            const roleDocSnap = await getDoc(doc(db, "roles", userRole));
            if (roleDocSnap.exists() && roleDocSnap.data().label) {
              roleLabel = roleDocSnap.data().label;
            } else {
              if (userRole === "super_admin") roleLabel = "최고관리자";
              else if (userRole === "admin") roleLabel = "관리자";
              else if (userRole === "partner") roleLabel = "협력사";
              else if (userRole === "regular") roleLabel = "정회원";
            }
          } catch (rErr) {
            if (userRole === "super_admin") roleLabel = "최고관리자";
            else if (userRole === "admin") roleLabel = "관리자";
            else if (userRole === "partner") roleLabel = "협력사";
          }
        }

        // 커뮤니티 전용 사이드바 프로필 실시간 동기화
        const sidebarNameEl = document.getElementById("sidebar-user-name");
        const sidebarBadgeEl = document.getElementById("sidebar-user-badge");
        if (sidebarNameEl && displayName) sidebarNameEl.textContent = displayName;
        if (sidebarBadgeEl) sidebarBadgeEl.textContent = roleLabel;

        const currentAdminBtn = document.getElementById("btn-admin-dashboard");
        const currentStatsBtn = document.getElementById("btn-stats-dashboard");
        const currentQuickAdminBtn = document.getElementById("quick-btn-admin-dashboard");
        const currentQuickStatsBtn = document.getElementById("quick-btn-stats-dashboard");

        if (currentAdminBtn && isAdmin) currentAdminBtn.style.display = "inline-flex";
        if (currentStatsBtn && hasStats) currentStatsBtn.style.display = "inline-flex";
        if (currentQuickAdminBtn && isAdmin) currentQuickAdminBtn.style.display = "inline-flex";
        if (currentQuickStatsBtn && hasStats) currentQuickStatsBtn.style.display = "inline-flex";
      } catch (error) {
        console.error("사용자 권한 확인 실패:", error);
      }

      hideAuthModal();
    } else {
      const hasUserCache = sessionStorage.getItem("auth_user_cache");
      if (!hasUserCache) {
        window.isLoggedIn = false;
        if (userPhoto) userPhoto.src = "";
        if (userName) userName.textContent = "";

        if (authUserArea) authUserArea.style.display = "none";
        if (btnLogin) {
          btnLogin.style.display = "block";
          btnLogin.disabled = false;
          btnLogin.textContent = "로그인";
        }
      }

      // [한글 주석: 비로그인/로그아웃 상태 시에도 상단 '커뮤니티' 메뉴는 항상 노출되도록 유지]
      const communityMenuItems = document.querySelectorAll(".nav-community-item, #nav-item-community");
      communityMenuItems.forEach(item => {
        item.style.display = "inline-block";
        item.classList.remove("logged-in");
      });

      if (quickBtnMyReservations) quickBtnMyReservations.style.display = "none";
      if (quickBtnAdminDashboard) quickBtnAdminDashboard.style.display = "none";
      const quickBtnStatsDashboard = document.getElementById("quick-btn-stats-dashboard");
      if (quickBtnStatsDashboard) quickBtnStatsDashboard.style.display = "none";
      if (quickBtnLogin) quickBtnLogin.style.display = "inline-flex";

      if (btnAdminDashboard) btnAdminDashboard.style.display = "none";
      const btnStatsDashboard = document.getElementById("btn-stats-dashboard");
      if (btnStatsDashboard) btnStatsDashboard.style.display = "none";

      Object.keys(sessionStorage)
        .filter(key => key.startsWith("user_role_cache_") || key.startsWith("admin_permissions_cache_"))
        .forEach(key => sessionStorage.removeItem(key));
    }
  });

});

