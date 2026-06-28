// Firebase App 및 Analytics 로드 (공통 DB 모듈 실행)
import { app, analytics } from "./firebase-db.js?v=2.0.7";

console.log("Firebase App initialized successfully via common module.");

/**
 * 언어 선택 시 호출되는 액션 함수
 */
function selectLanguage(langCode) {
  // 로그인 검증 로직 추가
  if (!window.isLoggedIn) {
    if (typeof window.showLoginModal === "function") {
      window.showLoginModal();
    } else {
      alert("로그인을 먼저 해주세요.\n(Please log in first.)");
    }
    return;
  }

  console.log("Selected Language:", langCode);

  // 로컬 스토리지에 언어 설정 기록 (추후 진료 예약 폼 등에서 활용)
  localStorage.setItem('selected_lang', langCode);

  if (langCode === 'vi') {
    // 베트남어 선택 시 병원 목록 선택 페이지로 리다이렉트
    location.href = 'vi/index.html';
  } else {
    alert("Dịch vụ này hiện đang được chuẩn bị cho các ngôn ngữ khác. (본 서비스는 다른 언어로 제공될 예정입니다.)");
  }
}

// 모듈 스코프 함수를 전역 window 객체에 등록하여 HTML의 onclick 이벤트가 접근할 수 있도록 함
window.selectLanguage = selectLanguage;
// Build cache bust: 2026-06-27T16:30:00
