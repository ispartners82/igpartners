import { auth, db } from "/js/firebase-db.js?v=2.0.7";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  // 1. DOM 요소 취득
  const filterLang = document.getElementById("filter-lang");
  const filterClinic = document.getElementById("filter-clinic"); // 신설: 선택 병원 필터
  const filterGender = document.getElementById("filter-gender");
  
  const filterExpiryStart = document.getElementById("filter-expiry-start");
  const filterExpiryEnd = document.getElementById("filter-expiry-end");
  
  const filterRegStart = document.getElementById("filter-reg-start");
  const filterRegEnd = document.getElementById("filter-reg-end");
  
  const filterHopeStart = document.getElementById("filter-hope-start");
  const filterHopeEnd = document.getElementById("filter-hope-end");
  
  const btnStatsQuery = document.getElementById("btn-stats-query");
  const btnStatsReset = document.getElementById("btn-stats-reset");
  const btnStatsPrint = document.getElementById("btn-stats-print");
  const btnStatsExcel = document.getElementById("btn-stats-excel"); // 신설: 엑셀 다운로드 버튼
  
  const btnQuickWeek = document.getElementById("btn-quick-week");
  const btnQuickMonth = document.getElementById("btn-quick-month");
  const btnQuickYear = document.getElementById("btn-quick-year");
  const btnQuickResetDate = document.getElementById("btn-quick-reset-date");

  const statsTotalCount = document.getElementById("stats-total-count");
  const statsPendingCount = document.getElementById("stats-pending-count");
  const statsConfirmedCount = document.getElementById("stats-confirmed-count");
  const statsCancelledCount = document.getElementById("stats-cancelled-count");

  const statsResultList = document.getElementById("stats-result-list");

  // 2. 글로벌 상태 변수
  let allReservations = []; // 전체 실시간 예약 내역
  let currentFilteredReservations = []; // 필터링 완료된 목록 (엑셀 추출용)
  let unsubscribe = null;
  let currentUser = null;

  // 한글 주석: 등록된 병원 목록을 Firestore에서 로드하여 셀렉트박스 옵션 빌드
  async function loadClinicsFilter() {
    if (!filterClinic) return;
    try {
      const querySnapshot = await getDocs(collection(db, "clinics"));
      let optionsHTML = `<option value="all">전체보기</option>`;
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.name) {
          optionsHTML += `<option value="${data.name}">${data.name}</option>`;
        }
      });
      filterClinic.innerHTML = optionsHTML;
    } catch (e) {
      console.error("Failed to load clinics for filter:", e);
      filterClinic.innerHTML = `<option value="all">전체보기 (로드 실패)</option>`;
    }
  }

  // =========================================================================
  // 3. 권한 및 세션 검증
  // =========================================================================
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("로그인이 필요합니다. 관리자 계정으로 로그인해 주세요.");
      window.location.href = "/index.html";
      return;
    }
    
    currentUser = user;
    try {
      // 역할 확인
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const role = userDocSnap.data().role || "user";
        
        // [한글 주석: 등급 권한 관리에서 설정한 예약통계 권한 실시간 체크]
        let hasStats = false;
        try {
          const roleDocRef = doc(db, "roles", role);
          const roleDocSnap = await getDoc(roleDocRef);
          if (roleDocSnap.exists()) {
            hasStats = roleDocSnap.data().hasStats !== undefined ? roleDocSnap.data().hasStats : ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(role);
          } else {
            hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(role);
          }
        } catch (e) {
          console.error("사용자 등급별 통계 권한 확인 실패:", e);
          hasStats = ["super_admin", "admin", "admin_user", "top_manager", "res_manager"].includes(role);
        }

        if (!hasStats) {
          alert("예약 통계 페이지에 접근할 권한이 없습니다.");
          window.location.href = "/index.html";
          return;
        }
        
        // 정상 권한 확인 시 실시간 데이터 구독 시작
        startRealtimeSubscription();
      } else {
        alert("사용자 정보를 찾을 수 없습니다.");
        window.location.href = "/index.html";
      }
    } catch (e) {
      console.error("인증 권한 검사 오류:", e);
      window.location.href = "/index.html";
    }
  });

  // =========================================================================
  // 4. 데이터 실시간 수신 및 캐싱
  // =========================================================================
  function startRealtimeSubscription() {
    if (unsubscribe) unsubscribe();

    // [한글 주석: 병원 필터 드롭다운 옵션 로드]
    loadClinicsFilter();

    // 넉넉하게 최근 500개 예약을 가져옵니다. (통계 목적)
    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"), limit(500));
    
    statsResultList.innerHTML = `<tr><td colspan="14" class="table-loading">실시간 데이터를 동기화하는 중입니다...</td></tr>`;

    // 로컬스토리지 백업 데이터 선 로딩
    try {
      const localData = localStorage.getItem("local_reservations");
      if (localData) {
        allReservations = JSON.parse(localData);
        // 초기 로드 시 전체 내역으로 렌더링
        applyFiltersAndRender(allReservations);
      }
    } catch (e) {
      console.warn("Local cache read failed:", e);
    }

    unsubscribe = onSnapshot(q, (snapshot) => {
      const serverItems = [];
      snapshot.forEach(docSnap => {
        let dateStr = new Date().toISOString();
        const data = docSnap.data();
        if (data.createdAt) {
          dateStr = typeof data.createdAt.toDate === "function"
            ? data.createdAt.toDate().toISOString()
            : new Date(data.createdAt).toISOString();
        }
        serverItems.push({
          id: docSnap.id,
          ...data,
          createdAt: dateStr
        });
      });

      allReservations = serverItems;
      // 로컬 스토리지에 캐시 동기화
      try {
        localStorage.setItem("local_reservations", JSON.stringify(serverItems));
      } catch (e) {}

      // 기본 상태로 필터 적용 및 렌더링
      applyFiltersAndRender(allReservations);
    }, (error) => {
      console.error("Firestore loading error:", error);
      // 오프라인/에러 시 기존 로컬 캐시로 계속 진행
      applyFiltersAndRender(allReservations);
    });
  }

  // =========================================================================
  // 5. 다각도 복합 필터링 로직 및 통계 산출
  // =========================================================================
  function applyFiltersAndRender(items) {
    if (!items || items.length === 0) {
      statsResultList.innerHTML = `<tr><td colspan="14" class="table-empty">조회할 데이터가 존재하지 않습니다.</td></tr>`;
      updateStatsCounters(0, 0, 0, 0);
      currentFilteredReservations = [];
      return;
    }

    const langVal = filterLang.value;
    const clinicVal = filterClinic ? filterClinic.value : "all"; // 신설: 병원 필터 선택값
    const genderVal = filterGender.value;
    
    const expStartVal = filterExpiryStart.value;
    const expEndVal = filterExpiryEnd.value;
    
    const regStartVal = filterRegStart.value;
    const regEndVal = filterRegEnd.value;
    
    const hopeStartVal = filterHopeStart.value;
    const hopeEndVal = filterHopeEnd.value;

    // 필터 연산 수행
    const filtered = items.filter(item => {
      // A. 선택 언어 필터
      if (langVal !== "all" && item.lang !== langVal) return false;

      // [한글 주석: 선택 병원 필터 적용]
      if (clinicVal !== "all" && item.clinic !== clinicVal) return false;

      // B. 성별 필터
      if (genderVal !== "all") {
        if (!item.gender || item.gender.trim() !== genderVal) return false;
      }

      // C. 체류만료일 기간 필터 (YYYY-MM-DD 포맷 가정)
      if (expStartVal || expEndVal) {
        if (!item.visaExpiry) return false;
        const itemDate = new Date(item.visaExpiry);
        if (isNaN(itemDate.getTime())) return false;

        if (expStartVal && itemDate < new Date(expStartVal)) return false;
        if (expEndVal && itemDate > new Date(expEndVal)) return false;
      }

      // D. 예약시간(접수일) 기간 필터
      if (regStartVal || regEndVal) {
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt);
        if (isNaN(itemDate.getTime())) return false;

        if (regStartVal && itemDate < new Date(regStartVal + "T00:00:00")) return false;
        if (regEndVal && itemDate > new Date(regEndVal + "T23:59:59")) return false;
      }

      // E. 희망진료일 기간 필터 (YYYY-MM-DD 포맷 가정)
      if (hopeStartVal || hopeEndVal) {
        if (!item.reservationDate) return false;
        const itemDate = new Date(item.reservationDate);
        if (isNaN(itemDate.getTime())) return false;

        if (hopeStartVal && itemDate < new Date(hopeStartVal)) return false;
        if (hopeEndVal && itemDate > new Date(hopeEndVal)) return false;
      }

      return true;
    });

    // 화면 렌더링
    renderTable(filtered);
  }

  // =========================================================================
  // 6. 통계 건수 카드 갱신
  // =========================================================================
  function updateStatsCounters(total, pending, confirmed, cancelled) {
    if (statsTotalCount) statsTotalCount.textContent = total;
    if (statsPendingCount) statsPendingCount.textContent = pending;
    if (statsConfirmedCount) statsConfirmedCount.textContent = confirmed;
    if (statsCancelledCount) statsCancelledCount.textContent = cancelled;
  }

  // =========================================================================
  // 7. 테이블 및 통계 화면 렌더링
  // =========================================================================
  function renderTable(items) {
    // [한글 주석: 엑셀 파일 다운로드 추출용으로 현재 필터링된 배열 데이터 동기화]
    currentFilteredReservations = items;
    statsResultList.innerHTML = "";

    let total = 0;
    let pending = 0;
    let confirmed = 0;
    let cancelled = 0;

    if (items.length === 0) {
      statsResultList.innerHTML = `<tr><td colspan="14" class="table-empty">조회 조건에 만족하는 예약 내역이 없습니다.</td></tr>`;
      updateStatsCounters(0, 0, 0, 0);
      return;
    }

    const langLabels = {
      "ko": "🇰🇷 한국어", "ja": "🇯🇵 일본어", "vi": "🇻🇳 베트남어", "en": "🇺🇸 영어",
      "zh": "🇨🇳 중국어", "ru": "🇷🇺 러시아어", "my": "🇲🇲 미얀마어", "km": "🇰🇭 캄보디아어",
      "mn": "🇲🇳 몽골어", "th": "🇹🇭 태국어", "lo": "🇱🇦 라오스어", "ne": "🇳🇵 네팔어",
      "id": "🇮🇩 인도네시아어", "si": "🇱🇰 스리랑카어", "bn": "🇧🇩 방글라데시어"
    };

    items.forEach(data => {
      total++;
      if (data.status === "confirmed") confirmed++;
      else if (data.status === "cancelled") cancelled++;
      else pending++;

      const tr = document.createElement("tr");
      tr.className = `status-${data.status || "pending"}`;

      let regDateStr = "-";
      if (data.createdAt) {
        const jsDate = new Date(data.createdAt);
        regDateStr = isNaN(jsDate.getTime()) ? "-" : jsDate.toLocaleDateString("ko-KR", {
          year: "numeric", month: "2-digit", day: "2-digit"
        }) + " " + jsDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      }

      const displayLang = langLabels[data.lang] || (data.lang ? `🌐 ${data.lang}` : "-");

      const idInfo = [];
      if (data.alienNo) idInfo.push(`외국인: ${data.alienNo}`);
      if (data.passportNo) idInfo.push(`여권: ${data.passportNo}`);
      const idInfoText = idInfo.length > 0 ? idInfo.join("<br>") : "-";

      let statusBadgeText = "대기중";
      let statusBadgeClass = "badge-pending";
      if (data.status === "confirmed") {
        statusBadgeText = "예약 확정";
        statusBadgeClass = "badge-confirmed";
      } else if (data.status === "cancelled") {
        statusBadgeText = "예약 취소";
        statusBadgeClass = "badge-cancelled";
      }

      tr.innerHTML = `
        <td class="col-lang"><span class="lang-badge">${displayLang}</span></td>
        <td class="col-name font-bold">${data.name || "-"}</td>
        <td class="col-clinic"><span class="table-clinic-name">${data.clinic || "-"}</span></td>
        <td class="col-gender">${data.gender || "-"}</td>
        <td class="col-visa-type font-bold" style="color: #34d399;">${data.visaType || "-"}</td>
        <td class="col-dob">${data.dob || "-"}</td>
        <td class="col-id" style="font-size:0.8rem; line-height:1.2;">${idInfoText}</td>
        <td class="col-visa-expiry text-accent">${data.visaExpiry || "-"}</td>
        <td class="col-phone">${data.phone || "-"}</td>
        <td class="col-date">${regDateStr}</td>
        <td class="col-res-date font-bold text-accent">${data.reservationDate || "-"}</td>
        <td class="col-address" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${data.address || ""}">${data.address || "-"}</td>
        <td class="col-symptoms" style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${data.symptoms || ""}">${data.symptoms || "-"}</td>
        <td class="col-status"><span class="badge ${statusBadgeClass}">${statusBadgeText}</span></td>
      `;

      statsResultList.appendChild(tr);
    });

    updateStatsCounters(total, pending, confirmed, cancelled);
  }

  // =========================================================================
  // 8. 캘린더 퀵 설정 로직
  // =========================================================================
  function setQuickRegRange(days) {
    const today = new Date();
    const targetDate = new Date();
    targetDate.setDate(today.getDate() - days);

    // 날짜 값 포맷팅 (YYYY-MM-DD)
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    filterRegStart.value = formatDate(targetDate);
    filterRegEnd.value = formatDate(today);
  }

  if (btnQuickWeek) {
    btnQuickWeek.addEventListener("click", () => setQuickRegRange(7));
  }
  if (btnQuickMonth) {
    btnQuickMonth.addEventListener("click", () => setQuickRegRange(30));
  }
  if (btnQuickYear) {
    btnQuickYear.addEventListener("click", () => setQuickRegRange(365));
  }
  if (btnQuickResetDate) {
    btnQuickResetDate.addEventListener("click", () => {
      filterRegStart.value = "";
      filterRegEnd.value = "";
    });
  }

  // =========================================================================
  // 9. 조회 및 초기화 제어 리스너
  // =========================================================================
  if (btnStatsQuery) {
    btnStatsQuery.addEventListener("click", () => {
      applyFiltersAndRender(allReservations);
    });
  }

  if (btnStatsReset) {
    btnStatsReset.addEventListener("click", () => {
      filterLang.value = "all";
      if (filterClinic) filterClinic.value = "all";
      filterGender.value = "all";
      filterExpiryStart.value = "";
      filterExpiryEnd.value = "";
      filterRegStart.value = "";
      filterRegEnd.value = "";
      filterHopeStart.value = "";
      filterHopeEnd.value = "";
      applyFiltersAndRender(allReservations);
    });
  }

  // 프린트 기능 지원
  if (btnStatsPrint) {
    btnStatsPrint.addEventListener("click", () => {
      window.print();
    });
  }

  // [한글 주석: 필터된 리스트 대상 CSV 기반 엑셀 다운로드 기능 구현]
  function downloadExcel() {
    if (!currentFilteredReservations || currentFilteredReservations.length === 0) {
      alert("다운로드할 데이터가 없습니다. 먼저 조회 조건 필터를 이용해 예약 내역을 조회해 주세요.");
      return;
    }

    let csvContent = "\uFEFF"; // 한글 깨짐 방지용 UTF-8 BOM 선언
    
    // [한글 주석: 가장 상단에 총 조회 건수 텍스트 추가]
    csvContent += `"총 조회 건수","${currentFilteredReservations.length}건"\n\n`;
    
    // CSV 헤더 정의
    csvContent += "선택언어,이름,선택병원,성별,비자타입,생년월일,체류만료일,연락처,접수시간,희망진료일,주소,증상,상태\n";

    const langLabels = {
      "ko": "한국어", "ja": "일본어", "vi": "베트남어", "en": "영어",
      "zh": "중국어", "ru": "러시아어", "my": "미얀마어", "km": "캄보디아어",
      "mn": "몽골어", "th": "태국어", "lo": "라오스어", "ne": "네팔어",
      "id": "인도네시아어", "si": "스리랑카어", "bn": "방글라데시어"
    };

    currentFilteredReservations.forEach(item => {
      const lang = langLabels[item.lang] || item.lang || "";
      const name = item.name || "";
      const clinic = item.clinic || "";
      const gender = item.gender || "";
      const visaType = item.visaType || "";
      const dob = item.dob || "";
      const visaExpiry = item.visaExpiry || "";
      const phone = item.phone || "";
      
      let regDateStr = "";
      if (item.createdAt) {
        const jsDate = new Date(item.createdAt);
        regDateStr = isNaN(jsDate.getTime()) ? "" : jsDate.toLocaleDateString("ko-KR", {
          year: "numeric", month: "2-digit", day: "2-digit"
        }) + " " + jsDate.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
      }

      const hopeDate = item.reservationDate || "";
      const address = (item.address || "").replace(/"/g, '""'); // 쌍따옴표 치환
      const symptoms = (item.symptoms || "").replace(/"/g, '""');

      let statusText = "대기중";
      if (item.status === "confirmed") statusText = "예약 확정";
      else if (item.status === "cancelled") statusText = "예약 취소";

      // 쉼표 구분을 위한 쌍따옴표 래핑 레코드 추가
      csvContent += `"${lang}","${name}","${clinic}","${gender}","${visaType}","${dob}","${visaExpiry}","${phone}","${regDateStr}","${hopeDate}","${address}","${symptoms}","${statusText}"\n`;
    });

    // Blob 생성 및 다운로드 발생
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    link.setAttribute("href", url);
    link.setAttribute("download", `IGPartners_예약목록_${todayStr}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (btnStatsExcel) {
    btnStatsExcel.addEventListener("click", downloadExcel);
  }
});
