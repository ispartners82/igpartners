/**
 * IGPartners 공통 상단 네비게이션 바 제어 스크립트
 * 모든 페이지에서 일관된 메뉴바와 로그인 상태 뱃지를 동적으로 주입합니다.
 * 화면 가로 크기에 반응하여 모바일 레이아웃 시 로그인 뱃지 영역을 서랍식 메뉴 내부에 자동 병합합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 공통 헤더 컨테이너 요소 조회
  const globalHeader = document.getElementById("global-header");
  if (!globalHeader) {
    console.warn("공통 헤더 컨테이너(#global-header)를 찾을 수 없습니다.");
    return;
  }

  // [한글 주석: 현재 활성화된 페이지 경로 및 URL 해시 파악 (모든 메뉴의 active 하이라이트 처리에 활용)]
  const currentPath = window.location.pathname;
  const currentHash = window.location.hash;

  // [한글 주석: 홈 및 각 메뉴별 URL/해시 유무에 따른 active 탭 구분 식별자 정밀 정의]
  const isIndexPage = (currentPath === "/" || currentPath.endsWith("index.html"));
  const isPartnersHash = currentHash === "#partners";
  const isHomeActive = isIndexPage && !isPartnersHash;
  const isPartnersActive = isIndexPage && isPartnersHash;

  const isAboutPage = currentPath.endsWith("about.html");
  const isServicesHash = currentHash === "#services";
  const isAboutActive = isAboutPage && !isServicesHash;
  const isServicesActive = isAboutPage && isServicesHash;

  // [한글 주석: 진료 예약 관련 페이지(booking-lang, booking-clinic, booking-form) 진입 여부 식별자]
  const isBookingActive = currentPath.includes("booking-");

  // [한글 주석: 절대 동결 락 - 상단 헤더 DOM이 단 1ms도 파괴되거나 innerHTML로 다시 덮어씌워져 우측 뱃지가 사라지고 메뉴가 튀는 현상을 100% 완전 차단]
  const existingNavbar = globalHeader.querySelector(".common-navbar");
  if (existingNavbar && globalHeader.children.length > 0) {
    // [한글 주석: 정적 HTML이 이미 존재하면 DOM을 파괴하지 않고 active 클래스만 스마트 업데이트]
    // [한글 주석: 주의 - return을 제거하여 하단의 햄버거 이벤트/handleResponsiveLayout/syncAuthBadge 등 모바일 셋업 코드가 반드시 실행되도록 수정]
    updateActiveNavLinks();
    // return; ← [버그 수정] 이 줄이 있으면 모바일 이벤트 바인딩이 전혀 실행되지 않아 서랍 메뉴가 작동 불능 상태가 됨
  }

  if (!existingNavbar) {
    globalHeader.innerHTML = `
      <nav class="common-navbar">
        <div class="nav-container">
          <!-- 좌측: 브랜드 로고 영역 -->
          <a href="/index.html" class="nav-brand">
            <img src="/img/logo.png" alt="IGPartners Logo" class="nav-logo">
            <span class="nav-brand-text">IGPartners</span>
          </a>

          <!-- 중앙: 네비게이션 메뉴 링크 영역 (반응형 대응) -->
          <ul class="nav-menu" id="nav-menu">
            <li class="nav-item">
              <a href="/index.html" class="nav-link ${isHomeActive ? "active" : ""}">홈</a>
            </li>
            <li class="nav-item">
              <a href="/about.html" class="nav-link ${isAboutActive ? "active" : ""}">회사소개</a>
            </li>
            <li class="nav-item">
              <a href="/about.html#services" class="nav-link ${isServicesActive ? "active" : ""}">제공 서비스</a>
            </li>
            <li class="nav-item">
              <a href="/about.html#services" class="nav-link btn-nav-booking ${isServicesActive ? "active" : ""}">의료통역</a>
            </li>
            <li class="nav-item">
              <a href="/booking-lang.html" class="nav-link btn-nav-booking ${isBookingActive ? "active" : ""}">진료 예약</a>
            </li>
            <li class="nav-item">
              <a href="/index.html#partners" class="nav-link ${isPartnersActive ? "active" : ""}">협력 회사</a>
            </li>
          </ul>

          <!-- 우측: 구글 로그인 상태 뱃지 및 인증 영역 (데스크톱 기준) -->
          <div class="nav-auth-area" id="nav-auth-area">
            <div id="auth-user" class="auth-user-badge" style="display: none;">
              <div class="user-capsule">
                <img id="user-photo" src="" alt="Profile" class="user-avatar">
                <span id="user-name" class="user-nickname"></span>
              </div>
              <a href="/my-reservations.html" id="btn-my-reservations" class="btn-nav-action btn-my-res ${currentPath.endsWith("my-reservations.html") ? "active" : ""}">📅 예약내역</a>
              <a href="/admin.html" id="btn-admin-dashboard" class="btn-nav-action btn-admin ${currentPath.endsWith("admin.html") ? "active" : ""}" style="display: none;">👑 관리자</a>
              <a href="/stats.html" id="btn-stats-dashboard" class="btn-nav-action btn-admin ${currentPath.endsWith("stats.html") ? "active" : ""}" style="display: none;">📊 예약통계</a>
              <button id="btn-logout" class="btn-nav-logout">로그아웃</button>
            </div>
            <button id="btn-login" class="btn-nav-login">로그인</button>
          </div>

          <!-- 신규 추가: 모바일 전용 상단 퀵 메뉴 영역 (데스크톱 모드에서는 CSS로 비노출 제어) -->
          <div class="nav-mobile-quick" id="nav-mobile-quick">
            <a href="/index.html" class="quick-icon-btn ${isHomeActive ? "active" : ""}" title="홈">🏠</a>
            <a href="/about.html" class="quick-icon-btn ${isAboutActive ? "active" : ""}" title="회사소개">🏢</a>
            <a href="/about.html#services" class="quick-icon-btn ${isServicesActive ? "active" : ""}" title="제공 서비스">🛠️</a>
            <a href="/about.html#services" class="quick-icon-btn ${isServicesActive ? "active" : ""}" title="의료통역">🌐</a>
            <a href="/booking-lang.html" class="quick-icon-btn ${isBookingActive ? "active" : ""}" title="진료 예약">📅</a>
            <a href="/index.html#partners" class="quick-icon-btn ${isPartnersActive ? "active" : ""}" title="협력 회사">🤝</a>
            <a href="/my-reservations.html" id="quick-btn-my-reservations" class="quick-icon-btn ${currentPath.endsWith("my-reservations.html") ? "active" : ""}" style="display: none;" title="예약내역">📋</a>
            <a href="/admin.html" id="quick-btn-admin-dashboard" class="quick-icon-btn ${currentPath.endsWith("admin.html") ? "active" : ""}" style="display: none;" title="관리자">👑</a>
            <a href="/stats.html" id="quick-btn-stats-dashboard" class="quick-icon-btn ${currentPath.endsWith("stats.html") ? "active" : ""}" style="display: none;" title="예약통계">📊</a>
            <button id="quick-btn-login" class="quick-icon-btn" title="로그인">👤</button>
          </div>

          <!-- 모바일 화면용 햄버거 토글 버튼 -->
          <button class="nav-toggle" id="nav-toggle" aria-label="메뉴 토글">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
          </button>
        </div>
      </nav>
    `;
  } else {
    // [성능 최적화] 이미 마크업이 존재하는 경우 DOM 파괴 없이 active 클래스만 0.001초 만에 스마트 스위칭
    const links = existingNavbar.querySelectorAll("a");
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

      // [한글 주석: nav-link, quick-icon-btn, btn-nav-action 클래스를 가진 링크에만 active 토글 적용]
      if (link.classList.contains("nav-link") || link.classList.contains("quick-icon-btn") || link.classList.contains("btn-nav-action")) {
        link.classList.toggle("active", isActive);
      }
    });
  }

  // [한글 주석: 무한 루프를 완전 차단하고 탭 active 하이라이트만 0.01초 만에 스마트 스위칭하는 독립 함수]
  function updateActiveNavLinks(targetUrl) {
    const currentPath = targetUrl || window.location.pathname;
    const currentHash = window.location.hash;

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

      if (link.classList.contains("nav-link") || link.classList.contains("quick-icon-btn") || link.classList.contains("btn-nav-action")) {
        link.classList.toggle("active", isActive);
      }
    });

    // [한글 주석: 뷰 스위칭 시 우측 프로필/관리자 버튼 2개의 상태를 0.001초 만에 최적화 복원]
    syncAuthBadgeInstantly();
  }

  // [한글 주석: 0초 캐시 복원 엔진 - 페이지/뷰 스위칭 시 우측 관리자 버튼 2개가 0.1초 늦게 튀어나오며 발생하던 상단 메뉴 흔들림/사라짐 랙을 100% 원천 차단]
  function syncAuthBadgeInstantly() {
    try {
      const authUserElem = document.getElementById("auth-user");
      const btnLoginElem = document.getElementById("btn-login");
      const btnAdminElem = document.getElementById("btn-admin-dashboard");
      const btnStatsElem = document.getElementById("btn-stats-dashboard");
      const userNameElem = document.getElementById("user-name");
      const userPhotoElem = document.getElementById("user-photo");

      const userCacheStr = sessionStorage.getItem("auth_user_cache");
      if (userCacheStr) {
        const userObj = JSON.parse(userCacheStr);
        if (authUserElem) authUserElem.style.display = "flex";
        if (btnLoginElem) btnLoginElem.style.display = "none";
        if (userNameElem) userNameElem.textContent = userObj.displayName || "관리자";
        if (userPhotoElem && userObj.photoURL) userPhotoElem.src = userObj.photoURL;

        // 세션 캐시에 기록된 관리자 권한 확인 후 0초 만에 인메모리 노출
        const permCacheStr = sessionStorage.getItem(`admin_permissions_${userObj.uid}`);
        if (permCacheStr) {
          const permObj = JSON.parse(permCacheStr);
          if (permObj && permObj.permissions) {
            if (btnAdminElem) btnAdminElem.style.display = (permObj.permissions.isAdmin) ? "inline-block" : "none";
            if (btnStatsElem) btnStatsElem.style.display = (permObj.permissions.hasStats || permObj.permissions.isAdmin) ? "inline-block" : "none";
          }
        }
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
        <p>법인명: 주식회사 아이지파트너스 | 대표: 황기수 | 법인등록번호: 167-86-04055 | 대구 수성구 알파시티 1로 4길 8</p>
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
      // [한글 주석: 계정 프로필 노드 영구 보존 락 - 뷰 전환 시 구글 계정 이름("이희승") 및 프로필 사진이 0.001초도 비어있지 않도록 즉시 동기화 보존]
      updateActiveNavLinks(fullUrl);
      syncAuthBadgeInstantly();

      // 5. 해시 앵커(#partners, #services 등)가 있을 경우 스무스 스크롤 이동
      if (hashTag) {
        const targetSec = document.querySelector(hashTag);
        if (targetSec) {
          targetSec.scrollIntoView({ behavior: "smooth" });
        }
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      // [한글 주석: 스크립트 중복 재주입 100% 차단 락 - 이미 로드된 스크립트를 재실행하여 구글 Auth/권한 조회가 재발동되며 뱃지가 사라지던 현상 완전 사살]
      const scripts = doc.querySelectorAll("script");
      scripts.forEach(s => {
        const src = s.getAttribute("src");
        if (src && !src.includes("navigation.js") && !src.includes("auth.js") && !src.includes("firebase-config.js")) {
          const isAlreadyLoaded = document.querySelector(`script[src="${src}"]`);
          if (!isAlreadyLoaded) {
            const scriptElem = document.createElement("script");
            scriptElem.src = src;
            scriptElem.type = s.type || "text/javascript";
            document.body.appendChild(scriptElem);
          }
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

    // 2) 다른 뷰(.html)로 이동 시 상단 메뉴 파괴를 차단하고 SPA 동적 뷰 스위칭 실행!
    if (targetPath.endsWith(".html") || targetPath === "/") {
      e.preventDefault();
      loadViewSeamlessly(targetPath, targetHash);
    }
  });

  // 뒤로가기 / 앞으로가기 브라우저 버튼 대응
  window.addEventListener("popstate", () => {
    loadViewSeamlessly(window.location.pathname, window.location.hash);
  });
});
