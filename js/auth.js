import { auth, db } from "./firebase-db.js?v=261120_4";
import {
  buildCountryLangSelectOptionsHtml,
  buildRolePermissions
} from "./lang-config.js?v=261120_4";
import { escapeHtml } from "./common-utils.js?v=261120_4";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot, limit } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * IGPartners 회원가입 & 로그인 모듈
 * - 아이디/비밀번호 기반 회원가입 및 로그인 기능을 수행합니다.
 * - 회원가입 시 수집 항목: 아이디, 비밀번호, 비밀번호 재확인, 국가(선호언어), 이름, 생년월일, 외국인등록번호, 체류주소, 이메일, 연락처, 비자타입, 비자만료일
 * - Firestore `users/{uid}` 컬렉션 문서로 회원 프로필 데이터를 저장하여 안전하게 관리합니다.
 * - 세션 캐싱(sessionStorage)으로 DB 읽기를 최소화하며 무료 요금제(Spark Plan) 법칙을 준수합니다.
 */

function initAuthModule() {

  // =========================================================================
  // 1. 회원가입 / 로그인 통합 모달 UI 동적 생성 및 관리
  // =========================================================================

  /**
   * 회원가입 및 로그인 모달 HTML 돔 구조가 없을 경우 동적 생성해주는 함수
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
            <form id="form-auth-login" autocomplete="off">
              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="login-input-account">아이디 또는 이메일 (ID or Email) <span class="req">*</span></label>
                <input type="text" id="login-input-account" required placeholder="아이디 또는 이메일 주소를 입력해 주세요" autocomplete="username">
              </div>
              <div class="auth-form-group" style="margin-bottom: 1.5rem;">
                <label for="login-input-password">비밀번호 (Password) <span class="req">*</span></label>
                <input type="password" id="login-input-password" required placeholder="비밀번호를 입력해 주세요" autocomplete="current-password">
              </div>
              <button type="submit" class="auth-submit-btn" id="btn-submit-login">로그인 (Sign In)</button>
            </form>

            <!-- 로그인 보조 메뉴: 아이디 찾기 및 비밀번호 찾기 -->
            <div class="auth-helper-links">
              <button type="button" class="auth-helper-btn" id="btn-open-find-id">아이디 찾기 (Find ID)</button>
              <span class="auth-helper-divider" aria-hidden="true">|</span>
              <button type="button" class="auth-helper-btn" id="btn-open-find-pwd">비밀번호 찾기 (Reset Password)</button>
            </div>
          </div>

          <!-- 아이디 찾기 영역 -->
          <div id="auth-section-find-id" style="display: none;">
            <div class="auth-subpanel-header">
              <h3 class="auth-subpanel-title">🔍 아이디 찾기 <span class="auth-subpanel-sub">(Find ID)</span></h3>
              <button type="button" class="auth-back-btn" id="btn-back-login-from-find-id">&larr; 로그인으로 돌아가기</button>
            </div>
            <p class="auth-subpanel-desc">가입 시 등록하신 <strong>이름</strong>과 <strong>이메일 또는 연락처</strong>를 입력하시면 아이디를 확인하실 수 있습니다.</p>
            <form id="form-auth-find-id" autocomplete="off">
              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="find-id-name">이름 (성명) / Full Name <span class="req">*</span></label>
                <input type="text" id="find-id-name" required placeholder="가입 시 입력한 이름 (예: 홍길동)" autocomplete="off">
              </div>
              <div class="auth-form-group" style="margin-bottom: 1.25rem;">
                <label for="find-id-contact">이메일 또는 연락처 (Email or Phone) <span class="req">*</span></label>
                <input type="text" id="find-id-contact" required placeholder="예: user@gmail.com 또는 010-1234-5678" autocomplete="off">
              </div>
              <button type="submit" class="auth-submit-btn" id="btn-submit-find-id">아이디 찾기 (Find ID)</button>
            </form>
            <div id="find-id-result" class="auth-result-box" style="display: none;"></div>
          </div>

          <!-- 비밀번호 찾기 (재설정 메일 발송) 영역 -->
          <div id="auth-section-find-pwd" style="display: none;">
            <div class="auth-subpanel-header">
              <h3 class="auth-subpanel-title">🔑 비밀번호 찾기 <span class="auth-subpanel-sub">(Reset Password)</span></h3>
              <button type="button" class="auth-back-btn" id="btn-back-login-from-find-pwd">&larr; 로그인으로 돌아가기</button>
            </div>
            <p class="auth-subpanel-desc">가입 시 등록하신 <strong>아이디(또는 이메일)</strong>와 <strong>이름</strong>을 입력하시면 비밀번호 재설정 메일을 보내드립니다.</p>
            <form id="form-auth-find-pwd" autocomplete="off">
              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="find-pwd-account">아이디 또는 이메일 (ID or Email) <span class="req">*</span></label>
                <input type="text" id="find-pwd-account" required placeholder="아이디 또는 이메일 주소를 입력해 주세요" autocomplete="off">
              </div>
              <div class="auth-form-group" style="margin-bottom: 1.15rem;">
                <label for="find-pwd-name">이름 (성명) / Full Name <span class="req">*</span></label>
                <input type="text" id="find-pwd-name" required placeholder="가입 시 입력한 이름 (예: 홍길동)" autocomplete="off">
              </div>

              <!-- 메일 미수신 또는 오기입 시 공식 카카오톡 1:1 문의 안내 및 버튼 -->
              <div class="auth-kakao-help-box">
                <p class="auth-kakao-help-text">가입시 정확한 메일을 입력하지 않았거나 재설정 메일 발송이 되지 않으면 카카오톡으로 문의주세요</p>
                <a href="http://pf.kakao.com/_YxoxjfX/chat" target="_blank" rel="noopener noreferrer" class="auth-kakao-btn">
                  <svg class="kakao-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path fill-rule="evenodd" clip-rule="evenodd" d="M12 3C6.47715 3 2 6.47715 2 10.7647C2 13.468 3.75475 15.8361 6.42551 17.2023C6.23075 17.8967 5.53982 20.3705 5.48512 20.6698C5.41438 21.0568 5.72753 21.0505 5.92209 20.9225C6.18241 20.7513 10.0249 18.1723 11.2721 17.3292C11.5126 17.3501 11.7547 17.3614 12 17.3614C17.5228 17.3614 22 13.8842 22 9.59666C22 5.30911 17.5228 3 12 3Z" fill="#191919" />
                  </svg>
                  <span>카톡문의</span>
                </a>
              </div>

              <button type="submit" class="auth-submit-btn" id="btn-submit-find-pwd" style="margin-top: 1rem;">재설정 메일 발송 (Send Reset Email)</button>
            </form>
            <div id="find-pwd-result" class="auth-result-box" style="display: none;"></div>
          </div>

          <!-- 회원가입 폼 영역 (12개 입력 항목) -->
          <!-- autocomplete="off"를 지정하여 브라우저 자동완성이 회원가입 입력창을 덮어쓰는 보안 취약점 원천 차단 -->
          <div id="auth-section-signup" style="display: none;">
            <form id="form-auth-signup" autocomplete="off">
              <div class="auth-form-grid">
                
                <!-- 1. 국가(선호언어) 선택 (최상단 배치) -->
                <div class="auth-form-group auth-field-full">
                  <label for="signup-country-lang">국가 (선호언어) / Country (Language) <span class="req">*</span></label>
                  <select id="signup-country-lang" required autocomplete="off">
                    ${buildCountryLangSelectOptionsHtml("ko")}
                  </select>
                </div>

                <!-- 2. 아이디 -->
                <div class="auth-form-group">
                  <label for="signup-login-id">아이디 (ID) <span class="req">*</span></label>
                  <input type="text" id="signup-login-id" required placeholder="예: user123" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
                </div>

                <!-- 3. 이메일 -->
                <div class="auth-form-group">
                  <label for="signup-email">이메일 (Email) <span class="req">*</span></label>
                  <input type="email" id="signup-email" required placeholder="예: user@gmail.com" autocomplete="off">
                </div>

                <!-- 4. 비밀번호 (new-password로 지정하여 기존 로그인 비밀번호 자동 채움 차단) -->
                <div class="auth-form-group">
                  <label for="signup-password">비밀번호 (Password) <span class="req">*</span></label>
                  <input type="password" id="signup-password" required placeholder="6자 이상 입력" autocomplete="new-password">
                </div>

                <!-- 5. 비밀번호 재입력 -->
                <div class="auth-form-group">
                  <label for="signup-password-confirm">비밀번호 확인 (Confirm Password) <span class="req">*</span></label>
                  <input type="password" id="signup-password-confirm" required placeholder="비밀번호 재입력" autocomplete="new-password">
                </div>

                <!-- 6. 이름 -->
                <div class="auth-form-group">
                  <label for="signup-name">이름 (성명) / Full Name <span class="req">*</span></label>
                  <input type="text" id="signup-name" required placeholder="예: 홍길동" autocomplete="off">
                </div>

                <!-- 7. 생년월일 -->
                <div class="auth-form-group">
                  <label for="signup-dob">생년월일 (Date of Birth) <span class="req">*</span></label>
                  <input type="date" id="signup-dob" required autocomplete="off">
                </div>

                <!-- 8. 외국인등록번호(주민등록번호) -->
                <div class="auth-form-group">
                  <label for="signup-alien-no">외국인등록번호(주민번호) / ARC (Resident No.) <span class="req">*</span></label>
                  <input type="text" id="signup-alien-no" required placeholder="예: 950101-1******" autocomplete="off">
                </div>

                <!-- 9. 연락처 -->
                <div class="auth-form-group">
                  <label for="signup-phone">연락처 (Phone Number) <span class="req">*</span></label>
                  <input type="tel" id="signup-phone" required placeholder="예: 010-1234-5678" autocomplete="off">
                </div>

                <!-- 10. 비자 타입 -->
                <div class="auth-form-group">
                  <label for="signup-visa-type">비자 타입 (Visa Type) <span class="req">*</span></label>
                  <input type="text" id="signup-visa-type" required placeholder="예: 내국인,D-2, E-9 등" autocomplete="off">
                </div>

                <!-- 11. 체류(비자) 만료일 -->
                <div class="auth-form-group" id="signup-visa-expiry-group">
                  <label for="signup-visa-expiry">체류(비자) 만료일 (Visa Expiry Date) <span class="req">*</span></label>
                  <input type="date" id="signup-visa-expiry" required autocomplete="off">
                </div>

                <!-- 12. 현재 체류 주소 (전체 너비) -->
                <div class="auth-form-group auth-field-full">
                  <label for="signup-address">현재 체류 주소 (Current Address) <span class="req">*</span></label>
                  <input type="text" id="signup-address" required placeholder="예: 대구광역시 수성구 알파시티로 1로 4길 8" autocomplete="off">
                </div>

              </div>

              <!-- 개인정보 수집 및 이용 동의 체크박스 영역 -->
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
   * 약관 상세 팝업 모달을 여는 전역 오픈 함수
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
   * 개인정보 수집 및 이용 동의 약관 상세 모달 HTML 동적 생성 함수
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
   * 국가(선호언어) 선택 변경에 따른 비자 타입 및 체류 만료일 동적 제어
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
   * 모달 내부 탭 스위처, 아이디/비밀번호 찾기 전환 및 닫기 이벤트 핸들러 바인딩
   */
  function bindAuthModalEvents() {
    const modal = document.getElementById("auth-modal");
    const btnClose = document.getElementById("btn-close-auth-modal");
    const tabLogin = document.getElementById("tab-btn-login");
    const tabSignup = document.getElementById("tab-btn-signup");
    const secLogin = document.getElementById("auth-section-login");
    const secSignup = document.getElementById("auth-section-signup");
    const secFindId = document.getElementById("auth-section-find-id");
    const secFindPwd = document.getElementById("auth-section-find-pwd");
    const formLogin = document.getElementById("form-auth-login");
    const formSignup = document.getElementById("form-auth-signup");
    const formFindId = document.getElementById("form-auth-find-id");
    const formFindPwd = document.getElementById("form-auth-find-pwd");
    const btnOpenFindId = document.getElementById("btn-open-find-id");
    const btnOpenFindPwd = document.getElementById("btn-open-find-pwd");
    const btnBackFromFindId = document.getElementById("btn-back-login-from-find-id");
    const btnBackFromFindPwd = document.getElementById("btn-back-login-from-find-pwd");
    const selectLang = document.getElementById("signup-country-lang");

    if (btnClose) {
      btnClose.addEventListener("click", hideAuthModal);
    }
    // 지시사항에 따라 모달 밖 백드롭 영역 클릭 닫기는 제거함 (X 버튼으로만 닫기 허용)

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

    // 아이디 찾기 / 비밀번호 찾기 입력값 및 결과 박스 초기화 함수
    function resetRecoveryForms() {
      if (formFindId) formFindId.reset();
      if (formFindPwd) formFindPwd.reset();
      const findIdResult = document.getElementById("find-id-result");
      const findPwdResult = document.getElementById("find-pwd-result");
      if (findIdResult) {
        findIdResult.style.display = "none";
        findIdResult.classList.remove("error");
        findIdResult.innerHTML = "";
      }
      if (findPwdResult) {
        findPwdResult.style.display = "none";
        findPwdResult.classList.remove("error");
        findPwdResult.innerHTML = "";
      }
    }
    window.resetRecoveryForms = resetRecoveryForms;

    // 로그인 / 회원가입 / 아이디 찾기 / 비밀번호 찾기 화면 전환 통합 헬퍼
    function switchAuthSection(mode) {
      if (secLogin) secLogin.style.display = mode === "login" ? "block" : "none";
      if (secSignup) secSignup.style.display = mode === "signup" ? "block" : "none";
      if (secFindId) secFindId.style.display = mode === "find-id" ? "block" : "none";
      if (secFindPwd) secFindPwd.style.display = mode === "find-pwd" ? "block" : "none";

      if (tabLogin && tabSignup) {
        if (mode === "signup") {
          tabSignup.classList.add("active");
          tabLogin.classList.remove("active");
        } else {
          tabLogin.classList.add("active");
          tabSignup.classList.remove("active");
        }
      }

      if (mode === "find-id" || mode === "find-pwd") {
        resetRecoveryForms();
      }
    }
    window.switchAuthSection = switchAuthSection;

    // 회원가입 폼 보안 초기화 함수 - 브라우저 자동완성 오작동 및 이전 잔여 계정 데이터 완전 소거
    function resetSignupForm() {
      const formSignup = document.getElementById("form-auth-signup");
      if (formSignup) {
        formSignup.reset();
      }
      // 브라우저 AutoFill이 강제로 밀어 넣은 잔여 값들을 빈 문자열로 강제 소거
      const clearIds = [
        "signup-login-id", "signup-email", "signup-password", "signup-password-confirm",
        "signup-name", "signup-dob", "signup-alien-no", "signup-phone", "signup-address"
      ];
      clearIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });

      const privacyAgree = document.getElementById("signup-privacy-agree");
      if (privacyAgree) privacyAgree.checked = false;

      // 한국어 선택 기본값에 따른 비자타입 자동 재설정
      if (typeof handleCountryLangChange === "function") {
        handleCountryLangChange();
      }
    }
    window.resetSignupForm = resetSignupForm;

    // 탭 클릭 이벤트
    if (tabLogin && tabSignup) {
      tabLogin.addEventListener("click", () => {
        switchAuthSection("login");
      });

      tabSignup.addEventListener("click", () => {
        switchAuthSection("signup");
        // 회원가입 탭 클릭 시 이전 로그인 자격증명이 노출되지 않도록 강제 리셋
        resetSignupForm();
      });
    }

    // 아이디 찾기 / 비밀번호 찾기 진입 및 로그인 복귀 버튼 이벤트
    if (btnOpenFindId) {
      btnOpenFindId.addEventListener("click", () => switchAuthSection("find-id"));
    }
    if (btnOpenFindPwd) {
      btnOpenFindPwd.addEventListener("click", () => switchAuthSection("find-pwd"));
    }
    if (btnBackFromFindId) {
      btnBackFromFindId.addEventListener("click", () => switchAuthSection("login"));
    }
    if (btnBackFromFindPwd) {
      btnBackFromFindPwd.addEventListener("click", () => switchAuthSection("login"));
    }

    // 로그인 폼 제출 이벤트
    if (formLogin) {
      formLogin.addEventListener("submit", handleLoginSubmit);
    }

    // 회원가입 폼 제출 이벤트
    if (formSignup) {
      formSignup.addEventListener("submit", handleSignUpSubmit);
    }

    // 아이디 찾기 및 비밀번호 찾기 폼 제출 이벤트
    if (formFindId) {
      formFindId.addEventListener("submit", handleFindIdSubmit);
    }
    if (formFindPwd) {
      formFindPwd.addEventListener("submit", handleFindPasswordSubmit);
    }
  }

  /**
   * 로그인/회원가입 모달 열기 함수 (전역 노출)
   * @param {string} initialTab - "login" 또는 "signup"
   */
  function showAuthModal(initialTab = "login") {
    ensureAuthModalCreated();
    const modal = document.getElementById("auth-modal");
    const tabLogin = document.getElementById("tab-btn-login");
    const tabSignup = document.getElementById("tab-btn-signup");

    if (modal) {
      // 모달 오픈 시 폼 잔여 데이터 깨끗이 비우기
      if (typeof window.resetSignupForm === "function") {
        window.resetSignupForm();
      }
      if (typeof window.resetRecoveryForms === "function") {
        window.resetRecoveryForms();
      }
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
   * 로그인/회원가입 모달 닫기 함수 (전역 노출)
   */
  function hideAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
      modal.style.display = "none";
      document.body.classList.remove("modal-open");
      // 모달 닫기 시 잔여 비밀번호 및 찾기 입력값 소거
      if (typeof window.resetSignupForm === "function") {
        window.resetSignupForm();
      }
      if (typeof window.resetRecoveryForms === "function") {
        window.resetRecoveryForms();
      }
    }
  }
  window.hideAuthModal = hideAuthModal;
  window.hideLoginModal = hideAuthModal; // 하위 호환성 유지

  // =========================================================================
  // 1-2. 개인정보 수정 및 비밀번호 변경 (마이페이지) 모달 UI 동적 생성 및 관리
  // =========================================================================

  /**
   * 개인정보 수정 및 비밀번호 변경 모달 HTML 구조를 동적으로 생성하는 함수
   */
  function ensureProfileModalCreated() {
    if (document.getElementById("profile-edit-modal")) return;

    const profileModalHTML = `
      <div id="profile-edit-modal" class="auth-modal-backdrop" style="display: none; z-index: 999998;">
        <div class="auth-modal-card profile-modal-card">
          <button type="button" class="auth-modal-close" id="btn-close-profile-modal">&times;</button>
          
          <!-- 모달 상단 타이틀 -->
          <div class="profile-modal-header">
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 0.5rem;">
              <span>👤</span> 내 정보 관리 <span style="font-size: 0.9rem; color: #94a3b8; font-weight: 500;">(My Profile)</span>
            </h3>
          </div>

          <!-- 정보수정 / 비밀번호 변경 탭 헤더 -->
          <div class="auth-nav-tabs" style="margin-top: 1rem;">
            <button type="button" class="auth-tab-btn active" id="profile-tab-btn-info">📝 회원정보 수정 (Edit Info)</button>
            <button type="button" class="auth-tab-btn" id="profile-tab-btn-pwd">🔒 비밀번호 변경 (Password)</button>
          </div>

          <!-- 탭 1: 회원정보 수정 영역 -->
          <div id="profile-section-info">
            <form id="form-profile-info">
              <div class="auth-form-grid">
                
                <!-- 1. 국가(선호언어) 선택 -->
                <div class="auth-form-group auth-field-full">
                  <label for="profile-country-lang">국가 (선호언어) / Country (Language) <span class="req">*</span></label>
                  <select id="profile-country-lang" required>
                    ${buildCountryLangSelectOptionsHtml()}
                  </select>
                </div>

                <!-- 2. 아이디 (수정 불가) -->
                <div class="auth-form-group">
                  <label for="profile-login-id">아이디 (ID) <span style="font-size: 0.75rem; color: #64748b;">(변경불가)</span></label>
                  <input type="text" id="profile-login-id" readonly disabled class="input-readonly">
                </div>

                <!-- 3. 이메일 (수정 불가) -->
                <div class="auth-form-group">
                  <label for="profile-email">이메일 (Email) <span style="font-size: 0.75rem; color: #64748b;">(변경불가)</span></label>
                  <input type="email" id="profile-email" readonly disabled class="input-readonly">
                </div>

                <!-- 4. 이름 (수정 가능) -->
                <div class="auth-form-group">
                  <label for="profile-name">이름 (성명) / Full Name <span class="req">*</span></label>
                  <input type="text" id="profile-name" required placeholder="예: 홍길동">
                </div>

                <!-- 5. 연락처 (수정 가능) -->
                <div class="auth-form-group">
                  <label for="profile-phone">연락처 (Phone Number) <span class="req">*</span></label>
                  <input type="tel" id="profile-phone" required placeholder="예: 010-1234-5678">
                </div>

                <!-- 6. 비자 타입 (수정 가능) -->
                <div class="auth-form-group">
                  <label for="profile-visa-type">비자 타입 (Visa Type) <span class="req">*</span></label>
                  <input type="text" id="profile-visa-type" required placeholder="예: 내국인, D-2, E-9 등">
                </div>

                <!-- 7. 체류 만료일 (외국인일 때 활성화) -->
                <div class="auth-form-group" id="profile-visa-expiry-group">
                  <label for="profile-visa-expiry">체류 만료일 (Visa Expiry Date)</label>
                  <input type="date" id="profile-visa-expiry">
                </div>

                <!-- 8. 현재 체류 주소 (수정 가능) -->
                <div class="auth-form-group auth-field-full">
                  <label for="profile-address">현재 체류 주소 (Current Address) <span class="req">*</span></label>
                  <input type="text" id="profile-address" required placeholder="예: 대구광역시 수성구 알파시티1로 4길 8">
                </div>

                <!-- 9. 생년월일 (수정 불가 식별자) -->
                <div class="auth-form-group">
                  <label for="profile-dob">생년월일 (Date of Birth) <span style="font-size: 0.75rem; color: #64748b;">(변경불가)</span></label>
                  <input type="text" id="profile-dob" readonly disabled class="input-readonly">
                </div>

                <!-- 10. 외국인등록번호/주민번호 (수정 불가 식별자) -->
                <div class="auth-form-group">
                  <label for="profile-alien-no">외국인등록번호 / ARC <span style="font-size: 0.75rem; color: #64748b;">(변경불가)</span></label>
                  <input type="text" id="profile-alien-no" readonly disabled class="input-readonly">
                </div>

              </div>

              <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" class="auth-btn-secondary" id="btn-cancel-profile-info" style="padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.05); color: #cbd5e1; font-weight: 600; cursor: pointer;">닫기</button>
                <button type="submit" class="auth-submit-btn" id="btn-submit-profile-info" style="margin-top: 0; width: auto; min-width: 140px; padding: 0.75rem 1.5rem;">저장하기 (Save)</button>
              </div>
            </form>
          </div>

          <!-- 탭 2: 비밀번호 변경 영역 -->
          <div id="profile-section-pwd" style="display: none;">
            <form id="form-profile-pwd">
              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="profile-current-password">현재 비밀번호 (Current Password) <span class="req">*</span></label>
                <input type="password" id="profile-current-password" required placeholder="현재 비밀번호를 입력해 주세요">
              </div>

              <div class="auth-form-group" style="margin-bottom: 1rem;">
                <label for="profile-new-password">새 비밀번호 (New Password) <span class="req">*</span></label>
                <input type="password" id="profile-new-password" required placeholder="6자 이상 영문/숫자 입력">
              </div>

              <div class="auth-form-group" style="margin-bottom: 1.5rem;">
                <label for="profile-confirm-password">새 비밀번호 확인 (Confirm New Password) <span class="req">*</span></label>
                <input type="password" id="profile-confirm-password" required placeholder="새 비밀번호를 다시 입력해 주세요">
              </div>

              <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button type="button" class="auth-btn-secondary" id="btn-cancel-profile-pwd" style="padding: 0.75rem 1.25rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.05); color: #cbd5e1; font-weight: 600; cursor: pointer;">취소</button>
                <button type="submit" class="auth-submit-btn" id="btn-submit-profile-pwd" style="margin-top: 0; width: auto; min-width: 160px; padding: 0.75rem 1.5rem; background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);">비밀번호 변경</button>
              </div>
            </form>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", profileModalHTML);
    bindProfileModalEvents();
  }

  /**
   * 프로필 모달 이벤트 바인딩 함수
   */
  function bindProfileModalEvents() {
    const btnClose = document.getElementById("btn-close-profile-modal");
    const btnCancelInfo = document.getElementById("btn-cancel-profile-info");
    const btnCancelPwd = document.getElementById("btn-cancel-profile-pwd");
    const tabInfo = document.getElementById("profile-tab-btn-info");
    const tabPwd = document.getElementById("profile-tab-btn-pwd");
    const secInfo = document.getElementById("profile-section-info");
    const secPwd = document.getElementById("profile-section-pwd");
    const formInfo = document.getElementById("form-profile-info");
    const formPwd = document.getElementById("form-profile-pwd");
    const selectLang = document.getElementById("profile-country-lang");

    if (btnClose) btnClose.addEventListener("click", hideProfileModal);
    if (btnCancelInfo) btnCancelInfo.addEventListener("click", hideProfileModal);
    if (btnCancelPwd) btnCancelPwd.addEventListener("click", hideProfileModal);

    // 언어 변경 시 비자 입력 필드 제어
    if (selectLang) {
      selectLang.addEventListener("change", handleProfileCountryLangChange);
    }

    // 탭 전환 이벤트
    if (tabInfo && tabPwd) {
      tabInfo.addEventListener("click", () => {
        tabInfo.classList.add("active");
        tabPwd.classList.remove("active");
        if (secInfo) secInfo.style.display = "block";
        if (secPwd) secPwd.style.display = "none";
      });

      tabPwd.addEventListener("click", () => {
        tabPwd.classList.add("active");
        tabInfo.classList.remove("active");
        if (secPwd) secPwd.style.display = "block";
        if (secInfo) secInfo.style.display = "none";
      });
    }

    // 회원정보 수정 제출 이벤트
    if (formInfo) {
      formInfo.addEventListener("submit", handleProfileInfoSubmit);
    }

    // 비밀번호 변경 제출 이벤트
    if (formPwd) {
      formPwd.addEventListener("submit", handleProfilePasswordSubmit);
    }
  }

  /**
   * 프로필 수정 모달 내 국가(언어) 변경 시 비자 제어
   */
  function handleProfileCountryLangChange() {
    const selectLang = document.getElementById("profile-country-lang");
    const visaTypeInput = document.getElementById("profile-visa-type");
    const visaExpiryInput = document.getElementById("profile-visa-expiry");
    const visaExpiryGroup = document.getElementById("profile-visa-expiry-group");

    if (!selectLang) return;

    if (selectLang.value === "ko") {
      if (visaTypeInput && !visaTypeInput.value) visaTypeInput.value = "내국인";
      if (visaExpiryGroup) visaExpiryGroup.style.display = "none";
      if (visaExpiryInput) visaExpiryInput.required = false;
    } else {
      if (visaTypeInput && visaTypeInput.value === "내국인") visaTypeInput.value = "";
      if (visaExpiryGroup) visaExpiryGroup.style.display = "flex";
    }
  }

  /**
   * 프로필 수정 모달 열기 함수 (전역 노출)
   * - Firebase Auth currentUser 및 세션 캐시(auth_user_cache)를 모두 지원하여 0초 만에 즉시 열림 보장
   */
  async function showProfileModal() {
    let user = auth.currentUser;
    let cachedUser = null;
    try {
      const c = sessionStorage.getItem("auth_user_cache");
      if (c) cachedUser = JSON.parse(c);
    } catch (e) {}

    const uid = user ? user.uid : (cachedUser ? cachedUser.uid : null);
    const email = user ? user.email : (cachedUser ? cachedUser.email : "");
    const displayName = user ? user.displayName : (cachedUser ? cachedUser.displayName : "");

    if (!uid && !email) {
      showAuthModal("login");
      return;
    }

    ensureProfileModalCreated();
    const modal = document.getElementById("profile-edit-modal");
    const tabInfo = document.getElementById("profile-tab-btn-info");
    if (tabInfo) tabInfo.click();

    // 폼 기본값 초기화 및 로딩 상태 설정
    const nameInput = document.getElementById("profile-name");
    const emailInput = document.getElementById("profile-email");
    const loginIdInput = document.getElementById("profile-login-id");
    const phoneInput = document.getElementById("profile-phone");
    const selectLang = document.getElementById("profile-country-lang");
    const visaTypeInput = document.getElementById("profile-visa-type");
    const visaExpiryInput = document.getElementById("profile-visa-expiry");
    const addressInput = document.getElementById("profile-address");
    const dobInput = document.getElementById("profile-dob");
    const alienNoInput = document.getElementById("profile-alien-no");

    if (emailInput) emailInput.value = email || "";
    if (nameInput) nameInput.value = displayName || "";
    if (loginIdInput) loginIdInput.value = email.split("@")[0] || "";

    if (modal) {
      modal.style.display = "flex";
      document.body.classList.add("modal-open");
    }

    if (uid) {
      try {
        // Firestore에서 사용자 상세 프로필 데이터 로드
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (loginIdInput) loginIdInput.value = data.loginId || email.split("@")[0];
          if (nameInput && data.name) nameInput.value = data.name;
          if (phoneInput) phoneInput.value = data.phone || "";
          if (selectLang && data.countryLanguage) selectLang.value = data.countryLanguage;
          if (visaTypeInput) visaTypeInput.value = data.visaType || (data.countryLanguage === "ko" ? "내국인" : "");
          if (visaExpiryInput) visaExpiryInput.value = data.visaExpiry || "";
          if (addressInput) addressInput.value = data.address || "";
          if (dobInput) dobInput.value = data.dob || "-";
          
          if (alienNoInput) {
            // 외국인등록번호 마스킹 (예: 950101-1******)
            if (data.alienNo && data.alienNo.length >= 7) {
              alienNoInput.value = data.alienNo.substring(0, 7) + "******";
            } else {
              alienNoInput.value = data.alienNo || "-";
            }
          }
        }
        handleProfileCountryLangChange();
      } catch (err) {
        console.error("[auth] 사용자 프로필 로드 실패:", err);
      }
    }
  }
  window.showProfileModal = showProfileModal;

  // 전역 이벤트 위임(Event Delegation)으로 헤더/사이드바 사용자 프로필 클릭 시 100% 모달 오픈 보장
  document.addEventListener("click", (e) => {
    const profileTrigger = e.target.closest(".user-capsule, #user-badge, #user-name, #user-photo, #sidebar-user-name, .cafe-user-badge");
    if (profileTrigger) {
      e.preventDefault();
      e.stopPropagation();
      showProfileModal();
    }
  });

  /**
   * 프로필 수정 모달 닫기 함수
   */
  function hideProfileModal() {
    const modal = document.getElementById("profile-edit-modal");
    if (modal) {
      modal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
  }
  window.hideProfileModal = hideProfileModal;

  /**
   * 프로필 기본 정보 수정 폼 제출 핸들러
   */
  async function handleProfileInfoSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }

    const btnSubmit = document.getElementById("btn-submit-profile-info");
    const name = document.getElementById("profile-name").value.trim();
    const phone = document.getElementById("profile-phone").value.trim();
    const countryLanguage = document.getElementById("profile-country-lang").value;
    const visaType = document.getElementById("profile-visa-type").value.trim();
    const visaExpiry = document.getElementById("profile-visa-expiry").value;
    const address = document.getElementById("profile-address").value.trim();

    if (!name || !phone || !visaType || !address) {
      alert("필수 항목(*)을 모두 입력해 주세요.");
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "저장 중...";
      }

      // 1. Firebase Auth 프로필 displayName 업데이트
      if (user.displayName !== name) {
        await updateProfile(user, { displayName: name });
      }

      // 2. Firestore users 문서 업데이트
      const updateData = {
        name: name,
        phone: phone,
        countryLanguage: countryLanguage,
        visaType: visaType,
        visaExpiry: visaExpiry || "",
        address: address,
        updatedAt: new Date().toISOString()
      };

      const userDocRef = doc(db, "users", user.uid);
      await setDoc(userDocRef, updateData, { merge: true });

      // 3. 세션 캐시 및 상단 UI 즉시 갱신
      const userCache = {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: user.photoURL || ""
      };
      sessionStorage.setItem("auth_user_cache", JSON.stringify(userCache));

      const userNameEl = document.getElementById("user-name");
      if (userNameEl) userNameEl.textContent = name;
      const sidebarNameEl = document.getElementById("sidebar-user-name");
      if (sidebarNameEl) sidebarNameEl.textContent = name;

      alert("개인정보가 성공적으로 수정되었습니다.");
      hideProfileModal();
    } catch (err) {
      console.error("[auth] 개인정보 수정 실패:", err);
      alert("개인정보 수정 중 오류가 발생했습니다: " + (err.message || err));
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "저장하기 (Save)";
      }
    }
  }

  /**
   * 비밀번호 변경 폼 제출 핸들러
   */
  async function handleProfilePasswordSubmit(e) {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !user.email) {
      alert("로그인이 필요합니다.");
      return;
    }

    const btnSubmit = document.getElementById("btn-submit-profile-pwd");
    const currentPassword = document.getElementById("profile-current-password").value;
    const newPassword = document.getElementById("profile-new-password").value;
    const confirmPassword = document.getElementById("profile-confirm-password").value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("모든 비밀번호 필드를 입력해 주세요.");
      return;
    }

    if (newPassword.length < 6) {
      alert("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    if (newPassword !== confirmPassword) {
      alert("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "변경 중...";
      }

      // 1. 현재 비밀번호로 재인증 (보안 검증)
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // 2. 새 비밀번호로 업데이트
      await updatePassword(user, newPassword);

      alert("비밀번호가 안전하게 변경되었습니다.");
      
      // 폼 초기화 및 모달 닫기
      document.getElementById("form-profile-pwd").reset();
      hideProfileModal();
    } catch (err) {
      console.error("[auth] 비밀번호 변경 실패:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        alert("현재 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.");
      } else if (err.code === "auth/weak-password") {
        alert("새 비밀번호가 너무 취약합니다. 6자 이상의 강력한 비밀번호를 입력해 주세요.");
      } else {
        alert("비밀번호 변경 실패: " + (err.message || err));
      }
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "비밀번호 변경";
      }
    }
  }

  // =========================================================================
  // 2. 회원가입 & 로그인 실질 로직 핸들러
  // =========================================================================

  /**
   * 로그인 폼 제출 처리 핸들러
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
        // 단일 계정 조회 쿼리 최적화: 불필요한 전체 스캔 방지 및 즉각 응답을 위한 limit(1) 적용
        const q = query(usersRef, where("loginId", "==", accountInput), limit(1));
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
   * 문자열 비교용 이름 정규화 헬퍼 (앞뒤 공백 제거 및 연속 공백 단일화, 소문자 변환)
   * @param {string} val - 원본 이름 문자열
   * @returns {string} 정규화된 문자열
   */
  function normalizeCompareName(val) {
    return String(val || "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  /**
   * 개인정보 보호를 위해 이메일 주소를 일부 마스킹 처리하는 헬퍼
   * @param {string} email - 원본 이메일 주소
   * @returns {string} 마스킹된 이메일 문자열 (예: im***@gmail.com)
   */
  function maskEmailAddress(email) {
    const raw = String(email || "").trim();
    const atIndex = raw.indexOf("@");
    if (atIndex <= 0) return raw;

    const localPart = raw.slice(0, atIndex);
    const domainPart = raw.slice(atIndex);
    const visibleLen = localPart.length <= 2 ? 1 : Math.min(3, localPart.length - 1);
    return localPart.slice(0, visibleLen) + "***" + domainPart;
  }

  /**
   * 아이디 찾기 / 비밀번호 찾기 결과 박스에 안내 메시지를 안전하게 렌더링하는 헬퍼
   * @param {string} elementId - 대상 결과 박스 요소 ID
   * @param {string} htmlContent - 표시할 HTML (동적 값은 escapeHtml 적용 필수)
   * @param {boolean} [isError=false] - 오류/실패 스타일 적용 여부
   */
  function renderRecoveryResult(elementId, htmlContent, isError = false) {
    const box = document.getElementById(elementId);
    if (!box) return;
    box.classList.toggle("error", Boolean(isError));
    box.innerHTML = htmlContent;
    box.style.display = "block";
  }

  /**
   * 아이디 찾기 폼 제출 처리 핸들러
   * - Firestore users 컬렉션에서 이름과 이메일 또는 연락처 일치 여부를 조회해 가입된 아이디를 안내합니다.
   */
  async function handleFindIdSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-submit-find-id");
    const nameInput = (document.getElementById("find-id-name")?.value || "").trim();
    const contactInput = (document.getElementById("find-id-contact")?.value || "").trim();

    if (!nameInput || !contactInput) {
      renderRecoveryResult("find-id-result", "이름과 이메일 또는 연락처를 모두 입력해 주세요.", true);
      return;
    }

    const normalizedName = normalizeCompareName(nameInput);
    const isEmailInput = contactInput.includes("@");
    const digitsInput = contactInput.replace(/\D/g, "");

    if (!isEmailInput && digitsInput.length < 7) {
      renderRecoveryResult("find-id-result", "올바른 이메일 주소 또는 연락처(숫자 7자리 이상)를 입력해 주세요.", true);
      return;
    }

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "조회 중...";
      }

      const usersRef = collection(db, "users");
      const matchedDocs = [];
      const seenDocIds = new Set();

      // Firestore 무료 요금제(Spark) 보호를 위해 limit(10) 범위 내에서만 조건부 조회 수행
      const collectMatches = (snap) => {
        snap.forEach((docSnap) => {
          if (seenDocIds.has(docSnap.id)) return;
          seenDocIds.add(docSnap.id);
          const data = docSnap.data();
          if (normalizeCompareName(data.name) !== normalizedName) return;

          if (isEmailInput) {
            if (String(data.email || "").trim().toLowerCase() === contactInput.toLowerCase()) {
              matchedDocs.push(data);
            }
          } else {
            const docDigits = String(data.phone || "").replace(/\D/g, "");
            if (docDigits && docDigits === digitsInput) {
              matchedDocs.push(data);
            }
          }
        });
      };

      // 1차: 이름 기준 소량 조회 (연락처 하이픈 유무나 이메일 대소문자 차이까지 한 번에 흡수)
      const nameQuerySnap = await getDocs(query(usersRef, where("name", "==", nameInput), limit(10)));
      collectMatches(nameQuerySnap);

      // 2차: 이름 표기 공백 차이 등이 있을 경우를 대비해 이메일/연락처 필드로 보완 조회
      if (matchedDocs.length === 0) {
        if (isEmailInput) {
          const emailSnap = await getDocs(query(usersRef, where("email", "==", contactInput), limit(5)));
          collectMatches(emailSnap);
          if (matchedDocs.length === 0 && contactInput !== contactInput.toLowerCase()) {
            const lowerEmailSnap = await getDocs(query(usersRef, where("email", "==", contactInput.toLowerCase()), limit(5)));
            collectMatches(lowerEmailSnap);
          }
        } else {
          const phoneSnap = await getDocs(query(usersRef, where("phone", "==", contactInput), limit(5)));
          collectMatches(phoneSnap);
        }
      }

      if (matchedDocs.length === 0) {
        renderRecoveryResult(
          "find-id-result",
          "입력하신 정보와 일치하는 회원 계정을 찾을 수 없습니다.<br>이름과 이메일(또는 연락처)을 다시 확인해 주세요.",
          true
        );
        return;
      }

      const targetUser = matchedDocs[0];
      const foundLoginId = targetUser.loginId || targetUser.email || "";

      renderRecoveryResult(
        "find-id-result",
        `
          <div class="auth-result-title">✅ 회원님의 아이디를 찾았습니다.</div>
          <div class="auth-result-value">${escapeHtml(foundLoginId)}</div>
          <p class="auth-result-note">가입일: ${escapeHtml(targetUser.createdAt ? String(targetUser.createdAt).slice(0, 10) : "-")}</p>
          <button type="button" class="auth-result-action-btn" id="btn-use-found-id">이 아이디로 로그인하기</button>
        `,
        false
      );

      const btnUseId = document.getElementById("btn-use-found-id");
      if (btnUseId) {
        btnUseId.addEventListener("click", () => {
          if (typeof window.switchAuthSection === "function") {
            window.switchAuthSection("login");
          }
          const loginAccountEl = document.getElementById("login-input-account");
          const loginPwdEl = document.getElementById("login-input-password");
          if (loginAccountEl) loginAccountEl.value = foundLoginId;
          if (loginPwdEl) loginPwdEl.focus();
        });
      }
    } catch (err) {
      console.error("[auth] 아이디 찾기 조회 실패:", err);
      renderRecoveryResult(
        "find-id-result",
        "아이디 조회 중 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        true
      );
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "아이디 찾기 (Find ID)";
      }
    }
  }

  /**
   * 비밀번호 찾기(재설정 메일 발송) 폼 제출 처리 핸들러
   * - 아이디 또는 이메일과 이름을 검증한 뒤 Firebase Auth 공식 무료 sendPasswordResetEmail을 호출합니다.
   */
  async function handleFindPasswordSubmit(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById("btn-submit-find-pwd");
    const accountInput = (document.getElementById("find-pwd-account")?.value || "").trim();
    const nameInput = (document.getElementById("find-pwd-name")?.value || "").trim();

    if (!accountInput || !nameInput) {
      renderRecoveryResult("find-pwd-result", "아이디(또는 이메일)와 이름을 모두 입력해 주세요.", true);
      return;
    }

    const normalizedName = normalizeCompareName(nameInput);

    try {
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.textContent = "확인 및 발송 중...";
      }

      const usersRef = collection(db, "users");
      let targetUser = null;

      if (!accountInput.includes("@")) {
        // 아이디로 조회 후 이름 일치 여부 검증
        const q = query(usersRef, where("loginId", "==", accountInput), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          if (normalizeCompareName(data.name) === normalizedName) {
            targetUser = data;
          }
        }
      } else {
        // 이메일로 조회 후 이름 일치 여부 검증 (대소문자 차이 고려)
        const snapExact = await getDocs(query(usersRef, where("email", "==", accountInput), limit(5)));
        snapExact.forEach((docSnap) => {
          const data = docSnap.data();
          if (!targetUser && normalizeCompareName(data.name) === normalizedName) {
            targetUser = data;
          }
        });

        if (!targetUser && accountInput !== accountInput.toLowerCase()) {
          const snapLower = await getDocs(query(usersRef, where("email", "==", accountInput.toLowerCase()), limit(5)));
          snapLower.forEach((docSnap) => {
            const data = docSnap.data();
            if (!targetUser && normalizeCompareName(data.name) === normalizedName) {
              targetUser = data;
            }
          });
        }
      }

      if (!targetUser || !targetUser.email) {
        renderRecoveryResult(
          "find-pwd-result",
          "입력하신 아이디(이메일) 및 이름과 일치하는 계정을 찾을 수 없습니다.<br>가입 정보를 다시 확인해 주세요.",
          true
        );
        return;
      }

      // Firebase Auth 비밀번호 재설정 메일을 한국어로 발송
      auth.languageCode = "ko";
      await sendPasswordResetEmail(auth, targetUser.email);

      const maskedEmail = maskEmailAddress(targetUser.email);
      renderRecoveryResult(
        "find-pwd-result",
        `
          <div class="auth-result-title">📧 비밀번호 재설정 메일을 발송했습니다.</div>
          <div class="auth-result-value">${escapeHtml(maskedEmail)}</div>
          <p class="auth-result-note">메일에 포함된 재설정 링크를 클릭하여 새 비밀번호를 설정해 주세요.<br>(메일이 보이지 않을 경우 스팸 메일함도 함께 확인해 주세요.)</p>
        `,
        false
      );
    } catch (err) {
      console.error("[auth] 비밀번호 재설정 메일 발송 실패:", err);
      let errMsg = "비밀번호 재설정 메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
      if (err.code === "auth/user-not-found") {
        errMsg = "Firebase 인증 시스템에 등록된 이메일 계정을 찾을 수 없습니다.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "등록된 이메일 형식이 올바르지 않습니다. 관리자에게 문의해 주세요.";
      } else if (err.code === "auth/too-many-requests") {
        errMsg = "요청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요.";
      }
      renderRecoveryResult("find-pwd-result", errMsg, true);
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "재설정 메일 발송 (Send Reset Email)";
      }
    }
  }

  /**
   * 회원가입 폼 제출 처리 핸들러
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
        // 아이디 중복 체크 쿼리 최적화: 1건 발견 즉시 검사 완료 처리를 위한 limit(1) 적용
        const q = query(usersRef, where("loginId", "==", loginId), limit(1));
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
      // ispartners82@gmail.com 계정 또는 ispartners82 아이디로 가입 시 최고 관리자(super_admin) 등급 자동 부여
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
    if (target.id === "btn-login" || target.closest("#btn-login") || target.id === "quick-btn-login" || target.closest("#quick-btn-login") || target.id === "hero-btn-login" || target.closest("#hero-btn-login")) {
      showAuthModal("login");
    }

    // 로그아웃 버튼 클릭 시 세션 종료
    if (target.id === "btn-logout" || target.closest("#btn-logout")) {
      try {
        if (confirm("로그아웃 하시겠습니까?")) {
          // 로그아웃 시 폼에 남아있을 수 있는 자격증명 및 입력값을 즉시 초기화
          if (typeof window.resetSignupForm === "function") {
            window.resetSignupForm();
          }
          const loginForm = document.getElementById("form-auth-login");
          if (loginForm) loginForm.reset();

          sessionStorage.clear();
          // 로그아웃 시 로컬 예약 임시 저장소 데이터도 함께 정리하여 다른 계정 노출 방지
          try {
            localStorage.removeItem("local_reservations");
            localStorage.removeItem("local_reservations_direct");
          } catch (e) { }
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
   * 사용자 등급 변경 또는 로그아웃 시 관련 세션 캐시 전체 무효화 함수
   * @param {string} uid - 캐시를 삭제할 사용자 UID
   */
  function clearUserRoleCache(uid) {
    if (uid) {
      sessionStorage.removeItem(`user_role_cache_${uid}`);
      sessionStorage.removeItem(`admin_permissions_${uid}`);
      sessionStorage.removeItem(`admin_permissions_cache_${uid}`);
    }
    sessionStorage.clear();
  }
  window.clearUserRoleCache = clearUserRoleCache;

  // 실시간 등급 및 세부 권한 감지 리스너 구독 해제 함수 포인터
  let unsubscribeLiveUser = null;
  let unsubscribeLiveRole = null;

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

      // 상단 사용자 뱃지 클릭 시 내 정보 관리(개인정보 수정) 모달 호출 이벤트 연결
      const userBadgeEl = document.getElementById("user-badge");
      if (userBadgeEl) {
        userBadgeEl.style.cursor = "pointer";
        userBadgeEl.setAttribute("title", "내 정보 관리 (My Profile)");
        if (!userBadgeEl.dataset.profileBound) {
          userBadgeEl.dataset.profileBound = "true";
          userBadgeEl.addEventListener("click", (e) => {
            e.preventDefault();
            if (typeof window.showProfileModal === "function") {
              window.showProfileModal();
            }
          });
        }
      }

      if (btnLogin) {
        btnLogin.style.display = "none";
        btnLogin.disabled = false;
        btnLogin.textContent = "로그인";
      }

      if (quickBtnMyReservations) quickBtnMyReservations.style.display = "inline-flex";
      if (quickBtnLogin) quickBtnLogin.style.display = "none";
      const heroBtnLogin = document.getElementById("hero-btn-login");
      if (heroBtnLogin) heroBtnLogin.style.display = "none";

      // 로그인한 회원에게만 상단 '커뮤니티' 메뉴 노출 처리
      const communityMenuItems = document.querySelectorAll(".nav-community-item, #nav-item-community");
      communityMenuItems.forEach(item => {
        item.style.display = "inline-block";
        item.classList.add("logged-in");
      });

      // 이전 실시간 리스너 해제 후 안전한 재구독
      if (typeof unsubscribeLiveRole === "function") {
        unsubscribeLiveRole();
        unsubscribeLiveRole = null;
      }
      if (typeof unsubscribeLiveUser === "function") {
        unsubscribeLiveUser();
        unsubscribeLiveUser = null;
      }

      // 실시간 등급 및 10가지 세부 권한 변경 감지 파이프라인 시작
      // 1. users/{uid} 문서 실시간 감지: 관리자가 회원 등급을 바꿀 때 0.1초 즉시 감지
      unsubscribeLiveUser = onSnapshot(doc(db, "users", user.uid), (userSnap) => {
        if (!userSnap.exists()) return;
        const activeRole = userSnap.data().role || "user";
        sessionStorage.setItem(`user_role_cache_${user.uid}`, activeRole);

        // 2. roles/{activeRole} 문서 실시간 감지: 최고관리자가 어떤 등급의 어떤 스위치를 조작하든 즉각 감지
        if (typeof unsubscribeLiveRole === "function") {
          unsubscribeLiveRole();
          unsubscribeLiveRole = null;
        }

        unsubscribeLiveRole = onSnapshot(doc(db, "roles", activeRole), (roleSnap) => {
          // 공통 권한 매핑 헬퍼를 사용하여 등급별 권한과 라벨을 일관되게 생성
          const mapped = buildRolePermissions(activeRole, roleSnap.exists() ? roleSnap.data() : null);
          const roleLabel = mapped.label;
          const fullPermissions = {
            isAdmin: mapped.isAdmin,
            hasReservations: mapped.hasReservations,
            hasClinics: mapped.hasClinics,
            hasRoles: mapped.hasRoles,
            hasPermissions: mapped.hasPermissions,
            hasSms: mapped.hasSms,
            hasStats: mapped.hasStats,
            hasAds: mapped.hasAds,
            hasPartners: mapped.hasPartners,
            hasInterpreters: mapped.hasInterpreters,
            hasCommunitySettings: mapped.hasCommunitySettings
          };

          // 3. 브라우저 세션 스토리지 즉각 최신화 (새로고침 시에도 즉시 유효)
          try {
            sessionStorage.setItem(`admin_permissions_${user.uid}`, JSON.stringify({
              role: activeRole,
              permissions: fullPermissions
            }));
            sessionStorage.setItem(`role_permissions_cache_${activeRole}`, JSON.stringify({
              ...fullPermissions,
              label: roleLabel
            }));
          } catch (e) { }

          // 4. 상단 네비게이션 관리자 및 예약통계 버튼 노출/숨김 0초 실시간 즉각 스위칭
          const currentAdminBtn = document.getElementById("btn-admin-dashboard");
          const currentStatsBtn = document.getElementById("btn-stats-dashboard");
          const currentQuickAdminBtn = document.getElementById("quick-btn-admin-dashboard");
          const currentQuickStatsBtn = document.getElementById("quick-btn-stats-dashboard");

          if (currentAdminBtn) currentAdminBtn.style.display = fullPermissions.isAdmin ? "inline-flex" : "none";
          if (currentStatsBtn) currentStatsBtn.style.display = fullPermissions.hasStats ? "inline-flex" : "none";
          if (currentQuickAdminBtn) currentQuickAdminBtn.style.display = fullPermissions.isAdmin ? "inline-flex" : "none";
          if (currentQuickStatsBtn) currentQuickStatsBtn.style.display = fullPermissions.hasStats ? "inline-flex" : "none";

          // 5. 커뮤니티 전용 사이드바 프로필 실시간 동기화
          const sidebarNameEl = document.getElementById("sidebar-user-name");
          const sidebarBadgeEl = document.getElementById("sidebar-user-badge");
          if (sidebarNameEl && displayName) sidebarNameEl.textContent = displayName;
          if (sidebarBadgeEl) sidebarBadgeEl.textContent = roleLabel;

          // 6. 전역 이벤트 전파: 관리자 대시보드 탭 메뉴 및 다른 모듈 0초 실시간 즉각 동기화
          window.dispatchEvent(new CustomEvent("rolePermissionsChanged", {
            detail: {
              role: activeRole,
              permissions: fullPermissions,
              label: roleLabel
            }
          }));
        }, (roleErr) => {
          console.warn("Live role listener error:", roleErr);
        });
      }, (userErr) => {
        console.warn("Live user listener error:", userErr);
      });

      hideAuthModal();
    } else {
      // 로그아웃 시 기존 실시간 감지 리스너 정리
      if (typeof unsubscribeLiveRole === "function") {
        unsubscribeLiveRole();
        unsubscribeLiveRole = null;
      }
      if (typeof unsubscribeLiveUser === "function") {
        unsubscribeLiveUser();
        unsubscribeLiveUser = null;
      }

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

      // 비로그인/로그아웃 상태 시에도 상단 '커뮤니티' 메뉴는 항상 노출되도록 유지
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
      const heroBtnLogin = document.getElementById("hero-btn-login");
      if (heroBtnLogin) heroBtnLogin.style.display = "inline-flex";

      if (btnAdminDashboard) btnAdminDashboard.style.display = "none";
      const btnStatsDashboard = document.getElementById("btn-stats-dashboard");
      if (btnStatsDashboard) btnStatsDashboard.style.display = "none";

      // 로그아웃 시 권한 캐시 및 세션 완전 정리
      Object.keys(sessionStorage)
        .filter(key => key.startsWith("user_role_cache_") || key.startsWith("admin_permissions_") || key.startsWith("role_permissions_cache_"))
        .forEach(key => sessionStorage.removeItem(key));
    }
  });

}

// 모듈 로드 시점과 무관하게 DOM 준비 상태에 따라 초기화 실행
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthModule);
} else {
  initAuthModule();
}

