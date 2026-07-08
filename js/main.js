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

  // 지원 가능한 모든 15개 언어셋(한국어, 일본어, 영어, 베트남어, 중국어, 러시아어, 미얀마어, 캄보디아어, 몽골어, 태국어, 라오스어, 네팔어, 인도네시아어, 스리랑카어, 방글라데시어)에 대해서 공통 예약 루트 허용
  const supportedLanguages = [
    'vi', 'ko', 'ja', 'en', 
    'zh', 'ru', 'my', 'km', 
    'mn', 'th', 'lo', 'ne', 
    'id', 'si', 'bn'
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
// Build cache bust: 2026-06-27T16:30:00
