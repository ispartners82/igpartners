import { auth, db } from "/js/firebase-db.js?v=2.0.7";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const authUserArea = document.getElementById("auth-user");
  const userPhoto = document.getElementById("user-photo");
  const userName = document.getElementById("user-name");

  // Google Auth Provider 설정
  const provider = new GoogleAuthProvider();
  // 사용자 계정 선택을 명시적으로 유도하도록 설정
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  // 1. Google 로그인 액션
  btnLogin.addEventListener("click", async () => {
    try {
      btnLogin.disabled = true;
      btnLogin.textContent = "로그인 중...";
      
      const result = await signInWithPopup(auth, provider);
      // 구글 로그인 성공
      const user = result.user;
      console.log("Google sign-in successful:", user.displayName);

      // users 컬렉션에 회원 등록 여부 확인 및 생성
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          name: user.displayName,
          role: "user", // 기본 등급
          createdAt: new Date().toISOString()
        });
        console.log("New user registered in users collection:", user.uid);
      }
      
    } catch (error) {
      console.error("Google sign-in error:", error);
      
      // 사용자 디버깅 가이드를 위한 구체적인 오류 코드 노출
      let errorMsg = "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.";
      if (error.code === "auth/configuration-not-found") {
        errorMsg = "Firebase 콘솔 설정 오류가 발견되었습니다.\n\n[해결 방법]\nFirebase 콘솔 > Authentication > Sign-in method 메뉴에서 'Google' 로그인 제공업체를 [사용 설정]으로 활성화해야 로그인 기능이 정상 작동합니다.";
      } else {
        errorMsg = `로그인 오류가 발생했습니다.\n(오류 코드: ${error.code || error.message})`;
      }
      
      alert(errorMsg);
      
      btnLogin.disabled = false;
      btnLogin.textContent = "로그인";
    }
  });

  // 2. 로그아웃 액션
  btnLogout.addEventListener("click", async () => {
    try {
      if (confirm("로그아웃 하시겠습니까?")) {
        await signOut(auth);
        console.log("User signed out.");
      }
    } catch (error) {
      console.error("Sign-out error:", error);
      alert("로그아웃 중 오류가 발생했습니다.");
    }
  });

  // 3. Auth 상태 변화 모니터링 (실시간 세션 감지 및 UI 바인딩)
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // 로그인된 경우
      window.isLoggedIn = true;
      
      userPhoto.src = user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c";
      userPhoto.onerror = () => {
        userPhoto.src = "https://lh3.googleusercontent.com/a/default-user=s96-c";
      };
      userName.textContent = user.displayName || "사용자";

      authUserArea.style.display = "flex";
      btnLogin.style.display = "none";
      
      btnLogin.disabled = false;
      btnLogin.textContent = "로그인";
    } else {
      // 로그아웃 상태인 경우
      window.isLoggedIn = false;
      
      userPhoto.src = "";
      userName.textContent = "";

      authUserArea.style.display = "none";
      btnLogin.style.display = "block";
      
      btnLogin.disabled = false;
      btnLogin.textContent = "로그인";
    }
  });
});
// Build cache bust: 2026-06-27T16:30:00
