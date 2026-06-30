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
            <a href="/index.html#about" class="nav-link">회사소개</a>
          </li>
          <li class="nav-item">
            <a href="/index.html#services" class="nav-link">제공 서비스</a>
          </li>
          <li class="nav-item">
            <a href="/index.html#partners" class="nav-link">협력 회사</a>
          </li>
          <li class="nav-item">
            <a href="/booking-lang.html" class="nav-link btn-nav-booking ${currentPath.endsWith("booking-lang.html") ? "active" : ""}">진료 예약</a>
          </li>
          <!-- 신규 추가: 진료 예약과 동일한 강조 디자인을 적용한 의료통역 메뉴 링크 -->
          <li class="nav-item">
            <a href="/index.html#services" class="nav-link btn-nav-booking">의료통역</a>
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
            <!-- 로그아웃 버튼 -->
            <button id="btn-logout" class="btn-nav-logout">로그아웃</button>
          </div>
          <!-- 로그아웃 상태일 때 노출될 로그인 버튼 -->
          <button id="btn-login" class="btn-nav-login">로그인</button>
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
});
