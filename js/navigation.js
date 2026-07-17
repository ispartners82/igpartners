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

  // 현재 활성화된 페이지 경로 파악 (메뉴 하이라이트 처리에 활용)
  const currentPath = window.location.pathname;

  // 네비게이션 HTML 뼈대 주입
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
            <a href="/index.html" class="nav-link ${currentPath === "/" || currentPath.endsWith("index.html") ? "active" : ""}">홈</a>
          </li>
          <li class="nav-item">
            <!-- 한글 주석: 회사소개 메뉴 클릭 시 외부 독립 회사소개 페이지(about.html)로 연결하도록 변경 -->
            <a href="/about.html" class="nav-link ${currentPath.endsWith("about.html") ? "active" : ""}">회사소개</a>
          </li>
          <li class="nav-item">
            <!-- 한글 주석: 제공 서비스 메뉴 클릭 시 회사소개(전체 내용 페이지)의 서비스 섹션(#services)으로 연결하도록 변경 -->
            <a href="/about.html#services" class="nav-link">제공 서비스</a>
          </li>
          <!-- 한글 주석: 의료통역 메뉴 클릭 시 회사소개(전체 내용 페이지)의 서비스 섹션(#services)으로 연결하도록 변경 (진료 예약 버튼과 위치 스왑) -->
          <li class="nav-item">
            <a href="/about.html#services" class="nav-link btn-nav-booking">의료통역</a>
          </li>
          <!-- 한글 주석: 진료 예약 메뉴를 의료통역 우측으로 순서 스왑 이동함 -->
          <li class="nav-item">
            <a href="/booking-lang.html" class="nav-link btn-nav-booking ${currentPath.endsWith("booking-lang.html") ? "active" : ""}">진료 예약</a>
          </li>
          <!-- 한글 주석: 사용자 요청에 따라 '협력 회사' 메뉴 위치를 '의료통역' 우측으로 이동시킴 -->
          <li class="nav-item">
            <a href="/index.html#partners" class="nav-link">협력 회사</a>
          </li>
        </ul>

        <!-- 우측: 구글 로그인 상태 뱃지 및 인증 영역 (데스크톱 기준) -->
        <div class="nav-auth-area" id="nav-auth-area">
          <!-- 로그인 완료 후 노출될 사용자 뱃지 영역 -->
          <div id="auth-user" class="auth-user-badge" style="display: none;">
            <div class="user-capsule">
              <img id="user-photo" src="" alt="Profile" class="user-avatar">
              <span id="user-name" class="user-nickname"></span>
            </div>
            <!-- 예약 확인 버튼 -->
            <a href="/my-reservations.html" id="btn-my-reservations" class="btn-nav-action btn-my-res">📅 예약내역</a>
            <!-- 관리자 대시보드 진입 버튼 (권한 등급에 따라 노출 제어) -->
            <a href="/admin.html" id="btn-admin-dashboard" class="btn-nav-action btn-admin" style="display: none;">👑 관리자</a>
            <!-- 한글 주석: 예약 통계 페이지 진입 버튼 추가 -->
            <a href="/stats.html" id="btn-stats-dashboard" class="btn-nav-action btn-admin" style="display: none;">📊 예약통계</a>
            <!-- 로그아웃 버튼 -->
            <button id="btn-logout" class="btn-nav-logout">로그아웃</button>
          </div>
          <!-- 로그아웃 상태일 때 노출될 로그인 버튼 -->
          <button id="btn-login" class="btn-nav-login">로그인</button>
        </div>

        <!-- 신규 추가: 모바일 전용 상단 퀵 메뉴 영역 (데스크톱 모드에서는 CSS로 비노출 제어) -->
        <div class="nav-mobile-quick" id="nav-mobile-quick">
          <!-- 홈 바로가기 버튼 (집 아이콘) -->
          <a href="/index.html" class="quick-icon-btn ${currentPath === "/" || currentPath.endsWith("index.html") ? "active" : ""}" title="홈">🏠</a>
          <!-- 한글 주석: 모바일 퀵 메뉴 회사소개 클릭 시 약속된 about.html 페이지로 연동 변경 -->
          <a href="/about.html" class="quick-icon-btn ${currentPath.endsWith("about.html") ? "active" : ""}" title="회사소개">🏢</a>
          <!-- 한글 주석: 모바일 퀵 메뉴 제공서비스 클릭 시 회사소개(전체 내용 페이지)의 서비스 섹션(#services)으로 연동 변경 -->
          <a href="/about.html#services" class="quick-icon-btn" title="제공 서비스">🛠️</a>
          <!-- 한글 주석: 모바일 퀵 메뉴 의료통역 클릭 시 회사소개(전체 내용 페이지)의 서비스 섹션(#services)으로 연동 변경 (진료 예약과 위치 스왑) -->
          <a href="/about.html#services" class="quick-icon-btn" title="의료통역">🌐</a>
          <!-- 한글 주석: 진료 예약 바로가기 버튼 (달력 아이콘, 의료통역 우측으로 스왑 이동) -->
          <a href="/booking-lang.html" class="quick-icon-btn ${currentPath.endsWith("booking-lang.html") ? "active" : ""}" title="진료 예약">📅</a>
          <!-- 한글 주석: 사용자 요청에 따라 모바일 퀵 메뉴에서도 '협력 회사'의 위치를 의료통역 뒤로 이동시킴 -->
          <a href="/index.html#partners" class="quick-icon-btn" title="협력 회사">🤝</a>
          <!-- 예약 내역 바로가기 버튼 (로그인 상태에 따라 auth.js에서 동적 표시) -->
          <a href="/my-reservations.html" id="quick-btn-my-reservations" class="quick-icon-btn ${currentPath.endsWith("my-reservations.html") ? "active" : ""}" style="display: none;" title="예약내역">📋</a>
          <!-- 관리자 대시보드 바로가기 버튼 (권한 등급에 따라 auth.js에서 동적 표시) -->
          <a href="/admin.html" id="quick-btn-admin-dashboard" class="quick-icon-btn ${currentPath.endsWith("admin.html") ? "active" : ""}" style="display: none;" title="관리자">👑</a>
          <!-- 한글 주석: 예약 통계 바로가기 버튼 추가 -->
          <a href="/stats.html" id="quick-btn-stats-dashboard" class="quick-icon-btn ${currentPath.endsWith("stats.html") ? "active" : ""}" style="display: none;" title="예약통계">📊</a>
          <!-- 퀵 로그인 버튼 (로그아웃 상태에 따라 auth.js에서 동적 표시) -->
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
});
