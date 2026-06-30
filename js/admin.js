import { db, auth } from "./firebase-db.js?v=2.0.7";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const reservationList = document.getElementById("reservation-list");
  const btnRefresh = document.getElementById("btn-refresh");

  const tabReservations = document.getElementById("tab-reservations");
  const tabUsers = document.getElementById("tab-users");
  const contentReservations = document.getElementById("content-reservations");
  const contentUsers = document.getElementById("content-users");

  const userList = document.getElementById("user-list");
  const btnRefreshUsers = document.getElementById("btn-refresh-users");

  let currentLoginUserRole = "user"; // 현재 로그인한 사용자의 등급 저장

  const statTotal = document.getElementById("stat-total");
  const statPending = document.getElementById("stat-pending");
  const statConfirmed = document.getElementById("stat-confirmed");
  const statCancelled = document.getElementById("stat-cancelled");

  let unsubscribe = null;

  // 통계 업데이트 함수 정의
  function updateStats(total, pending, confirmed, cancelled) {
    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statConfirmed) statConfirmed.textContent = confirmed;
    if (statCancelled) statCancelled.textContent = cancelled;
  }

  // 렌더링 전용 함수 정의
  function renderReservations(items) {
    reservationList.innerHTML = "";

    let totalCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;

    if (items.length === 0) {
      reservationList.innerHTML = `<tr><td colspan="13" class="table-empty">현재 등록된 예약 내역이 없습니다.</td></tr>`;
      updateStats(0, 0, 0, 0);
      return;
    }

    items.forEach((data) => {
      const docId = data.id;

      totalCount++;
      if (data.status === "pending") pendingCount++;
      else if (data.status === "confirmed") confirmedCount++;
      else if (data.status === "cancelled") cancelledCount++;

      // 테이블 행 생성
      const tr = document.createElement("tr");
      tr.className = `status-${data.status}`;

      // 생성 시간 포맷팅
      let dateStr = "-";
      if (data.createdAt) {
        const jsDate = typeof data.createdAt.toDate === "function"
          ? data.createdAt.toDate()
          : new Date(data.createdAt);

        dateStr = jsDate.toLocaleString("ko-KR", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        });
      }

      // 선택언어 라벨 매핑
      const langLabels = {
        "vi": "🇻🇳 베트남어 (Vietnamese)",
        "ko": "🇰🇷 한국어 (Korean)",
        "en": "🇺🇸 영어 (English)",
        "my": "🇲🇲 미얀마어 (Burmese)",
        "kh": "🇰🇭 캄보디아어 (Khmer)",
        "la": "🇱🇦 라오스어 (Lao)",
        "np": "🇳🇵 네팔어 (Nepali)"
      };
      const displayLang = langLabels[data.lang] || (data.lang ? `🌐 ${data.lang}` : "-");

      // 신원 정보 라벨 (하위 호환성 유지)
      // 기존에 저장된 alienNo(외국인번호) 및 passportNo(여권번호) 데이터만 신원정보 뱃지 형태로 묶어 노출시킵니다.
      // 새로 추가된 비자타입 및 체류만료일은 테이블 내 별도 독립 컬럼으로 렌더링하므로 뱃지 목록에서 제외합니다.
      const idInfo = [];
      if (data.alienNo) idInfo.push(`<div class="id-badge alien">외국인: ${data.alienNo}</div>`);
      if (data.passportNo) idInfo.push(`<div class="id-badge passport">여권: ${data.passportNo}</div>`);
      const idInfoHTML = idInfo.length > 0 ? idInfo.join("") : "-";

      // 상태 배지 클래스
      let statusBadgeText = "대기중";
      let statusBadgeClass = "badge-pending";
      if (data.status === "confirmed") {
        statusBadgeText = "예약 확정";
        statusBadgeClass = "badge-confirmed";
      } else if (data.status === "cancelled") {
        statusBadgeText = "예약 취소";
        statusBadgeClass = "badge-cancelled";
      }

      // 액션 버튼 제어
      let actionButtons = "";
      if (data.status === "pending") {
        actionButtons = `
          <button class="btn-action confirm" data-id="${docId}" data-action="confirm">확정</button>
          <button class="btn-action cancel" data-id="${docId}" data-action="cancel">취소</button>
        `;
      } else if (data.status === "confirmed") {
        actionButtons = `
          <button class="btn-action pending" data-id="${docId}" data-action="pending">대기로 변경</button>
          <button class="btn-action cancel" data-id="${docId}" data-action="cancel">취소</button>
        `;
      } else if (data.status === "cancelled") {
        actionButtons = `
          <button class="btn-action pending" data-id="${docId}" data-action="pending">대기로 변경</button>
          <button class="btn-action confirm" data-id="${docId}" data-action="confirm">확정</button>
        `;
      }

      // 삭제 버튼 추가 (최고 관리자 전용)
      if (currentLoginUserRole === "super_admin") {
        actionButtons += `<button class="btn-action delete" data-id="${docId}" data-action="delete">삭제</button>`;
      }

      // 테이블 렌더링 처리
      // 성별-생년월일 사이에 비자타입(col-visa-type) 컬럼을 추가하고, 신원정보-연락처 사이에 체류만료일(col-visa-expiry) 컬럼을 각각 신설하여 출력합니다.
      tr.innerHTML = `
        <td class="col-lang"><span class="lang-badge">${displayLang}</span></td>
        <td class="col-name font-bold">${data.name || "-"}</td>
        <td class="col-clinic"><span class="table-clinic-name">${data.clinic || "-"}</span></td>
        <td class="col-gender">${data.gender || "-"}</td>
        <td class="col-visa-type font-bold" style="color: #34d399;">${data.visaType || "-"}</td>
        <td class="col-dob">${data.dob || "-"}</td>
        <td class="col-id">${idInfoHTML}</td>
        <td class="col-visa-expiry text-accent">${data.visaExpiry || "-"}</td>
        <td class="col-phone">${data.phone || "-"}</td>
        <td class="col-date">${dateStr}</td>
        <td class="col-res-date font-bold text-accent">${data.reservationDate || "-"}</td>
        <td class="col-address">${data.address || "-"}</td>
        <td class="col-symptoms">${data.symptoms || "-"}</td>
        <td class="col-status"><span class="badge ${statusBadgeClass}">${statusBadgeText}</span></td>
        <td class="col-actions"><div class="action-wrapper">${actionButtons}</div></td>
      `;

      reservationList.appendChild(tr);
    });

    updateStats(totalCount, pendingCount, confirmedCount, cancelledCount);
  }

  // 실시간 수신 대기 및 병합
  function loadReservations() {
    if (unsubscribe) {
      unsubscribe();
    }

    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));
    reservationList.innerHTML = `<tr><td colspan="13" class="table-loading">데이터를 실시간 동기화 중입니다...</td></tr>`;

    // 1단계: Firestore 로드 전, 로컬스토리지 백업 데이터가 있다면 먼저 렌더링 (즉각적인 피드백 보장)
    let initialLocalItems = [];
    try {
      const localData = localStorage.getItem("local_reservations");
      if (localData) {
        initialLocalItems = JSON.parse(localData);
      }
    } catch (e) {
      console.error("Initial local storage parse failed:", e);
    }
    if (initialLocalItems.length > 0) {
      const sortedLocal = initialLocalItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderReservations(sortedLocal);
    }

    unsubscribe = onSnapshot(q, (querySnapshot) => {
      // 1. Firestore 데이터 수집
      const firestoreItems = [];
      querySnapshot.forEach((docSnap) => {
        firestoreItems.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // 2. 로컬스토리지 백업 데이터 수집
      let localItems = [];
      try {
        const localData = localStorage.getItem("local_reservations");
        if (localData) {
          localItems = JSON.parse(localData);
        }
      } catch (e) {
        console.error("Local storage read error in admin snapshot:", e);
      }

      // 3. 중복을 제거하며 병합 (Firestore 데이터 우선)
      const mergedMap = new Map();

      localItems.forEach(item => {
        mergedMap.set(item.id, item);
      });

      firestoreItems.forEach(item => {
        let dateStr = new Date().toISOString();
        if (item.createdAt) {
          dateStr = typeof item.createdAt.toDate === "function"
            ? item.createdAt.toDate().toISOString()
            : new Date(item.createdAt).toISOString();
        }
        mergedMap.set(item.id, {
          ...item,
          createdAt: dateStr
        });
      });

      // 4. 시간 역순 정렬
      const finalItems = Array.from(mergedMap.values()).sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // 5. 렌더링 호출
      renderReservations(finalItems);

    }, (error) => {
      console.warn("Firestore listener failed. Showing local storage data only.", error);

      // Firestore 접근 불가 시 로컬스토리지 백업만이라도 로드하여 노출
      let localItems = [];
      try {
        const localData = localStorage.getItem("local_reservations");
        if (localData) {
          localItems = JSON.parse(localData);
        }
      } catch (e) {}

      const finalItems = localItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderReservations(finalItems);
    });
  }

  // 로컬스토리지 예약 데이터 상태 업데이트 헬퍼 함수
  function updateLocalReservation(docId, action) {
    try {
      const existing = localStorage.getItem("local_reservations");
      if (!existing) return;
      let localData = JSON.parse(existing);

      if (action === "delete") {
        localData = localData.filter(item => item.id !== docId);
      } else {
        const item = localData.find(i => i.id === docId);
        if (item) {
          if (action === "confirm") item.status = "confirmed";
          else if (action === "cancel") item.status = "cancelled";
          else if (action === "pending") item.status = "pending";
        }
      }

      localStorage.setItem("local_reservations", JSON.stringify(localData));
      // 로컬 갱신 후 화면 강제 재랜더링
      loadReservations();
    } catch (e) {
      console.error("Local data update error:", e);
    }
  }

  // 상태 관리 버튼 클릭 이벤트 바인딩 (이벤트 위임 사용)
  reservationList.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("btn-action")) return;

    const button = e.target;
    const docId = button.dataset.id;
    const action = button.dataset.action;

    if (!docId) return;

    // 로딩 표시
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = "...";

    // 1. 로컬 데이터인 경우 로컬스토리지만 업데이트
    if (docId.startsWith("local_")) {
      updateLocalReservation(docId, action);
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    // 2. 일반 Firestore 데이터의 경우
    try {
      const docRef = doc(db, "reservations", docId);

      if (action === "confirm") {
        await updateDoc(docRef, { status: "confirmed" });
      } else if (action === "cancel") {
        if (confirm("정말 이 예약을 취소하시겠습니까?")) {
          await updateDoc(docRef, { status: "cancelled" });
        }
      } else if (action === "pending") {
        await updateDoc(docRef, { status: "pending" });
      } else if (action === "delete") {
        if (confirm("이 예약 내역을 영구적으로 삭제하시겠습니까? (삭제된 정보는 복구할 수 없습니다.)")) {
          await deleteDoc(docRef);
        }
      }
      
      // 혹시 로컬스토리지에도 백업 데이터로 남아있는 경우 정합성을 위해 함께 삭제/수정
      updateLocalReservation(docId, action);
      
    } catch (error) {
      console.warn("Firestore update failed. Fallback to local storage update.", error);
      updateLocalReservation(docId, action);
    } finally {
      // 버튼 복구
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  // 새로고침 버튼
  btnRefresh.addEventListener("click", () => {
    loadReservations();
  });

  // Firebase Auth 상태 감지 및 관리자 권한 검증
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("로그인이 필요합니다. (Login is required.)");
      location.href = "./index.html";
      return;
    }

    try {
      // 데이터 로딩 인디케이터 표시
      reservationList.innerHTML = `<tr><td colspan="13" class="table-loading">권한을 확인하는 중입니다...</td></tr>`;

      // [최우선 조치] 최초 진입 시점에도 역할을 온전히 매핑하기 위해 권한 시딩/마이그레이션을 즉각 실행합니다.
      const rolesCol = collection(db, "roles");
      try {
        const snap = await getDocs(rolesCol);
        let needsMigration = snap.empty;
        if (!snap.empty) {
          const superAdminSnap = await getDoc(doc(db, "roles", "super_admin"));
          if (!superAdminSnap.exists() || superAdminSnap.data().isAdmin === undefined) {
            needsMigration = true;
          }
        }

        if (needsMigration) {
          console.log("[Auth State] Migrating database roles table immediately...");
          for (const r of defaultRoles) {
            const roleDocRef = doc(db, "roles", r.key);
            const roleDoc = await getDoc(roleDocRef);
            if (!roleDoc.exists()) {
              await setDoc(roleDocRef, {
                label: r.label,
                isSystem: r.isSystem,
                isAdmin: r.isAdmin,
                hasReservations: r.hasReservations,
                hasClinics: r.hasClinics,
                hasRoles: r.hasRoles,
                hasPermissions: r.hasPermissions,
                createdAt: new Date().toISOString()
              });
            } else {
              const existingData = roleDoc.data();
              await updateDoc(roleDocRef, {
                isAdmin: existingData.isAdmin !== undefined ? existingData.isAdmin : r.isAdmin,
                hasReservations: existingData.hasReservations !== undefined ? existingData.hasReservations : r.hasReservations,
                hasClinics: existingData.hasClinics !== undefined ? existingData.hasClinics : r.hasClinics,
                hasRoles: existingData.hasRoles !== undefined ? existingData.hasRoles : r.hasRoles,
                hasPermissions: existingData.hasPermissions !== undefined ? existingData.hasPermissions : r.hasPermissions
              });
            }
          }
          console.log("[Auth State] Roles database migration completed.");
        }
      } catch (errSeeding) {
        console.error("Critical fallback seeding failed:", errSeeding);
      }

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const userRole = userData.role || "user";
        
        // 등급 문서로부터 5가지 권한 로드
        const roleDocRef = doc(db, "roles", userRole);
        const roleDocSnap = await getDoc(roleDocRef);
        
        let permissions = {
          isAdmin: false,
          hasReservations: false,
          hasClinics: false,
          hasRoles: false,
          hasPermissions: false
        };

        if (roleDocSnap.exists()) {
          const roleData = roleDocSnap.data();
          // DB 로드 데이터 바인딩 + 누락 필드가 있을 경우 등급키 성격에 따라 하위 호환 롤백 가드 적용 (100% 진입 성공 보장)
          permissions = {
            isAdmin: roleData.isAdmin !== undefined ? roleData.isAdmin : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole),
            hasReservations: roleData.hasReservations !== undefined ? roleData.hasReservations : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(userRole),
            hasClinics: roleData.hasClinics !== undefined ? roleData.hasClinics : ["super_admin", "admin", "admin_user"].includes(userRole),
            hasRoles: roleData.hasRoles !== undefined ? roleData.hasRoles : (userRole === "super_admin"),
            hasPermissions: roleData.hasPermissions !== undefined ? roleData.hasPermissions : (userRole === "super_admin")
          };
        } else {
          // 예외 상황: roles 문서가 DB에 없을 경우 하위 호환 권한 매핑
          if (userRole === "super_admin") {
            permissions = { isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: true, hasPermissions: true };
          } else if (["admin", "admin_user"].includes(userRole)) {
            permissions = { isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: false, hasPermissions: false };
          } else if (["top_manager", "res_manager"].includes(userRole)) {
            permissions = { isAdmin: true, hasReservations: true, hasClinics: false, hasRoles: false, hasPermissions: false };
          }
        }

        if (permissions.isAdmin === true) {
          console.log(`Access granted for role: ${userRole}`);
          currentLoginUserRole = userRole; // 등급 캐싱
          
          // 동적으로 탭 노출 여부 온오프 스위칭
          const tabReservations = document.getElementById("tab-reservations");
          const tabUsers = document.getElementById("tab-users");
          const tabPermissions = document.getElementById("tab-permissions");
          const tabClinics = document.getElementById("tab-clinics");

          if (tabReservations) {
            tabReservations.style.display = permissions.hasReservations ? "inline-block" : "none";
          }
          if (tabUsers) {
            tabUsers.style.display = permissions.hasRoles ? "inline-block" : "none";
          }
          if (tabPermissions) {
            tabPermissions.style.display = permissions.hasPermissions ? "inline-block" : "none";
          }
          if (tabClinics) {
            tabClinics.style.display = permissions.hasClinics ? "inline-block" : "none";
          }
          
          // 권한 획득 성공 시 예약 정보 로드 진행
          loadReservations();
          return;
        }
      }

      // 권한 없음 처리
      alert("관리자 권한이 없습니다. (Access Denied: No Admin Role)");
      location.href = "./index.html";

    } catch (error) {
      console.error("Auth role check failed:", error);
      alert("권한 검증 오류가 발생했습니다. (Authorization Error)");
      location.href = "./index.html";
    }
  });

  // 탭 전환 이벤트 리스너
  const tabClinics = document.getElementById("tab-clinics");
  const contentClinics = document.getElementById("content-clinics");
  const tabPermissions = document.getElementById("tab-permissions");
  const contentPermissions = document.getElementById("content-permissions");

  if (tabReservations && tabUsers && tabClinics) {
    tabReservations.addEventListener("click", () => {
      tabReservations.classList.add("active");
      tabUsers.classList.remove("active");
      if (tabPermissions) tabPermissions.classList.remove("active");
      tabClinics.classList.remove("active");
      contentReservations.style.display = "block";
      contentUsers.style.display = "none";
      if (contentPermissions) contentPermissions.style.display = "none";
      contentClinics.style.display = "none";
    });

    tabUsers.addEventListener("click", () => {
      tabUsers.classList.add("active");
      tabReservations.classList.remove("active");
      if (tabPermissions) tabPermissions.classList.remove("active");
      tabClinics.classList.remove("active");
      contentReservations.style.display = "none";
      contentUsers.style.display = "block";
      if (contentPermissions) contentPermissions.style.display = "none";
      contentClinics.style.display = "none";
      initRolesAndListen(); // 회원 등급 실시간 로드 시작
    });

    if (tabPermissions) {
      tabPermissions.addEventListener("click", () => {
        tabPermissions.classList.add("active");
        tabReservations.classList.remove("active");
        tabUsers.classList.remove("active");
        tabClinics.classList.remove("active");
        contentReservations.style.display = "none";
        contentUsers.style.display = "none";
        if (contentPermissions) contentPermissions.style.display = "block";
        contentClinics.style.display = "none";
        initRolesAndListen(); // 등급 캐시 및 데이터 연동
        loadUsers(); // 가입 회원 목록 즉시 로드
      });
    }

    tabClinics.addEventListener("click", () => {
      tabClinics.classList.add("active");
      tabReservations.classList.remove("active");
      tabUsers.classList.remove("active");
      if (tabPermissions) tabPermissions.classList.remove("active");
      contentReservations.style.display = "none";
      contentUsers.style.display = "none";
      if (contentPermissions) contentPermissions.style.display = "none";
      contentClinics.style.display = "block";
      loadClinics(); // 병원 목록 불러오기
    });
  }

  // --- 회원 등급(역할) 동적 관리 기능 구현 ---
  let unsubscribeRoles = null;
  let rolesCache = {}; // { super_admin: "최고 관리자", ... }

  const defaultRoles = [
    { key: "super_admin", label: "최고 관리자", isSystem: true, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: true, hasPermissions: true },
    { key: "admin", label: "일반 관리자", isSystem: true, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: false, hasPermissions: false },
    { key: "admin_user", label: "관리자", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: true, hasRoles: false, hasPermissions: false },
    { key: "top_manager", label: "최고 매니저", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: false, hasRoles: false, hasPermissions: false },
    { key: "res_manager", label: "예약 매니저", isSystem: false, isAdmin: true, hasReservations: true, hasClinics: false, hasRoles: false, hasPermissions: false },
    { key: "partner", label: "제휴 병원", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false },
    { key: "vip", label: "VIP 회원", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false },
    { key: "general", label: "일반", isSystem: false, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false },
    { key: "user", label: "일반 회원", isSystem: true, isAdmin: false, hasReservations: false, hasClinics: false, hasRoles: false, hasPermissions: false }
  ];

  // 회원 등급 로드 및 초기 시드 처리
  async function initRolesAndListen() {
    if (unsubscribeRoles) {
      loadUsers(); // 이미 리스닝 중인 경우, 중복 리스너 등록은 방지하고 회원 목록은 즉시 로드
      return; 
    }

    const rolesCol = collection(db, "roles");

    // 1. 초기 시드 등급 적재 검사는 백그라운드 비동기로 실행하여 메인 흐름을 블로킹하지 않게 처리
    (async () => {
      try {
        const snap = await getDocs(rolesCol);
        
        // 1. roles 컬렉션이 아예 비어있거나, 기존 데이터에 권한 필드(isAdmin)가 누락된 경우 마이그레이션 필요로 판정
        let needsMigration = snap.empty;
        if (!snap.empty) {
          const superAdminSnap = await getDoc(doc(db, "roles", "super_admin"));
          if (!superAdminSnap.exists() || superAdminSnap.data().isAdmin === undefined) {
            needsMigration = true;
          }
        }

        if (needsMigration) {
          console.log("Database Migration: Seeding or updating default roles permissions...");
          for (const r of defaultRoles) {
            const roleDocRef = doc(db, "roles", r.key);
            const roleDoc = await getDoc(roleDocRef);

            if (!roleDoc.exists()) {
              // 문서 자체가 없으면 새로 생성
              await setDoc(roleDocRef, {
                label: r.label,
                isSystem: r.isSystem,
                isAdmin: r.isAdmin,
                hasReservations: r.hasReservations,
                hasClinics: r.hasClinics,
                hasRoles: r.hasRoles,
                hasPermissions: r.hasPermissions,
                createdAt: new Date().toISOString()
              });
            } else {
              // 기존 문서가 존재하면 누락된 신규 권한 필드만 안전하게 머지 업데이트
              const existingData = roleDoc.data();
              await updateDoc(roleDocRef, {
                isAdmin: existingData.isAdmin !== undefined ? existingData.isAdmin : r.isAdmin,
                hasReservations: existingData.hasReservations !== undefined ? existingData.hasReservations : r.hasReservations,
                hasClinics: existingData.hasClinics !== undefined ? existingData.hasClinics : r.hasClinics,
                hasRoles: existingData.hasRoles !== undefined ? existingData.hasRoles : r.hasRoles,
                hasPermissions: existingData.hasPermissions !== undefined ? existingData.hasPermissions : r.hasPermissions
              });
            }
          }
          console.log("Database Migration: Completed successfully.");
        }
      } catch (e) {
        console.error("Failed to seed or migrate default roles:", e);
      }
    })();

    // 2. 최초 탭 클릭 시 대기 현상 방지를 위해 가입 회원 목록 즉시 선제 로드
    loadUsers();

    // 3. roles 실시간 감시는 동기적으로 즉시 시작하여 회원 목록 로드가 지연되지 않도록 함
    const q = query(rolesCol, orderBy("createdAt", "asc"));
    const roleList = document.getElementById("role-list");

    unsubscribeRoles = onSnapshot(q, (querySnapshot) => {
      rolesCache = {};
      if (roleList) roleList.innerHTML = "";

      // 동적 스위치 렌더링 헬퍼 함수
      const makeToggleHTML = (roleKey, fieldName, value, isDisabled) => {
        const isChecked = value === true ? "checked" : "";
        const isOptDisabled = isDisabled ? "disabled" : "";
        return `
          <label class="switch-container">
            <input type="checkbox" class="role-perm-toggle" 
              data-key="${roleKey}" data-field="${fieldName}" 
              ${isChecked} ${isOptDisabled}>
            <span class="switch-slider"></span>
          </label>
        `;
      };

      querySnapshot.forEach((docSnap) => {
        const roleKey = docSnap.id;
        const roleData = docSnap.data();
        rolesCache[roleKey] = roleData.label;

        if (roleList) {
          const tr = document.createElement("tr");
          const isSystem = roleData.isSystem === true;
          
          // 최고 관리자 super_admin의 핵심 권한(대시보드진입, 등급설정)은 해제되지 않도록 강제 락
          const lockAdmin = roleKey === "super_admin";
          
          const deleteBtn = isSystem 
            ? `<span style="color:var(--text-secondary); font-size:0.8rem;">시스템 등급</span>`
            : `<button class="btn-action delete btn-delete-role" data-key="${roleKey}">삭제</button>`;

          tr.innerHTML = `
            <td class="font-bold" style="color:#a5b4fc;">${roleKey}</td>
            <td id="role-label-text-${roleKey}">
              <span class="role-badge ${roleKey}">${roleData.label}</span>
            </td>
            <td>${makeToggleHTML(roleKey, "isAdmin", roleData.isAdmin, lockAdmin)}</td>
            <td>${makeToggleHTML(roleKey, "hasReservations", roleData.hasReservations, false)}</td>
            <td>${makeToggleHTML(roleKey, "hasClinics", roleData.hasClinics, false)}</td>
            <td>${makeToggleHTML(roleKey, "hasRoles", roleData.hasRoles, lockAdmin)}</td>
            <td>${makeToggleHTML(roleKey, "hasPermissions", roleData.hasPermissions, false)}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                <button class="btn-action confirm btn-edit-role" data-key="${roleKey}" data-label="${roleData.label.replace(/"/g, '&quot;')}">수정</button>
                ${deleteBtn}
              </div>
            </td>
          `;
          roleList.appendChild(tr);
        }
      });

      // 등급 종류가 최초 로드되거나 변경되면 가입 유저 테이블 실시간 갱신
      loadUsers();
    }, (error) => {
      console.error("Roles subscription error:", error);
      if (roleList) {
        roleList.innerHTML = `<tr><td colspan="8" class="table-error" style="color:#fda4af; text-align:center; padding:1.5rem; background:rgba(244,63,94,0.05); border-radius:8px;">등급 정보를 불러올 수 없습니다. (Firestore 보안 규칙 배포 확인 필요)</td></tr>`;
      }
    });
  }

  // 가입 회원 목록 로드 및 동적 옵션 바인딩
  async function loadUsers() {
    if (!userList) return;
    
    userList.innerHTML = `<tr><td colspan="5" class="table-loading">회원 데이터를 불러오는 중입니다...</td></tr>`;

    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);

      userList.innerHTML = "";

      if (querySnapshot.empty) {
        userList.innerHTML = `<tr><td colspan="5" class="table-empty">가입된 회원이 없습니다.</td></tr>`;
        return;
      }

      querySnapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        const userId = docSnap.id;
        const tr = document.createElement("tr");

        // 가입 날짜 포맷팅
        let registerDate = "-";
        if (userData.createdAt) {
          const dateObj = new Date(userData.createdAt);
          registerDate = isNaN(dateObj) ? "-" : dateObj.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "short",
            day: "numeric"
          });
        }

        // 캐시된 역할을 기반으로 라벨 매핑 및 동적 select 옵션 생성
        const currentRoleLabel = rolesCache[userData.role] || userData.role || "일반 회원";

        const isSuperAdmin = currentLoginUserRole === "super_admin";
        const isSelf = auth.currentUser && auth.currentUser.uid === userId;
        const isDisabled = (!isSuperAdmin || isSelf) ? "disabled" : "";

        // 동적으로 rolesCache 기준 select options 생성
        let selectOptionsHTML = "";
        let roleExistsInCache = false;

        Object.entries(rolesCache).forEach(([roleKey, roleLabel]) => {
          const isSelected = userData.role === roleKey ? "selected" : "";
          if (userData.role === roleKey) {
            roleExistsInCache = true;
          }
          selectOptionsHTML += `<option value="${roleKey}" ${isSelected}>${roleLabel}</option>`;
        });

        // 만약 기존 사용자가 가졌던 등급이 rolesCache에 등록되어 있지 않은 경우, 기존 등급 유실 방지를 위해 임시 옵션 추가
        if (userData.role && !roleExistsInCache) {
          selectOptionsHTML += `<option value="${userData.role}" selected>${userData.role} (미등록)</option>`;
        }

        // 변경 컨트롤 HTML
        const roleControlHTML = `
          <div class="role-control-wrapper">
            <select class="select-role" id="select-role-${userId}" ${isDisabled}>
              ${selectOptionsHTML}
            </select>
            <button class="btn-action confirm btn-update-role" data-uid="${userId}" ${isDisabled}>변경</button>
          </div>
        `;

        tr.innerHTML = `
          <td class="font-bold">${userData.name || "-"}</td>
          <td>${userData.email || "-"}</td>
          <td>${registerDate}</td>
          <td><span class="role-badge ${userData.role || 'user'}">${currentRoleLabel}</span></td>
          <td>${roleControlHTML}</td>
        `;

        userList.appendChild(tr);
      });

    } catch (error) {
      console.error("Load users failed:", error);
      userList.innerHTML = `<tr><td colspan="5" class="table-empty">회원 데이터를 로드하지 못했습니다. (권한 오류 등)</td></tr>`;
    }
  }

  // 회원 등급 변경 처리
  async function updateUserRole(targetUid, newRole) {
    if (currentLoginUserRole !== "super_admin") {
      alert("회원 등급 변경 권한이 없습니다. (최고 관리자 전용 기능)");
      return;
    }

    try {
      const userDocRef = doc(db, "users", targetUid);
      await updateDoc(userDocRef, {
        role: newRole
      });
      alert("회원 등급이 정상적으로 수정되었습니다.");
      loadUsers(); // 목록 새로고침
    } catch (error) {
      console.error("Update user role failed:", error);
      alert("등급 수정 중 오류가 발생했습니다. (권한 만료 또는 데이터 오류)");
    }
  }

  // 회원 목록 새로고침 버튼 이벤트
  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener("click", () => {
      loadUsers();
    });
  }

  // 신규 등급 등록 처리
  const roleRegisterForm = document.getElementById("role-register-form");
  if (roleRegisterForm) {
    roleRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      if (currentLoginUserRole !== "super_admin") {
        alert("등급 생성 권한이 없습니다. 최고 관리자 권한이 필요합니다.");
        return;
      }

      const roleKey = document.getElementById("reg-role-key").value.trim().toLowerCase();
      const roleLabel = document.getElementById("reg-role-label").value.trim();

      if (!roleKey || !roleLabel) {
        alert("등급 키와 표시이름은 필수 항목입니다.");
        return;
      }

      // 영문 소문자와 언더스코어만 허용 검사
      if (!/^[a-z0-9_]+$/.test(roleKey)) {
        alert("등급 키는 영문 소문자, 숫자, 언더바(_)만 사용 가능합니다.");
        return;
      }

      const btnSubmit = roleRegisterForm.querySelector("button[type='submit']");
      btnSubmit.disabled = true;
      btnSubmit.textContent = "추가 중...";

      try {
        await setDoc(doc(db, "roles", roleKey), {
          label: roleLabel,
          isSystem: false,
          createdAt: new Date().toISOString()
        });
        alert("새 회원 등급이 등록되었습니다.");
        roleRegisterForm.reset();
      } catch (error) {
        console.error("Register role failed:", error);
        alert("등급 등록에 실패했습니다: " + error.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "등급 추가하기";
      }
    });
  }

  // 등급 목록 테이블 내 이벤트 바인딩 (수정 및 삭제 처리)
  const roleListContainer = document.getElementById("role-list");
  if (roleListContainer) {
    roleListContainer.addEventListener("click", async (e) => {
      const roleKey = e.target.getAttribute("data-key");
      if (!roleKey) return;

      if (currentLoginUserRole !== "super_admin") {
        alert("등급 수정/삭제 권한이 없습니다.");
        return;
      }

      // ── 등급 수정 (세련된 다크 글래스모피즘 모달 적용) ──
      if (e.target.classList.contains("btn-edit-role")) {
        const curLabel = e.target.getAttribute("data-label");
        
        let editModal = document.getElementById("role-edit-modal");
        if (editModal) editModal.remove();

        editModal = document.createElement("div");
        editModal.id = "role-edit-modal";
        editModal.style.cssText = [
          "position:fixed", "inset:0", "z-index:9999",
          "background:rgba(0,0,0,0.75)", "display:flex",
          "align-items:center", "justify-content:center",
          "backdrop-filter:blur(6px)", "-webkit-backdrop-filter:blur(6px)"
        ].join(";");
        
        editModal.innerHTML = `
          <div style="background:#0c1020; border:1px solid rgba(99,102,241,0.25); border-radius:18px;
                      padding:2.2rem; width:min(420px,92vw); box-shadow:0 24px 80px rgba(0,0,0,0.75);
                      font-family:'Plus Jakarta Sans', 'Noto Sans KR', sans-serif;">
            <h3 style="margin:0 0 1.2rem; color:#a5b4fc; font-size:1.15rem; font-weight:700;">🏷️ 등급 표시이름 수정</h3>
            <p style="color:var(--text-secondary); font-size:0.85rem; margin-bottom:1.2rem;">
              등급 키 (ID): <strong style="color:#ffffff; font-family:monospace; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">${roleKey}</strong>
            </p>
            <label style="display:block; color:#c7d2fe; font-size:0.82rem; margin-bottom:6px; font-weight:600;">새로운 표시 이름 *</label>
            <input id="edit-role-label-input" type="text" value="${curLabel}"
              style="width:100%; padding:0.75rem 0.9rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.03); color:#e2e8f0; margin-bottom:1.6rem; box-sizing:border-box; font-size:0.95rem; outline:none; transition:all 0.3s;">
            <div style="display:flex; gap:10px; justify-content:flex-end;">
              <button id="btn-edit-role-cancel" class="btn btn-secondary" style="padding:0.55rem 1.4rem; font-size:0.85rem; border-radius:8px;">취소</button>
              <button id="btn-edit-role-save" class="btn btn-primary" style="padding:0.55rem 1.4rem; font-size:0.85rem; border-radius:8px; background:linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-purple) 100%); border:none; color:#fff;">저장하기</button>
            </div>
          </div>
        `;
        document.body.appendChild(editModal);

        // 입력창 오토 포커스 및 전체 선택
        const inputEl = document.getElementById("edit-role-label-input");
        if (inputEl) {
          inputEl.focus();
          inputEl.select();
        }

        // 취소 단추
        document.getElementById("btn-edit-role-cancel").addEventListener("click", () => {
          editModal.remove();
        });
        
        // 팝업 오버레이 바깥 클릭 시 자동 닫힘
        editModal.addEventListener("click", (ev) => {
          if (ev.target === editModal) editModal.remove();
        });

        // 저장 처리 바인딩
        document.getElementById("btn-edit-role-save").addEventListener("click", async () => {
          const newLabel = inputEl.value.trim();
          if (!newLabel) {
            alert("표시 이름은 필수입니다.");
            return;
          }

          const saveBtn = document.getElementById("btn-edit-role-save");
          saveBtn.disabled = true;
          saveBtn.textContent = "저장 중...";

          try {
            await updateDoc(doc(db, "roles", roleKey), {
              label: newLabel
            });
            alert("등급 표시이름이 수정되었습니다.");
            editModal.remove();
          } catch (err) {
            console.error("Edit role failed:", err);
            alert("수정 오류: " + err.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "저장하기";
          }
        });
      }

      // ── 등급 삭제 ──
      if (e.target.classList.contains("btn-delete-role")) {
        if (!confirm(`정말 [${roleKey}] 등급을 삭제하시겠습니까?\n이 등급을 가진 가입 회원들은 자동으로 '일반 회원(user)' 등급으로 변경됩니다.`)) {
          return;
        }

        e.target.disabled = true;
        e.target.textContent = "...";

        try {
          // 1. 해당 등급을 소유한 가입 회원 목록 로드 및 일괄 등급 강등 처리
          const usersCol = collection(db, "users");
          const q = query(usersCol);
          const usersSnap = await getDocs(q);

          let updatePromises = [];
          usersSnap.forEach((userSnap) => {
            const userData = userSnap.data();
            if (userData.role === roleKey) {
              updatePromises.push(updateDoc(doc(db, "users", userSnap.id), {
                role: "user"
              }));
            }
          });

          await Promise.all(updatePromises);
          
          // 2. 등급 삭제
          await deleteDoc(doc(db, "roles", roleKey));
          alert("등급이 정상적으로 삭제 처리되었습니다.");
        } catch (err) {
          console.error("Delete role failed:", err);
          alert("삭제 오류: " + err.message);
          e.target.disabled = false;
          e.target.textContent = "삭제";
        }
      }
    });

    // ── 등급별 세부 권한 토글 (체크박스 체인지 핸들러) ──
    roleListContainer.addEventListener("change", async (e) => {
      if (e.target.classList.contains("role-perm-toggle")) {
        if (currentLoginUserRole !== "super_admin") {
          alert("권한을 변경할 권한이 없습니다. (최고 관리자 전용 기능)");
          e.target.checked = !e.target.checked; // 롤백
          return;
        }

        const roleKey = e.target.getAttribute("data-key");
        const fieldName = e.target.getAttribute("data-field");
        const isChecked = e.target.checked;

        if (!roleKey || !fieldName) return;

        try {
          await updateDoc(doc(db, "roles", roleKey), {
            [fieldName]: isChecked
          });
          console.log(`Updated permissions for ${roleKey}: ${fieldName} -> ${isChecked}`);
        } catch (error) {
          console.error("Toggle permission update failed:", error);
          alert("권한 설정을 업데이트하지 못했습니다: " + error.message);
          e.target.checked = !isChecked; // 원래 상태로 롤백
        }
      }
    });
  }

  // 회원 테이블 이벤트 바인딩 (등급 변경 버튼 클릭 위임 처리)
  if (userList) {
    userList.addEventListener("click", async (e) => {
      if (e.target.classList.contains("btn-update-role")) {
        const targetUid = e.target.getAttribute("data-uid");
        const selectBox = document.getElementById(`select-role-${targetUid}`);
        if (selectBox) {
          const newRole = selectBox.value;
          if (confirm("해당 회원의 등급을 변경하시겠습니까?")) {
            const originalText = e.target.textContent;
            e.target.disabled = true;
            e.target.textContent = "처리중...";
            await updateUserRole(targetUid, newRole);
            e.target.disabled = false;
            e.target.textContent = originalText;
          }
        }
      }
    });
  }

  // --- 병원 관리 기능 추가 ---
  const seedClinics = [
    {
      name: "Khoa Da Liễu Gaon Seoul",
      englishName: "Gaon Seoul Dermatology",
      image: "/img/clinic_1_dermatology.png",
      depts: ["Thẩm mỹ da", "Laser nâng cơ", "Petit"],
      desc: "Cung cấp dịch vụ điều trị da liễu 1:1 cá nhân hóa chuyên sâu bởi các bác sĩ chuyên khoa da liễu giàu kinh nghiệm cùng hệ thống trang thiết bị Laser hiện đại nhất hiện nay.",
      address: "123 Teheran-ro, Gangnam-gu, Seoul"
    },
    {
      name: "Nha Khoa Teun Teun",
      englishName: "Teun Teun Dental",
      image: "/img/clinic_2_dental.png",
      depts: ["Implant", "Niềng răng", "Tổng quát"],
      desc: "Hướng tới điều trị an toàn, không đau đớn và ưu tiên hàng đầu việc bảo tồn tối đa răng tự nhiên cho khách hàng. Đội ngũ bác sĩ tận tâm với công nghệ chẩn đoán 3D tiên tiến.",
      address: "45 Dongmak-ro, Mapo-gu, Seoul"
    },
    {
      name: "Khoa Chỉnh Hình Barobon",
      englishName: "Barobon Orthopedics",
      image: "/img/clinic_3_ortho.png",
      depts: ["Cột sống & Khớp", "Trị liệu bằng tay", "Không phẫu thuật"],
      desc: "Cam kết chẩn đoán chính xác tuyệt đối 및 điều trị phục hồi chức năng chuyên sâu, bài bản theo phác đồ cá nhân bởi đội ngũ bác sĩ chỉnh hình chuyên khoa giàu kinh nghiệm.",
      address: "78 Seocho-daero, Seocho-gu, Seoul"
    },
    {
      name: "Y Học Cổ Truyền Kyunghee",
      englishName: "Kyunghee Oriental Medicine",
      image: "/img/clinic_4_oriental.png",
      depts: ["Châm cứu", "Thuốc thảo dược", "Trị liệu Chuna"],
      desc: "Sự kết hợp hoàn hảo giữa tinh hoa y học cổ truyền truyền thống và phương pháp chăm sóc sức khỏe hiện đại giúp cải thiện thể trạng toàn diện, an toàn 및 lành tính.",
      address: "26 Kyungheedae-ro, Dongdaemun-gu, Seoul"
    },
    {
      name: "Nhãn Khoa Bright World",
      englishName: "Bright World Eye Clinic",
      image: "/img/clinic_5_eye.png",
      depts: ["Mổ cận Lasik", "Đục thủy tinh thể", "Khô mắt"],
      desc: "Trang bị đầy đủ máy móc phẫu thuật nhãn khoa hiện đại nhất và quy trình kiểm tra chi tiết 50 bước nghiêm ngặt nhằm bảo vệ tối đa sức khỏe đôi mắt quý giá của bạn.",
      address: "50 Namdaemun-ro, Jung-gu, Seoul"
    },
    {
      name: "Khoa Nội Tổng Quát Ewha",
      englishName: "Ewha Internal Medicine",
      image: "/img/clinic_6_internal.png",
      depts: ["Nội soi dạ dày", "Bệnh mãn tính", "Tầm soát bệnh"],
      desc: "Trung tâm khám sức khỏe định kỳ khép kín, tiện nghi, sang trọng cùng đội ngũ bác sĩ chuyên khoa giàu kinh nghiệm giúp bạn tầm soát sớm mọi nguy cơ 및 bảo vệ sức khỏe trọn đời.",
      address: "11 Yeouidong-ro, Yeongdeungpo-gu, Seoul"
    }
  ];

  let unsubscribeClinics = null;

  async function loadClinics() {
    if (unsubscribeClinics) unsubscribeClinics();

    const q = query(collection(db, "clinics"), orderBy("createdAt", "asc"));
    const adminClinicList = document.getElementById("admin-clinic-list");
    if (!adminClinicList) return;

    adminClinicList.innerHTML = `<tr><td colspan="5" class="table-loading">데이터를 불러오는 중입니다...</td></tr>`;

    // 1회성 체크로 Seed 데이터 삽입 결정
    try {
      const snap = await getDocs(q);
      if (snap.empty) {
        adminClinicList.innerHTML = `<tr><td colspan="5" class="table-loading">기본 병원 데이터를 생성 중입니다...</td></tr>`;
        for (let i = 0; i < seedClinics.length; i++) {
          await addDoc(collection(db, "clinics"), {
            ...seedClinics[i],
            createdAt: new Date(Date.now() + i * 1000).toISOString()
          });
        }
        console.log("Seed clinics populated successfully.");
      }
    } catch (e) {
      console.error("Failed to seed clinics:", e);
    }

    // 실시간 리스닝
    unsubscribeClinics = onSnapshot(q, (querySnapshot) => {
      adminClinicList.innerHTML = "";

      if (querySnapshot.empty) {
        adminClinicList.innerHTML = `<tr><td colspan="5" class="table-empty">등록된 병원이 없습니다.</td></tr>`;
        return;
      }

      querySnapshot.forEach((docSnap) => {
        const docId = docSnap.id;
        const clinic = docSnap.data();
        const tr = document.createElement("tr");

        const deptsHTML = (clinic.depts || []).map(d => `<span class="dept-badge" style="margin-right: 4px; display: inline-block;">${d}</span>`).join("");

        tr.innerHTML = `
          <td>
            <img src="${clinic.image || ''}" alt="Clinic" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;" onerror="this.src='/img/clinic_1_dermatology.png'">
          </td>
          <td class="font-bold">${clinic.name || '-'} <br><small style="color:var(--text-secondary);">${clinic.englishName || '-'}</small></td>
          <td>${deptsHTML}</td>
          <td>${clinic.address || '-'}</td>
          <td style="vertical-align: middle; white-space: nowrap;">
            <!-- 수정 버튼: 해당 병원 정보를 불러와 수정 모달을 팝업 -->
            <button class="btn-action confirm btn-edit-clinic"
              data-id="${docId}"
              data-name="${(clinic.name || '').replace(/"/g, '&quot;')}"
              data-engname="${(clinic.englishName || '').replace(/"/g, '&quot;')}"
              data-desc="${(clinic.desc || '').replace(/"/g, '&quot;')}"
              data-address="${(clinic.address || '').replace(/"/g, '&quot;')}"
              data-depts="${(clinic.depts || []).join(',').replace(/"/g, '&quot;')}"
              style="margin-right: 6px;"
            >수정</button>
            <!-- 삭제 버튼 -->
            <button class="btn-action delete btn-delete-clinic" data-id="${docId}">삭제</button>
          </td>
        `;
        adminClinicList.appendChild(tr);
      });
    });
  }

  // --- 병원 관리 구글 지도 및 파일 업로드 헬퍼 로직 ---
  let uploadedImageBase64 = "";

  const inputImage = document.getElementById("reg-clinic-image");
  const imgPreviewContainer = document.getElementById("clinic-image-preview-container");
  const imgPreview = document.getElementById("clinic-image-preview");

  if (inputImage) {
    inputImage.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // 5MB 용량 제한
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert("이미지 용량은 최대 5MB를 초과할 수 없습니다. (Image file exceeds 5MB limit.)");
        inputImage.value = "";
        if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
        uploadedImageBase64 = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Canvas 리사이징 처리 (가로 최대 800px)
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // JPEG 압축 (75% 품질)
          uploadedImageBase64 = canvas.toDataURL("image/jpeg", 0.75);

          // 미리보기 표출
          if (imgPreview) imgPreview.src = uploadedImageBase64;
          if (imgPreviewContainer) imgPreviewContainer.style.display = "block";
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // 구글지도 주소 검색 및 미리보기
  const inputAddress = document.getElementById("reg-clinic-address");
  const btnSearchMaps = document.getElementById("btn-search-maps");
  const mapPreviewContainer = document.getElementById("clinic-map-preview-container");
  const mapPreviewIframe = document.getElementById("clinic-map-preview-iframe");

  if (btnSearchMaps) {
    btnSearchMaps.addEventListener("click", () => {
      window.open("https://www.google.com/maps", "_blank");
    });
  }

  let mapDebounceTimer = null;
  if (inputAddress) {
    inputAddress.addEventListener("input", (e) => {
      clearTimeout(mapDebounceTimer);
      const address = e.target.value.trim();

      mapDebounceTimer = setTimeout(() => {
        if (address.length >= 3) {
          const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
          if (mapPreviewIframe) mapPreviewIframe.src = mapUrl;
          if (mapPreviewContainer) mapPreviewContainer.style.display = "block";
        } else {
          if (mapPreviewContainer) mapPreviewContainer.style.display = "none";
          if (mapPreviewIframe) mapPreviewIframe.src = "";
        }
      }, 800);
    });
  }

  // 병원 등록 폼 서브밋 핸들러
  const clinicRegisterForm = document.getElementById("clinic-register-form");
  if (clinicRegisterForm) {
    clinicRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const name = document.getElementById("reg-clinic-name").value.trim();
      const englishName = document.getElementById("reg-clinic-eng-name").value.trim();
      const deptsRaw = document.getElementById("reg-clinic-depts").value.trim();
      const address = document.getElementById("reg-clinic-address").value.trim();
      const desc = document.getElementById("reg-clinic-desc").value.trim();

      if (!uploadedImageBase64) {
        alert("병원사진 파일을 선택해 주세요. 이미지 압축 처리 중일 수 있습니다.");
        return;
      }

      const depts = deptsRaw.split(",").map(d => d.trim()).filter(d => d.length > 0);

      const btnSubmit = clinicRegisterForm.querySelector("button[type='submit']");
      btnSubmit.disabled = true;
      btnSubmit.textContent = "등록 중...";

      try {
        await addDoc(collection(db, "clinics"), {
          name,
          englishName,
          image: uploadedImageBase64,
          depts,
          address,
          desc,
          createdAt: new Date().toISOString()
        });
        alert("신규 병원이 성공적으로 등록되었습니다.");
        
        // 폼 초기화 및 변수 정리
        clinicRegisterForm.reset();
        uploadedImageBase64 = "";
        if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
        if (mapPreviewContainer) {
          mapPreviewContainer.style.display = "none";
          if (mapPreviewIframe) mapPreviewIframe.src = "";
        }
      } catch (error) {
        console.error("Register clinic failed:", error);
        alert("병원 등록에 실패했습니다: " + error.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "병원 등록하기";
      }
    });
  }

  // =========================================================================
  // 병원 수정/삭제 버튼 클릭 핸들러 (이벤트 위임 방식)
  // =========================================================================
  const adminClinicList = document.getElementById("admin-clinic-list");
  if (adminClinicList) {
    adminClinicList.addEventListener("click", async (e) => {

      // ── 수정 버튼 처리 ──
      if (e.target.classList.contains("btn-edit-clinic")) {
        const btn = e.target;
        const docId       = btn.getAttribute("data-id");
        const curName     = btn.getAttribute("data-name");
        const curEngName  = btn.getAttribute("data-engname");
        const curDesc     = btn.getAttribute("data-desc");
        const curAddress  = btn.getAttribute("data-address");
        const curDepts    = btn.getAttribute("data-depts");

        // 인라인 수정 모달 동적 생성 (기존 모달 재사용 방지를 위해 매번 새로 생성)
        let editModal = document.getElementById("clinic-edit-modal");
        if (editModal) editModal.remove();

        editModal = document.createElement("div");
        editModal.id = "clinic-edit-modal";
        editModal.style.cssText = [
          "position:fixed", "inset:0", "z-index:9999",
          "background:rgba(0,0,0,0.7)", "display:flex",
          "align-items:center", "justify-content:center"
        ].join(";");
        editModal.innerHTML = `
          <div style="background:#1e1b4b; border:1px solid rgba(165,180,252,0.25); border-radius:16px;
                      padding:2rem; width:min(520px,92vw); max-height:90vh; overflow-y:auto;
                      box-shadow:0 24px 80px rgba(0,0,0,0.6);">
            <h3 style="margin:0 0 1.4rem; color:#a5b4fc; font-size:1.15rem;">✏️ 병원 정보 수정</h3>
            <!-- 병원명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">병원명 *</label>
            <input id="edit-clinic-name" type="text" value="${curName}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 영문 식별명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">영문 식별명 (English Name) *</label>
            <input id="edit-clinic-engname" type="text" value="${curEngName}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 진료과목 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">진료과목 (쉼표로 구분)</label>
            <input id="edit-clinic-depts" type="text" value="${curDepts}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 주소 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">주소 *</label>
            <input id="edit-clinic-address" type="text" value="${curAddress}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 병원 설명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">병원 설명</label>
            <textarea id="edit-clinic-desc" rows="4"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1.4rem; box-sizing:border-box; resize:vertical;">${curDesc}</textarea>
            <!-- 버튼 영역 -->
            <div style="display:flex; gap:10px; justify-content:flex-end;">
              <button id="btn-edit-clinic-cancel" class="btn btn-secondary"
                style="padding:0.55rem 1.4rem; font-size:0.9rem;">취소</button>
              <button id="btn-edit-clinic-save" class="btn btn-primary"
                style="padding:0.55rem 1.4rem; font-size:0.9rem;"
                data-id="${docId}">저장하기</button>
            </div>
          </div>
        `;
        document.body.appendChild(editModal);

        // 취소 버튼
        document.getElementById("btn-edit-clinic-cancel").addEventListener("click", () => {
          editModal.remove();
        });
        // 모달 바깥 클릭 시 닫기
        editModal.addEventListener("click", (ev) => {
          if (ev.target === editModal) editModal.remove();
        });

        // 저장 버튼 - Firestore 업데이트
        document.getElementById("btn-edit-clinic-save").addEventListener("click", async () => {
          const newName    = document.getElementById("edit-clinic-name").value.trim();
          const newEngName = document.getElementById("edit-clinic-engname").value.trim();
          const newDepts   = document.getElementById("edit-clinic-depts").value.trim()
                              .split(",").map(d => d.trim()).filter(d => d.length > 0);
          const newAddress = document.getElementById("edit-clinic-address").value.trim();
          const newDesc    = document.getElementById("edit-clinic-desc").value.trim();

          if (!newName || !newEngName || !newAddress) {
            alert("병원명, 영문 식별명, 주소는 필수 항목입니다.");
            return;
          }

          const saveBtn = document.getElementById("btn-edit-clinic-save");
          saveBtn.disabled = true;
          saveBtn.textContent = "저장 중...";

          try {
            // Firestore 문서 업데이트
            await updateDoc(doc(db, "clinics", docId), {
              name: newName,
              englishName: newEngName,
              depts: newDepts,
              address: newAddress,
              desc: newDesc
            });
            alert("병원 정보가 성공적으로 수정되었습니다.");
            editModal.remove();
          } catch (error) {
            console.error("Update clinic failed:", error);
            alert("수정 중 오류가 발생했습니다: " + error.message);
            saveBtn.disabled = false;
            saveBtn.textContent = "저장하기";
          }
        });
      }

      // ── 삭제 버튼 처리 ──
      if (e.target.classList.contains("btn-delete-clinic")) {
        const docId = e.target.getAttribute("data-id");
        if (confirm("정말 이 병원을 삭제하시겠습니까? 관련 데이터 및 정보가 더 이상 대시보드와 예약 화면에 표시되지 않습니다.")) {
          try {
            e.target.disabled = true;
            e.target.textContent = "...";
            await deleteDoc(doc(db, "clinics", docId));
            alert("병원이 삭제되었습니다.");
          } catch (error) {
            console.error("Delete clinic failed:", error);
            alert("병원 삭제 중 오류가 발생했습니다: " + error.message);
            e.target.disabled = false;
            e.target.textContent = "삭제";
          }
        }
      }
    });
  }
});
// Build cache bust: 2026-06-27T16:30:00
