// Firebase App SDK CDN import
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD8V6mVYsjHsw8Gcuv909d7bppo1DQNX1M",
  authDomain: "igpartners-ddbf9.firebaseapp.com",
  projectId: "igpartners-ddbf9",
  storageBucket: "igpartners-ddbf9.firebasestorage.app",
  messagingSenderId: "217909826370",
  appId: "1:217909826370:web:69e559a57b2d8a70bd6edb",
  measurementId: "G-2RG951Y39M"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
  console.log("Firebase Analytics initialized.");
} catch (error) {
  console.warn("Firebase Analytics failed to initialize:", error);
}

console.log("Firebase App initialized successfully.");

/**
 * 언어 선택 시 호출되는 액션 함수
 */
function selectLanguage(langCode) {
  console.log("Selected Language:", langCode);

  // 로컬 스토리지에 언어 설정 기록 (추후 진료 예약 폼 등에서 활용)
  localStorage.setItem('selected_lang', langCode);

  // 사용자에게 피드백을 전달하기 위해 일시적으로 카드를 반짝이는 효과 등 적용 가능
  // 예: alert(langCode + " 언어가 선택되었습니다. 다음 단계로 이동합니다.");

  // 다음 예약 단계 페이지로 이동 (예: location.href = 'form.html')
}

// 모듈 스코프 함수를 전역 window 객체에 등록하여 HTML의 onclick 이벤트가 접근할 수 있도록 함
window.selectLanguage = selectLanguage;
