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
  addDoc
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

      // 신원 정보 라벨
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

      tr.innerHTML = `
        <td class="col-lang"><span class="lang-badge">${displayLang}</span></td>
        <td class="col-name font-bold">${data.name || "-"}</td>
        <td class="col-clinic"><span class="table-clinic-name">${data.clinic || "-"}</span></td>
        <td class="col-gender">${data.gender || "-"}</td>
        <td class="col-dob">${data.dob || "-"}</td>
        <td class="col-id">${idInfoHTML}</td>
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

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        const allowedRoles = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"];
        if (allowedRoles.includes(userData.role)) {
          console.log(`Access granted for role: ${userData.role}`);
          currentLoginUserRole = userData.role; // 등급 캐싱
          
          // 최고 관리자(super_admin)인 경우에만 회원 등급 관리 탭 노출
          const tabUsers = document.getElementById("tab-users");
          if (tabUsers) {
            if (currentLoginUserRole === "super_admin") {
              tabUsers.style.display = "inline-block";
            } else {
              tabUsers.style.display = "none";
            }
          }
          
          // 최고 관리자(super_admin)인 경우에만 '병원 관리' 탭 노출
          const tabClinics = document.getElementById("tab-clinics");
          if (tabClinics) {
            if (currentLoginUserRole === "super_admin") {
              tabClinics.style.display = "inline-block";
            } else {
              tabClinics.style.display = "none";
            }
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

  if (tabReservations && tabUsers && tabClinics) {
    tabReservations.addEventListener("click", () => {
      tabReservations.classList.add("active");
      tabUsers.classList.remove("active");
      tabClinics.classList.remove("active");
      contentReservations.style.display = "block";
      contentUsers.style.display = "none";
      contentClinics.style.display = "none";
    });

    tabUsers.addEventListener("click", () => {
      tabUsers.classList.add("active");
      tabReservations.classList.remove("active");
      tabClinics.classList.remove("active");
      contentReservations.style.display = "none";
      contentUsers.style.display = "block";
      contentClinics.style.display = "none";
      loadUsers(); // 회원 목록 불러오기
    });

    tabClinics.addEventListener("click", () => {
      tabClinics.classList.add("active");
      tabReservations.classList.remove("active");
      tabUsers.classList.remove("active");
      contentReservations.style.display = "none";
      contentUsers.style.display = "none";
      contentClinics.style.display = "block";
      loadClinics(); // 병원 목록 불러오기
    });
  }

  // 회원 목록 데이터 가져오기 및 렌더링
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

        // 등급 표시 한글 라벨 매핑 및 뱃지 클래스
        const roleLabels = {
          "super_admin": "최고 관리자",
          "admin": "일반 관리자",
          "partner": "제휴 병원",
          "vip": "VIP 회원",
          "user": "일반 회원",
          "admin_user": "관리자",
          "top_manager": "최고 매니저",
          "res_manager": "예약 매니저",
          "general": "일반"
        };
        const currentRoleLabel = roleLabels[userData.role] || userData.role || "일반";

        // 최고 관리자(super_admin)만 등급 수정 폼 활성화, 본인 계정은 변경 불가 처리
        const isSuperAdmin = currentLoginUserRole === "super_admin";
        const isSelf = auth.currentUser && auth.currentUser.uid === userId;
        const isDisabled = (!isSuperAdmin || isSelf) ? "disabled" : "";

        // 변경 컨트롤 HTML
        const roleControlHTML = `
          <div class="role-control-wrapper">
            <select class="select-role" id="select-role-${userId}" ${isDisabled}>
              <option value="user" ${userData.role === 'user' ? 'selected' : ''}>일반 회원</option>
              <option value="general" ${userData.role === 'general' ? 'selected' : ''}>일반</option>
              <option value="vip" ${userData.role === 'vip' ? 'selected' : ''}>VIP 회원</option>
              <option value="partner" ${userData.role === 'partner' ? 'selected' : ''}>제휴 병원</option>
              <option value="res_manager" ${userData.role === 'res_manager' ? 'selected' : ''}>예약 매니저</option>
              <option value="top_manager" ${userData.role === 'top_manager' ? 'selected' : ''}>최고 매니저</option>
              <option value="admin" ${userData.role === 'admin' ? 'selected' : ''}>일반 관리자</option>
              <option value="admin_user" ${userData.role === 'admin_user' ? 'selected' : ''}>관리자</option>
              <option value="super_admin" ${userData.role === 'super_admin' ? 'selected' : ''}>최고 관리자</option>
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

  // 회원 등급 업데이트
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

  // 회원 테이블 이벤트 바인딩 (위임 처리)
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

  // 회원 새로고침 버튼 이벤트
  if (btnRefreshUsers) {
    btnRefreshUsers.addEventListener("click", () => {
      loadUsers();
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
          <td>
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

  // 병원 삭제 버튼 클릭 핸들러
  const adminClinicList = document.getElementById("admin-clinic-list");
  if (adminClinicList) {
    adminClinicList.addEventListener("click", async (e) => {
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
