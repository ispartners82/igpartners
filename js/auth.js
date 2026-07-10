import { auth, db } from "/js/firebase-db.js?v=2.0.7";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * IGPartners 인증 및 세션 연동 모듈
 * 구글 로그인을 수행하고 Firestore 사용자 컬렉션에 권한을 동기화합니다.
 * 동적 네비게이션 바 주입에 대응할 수 있도록 이벤트 위임(Event Delegation) 방식을 활용합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Google Auth Provider 및 상세 설정
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account' // 사용자 계정 선택 강제화
  });

  // =========================================================================
  // 1. 이벤트 위임(Event Delegation) 기반의 글로벌 클릭 리스너 등록
  // =========================================================================
  document.addEventListener("click", async (e) => {
    const target = e.target;
    if (!target) return;

    // A. 로그인 버튼 클릭 핸들러 (동적 생성되는 네비게이션 로그인 및 모바일 퀵 로그인 버튼 대응)
    if (target.id === "btn-login" || target.closest("#btn-login") || target.id === "quick-btn-login" || target.closest("#quick-btn-login")) {
      const btnLogin = document.getElementById("btn-login");
      try {
        if (btnLogin) {
          btnLogin.disabled = true;
          btnLogin.textContent = "로그인 중...";
        }
        
        // 구글 팝업 로그인 시작
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("Google sign-in successful:", user.displayName);

        // Firestore에 사용자 정보 동기화 (기존 가입 정보가 없을 때만 생성)
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            email: user.email,
            name: user.displayName,
            role: "user", // 기본 일반 유저 등급 부여
            createdAt: new Date().toISOString()
          });
          console.log("New user registered in users collection:", user.uid);
        }
        
      } catch (error) {
        console.error("Google sign-in error:", error);
        
        // 오류 예외 상황에 따른 피드백 메세지 정의
        let errorMsg = "로그인 중 오류가 발생했습니다. 다시 시도해 주세요.";
        if (error.code === "auth/configuration-not-found") {
          errorMsg = "Firebase 콘솔 설정 오류가 발견되었습니다.\n\n[해결 방법]\nFirebase 콘솔 > Authentication > Sign-in method 메뉴에서 'Google' 로그인 제공업체를 [사용 설정]으로 활성화해야 로그인 기능이 정상 작동합니다.";
        } else {
          errorMsg = `로그인 오류가 발생했습니다.\n(오류 코드: ${error.code || error.message})`;
        }
        
        alert(errorMsg);
        
        if (btnLogin) {
          btnLogin.disabled = false;
          btnLogin.textContent = "로그인";
        }
      }
    }

    // B. 로그아웃 버튼 클릭 핸들러 (동적 생성되는 네비게이션 로그아웃 버튼 대응)
    if (target.id === "btn-logout" || target.closest("#btn-logout")) {
      try {
        if (confirm("로그아웃 하시겠습니까?")) {
          await signOut(auth);
          console.log("User signed out.");
        }
      } catch (error) {
        console.error("Sign-out error:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
      }
    }
  });

  // =========================================================================
  // 2. Auth 상태 변화 모니터링 (실시간 세션 감지 및 UI 바인딩)
  // =========================================================================

  /**
   * [성능 최적화] 사용자 역할(role) 캐시 함수
   * - 동일 세션 내에서 중복 Firestore 읽기를 방지하기 위해 sessionStorage에 역할을 캐싱합니다.
   * - 로그아웃 시 캐시를 무효화하여 항상 최신 권한이 반영되도록 합니다.
   * @param {string} uid - 사용자 UID
   * @returns {Promise<string|null>} 역할 문자열 또는 null
   */
  async function getCachedUserRole(uid) {
    // 1. 세션스토리지 캐시 확인 (이미 조회한 경우 Firestore 재조회 생략)
    const cacheKey = `user_role_cache_${uid}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 2. 캐시 없음 → Firestore에서 1회만 조회 후 캐시 저장
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const role = userDocSnap.data().role || "user";
        sessionStorage.setItem(cacheKey, role);
        return role;
      }
    } catch (e) {
      console.error("사용자 역할 조회 실패:", e);
    }
    return null;
  }

  /**
   * [성능 최적화] 역할 캐시 무효화 함수
   * 로그아웃 또는 역할 변경 시 호출하여 캐시를 삭제합니다.
   */
  function clearUserRoleCache(uid) {
    if (uid) {
      sessionStorage.removeItem(`user_role_cache_${uid}`);
      sessionStorage.removeItem(`admin_permissions_cache_${uid}`);
    }
  }

  // 역할 캐시 무효화 함수를 전역으로 노출 (admin.js에서 역할 변경 후 캐시 초기화에 활용)
  window.clearUserRoleCache = clearUserRoleCache;

  onAuthStateChanged(auth, async (user) => {
    // 상태 감지 순간에 화면에 렌더링된 요소들을 실시간 쿼리하여 에러 차단
    const btnLogin = document.getElementById("btn-login");
    const authUserArea = document.getElementById("auth-user");
    const userPhoto = document.getElementById("user-photo");
    const userName = document.getElementById("user-name");
    const btnAdminDashboard = document.getElementById("btn-admin-dashboard");

    // 신규 추가: 모바일 전용 퀵 버튼 요소들 캐싱
    const quickBtnMyReservations = document.getElementById("quick-btn-my-reservations");
    const quickBtnAdminDashboard = document.getElementById("quick-btn-admin-dashboard");
    const quickBtnLogin = document.getElementById("quick-btn-login");

    if (user) {
      // 1) 로그인된 상태 처리
      window.isLoggedIn = true;
      
      if (userPhoto) {
        userPhoto.src = user.photoURL || "https://lh3.googleusercontent.com/a/default-user=s96-c";
        userPhoto.onerror = () => {
          userPhoto.src = "https://lh3.googleusercontent.com/a/default-user=s96-c";
        };
      }
      
      if (userName) {
        userName.textContent = user.displayName || "사용자";
      }

      if (authUserArea) {
        authUserArea.style.display = "flex";
      }
      if (btnLogin) {
        btnLogin.style.display = "none";
        btnLogin.disabled = false;
        btnLogin.textContent = "로그인";
      }

      // 신규 추가: 로그인 세션 유효 시 모바일용 퀵 버튼 표시 상태 최적화
      if (quickBtnMyReservations) {
        quickBtnMyReservations.style.display = "inline-flex";
      }
      if (quickBtnLogin) {
        quickBtnLogin.style.display = "none";
      }

      // [성능 최적화] sessionStorage 캐싱된 역할을 우선 사용하여 Firestore 재조회 방지
      // 동일 세션 내 최초 1회만 Firestore에서 읽고 이후에는 캐시에서 역할을 반환합니다.
      try {
        const userRole = await getCachedUserRole(user.uid);

        // [한글 주석: roles 컬렉션에서 해당 등급의 관리자 진입 권한(isAdmin) 및 예약통계 권한(hasStats)을 동적으로 읽어옴]
        let isAdmin = false;
        let hasStats = false;
        if (userRole) {
          try {
            const roleDocRef = doc(db, "roles", userRole);
            const roleDocSnap = await getDoc(roleDocRef);
            if (roleDocSnap.exists()) {
              const roleData = roleDocSnap.data();
              isAdmin = roleData.isAdmin !== undefined ? roleData.isAdmin : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
              hasStats = roleData.hasStats !== undefined ? roleData.hasStats : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
            } else {
              isAdmin = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
              hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
            }
          } catch (e) {
            console.error("Failed to load permissions from roles in auth.js:", e);
            isAdmin = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
            hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole);
          }
        }

        const currentAdminBtn = document.getElementById("btn-admin-dashboard");
        const currentStatsBtn = document.getElementById("btn-stats-dashboard");
        // 신규 추가: 모바일용 퀵 관리자 버튼 캐싱
        const currentQuickAdminBtn = document.getElementById("quick-btn-admin-dashboard");
        const currentQuickStatsBtn = document.getElementById("quick-btn-stats-dashboard");
        
        if (currentAdminBtn) {
          currentAdminBtn.style.display = isAdmin ? "inline-flex" : "none";
        }
        if (currentStatsBtn) {
          currentStatsBtn.style.display = hasStats ? "inline-flex" : "none";
        }
        // 신규 추가: 모바일용 퀵 관리자 버튼도 권한에 맞춰 동시 노출 제어
        if (currentQuickAdminBtn) {
          currentQuickAdminBtn.style.display = isAdmin ? "inline-flex" : "none";
        }
        if (currentQuickStatsBtn) {
          currentQuickStatsBtn.style.display = hasStats ? "inline-flex" : "none";
        }
      } catch (error) {
        console.error("사용자 권한 등급 확인 실패 (Admin button check failed):", error);
      }

      // 로그인 성공 시 로그인 요구 안내 모달 팝업 자동 숨김
      hideLoginModal();
    } else {
      // 2) 로그아웃(비인증) 상태 처리
      window.isLoggedIn = false;
      
      if (userPhoto) userPhoto.src = "";
      if (userName) userName.textContent = "";

      if (authUserArea) authUserArea.style.display = "none";
      if (btnLogin) {
        btnLogin.style.display = "block";
        btnLogin.disabled = false;
        btnLogin.textContent = "로그인";
      }

      // 신규 추가: 로그아웃 상태일 때 모바일 퀵 예약 및 관리자 버튼 숨기고 로그인 아이콘 노출
      if (quickBtnMyReservations) {
        quickBtnMyReservations.style.display = "none";
      }
      if (quickBtnAdminDashboard) {
        quickBtnAdminDashboard.style.display = "none";
      }
      const quickBtnStatsDashboard = document.getElementById("quick-btn-stats-dashboard");
      if (quickBtnStatsDashboard) {
        quickBtnStatsDashboard.style.display = "none";
      }
      if (quickBtnLogin) {
        quickBtnLogin.style.display = "inline-flex";
      }

      // 로그아웃 시 관리자 버튼 즉시 숨김
      if (btnAdminDashboard) {
        btnAdminDashboard.style.display = "none";
      }
      const btnStatsDashboard = document.getElementById("btn-stats-dashboard");
      if (btnStatsDashboard) {
        btnStatsDashboard.style.display = "none";
      }
      
      // [성능 최적화] 로그아웃 시 이전 사용자 역할 캐시 및 관리자 권한 캐시를 전체 정리
      // sessionStorage에 남아있는 모든 역할 캐시 키를 순회하여 삭제
      Object.keys(sessionStorage)
        .filter(key => key.startsWith("user_role_cache_") || key.startsWith("admin_permissions_cache_"))
        .forEach(key => sessionStorage.removeItem(key));
    }
  });

  // =========================================================================
  // 3. 공통 로그인 요구 모달 제어 로직
  // =========================================================================
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

  // 모달 내부 구글 로그인 버튼 클릭 시 동적 로그인 버튼의 클릭 이벤트 트리거 위임
  if (btnTriggerLogin) {
    btnTriggerLogin.addEventListener("click", () => {
      const btnLogin = document.getElementById("btn-login");
      if (btnLogin) {
        btnLogin.click();
      }
    });
  }
});
