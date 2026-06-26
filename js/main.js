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

  if (langCode === 'vi') {
    // 베트남어 선택 시 병원 목록 선택 페이지로 리다이렉트
    location.href = 'vi/index.html';
  } else {
    alert("Dịch vụ này hiện đang được chuẩn bị cho các ngôn ngữ khác. (본 서비스는 다른 언어로 제공될 예정입니다.)");
  }
}

// 모듈 스코프 함수를 전역 window 객체에 등록하여 HTML의 onclick 이벤트가 접근할 수 있도록 함
window.selectLanguage = selectLanguage;
