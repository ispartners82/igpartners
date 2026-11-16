/**
 * 상단 공통 네비게이션 및 로그인 버튼 초기 렌더링(FOUC 방지) 동기 스크립트
 * HTML 파싱 직후 세션 스토리지 캐시(auth_user_cache, admin_permissions_*)를 즉시 확인하여
 * 비로그인/로그인 상태 및 관리자·통계 버튼을 지연 없이(0ms) 선반영합니다.
 */
(function () {
  function applyHeaderAuthCache() {
    try {
      var cachedUserStr = sessionStorage.getItem("auth_user_cache");
      var authUser = document.getElementById("auth-user");
      var btnLogin = document.getElementById("btn-login");
      var quickBtnLogin = document.getElementById("quick-btn-login");
      var quickBtnMyRes = document.getElementById("quick-btn-my-reservations");
      var heroBtnLogin = document.getElementById("hero-btn-login");

      if (cachedUserStr) {
        var u = JSON.parse(cachedUserStr);
        if (authUser) authUser.style.display = "flex";
        if (btnLogin) btnLogin.style.display = "none";

        var nameEl = document.getElementById("user-name");
        var photoEl = document.getElementById("user-photo");
        if (nameEl && u.displayName) nameEl.textContent = u.displayName;
        if (photoEl && u.photoURL) photoEl.src = u.photoURL;

        if (quickBtnLogin) quickBtnLogin.style.display = "none";
        if (quickBtnMyRes) quickBtnMyRes.style.display = "inline-flex";
        if (heroBtnLogin) heroBtnLogin.style.display = "none";

        // 관리자 및 예약통계 버튼 권한 캐시 즉시 반영
        var permStr = sessionStorage.getItem("admin_permissions_" + u.uid);
        if (permStr) {
          var perm = JSON.parse(permStr);
          if (perm && perm.permissions) {
            var isAdm = !!(perm.role === "super_admin" || perm.permissions.isAdmin);
            var isSt = !!(perm.role === "super_admin" || perm.permissions.hasStats);

            var adm = document.getElementById("btn-admin-dashboard");
            if (adm) adm.style.display = isAdm ? "inline-block" : "none";
            var st = document.getElementById("btn-stats-dashboard");
            if (st) st.style.display = isSt ? "inline-block" : "none";

            var qAdm = document.getElementById("quick-btn-admin-dashboard");
            if (qAdm) qAdm.style.display = isAdm ? "inline-flex" : "none";
            var qSt = document.getElementById("quick-btn-stats-dashboard");
            if (qSt) qSt.style.display = isSt ? "inline-flex" : "none";
          }
        }
      } else {
        // 비로그인 상태일 때 데스크톱 및 히어로 로그인 버튼 즉시 표출
        if (btnLogin) {
          btnLogin.style.display = "block";
          btnLogin.disabled = false;
        }
        if (heroBtnLogin) {
          heroBtnLogin.style.display = "inline-flex";
        }
      }
    } catch (e) {
      // 세션 스토리지 접근이 차단된 환경에서는 기본 UI를 유지합니다.
    }
  }

  window.initHeaderAuthUI = applyHeaderAuthCache;
  applyHeaderAuthCache();
})();
