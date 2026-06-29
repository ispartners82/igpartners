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
    const btnAdminDashboard = document.getElementById("btn-admin-dashboard");

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

      // [신규 기능] 로그인한 사용자의 등급을 Firestore에서 조회하여 관리자 버튼 노출 제어
      if (btnAdminDashboard) {
        // 데이터 로드 전까지는 기본적으로 숨김 처리
        btnAdminDashboard.style.display = "none";

        const userDocRef = doc(db, "users", user.uid);
        getDoc(userDocRef).then((userDocSnap) => {
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            // 관리자 대시보드 바로가기 버튼을 보일 수 있는 등급 정의 (최고관리자, 일반관리자, 관리자)
            const allowedRoles = ["super_admin", "admin", "admin_user"];
            // 사용자의 역할이 허용된 권한 그룹에 포함되면 관리자 대시보드 바로가기 활성화
            if (allowedRoles.includes(userData.role)) {
              btnAdminDashboard.style.display = "inline-flex";
            }
          }
        }).catch((error) => {
          console.error("사용자 권한 등급 확인 실패 (Admin button check failed):", error);
        });
      }

      // 로그인 성공 시 로그인 요구 모달 자동 닫기
      hideLoginModal();
    } else {
      // 로그아웃 상태인 경우
      window.isLoggedIn = false;
      
      userPhoto.src = "";
      userName.textContent = "";

      authUserArea.style.display = "none";
      btnLogin.style.display = "block";
      
      btnLogin.disabled = false;
      btnLogin.textContent = "로그인";

      // 로그아웃 상태인 경우 관리자 버튼은 항상 숨김 처리
      if (btnAdminDashboard) {
        btnAdminDashboard.style.display = "none";
      }
    }
  });

  // --- 공통 로그인 요구 모달 제어 로직 ---
  const loginRequiredModal = document.getElementById("login-required-modal");
  const btnCloseLoginModal = document.getElementById("btn-close-login-modal");
  const btnCloseLoginModalX = document.getElementById("btn-close-login-modal-x");
  const btnTriggerLogin = document.getElementById("btn-trigger-login");

  function showLoginModal() {
    if (loginRequiredModal) {
      loginRequiredModal.style.display = "flex";
      document.body.classList.add("modal-open");
    }
  }
  window.showLoginModal = showLoginModal;

  function hideLoginModal() {
    if (loginRequiredModal) {
      loginRequiredModal.style.display = "none";
      document.body.classList.remove("modal-open");
    }
  }
  window.hideLoginModal = hideLoginModal;

  if (btnCloseLoginModal) btnCloseLoginModal.addEventListener("click", hideLoginModal);
  if (btnCloseLoginModalX) btnCloseLoginModalX.addEventListener("click", hideLoginModal);
  if (loginRequiredModal) {
    window.addEventListener("click", (e) => {
      if (e.target === loginRequiredModal) {
        hideLoginModal();
      }
    });
  }

  // 모달 내부 로그인 버튼 클릭 시 헤더 로그인 액션 트리거
  if (btnTriggerLogin) {
    btnTriggerLogin.addEventListener("click", () => {
      if (btnLogin) {
        btnLogin.click();
      }
    });
  }
});
// Build cache bust: 2026-06-27T16:30:00
