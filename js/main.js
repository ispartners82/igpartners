// Firebase App, Auth 및 Analytics 로드 (공통 DB 모듈 실행 - 캐시 버전: v=260930_7)
import { app, auth, analytics } from "./firebase-db.js?v=260930_7";

// 네비게이션 모듈에서 정의된 15개국어 공통 기준 데이터(Single Source of Truth) 임포트
import { LANG_LIST } from "./navigation.js?v=260930_7";

console.log("Firebase App initialized successfully via common module.");

/**
 * 언어 선택 시 호출되는 액션 함수 (로그인 세션 검증 후 병원선택 화면으로 다이렉트 이동)
 * @param {string} langCode 선택한 언어 코드 (ko, ja, vi, en 등)
 */
function selectLanguage(langCode) {
  // 로그인 세션 및 캐시 통합 검증 (window.isLoggedIn, auth.currentUser 및 sessionStorage 가입 세션 보장)
  const isUserAuthenticated = window.isLoggedIn || (auth && auth.currentUser) || sessionStorage.getItem("auth_user_cache");
  if (!isUserAuthenticated) {
    if (typeof window.showAuthModal === "function") {
      window.showAuthModal("login");
    } else if (typeof window.showLoginModal === "function") {
      window.showLoginModal();
    } else {
      alert("로그인을 먼저 해주세요.\n(Please log in first.)");
    }
    return;
  }

  console.log("Selected Language:", langCode);

  // 로컬 스토리지에 언어 설정 기록 (추후 진료 예약 폼 등에서 활용)
  localStorage.setItem('selected_lang', langCode);

  // navigation.js의 단일 기준 데이터로부터 지원 가능한 모든 언어 코드 목록 동적 추출
  const supportedLanguages = Array.isArray(LANG_LIST) ? LANG_LIST.map(l => l.code) : [
    'vi', 'ko', 'ja', 'en', 'zh', 'ru', 'my', 'km', 'mn', 'th', 'lo', 'ne', 'id', 'si', 'bn'
  ];

  if (supportedLanguages.includes(langCode)) {
    // 지정한 언어 선택 시 단일화된 공통 병원 목록 선택 화면으로 다이렉트 이동
    location.href = '/booking-clinic.html';
  } else {
    // 혹시 모를 예외 언어에 대해 아직 미탑재된 다국어 클릭 시 예비 팝업 안내창 출력
    alert("Dịch vụ này hiện đang được chuẩn bị cho các ngôn ngữ khác. (본 서비스는 다른 언어로 제공될 예정입니다.)");
  }
}

// 모듈 스코프 함수를 전역 window 객체에 등록하여 HTML의 onclick 이벤트가 접근할 수 있도록 함
window.selectLanguage = selectLanguage;
