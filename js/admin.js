import { db, auth } from "./firebase-db.js?v=261116_1";
// 15개국어 및 권한 공통 기준 데이터 모듈 임포트
import {
  LANG_LIST,
  LANG_LABELS,
  SUPPORTED_COUNTRY_LANGS,
  LANG_STYLE_MAP,
  normalizeUserLangKey,
  DEFAULT_AVAILABLE_ROLES,
  buildRolePermissions
} from "./lang-config.js?v=261116_1";
// 공통 보안 이스케이프, 이미지 압축, 페이지네이션, 드래그 정렬, 솔라피 헤더 모듈 임포트
import {
  escapeHtml,
  sanitizeUrl,
  compressImageFile,
  formatFirestoreDate,
  renderPaginationControls,
  initTableDragReorder,
  createSolapiAuthHeader
} from "./common-utils.js?v=261116_1";
// 비어 있는 8개국어(ja, zh, th, lo, ne, id, si, bn) 병원 번역 보강 헬퍼 모듈 임포트
import { enrichClinicWithMissing8Langs } from "./clinic-translations-8langs.js?v=261116_1";
import { 
  collection, 
  query, 
  where,
  orderBy, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  setDoc,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Cloudflare Workers 등 외부 프록시 URL이 설정되면 브라우저 시크릿 노출 없이 프록시 경유 발송
const SOLAPI_PROXY_URL = "";
// 솔라피(Solapi) 직접 연동용 fallback 설정 상수 (프록시 미설정 시 기존 발송 기능 유지)
const SOLAPI_API_KEY = "NCS6QTA1RKWBG0P5";
const SOLAPI_API_SECRET = "YO0S9SMY2XTAKI3ZRH93X7FB4UC0BIGS";
const SOLAPI_SENDER_NUMBER = "01048444115"; // 업무폰 발신번호 (고객 문자 회신 수신용)

// 예약 확정 및 취소 시 환자 연락처로 솔라피 LMS 장문 문자 발송 함수
const sendCustomerStatusLms = async (resData, statusType) => {
  if (!resData || !resData.phone) {
    console.warn("환자 연락처가 없어 알림 문자를 발송하지 못했습니다.");
    return { status: "fail", error: "환자 연락처 없음" };
  }

  const cleanPhone = String(resData.phone).replace(/[^0-9]/g, "");
  if (!cleanPhone || cleanPhone.length < 9) {
    console.warn("유효하지 않은 환자 연락처:", resData.phone);
    return { status: "fail", error: "유효하지 않은 연락처" };
  }

  const patientName = resData.name || "고객";
  const clinicName = resData.clinic || "-";
  const reservationDate = resData.reservationDate || "-";
  const reservationTime = resData.reservationTime || "-";

  let subject = "";
  let messageText = "";

  if (statusType === "confirmed") {
    subject = "[IGPartners 병원 진료 예약 확정 안내]";
    messageText = `[IGPartners 병원 진료 예약 확정 안내]

안녕하세요, ${patientName}님.
IGPartners를 통해 신청하신 병원 진료 예약이 정상적으로 확정되었습니다.

■ 예약 상세 정보
• 환자 성명: ${patientName}
• 진료 병원: ${clinicName}
• 예약 일시: ${reservationDate} ${reservationTime}

■ 내원 안내 사항
• 원활한 진료 접수를 위해 예약 시간 10분 전까지 병원에 내원해 주시기 바랍니다.
• 본인 확인을 위한 신분증(외국인등록증 또는 여권)을 반드시 지참해 주시기 바랍니다.

■ IGPartners 카톡
http://pf.kakao.com/_YxoxjfX/chat`;
  } else if (statusType === "cancelled") {
    subject = "[IGPartners 병원 진료 예약 취소 안내]";
    messageText = `[IGPartners 병원 진료 예약 취소 안내]

안녕하세요, ${patientName}님.
신청하신 병원 진료 예약이 아래와 같이 취소 처리되었습니다.

■ 예약 취소 정보
• 환자 성명: ${patientName}
• 진료 병원: ${clinicName}
• 예약 일시: ${reservationDate} ${reservationTime}
• 처리 상태: 예약 취소 완료

■ 안내 사항
• 진료 일정 재조정이나 신규 예약을 원하실 경우 재예약 부탁드립니다.

■ IGPartners 카톡
http://pf.kakao.com/_YxoxjfX/chat`;
  } else {
    return { status: "ignored" };
  }

  try {
    // 발신번호 결정: DB 설정에 등록된 발신번호가 있으면 우선 사용, 없으면 업무폰 번호(01048444115) 사용
    let senderNumber = SOLAPI_SENDER_NUMBER;
    try {
      const solapiDocRef = doc(db, "settings", "solapi");
      const solapiDocSnap = await getDoc(solapiDocRef);
      if (solapiDocSnap.exists() && solapiDocSnap.data().senderNumber) {
        senderNumber = String(solapiDocSnap.data().senderNumber).replace(/[^0-9]/g, "");
      }
    } catch (e) {
      console.warn("DB 발신번호 설정 조회 실패, 기본 업무폰 번호 사용:", e);
    }

    const requestBody = {
      message: {
        to: cleanPhone,
        from: senderNumber,
        type: "LMS",
        subject: subject,
        text: messageText
      }
    };

    let response;
    if (SOLAPI_PROXY_URL) {
      response = await fetch(SOLAPI_PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", payload: requestBody })
      });
    } else {
      const authHeader = await createSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);
      response = await fetch("https://api.solapi.com/messages/v4/send", {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
    }

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.errorMessage || `HTTP status ${response.status}`);
    }

    // 프록시 미사용 시에만 발송 1.2초 후 단건 상태 조회로 통신사 차단 여부 확인
    let finalStatus = "success";
    let finalError = "";
    if (!SOLAPI_PROXY_URL && responseData && responseData.messageId) {
      await new Promise(r => setTimeout(r, 1200));
      try {
        const checkAuth = await createSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);
        const checkRes = await fetch(`https://api.solapi.com/messages/v4/list?criteria=messageId&value=${responseData.messageId}&limit=1`, {
          headers: { "Authorization": checkAuth }
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const targetMsg = checkData.messageList && checkData.messageList[responseData.messageId];
          if (targetMsg) {
            const sCode = parseInt(targetMsg.statusCode, 10);
            // 3000번대 상태 코드는 통신사 차단 및 전송 실패를 의미함
            if (sCode >= 3000 && sCode < 4000) {
              finalStatus = "fail";
              finalError = targetMsg.reason || `전송 실패 (코드 ${sCode})`;
              if (sCode === 3113) {
                finalError = "통신사 번호도용문자차단서비스로 인해 차단되었습니다. 발신번호 통신사(114)에서 해당 부가서비스를 해지해 주세요.";
              }
            }
          }
        }
      } catch (checkErr) {
        console.warn("솔라피 상태 후속 조회 예외:", checkErr);
      }
    }

    if (finalStatus === "fail") {
      return { status: "fail", error: finalError };
    }

    console.log(`고객 알림 LMS 발송 성공 (${statusType}):`, responseData);
    return { status: "success", data: responseData };
  } catch (err) {
    console.error(`고객 알림 LMS 발송 실패 (${statusType}):`, err);
    return { status: "fail", error: err.message };
  }
};

function initPage() {
  const reservationList = document.getElementById("reservation-list");
  const btnRefresh = document.getElementById("btn-refresh");

  const tabReservations = document.getElementById("tab-reservations");
  const tabUsers = document.getElementById("tab-users");
  // 디자인/기능 개편: 광고 배너 관리를 위한 신규 탭 버튼 및 패널 요소 캐싱
  const tabAds = document.getElementById("tab-ads");
  // 협력업체 CRUD 관리 탭 버튼 및 패널 요소 캐싱
  const tabPartners = document.getElementById("tab-partners");
  // 전문 의료 통역 관리 탭 버튼 및 콘텐츠 패널 요소 캐싱
  const tabInterpreters = document.getElementById("tab-interpreters");
  // 가입 회원 대상 문자발송 전용 탭 버튼 및 콘텐츠 패널 요소 캐싱
  const tabSms = document.getElementById("tab-sms");
  const contentReservations = document.getElementById("content-reservations");
  const contentUsers = document.getElementById("content-users");
  const contentAds = document.getElementById("content-ads");
  const contentPartners = document.getElementById("content-partners");
  const contentInterpreters = document.getElementById("content-interpreters");
  const contentSms = document.getElementById("content-sms");

  const userList = document.getElementById("user-list");
  const btnRefreshUsers = document.getElementById("btn-refresh-users");
  // 회원 목록 전용 페이지네이션 컨테이너 DOM 요소
  const usersPagination = document.getElementById("users-pagination");

  // 문자발송 탭 전용 회원 리스트 및 페이지네이션 DOM 요소
  const smsUserList = document.getElementById("sms-user-list");
  const smsUsersPagination = document.getElementById("sms-users-pagination");
  const btnRefreshSmsUsers = document.getElementById("btn-refresh-sms-users");

  let currentLoginUserRole = "user"; // 현재 로그인한 사용자의 등급 저장

  const statTotal = document.getElementById("stat-total");
  const statPending = document.getElementById("stat-pending");
  const statConfirmed = document.getElementById("stat-confirmed");
  const statCancelled = document.getElementById("stat-cancelled");

  let unsubscribe = null;
  // 예약 개수 제한 필터: 로컬 상태 보존 관리 변수 정의 (기본값: 10개)
  let currentLimit = parseInt(localStorage.getItem("admin_reservation_limit") || "10", 10);
  // 회원 개수 제한 필터: 로컬 상태 보존 관리 변수 정의 (기본값: 10개)
  let currentLimitUsers = parseInt(localStorage.getItem("admin_user_limit") || "10", 10);
  // 회원 목록 현재 페이지 번호 관리 상태 변수 (기본값: 1페이지)
  let currentUserPage = 1;
  // 회원 등급 필터: 동적 필터링 제어 상태 변수 (기본값: "all" 등급별 보기 전체)
  let currentRoleFilter = localStorage.getItem("admin_user_role_filter") || "all";
  // 회원 국가(선호언어) 타일 클릭 필터 상태 변수 (기본값: "all" 전체 회원 보기)
  let currentUserLangFilter = "all";
  // 회원 이름 검색어 상태 변수 (기본값: 빈 문자열)
  let currentUserSearchQuery = "";
  // 예약 언어 필터: 동적 필터링 제어 상태 변수 (기본값: "all" 전체보기)
  let currentLangFilter = localStorage.getItem("admin_reservation_lang_filter") || "all";
  // 예약 검색 필터] 실시간 검색어 상태 변수 (기본값: 빈 문자열)
  let currentSearchQuery = "";

  // 통계 업데이트 함수 정의
  function updateStats(total, pending, confirmed, cancelled) {
    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statConfirmed) statConfirmed.textContent = confirmed;
    if (statCancelled) statCancelled.textContent = cancelled;
  }

  // 렌더링 전용 함수 정의 (상단 상태 카드 및 국가별 타일 통계는 항상 전체 예약 목록 allItems 기준으로 고정 집계)
  function renderReservations(items, allItems = null) {
    reservationList.innerHTML = "";

    let totalCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;

    // 보기 개수(10/20/50/100개) 및 언어/검색 필터와 무관하게 항상 전체 예약 원본 배열을 기준으로 통계를 산출합니다.
    const statsItems = Array.isArray(allItems) ? allItems : items;
    const langCounts = {};
    const refLangList = Array.isArray(LANG_LIST) ? LANG_LIST : (window.GLOBAL_LANG_LIST || []);
    refLangList.forEach(l => { langCounts[l.code] = 0; });

    // 전체 예약 데이터를 순회하며 상태별 통계(전체/대기중/확정/취소)와 국가별 카운트를 동시에 집계합니다.
    statsItems.forEach(item => {
      totalCount++;
      if (item.status === "pending") pendingCount++;
      else if (item.status === "confirmed") confirmedCount++;
      else if (item.status === "cancelled") cancelledCount++;

      if (item.lang && langCounts[item.lang] !== undefined) {
        langCounts[item.lang]++;
      }
    });

    // 상단 4대 요약 통계 카드(전체 예약, 대기 중, 예약 확정, 예약 취소)를 전체 데이터 기준으로 고정 업데이트합니다.
    updateStats(totalCount, pendingCount, confirmedCount, cancelledCount);

    // 선택언어별 예약수 타일 렌더링 (#admin-lang-stats)
    const langStatsContainer = document.getElementById("admin-lang-stats");
    if (langStatsContainer) {
      let html = "";
      refLangList.forEach(l => {
        const key = l.code;
        const style = LANG_STYLE_MAP[key] || { flag: "🌐", color: "#ffffff", border: "rgba(255, 255, 255, 0.2)" };
        const label = l.koName || key;
        const count = langCounts[key] || 0;
        html += `
          <div class="lang-stat-tile" style="border-color: ${style.border};">
            <span class="lang-tile-title" style="color: ${style.color};">${style.flag} ${escapeHtml(label)}</span>
            <span class="lang-tile-value" style="color: ${style.color};">${count}<small>명</small></span>
          </div>
        `;
      });
      langStatsContainer.innerHTML = html;
    }

    if (items.length === 0) {
      // '희망진료시간' 컬럼이 추가되어 전체 컬럼 개수가 18개로 변경됨에 따라 빈 테이블 노출 시 colspan을 18로 수정
      // 검색 또는 언어 필터 결과 행이 0건이더라도 상단 전체 통계는 0으로 초기화하지 않고 전체 수치를 그대로 유지합니다.
      reservationList.innerHTML = `<tr><td colspan="18" class="table-empty">현재 등록된 예약 내역이 없습니다.</td></tr>`;
      return;
    }

    items.forEach((data) => {
      const docId = escapeHtml(data.id);

      // 테이블 행 생성
      const tr = document.createElement("tr");
      tr.className = `status-${data.status || "pending"}`;

      // 생성 시간 포맷팅
      const dateStr = formatFirestoreDate(data.createdAt, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });

      // 선택언어 라벨 매핑 (공통 LANG_LABELS 참조)
      const displayLang = LANG_LABELS[data.lang] || (data.lang ? `🌐 ${escapeHtml(data.lang)}` : "-");

      // 신원 정보 라벨 (하위 호환성 유지)
      const idInfo = [];
      if (data.alienNo) idInfo.push(`<div class="id-badge alien">외국인: ${escapeHtml(data.alienNo)}</div>`);
      if (data.passportNo) idInfo.push(`<div class="id-badge passport">여권: ${escapeHtml(data.passportNo)}</div>`);
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

      // 알림톡 상태 배지 생성 - success, sent 등 다양한 정상/실패 상태 대소문자 무관 안전 지원
      let alimtalkBadgeText = "대기";
      let alimtalkBadgeClass = "badge-alimtalk-none";
      let alimtalkTitleAttr = "";

      const statusLower = (data.alimtalkStatus || "").toLowerCase();
      if (statusLower === "success" || statusLower === "sent" || statusLower === "ok") {
        alimtalkBadgeText = "발송성공";
        alimtalkBadgeClass = "badge-alimtalk-success";
      } else if (statusLower === "fail" || statusLower === "failed" || statusLower === "error") {
        alimtalkBadgeText = "발송실패";
        alimtalkBadgeClass = "badge-alimtalk-fail";
        alimtalkTitleAttr = `title="에러 원인: ${escapeHtml(data.alimtalkError || '알 수 없는 오류')}"`;
      } else if (statusLower === "not_configured") {
        alimtalkBadgeText = "미설정";
        alimtalkBadgeClass = "badge-alimtalk-none";
        alimtalkTitleAttr = `title="안내: ${escapeHtml(data.alimtalkError || '솔라피 API 연동 설정이 플레이스홀더 상태입니다.')}"`;
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

      // 테이블 렌더링 처리 (모든 사용자 입력 필드에 XSS 방지 이스케이프 적용)
      tr.innerHTML = `
        <td class="col-lang"><span class="lang-badge">${displayLang}</span></td>
        <td class="col-name font-bold">${escapeHtml(data.name || "-")}</td>
        <td class="col-clinic"><span class="table-clinic-name">${escapeHtml(data.clinic || "-")}</span></td>
        <td class="col-gender">${escapeHtml(data.gender || "-")}</td>
        <td class="col-visa-type font-bold" style="color: #34d399;">${escapeHtml(data.visaType || "-")}</td>
        <td class="col-dob">${escapeHtml(data.dob || "-")}</td>
        <td class="col-id">${idInfoHTML}</td>
        <td class="col-visa-expiry text-accent">${escapeHtml(data.visaExpiry || "-")}</td>
        <td class="col-phone">${escapeHtml(data.phone || "-")}</td>
        <td class="col-date">${escapeHtml(dateStr)}</td>
        <td class="col-res-date font-bold text-accent">${escapeHtml(data.reservationDate || "-")}</td>
        <td class="col-res-time font-bold" style="color: #67e8f9;">${escapeHtml(data.reservationTime || "-")}</td>
        <td class="col-address">${escapeHtml(data.address || "-")}</td>
        <td class="col-symptoms">${escapeHtml(data.symptoms || "-")}</td>
        <!-- 증상과 상태 컬럼 사이에 유입경로(inflow)를 직접 수정 가능한 인라인 input 텍스트 필드로 렌더링 -->
        <td class="col-inflow"><input type="text" class="inflow-edit-input" data-id="${docId}" value="${escapeHtml(data.inflow || '')}" placeholder="유입경로 입력" /></td>
        <td class="col-alimtalk"><span class="badge ${alimtalkBadgeClass}" ${alimtalkTitleAttr}>${alimtalkBadgeText}</span></td>
        <td class="col-status"><span class="badge ${statusBadgeClass}">${statusBadgeText}</span></td>
        <td class="col-actions"><div class="action-wrapper">${actionButtons}</div></td>
      `;

      reservationList.appendChild(tr);
    });
  }

  // 예약 목록 언어 + 검색어 통합 필터링 헬퍼 (초기 로컬/실시간 스냅샷/오류 폴백 3곳에서 공통 사용)
  function filterReservations(items = []) {
    const result = currentLangFilter !== "all"
      ? items.filter((item) => item.lang === currentLangFilter)
      : items;

    if (!currentSearchQuery) return result;

    return result.filter((item) => {
      const fields = [
        item.name, item.phone, item.symptoms, item.clinic,
        item.alienNo, item.passportNo, item.visaType,
        item.reservationTime, item.inflow, item.alimtalkStatus, item.alimtalkError
      ];
      return fields.some((val) => String(val || "").toLowerCase().includes(currentSearchQuery));
    });
  }

  // 실시간 수신 대기 및 병합 (동적 limit 개수 제한 연동)
  function loadReservations(isFirstLoad = false) {
    if (unsubscribe) {
      unsubscribe();
    }

    // 복합색인 에러 회피 및 전체 예약 통계 정합성 보장: 전체 예약 데이터를 조회한 뒤 클라이언트에서 필터링 및 페이지 표시 수량 제한을 수행합니다.
    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));
    
    // 최초 로드 시에만 로딩 표시 및 로컬스토리지 즉시 반환 처리
    if (isFirstLoad) {
      // '희망진료시간' 컬럼 추가로 전체 컬럼이 18개가 됨에 따라 로딩 표시 colspan을 18로 수정
      reservationList.innerHTML = `<tr><td colspan="18" class="table-loading">데이터를 실시간 동기화 중입니다...</td></tr>`;

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
        const filteredLocal = filterReservations(initialLocalItems);
        const sortedLocal = [...filteredLocal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        // 제한 수량만큼 잘라내어 초기 렌더링 (전체 목록 전달)
        renderReservations(sortedLocal.slice(0, currentLimit), initialLocalItems);
      }
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

      // 3. 중복을 제거하며 병합 (Firestore 데이터 우선, 전체 통계 정합성을 위해 언어 필터 적용 전 전체 병합)
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
      const sortedItems = Array.from(mergedMap.values()).sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // 실시간 정합성: 서버에서 최신 상태를 받아왔으므로 로컬스토리지 백업 데이터도 즉시 최신화
      try {
        localStorage.setItem("local_reservations", JSON.stringify(sortedItems));
      } catch (e) {
        console.error("Failed to sync sortedItems to local_reservations:", e);
      }

      // 5. 선택 언어 및 검색어로 최종 클라이언트 필터링
      const filteredItems = filterReservations(sortedItems);

      // 6. 렌더링 호출 (지정된 limit 크기만큼 최종 슬라이스하고 전체 목록 sortedItems 전달)
      renderReservations(filteredItems.slice(0, currentLimit), sortedItems);

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

      const filteredLocal = filterReservations(localItems);
      const finalItems = [...filteredLocal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      // 제한 수량만큼 잘라내어 렌더링 (전체 목록 전달)
      renderReservations(finalItems.slice(0, currentLimit), localItems);
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
      // 성능 최적화: loadReservations() 재호출 제거
      // onSnapshot 리스너가 이미 Firestore 변경사항을 실시간으로 수신하여 자동 렌더링합니다.
      // 불필요하게 리스너를 해제하고 재연결하면 Firestore 읽기 비용이 중복 발생합니다.
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

    // 1. 로컬 데이터인 경우 로컬스토리지 업데이트 및 알림 문자 발송
    if (docId.startsWith("local_")) {
      const localDataStr = localStorage.getItem("local_reservations");
      let localItem = null;
      if (localDataStr) {
        try {
          const arr = JSON.parse(localDataStr);
          localItem = arr.find(i => i.id === docId);
        } catch (e) {}
      }

      if (action === "confirm") {
        updateLocalReservation(docId, action);
        if (localItem && localItem.phone) {
          sendCustomerStatusLms(localItem, "confirmed");
        }
      } else if (action === "cancel") {
        if (confirm("정말 이 예약을 취소하시겠습니까?")) {
          updateLocalReservation(docId, action);
          if (localItem && localItem.phone) {
            sendCustomerStatusLms(localItem, "cancelled");
          }
        }
      } else {
        updateLocalReservation(docId, action);
      }
      button.disabled = false;
      button.textContent = originalText;
      return;
    }

    // 2. 일반 Firestore 데이터의 경우
    try {
      const docRef = doc(db, "reservations", docId);

      if (action === "confirm") {
        await updateDoc(docRef, { status: "confirmed" });

        // 고객에게 예약 확정 LMS 문자 발송
        let targetData = null;
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) targetData = snap.data();
        } catch (e) {}

        if (targetData && targetData.phone) {
          const lmsRes = await sendCustomerStatusLms(targetData, "confirmed");
          if (lmsRes.status === "success") {
            await updateDoc(docRef, {
              customerSmsStatus: "success",
              customerSmsSentAt: serverTimestamp()
            }).catch(() => {});
            alert(`예약이 확정되었습니다.\n환자분(${targetData.phone})께 확정 안내 문자가 정상 발송되었습니다.`);
          } else {
            await updateDoc(docRef, {
              customerSmsStatus: "fail",
              customerSmsError: lmsRes.error || ""
            }).catch(() => {});
            alert(`예약이 확정되었습니다.\n(단, 환자 안내 문자 발송 실패: ${lmsRes.error || '오류'})`);
          }
        } else {
          alert("예약이 확정되었습니다.");
        }
      } else if (action === "cancel") {
        if (confirm("정말 이 예약을 취소하시겠습니까?")) {
          await updateDoc(docRef, { status: "cancelled" });

          // 고객에게 예약 취소 LMS 문자 발송
          let targetData = null;
          try {
            const snap = await getDoc(docRef);
            if (snap.exists()) targetData = snap.data();
          } catch (e) {}

          if (targetData && targetData.phone) {
            const lmsRes = await sendCustomerStatusLms(targetData, "cancelled");
            if (lmsRes.status === "success") {
              await updateDoc(docRef, {
                customerSmsStatus: "success",
                customerSmsSentAt: serverTimestamp()
              }).catch(() => {});
              alert(`예약이 취소되었습니다.\n환자분(${targetData.phone})께 취소 안내 문자가 정상 발송되었습니다.`);
            } else {
              await updateDoc(docRef, {
                customerSmsStatus: "fail",
                customerSmsError: lmsRes.error || ""
              }).catch(() => {});
              alert(`예약이 취소되었습니다.\n(단, 환자 안내 문자 발송 실패: ${lmsRes.error || '오류'})`);
            }
          } else {
            alert("예약이 취소되었습니다.");
          }
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
    loadReservations(false);
  });

  // 유입경로 인라인 입력란의 값이 변경되었을 때 Firestore 및 로컬스토리지를 업데이트하는 이벤트 리스너
  reservationList.addEventListener("change", async (e) => {
    if (!e.target.classList.contains("inflow-edit-input")) return;

    const input = e.target;
    const docId = input.dataset.id;
    const newInflow = input.value.trim();

    if (!docId) return;

    // 1. 로컬스토리지 백업 데이터 업데이트
    try {
      const existing = localStorage.getItem("local_reservations");
      if (existing) {
        let localData = JSON.parse(existing);
        const index = localData.findIndex(item => item.id === docId);
        if (index !== -1) {
          localData[index].inflow = newInflow;
          localStorage.setItem("local_reservations", JSON.stringify(localData));
          
          // 로컬 전용 예약일 경우 별도 local_reservations_direct 키에 백업 저장
          if (docId.startsWith("local_")) {
            localStorage.setItem("local_reservations_direct", JSON.stringify(localData.filter(item => item.id.startsWith("local_"))));
          }
        }
      }
    } catch (err) {
      console.error("Local inflow update error:", err);
    }

    // 2. 일반 Firestore 데이터의 경우 서버 데이터 업데이트
    if (!docId.startsWith("local_")) {
      try {
        const docRef = doc(db, "reservations", docId);
        await updateDoc(docRef, { inflow: newInflow });
        // 업데이트 성공 시 시각적 효과를 위해 잠시 테두리 색상 강조
        input.style.borderColor = "#34d399";
        setTimeout(() => {
          input.style.borderColor = "";
        }, 1000);
      } catch (err) {
        console.error("Firestore inflow update error:", err);
        input.style.borderColor = "#ef4444";
        alert("유입경로 저장에 실패했습니다. (Database Error)");
      }
    } else {
      // 로컬 데이터는 로컬스토리지만 업데이트되었으므로 성공 효과 부여
      input.style.borderColor = "#34d399";
      setTimeout(() => {
        input.style.borderColor = "";
      }, 1000);
    }
  });

  // 예약 개수 제한 필터: 드롭다운 select 요소 바인딩 및 초기값 로컬스토리지 동기화
  const selectLimit = document.getElementById("select-limit-count");
  if (selectLimit) {
    // 저장된 수치가 있으면 드롭다운 초기값으로 자동 적용
    selectLimit.value = currentLimit.toString();
    
    selectLimit.addEventListener("change", (e) => {
      currentLimit = parseInt(e.target.value, 10);
      localStorage.setItem("admin_reservation_limit", currentLimit.toString());
      loadReservations(false); // 필터 선택값 변경 시 즉각 Firestore limit 재조회 및 렌더링
    });
  }

  // 예약 선택언어 필터: 드롭다운 select 요소 바인딩 및 초기값 로컬스토리지 동기화
  const selectLangFilter = document.getElementById("select-lang-filter");
  if (selectLangFilter) {
    // 저장된 언어가 있으면 드롭다운 초기값으로 자동 적용
    selectLangFilter.value = currentLangFilter;
    
    selectLangFilter.addEventListener("change", (e) => {
      currentLangFilter = e.target.value;
      localStorage.setItem("admin_reservation_lang_filter", currentLangFilter);
      loadReservations(false); // 언어 선택값 변경 시 즉각 예약 목록 재조회 및 렌더링
    });
  }

  // 예약 검색 필터] 검색 버튼 클릭 및 엔터 키 입력 시 검색 처리 (실시간 검색 이벤트 대체)
  const inputSearchReservations = document.getElementById("input-search-reservations");
  const btnSearchReservations = document.getElementById("btn-search-reservations");

  function executeSearch() {
    if (inputSearchReservations) {
      currentSearchQuery = inputSearchReservations.value.toLowerCase().trim();
      loadReservations(false); // 입력한 검색어로 목록 갱신
    }
  }

  if (inputSearchReservations) {
    inputSearchReservations.value = currentSearchQuery;

    // 엔터 키 입력 시 검색 실행
    inputSearchReservations.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        executeSearch();
      }
    });
  }

  if (btnSearchReservations) {
    // 검색 버튼 클릭 시 검색 실행
    btnSearchReservations.addEventListener("click", () => {
      executeSearch();
    });
  }


  // 성능 및 정합성 최적화: 관리자 권한을 파악하고 UI를 제어하는 함수
  // 권한 기반 UI 탭 제어를 전담 처리하는 리팩토링된 헬퍼 함수 - 최고관리자(super_admin) 프리패스 및 하위 등급별 메뉴 분기 완벽 지원
  function applyPermissionsUI(permissions) {
    const tabReservations = document.getElementById("tab-reservations");
    const tabUsers = document.getElementById("tab-users");
    const tabPermissions = document.getElementById("tab-permissions");
    const tabClinics = document.getElementById("tab-clinics");
    const tabAds = document.getElementById("tab-ads");
    const tabInterpreters = document.getElementById("tab-interpreters");

    // 최고관리자 여부 판별 플래그
    const isSuper = (currentLoginUserRole === "super_admin");

    // 상단 네비게이션 뱃지 제어 - 관리자 권한이 꺼져 있으면 관리자 버튼 숨김, 예약통계 권한이 꺼져 있으면 예약통계 버튼 숨김
    const btnAdminDashboard = document.getElementById("btn-admin-dashboard");
    const btnStatsDashboard = document.getElementById("btn-stats-dashboard");
    const quickBtnAdminDashboard = document.getElementById("quick-btn-admin-dashboard");
    const quickBtnStatsDashboard = document.getElementById("quick-btn-stats-dashboard");

    if (btnAdminDashboard) {
      btnAdminDashboard.style.display = (permissions.isAdmin || isSuper) ? "inline-block" : "none";
    }
    if (btnStatsDashboard) {
      btnStatsDashboard.style.display = (permissions.hasStats || isSuper) ? "inline-block" : "none";
    }
    if (quickBtnAdminDashboard) {
      quickBtnAdminDashboard.style.display = (permissions.isAdmin || isSuper) ? "inline-flex" : "none";
    }
    if (quickBtnStatsDashboard) {
      quickBtnStatsDashboard.style.display = (permissions.hasStats || isSuper) ? "inline-flex" : "none";
    }

    if (tabReservations) {
      tabReservations.style.display = (permissions.hasReservations || isSuper) ? "inline-block" : "none";
    }
    if (tabUsers) {
      tabUsers.style.display = (permissions.hasRoles || isSuper) ? "inline-block" : "none";
    }
    if (tabPermissions) {
      tabPermissions.style.display = (permissions.hasPermissions || isSuper) ? "inline-block" : "none";
    }
    // 문자발송 탭 노출 제어 (등급권한 관리의 hasSms 권한 보유자 또는 최고관리자에게 노출)
    const tabSmsEl = document.getElementById("tab-sms");
    if (tabSmsEl) {
      tabSmsEl.style.display = (permissions.hasSms || isSuper) ? "inline-block" : "none";
    }
    if (tabClinics) {
      tabClinics.style.display = (permissions.hasClinics || isSuper) ? "inline-block" : "none";
    }
    if (tabAds) {
      tabAds.style.display = (permissions.hasAds || isSuper) ? "inline-block" : "none";
    }
    // 협력업체 관리 탭 권한 노출 제어 (hasPartners 권한 또는 최고관리자 권한)
    const tabPartners = document.getElementById("tab-partners");
    if (tabPartners) {
      tabPartners.style.display = (permissions.hasPartners || isSuper) ? "inline-block" : "none";
    }
    // 전문통역 관리 탭 권한 노출 제어 (hasInterpreters 권한 또는 최고관리자 권한)
    if (tabInterpreters) {
      tabInterpreters.style.display = (permissions.hasInterpreters || isSuper) ? "inline-block" : "none";
    }

    // 활성화 탭 강제 튕김 보정 (최고관리자는 절대 튕기지 않음)
    const activeTab = document.querySelector(".tab-btn.active");
    if (activeTab && !isSuper) {
      if (activeTab.id === "tab-clinics" && !permissions.hasClinics) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-ads" && !permissions.hasAds) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-partners" && !permissions.hasPartners) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-interpreters" && !permissions.hasInterpreters) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-users" && !permissions.hasRoles) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-permissions" && !permissions.hasPermissions) {
        if (tabReservations) tabReservations.click();
      } else if (activeTab.id === "tab-sms" && !permissions.hasSms) {
        if (tabReservations) tabReservations.click();
      }
    }
  }

  // auth.js의 실시간 등급/권한 감지기에서 발행하는 이벤트를 수신하여 관리자 탭 UI 0초 즉각 갱신
  window.addEventListener("rolePermissionsChanged", (e) => {
    if (e.detail && e.detail.permissions) {
      currentLoginUserRole = e.detail.role || currentLoginUserRole;
      applyPermissionsUI(e.detail.permissions);
    }
  });

  // 성능 및 정합성 최적화: 관리자 권한을 파악하고 UI를 제어하는 함수
  async function verifyAndApplyPermissions(user, forceRefresh = false) {
    if (!user) return false;

    // 세션 캐시 검색 및 복원 처리 - 11개 세부 권한 프로퍼티가 온전히 존재하는지 무결성 검증
    const cacheKey = `admin_permissions_${user.uid}`;
    if (!forceRefresh) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const cachedObj = JSON.parse(cached);
          if (cachedObj && cachedObj.permissions && typeof cachedObj.permissions.hasReservations === "boolean" && typeof cachedObj.permissions.hasSms === "boolean") {
            console.log("Admin permissions restored from Session Cache (0 Firestore Read cost)");
            currentLoginUserRole = cachedObj.role;
            applyPermissionsUI(cachedObj.permissions);
            return cachedObj.permissions;
          } else {
            console.log("Incomplete session cache detected. Refreshing permissions from DB...");
          }
        } catch (e) {
          console.warn("Session cache parsing error:", e);
        }
      }
    }

    let permissions = null;
    let userRole = null;

    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      userRole = userData.role || "user";

      // roles 문서 조회 후 공통 권한 빌더로 11가지 세부 권한 매핑
      let roleDocData = null;
      if (userRole !== "super_admin") {
        const roleDocRef = doc(db, "roles", userRole);
        const roleDocSnap = await getDoc(roleDocRef);
        roleDocData = roleDocSnap.exists() ? roleDocSnap.data() : null;
      }
      permissions = buildRolePermissions(userRole, roleDocData);
    }

    if (permissions && permissions.isAdmin === true) {
      console.log(`Access granted for role: ${userRole}`);
      currentLoginUserRole = userRole; // 등급 캐싱
      
      // 세션 스토리지 캐시 최신화 저장
      sessionStorage.setItem(cacheKey, JSON.stringify({ role: userRole, permissions }));
      
      // UI 스위칭
      applyPermissionsUI(permissions);

      return permissions;
    }

    // 권한이 해제된 경우 로그인 메인으로 차단
    alert("관리자 권한이 없습니다. (Access Denied: No Admin Role)");
    location.href = "./index.html";
    return null;
  }

  // Firebase Auth 상태 감지 및 관리자 권한 검증
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("로그인이 필요합니다. (Login is required.)");
      location.href = "./index.html";
      return;
    }

    try {
      // '유입경로' 컬럼 추가로 전체 컬럼이 16개가 됨에 따라 권한 확인 로딩 표시 colspan을 16으로 수정
      reservationList.innerHTML = `<tr><td colspan="18" class="table-loading">권한을 확인하는 중입니다...</td></tr>`;
      
      // 권한 검증 및 UI 갱신 함수 실행
      const permissions = await verifyAndApplyPermissions(user);
      if (permissions) {
        // 모든 탭 버튼 및 콘텐츠 숨김 처리 헬퍼 함수 - 8개 전체 관리 탭 및 패널 반영
        const hideAllTabsAndContents = () => {
          const tabs = [tabReservations, tabClinics, tabUsers, tabPermissions, tabSms, tabAds, tabPartners, tabInterpreters];
          const contents = [contentReservations, contentClinics, contentUsers, contentPermissions, contentSms, contentAds, contentPartners, contentInterpreters];
          tabs.forEach(t => { if (t) t.classList.remove("active"); });
          contents.forEach(c => { if (c) c.style.display = "none"; });
        };

        // 새로고침 시 기존에 선택해두었던 활성 탭 복원 시도 (클릭 핸들러가 switchTabSeamlessly 및 데이터 로드를 1회 실행함)
        const savedTab = sessionStorage.getItem("active_admin_tab");
        const tabToClick = savedTab ? document.getElementById(savedTab) : null;
        
        // 저장된 탭이 존재하고 권한에 의해 화면에 표시(style.display !== "none")되고 있는 경우만 트리거
        if (tabToClick && tabToClick.style.display !== "none") {
          if (savedTab === "tab-reservations") {
            // 예약 탭은 로컬 백업 우선 표시를 위해 isFirstLoad=true 플래그로 1회 활성화
            switchTabSeamlessly(tabReservations, contentReservations, "tab-reservations", () => loadReservations(true));
          } else {
            tabToClick.click();
          }
        } else {
          // 저장된 탭 정보가 없거나 비노출 상태인 경우 우선순위에 따라 탭 활성화 및 로드
          if (permissions.hasReservations && tabReservations) {
            switchTabSeamlessly(tabReservations, contentReservations, "tab-reservations", () => loadReservations(true));
          } else if (permissions.hasClinics && tabClinics) {
            tabClinics.click();
          } else if (permissions.hasAds && tabAds) {
            tabAds.click();
          } else if (tabPartners && tabPartners.style.display !== "none") {
            tabPartners.click();
          } else if (tabInterpreters && tabInterpreters.style.display !== "none") {
            tabInterpreters.click();
          } else if (permissions.hasRoles && tabUsers) {
            tabUsers.click();
          } else if (permissions.hasPermissions && tabPermissions) {
            tabPermissions.click();
          } else if (permissions.hasSms && tabSms) {
            tabSms.click();
          } else {
            // 모든 항목이 비활성화 되어 있는 경우 아무것도 보이지 않게 처리
            hideAllTabsAndContents();
            if (reservationList) {
              // '유입경로' 컬럼 추가로 전체 컬럼이 16개가 됨에 따라 접근 불가 메시지 표시 colspan을 16으로 수정
              reservationList.innerHTML = `<tr><td colspan="18" class="table-empty">접근 가능한 관리 메뉴가 없습니다.</td></tr>`;
            }
          }
        }
      }
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

  /**
   * 테이블 컨테이너 내부 화면을 마우스로 클릭하여 좌우로 부드럽게 끌어당길 수 있는 마우스 드래그 가로 스크롤 엔진
   * @param {HTMLElement} container - 스크롤 가능한 .table-responsive 요소
   */
  function initTableDragToScroll(container) {
    if (!container || container.dataset.dragScrollBound === "true") return;
    container.dataset.dragScrollBound = "true";
    container.classList.add("drag-scroll-enabled");

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    container.addEventListener("mousedown", (e) => {
      // 버튼, 드롭다운 셀렉트박스, 입력창 등 폼 조작 요소를 클릭한 경우 드래그 시작 차단
      if (e.target.closest("button, select, input, a, textarea, label")) return;

      isDown = true;
      container.classList.add("dragging");
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    });

    window.addEventListener("mouseup", () => {
      if (isDown) {
        isDown = false;
        container.classList.remove("dragging");
      }
    });

    container.addEventListener("mouseleave", () => {
      if (isDown) {
        isDown = false;
        container.classList.remove("dragging");
      }
    });

    container.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - container.offsetLeft;
      const walk = (x - startX) * 1.5; // 드래그 가속 반응도 계수
      container.scrollLeft = scrollLeft - walk;
    });
  }

  // 관리자 페이지 내 모든 테이블 컨테이너(.table-responsive)에 마우스 드래그 가로 스크롤 기능 일괄 적용
  function setupAllTableDragToScroll() {
    document.querySelectorAll(".table-responsive").forEach((container) => {
      initTableDragToScroll(container);
    });
  }

  // 탭 전환 시 메뉴 영역 랙 및 깜빡임(Layout Shift)을 방지하는 통합 탭 스위칭 헬퍼 함수
  function switchTabSeamlessly(activeBtn, activeContent, tabStorageKey, fetchCallback) {
    // 1. 모든 탭 버튼 및 패널 스위칭 처리 (메뉴는 고정되고 내용만 즉각 변경됨)
    const tabs = [tabReservations, tabClinics, tabUsers, tabPermissions, tabSms, tabAds, tabPartners, tabInterpreters];
    const contents = [contentReservations, contentClinics, contentUsers, contentPermissions, contentSms, contentAds, contentPartners, contentInterpreters];

    tabs.forEach(t => { if (t) t.classList.remove("active"); });
    contents.forEach(c => { if (c) c.style.display = "none"; });

    if (activeBtn) activeBtn.classList.add("active");
    if (activeContent) activeContent.style.display = "block";

    // 2. 활성 탭 키 세션 스토리지 기록
    sessionStorage.setItem("active_admin_tab", tabStorageKey);

    // 3. 예약 탭이 아닌 다른 탭으로 이동 시 예약 실시간 리스너 해제로 Firestore 읽기 비용 절감
    if (tabStorageKey !== "tab-reservations" && unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    // 4. 활성화된 탭 내부 테이블의 마우스 드래그 스크롤 활성화 바인딩
    setupAllTableDragToScroll();

    // 5. 데이터 로드 콜백 비동기 실행 (탭 전환 반응속도 100% 보장)
    if (fetchCallback) {
      fetchCallback();
    }
  }

  if (tabReservations && tabUsers && tabClinics) {
    tabReservations.addEventListener("click", () => {
      switchTabSeamlessly(tabReservations, contentReservations, "tab-reservations", () => {
        loadReservations(false);
      });
    });

    tabUsers.addEventListener("click", () => {
      switchTabSeamlessly(tabUsers, contentUsers, "tab-users", () => {
        initRolesAndListen();
        // 등급권한 관리 탭 진입 시 솔라피 수신 연락처 설정 데이터도 함께 로드
        loadSolapiSettings();
      });
    });

    if (tabPermissions) {
      tabPermissions.addEventListener("click", () => {
        switchTabSeamlessly(tabPermissions, contentPermissions, "tab-permissions", () => {
          // 성능 최적화: 이미 roles 감시 리스너가 등록되어 있는 경우 initRolesAndListen()의 중복 쿼리 등록을 차단하고 loadUsers()만 실행하여 메뉴 랙 방지
          if (unsubscribeRoles) {
            loadUsers();
          } else {
            initRolesAndListen();
          }
        });
      });
    }

    // 문자발송 탭 클릭 시 스위칭 및 가입 회원 목록 연동 렌더링
    if (tabSms) {
      tabSms.addEventListener("click", () => {
        switchTabSeamlessly(tabSms, contentSms, "tab-sms", () => {
          // 이미 메모리에 가입 회원 목록이 로드되어 있으면 추가 DB 조회 없이 즉시 문자발송 리스트를 렌더링하고, 없으면 loadUsers() 실행
          if (allLoadedUsers.length > 0) {
            buildSmsRoleFilterOptions();
            renderSmsLangStats(allLoadedUsers);
            applySmsUserFiltersAndRender(false);
          } else if (unsubscribeRoles) {
            loadUsers();
          } else {
            initRolesAndListen();
          }
        });
      });
    }

    tabClinics.addEventListener("click", () => {
      switchTabSeamlessly(tabClinics, contentClinics, "tab-clinics", () => {
        loadClinics();
      });
    });

    if (tabAds) {
      tabAds.addEventListener("click", () => {
        switchTabSeamlessly(tabAds, contentAds, "tab-ads", () => {
          loadAds();
        });
      });
    }

    // 협력업체 관리 탭 클릭 시 스위칭 및 목록 로드
    if (tabPartners) {
      tabPartners.addEventListener("click", () => {
        switchTabSeamlessly(tabPartners, contentPartners, "tab-partners", () => {
          loadAdminPartners();
        });
      });
    }

    // 전문통역 관리 탭 클릭 시 스위칭 및 목록 로드
    if (tabInterpreters) {
      tabInterpreters.addEventListener("click", () => {
        switchTabSeamlessly(tabInterpreters, contentInterpreters, "tab-interpreters", () => {
          loadAdminInterpreters();
        });
      });
    }
  }

  // --- 회원 등급(역할) 동적 관리 기능 구현 ---
  let unsubscribeRoles = null;
  let rolesCache = {}; // { super_admin: "최고 관리자", ... }

  // 기본 등급 데이터셋은 공통 설정 모듈(lang-config.js)에서 임포트하여 단일 진실 공급원으로 관리
  const defaultRoles = DEFAULT_AVAILABLE_ROLES;

  // 솔라피 알림톡 수신 설정 데이터를 Firestore에서 비동기 로드하여 입력 필드 및 하단 목록 렌더링 적용
  async function loadSolapiSettings() {
    try {
      const solapiDocRef = doc(db, "settings", "solapi");
      const solapiDocSnap = await getDoc(solapiDocRef);
      
      const phonesInput = document.getElementById("solapi-admin-phones");
      const listContainer = document.getElementById("solapi-phones-list-container");
      const phonesList = document.getElementById("solapi-phones-list");
      
      if (solapiDocSnap.exists()) {
        const data = solapiDocSnap.data();
        const adminPhones = data.adminPhones || [];
        
        // 1. 입력창 값 초기화 - 추가할 번호만 전용으로 입력받기 위해 비워둠
        if (phonesInput) {
          phonesInput.value = "";
        }
        
        // 2. 하단 목록 렌더링
        if (phonesList && listContainer) {
          if (adminPhones.length > 0) {
            listContainer.style.display = "block";
            phonesList.innerHTML = adminPhones.map(phone => `
              <li style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 255, 255, 0.04); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06);">
                <span style="color: #e2e8f0; font-family: monospace; font-size: 0.9rem; font-weight: 500;">📱 ${escapeHtml(phone)}</span>
                <button type="button" class="btn-delete-phone" data-phone="${escapeHtml(phone)}" 
                  style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); color: #fca5a5; padding: 3px 8px; font-size: 0.78rem; border-radius: 6px; cursor: pointer; transition: all 0.2s;">삭제</button>
              </li>
            `).join("");
            
            // 각 개별 수신 번호 우측의 삭제 버튼 클릭 시 해당 번호를 배열에서 제외하고 DB에 재갱신 및 목록 리프레시 수행
            phonesList.querySelectorAll(".btn-delete-phone").forEach(btn => {
              btn.addEventListener("click", async (e) => {
                const targetPhone = e.target.getAttribute("data-phone");
                if (!targetPhone) return;
                
                if (currentLoginUserRole !== "super_admin") {
                  alert("삭제 권한이 없습니다.");
                  return;
                }
                
                if (confirm(`연락처 ${targetPhone}을(를) 알림톡 수신 목록에서 삭제하시겠습니까?`)) {
                  const updatedPhones = adminPhones.filter(p => p !== targetPhone);
                  
                  e.target.disabled = true;
                  e.target.textContent = "삭제 중...";
                  
                  try {
                    await setDoc(doc(db, "settings", "solapi"), {
                      adminPhones: updatedPhones,
                      updatedAt: new Date().toISOString(),
                      updatedBy: auth.currentUser ? auth.currentUser.uid : "unknown"
                    });
                    alert("성공적으로 삭제되었습니다.");
                    loadSolapiSettings();
                  } catch (err) {
                    console.error("Delete Solapi phone failed:", err);
                    alert("삭제에 실패했습니다: " + err.message);
                    e.target.disabled = false;
                    e.target.textContent = "삭제";
                  }
                }
              });
            });
          } else {
            listContainer.style.display = "none";
            phonesList.innerHTML = "";
          }
        }
      } else {
        if (phonesInput) phonesInput.value = "";
        if (listContainer) listContainer.style.display = "none";
      }
    } catch (error) {
      console.error("Failed to load Solapi settings:", error);
    }
  }

  // 회원 등급 로드 및 초기 시드 처리
  async function initRolesAndListen() {
    if (unsubscribeRoles) {
      loadUsers(); // 이미 리스닝 중인 경우, 중복 리스너 등록은 방지하고 회원 목록은 즉시 로드
      return; 
    }

    const rolesCol = collection(db, "roles");

    // 성능 최적화: 초기 시드 등급 적재 검사는 백그라운드 비동기로 실행
    // 마이그레이션은 roles 컬렉션이 비어있거나 isAdmin / hasPartners 필드 누락 시에만 1회 실행됩니다.
    (async () => {
      try {
        const snap = await getDocs(rolesCol);
        
        // roles 컬렉션이 아예 비어있거나, 기존 데이터에 권한 필드가 누락된 경우 마이그레이션 필요로 판정
        let needsMigration = snap.empty;
        if (!snap.empty) {
          const superAdminSnap = await getDoc(doc(db, "roles", "super_admin"));
          if (!superAdminSnap.exists() || superAdminSnap.data().isAdmin === undefined || superAdminSnap.data().hasAds === undefined || superAdminSnap.data().hasPartners === undefined || superAdminSnap.data().hasSms === undefined || superAdminSnap.data().hasCommunitySettings === undefined) {
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
                hasSms: r.hasSms,
                hasAds: r.hasAds,
                hasPartners: r.hasPartners,
                hasInterpreters: r.hasInterpreters,
                hasCommunitySettings: r.hasCommunitySettings,
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
                hasPermissions: existingData.hasPermissions !== undefined ? existingData.hasPermissions : r.hasPermissions,
                hasSms: existingData.hasSms !== undefined ? existingData.hasSms : (r.hasSms || false),
                hasAds: existingData.hasAds !== undefined ? existingData.hasAds : r.hasAds,
                hasPartners: existingData.hasPartners !== undefined ? existingData.hasPartners : (r.hasPartners || false),
                hasInterpreters: existingData.hasInterpreters !== undefined ? existingData.hasInterpreters : (r.hasInterpreters || false),
                hasCommunitySettings: existingData.hasCommunitySettings !== undefined ? existingData.hasCommunitySettings : (r.hasCommunitySettings || false)
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

    // 3. roles 실시간 감시는 동기적으로 즉시 시작
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
          
          // 최고 관리자 super_admin의 핵심 권한은 해제되지 않도록 강제 락
          const lockAdmin = roleKey === "super_admin";
          
          const safeRoleKey = escapeHtml(roleKey);
          const safeRoleLabel = escapeHtml(roleData.label);
          const deleteBtn = isSystem 
            ? `<span style="color:var(--text-secondary); font-size:0.8rem;">시스템 등급</span>`
            : `<button class="btn-action delete btn-delete-role" data-key="${safeRoleKey}">삭제</button>`;

          tr.innerHTML = `
            <td class="font-bold" style="color:#a5b4fc;">${safeRoleKey}</td>
            <td id="role-label-text-${safeRoleKey}">
              <span class="role-badge ${safeRoleKey}">${safeRoleLabel}</span>
            </td>
            <td>${makeToggleHTML(roleKey, "isAdmin", roleData.isAdmin, lockAdmin)}</td>
            <td>${makeToggleHTML(roleKey, "hasReservations", roleData.hasReservations, false)}</td>
            <td>${makeToggleHTML(roleKey, "hasClinics", roleData.hasClinics, false)}</td>
            <!-- 광고배너관리 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasAds", roleData.hasAds, false)}</td>
            <!-- 사용자 요청 - 광고배너관리 바로 오른쪽에 협력업체관리 권한 컬럼 스위치 신설 -->
            <td>${makeToggleHTML(roleKey, "hasPartners", roleData.hasPartners !== undefined ? roleData.hasPartners : (roleData.hasAds || lockAdmin), false)}</td>
            <!-- 등급권한관리 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasRoles", roleData.hasRoles, lockAdmin)}</td>
            <!-- 전문통역관리 권한 컬럼 스위치 (헤더와 1:1 일치 복원) -->
            <td>${makeToggleHTML(roleKey, "hasInterpreters", roleData.hasInterpreters !== undefined ? roleData.hasInterpreters : (roleData.hasAds || lockAdmin), false)}</td>
            <!-- 회원리스트 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasPermissions", roleData.hasPermissions, false)}</td>
            <!-- 회원리스트 오른쪽 옆에 신설된 문자발송 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasSms", roleData.hasSms !== undefined ? roleData.hasSms : lockAdmin, false)}</td>
            <!-- 예약통계 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasStats", roleData.hasStats, false)}</td>
            <!-- 커뮤니티설정 권한 컬럼 스위치 -->
            <td>${makeToggleHTML(roleKey, "hasCommunitySettings", roleData.hasCommunitySettings, false)}</td>
            <td>
              <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
                <button class="btn-action confirm btn-edit-role" data-key="${safeRoleKey}" data-label="${safeRoleLabel}">수정</button>
                ${deleteBtn}
              </div>
            </td>
          `;
          roleList.appendChild(tr);
        }
      });

      // 수집된 등급 캐시를 기반으로 회원 리스트 탭 및 문자발송 탭의 등급별 보기 드롭다운 옵션 최신화
      buildUserRoleFilterOptions();
      buildSmsRoleFilterOptions();

      // 이미 메모리에 회원 목록이 로드되어 있는 경우 추가 DB 조회 없이 화면 내 등급 표시 및 필터 상태만 즉시 동기화
      if (allLoadedUsers.length > 0) {
        applyUserFiltersAndRender(false);
        applySmsUserFiltersAndRender(false);
      }

      // 성능 최적화: roles onSnapshot 콜백에서 loadUsers() 자동 호출 제거
      // 등급 목록이 바뀔 때마다 users 컬렉션을 재조회하면 불필요한 Firestore 읽기가 발생합니다.
      // 탭 클릭 시에만 loadUsers()를 호출합니다.
    }, (error) => {
      console.error("Roles subscription error:", error);
      if (roleList) {
        roleList.innerHTML = `<tr><td colspan="14" class="table-error" style="color:#fda4af; text-align:center; padding:1.5rem; background:rgba(244,63,94,0.05); border-radius:8px;">등급 정보를 불러올 수 없습니다. (Firestore 보안 규칙 배포 확인 필요)</td></tr>`;
      }
    });
  }


  // 가입 회원 상세 정보를 메모리에 보관하여 상세보기 모달에 전달하기 위한 맵 객체
  let loadedUsersMap = {};

  /**
   * 가입 회원 상세 정보 모달 표시 함수 (Firestore Timestamp 및 일반 날짜 포맷 안전 처리)
   * @param {Object} userData - 가입 회원의 12가지 상세 프로필 객체
   */
  function showUserDetailModal(userData) {
    try {
      const modal = document.getElementById("user-detail-modal");
      const content = document.getElementById("user-detail-content");
      if (!modal || !content) return;

      // 회원의 국가/선호언어 매핑 (countryLanguage, country, lang 필드 순차 호환 조회)
      const userLangKey = (userData.countryLanguage || userData.country || userData.lang || "").toLowerCase();
      const matchedCountry = SUPPORTED_COUNTRY_LANGS[userLangKey];
      const countryLangDisplay = matchedCountry 
        ? `${matchedCountry.flag} ${matchedCountry.label}` 
        : (userData.countryLanguage || userData.country || userData.lang || "-");

      let regDate = "-";
      if (userData.createdAt) {
        // Firestore Timestamp 객체, Date 객체, 숫자/문자열 날짜 형식 유연 지원
        let d = null;
        if (typeof userData.createdAt.toDate === "function") {
          d = userData.createdAt.toDate();
        } else if (userData.createdAt.seconds) {
          d = new Date(userData.createdAt.seconds * 1000);
        } else {
          d = new Date(userData.createdAt);
        }
        regDate = (d && !isNaN(d.getTime())) ? d.toLocaleString("ko-KR") : "-";
      }

      content.innerHTML = `
        <div class="detail-item">
          <div class="detail-label">아이디 (ID)</div>
          <div class="detail-value">${escapeHtml(userData.loginId || userData.id || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">이메일 (Email)</div>
          <div class="detail-value">${escapeHtml(userData.email || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">이름 (여권 영문 성명)</div>
          <div class="detail-value">${escapeHtml(userData.name || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">국가 (선호언어)</div>
          <div class="detail-value">${escapeHtml(countryLangDisplay)}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">생년월일</div>
          <div class="detail-value">${escapeHtml(userData.dob || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">외국인등록번호(주민번호)</div>
          <div class="detail-value">${escapeHtml(userData.alienNo || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">연락처</div>
          <div class="detail-value">${escapeHtml(userData.phone || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">비자 타입</div>
          <div class="detail-value">${escapeHtml(userData.visaType || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">체류(비자) 만료일</div>
          <div class="detail-value">${escapeHtml(userData.visaExpiry || "-")}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">현재 등급</div>
          <div class="detail-value">${escapeHtml(rolesCache[userData.role] || userData.role || "일반 회원")}</div>
        </div>
        <div class="detail-item detail-item-full">
          <div class="detail-label">현재 체류 주소</div>
          <div class="detail-value">${escapeHtml(userData.address || "-")}</div>
        </div>
        <div class="detail-item detail-item-full">
          <div class="detail-label">가입 일자</div>
          <div class="detail-value">${escapeHtml(regDate)}</div>
        </div>
      `;

      modal.style.display = "flex";
    } catch (error) {
      console.error("Show user detail modal failed:", error);
      alert("회원 상세 정보를 모달에 표시하는 중 오류가 발생했습니다.");
    }
  }

  // 모달 닫기 이벤트 핸들러 바인딩
  const btnCloseUserDetailModal = document.getElementById("btn-close-user-detail-modal");
  const userDetailModal = document.getElementById("user-detail-modal");
  if (btnCloseUserDetailModal && userDetailModal) {
    btnCloseUserDetailModal.addEventListener("click", () => {
      userDetailModal.style.display = "none";
    });
    userDetailModal.addEventListener("click", (e) => {
      if (e.target === userDetailModal) userDetailModal.style.display = "none";
    });
  }

  // Firestore에서 로드된 원본 전체 가입 회원 목록을 보관하여 추가 읽기 비용 없이 즉시 필터링하기 위한 메모리 배열
  let allLoadedUsers = [];
  // 현재 조회된 필터링 회원 목록 캐시 저장 변수
  let cachedFilteredUsers = [];

  /**
   * 등급별 보기 드롭다운 옵션을 등록된 등급 및 실제 회원 등급 데이터를 통합하여 구성하는 공용 헬퍼
   */
  function buildRoleFilterOptions(selectEl, activeFilter, storageKey) {
    if (!selectEl) return activeFilter;

    const mergedRoleMap = new Map();
    if (Object.keys(rolesCache).length > 0) {
      Object.entries(rolesCache).forEach(([roleKey, roleLabel]) => {
        mergedRoleMap.set(roleKey, roleLabel);
      });
    } else {
      defaultRoles.forEach((r) => {
        mergedRoleMap.set(r.key, r.label);
      });
    }

    allLoadedUsers.forEach((u) => {
      const rKey = u.role || "user";
      if (!mergedRoleMap.has(rKey)) {
        const fallbackRole = defaultRoles.find((dr) => dr.key === rKey);
        mergedRoleMap.set(rKey, fallbackRole ? fallbackRole.label : `${rKey} (미등록)`);
      }
    });

    let nextFilter = activeFilter;
    if (nextFilter !== "all" && !mergedRoleMap.has(nextFilter)) {
      nextFilter = "all";
      localStorage.setItem(storageKey, "all");
    }

    let filterHTML = `<option value="all" ${nextFilter === "all" ? "selected" : ""}>등급별 보기 (전체)</option>`;
    mergedRoleMap.forEach((roleLabel, roleKey) => {
      const safeKey = escapeHtml(roleKey);
      const isSelected = nextFilter === roleKey ? "selected" : "";
      filterHTML += `<option value="${safeKey}" ${isSelected}>${escapeHtml(roleLabel)} 보기</option>`;
    });

    selectEl.innerHTML = filterHTML;
    selectEl.value = nextFilter;
    return nextFilter;
  }

  function buildUserRoleFilterOptions() {
    const selectRoleFilterEl = document.getElementById("select-role-filter");
    currentRoleFilter = buildRoleFilterOptions(selectRoleFilterEl, currentRoleFilter, "admin_user_role_filter");
  }

  /**
   * 메모리에 로드된 전체 회원 배열(allLoadedUsers)을 대상으로 국가 타일, 등급별 보기 및 회원 이름 검색 조건을 복합 필터링하여 렌더링하는 함수
   * @param {boolean} resetPage - 필터 또는 검색 조건 변경 시 1페이지로 초기화할지 여부
   */
  function applyUserFiltersAndRender(resetPage = false) {
    if (resetPage) {
      currentUserPage = 1;
    }

    let filtered = allLoadedUsers;

    // 1. 상단 국가(선호언어) 타일 선택 필터 적용 ('all'이 아닌 경우 클릭한 국가의 회원만 추출)
    if (currentUserLangFilter !== "all") {
      filtered = filtered.filter((user) => normalizeUserLangKey(user) === currentUserLangFilter);
    }

    // 2. 등급별 보기 필터 적용 (role 필드가 비어 있는 초기 가입 계정은 일반 회원 'user'로 매칭)
    if (currentRoleFilter !== "all") {
      filtered = filtered.filter((user) => (user.role || "user") === currentRoleFilter);
    }

    // 3. 회원 이름 검색어 부분 일치 필터 적용 (대소문자 및 띄어쓰기 유무 모두 유연하게 매칭)
    if (currentUserSearchQuery) {
      const normalizedQuery = currentUserSearchQuery.toLowerCase();
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      filtered = filtered.filter((user) => {
        const rawName = String(user.name || "").toLowerCase();
        const compactName = rawName.replace(/\s+/g, "");
        return rawName.includes(normalizedQuery) || (compactQuery.length > 0 && compactName.includes(compactQuery));
      });
    }

    cachedFilteredUsers = filtered;
    renderUsersPage(cachedFilteredUsers);
  }

  /**
   * 회원 목록 페이지네이션 컨트롤러 렌더링 함수
   * @param {number} totalItems - 전체 회원 수
   * @param {number} itemsPerPage - 페이지당 노출 개수
   * @param {number} currentPage - 현재 선택된 페이지 번호
   * @param {function} onPageChange - 페이지 변경 시 호출되는 콜백 함수
   */
  function renderUsersPagination(totalItems, itemsPerPage, currentPage, onPageChange) {
    renderPaginationControls(usersPagination, {
      totalItems,
      itemsPerPage,
      currentPage,
      infoPrefix: "전체",
      onPageChange
    });
  }

  /**
   * 현재 페이지에 해당하는 회원 목록 슬라이스 및 테이블 렌더링 함수
   * @param {Array} usersToRender - 필터링된 전체 회원 데이터 배열
   */
  function renderUsersPage(usersToRender) {
    if (!userList) return;

    userList.innerHTML = "";
    const totalUsers = usersToRender.length;

    if (totalUsers === 0) {
      // 전체 가입 회원이 0명인 경우와 국가/등급/이름 검색 필터 결과가 0명인 경우를 구분하여 안내 문구 노출
      const emptyMessage = allLoadedUsers.length > 0
        ? "선택한 국가, 등급 또는 이름 검색 조건에 일치하는 회원이 없습니다."
        : "가입된 회원이 없습니다.";
      userList.innerHTML = `<tr><td colspan="9" class="table-empty">${emptyMessage}</td></tr>`;
      if (usersPagination) usersPagination.innerHTML = "";
      return;
    }

    // 현재 페이지 번호 유효 범위 자동 보정
    const totalPages = Math.ceil(totalUsers / currentLimitUsers) || 1;
    if (currentUserPage > totalPages) currentUserPage = totalPages;
    if (currentUserPage < 1) currentUserPage = 1;

    const startIndex = (currentUserPage - 1) * currentLimitUsers;
    const endIndex = startIndex + currentLimitUsers;
    const pageUsers = usersToRender.slice(startIndex, endIndex);

    // 3가지 관리자 등급(super_admin, admin, admin_user) 계정의 국가(선호언어) 수정 권한 확인
    const canEditCountryLang = ["super_admin", "admin", "admin_user"].includes(currentLoginUserRole);

    pageUsers.forEach((userData) => {
      const userId = userData.id;
      const tr = document.createElement("tr");

      let registerDate = "-";
      if (userData.createdAt) {
        // Timestamp 객체 및 일반 Date 포맷 안전 변환
        let dateObj = null;
        if (typeof userData.createdAt.toDate === "function") {
          dateObj = userData.createdAt.toDate();
        } else if (userData.createdAt.seconds) {
          dateObj = new Date(userData.createdAt.seconds * 1000);
        } else {
          dateObj = new Date(userData.createdAt);
        }
        registerDate = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric"
        }) : "-";
      }

      const currentRoleLabel = rolesCache[userData.role] || userData.role || "일반 회원";

      const isSuperAdmin = currentLoginUserRole === "super_admin";
      const isSelf = auth.currentUser && auth.currentUser.uid === userId;
      const isDisabled = (!isSuperAdmin || isSelf) ? "disabled" : "";

      let selectOptionsHTML = "";
      let roleExistsInCache = false;

      Object.entries(rolesCache).forEach(([roleKey, roleLabel]) => {
        const isSelected = userData.role === roleKey ? "selected" : "";
        if (userData.role === roleKey) roleExistsInCache = true;
        selectOptionsHTML += `<option value="${roleKey}" ${isSelected}>${roleLabel}</option>`;
      });

      if (userData.role && !roleExistsInCache) {
        selectOptionsHTML += `<option value="${userData.role}" selected>${userData.role} (미등록)</option>`;
      }

      const safeUserId = escapeHtml(userId);
      const safeRoleCode = escapeHtml(userData.role || "user");
      const roleControlHTML = `
        <div class="role-control-wrapper">
          <select class="select-role" id="select-role-${safeUserId}" ${isDisabled}>
            ${selectOptionsHTML}
          </select>
          <button class="btn-action confirm btn-update-role" data-uid="${safeUserId}" ${isDisabled}>변경</button>
        </div>
      `;

      // 회원의 기존 국가(선호언어) 키 식별 (상단 통계 타일 및 필터링 함수와 100% 동일한 정규화 함수 사용)
      const userLangKey = normalizeUserLangKey(userData);
      const matchedLangInfo = SUPPORTED_COUNTRY_LANGS[userLangKey];
      const countryLangDisplay = matchedLangInfo ? `${matchedLangInfo.flag} ${matchedLangInfo.label}` : (userData.countryLanguage ? `🌐 ${escapeHtml(userData.countryLanguage)}` : "-");

      // 3가지 관리자 등급 계정에서는 15개국 선택 드롭다운과 변경 버튼을 렌더링하고, 비관리자는 읽기 전용 텍스트 노출
      let countryLangControlHTML = "";
      if (canEditCountryLang) {
        let langOptionsHTML = "";
        let langFoundInList = false;
        Object.entries(SUPPORTED_COUNTRY_LANGS).forEach(([lCode, lData]) => {
          const isSelected = (userLangKey === lCode) ? "selected" : "";
          if (userLangKey === lCode) langFoundInList = true;
          langOptionsHTML += `<option value="${lCode}" ${isSelected}>${lData.flag} ${lData.label}</option>`;
        });
        if (userData.countryLanguage && !langFoundInList) {
          langOptionsHTML += `<option value="${escapeHtml(userData.countryLanguage)}" selected>🌐 ${escapeHtml(userData.countryLanguage)} (기타)</option>`;
        }
        countryLangControlHTML = `
          <div class="role-control-wrapper lang-control-wrapper">
            <select class="select-role select-country-lang" id="select-lang-${safeUserId}">
              ${langOptionsHTML}
            </select>
            <button class="btn-action confirm btn-update-user-lang" data-uid="${safeUserId}">변경</button>
          </div>
        `;
      } else {
        countryLangControlHTML = `<span>${escapeHtml(countryLangDisplay)}</span>`;
      }

      tr.innerHTML = `
        <td class="col-user-country-lang">${countryLangControlHTML}</td>
        <td class="font-bold">${escapeHtml(userData.name || "-")}</td>
        <td>${escapeHtml(userData.phone || "-")}</td>
        <td>${escapeHtml(userData.email || "-")}</td>
        <td>${escapeHtml(registerDate)}</td>
        <td><span class="role-badge ${safeRoleCode}">${escapeHtml(currentRoleLabel)}</span></td>
        <td>${roleControlHTML}</td>
        <td>
          <button class="btn-user-detail" data-uid="${safeUserId}">상세보기</button>
        </td>
        <td>
          <button class="btn-user-delete" data-uid="${safeUserId}" ${isDisabled}>삭제</button>
        </td>
      `;

      userList.appendChild(tr);
    });

    // 페이지네이션 바 컨트롤러 렌더링
    renderUsersPagination(totalUsers, currentLimitUsers, currentUserPage, (newPage) => {
      currentUserPage = newPage;
      renderUsersPage(usersToRender);
    });
  }

  /**
   * 가입 회원 전체 및 15개 지원 국가(선호언어)별 회원수 통계 타일 렌더링 함수
   * 예약내역 섹션과 100% 동일한 타일 디자인(클래스 및 테두리 색상)을 적용하며, 한국어 왼쪽에 '전체회원수'를 배치합니다.
   * @param {Array} allUsers - 가입 회원 전체 데이터 객체 배열
   */
  function renderUserLangStats(allUsers = []) {
    const userLangStatsContainer = document.getElementById("admin-user-lang-stats");
    if (!userLangStatsContainer) return;

    // 전체 가입 회원 수 집계
    const totalCount = allUsers.length;

    // 15개 공식 지원 언어별 카운트 초기화 객체
    const langCounts = {
      ko: 0, ja: 0, vi: 0, en: 0, zh: 0, ru: 0, my: 0, km: 0, mn: 0, th: 0, lo: 0, ne: 0, id: 0, si: 0, bn: 0
    };

    // 전체 가입 회원의 국가(선호언어) 데이터를 공통 정규화 함수로 분석하여 인원수 집계
    allUsers.forEach((user) => {
      const lKey = normalizeUserLangKey(user);
      if (langCounts[lKey] !== undefined) {
        langCounts[lKey]++;
      } else {
        langCounts.ko++;
      }
    });

    // 공통 LANG_STYLE_MAP을 사용하여 15개국 회원수 타일 렌더링
    const isAllActive = currentUserLangFilter === "all" ? "active" : "";
    let html = `
      <div class="lang-stat-tile ${isAllActive}" data-user-lang="all" title="전체 회원 보기" style="--tile-accent: #00f3ff; color: #00f3ff; border-color: rgba(0, 243, 255, 0.2);">
        <span class="lang-tile-title" style="color: #00f3ff; font-weight: 700;">👥 전체회원수</span>
        <span class="lang-tile-value" style="color: #00f3ff; font-weight: 800;">${totalCount}<small>명</small></span>
      </div>
    `;

    // 2. 15개 지원 국가(선호언어)별 회원수 타일을 순서대로 결합 (클릭 시 해당 국가 회원만 필터링되도록 data-user-lang 부여)
    Object.entries(LANG_STYLE_MAP).forEach(([key, cfg]) => {
      const count = langCounts[key] || 0;
      const isTileActive = currentUserLangFilter === key ? "active" : "";
      html += `
        <div class="lang-stat-tile ${isTileActive}" data-user-lang="${key}" title="${cfg.label} 회원만 보기 (다시 클릭 시 전체 보기)" style="--tile-accent: ${cfg.color}; color: ${cfg.color}; border-color: ${cfg.border};">
          <span class="lang-tile-title" style="color: ${cfg.color};">${cfg.flag} ${cfg.label}</span>
          <span class="lang-tile-value" style="color: ${cfg.color};">${count}<small>명</small></span>
        </div>
      `;
    });

    // 완성된 16개 타일 HTML을 컨테이너에 주입
    userLangStatsContainer.innerHTML = html;
  }

  // 가입 회원 목록 로드 및 동적 옵션 바인딩
  async function loadUsers(resetPage = false) {
    if (!userList) return;
    
    if (resetPage) {
      currentUserPage = 1;
    }

    if (!userList.children || userList.children.length === 0 || userList.innerHTML.includes("table-loading")) {
      userList.innerHTML = `<tr><td colspan="9" class="table-loading">회원 데이터를 불러오는 중입니다...</td></tr>`;
    }

    if (Object.keys(rolesCache).length === 0) {
      try {
        const rolesCol = collection(db, "roles");
        const rolesSnap = await getDocs(rolesCol);
        rolesSnap.forEach((docSnap) => {
          rolesCache[docSnap.id] = docSnap.data().label;
        });
      } catch (e) {
        console.error("Fallback roles loading failed in loadUsers:", e);
      }
      // DB 조회 결과가 비어 있거나 권한 제약 시 기본 등급 정의로 캐시 보완
      if (Object.keys(rolesCache).length === 0) {
        defaultRoles.forEach((r) => {
          rolesCache[r.key] = r.label;
        });
      }
    }

    try {
      const userQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(500));
      const querySnapshot = await getDocs(userQuery);

      loadedUsersMap = {};

      // Firestore 데이터 내부에 id 필드가 존재하더라도 docSnap.id(문서 식별자)가 덮어씌워지지 않도록 정합성 보장
      let rawUsers = [];
      querySnapshot.forEach((docSnap) => {
        const uData = { ...docSnap.data(), id: docSnap.id, uid: docSnap.id };
        rawUsers.push(uData);
        loadedUsersMap[docSnap.id] = uData;
      });

      // 메모리 캐시 배열에 원본 전체 가입 회원 저장 (이후 등급 필터/이름 검색/노출 개수 변경 시 DB 재조회 비용 0원)
      allLoadedUsers = rawUsers;

      // 등급별 보기 드롭다운 옵션 최신화 (회원 리스트 탭 및 문자발송 탭 동시 반영)
      buildUserRoleFilterOptions();
      buildSmsRoleFilterOptions();

      // 가입 회원 전체 국가(선호언어)별 및 전체회원수 통계 타일은 필터와 무관하게 전체 회원 기준으로 렌더링
      renderUserLangStats(allLoadedUsers);
      renderSmsLangStats(allLoadedUsers);

      // 현재 선택된 등급 필터 및 회원 이름 검색 조건을 반영하여 페이지 렌더링
      applyUserFiltersAndRender(resetPage);
      applySmsUserFiltersAndRender(resetPage);

    } catch (error) {
      console.error("Load users failed:", error);
      userList.innerHTML = `<tr><td colspan="9" class="table-empty">회원 데이터를 로드하지 못했습니다. (권한 오류 등)</td></tr>`;
      if (usersPagination) usersPagination.innerHTML = "";
      if (smsUserList) {
        smsUserList.innerHTML = `<tr><td colspan="7" class="table-empty">회원 데이터를 로드하지 못했습니다. (권한 오류 등)</td></tr>`;
      }
      if (smsUsersPagination) smsUsersPagination.innerHTML = "";
    }
  }

  /**
   * 가입 회원 프로필 데이터 Firestore DB 완전 삭제 함수
   * @param {string} targetUid - 삭제 대상 사용자의 UID
   */
  async function deleteUserAccount(targetUid) {
    if (currentLoginUserRole !== "super_admin") {
      alert("회원 삭제 권한이 없습니다. (최고 관리자 전용 기능)");
      return;
    }

    try {
      const userDocRef = doc(db, "users", targetUid);
      await deleteDoc(userDocRef);
      
      if (typeof window.clearUserRoleCache === "function") {
        window.clearUserRoleCache(targetUid);
      }
      
      alert("회원 데이터가 성공적으로 삭제되었습니다.");
      loadUsers();
    } catch (error) {
      console.error("User deletion failed:", error);
      alert("회원 데이터 삭제 중 오류가 발생했습니다: " + error.message);
    }
  }

  /**
   * 회원 국가(선호언어) 변경 처리 함수 (3가지 관리자 등급: super_admin, admin, admin_user 계정 전용)
   * @param {string} targetUid - 대상 회원의 고유 UID
   * @param {string} newLang - 변경할 15개 지원 국가(선호언어) 코드 (예: ko, ja, vi 등)
   */
  async function updateUserCountryLanguage(targetUid, newLang) {
    // 3가지 관리자 등급 권한 유효성 검사
    const allowedAdminRoles = ["super_admin", "admin", "admin_user"];
    if (!allowedAdminRoles.includes(currentLoginUserRole)) {
      alert("회원 국가(선호언어) 변경 권한이 없습니다. (관리자 전용 기능)");
      return;
    }

    try {
      const userDocRef = doc(db, "users", targetUid);
      // countryLanguage 필드와 하위 호환 필드(country, lang) 및 수정 시간 동시 기록
      await updateDoc(userDocRef, {
        countryLanguage: newLang,
        country: newLang,
        lang: newLang,
        updatedAt: serverTimestamp()
      });

      // 로컬 메모리 캐시 최신화
      if (loadedUsersMap && loadedUsersMap[targetUid]) {
        loadedUsersMap[targetUid].countryLanguage = newLang;
        loadedUsersMap[targetUid].country = newLang;
        loadedUsersMap[targetUid].lang = newLang;
      }

      alert("회원의 국가(선호언어)가 정상적으로 수정되었습니다.");
      loadUsers(); // 목록 새로고침
    } catch (error) {
      console.error("Update user country language failed:", error);
      alert("국가(선호언어) 수정 중 오류가 발생했습니다: " + error.message);
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
      
      // 역할 변경 시 세션 스토리지 캐시를 즉각 삭제하여 변경된 권한이 실시간 반영되도록 보장
      try {
        sessionStorage.removeItem(`user_role_cache_${targetUid}`);
        sessionStorage.removeItem(`admin_permissions_${targetUid}`);
        sessionStorage.removeItem(`admin_permissions_cache_${targetUid}`);
        sessionStorage.removeItem(`role_permissions_cache_${newRole}`);
      } catch (cErr) { }

      if (typeof window.clearUserRoleCache === "function") {
        window.clearUserRoleCache(targetUid);
      }

      // 실시간 정합성: 만약 등급이 바뀐 대상이 본인인 경우 권한 즉시 재반영
      if (auth.currentUser && auth.currentUser.uid === targetUid) {
        await verifyAndApplyPermissions(auth.currentUser, true);
      }
      
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
      loadUsers(true); // 새로고침 시 1페이지로 리셋
    });
  }

  // 회원 리스트 상단 국가(선호언어) 통계 타일 클릭 시 해당 국가 회원만 리스트에 표시하는 이벤트 위임 바인딩
  const userLangStatsEl = document.getElementById("admin-user-lang-stats");
  if (userLangStatsEl) {
    userLangStatsEl.addEventListener("click", (e) => {
      const clickedTile = e.target.closest(".lang-stat-tile[data-user-lang]");
      if (!clickedTile) return;

      const selectedLang = clickedTile.getAttribute("data-user-lang") || "all";

      // '전체회원수' 타일을 클릭했거나 이미 활성화된 국가 타일을 다시 클릭한 경우 전체 회원 보기로 복원
      if (selectedLang === "all" || currentUserLangFilter === selectedLang) {
        currentUserLangFilter = "all";
      } else {
        currentUserLangFilter = selectedLang;
      }

      // 상단 타일들의 선택 강조(.active) 클래스 즉시 갱신
      userLangStatsEl.querySelectorAll(".lang-stat-tile[data-user-lang]").forEach((tile) => {
        const tileLang = tile.getAttribute("data-user-lang");
        tile.classList.toggle("active", tileLang === currentUserLangFilter);
      });

      // 메모리 캐시를 활용하여 DB 추가 읽기 비용 없이 1페이지부터 즉시 필터링 렌더링 수행
      if (allLoadedUsers.length > 0) {
        applyUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 회원 개수 제한 필터: 드롭다운 select 요소 바인딩 및 초기값 로컬스토리지 동기화 (메모리 캐시 기반 즉시 재렌더링)
  const selectLimitUsers = document.getElementById("select-limit-users");
  if (selectLimitUsers) {
    // 저장된 수치가 있으면 드롭다운 초기값으로 자동 적용
    selectLimitUsers.value = currentLimitUsers.toString();
    
    selectLimitUsers.addEventListener("change", (e) => {
      currentLimitUsers = parseInt(e.target.value, 10);
      localStorage.setItem("admin_user_limit", currentLimitUsers.toString());
      if (allLoadedUsers.length > 0) {
        applyUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 회원 등급별 보기 필터: 초기 옵션 구성 및 선택 변경 시 메모리 기반 즉시 필터링
  const selectRoleFilter = document.getElementById("select-role-filter");
  if (selectRoleFilter) {
    buildUserRoleFilterOptions();
    selectRoleFilter.addEventListener("change", (e) => {
      currentRoleFilter = e.target.value;
      localStorage.setItem("admin_user_role_filter", currentRoleFilter);
      if (allLoadedUsers.length > 0) {
        applyUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 회원 이름 검색창 및 검색 버튼 이벤트 바인딩 (검색 버튼 클릭, Enter 키 입력, 입력창 비움 시 즉시 복원 지원)
  const inputSearchUsers = document.getElementById("input-search-users");
  const btnSearchUsers = document.getElementById("btn-search-users");

  function executeUserNameSearch() {
    if (!inputSearchUsers) return;
    currentUserSearchQuery = inputSearchUsers.value.trim();
    if (allLoadedUsers.length > 0) {
      applyUserFiltersAndRender(true);
    } else {
      loadUsers(true);
    }
  }

  if (inputSearchUsers) {
    inputSearchUsers.value = currentUserSearchQuery;

    // 검색어 입력 후 Enter 키를 누르면 즉시 이름 검색 실행
    inputSearchUsers.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeUserNameSearch();
      }
    });

    // 검색창의 글자를 모두 지웠을 때 버튼을 다시 누르지 않아도 전체 목록이 즉시 복원되도록 처리
    inputSearchUsers.addEventListener("input", () => {
      if (inputSearchUsers.value.trim() === "" && currentUserSearchQuery !== "") {
        currentUserSearchQuery = "";
        if (allLoadedUsers.length > 0) {
          applyUserFiltersAndRender(true);
        }
      }
    });
  }

  if (btnSearchUsers) {
    btnSearchUsers.addEventListener("click", () => {
      executeUserNameSearch();
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
          isAdmin: false,
          hasReservations: false,
          hasClinics: false,
          hasAds: false,
          hasPartners: false,
          hasRoles: false,
          hasInterpreters: false,
          hasPermissions: false,
          hasSms: false,
          hasStats: false,
          hasCommunitySettings: false,
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

  // 알림톡 수신 번호 개별/다중 추가 처리 핸들러 - 기존 저장된 목록에 누적하여 추가
  const solapiSettingsForm = document.getElementById("solapi-settings-form");
  if (solapiSettingsForm) {
    solapiSettingsForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      if (currentLoginUserRole !== "super_admin") {
        alert("설정 변경 권한이 없습니다. 최고 관리자 권한이 필요합니다.");
        return;
      }

      const phonesInputElement = document.getElementById("solapi-admin-phones");
      const phonesInput = phonesInputElement ? phonesInputElement.value.trim() : "";
      if (!phonesInput) {
        alert("추가할 수신 번호를 하나 이상 입력해 주세요.");
        return;
      }

      // 쉼표로 분할하고 숫자만 남기는 전처리 수행
      const newPhonesArray = phonesInput.split(",")
        .map(p => p.replace(/[^0-9]/g, ""))
        .filter(p => p !== "");

      if (newPhonesArray.length === 0) {
        alert("올바른 형태의 전화번호를 입력해 주세요.");
        return;
      }

      const btnSubmit = solapiSettingsForm.querySelector("button[type='submit']");
      btnSubmit.disabled = true;
      btnSubmit.textContent = "추가 중...";

      try {
        // 기존 Firestore에 저장되어 있는 알림톡 수신 번호 목록 불러오기
        const solapiDocRef = doc(db, "settings", "solapi");
        const solapiDocSnap = await getDoc(solapiDocRef);
        let existingPhones = [];
        if (solapiDocSnap.exists() && Array.isArray(solapiDocSnap.data().adminPhones)) {
          existingPhones = solapiDocSnap.data().adminPhones;
        }

        // 기존 번호 목록에 신규 입력 번호 병합 및 중복 번호 제거
        const mergedPhones = Array.from(new Set([...existingPhones, ...newPhonesArray]));

        // 새로 추가된 번호가 없는 경우 (이미 모두 존재하는 번호일 때)
        const addedCount = mergedPhones.length - existingPhones.length;
        if (addedCount === 0) {
          alert("입력하신 번호는 이미 수신 번호 목록에 모두 등록되어 있습니다.");
          if (phonesInputElement) phonesInputElement.value = "";
          return;
        }

        await setDoc(solapiDocRef, {
          adminPhones: mergedPhones,
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser ? auth.currentUser.uid : "unknown"
        });
        
        alert(`${addedCount}개의 수신 번호가 성공적으로 추가되었습니다.`);
        if (phonesInputElement) phonesInputElement.value = "";
        loadSolapiSettings(); // 저장 성공 후 화면의 번호 리스트 목록 리프레시 수행]
      } catch (error) {
        console.error("Save Solapi settings failed:", error);
        alert("수신 번호 추가에 실패했습니다: " + error.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "수신 번호 추가";
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
              등급 키 (ID): <strong style="color:#ffffff; font-family:monospace; background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:4px;">${escapeHtml(roleKey)}</strong>
            </p>
            <label style="display:block; color:#c7d2fe; font-size:0.82rem; margin-bottom:6px; font-weight:600;">새로운 표시 이름 *</label>
            <input id="edit-role-label-input" type="text" value="${escapeHtml(curLabel)}"
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
          // 1. [성능 최적화] 가입 회원 전체를 로드하지 않고 삭제되는 등급(roleKey)을 지닌 회원만 필터링 쿼리하여 Firestore 요금 및 지연 시간 방지
          const usersCol = collection(db, "users");
          const q = query(usersCol, where("role", "==", roleKey));
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
          
          // 세션 상에 캐시된 해당 등급의 권한 캐시를 즉각 삭제하여 변경 사항 즉시 반영
          try {
            sessionStorage.removeItem(`role_permissions_cache_${roleKey}`);
          } catch (cErr) { }

          // 실시간 정합성: 최고 관리자가 권한 설정을 변경했으므로 본인의 권한 캐시를 최신화하여 UI 탭 상태 즉각 동기화
          if (auth.currentUser) {
            await verifyAndApplyPermissions(auth.currentUser, true);
          }
        } catch (error) {
          console.error("Toggle permission update failed:", error);
          alert("권한 설정을 업데이트하지 못했습니다: " + error.message);
          e.target.checked = !isChecked; // 원래 상태로 롤백
        }
      }
    });
  }

  // 회원 테이블 이벤트 바인딩 (등급 변경 및 상세보기 버튼 클릭 위임 처리)
  if (userList) {
    userList.addEventListener("click", async (e) => {
      // 1. 상세보기 버튼 클릭 처리 (e.target.closest를 활용해 캡처 안정성 확보 및 Fallback 조회 추가)
      const detailBtn = e.target.closest(".btn-user-detail");
      if (detailBtn) {
        const uid = detailBtn.getAttribute("data-uid");
        if (uid) {
          if (loadedUsersMap[uid]) {
            showUserDetailModal(loadedUsersMap[uid]);
          } else {
            // 메모리 맵에 해당 회원 정보가 없는 경우 Firestore 직접 조회를 통한 Fallback 보장
            try {
              const userDocRef = doc(db, "users", uid);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const fetchedUserData = { ...userDocSnap.data(), id: userDocSnap.id, uid: userDocSnap.id };
                loadedUsersMap[uid] = fetchedUserData;
                showUserDetailModal(fetchedUserData);
              } else {
                alert("해당 회원의 상세 정보 데이터를 찾을 수 없습니다.");
              }
            } catch (fallbackError) {
              console.error("Fallback load user detail failed:", fallbackError);
              alert("회원 상세 정보를 불러오는 중 오류가 발생했습니다.");
            }
          }
        }
      }

      // 2. 국가(선호언어) 변경 버튼 클릭 처리 (3가지 관리자 등급 전용)
      if (e.target.classList.contains("btn-update-user-lang")) {
        const targetUid = e.target.getAttribute("data-uid");
        const selectBox = document.getElementById(`select-lang-${targetUid}`);
        if (selectBox) {
          const newLang = selectBox.value;
          const targetLangLabel = SUPPORTED_COUNTRY_LANGS[newLang] 
            ? `${SUPPORTED_COUNTRY_LANGS[newLang].flag} ${SUPPORTED_COUNTRY_LANGS[newLang].label}` 
            : newLang;
          if (confirm(`해당 회원의 국가(선호언어)를 '${targetLangLabel}'(으)로 변경하시겠습니까?`)) {
            const originalText = e.target.textContent;
            e.target.disabled = true;
            e.target.textContent = "처리중...";
            await updateUserCountryLanguage(targetUid, newLang);
            e.target.disabled = false;
            e.target.textContent = originalText;
          }
        }
      }

      // 3. 등급 변경 버튼 클릭 처리
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

      // 3. 회원 삭제 버튼 클릭 처리
      if (e.target.classList.contains("btn-user-delete")) {
        const targetUid = e.target.getAttribute("data-uid");
        if (targetUid) {
          if (confirm("해당 회원의 데이터를 Firestore DB에서 완전히 삭제하시겠습니까?\n삭제된 회원 데이터는 복구할 수 없습니다.")) {
            e.target.disabled = true;
            e.target.textContent = "삭제중...";
            await deleteUserAccount(targetUid);
          }
        }
      }
    });
  }

  // =========================================================================
  // 가입 회원 대상 선택형 문자메시지(SMS/LMS) 발송 전용 모듈 (#content-sms)
  // =========================================================================

  // 체크박스로 선택된 발송 대상 회원의 고유 UID 집합 (페이지 이동 및 필터 변경 시에도 선택 상태 보존)
  const selectedSmsUserIds = new Set();
  // 문자발송 탭 상단 국가(선호언어) 통계 타일 클릭 필터 상태 변수 (기본값: "all" 전체 회원 보기)
  let currentSmsLangFilter = "all";
  // 문자발송 탭 등급별 보기 필터 상태 변수 (기본값: "all")
  let currentSmsRoleFilter = localStorage.getItem("admin_sms_role_filter") || "all";
  // 문자발송 탭 페이지당 노출 인원수 상태 변수 (기본값: 20개)
  let currentLimitSmsUsers = parseInt(localStorage.getItem("admin_sms_user_limit") || "20", 10);
  // 문자발송 탭 현재 페이지 번호
  let currentSmsUserPage = 1;
  // 문자발송 탭 이름/연락처 검색어 상태 변수
  let currentSmsSearchQuery = "";
  // 문자발송 탭 현재 필터링된 회원 목록 캐시 배열
  let cachedSmsFilteredUsers = [];

  /**
   * 전화번호 문자열에서 숫자만 추출하여 유효한 휴대폰/연락처 번호인지 검증하고 보기 좋은 포맷을 반환하는 헬퍼 함수
   * @param {string} rawPhone - 원본 전화번호 문자열
   * @returns {{ isValid: boolean, clean: string, formatted: string }}
   */
  function parseSmsUserPhone(rawPhone) {
    const clean = String(rawPhone || "").replace(/[^0-9]/g, "");
    if (!clean || clean.length < 9) {
      return { isValid: false, clean: "", formatted: "-" };
    }
    let formatted = clean;
    if (clean.length === 11) {
      formatted = `${clean.slice(0, 3)}-${clean.slice(3, 7)}-${clean.slice(7)}`;
    } else if (clean.length === 10) {
      formatted = `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
    }
    return { isValid: true, clean, formatted };
  }

  /**
   * 한글(2Byte) 및 영문/숫자/기호(1Byte) 기준의 통신사 표준 EUC-KR 문자 바이트 길이를 계산하는 함수
   * @param {string} text - 계산할 문자열
   * @returns {number} 총 바이트(Byte) 수
   */
  function calculateSmsByteLength(text) {
    const str = String(text || "");
    let byteLen = 0;
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // ASCII 범위(0~127)는 1Byte, 한글 및 다국어 문자는 2Byte로 집계
      byteLen += (charCode <= 0x007f) ? 1 : 2;
    }
    return byteLen;
  }

  /**
   * 문자발송 탭 상단 '등급별 보기' 드롭다운 옵션을 공용 헬퍼로 갱신하는 함수
   */
  function buildSmsRoleFilterOptions() {
    const selectSmsRoleEl = document.getElementById("select-sms-role-filter");
    currentSmsRoleFilter = buildRoleFilterOptions(selectSmsRoleEl, currentSmsRoleFilter, "admin_sms_role_filter");
  }

  /**
   * 문자발송 탭 상단 15개 지원 국가(선호언어)별 및 전체회원수 통계 타일 렌더링 함수
   * @param {Array} allUsers - 가입 회원 전체 데이터 배열
   */
  function renderSmsLangStats(allUsers = []) {
    const smsLangStatsContainer = document.getElementById("admin-sms-lang-stats");
    if (!smsLangStatsContainer) return;

    const totalCount = allUsers.length;
    const langCounts = {
      ko: 0, ja: 0, vi: 0, en: 0, zh: 0, ru: 0, my: 0, km: 0, mn: 0, th: 0, lo: 0, ne: 0, id: 0, si: 0, bn: 0
    };

    allUsers.forEach((user) => {
      const lKey = normalizeUserLangKey(user);
      if (langCounts[lKey] !== undefined) {
        langCounts[lKey]++;
      } else {
        langCounts.ko++;
      }
    });

    // 한국어 왼쪽에 '전체회원수' 타일을 먼저 추가하고 공통 LANG_STYLE_MAP으로 15개국 타일 생성
    const isAllActive = currentSmsLangFilter === "all" ? "active" : "";
    let html = `
      <div class="lang-stat-tile ${isAllActive}" data-sms-lang="all" title="전체 회원 보기" style="--tile-accent: #00f3ff; color: #00f3ff; border-color: rgba(0, 243, 255, 0.2);">
        <span class="lang-tile-title" style="color: #00f3ff; font-weight: 700;">👥 전체회원수</span>
        <span class="lang-tile-value" style="color: #00f3ff; font-weight: 800;">${totalCount}<small>명</small></span>
      </div>
    `;

    Object.entries(LANG_STYLE_MAP).forEach(([key, cfg]) => {
      const count = langCounts[key] || 0;
      const isTileActive = currentSmsLangFilter === key ? "active" : "";
      html += `
        <div class="lang-stat-tile ${isTileActive}" data-sms-lang="${key}" title="${cfg.label} 회원만 보기 (다시 클릭 시 전체 보기)" style="--tile-accent: ${cfg.color}; color: ${cfg.color}; border-color: ${cfg.border};">
          <span class="lang-tile-title" style="color: ${cfg.color};">${cfg.flag} ${cfg.label}</span>
          <span class="lang-tile-value" style="color: ${cfg.color};">${count}<small>명</small></span>
        </div>
      `;
    });

    smsLangStatsContainer.innerHTML = html;
  }

  /**
   * 체크된 수신 대상자 변경 시 상단 선택 배지, 선택된 수신자 칩 목록, 테이블 요약 배지, 발송 버튼 문구를 실시간 동기화하는 함수
   */
  function updateSmsSelectionUI() {
    // 현재까지 로드된 회원 중 실제로 존재하는 유효 회원의 선택만 유지
    const selectedUsers = [];
    selectedSmsUserIds.forEach((uid) => {
      const u = loadedUsersMap[uid];
      if (u && parseSmsUserPhone(u.phone).isValid) {
        selectedUsers.push(u);
      } else if (Object.keys(loadedUsersMap).length > 0 && !u) {
        selectedSmsUserIds.delete(uid);
      }
    });

    const selectedCount = selectedUsers.length;

    // 1. 상단 선택 인원 카운트 배지 업데이트
    const countBadge = document.getElementById("sms-selected-count-badge");
    if (countBadge) {
      countBadge.textContent = `${selectedCount}명 선택됨`;
    }

    // 2. 테이블 상단 조회/선택 요약 배지 업데이트 (선택된 언어 필터 라벨을 함께 표기하여 필터링 상태를 직관적으로 안내)
    const summaryBadge = document.getElementById("sms-table-summary-badge");
    if (summaryBadge) {
      const activeLangInfo = currentSmsLangFilter !== "all" ? SUPPORTED_COUNTRY_LANGS[currentSmsLangFilter] : null;
      const filterPrefix = activeLangInfo ? `${activeLangInfo.flag} ${activeLangInfo.label} 조회` : "전체 조회";
      summaryBadge.textContent = `${filterPrefix} ${cachedSmsFilteredUsers.length}명 · 선택 ${selectedCount}명`;
    }

    // 3. 우측 하단 발송 실행 버튼 텍스트 업데이트
    const btnSendMain = document.getElementById("btn-sms-send-submit");
    if (btnSendMain && !btnSendMain.dataset.sending) {
      btnSendMain.textContent = `📨 체크한 회원 문자 발송 (${selectedCount}명)`;
    }

    // 4. 선택된 회원 칩(Tag) 미리보기 리스트 업데이트
    const chipsContainer = document.getElementById("sms-selected-chips");
    if (chipsContainer) {
      if (selectedCount === 0) {
        chipsContainer.innerHTML = `
          <div class="sms-chips-empty">
            아래 회원 목록에서 국가(선호언어) 앞의 체크박스를 선택하면 이곳에 발송 대상자가 표시됩니다.
          </div>
        `;
      } else {
        chipsContainer.innerHTML = selectedUsers.map((u) => {
          const langKey = normalizeUserLangKey(u);
          const flag = SUPPORTED_COUNTRY_LANGS[langKey] ? SUPPORTED_COUNTRY_LANGS[langKey].flag : "🌐";
          const phoneInfo = parseSmsUserPhone(u.phone);
          const safeName = String(u.name || "회원").replace(/</g, "&lt;").replace(/>/g, "&gt;");
          return `
            <span class="sms-recipient-chip" data-uid="${u.id}">
              <span>${flag} ${safeName}</span>
              <span class="chip-phone">(${phoneInfo.formatted})</span>
              <button type="button" class="chip-remove" data-remove-uid="${u.id}" title="선택 해제">✕</button>
            </span>
          `;
        }).join("");
      }
    }
  }

  /**
   * 문자발송 탭의 필터 조건(국가 타일, 등급, 이름/연락처 검색어)을 적용하고 테이블을 렌더링하는 함수
   * @param {boolean} resetPage - 1페이지로 초기화할지 여부
   */
  function applySmsUserFiltersAndRender(resetPage = false) {
    if (resetPage) {
      currentSmsUserPage = 1;
    }

    let filtered = allLoadedUsers;

    // 1. 상단 국가(선호언어) 타일 선택 필터 적용
    if (currentSmsLangFilter !== "all") {
      filtered = filtered.filter((user) => normalizeUserLangKey(user) === currentSmsLangFilter);
    }

    // 2. 등급별 보기 필터 적용
    if (currentSmsRoleFilter !== "all") {
      filtered = filtered.filter((user) => (user.role || "user") === currentSmsRoleFilter);
    }

    // 3. 회원 이름 또는 연락처 부분 일치 검색 필터 적용
    if (currentSmsSearchQuery) {
      const normalizedQuery = currentSmsSearchQuery.toLowerCase();
      const compactQuery = normalizedQuery.replace(/\s+/g, "");
      const digitQuery = normalizedQuery.replace(/[^0-9]/g, "");

      filtered = filtered.filter((user) => {
        const rawName = String(user.name || "").toLowerCase();
        const compactName = rawName.replace(/\s+/g, "");
        const rawPhone = String(user.phone || "").replace(/[^0-9]/g, "");

        const nameMatch = rawName.includes(normalizedQuery) || (compactQuery.length > 0 && compactName.includes(compactQuery));
        const phoneMatch = digitQuery.length > 0 && rawPhone.includes(digitQuery);
        return nameMatch || phoneMatch;
      });
    }

    cachedSmsFilteredUsers = filtered;
    renderSmsUsersPage(cachedSmsFilteredUsers);
  }

  /**
   * 문자발송 탭 전용 페이지네이션 컨트롤러 렌더링 함수
   */
  function renderSmsUsersPagination(totalItems, itemsPerPage, currentPage, onPageChange) {
    renderPaginationControls(smsUsersPagination, {
      totalItems,
      itemsPerPage,
      currentPage,
      infoPrefix: "조회된 대상",
      onPageChange
    });
  }

  /**
   * 문자발송 대상 회원 리스트 테이블 렌더링 함수 (체크박스 + 국가 + 이름 + 연락처 + 가입일 + 현재등급 + 상세보기 7열 구성)
   * @param {Array} usersToRender - 필터링된 회원 배열
   */
  function renderSmsUsersPage(usersToRender) {
    if (!smsUserList) return;

    smsUserList.innerHTML = "";
    const totalUsers = usersToRender.length;
    const checkAllPageEl = document.getElementById("sms-check-all-page");

    if (totalUsers === 0) {
      const emptyMessage = allLoadedUsers.length > 0
        ? "선택한 국가, 등급 또는 이름/연락처 검색 조건에 일치하는 회원이 없습니다."
        : "가입된 회원이 없습니다.";
      smsUserList.innerHTML = `<tr><td colspan="7" class="table-empty">${emptyMessage}</td></tr>`;
      if (smsUsersPagination) smsUsersPagination.innerHTML = "";
      if (checkAllPageEl) {
        checkAllPageEl.checked = false;
        checkAllPageEl.indeterminate = false;
      }
      updateSmsSelectionUI();
      return;
    }

    const totalPages = Math.ceil(totalUsers / currentLimitSmsUsers) || 1;
    if (currentSmsUserPage > totalPages) currentSmsUserPage = totalPages;
    if (currentSmsUserPage < 1) currentSmsUserPage = 1;

    const startIndex = (currentSmsUserPage - 1) * currentLimitSmsUsers;
    const endIndex = startIndex + currentLimitSmsUsers;
    const pageUsers = usersToRender.slice(startIndex, endIndex);

    let selectablePageCount = 0;
    let selectedPageCount = 0;

    pageUsers.forEach((userData) => {
      const userId = userData.id;
      const tr = document.createElement("tr");

      // 가입일 포맷팅
      let registerDate = "-";
      if (userData.createdAt) {
        let dateObj = null;
        if (typeof userData.createdAt.toDate === "function") {
          dateObj = userData.createdAt.toDate();
        } else if (userData.createdAt.seconds) {
          dateObj = new Date(userData.createdAt.seconds * 1000);
        } else {
          dateObj = new Date(userData.createdAt);
        }
        registerDate = (dateObj && !isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "short",
          day: "numeric"
        }) : "-";
      }

      // 현재 등급 라벨
      const currentRoleLabel = rolesCache[userData.role] || userData.role || "일반 회원";

      // 국가(선호언어) 표시 라벨
      const userLangKey = normalizeUserLangKey(userData);
      const matchedLangInfo = SUPPORTED_COUNTRY_LANGS[userLangKey];
      const countryLangDisplay = matchedLangInfo
        ? `${matchedLangInfo.flag} ${matchedLangInfo.label}`
        : (userData.countryLanguage ? `🌐 ${userData.countryLanguage}` : "-");

      // 연락처 유효성 판별
      const phoneInfo = parseSmsUserPhone(userData.phone);
      const isChecked = phoneInfo.isValid && selectedSmsUserIds.has(userId);

      if (phoneInfo.isValid) {
        selectablePageCount++;
        if (isChecked) selectedPageCount++;
      }

      tr.className = `sms-user-row ${isChecked ? "sms-row-selected" : ""} ${!phoneInfo.isValid ? "sms-row-disabled" : ""}`;
      tr.setAttribute("data-uid", userId);

      const safeSmsUserId = escapeHtml(userId);
      const safeSmsRole = escapeHtml(userData.role || "user");
      const phoneDisplayHTML = phoneInfo.isValid
        ? `<span class="sms-phone-badge">${escapeHtml(phoneInfo.formatted)}</span>`
        : `<span class="sms-no-phone">연락처 미등록</span>`;

      tr.innerHTML = `
        <td class="sms-col-check">
          <label class="sms-checkbox-wrapper">
            <input type="checkbox" class="sms-checkbox-input sms-row-checkbox"
              data-uid="${safeSmsUserId}"
              ${isChecked ? "checked" : ""}
              ${!phoneInfo.isValid ? "disabled" : ""}>
            <span class="sms-checkbox-custom"></span>
          </label>
        </td>
        <td>
          <span class="sms-country-badge">${escapeHtml(countryLangDisplay)}</span>
        </td>
        <td class="font-bold">${escapeHtml(userData.name || "-")}</td>
        <td>${phoneDisplayHTML}</td>
        <td>${escapeHtml(registerDate)}</td>
        <td><span class="role-badge ${safeSmsRole}">${escapeHtml(currentRoleLabel)}</span></td>
        <td>
          <button type="button" class="btn-user-detail" data-uid="${safeSmsUserId}">상세보기</button>
        </td>
      `;

      smsUserList.appendChild(tr);
    });

    // 헤더의 현재 페이지 전체 선택 체크박스 상태 동기화
    if (checkAllPageEl) {
      if (selectablePageCount === 0) {
        checkAllPageEl.checked = false;
        checkAllPageEl.indeterminate = false;
      } else {
        checkAllPageEl.checked = (selectedPageCount === selectablePageCount);
        checkAllPageEl.indeterminate = (selectedPageCount > 0 && selectedPageCount < selectablePageCount);
      }
    }

    // 페이지네이션 렌더링 및 상단 선택 현황 UI 업데이트
    renderSmsUsersPagination(totalUsers, currentLimitSmsUsers, currentSmsUserPage, (newPage) => {
      currentSmsUserPage = newPage;
      renderSmsUsersPage(usersToRender);
    });

    updateSmsSelectionUI();
  }

  // 문자발송 탭: 상단 국가(선호언어) 타일 클릭 시 해당 국가 회원만 필터링하는 이벤트 바인딩
  const smsLangStatsEl = document.getElementById("admin-sms-lang-stats");
  if (smsLangStatsEl) {
    smsLangStatsEl.addEventListener("click", (e) => {
      const clickedTile = e.target.closest(".lang-stat-tile[data-sms-lang]");
      if (!clickedTile) return;

      const selectedLang = clickedTile.getAttribute("data-sms-lang") || "all";
      if (selectedLang === "all" || currentSmsLangFilter === selectedLang) {
        currentSmsLangFilter = "all";
      } else {
        currentSmsLangFilter = selectedLang;
      }

      smsLangStatsEl.querySelectorAll(".lang-stat-tile[data-sms-lang]").forEach((tile) => {
        const tileLang = tile.getAttribute("data-sms-lang");
        tile.classList.toggle("active", tileLang === currentSmsLangFilter);
      });

      if (allLoadedUsers.length > 0) {
        applySmsUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 문자발송 탭: 새로고침 버튼 이벤트
  if (btnRefreshSmsUsers) {
    btnRefreshSmsUsers.addEventListener("click", () => {
      loadUsers(true);
    });
  }

  // 문자발송 탭: 등급별 보기 필터 변경 이벤트
  const selectSmsRoleFilter = document.getElementById("select-sms-role-filter");
  if (selectSmsRoleFilter) {
    buildSmsRoleFilterOptions();
    selectSmsRoleFilter.addEventListener("change", (e) => {
      currentSmsRoleFilter = e.target.value;
      localStorage.setItem("admin_sms_role_filter", currentSmsRoleFilter);
      if (allLoadedUsers.length > 0) {
        applySmsUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 문자발송 탭: 페이지당 노출 인원수 드롭다운 변경 이벤트
  const selectLimitSmsUsers = document.getElementById("select-limit-sms-users");
  if (selectLimitSmsUsers) {
    selectLimitSmsUsers.value = currentLimitSmsUsers.toString();
    selectLimitSmsUsers.addEventListener("change", (e) => {
      currentLimitSmsUsers = parseInt(e.target.value, 10) || 20;
      localStorage.setItem("admin_sms_user_limit", currentLimitSmsUsers.toString());
      if (allLoadedUsers.length > 0) {
        applySmsUserFiltersAndRender(true);
      } else {
        loadUsers(true);
      }
    });
  }

  // 문자발송 탭: 이름/연락처 검색창 및 검색 버튼 이벤트
  const inputSearchSmsUsers = document.getElementById("input-search-sms-users");
  const btnSearchSmsUsers = document.getElementById("btn-search-sms-users");

  function executeSmsUserSearch() {
    if (!inputSearchSmsUsers) return;
    currentSmsSearchQuery = inputSearchSmsUsers.value.trim();
    if (allLoadedUsers.length > 0) {
      applySmsUserFiltersAndRender(true);
    } else {
      loadUsers(true);
    }
  }

  if (inputSearchSmsUsers) {
    inputSearchSmsUsers.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeSmsUserSearch();
      }
    });

    inputSearchSmsUsers.addEventListener("input", () => {
      if (inputSearchSmsUsers.value.trim() === "" && currentSmsSearchQuery !== "") {
        currentSmsSearchQuery = "";
        if (allLoadedUsers.length > 0) {
          applySmsUserFiltersAndRender(true);
        }
      }
    });
  }

  if (btnSearchSmsUsers) {
    btnSearchSmsUsers.addEventListener("click", () => {
      executeSmsUserSearch();
    });
  }

  // 문자발송 탭: 테이블 헤더의 '현재 페이지 전체 선택/해제' 마스터 체크박스 이벤트
  const checkAllPageInput = document.getElementById("sms-check-all-page");
  if (checkAllPageInput) {
    checkAllPageInput.addEventListener("change", (e) => {
      const shouldSelect = e.target.checked;
      if (!smsUserList) return;

      smsUserList.querySelectorAll(".sms-row-checkbox:not(:disabled)").forEach((cb) => {
        const uid = cb.getAttribute("data-uid");
        if (!uid) return;
        cb.checked = shouldSelect;
        const row = cb.closest("tr");
        if (shouldSelect) {
          selectedSmsUserIds.add(uid);
          if (row) row.classList.add("sms-row-selected");
        } else {
          selectedSmsUserIds.delete(uid);
          if (row) row.classList.remove("sms-row-selected");
        }
      });

      updateSmsSelectionUI();
    });
  }

  // 문자발송 탭: 테이블 내부 개별 체크박스 변경, 행 클릭 토글, 상세보기 버튼 클릭 이벤트 위임
  if (smsUserList) {
    // 1. 체크박스 직접 변경 이벤트
    smsUserList.addEventListener("change", (e) => {
      if (e.target.classList.contains("sms-row-checkbox")) {
        const uid = e.target.getAttribute("data-uid");
        if (!uid) return;

        const row = e.target.closest("tr");
        if (e.target.checked) {
          selectedSmsUserIds.add(uid);
          if (row) row.classList.add("sms-row-selected");
        } else {
          selectedSmsUserIds.delete(uid);
          if (row) row.classList.remove("sms-row-selected");
        }

        // 헤더 전체선택 체크박스 상태 동기화
        const allCbs = Array.from(smsUserList.querySelectorAll(".sms-row-checkbox:not(:disabled)"));
        const checkedCbs = allCbs.filter((cb) => cb.checked);
        if (checkAllPageInput) {
          checkAllPageInput.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
          checkAllPageInput.indeterminate = checkedCbs.length > 0 && checkedCbs.length < allCbs.length;
        }

        updateSmsSelectionUI();
      }
    });

    // 2. 상세보기 버튼 클릭 및 행(Row) 클릭 시 체크박스 편의 토글 이벤트
    smsUserList.addEventListener("click", async (e) => {
      const detailBtn = e.target.closest(".btn-user-detail");
      if (detailBtn) {
        const uid = detailBtn.getAttribute("data-uid");
        if (uid) {
          if (loadedUsersMap[uid]) {
            showUserDetailModal(loadedUsersMap[uid]);
          } else {
            try {
              const userDocSnap = await getDoc(doc(db, "users", uid));
              if (userDocSnap.exists()) {
                const fetchedUserData = { ...userDocSnap.data(), id: userDocSnap.id, uid: userDocSnap.id };
                loadedUsersMap[uid] = fetchedUserData;
                showUserDetailModal(fetchedUserData);
              }
            } catch (err) {
              console.error("Load user detail in SMS tab failed:", err);
            }
          }
        }
        return;
      }

      // 체크박스 라벨 자체를 클릭한 경우는 change 이벤트가 처리하므로 중복 토글 방지
      if (e.target.closest(".sms-checkbox-wrapper") || e.target.closest("button")) return;

      // 일반 셀(국가, 이름, 연락처, 가입일, 등급)을 클릭했을 때 해당 행의 체크박스를 자연스럽게 토글
      const clickedRow = e.target.closest("tr.sms-user-row");
      if (clickedRow) {
        const cb = clickedRow.querySelector(".sms-row-checkbox");
        if (cb && !cb.disabled) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    });
  }

  // 문자발송 탭: 상단 선택된 수신자 칩(Tag)의 '✕' 버튼 클릭 시 개별 선택 해제
  const smsSelectedChipsBox = document.getElementById("sms-selected-chips");
  if (smsSelectedChipsBox) {
    smsSelectedChipsBox.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".chip-remove[data-remove-uid]");
      if (!removeBtn) return;

      const uid = removeBtn.getAttribute("data-remove-uid");
      if (uid) {
        selectedSmsUserIds.delete(uid);
        renderSmsUsersPage(cachedSmsFilteredUsers);
      }
    });
  }

  // 문자발송 탭: '현재 목록 전체 선택' 버튼 클릭 시 현재 필터링된 목록(cachedSmsFilteredUsers)의 유효 연락처 회원만 정확히 일괄 선택
  const btnSmsSelectFiltered = document.getElementById("btn-sms-select-filtered");
  if (btnSmsSelectFiltered) {
    btnSmsSelectFiltered.addEventListener("click", () => {
      const targetList = cachedSmsFilteredUsers;
      if (!targetList || targetList.length === 0) {
        alert("현재 선택된 국가 또는 검색 조건에 해당하는 회원이 없습니다.");
        return;
      }

      let addedCount = 0;
      targetList.forEach((u) => {
        if (parseSmsUserPhone(u.phone).isValid) {
          selectedSmsUserIds.add(u.id);
          addedCount++;
        }
      });

      if (addedCount === 0) {
        alert("현재 목록에 유효한 연락처가 등록된 회원이 없습니다.");
        return;
      }
      renderSmsUsersPage(cachedSmsFilteredUsers);
    });
  }

  // 문자발송 탭: '전체 선택 해제' 버튼 클릭 시 모든 체크 해제
  const btnSmsClearSelection = document.getElementById("btn-sms-clear-selection");
  if (btnSmsClearSelection) {
    btnSmsClearSelection.addEventListener("click", () => {
      if (selectedSmsUserIds.size === 0) return;
      selectedSmsUserIds.clear();
      renderSmsUsersPage(cachedSmsFilteredUsers);
    });
  }

  // 문자발송 탭: '선택 연락처 복사' 버튼 클릭 시 체크된 회원들의 전화번호를 클립보드에 일괄 복사
  const btnSmsCopyPhones = document.getElementById("btn-sms-copy-phones");
  if (btnSmsCopyPhones) {
    btnSmsCopyPhones.addEventListener("click", async () => {
      const phones = [];
      selectedSmsUserIds.forEach((uid) => {
        const u = loadedUsersMap[uid];
        if (u) {
          const pInfo = parseSmsUserPhone(u.phone);
          if (pInfo.isValid) phones.push(pInfo.clean);
        }
      });

      if (phones.length === 0) {
        alert("먼저 연락처를 복사할 회원을 아래 목록에서 체크해 주세요.");
        return;
      }

      const uniquePhones = Array.from(new Set(phones));
      try {
        await navigator.clipboard.writeText(uniquePhones.join(", "));
        alert(`체크한 회원 ${uniquePhones.length}명의 연락처가 클립보드에 복사되었습니다.\n\n복사된 번호: ${uniquePhones.slice(0, 5).join(", ")}${uniquePhones.length > 5 ? ` 외 ${uniquePhones.length - 5}건` : ""}`);
      } catch (err) {
        console.error("Clipboard copy failed:", err);
        prompt("아래 연락처 목록을 복사(Ctrl+C)하여 사용하세요:", uniquePhones.join(", "));
      }
    });
  }

  // 문자발송 탭: 본문 입력 시 실시간 바이트(Byte) 계산 및 SMS/LMS 자동 전환 배지 업데이트
  const smsMessageTextarea = document.getElementById("sms-message-textarea");
  const smsByteBadge = document.getElementById("sms-byte-badge");

  function updateSmsByteIndicator() {
    if (!smsMessageTextarea || !smsByteBadge) return;
    const text = smsMessageTextarea.value;
    const byteLen = calculateSmsByteLength(text);

    smsByteBadge.classList.remove("sms-mode", "lms-mode", "over-mode");
    if (byteLen <= 90) {
      smsByteBadge.classList.add("sms-mode");
      smsByteBadge.textContent = `SMS 단문 · ${byteLen} / 90 Byte`;
    } else if (byteLen <= 2000) {
      smsByteBadge.classList.add("lms-mode");
      smsByteBadge.textContent = `LMS 장문 · ${byteLen} / 2,000 Byte`;
    } else {
      smsByteBadge.classList.add("over-mode");
      smsByteBadge.textContent = `용량 초과 · ${byteLen} / 2,000 Byte`;
    }
  }

  if (smsMessageTextarea) {
    smsMessageTextarea.addEventListener("input", updateSmsByteIndicator);
  }

  // 문자발송 탭: '#{이름} 자동치환 넣기' 버튼 클릭 시 커서 위치에 #{이름} 삽입
  const btnSmsInsertName = document.getElementById("btn-sms-insert-name");
  if (btnSmsInsertName && smsMessageTextarea) {
    btnSmsInsertName.addEventListener("click", () => {
      const start = smsMessageTextarea.selectionStart || 0;
      const end = smsMessageTextarea.selectionEnd || 0;
      const currentVal = smsMessageTextarea.value;
      const tag = "#{이름}";

      smsMessageTextarea.value = currentVal.substring(0, start) + tag + currentVal.substring(end);
      smsMessageTextarea.focus();
      smsMessageTextarea.setSelectionRange(start + tag.length, start + tag.length);
      updateSmsByteIndicator();
    });
  }

  // =========================================================================
  // 문자발송 탭: 빠른 문구 양식(공지 안내, 진료/예약 안내, 혜택/이벤트, 카톡 상담 안내 등)
  // 불러오기 · 내용 편집(수정) · 개별 삭제 · 새 양식 추가 · 초기값 복원 통합 모듈
  // =========================================================================

  // 초기 기본 제공 문자메시지 양식 4종 정의
  const DEFAULT_SMS_TEMPLATES = [
    {
      id: "notice",
      label: "📢 공지 안내",
      subject: "[IGPartners 공지 안내]",
      body: `[IGPartners 공지 안내]\n\n안녕하세요, #{이름}님.\n아이지파트너스(IGPartners)를 이용해 주셔서 진심으로 감사드립니다.\n\n\n\n■ 문의 및 카톡 상담\nhttp://pf.kakao.com/_YxoxjfX/chat`
    },
    {
      id: "medical",
      label: "🏥 진료/예약 안내",
      subject: "[IGPartners 병원 진료 안내]",
      body: `[IGPartners 병원 진료 안내]\n\n안녕하세요, #{이름}님.\n전문 의료 통역 및 제휴 병원 진료 예약과 관련하여 안내해 드립니다.\n\n• 내원 시 신분증(외국인등록증 또는 여권)을 꼭 지참해 주세요.\n\n■ 실시간 카톡 상담\nhttp://pf.kakao.com/_YxoxjfX/chat`
    },
    {
      id: "event",
      label: "🎉 혜택/이벤트",
      subject: "[IGPartners 회원 특별 혜택 안내]",
      body: `[IGPartners 회원 혜택 안내]\n\n안녕하세요, #{이름}님!\nIGPartners 가입 회원분들을 위한 제휴 병원 특별 진료 혜택 및 의료 통역 지원 이벤트를 안내해 드립니다.\n\n■ 자세히 보기 및 상담\nhttp://pf.kakao.com/_YxoxjfX/chat`
    },
    {
      id: "kakao",
      label: "💬 카톡 상담 안내",
      subject: "[IGPartners 상담 채널 안내]",
      body: `[IGPartners 1:1 다국어 상담 안내]\n\n안녕하세요, #{이름}님.\n병원 예약, 일정 변경, 전문 통역 문의가 필요하신 경우 아래 공식 카카오톡 채널로 언제든 편하게 문의해 주세요.\n\n■ IGPartners 카톡 채널\nhttp://pf.kakao.com/_YxoxjfX/chat`
    }
  ];

  const SMS_TEMPLATES_STORAGE_KEY = "admin_sms_custom_templates_v1";
  // 현재 메모리에 로드된 문자 양식 배열
  let smsTemplatesList = [];
  // 현재 아래 입력창에 선택·적용되어 있는 활성 양식 ID
  let activeSmsTemplateId = null;

  const smsTemplateListContainer = document.getElementById("sms-template-list");
  const btnSmsSaveCurrentTpl = document.getElementById("btn-sms-save-current-tpl");
  const btnSmsAddTpl = document.getElementById("btn-sms-add-tpl");
  const btnSmsResetTpl = document.getElementById("btn-sms-reset-tpl");

  /**
   * 초기 기본 양식 배열을 깊은 복사(Deep Copy)하여 반환하는 헬퍼 함수
   */
  function cloneDefaultSmsTemplates() {
    return DEFAULT_SMS_TEMPLATES.map((tpl) => ({ ...tpl }));
  }

  /**
   * 양식 목록을 브라우저 localStorage와 Firestore(settings/sms_templates)에 동시 저장하는 함수
   * @param {Array} newTemplates - 저장할 양식 객체 배열
   */
  async function persistSmsTemplates(newTemplates) {
    smsTemplatesList = Array.isArray(newTemplates) ? newTemplates : [];
    try {
      localStorage.setItem(SMS_TEMPLATES_STORAGE_KEY, JSON.stringify(smsTemplatesList));
    } catch (e) {
      console.warn("문자 양식 로컬 스토리지 저장 실패:", e);
    }

    try {
      await setDoc(doc(db, "settings", "sms_templates"), {
        templates: smsTemplatesList,
        updatedAt: new Date().toISOString()
      });
    } catch (dbErr) {
      console.warn("문자 양식 Firestore 동기화 저장 실패 (로컬 저장본 유지):", dbErr);
    }
  }

  /**
   * 현재 선택된 활성 양식에 맞춰 '현재 내용으로 양식 저장' 버튼의 노출 상태와 라벨을 업데이트하는 함수
   */
  function updateActiveSmsTemplateSaveButton() {
    if (!btnSmsSaveCurrentTpl) return;
    const matchedTpl = smsTemplatesList.find((t) => t.id === activeSmsTemplateId);
    if (matchedTpl) {
      btnSmsSaveCurrentTpl.style.display = "inline-flex";
      btnSmsSaveCurrentTpl.textContent = `💾 '${matchedTpl.label}' 내용 저장`;
    } else {
      btnSmsSaveCurrentTpl.style.display = "none";
    }
  }

  /**
   * 문자 양식 칩 목록(불러오기 버튼 + ✏️ 편집 버튼 + ✕ 삭제 버튼)을 화면에 렌더링하는 함수
   */
  function renderSmsTemplateToolbar() {
    if (!smsTemplateListContainer) return;

    if (!Array.isArray(smsTemplatesList) || smsTemplatesList.length === 0) {
      smsTemplateListContainer.innerHTML = `
        <span style="font-size: 0.78rem; color: #94a3b8; padding: 0.25rem 0.4rem;">
          등록된 문자 양식이 없습니다. 우측 [＋ 양식 추가] 또는 [↺ 기본양식 복원]을 이용해 주세요.
        </span>
      `;
      activeSmsTemplateId = null;
      updateActiveSmsTemplateSaveButton();
      return;
    }

    smsTemplateListContainer.innerHTML = smsTemplatesList.map((tpl) => {
      const isActive = (tpl.id === activeSmsTemplateId) ? "active" : "";
      const safeLabel = String(tpl.label || "양식").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const safeId = String(tpl.id || "").replace(/"/g, "&quot;");
      return `
        <div class="sms-tpl-chip-group ${isActive}" data-tpl-id="${safeId}">
          <button type="button" class="sms-tpl-load-btn" data-action="load" data-tpl-id="${safeId}" title="클릭 시 '${safeLabel}' 양식의 제목과 본문을 입력창에 불러옵니다">
            ${safeLabel}
          </button>
          <button type="button" class="sms-tpl-icon-btn edit" data-action="edit" data-tpl-id="${safeId}" title="'${safeLabel}' 양식의 이름·제목·본문 내용을 편집합니다">
            ✏️
          </button>
          <button type="button" class="sms-tpl-icon-btn delete" data-action="delete" data-tpl-id="${safeId}" title="'${safeLabel}' 양식을 삭제합니다">
            ✕
          </button>
        </div>
      `;
    }).join("");

    updateActiveSmsTemplateSaveButton();
  }

  /**
   * 초기 로딩 시 localStorage 캐시를 먼저 반영하고 Firestore(settings/sms_templates)에서 최신 양식 목록을 동기화하는 함수
   */
  async function loadSmsTemplatesFromStorage() {
    // 1. 로컬 스토리지에서 즉시 로드하여 화면 깜빡임 방지
    let loadedFromLocal = false;
    try {
      const rawLocal = localStorage.getItem(SMS_TEMPLATES_STORAGE_KEY);
      if (rawLocal !== null) {
        const parsed = JSON.parse(rawLocal);
        if (Array.isArray(parsed)) {
          smsTemplatesList = parsed;
          loadedFromLocal = true;
        }
      }
    } catch (e) {
      console.warn("문자 양식 로컬 캐시 파싱 오류:", e);
    }

    if (!loadedFromLocal) {
      smsTemplatesList = cloneDefaultSmsTemplates();
    }
    renderSmsTemplateToolbar();

    // 2. Firestore settings/sms_templates 문서 조회 및 최신 동기화
    try {
      const tplSnap = await getDoc(doc(db, "settings", "sms_templates"));
      if (tplSnap.exists() && Array.isArray(tplSnap.data().templates)) {
        smsTemplatesList = tplSnap.data().templates;
        try {
          localStorage.setItem(SMS_TEMPLATES_STORAGE_KEY, JSON.stringify(smsTemplatesList));
        } catch (e) { }
        renderSmsTemplateToolbar();
      }
    } catch (err) {
      console.warn("Firestore 문자 양식 조회 생략 (로컬 설정 사용):", err);
    }
  }

  /**
   * 문자 양식 편집(수정) 및 신규 추가를 위한 전용 모달 팝업을 생성·표시하는 함수
   * @param {Object|null} targetTpl - 수정할 양식 객체 (신규 추가 시에는 null)
   */
  function openSmsTemplateEditModal(targetTpl = null) {
    const existingModal = document.getElementById("sms-tpl-edit-modal");
    if (existingModal) existingModal.remove();

    const isEditMode = Boolean(targetTpl && targetTpl.id);
    const subjectInputEl = document.getElementById("sms-subject-input");

    // 현재 선택된 양식을 편집하거나 새 양식을 추가할 때, 입력창에서 방금 수정 중인 내용이 있다면 기본값으로 편리하게 연동
    const initialLabel = isEditMode ? (targetTpl.label || "") : "📌 새 안내 양식";
    const initialSubject = isEditMode
      ? ((activeSmsTemplateId === targetTpl.id && subjectInputEl && subjectInputEl.value.trim()) ? subjectInputEl.value.trim() : (targetTpl.subject || "[IGPartners 안내]"))
      : ((subjectInputEl && subjectInputEl.value.trim()) ? subjectInputEl.value.trim() : "[IGPartners 안내]");
    const initialBody = isEditMode
      ? ((activeSmsTemplateId === targetTpl.id && smsMessageTextarea && smsMessageTextarea.value.trim()) ? smsMessageTextarea.value : (targetTpl.body || ""))
      : ((smsMessageTextarea && smsMessageTextarea.value.trim()) ? smsMessageTextarea.value : `안녕하세요, #{이름}님.\n아이지파트너스(IGPartners)에서 안내해 드립니다.\n\n`);

    const modalOverlay = document.createElement("div");
    modalOverlay.id = "sms-tpl-edit-modal";
    modalOverlay.className = "sms-tpl-modal-overlay";

    modalOverlay.innerHTML = `
      <div class="sms-tpl-modal-card">
        <div class="sms-tpl-modal-header">
          <h3>${isEditMode ? "✏️ 문자메시지 양식 내용 편집" : "＋ 새 문자메시지 양식 추가"}</h3>
          <button type="button" id="btn-sms-tpl-modal-close" style="background: none; border: none; color: #94a3b8; font-size: 1.35rem; cursor: pointer; line-height: 1;">&times;</button>
        </div>

        <div class="sms-tpl-modal-field">
          <label for="sms-tpl-modal-label">양식 버튼 이름 (이모지 포함 가능)</label>
          <input type="text" id="sms-tpl-modal-label" class="sms-tpl-modal-input" placeholder="예: 📢 공지 안내, 🏥 진료/예약 안내" maxlength="30">
        </div>

        <div class="sms-tpl-modal-field">
          <label for="sms-tpl-modal-subject">문자 제목 (장문 LMS 전환 시 표시되는 제목)</label>
          <input type="text" id="sms-tpl-modal-subject" class="sms-tpl-modal-input" placeholder="예: [IGPartners 회원 특별 혜택 안내]" maxlength="60">
        </div>

        <div class="sms-tpl-modal-field">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
            <label for="sms-tpl-modal-body">문자 본문 내용</label>
            <button type="button" id="btn-sms-tpl-modal-insert-name" class="sms-tpl-btn highlight" style="padding: 0.22rem 0.55rem; font-size: 0.73rem;">
              🏷️ #{이름} 넣기
            </button>
          </div>
          <textarea id="sms-tpl-modal-body" class="sms-tpl-modal-textarea" rows="7" placeholder="양식에 저장할 문자메시지 본문을 입력해 주세요."></textarea>
        </div>

        <div class="sms-tpl-modal-footer">
          <div>
            ${isEditMode ? `<button type="button" id="btn-sms-tpl-modal-delete" class="sms-action-chip danger" style="padding: 0.48rem 0.9rem;">🗑️ 이 양식 삭제</button>` : ""}
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" id="btn-sms-tpl-modal-cancel" class="sms-action-chip secondary" style="padding: 0.48rem 1rem;">취소</button>
            <button type="button" id="btn-sms-tpl-modal-save" class="sms-action-chip primary" style="padding: 0.48rem 1.15rem;">💾 양식 저장하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const labelEl = document.getElementById("sms-tpl-modal-label");
    const subjectEl = document.getElementById("sms-tpl-modal-subject");
    const bodyEl = document.getElementById("sms-tpl-modal-body");

    if (labelEl) labelEl.value = initialLabel;
    if (subjectEl) subjectEl.value = initialSubject;
    if (bodyEl) bodyEl.value = initialBody;

    // 모달 내부에서 '#{이름} 넣기' 버튼 클릭 시 본문 커서 위치에 삽입
    const btnModalInsertName = document.getElementById("btn-sms-tpl-modal-insert-name");
    if (btnModalInsertName && bodyEl) {
      btnModalInsertName.addEventListener("click", () => {
        const start = bodyEl.selectionStart || 0;
        const end = bodyEl.selectionEnd || 0;
        const val = bodyEl.value;
        const tag = "#{이름}";
        bodyEl.value = val.substring(0, start) + tag + val.substring(end);
        bodyEl.focus();
        bodyEl.setSelectionRange(start + tag.length, start + tag.length);
      });
    }

    // 모달 닫기 이벤트
    const closeModal = () => modalOverlay.remove();
    document.getElementById("btn-sms-tpl-modal-close")?.addEventListener("click", closeModal);
    document.getElementById("btn-sms-tpl-modal-cancel")?.addEventListener("click", closeModal);
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // 모달 내 삭제 버튼 클릭 이벤트 (편집 모드 전용)
    const btnModalDelete = document.getElementById("btn-sms-tpl-modal-delete");
    if (btnModalDelete && isEditMode) {
      btnModalDelete.addEventListener("click", async () => {
        if (!confirm(`'${targetTpl.label}' 양식을 정말 삭제하시겠습니까?`)) return;
        const updated = smsTemplatesList.filter((t) => t.id !== targetTpl.id);
        if (activeSmsTemplateId === targetTpl.id) {
          activeSmsTemplateId = null;
        }
        await persistSmsTemplates(updated);
        renderSmsTemplateToolbar();
        closeModal();
      });
    }

    // 모달 내 저장 버튼 클릭 이벤트
    const btnModalSave = document.getElementById("btn-sms-tpl-modal-save");
    if (btnModalSave) {
      btnModalSave.addEventListener("click", async () => {
        const newLabel = labelEl ? labelEl.value.trim() : "";
        const newSubject = (subjectEl && subjectEl.value.trim()) ? subjectEl.value.trim() : "[IGPartners 안내]";
        const newBody = bodyEl ? bodyEl.value.trim() : "";

        if (!newLabel) {
          alert("양식 버튼 이름을 입력해 주세요.");
          if (labelEl) labelEl.focus();
          return;
        }
        if (!newBody) {
          alert("양식에 저장할 문자 본문 내용을 입력해 주세요.");
          if (bodyEl) bodyEl.focus();
          return;
        }

        btnModalSave.disabled = true;
        btnModalSave.textContent = "저장 중...";

        let savedTplId = isEditMode ? targetTpl.id : `tpl_${Date.now()}`;
        let updatedList = [];

        if (isEditMode) {
          updatedList = smsTemplatesList.map((item) => {
            if (item.id === targetTpl.id) {
              return {
                ...item,
                label: newLabel,
                subject: newSubject,
                body: newBody
              };
            }
            return item;
          });
        } else {
          updatedList = [
            ...smsTemplatesList,
            {
              id: savedTplId,
              label: newLabel,
              subject: newSubject,
              body: newBody
            }
          ];
        }

        await persistSmsTemplates(updatedList);

        // 방금 편집하거나 추가한 양식을 즉시 활성 양식으로 선택하고 아래 문자 작성창에도 최신 내용을 반영
        activeSmsTemplateId = savedTplId;
        renderSmsTemplateToolbar();

        if (subjectInputEl) subjectInputEl.value = newSubject;
        if (smsMessageTextarea) {
          smsMessageTextarea.value = newBody;
          updateSmsByteIndicator();
        }

        closeModal();
      });
    }
  }

  // 양식 칩 목록 클릭 이벤트 위임 (불러오기 / ✏️ 편집 / ✕ 삭제)
  if (smsTemplateListContainer) {
    smsTemplateListContainer.addEventListener("click", async (e) => {
      const actionBtn = e.target.closest("button[data-action][data-tpl-id]");
      if (!actionBtn) return;

      const action = actionBtn.getAttribute("data-action");
      const tplId = actionBtn.getAttribute("data-tpl-id");
      const targetTpl = smsTemplatesList.find((t) => t.id === tplId);
      if (!targetTpl) return;

      // 1. 양식 이름 클릭 시: 제목 및 본문 입력창에 양식 불러오기
      if (action === "load") {
        const subjectInput = document.getElementById("sms-subject-input");
        const currentBody = smsMessageTextarea ? smsMessageTextarea.value.trim() : "";

        // 기존에 다른 내용을 작성 중이었고 선택한 양식의 본문과 다를 경우에만 교체 확인
        if (currentBody.length > 0 && currentBody !== (targetTpl.body || "").trim()) {
          if (!confirm(`현재 작성 중인 문자 내용을 '${targetTpl.label}' 양식으로 교체하시겠습니까?`)) {
            return;
          }
        }

        activeSmsTemplateId = targetTpl.id;
        if (subjectInput) subjectInput.value = targetTpl.subject || "[IGPartners 안내]";
        if (smsMessageTextarea) {
          smsMessageTextarea.value = targetTpl.body || "";
          smsMessageTextarea.focus();
          updateSmsByteIndicator();
        }
        renderSmsTemplateToolbar();
        return;
      }

      // 2. ✏️ 편집 아이콘 클릭 시: 양식 수정 모달 열기
      if (action === "edit") {
        openSmsTemplateEditModal(targetTpl);
        return;
      }

      // 3. ✕ 삭제 아이콘 클릭 시: 확인 후 즉시 양식 삭제
      if (action === "delete") {
        if (!confirm(`'${targetTpl.label}' 양식을 삭제하시겠습니까?`)) {
          return;
        }
        const updated = smsTemplatesList.filter((t) => t.id !== targetTpl.id);
        if (activeSmsTemplateId === targetTpl.id) {
          activeSmsTemplateId = null;
        }
        await persistSmsTemplates(updated);
        renderSmsTemplateToolbar();
      }
    });
  }

  // '💾 선택 양식에 현재 내용 저장' 버튼 클릭 시: 아래 입력창에서 직접 수정한 제목과 본문을 선택된 양식에 즉시 덮어쓰기 저장
  if (btnSmsSaveCurrentTpl) {
    btnSmsSaveCurrentTpl.addEventListener("click", async () => {
      if (!activeSmsTemplateId) return;
      const targetTpl = smsTemplatesList.find((t) => t.id === activeSmsTemplateId);
      if (!targetTpl) return;

      const subjectInput = document.getElementById("sms-subject-input");
      const newSubject = (subjectInput && subjectInput.value.trim()) ? subjectInput.value.trim() : "[IGPartners 안내]";
      const newBody = smsMessageTextarea ? smsMessageTextarea.value.trim() : "";

      if (!newBody) {
        alert("양식에 저장할 문자 본문 내용을 먼저 입력해 주세요.");
        if (smsMessageTextarea) smsMessageTextarea.focus();
        return;
      }

      const updatedList = smsTemplatesList.map((item) => {
        if (item.id === activeSmsTemplateId) {
          return {
            ...item,
            subject: newSubject,
            body: newBody
          };
        }
        return item;
      });

      await persistSmsTemplates(updatedList);
      renderSmsTemplateToolbar();
      alert(`'${targetTpl.label}' 양식의 제목과 본문이 현재 입력창의 내용으로 저장되었습니다.`);
    });
  }

  // '＋ 양식 추가' 버튼 클릭 시: 새 양식 등록 모달 호출
  if (btnSmsAddTpl) {
    btnSmsAddTpl.addEventListener("click", () => {
      openSmsTemplateEditModal(null);
    });
  }

  // '↺ 기본양식 복원' 버튼 클릭 시: 초기 4종 양식(공지 안내, 진료/예약 안내, 혜택/이벤트, 카톡 상담 안내)으로 초기화
  if (btnSmsResetTpl) {
    btnSmsResetTpl.addEventListener("click", async () => {
      if (!confirm("문자메시지 양식을 초기 기본 4종('공지 안내', '진료/예약 안내', '혜택/이벤트', '카톡 상담 안내')으로 복원하시겠습니까?")) {
        return;
      }
      const restored = cloneDefaultSmsTemplates();
      activeSmsTemplateId = null;
      await persistSmsTemplates(restored);
      renderSmsTemplateToolbar();
      alert("초기 기본 양식 4종이 모두 복원되었습니다.");
    });
  }

  // 페이지 로드 시 저장된 문자 양식 목록 초기화 실행
  loadSmsTemplatesFromStorage();

  // 문자발송 탭: '체크한 회원 문자 발송' 메인 실행 버튼 이벤트 핸들러 (솔라피 SMS/LMS 연동)
  const btnSmsSendSubmit = document.getElementById("btn-sms-send-submit");
  if (btnSmsSendSubmit) {
    btnSmsSendSubmit.addEventListener("click", async () => {
      // 1. 체크된 수신 대상 회원 목록 추출
      const targetUsers = [];
      selectedSmsUserIds.forEach((uid) => {
        const u = loadedUsersMap[uid];
        if (u) {
          const pInfo = parseSmsUserPhone(u.phone);
          if (pInfo.isValid) {
            targetUsers.push({
              uid: u.id,
              name: u.name || "회원",
              cleanPhone: pInfo.clean,
              formattedPhone: pInfo.formatted
            });
          }
        }
      });

      if (targetUsers.length === 0) {
        alert("문자를 발송할 회원을 아래 목록에서 먼저 체크해 주세요.");
        return;
      }

      // 2. 문자 제목 및 본문 검증
      const rawMessage = smsMessageTextarea ? smsMessageTextarea.value.trim() : "";
      if (!rawMessage) {
        alert("발송할 문자메시지 내용을 입력해 주세요.");
        if (smsMessageTextarea) smsMessageTextarea.focus();
        return;
      }

      const totalByte = calculateSmsByteLength(rawMessage);
      if (totalByte > 2000) {
        alert(`문자 용량이 최대 한도(2,000 Byte)를 초과했습니다. (현재: ${totalByte} Byte)\n내용을 조금 줄여주세요.`);
        return;
      }

      const subjectInput = document.getElementById("sms-subject-input");
      const subjectText = (subjectInput && subjectInput.value.trim()) ? subjectInput.value.trim() : "[IGPartners 안내]";
      const msgModeLabel = totalByte <= 90 ? "SMS (단문)" : "LMS (장문)";

      // 3. 발송 전 관리자 최종 확인
      const previewRecipientText = targetUsers.length <= 3
        ? targetUsers.map(t => `${t.name}(${t.formattedPhone})`).join(", ")
        : `${targetUsers.slice(0, 3).map(t => `${t.name}(${t.formattedPhone})`).join(", ")} 외 ${targetUsers.length - 3}명`;

      const confirmMsg = [
        `선택하신 회원 ${targetUsers.length}명에게 문자를 발송하시겠습니까?`,
        ``,
        `• 발송 대상: ${previewRecipientText}`,
        `• 발송 형태: ${msgModeLabel} (약 ${totalByte} Byte)`,
        `• 문자 제목: ${subjectText}`
      ].join("\n");

      if (!confirm(confirmMsg)) return;

      // 4. 발신번호 설정 조회 (Firestore settings/solapi 우선, 없으면 기본 업무폰 번호 사용)
      let senderNumber = SOLAPI_SENDER_NUMBER;
      try {
        const solapiDocSnap = await getDoc(doc(db, "settings", "solapi"));
        if (solapiDocSnap.exists() && solapiDocSnap.data().senderNumber) {
          senderNumber = String(solapiDocSnap.data().senderNumber).replace(/[^0-9]/g, "");
        }
      } catch (e) {
        console.warn("DB 발신번호 설정 조회 실패, 기본 업무폰 번호 사용:", e);
      }

      // 5. 발송 진행 상태 UI 활성화 및 버튼 잠금
      const progressContainer = document.getElementById("sms-progress-container");
      const progressText = document.getElementById("sms-progress-text");
      const progressPercent = document.getElementById("sms-progress-percent");
      const progressBar = document.getElementById("sms-progress-bar");

      btnSmsSendSubmit.disabled = true;
      btnSmsSendSubmit.dataset.sending = "true";
      btnSmsSendSubmit.textContent = "⏳ 문자 발송 중...";

      if (progressContainer) progressContainer.style.display = "block";
      if (progressBar) progressBar.style.width = "0%";

      let successCount = 0;
      let failCount = 0;
      const failDetails = [];

      // 6. 각 수신자별로 #{이름} 치환 및 단문/장문 바이트 판별 후 솔라피 API 순차 발송
      for (let i = 0; i < targetUsers.length; i++) {
        const target = targetUsers[i];
        const currentStep = i + 1;
        const pct = Math.round((currentStep / targetUsers.length) * 100);

        if (progressText) {
          progressText.textContent = `문자 발송 진행 중... (${currentStep} / ${targetUsers.length}명 - ${target.name})`;
        }
        if (progressPercent) progressPercent.textContent = `${pct}%`;
        if (progressBar) progressBar.style.width = `${pct}%`;

        // 개인화 #{이름} 태그를 실제 회원 성명으로 치환
        const personalizedText = rawMessage.replace(/#\{이름\}/g, target.name);
        const personalizedBytes = calculateSmsByteLength(personalizedText);
        const sendType = personalizedBytes <= 90 ? "SMS" : "LMS";

        try {
          const messagePayload = {
            to: target.cleanPhone,
            from: senderNumber,
            type: sendType,
            text: personalizedText
          };
          if (sendType === "LMS") {
            messagePayload.subject = subjectText;
          }

          let response;
          if (SOLAPI_PROXY_URL) {
            response = await fetch(SOLAPI_PROXY_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "send", payload: { message: messagePayload } })
            });
          } else {
            const authHeader = await createSolapiAuthHeader(SOLAPI_API_KEY, SOLAPI_API_SECRET);
            response = await fetch("https://api.solapi.com/messages/v4/send", {
              method: "POST",
              headers: {
                "Authorization": authHeader,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ message: messagePayload })
            });
          }

          const responseData = await response.json();
          if (!response.ok) {
            throw new Error(responseData.errorMessage || `HTTP ${response.status}`);
          }
          successCount++;
        } catch (sendErr) {
          console.error(`회원 문자 발송 실패 (${target.name} / ${target.cleanPhone}):`, sendErr);
          failCount++;
          failDetails.push(`${target.name}(${target.formattedPhone}): ${sendErr.message}`);
        }
      }

      // 7. 발송 완료 후 UI 복원 및 결과 리포트 알림
      delete btnSmsSendSubmit.dataset.sending;
      btnSmsSendSubmit.disabled = false;
      updateSmsSelectionUI();

      setTimeout(() => {
        if (progressContainer) progressContainer.style.display = "none";
      }, 1500);

      let resultAlert = `✅ 문자 발송 처리가 완료되었습니다.\n\n• 발송 성공: ${successCount}명\n• 발송 실패: ${failCount}명`;
      if (failCount > 0) {
        resultAlert += `\n\n[실패 상세 내역]\n${failDetails.slice(0, 5).join("\n")}${failDetails.length > 5 ? `\n외 ${failDetails.length - 5}건` : ""}`;
      }
      alert(resultAlert);
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
  // 병원 순서 이동(Swap) 처리를 위해 현재 메모리에 로드된 병원 데이터 리스트 캐싱
  let currentLoadedClinics = [];

  async function loadClinics() {
    // 성능 최적화: 탭 클릭 시마다 호출되므로 이전 리스너가 있으면 해제
    if (unsubscribeClinics) {
      unsubscribeClinics();
      unsubscribeClinics = null;
    }

    // 순서(order) 필드 기준으로 오름차순(asc) 정렬 쿼리 실행
    const q = query(collection(db, "clinics"), orderBy("order", "asc"));
    const adminClinicList = document.getElementById("admin-clinic-list");
    if (!adminClinicList) return;

    adminClinicList.innerHTML = `<tr><td colspan="6" class="table-loading">데이터를 불러오는 중입니다...</td></tr>`;

    try {
      const querySnapshot = await getDocs(q);

      // 데이터가 없으면 초기 Seed 데이터 자동 삽입
      if (querySnapshot.empty) {
        adminClinicList.innerHTML = `<tr><td colspan="6" class="table-loading">기본 병원 데이터를 생성 중입니다...</td></tr>`;
        for (let i = 0; i < seedClinics.length; i++) {
          await addDoc(collection(db, "clinics"), {
            ...seedClinics[i],
            // 시딩할 때 순번(order) 필드 부여 (1~6번 차례대로 매핑)
            order: i + 1,
            createdAt: new Date(Date.now() + i * 1000).toISOString()
          });
        }
        console.log("Seed clinics populated successfully.");
        // Seed 후 다시 로드
        await loadClinics();
        return;
      }

      // 데이터베이스 자동 보정(Auto Migration) 로직
      // 기존에 order 필드 없이 생성되었던 병원 문서들에 대해 자동으로 순서를 부여해 줍니다.
      let needsMigration = false;
      querySnapshot.forEach((doc) => {
        if (doc.data().order === undefined) {
          needsMigration = true;
        }
      });

      if (needsMigration) {
        console.log("Legacy clinic detected. Executing order migration...");
        let tempOrder = 1;
        for (const docSnap of querySnapshot.docs) {
          await updateDoc(doc(db, "clinics", docSnap.id), { order: tempOrder++ });
        }
        // 마이그레이션 반영 후 다시 불러오기
        loadClinics();
        return;
      }

      currentLoadedClinics = [];
      adminClinicList.innerHTML = "";

      // 등록된 병원 총 개수 뱃지 실시간 갱신
      const clinicCountBadge = document.getElementById("clinic-count-badge");
      if (clinicCountBadge) {
        clinicCountBadge.textContent = `총 ${querySnapshot.docs.length}개 병원`;
      }

      // 메모리에 이동 처리를 위한 객체 배열 보관 및 비어 있는 8개국어(ja, zh, th, lo, ne, id, si, bn) 자동 채움·동기화
      const migrationPromises = [];
      querySnapshot.forEach((docSnap) => {
        const clinicObj = {
          id: docSnap.id,
          ...docSnap.data()
        };
        // 완전히 비어 있는 8개국어 필드만 한국어 원문 기반 번역 데이터로 보강 (러시아어·미얀마어 등 기존 언어는 보존)
        const missingPatch = enrichClinicWithMissing8Langs(clinicObj);
        if (Object.keys(missingPatch).length > 0) {
          migrationPromises.push(
            updateDoc(doc(db, "clinics", docSnap.id), missingPatch).catch((migErr) => {
              console.warn(`병원(${clinicObj.name || docSnap.id}) 8개국어 자동 저장 예외:`, migErr);
            })
          );
        }
        currentLoadedClinics.push(clinicObj);
      });

      // 누락된 8개국어 번역 필드가 DB에 새로 기록된 경우 로컬 병원 캐시를 무효화하여 최신 상태 유지
      if (migrationPromises.length > 0) {
        Promise.all(migrationPromises).then(() => {
          try {
            localStorage.removeItem("cached_clinics_list");
            console.log(`🌐 총 ${migrationPromises.length}개 병원의 비어 있던 8개국어 번역 데이터가 Firestore에 자동 저장되었습니다.`);
          } catch (e) {}
        });
      }

      currentLoadedClinics.forEach((clinic, index) => {
        const docId = clinic.id;
        const tr = document.createElement("tr");
        const clinicOrder = clinic.order || (index + 1);

        // 마우스 드래그 앤 드롭 순서 변경을 위한 필수 속성 부여
        tr.setAttribute("data-id", docId);
        tr.setAttribute("data-order", clinicOrder);
        tr.className = "clinic-drag-row";
        tr.draggable = true;

        const safeDocId = escapeHtml(docId);
        const safeClinicImg = escapeHtml(sanitizeUrl(clinic.image, "/img/clinic_1_dermatology.png"));
        const deptsHTML = (clinic.depts || []).map(d => `<span class="dept-badge" style="margin-right: 4px; display: inline-block;">${escapeHtml(d)}</span>`).join("");

        tr.innerHTML = `
          <!-- 사용자 요청에 따라 맨 좌측으로 이동 배치된 순서 열 및 드래그 핸들 -->
          <td style="text-align: center; font-weight: 700; color: #00f3ff; white-space: nowrap;">
            <span class="clinic-drag-handle" title="마우스로 드래그하여 순서 변경">⋮⋮</span>
            <span class="clinic-order-num">${clinicOrder}</span>
          </td>
          <td style="text-align: center;">
            <img src="${safeClinicImg}" alt="Clinic" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;" onerror="this.src='/img/clinic_1_dermatology.png'">
          </td>
          <td class="font-bold">${escapeHtml(clinic.name || "-")} <br><small style="color:var(--text-secondary);">${escapeHtml(clinic.englishName || "-")}</small></td>
          <td>${deptsHTML}</td>
          <td>${escapeHtml(clinic.address || "-")}</td>
          <td style="vertical-align: middle; white-space: nowrap; text-align: center;">
            <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
              <!-- 마우스 드래그 앤 드롭 도입으로 불필요해진 이전 위/아래 이동 버튼을 제거하고 수정/삭제만 깔끔하게 유지 -->
              <button class="btn-action confirm btn-edit-clinic"
                data-id="${safeDocId}"
                data-name="${escapeHtml(clinic.name || '')}"
                data-engname="${escapeHtml(clinic.englishName || '')}"
                data-desc="${escapeHtml(clinic.desc || '')}"
                data-address="${escapeHtml(clinic.address || '')}"
                data-depts="${escapeHtml((clinic.depts || []).join(','))}"
                
                /* [다국어 지원] 수정 폼 기본값 노출을 위한 14개 국어 속성 결합 */
                data-nameen="${escapeHtml(clinic.name_en || '')}"
                data-deptsen="${escapeHtml((clinic.depts_en || []).join(','))}"
                data-addressen="${escapeHtml(clinic.address_en || '')}"
                data-descen="${escapeHtml(clinic.desc_en || '')}"

                data-nameja="${escapeHtml(clinic.name_ja || '')}"
                data-deptsja="${escapeHtml((clinic.depts_ja || []).join(','))}"
                data-addressja="${escapeHtml(clinic.address_ja || '')}"
                data-descja="${escapeHtml(clinic.desc_ja || '')}"

                data-namevi="${escapeHtml(clinic.name_vi || '')}"
                data-deptsvi="${escapeHtml((clinic.depts_vi || []).join(','))}"
                data-addressvi="${escapeHtml(clinic.address_vi || '')}"
                data-descvi="${escapeHtml(clinic.desc_vi || '')}"

                data-namezh="${escapeHtml(clinic.name_zh || '')}"
                data-deptszh="${escapeHtml((clinic.depts_zh || []).join(','))}"
                data-addresszh="${escapeHtml(clinic.address_zh || '')}"
                data-desczh="${escapeHtml(clinic.desc_zh || '')}"

                data-nameru="${escapeHtml(clinic.name_ru || '')}"
                data-deptsru="${escapeHtml((clinic.depts_ru || []).join(','))}"
                data-addressru="${escapeHtml(clinic.address_ru || '')}"
                data-descru="${escapeHtml(clinic.desc_ru || '')}"

                data-namemy="${escapeHtml(clinic.name_my || '')}"
                data-deptsmy="${escapeHtml((clinic.depts_my || []).join(','))}"
                data-addressmy="${escapeHtml(clinic.address_my || '')}"
                data-descmy="${escapeHtml(clinic.desc_my || '')}"

                data-namekm="${escapeHtml(clinic.name_km || '')}"
                data-deptskm="${escapeHtml((clinic.depts_km || []).join(','))}"
                data-addresskm="${escapeHtml(clinic.address_km || '')}"
                data-desckm="${escapeHtml(clinic.desc_km || '')}"

                data-namemn="${escapeHtml(clinic.name_mn || '')}"
                data-deptsmn="${escapeHtml((clinic.depts_mn || []).join(','))}"
                data-addressmn="${escapeHtml(clinic.address_mn || '')}"
                data-descmn="${escapeHtml(clinic.desc_mn || '')}"

                data-nameth="${escapeHtml(clinic.name_th || '')}"
                data-deptsth="${escapeHtml((clinic.depts_th || []).join(','))}"
                data-addressth="${escapeHtml(clinic.address_th || '')}"
                data-descth="${escapeHtml(clinic.desc_th || '')}"

                data-namelo="${escapeHtml(clinic.name_lo || '')}"
                data-deptslo="${escapeHtml((clinic.depts_lo || []).join(','))}"
                data-addresslo="${escapeHtml(clinic.address_lo || '')}"
                data-desclo="${escapeHtml(clinic.desc_lo || '')}"

                data-namene="${escapeHtml(clinic.name_ne || '')}"
                data-deptsne="${escapeHtml((clinic.depts_ne || []).join(','))}"
                data-addressne="${escapeHtml(clinic.address_ne || '')}"
                data-descne="${escapeHtml(clinic.desc_ne || '')}"

                data-nameid="${escapeHtml(clinic.name_id || '')}"
                data-deptsid="${escapeHtml((clinic.depts_id || []).join(','))}"
                data-addressid="${escapeHtml(clinic.address_id || '')}"
                data-descid="${escapeHtml(clinic.desc_id || '')}"

                data-namesi="${escapeHtml(clinic.name_si || '')}"
                data-deptssi="${escapeHtml((clinic.depts_si || []).join(','))}"
                data-addresssi="${escapeHtml(clinic.address_si || '')}"
                data-descsi="${escapeHtml(clinic.desc_si || '')}"

                data-namebn="${escapeHtml(clinic.name_bn || '')}"
                data-deptsbn="${escapeHtml((clinic.depts_bn || []).join(','))}"
                data-addressbn="${escapeHtml(clinic.address_bn || '')}"
                data-descbn="${escapeHtml(clinic.desc_bn || '')}"

                /* 병원 사진 수정을 위해 기존 이미지 데이터 전송 속성 추가 */
                data-image="${escapeHtml(sanitizeUrl(clinic.image, ''))}"
                style="height: 28px; line-height: 1; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; background: #0284c7; color: white; border: none; cursor: pointer;"
              >수정</button>
              <button class="btn-action delete btn-delete-clinic" data-id="${safeDocId}" style="height: 28px; line-height: 1; padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; background: #dc2626; color: white; border: none; cursor: pointer;">삭제</button>
            </div>
          </td>
        `;
        adminClinicList.appendChild(tr);
      });
    } catch (e) {
      console.error("Failed to load clinics:", e);
      adminClinicList.innerHTML = `<tr><td colspan="6" class="table-empty">병원 목록을 불러오지 못했습니다.</td></tr>`;
    }
  }

  // --- 병원 관리 구글 지도 및 파일 업로드 헬퍼 로직 ---
  let uploadedImageBase64 = "";

  const inputImage = document.getElementById("reg-clinic-image");
  const imgPreviewContainer = document.getElementById("clinic-image-preview-container");
  const imgPreview = document.getElementById("clinic-image-preview");

  if (inputImage) {
    inputImage.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert("이미지 용량은 최대 10MB를 초과할 수 없습니다. (Image file exceeds 10MB limit.)");
        inputImage.value = "";
        if (imgPreviewContainer) imgPreviewContainer.style.display = "none";
        uploadedImageBase64 = "";
        return;
      }

      try {
        uploadedImageBase64 = await compressImageFile(file, { maxDimension: 800, quality: 0.75 });
        if (imgPreview) imgPreview.src = uploadedImageBase64;
        if (imgPreviewContainer) imgPreviewContainer.style.display = "block";
      } catch (err) {
        console.error("병원 이미지 압축 실패:", err);
      }
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

  // 병원 등록 폼 서브밋 핸들러 (다국어 필드 및 진료과목 지원 개선)
  const clinicRegisterForm = document.getElementById("clinic-register-form");
  if (clinicRegisterForm) {
    clinicRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const name = document.getElementById("reg-clinic-name").value.trim();
      const englishName = document.getElementById("reg-clinic-eng-name").value.trim();
      const deptsRaw = document.getElementById("reg-clinic-depts").value.trim();
      const address = document.getElementById("reg-clinic-address").value.trim();
      const desc = document.getElementById("reg-clinic-desc").value.trim();

      // 다국어 지원: 신규 아코디언에서 14개 외국어 번역 기입 데이터 수집 (선택 입력)
      const langCodes = ["en", "ja", "vi", "zh", "ru", "my", "km", "mn", "th", "lo", "ne", "id", "si", "bn"];
      const multiLangData = {};

      langCodes.forEach(code => {
        const nameEl = document.getElementById(`reg-clinic-name-${code}`);
        const deptsEl = document.getElementById(`reg-clinic-depts-${code}`);
        const addressEl = document.getElementById(`reg-clinic-address-${code}`);
        const descEl = document.getElementById(`reg-clinic-desc-${code}`);

        const lName = nameEl ? nameEl.value.trim() : "";
        const lDeptsRaw = deptsEl ? deptsEl.value.trim() : "";
        const lDepts = lDeptsRaw ? lDeptsRaw.split(",").map(d => d.trim()).filter(d => d.length > 0) : [];
        const lAddress = addressEl ? addressEl.value.trim() : "";
        const lDesc = descEl ? descEl.value.trim() : "";

        // 해당 언어에 입력된 내용이 하나라도 있으면 객체에 추가
        if (lName || lDepts.length > 0 || lAddress || lDesc) {
          multiLangData[`name_${code}`] = lName;
          multiLangData[`depts_${code}`] = lDepts;
          multiLangData[`address_${code}`] = lAddress;
          multiLangData[`desc_${code}`] = lDesc;
        }
      });

      if (!uploadedImageBase64) {
        alert("병원사진 파일을 선택해 주세요. 이미지 압축 처리 중일 수 있습니다.");
        return;
      }

      const depts = deptsRaw.split(",").map(d => d.trim()).filter(d => d.length > 0);

      const btnSubmit = clinicRegisterForm.querySelector("button[type='submit']");
      btnSubmit.disabled = true;
      btnSubmit.textContent = "등록 중...";

      try {
        // 신규 병원 등록 시 기존 order 최댓값 뒤에 오도록 순서 자동 매핑
        let nextOrder = 1;
        const maxQuery = query(collection(db, "clinics"), orderBy("order", "desc"), limit(1));
        const maxSnap = await getDocs(maxQuery);
        if (!maxSnap.empty) {
          const maxVal = maxSnap.docs[0].data().order;
          nextOrder = (typeof maxVal === "number" ? maxVal : 0) + 1;
        }

        // Firestore clinics 컬렉션에 등록 처리 (14개 언어 다국어 객체 포함)
        await addDoc(collection(db, "clinics"), {
          name,
          englishName,
          image: uploadedImageBase64,
          depts,
          address,
          desc,
          order: nextOrder,
          ...multiLangData,
          createdAt: new Date().toISOString()
        });
        alert("신규 병원이 성공적으로 등록되었습니다.");
        // 병원 신설 성공 시 다국어 예약 페이지 내 병원 캐시 무효화 - 탭 간 캐시 동기화를 위해 localStorage로 변경
        localStorage.removeItem("cached_clinics_list");
        
        // 병원 등록 성공 즉시 왼쪽 등록된 병원 테이블 리스트를 새로고침하여 리스트에 바로 반영되도록 기능 추가
        loadClinics();
        
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

      // ── 수정 버튼 처리 (다국어 연동 고도화 복원 및 구현) ──
      if (e.target.classList.contains("btn-edit-clinic")) {
        const btn = e.target;
        const docId       = btn.getAttribute("data-id");
        const curName     = btn.getAttribute("data-name");
        const curEngName  = btn.getAttribute("data-engname");
        const curDesc     = btn.getAttribute("data-desc");
        const curAddress  = btn.getAttribute("data-address");
        const curDepts    = btn.getAttribute("data-depts");

        // 다국어 지원: 14개 외국어 설정 데이터 구조 정의
        const langConfigs = [
          { code: "en", flag: "🇺🇸", label: "영어 (English)", pName: "Clinic Name (영어 병원명)", pDepts: "Departments (진료과목 - 쉼표로 구분)", pAddress: "Address (영어 병원 주소)", pDesc: "Clinic Description (영어 병원 설명)" },
          { code: "ja", flag: "🇯🇵", label: "일본어 (Japanese)", pName: "病院名 (일본어 병원명)", pDepts: "診療科目 (진료과목 - 쉼표로 구분)", pAddress: "住所 (일본어 병원 주소)", pDesc: "病院の説明 (일본어 병원 설명)" },
          { code: "vi", flag: "🇻🇳", label: "베트남어 (Vietnamese)", pName: "Tên bệnh viện (베트남어 병원명)", pDepts: "Khoa điều trị (진료과목 - 쉼표로 구분)", pAddress: "Địa chỉ (베트남어 병원 주소)", pDesc: "Mô tả bệnh viện (베트남어 병원 설명)" },
          { code: "zh", flag: "🇨🇳", label: "중국어 (Chinese)", pName: "医院名称 (중국어 병원명)", pDepts: "诊疗科目 (진료과목 - 쉼표로 구분)", pAddress: "地址 (중국어 병원 주소)", pDesc: "医院介绍 (중국어 병원 설명)" },
          { code: "ru", flag: "🇷🇺", label: "러시아어 (Russian)", pName: "Название клиники (러시아어 병원명)", pDepts: "Медицинские отделения (진료과목 - 쉼표로 구분)", pAddress: "Адрес клиники (러시아어 병원 주소)", pDesc: "Описание клиники (러시아어 병원 설명)" },
          { code: "my", flag: "🇲🇲", label: "미얀마어 (Myanmar)", pName: "ဆေးရုံအမည် (미얀마어 병원명)", pDepts: "ကုသမှုဌာနများ (진료과목 - 쉼표로 구분)", pAddress: "ဆေးရုံလိပ်စာ (미얀마어 병원 주소)", pDesc: "ဆေးရုံဖော်ပြချက် (미얀마어 병원 설명)" },
          { code: "km", flag: "🇰🇭", label: "캄보디아어 (Khmer)", pName: "ឈ្មោះមន្ទីរពេទ្យ (캄보디아어 병원명)", pDepts: "ផ្នែកព្យាបាល (진료과목 - 쉼표로 구분)", pAddress: "អាសយដ្ឋានមន្ទីរពេទ្យ (캄보디아어 병원 주소)", pDesc: "ការពិពណ៌នាមន្ទីរពេទ្យ (캄보디아어 병원 설명)" },
          { code: "mn", flag: "🇲🇳", label: "몽골어 (Mongolian)", pName: "Эмнэлгийн нэр (몽골어 병원명)", pDepts: "Эмчилгээний тасаг (진료과목 - 쉼표로 구분)", pAddress: "Эмнэлгийн хаяг (몽골어 병원 주소)", pDesc: "Эмнэлгийн танилцуулга (몽골어 병원 설명)" },
          { code: "th", flag: "🇹🇭", label: "태국어 (Thai)", pName: "ชื่อโรงพยาบาล (태국어 병원명)", pDepts: "แผนกการรักษา (진료과목 - 쉼표로 구분)", pAddress: "ที่อยู่โรงพยาบาล (태국어 병원 주소)", pDesc: "รายละเอียดโรงพยาบาล (태국어 병원 설명)" },
          { code: "lo", flag: "🇱🇦", label: "라오스어 (Lao)", pName: "ຊື່ໂຮງໝໍ (라오스어 병원명)", pDepts: "ພະແනກປິ່ນປົວ (진료과목 - 쉼표로 구분)", pAddress: "ທີ່ຢູ່ໂຮງໝໍ (라오스어 병원 주소)", pDesc: "ລາຍລະອຽດໂຮງໝໍ (라오스어 병원 설명)" },
          { code: "ne", flag: "🇳🇵", label: "네팔어 (Nepali)", pName: "अस्पतालको नाम (네팔어 병원명)", pDepts: "उपचार विभागहरू (진료과목 - 쉼표로 구분)", pAddress: "अस्पतालको ठेगाना (네팔어 병원 주소)", pDesc: "अस्पतालको विवरण (네팔어 병원 설명)" },
          { code: "id", flag: "🇮🇩", label: "인도네시아어 (Indonesian)", pName: "Nama Rumah Sakit (인도네시아어 병원명)", pDepts: "Departemen Medis (진료과목 - 쉼표로 구분)", pAddress: "Alamat Rumah Sakit (인도네시아어 병원 주소)", pDesc: "Deskripsi Rumah Sakit (인도네시아어 병원 설명)" },
          { code: "si", flag: "🇱🇰", label: "스리랑카어 (Sinhala)", pName: "රෝහලේ නම (스리랑카어 병원명)", pDepts: "ප්‍රතිකාර අංශ (진료과목 - 쉼표로 구분)", pAddress: "රෝහලේ ලිපිනය (스리랑카어 병원 주소)", pDesc: "රෝහල් විස්තරය (스리랑카어 병원 설명)" },
          { code: "bn", flag: "🇧🇩", label: "방글라데시어 (Bengali)", pName: "হাসপাতালের নাম (방글라데시어 병원명)", pDepts: "चिकित্সা বিভাগসমূহ (진료과목 - 쉼표로 구분)", pAddress: "হাসপাতালের ঠিকানা (방글라데시어 병원 주소)", pDesc: "হাসপাতালের বিবরণ (방글라데시어 병원 설명)" }
        ];

        /* 14개 언어의 기존 데이터를 버튼 data-* 속성에서 추출하여 XSS 안전 이스케이프 처리 후 필드셋 HTML 생성 */
        let langFieldsetsHtml = "";
        langConfigs.forEach(cfg => {
          const valName = escapeHtml(btn.getAttribute(`data-name${cfg.code}`) || "");
          const valDepts = escapeHtml(btn.getAttribute(`data-depts${cfg.code}`) || "");
          const valAddress = escapeHtml(btn.getAttribute(`data-address${cfg.code}`) || "");
          const valDesc = escapeHtml(btn.getAttribute(`data-desc${cfg.code}`) || "");

          langFieldsetsHtml += `
            <fieldset style="border:1px solid rgba(255,255,255,0.05); border-radius:6px; padding:0.6rem; margin:0;">
              <legend style="color:#60a5fa; font-size:0.75rem; padding:0 4px; font-weight:600;">${cfg.flag} ${cfg.label}</legend>
              <div style="display:flex; flex-direction:column; gap:0.4rem; margin-top:0.3rem;">
                <input id="edit-clinic-name-${cfg.code}" type="text" value="${valName}" placeholder="${cfg.pName}" style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid rgba(165,180,252,0.2); background:rgba(255,255,255,0.05); color:#e2e8f0; font-size:0.8rem; box-sizing:border-box;">
                <input id="edit-clinic-depts-${cfg.code}" type="text" value="${valDepts}" placeholder="${cfg.pDepts}" style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid rgba(165,180,252,0.2); background:rgba(255,255,255,0.05); color:#e2e8f0; font-size:0.8rem; box-sizing:border-box;">
                <input id="edit-clinic-address-${cfg.code}" type="text" value="${valAddress}" placeholder="${cfg.pAddress}" style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid rgba(165,180,252,0.2); background:rgba(255,255,255,0.05); color:#e2e8f0; font-size:0.8rem; box-sizing:border-box;">
                <textarea id="edit-clinic-desc-${cfg.code}" rows="2" placeholder="${cfg.pDesc}" style="width:100%; padding:0.4rem; border-radius:4px; border:1px solid rgba(165,180,252,0.2); background:rgba(255,255,255,0.05); color:#e2e8f0; font-size:0.8rem; resize:vertical; box-sizing:border-box;">${valDesc}</textarea>
              </div>
            </fieldset>
          `;
        });

        /* 병원 수정 폼에 로드하기 위해 기존 병원 사진의 안전한 URL 추출 */
        const curImage = sanitizeUrl(btn.getAttribute("data-image"), "");

        // 인라인 수정 모달 동적 생성
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
                      padding:2rem; width:min(540px,92vw); max-height:90vh; overflow-y:auto;
                      box-shadow:0 24px 80px rgba(0,0,0,0.6);">
            <h3 style="margin:0 0 1.4rem; color:#a5b4fc; font-size:1.15rem;">✏️ 병원 정보 수정</h3>
            <!-- 병원명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">병원명 *</label>
            <input id="edit-clinic-name" type="text" value="${escapeHtml(curName || '')}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 영문 식별명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">영문 식별명 (English Name) *</label>
            <input id="edit-clinic-engname" type="text" value="${escapeHtml(curEngName || '')}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 진료과목 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">진료과목 (쉼표로 구분)</label>
            <input id="edit-clinic-depts" type="text" value="${escapeHtml(curDepts || '')}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 주소 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">주소 *</label>
            <input id="edit-clinic-address" type="text" value="${escapeHtml(curAddress || '')}"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box;">
            <!-- 병원 설명 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">병원 설명</label>
            <textarea id="edit-clinic-desc" rows="4"
              style="width:100%; padding:0.6rem 0.8rem; border-radius:8px; border:1px solid rgba(165,180,252,0.3);
                     background:rgba(255,255,255,0.05); color:#e2e8f0; margin-bottom:1rem; box-sizing:border-box; resize:vertical;">${escapeHtml(curDesc || '')}</textarea>
            
            <!-- 병원 사진 수정 입력 폼 및 미리보기 디자인 영역 추가 -->
            <label style="display:block; color:#c7d2fe; font-size:0.85rem; margin-bottom:4px;">병원 사진 수정</label>
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:1rem;">
              <input id="edit-clinic-image-file" type="file" accept="image/*" style="display:none;">
              <button id="btn-edit-clinic-image-trigger" class="btn btn-secondary" style="padding:0.4rem 1rem; font-size:0.8rem; border-radius:6px; cursor:pointer;" type="button">사진 선택</button>
              <span id="edit-clinic-image-filename" style="color:rgba(255,255,255,0.4); font-size:0.8rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;">선택된 파일 없음</span>
            </div>
            <!-- 병원 이미지 미리보기 영역 (기존 이미지가 존재할 경우 기본 노출) -->
            <div id="edit-clinic-image-preview-container" style="margin-bottom:1rem; display:${curImage ? 'block' : 'none'}; text-align:center;">
              <img id="edit-clinic-image-preview" src="${escapeHtml(curImage)}" alt="Clinic Preview" style="max-width:100%; max-height:150px; border-radius:8px; border:1px solid rgba(165,180,252,0.3); object-fit:cover;">
            </div>
            
            <!-- 다국어 지원: 다국어 번역 수정 아코디언 (14개국어 지원) -->
            <details style="border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:0.8rem; margin-bottom:1.4rem; background:rgba(255,255,255,0.02);">
              <summary style="font-weight:600; color:#a5b4fc; cursor:pointer; font-size:0.85rem; outline:none; user-select:none;">🌐 다국어 번역 수정 (선택사항)</summary>
              <div style="margin-top:0.8rem; display:flex; flex-direction:column; gap:0.8rem;">
                ${langFieldsetsHtml}
              </div>
            </details>

            <!-- 버튼 영역 -->
            <div style="display:flex; gap:10px; justify-content:flex-end;">
              <button id="btn-edit-clinic-cancel" class="btn btn-secondary"
                style="padding:0.55rem 1.4rem; font-size:0.9rem;">취소</button>
              <button id="btn-edit-clinic-save" class="btn btn-primary"
                style="padding:0.55rem 1.4rem; font-size:0.9rem;"
                data-id="${escapeHtml(docId || '')}">저장하기</button>
            </div>
          </div>
        `;
        document.body.appendChild(editModal);

        /* 병원 수정용 이미지 Base64를 저장할 변수 초기화 (기존 이미지 값을 기본값으로 설정) */
        let editImageBase64 = curImage;

        const editInputImage = document.getElementById("edit-clinic-image-file");
        const editBtnTrigger = document.getElementById("btn-edit-clinic-image-trigger");
        const editImgFilename = document.getElementById("edit-clinic-image-filename");
        const editImgPreviewContainer = document.getElementById("edit-clinic-image-preview-container");
        const editImgPreview = document.getElementById("edit-clinic-image-preview");

        /* 커스텀 디자인 버튼 클릭 시 실제 숨겨진 file input을 클릭해 파일 탐색기 노출 */
        if (editBtnTrigger && editInputImage) {
          editBtnTrigger.addEventListener("click", () => editInputImage.click());
        }

        /* 파일이 새로 선택되면 공통 이미지 압축 함수로 최대 800px / 0.75 JPEG 압축 실행 */
        if (editInputImage) {
          editInputImage.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
              alert("이미지 용량은 최대 10MB를 초과할 수 없습니다. (Image file exceeds 10MB limit.)");
              editInputImage.value = "";
              return;
            }

            if (editImgFilename) editImgFilename.textContent = file.name;

            try {
              editImageBase64 = await compressImageFile(file, { maxDimension: 800, quality: 0.75 });
              if (editImgPreview) editImgPreview.src = editImageBase64;
              if (editImgPreviewContainer) editImgPreviewContainer.style.display = "block";
            } catch (err) {
              console.error("병원 수정 이미지 압축 실패:", err);
            }
          });
        }

        // 취소 버튼
        document.getElementById("btn-edit-clinic-cancel").addEventListener("click", () => {
          editModal.remove();
        });

        // 저장 버튼 - Firestore 업데이트
        document.getElementById("btn-edit-clinic-save").addEventListener("click", async () => {
          const newName    = document.getElementById("edit-clinic-name").value.trim();
          const newEngName = document.getElementById("edit-clinic-engname").value.trim();
          const newDepts   = document.getElementById("edit-clinic-depts").value.trim()
                              .split(",").map(d => d.trim()).filter(d => d.length > 0);
          const newAddress = document.getElementById("edit-clinic-address").value.trim();
          const newDesc    = document.getElementById("edit-clinic-desc").value.trim();

          // 다국어 지원: 14개 언어의 수정된 값 수집
          const updatedMultiLang = {};
          langConfigs.forEach(cfg => {
            const nameEl = document.getElementById(`edit-clinic-name-${cfg.code}`);
            const deptsEl = document.getElementById(`edit-clinic-depts-${cfg.code}`);
            const addressEl = document.getElementById(`edit-clinic-address-${cfg.code}`);
            const descEl = document.getElementById(`edit-clinic-desc-${cfg.code}`);

            const vName = nameEl ? nameEl.value.trim() : "";
            const vDeptsRaw = deptsEl ? deptsEl.value.trim() : "";
            const vDepts = vDeptsRaw ? vDeptsRaw.split(",").map(d => d.trim()).filter(d => d.length > 0) : [];
            const vAddress = addressEl ? addressEl.value.trim() : "";
            const vDesc = descEl ? descEl.value.trim() : "";

            updatedMultiLang[`name_${cfg.code}`] = vName;
            updatedMultiLang[`depts_${cfg.code}`] = vDepts;
            updatedMultiLang[`address_${cfg.code}`] = vAddress;
            updatedMultiLang[`desc_${cfg.code}`] = vDesc;
          });

          if (!newName || !newEngName || !newAddress) {
            alert("병원명, 영문 식별명, 주소는 필수 항목입니다.");
            return;
          }

          const saveBtn = document.getElementById("btn-edit-clinic-save");
          saveBtn.disabled = true;
          saveBtn.textContent = "저장 중...";

          try {
            // Firestore 문서 업데이트 (14개 언어 다국어 필드 및 병원 사진 덮어쓰기 업데이트 반영)
            await updateDoc(doc(db, "clinics", docId), {
              name: newName,
              englishName: newEngName,
              /* 병원 수정 폼에서 수집 또는 기존 유지된 사진 Base64 데이터를 Firestore에 반영 */
              image: editImageBase64,
              depts: newDepts,
              address: newAddress,
              desc: newDesc,
              ...updatedMultiLang
            });
            alert("병원 정보가 성공적으로 수정되었습니다.");
            // 병원 수정 반영에 따른 로컬 캐시 갱신 무효화 - 탭 간 캐시 동기화를 위해 localStorage로 변경
            localStorage.removeItem("cached_clinics_list");
            editModal.remove();
            
            // 병원 수정 완료 후 테이블 새로고침
            loadClinics();
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
            // 병원 삭제 완료에 따른 로컬 캐시 무효화 - 탭 간 캐시 동기화를 위해 localStorage로 변경
            localStorage.removeItem("cached_clinics_list");
            loadClinics(); // 삭제 후 테이블 리프레시
          } catch (error) {
            console.error("Delete clinic failed:", error);
            alert("병원 삭제 중 오류가 발생했습니다: " + error.message);
            e.target.disabled = false;
            e.target.textContent = "삭제";
          }
        }
      }
    });

    // ── 정렬된 병원 목록을 받아 Firestore writeBatch로 일괄 순서 업데이트] ──
    async function saveClinicBatchOrders(orderedList) {
      if (!orderedList || orderedList.length === 0) return;
      const batch = writeBatch(db);
      let updatedCount = 0;

      orderedList.forEach((item, idx) => {
        const properOrder = idx + 1; // 1번부터 시작하는 연속된 정수 순서
        if (item.order !== properOrder) {
          const docRef = doc(db, "clinics", item.id);
          batch.update(docRef, {
            order: properOrder,
            updatedAt: new Date().toISOString()
          });
          item.order = properOrder;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        console.log(`Firestore Batch] 총 ${updatedCount}개 병원의 순서를 연속된 번호로 일괄 갱신합니다.`);
        await batch.commit();
      }
    }

    // 등록된 병원 목록 마우스 드래그 앤 드롭 순서 변경 및 실시간 Firestore 일괄 저장 바인딩
    initTableDragReorder(adminClinicList, {
      rowClass: "clinic-drag-row",
      orderNumSelector: ".clinic-order-num",
      onReorder: async (reorderPayload, rowCount) => {
        const clinicCountBadge = document.getElementById("clinic-count-badge");
        try {
          if (clinicCountBadge) {
            clinicCountBadge.textContent = "💾 순서 저장 중...";
          }
          await saveClinicBatchOrders(reorderPayload);

          // 병원 순서 변경 즉시 로컬 스토리지 캐시 무효화 -> 사용자 예약 화면 즉시 반영
          localStorage.removeItem("cached_clinics_list");

          if (clinicCountBadge) {
            clinicCountBadge.textContent = `총 ${rowCount}개 병원 (순서 자동 저장 완료)`;
            setTimeout(() => {
              if (clinicCountBadge) clinicCountBadge.textContent = `총 ${rowCount}개 병원`;
            }, 2000);
          }
        } catch (err) {
          console.error("병원 드래그 앤 드롭 순서 저장 실패:", err);
          alert("병원 순서 자동 저장 중 오류가 발생했습니다: " + err.message);
          await loadClinics();
        }
      }
    });

    // ── 순서 일괄 자동 정리 버튼 이벤트 바인딩] ──
    const btnReorderClinics = document.getElementById("btn-reorder-clinics");
    if (btnReorderClinics) {
      btnReorderClinics.addEventListener("click", async () => {
        if (!confirm("현재 목록 순서대로 모든 등록된 병원의 순서를 1번부터 차례대로 중복 없이 연속되게 재정렬하시겠습니까?")) {
          return;
        }

        try {
          btnReorderClinics.disabled = true;
          btnReorderClinics.textContent = "정리 중...";

          // 최신 병원 목록 조회
          const q = query(collection(db, "clinics"), orderBy("order", "asc"));
          const snapshot = await getDocs(q);
          const allClinics = [];
          snapshot.forEach((docSnap) => {
            allClinics.push({ id: docSnap.id, ...docSnap.data() });
          });

          if (allClinics.length === 0) {
            alert("재정렬할 병원 데이터가 없습니다.");
            return;
          }

          await saveClinicBatchOrders(allClinics);

          // 로컬 캐시 즉시 무효화
          localStorage.removeItem("cached_clinics_list");

          alert(`총 ${allClinics.length}개 병원의 순서가 1번부터 중복 없이 연속되게 재정렬되었습니다.`);
          await loadClinics();
        } catch (err) {
          console.error("병원 순서 일괄 자동 정리 실패]", err);
          alert("순서 재정렬 중 오류가 발생했습니다: " + err.message);
        } finally {
          btnReorderClinics.disabled = false;
          btnReorderClinics.textContent = "🔄 순서 일괄 자동 정리";
        }
      });
    }
  }

  // ==========================================================================
  // ── [신규 추가] 광고 배너 CRUD 관리 업무 로직 ──
  // ==========================================================================
  const adManageForm = document.getElementById("ad-manage-form");
  const adUrlsContainer = document.getElementById("ad-urls-container");
  const btnAddAdUrl = document.getElementById("btn-add-ad-url");
  const adminAdList = document.getElementById("admin-ad-list");
  const adEditId = document.getElementById("ad-edit-id");
  const adFormTitle = document.getElementById("ad-form-title");
  const btnCancelAdEdit = document.getElementById("btn-cancel-ad-edit");
  const btnSubmitAd = document.getElementById("btn-submit-ad");

  // 메인 홈 광고 배너 로컬 캐시 무효화 공통 헬퍼 함수 (SWR 캐시 및 구형 키 일괄 삭제)
  const invalidateAdsCache = () => {
    try {
      localStorage.removeItem("cached_home_ads");
      localStorage.removeItem("cached_home_ads_data");
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("cached_home_ads")) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.warn("Storage invalidation notice:", e);
    }
  };

  // 광고 배너 이미지 압축은 공통 이미지 압축 유틸리티(compressImageFile)에 위임
  const compressImage = (file, maxWidth = 500) => {
    return compressImageFile(file, { maxDimension: maxWidth, quality: 0.7 });
  };

  // 광고 폼의 이미지 URL 행 템플릿 생성 헬퍼 함수 - 파일 선택 컨트롤 및 48x48 썸네일 미리보기 결합
  const createAdUrlRow = (urlValue = "") => {
    const row = document.createElement("div");
    row.className = "ad-url-row";
    row.style.display = "flex";
    row.style.gap = "0.75rem";
    row.style.alignItems = "center";
    row.style.flexWrap = "wrap";
    row.style.background = "rgba(255, 255, 255, 0.02)";
    row.style.padding = "8px 12px";
    row.style.borderRadius = "8px";
    row.style.border = "1px solid rgba(255, 255, 255, 0.05)";
    row.style.width = "100%";
    
    const safeUrlValue = escapeHtml(sanitizeUrl(urlValue, ""));
    const hasImage = urlValue.trim() !== "";
    const imgDisplay = hasImage ? "block" : "none";
    
    row.innerHTML = `
      <!-- 썸네일 미리보기 이미지 영역 추가 - 수정 및 입력 시 시각적인 이미지 확인 유도 -->
      <div class="ad-thumbnail-container" style="width: 48px; height: 48px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <img class="ad-thumbnail-img" src="${safeUrlValue}" style="width: 100%; height: 100%; object-fit: cover; display: ${imgDisplay};">
        <span class="ad-thumbnail-placeholder" style="font-size: 0.65rem; color: rgba(255,255,255,0.3); display: ${hasImage ? "none" : "block"};">No Img</span>
      </div>
      <input type="text" class="ad-image-url" required value="${escapeHtml(urlValue)}" placeholder="웹 이미지 주소(URL) 또는 우측 파일 업로드 이용" style="padding: 0.6rem; font-size: 0.85rem; flex-grow: 1; min-width: 180px;">
      <div style="display: flex; gap: 0.35rem; align-items: center;">
        <label class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.6rem 0.8rem; min-width: auto; margin: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;">
          📁 파일 선택
          <input type="file" class="ad-file-input" accept="image/*" style="display: none;">
        </label>
        <button type="button" class="btn btn-secondary btn-remove-ad-url" style="font-size: 0.75rem; padding: 0.6rem; min-width: auto; background: rgba(244, 63, 94, 0.1); color: #fda4af; border-color: rgba(244,63,94,0.3);">&times;</button>
      </div>
    `;

    // 텍스트 입력창 값 변경 시 실시간으로 썸네일 미리보기 이미지를 동기화하는 이벤트 추가
    const urlInput = row.querySelector(".ad-image-url");
    const thumbnailImg = row.querySelector(".ad-thumbnail-img");
    const placeholder = row.querySelector(".ad-thumbnail-placeholder");
    
    const updatePreview = () => {
      const val = urlInput.value.trim();
      if (val) {
        thumbnailImg.src = val;
        thumbnailImg.style.display = "block";
        placeholder.style.display = "none";
      } else {
        thumbnailImg.src = "";
        thumbnailImg.style.display = "none";
        placeholder.style.display = "block";
      }
    };
    
    urlInput.addEventListener("input", updatePreview);
    urlInput.addEventListener("change", updatePreview);

    return row;
  };

  // URL 행 추가 버튼 이벤트 리스너
  if (btnAddAdUrl && adUrlsContainer) {
    btnAddAdUrl.addEventListener("click", () => {
      adUrlsContainer.appendChild(createAdUrlRow());
    });
  }

  // URL 행 내 삭제 및 파일 선택 이벤트 위임 처리 리스너
  if (adUrlsContainer) {
    // 1) 동적 삭제 처리
    adUrlsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("btn-remove-ad-url")) {
        const rows = adUrlsContainer.querySelectorAll(".ad-url-row");
        if (rows.length <= 1) {
          alert("광고 슬라이드를 위해 최소 1개 이상의 이미지 주소가 필요합니다.");
          return;
        }
        e.target.closest(".ad-url-row").remove();
      }
    });

    // 2) 로컬 파일 변경 시 압축하여 Base64 텍스트로 치환 적용
    adUrlsContainer.addEventListener("change", async (e) => {
      if (e.target.classList.contains("ad-file-input")) {
        const file = e.target.files[0];
        if (!file) return;

        const row = e.target.closest(".ad-url-row");
        const urlInput = row.querySelector(".ad-image-url");
        const labelNode = e.target.closest("label");

        const originalLabel = labelNode.innerHTML;
        labelNode.style.pointerEvents = "none";
        labelNode.innerHTML = "⌛ 변환 중...";

        try {
          // 최대 가로폭 500px 및 압축 퀄리티 0.7 적용
          const compressedBase64 = await compressImage(file, 500);
          urlInput.value = compressedBase64;
          
          // 이미지 업로드 성공 및 Base64 치환 시 해당 행의 썸네일 미리보기도 즉시 리프레시 반영
          const thumbnailImg = row.querySelector(".ad-thumbnail-img");
          const placeholder = row.querySelector(".ad-thumbnail-placeholder");
          if (thumbnailImg && placeholder) {
            thumbnailImg.src = compressedBase64;
            thumbnailImg.style.display = "block";
            placeholder.style.display = "none";
          }
        } catch (error) {
          console.error("Image compress error:", error);
          alert("이미지 변환 도중 에러가 발생했습니다: " + error.message);
        } finally {
          labelNode.style.pointerEvents = "auto";
          labelNode.innerHTML = originalLabel;
        }
      }
    });
  }

  // 순서 이동 동작(Swap) 처리를 위해 현재 메모리에 올려진 광고 리스트 캐싱
  let currentLoadedAds = [];

  // 1) Firestore로부터 광고 목록 전체를 조회하여 테이블 렌더링 (Read)
  async function loadAds() {
    if (!adminAdList) return;
    
    // 기존 광고 배너 목록 데이터가 수집되어 있는 경우 탭 이동 시마다 테이블 전체를 지워서 대시보드 제목/탭 메뉴가 튀는 랙을 차단하도록 가드
    if (!adminAdList.children || adminAdList.children.length === 0 || adminAdList.innerHTML.includes("table-loading")) {
      adminAdList.innerHTML = `<tr><td colspan="6" class="table-loading">광고 데이터를 불러오는 중입니다...</td></tr>`;
    }

    try {
      // 순서(order) 필드 기준으로 오름차순(asc) 쿼리 실행
      const q = query(collection(db, "ads"), orderBy("order", "asc"));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        adminAdList.innerHTML = `<tr><td colspan="6" class="table-empty">등록된 광고 배너가 없습니다.</td></tr>`;
        currentLoadedAds = [];
        return;
      }

      // 데이터베이스 자동 보정(Auto Migration) 로직
      // 기존에 order 필드 없이 생성되었던 레거시 문서들에 대해 자동으로 순서를 보완 발급합니다.
      let needsMigration = false;
      querySnapshot.forEach((doc) => {
        if (doc.data().order === undefined) {
          needsMigration = true;
        }
      });

      if (needsMigration) {
        console.log("Legacy ad detected. Executing order migration...");
        let tempOrder = 1;
        for (const docSnap of querySnapshot.docs) {
          await updateDoc(doc(db, "ads", docSnap.id), { order: tempOrder++ });
        }
        // 마이그레이션 반영 후 쿼리 재실행
        loadAds();
        return;
      }

      currentLoadedAds = [];
      let html = "";
      
      // 위/아래 이동 처리를 위해 문서를 배열 객체 리스트에 우선 정렬 보관
      querySnapshot.forEach((doc) => {
        currentLoadedAds.push({
          id: doc.id,
          ...doc.data()
        });
      });

      currentLoadedAds.forEach((ad) => {
        const safeAdId = escapeHtml(ad.id);
        const imagesCount = ad.images ? ad.images.length : 0;
        const intervalSec = ad.slideInterval ? ad.slideInterval / 1000 : 4;

        html += `
          <tr data-id="${safeAdId}" data-order="${Number(ad.order) || 0}" class="ad-drag-row" draggable="true">
            <!-- 순서 컬럼을 맨 앞(좌측)으로 배치하고 마우스 드래그 핸들 및 순서 번호 표시 -->
            <td style="text-align: center; font-weight: 700; color: #00f3ff; white-space: nowrap;">
              <span class="ad-drag-handle" title="마우스로 드래그하여 순서 변경">⋮⋮</span>
              <span class="ad-order-num">${Number(ad.order) || 0}</span>
            </td>
            <td style="font-weight: 700; color: #00f3ff;">${escapeHtml(ad.tag || "")}</td>
            <td>${escapeHtml(ad.title || "")}</td>
            <td><span class="badge" style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc;">${imagesCount}개</span></td>
            <td>${intervalSec}초</td>
            <td>
              <div style="display: flex; gap: 0.35rem; justify-content: center; align-items: center;">
                <!-- 위/아래 화살표 버튼은 마우스 드래그 앤 드롭 도입으로 삭제되고 수정/삭제 버튼만 단정하게 유지 -->
                <button class="btn-action confirm btn-edit-ad" data-id="${safeAdId}" style="height: 28px; line-height: 28px; padding: 0 0.75rem; font-size: 0.8rem; border: none; font-weight: 700;">수정</button>
                <button class="btn-action delete btn-delete-ad" data-id="${safeAdId}" style="height: 28px; line-height: 28px; padding: 0 0.75rem; font-size: 0.8rem; font-weight: 700;">삭제</button>
              </div>
            </td>
          </tr>
        `;
      });
      adminAdList.innerHTML = html;
    } catch (error) {
      console.error("Load ads failed:", error);
      adminAdList.innerHTML = `<tr><td colspan="6" class="table-error">광고 데이터를 로드하지 못했습니다: ${escapeHtml(error.message)}</td></tr>`;
    }
  }

  // 2) 광고 데이터 저장 및 수정 제출 리스너 (Create & Update)
  if (adManageForm) {
    adManageForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const tagVal = document.getElementById("ad-tag").value.trim();
      const titleVal = document.getElementById("ad-title").value.trim();
      const descVal = document.getElementById("ad-desc").value.trim();
      const intervalSec = parseFloat(document.getElementById("ad-interval").value) || 4;
      const slideIntervalMs = intervalSec * 1000;

      // 폼 내 이미지 인풋 상자들로부터 활성 URL 값 추출
      const urlInputs = adUrlsContainer.querySelectorAll(".ad-image-url");
      const imagesArray = [];
      urlInputs.forEach((input) => {
        const val = input.value.trim();
        if (val) imagesArray.push(val);
      });

      if (imagesArray.length === 0) {
        alert("최소 1개 이상의 이미지 주소를 올바르게 입력해 주세요.");
        return;
      }

      const submitBtn = btnSubmitAd || adManageForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "저장 중...";

      const editId = adEditId ? adEditId.value : "";

      try {
        if (editId) {
          // 수정 모드 (Update)
          await updateDoc(doc(db, "ads", editId), {
            tag: tagVal,
            title: titleVal,
            desc: descVal,
            images: imagesArray,
            slideInterval: slideIntervalMs
          });
          alert("광고 배너가 성공적으로 수정되었습니다.");
          // 광고 배너 수정 성공 시 메인 홈 로컬 캐시 완전 무효화
          invalidateAdsCache();
        } else {
          // 신규 광고 배너를 등록할 때 순번(order) 최댓값을 실시간으로 조회하여 마지막 순서에 자동 배치
          let nextOrder = 1;
          const maxQuery = query(collection(db, "ads"), orderBy("order", "desc"), limit(1));
          const maxSnap = await getDocs(maxQuery);
          if (!maxSnap.empty) {
            const maxVal = maxSnap.docs[0].data().order;
            nextOrder = (typeof maxVal === "number" ? maxVal : 0) + 1;
          }

          // 신규 등록 모드 (Create)
          await addDoc(collection(db, "ads"), {
            tag: tagVal,
            title: titleVal,
            desc: descVal,
            images: imagesArray,
            slideInterval: slideIntervalMs,
            order: nextOrder,
            createdAt: serverTimestamp()
          });
          alert("새 광고 배너가 성공적으로 등록되었습니다.");
          // 신규 광고 배너 등록 성공 시 메인 홈 로컬 캐시 완전 무효화
          invalidateAdsCache();
        }

        // 폼 초기화 및 일반 모드로의 강제 복원
        resetAdForm();
        loadAds(); // 테이블 리프레시
      } catch (error) {
        console.error("Save ad failed:", error);
        alert("광고 저장에 실패했습니다: " + error.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = editId ? "수정 완료" : "광고 등록하기";
      }
    });
  }

  // 3) 광고 편집 취소 처리 함수
  const resetAdForm = () => {
    if (!adManageForm) return;
    adManageForm.reset();
    if (adEditId) adEditId.value = "";
    if (adFormTitle) adFormTitle.innerHTML = "신규 광고 배너 등록";
    if (btnSubmitAd) btnSubmitAd.textContent = "광고 등록하기";
    if (btnCancelAdEdit) btnCancelAdEdit.style.display = "none";

    // 이미지 URL 영역도 초기값(1개의 비어있는 열)으로 재정리
    if (adUrlsContainer) {
      adUrlsContainer.innerHTML = "";
      adUrlsContainer.appendChild(createAdUrlRow());
    }
  };

  if (btnCancelAdEdit) {
    btnCancelAdEdit.addEventListener("click", resetAdForm);
  }

  // 4) 광고 목록 편집, 삭제, 순서 이동 클릭 핸들러 (이벤트 위임)
  if (adminAdList) {
    adminAdList.addEventListener("click", async (e) => {
      // ── 수정 모드 전환 처리 (Update Form Fill) ──
      if (e.target.classList.contains("btn-edit-ad")) {
        const docId = e.target.getAttribute("data-id");
        e.target.disabled = true;
        e.target.textContent = "...";

        try {
          const docSnap = await getDoc(doc(db, "ads", docId));
          if (docSnap.exists()) {
            const data = docSnap.data();

            // 폼 필드 대입
            if (adEditId) adEditId.value = docId;
            document.getElementById("ad-tag").value = data.tag || "";
            document.getElementById("ad-title").value = data.title || "";
            document.getElementById("ad-desc").value = data.desc || "";
            document.getElementById("ad-interval").value = data.slideInterval ? data.slideInterval / 1000 : 4;

            // 이미지 URL 영역 채우기
            if (adUrlsContainer && data.images) {
              adUrlsContainer.innerHTML = "";
              data.images.forEach((url) => {
                adUrlsContainer.appendChild(createAdUrlRow(url));
              });
            }

            // UI 텍스트 스위칭
            if (adFormTitle) adFormTitle.innerHTML = "광고 배너 정보 수정";
            if (btnSubmitAd) btnSubmitAd.textContent = "수정 완료";
            if (btnCancelAdEdit) btnCancelAdEdit.style.display = "inline-block";

            // 상단 폼 영역으로 포커싱 및 스크롤
            adManageForm.scrollIntoView({ behavior: "smooth" });
          } else {
            alert("존재하지 않는 광고 데이터입니다.");
          }
        } catch (error) {
          console.error("Retrieve ad document failed:", error);
          alert("수정 데이터를 불러오지 못했습니다: " + error.message);
        } finally {
          e.target.disabled = false;
          e.target.textContent = "수정";
        }
      }

      // ── 삭제 클릭 처리 (Delete) ──
      if (e.target.classList.contains("btn-delete-ad")) {
        const docId = e.target.getAttribute("data-id");
        if (confirm("정말 이 광고 배너를 삭제하시겠습니까? 삭제 즉시 홈페이지 메인 배너 리스트에서 제외됩니다.")) {
          e.target.disabled = true;
          e.target.textContent = "...";

          try {
            await deleteDoc(doc(db, "ads", docId));
            alert("광고 배너가 성공적으로 삭제되었습니다.");
            // 광고 배너 삭제 성공 시 메인 홈 로컬 캐시 완전 무효화
            invalidateAdsCache();
            loadAds(); // 새로고침
          } catch (error) {
            console.error("Delete ad document failed:", error);
            alert("광고 삭제에 실패했습니다: " + error.message);
            e.target.disabled = false;
            e.target.textContent = "삭제";
          }
        }
      }
    });
  }

  // 등록된 광고 배너 목록 마우스 드래그 앤 드롭 순서 변경 및 실시간 Firestore 일괄 저장 바인딩
  initTableDragReorder(adminAdList, {
    rowClass: "ad-drag-row",
    orderNumSelector: ".ad-order-num",
    onReorder: async (reorderPayload) => {
      try {
        const batch = writeBatch(db);
        reorderPayload.forEach((item) => {
          if (item.order !== item.newOrder) {
            const docRef = doc(db, "ads", item.id);
            batch.update(docRef, {
              order: item.newOrder,
              updatedAt: serverTimestamp()
            });
          }
        });
        await batch.commit();

        currentLoadedAds.forEach((ad) => {
          const found = reorderPayload.find((p) => p.id === ad.id);
          if (found) ad.order = found.newOrder;
        });
        currentLoadedAds.sort((a, b) => a.order - b.order);
        invalidateAdsCache();
        console.log("광고 배너 순서가 Firestore Batch를 통해 일괄 저장되었습니다.");
      } catch (err) {
        console.error("광고 배너 드래그 앤 드롭 순서 저장 실패:", err);
        alert("광고 배너 순서 자동 저장 중 오류가 발생했습니다: " + err.message);
        await loadAds();
      }
    }
  });

  // 탭 클릭 시 리소스 전역 로드 연동을 위해 window 스코프 배포
  window.loadAds = loadAds;

  // ==========================================================================
  // 전문 의료 통역 관리 (소속 통역사 & 프리랜서 통역사) CRUD 구현
  // ==========================================================================

  const interpreterRegisterForm = document.getElementById("interpreter-register-form");
  // 통역사 구분(소속/프리랜서) 셀렉트 박스 DOM 요소 바인딩
  const regInterpreterType = document.getElementById("reg-interpreter-type");
  // 한글 성명 및 영문/현지 성명 입력 필드 DOM 요소 바인딩
  const regInterpreterNameKo = document.getElementById("reg-interpreter-name-ko");
  const regInterpreterNameEn = document.getElementById("reg-interpreter-name-en");
  const regInterpreterCountrySelect = document.getElementById("reg-interpreter-country-select");
  const regInterpreterCountry = document.getElementById("reg-interpreter-country");
  const regInterpreterPhone = document.getElementById("reg-interpreter-phone");
  const regInterpreterEmail = document.getElementById("reg-interpreter-email");
  const regInterpreterPhotoGroup = document.getElementById("reg-interpreter-photo-group");
  const regInterpreterPhotoFile = document.getElementById("reg-interpreter-photo-file");
  const btnRegInterpreterPhotoTrigger = document.getElementById("btn-reg-interpreter-photo-trigger");
  const regInterpreterPhotoFilename = document.getElementById("reg-interpreter-photo-filename");
  const regInterpreterPhotoPreview = document.getElementById("reg-interpreter-photo-preview");
  const regInterpreterPhotoPreviewContainer = document.getElementById("reg-interpreter-photo-preview-container");
  const regInterpreterOrder = document.getElementById("reg-interpreter-order");
  const btnRefreshInterpreters = document.getElementById("btn-refresh-interpreters");
  // 순서 일괄 자동 정리 버튼 DOM 요소 바인딩
  const btnReorderInterpreters = document.getElementById("btn-reorder-interpreters");

  const adminStaffInterpreterList = document.getElementById("admin-staff-interpreter-list");
  const adminFreelanceInterpreterList = document.getElementById("admin-freelance-interpreter-list");

  let regInterpreterBase64Photo = "";
  let loadedInterpretersMap = {};
  // 순서 자동 계산 및 위/아래 이동 처리를 위해 현재 로드된 통역사 목록을 보관하는 캐시 배열
  let currentStaffList = [];
  let currentFreelanceList = [];

  /**
   * 통역사 구분(소속 통역사 / 프리랜서)에 따라 다음 순번(최대 순서 + 1)을 계산하여 입력창에 자동 세팅하는 함수
   * @param {string} type - 'staff' 또는 'freelance'
   */
  function updateNextInterpreterOrder(type) {
    if (!regInterpreterOrder) return;
    const targetType = type || (regInterpreterType ? regInterpreterType.value : "staff");
    const targetList = targetType === "staff" ? currentStaffList : currentFreelanceList;
    let nextOrder = 1;
    if (targetList && targetList.length > 0) {
      const maxOrder = targetList.reduce((max, item) => {
        const val = parseInt(item.order, 10);
        return !isNaN(val) && val > max ? val : max;
      }, 0);
      nextOrder = maxOrder + 1;
    }
    regInterpreterOrder.value = nextOrder;
  }

  // 통역사 구분 변경 시 사진 업로드 영역 노출/숨김 토글 및 해당 구분의 다음 순번 자동 반영
  if (regInterpreterType && regInterpreterPhotoGroup) {
    regInterpreterType.addEventListener("change", (e) => {
      if (e.target.value === "staff") {
        regInterpreterPhotoGroup.style.display = "block";
      } else {
        regInterpreterPhotoGroup.style.display = "none";
      }
      // 선택된 구분의 다음 순서 숫자를 계산하여 입력창에 즉시 자동 채움
      updateNextInterpreterOrder(e.target.value);
    });
  }

  // 국가 셀렉트 변경 시 국가명 및 국기 자동 매핑
  if (regInterpreterCountrySelect && regInterpreterCountry) {
    regInterpreterCountrySelect.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val.startsWith("custom|")) {
        regInterpreterCountry.value = "";
        regInterpreterCountry.focus();
      } else {
        const parts = val.split("|");
        if (parts.length >= 2) {
          regInterpreterCountry.value = parts[1];
        }
      }
    });
  }

  /**
   * 통역사 프로필 사진 고화질 스마트 리샘플링 래퍼 (3:4 인물 상단 크롭 + 0.95 품질 적용)
   */
  function optimizeInterpreterImage(file) {
    return compressImageFile(file, {
      targetWidth: 420,
      targetHeight: 560,
      quality: 0.95,
      portraitTopCrop: true
    });
  }

  // 통역사 프로필 사진 파일 선택 및 Base64 인코딩 미리보기
  if (btnRegInterpreterPhotoTrigger && regInterpreterPhotoFile) {
    btnRegInterpreterPhotoTrigger.addEventListener("click", () => {
      regInterpreterPhotoFile.click();
    });

    regInterpreterPhotoFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        regInterpreterPhotoFilename.textContent = file.name;
        try {
          regInterpreterBase64Photo = await optimizeInterpreterImage(file);
          if (regInterpreterPhotoPreview && regInterpreterPhotoPreviewContainer) {
            regInterpreterPhotoPreview.src = regInterpreterBase64Photo;
            regInterpreterPhotoPreviewContainer.style.display = "block";
          }
        } catch (imgErr) {
          console.error("Optimize interpreter image error:", imgErr);
          const reader = new FileReader();
          reader.onload = (loadEvt) => {
            regInterpreterBase64Photo = loadEvt.target.result;
            if (regInterpreterPhotoPreview && regInterpreterPhotoPreviewContainer) {
              regInterpreterPhotoPreview.src = regInterpreterBase64Photo;
              regInterpreterPhotoPreviewContainer.style.display = "block";
            }
          };
          reader.readAsDataURL(file);
        }
      } else {
        regInterpreterBase64Photo = "";
        regInterpreterPhotoFilename.textContent = "선택된 파일 없음";
        if (regInterpreterPhotoPreviewContainer) {
          regInterpreterPhotoPreviewContainer.style.display = "none";
        }
      }
    });
  }

  /**
   * Firestore DB에서 전문 통역사 목록을 조회하여 관리자 테이블에 렌더링하는 함수
   */
  async function loadAdminInterpreters() {
    if (!adminStaffInterpreterList || !adminFreelanceInterpreterList) return;

    adminStaffInterpreterList.innerHTML = `<tr><td colspan="6" class="table-loading">소속 통역사 데이터를 불러오는 중입니다...</td></tr>`;
    adminFreelanceInterpreterList.innerHTML = `<tr><td colspan="6" class="table-loading">프리랜서 통역사 데이터를 불러오는 중입니다...</td></tr>`;

    try {
      const q = query(collection(db, "interpreters"), orderBy("order", "asc"));
      const querySnapshot = await getDocs(q);

      loadedInterpretersMap = {};
      const staffList = [];
      const freelanceList = [];

      querySnapshot.forEach((docSnap) => {
        const data = { ...docSnap.data(), id: docSnap.id };
        loadedInterpretersMap[docSnap.id] = data;
        if (data.type === "staff") {
          staffList.push(data);
        } else {
          freelanceList.push(data);
        }
      });

      // 1차 순서(order) 오름차순, 2차 등록일시(createdAt) 오름차순으로 안정적인 정렬 순서 보장
      staffList.sort((a, b) => {
        const orderA = Number(a.order) || 999;
        const orderB = Number(b.order) || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
      freelanceList.sort((a, b) => {
        const orderA = Number(a.order) || 999;
        const orderB = Number(b.order) || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });

      // 전역 목록 캐시 업데이트
      currentStaffList = staffList;
      currentFreelanceList = freelanceList;

      // 신규 등록 폼의 순서 필드에 다음 추천 순번 자동 설정
      updateNextInterpreterOrder();

      // 1. 소속 통역사 테이블 렌더링
      adminStaffInterpreterList.innerHTML = "";
      if (staffList.length === 0) {
        adminStaffInterpreterList.innerHTML = `<tr><td colspan="6" class="table-empty">등록된 소속 통역사가 없습니다.</td></tr>`;
      } else {
        staffList.forEach((item, index) => {
          const tr = document.createElement("tr");
          const safeId = escapeHtml(item.id);
          const safeName = escapeHtml(item.name || "");
          const safeCountry = escapeHtml(item.country || "");
          const photoUrl = escapeHtml(sanitizeUrl(item.image, "/img/logo.png"));
          const flagUrl = escapeHtml(sanitizeUrl(item.flag, `https://flagcdn.com/w80/${encodeURIComponent(item.countryCode || 'kr')}.png`));

          tr.innerHTML = `
            <td>
              <img src="${photoUrl}" alt="${safeName}" style="width: 48px; height: 56px; border-radius: 6px; object-fit: cover; border: 1px solid rgba(0,243,255,0.4);" onerror="this.src='/img/logo.png'">
            </td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <img src="${flagUrl}" alt="${safeCountry}" style="width: 24px; height: 16px; border-radius: 2px;" onerror="this.style.display='none'">
                <span>${safeCountry}</span>
              </div>
            </td>
            <td class="font-bold">${safeName}</td>
            <td>
              <div>${escapeHtml(item.phone || "-")}</div>
              <small style="color: #94a3b8;">${escapeHtml(item.email || "")}</small>
            </td>
            <td>
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span class="role-badge" style="background: rgba(0,243,255,0.15); color: #00f3ff; min-width: 26px; text-align: center; font-weight: bold;">${Number(item.order) || 1}</span>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <button type="button" class="btn-move-interpreter-order btn-move-up" data-id="${safeId}" data-type="staff" title="위로 이동" style="background: rgba(0,243,255,0.1); border: 1px solid rgba(0,243,255,0.3); color: #00f3ff; border-radius: 3px; font-size: 8px; line-height: 1; padding: 2px 4px; cursor: pointer; ${index === 0 ? 'opacity:0.25; cursor:not-allowed;' : ''}">▲</button>
                  <button type="button" class="btn-move-interpreter-order btn-move-down" data-id="${safeId}" data-type="staff" title="아래로 이동" style="background: rgba(0,243,255,0.1); border: 1px solid rgba(0,243,255,0.3); color: #00f3ff; border-radius: 3px; font-size: 8px; line-height: 1; padding: 2px 4px; cursor: pointer; ${index === staffList.length - 1 ? 'opacity:0.25; cursor:not-allowed;' : ''}">▼</button>
                </div>
              </div>
            </td>
            <td>
              <button class="btn-action confirm btn-edit-interpreter" data-id="${safeId}" style="margin-right: 6px;">수정</button>
              <button class="btn-action cancel btn-delete-interpreter" data-id="${safeId}">삭제</button>
            </td>
          `;
          adminStaffInterpreterList.appendChild(tr);
        });
      }

      // 2. 프리랜서 통역사 테이블 렌더링
      adminFreelanceInterpreterList.innerHTML = "";
      if (freelanceList.length === 0) {
        adminFreelanceInterpreterList.innerHTML = `<tr><td colspan="6" class="table-empty">등록된 프리랜서 통역사가 없습니다.</td></tr>`;
      } else {
        freelanceList.forEach((item, index) => {
          const tr = document.createElement("tr");
          const safeId = escapeHtml(item.id);
          const safeCountry = escapeHtml(item.country || "");
          const flagUrl = escapeHtml(sanitizeUrl(item.flag, `https://flagcdn.com/w80/${encodeURIComponent(item.countryCode || 'kr')}.png`));

          tr.innerHTML = `
            <td>
              <img src="${flagUrl}" alt="${safeCountry}" style="width: 28px; height: 18px; border-radius: 3px; box-shadow: 0 0 6px rgba(0,0,0,0.5);" onerror="this.style.display='none'">
            </td>
            <td class="font-bold">${safeCountry}</td>
            <td>${escapeHtml(item.name || "")}</td>
            <td>${escapeHtml(item.phone || "-")}</td>
            <td>
              <div style="display: inline-flex; align-items: center; gap: 6px;">
                <span class="role-badge" style="background: rgba(96,165,250,0.15); color: #60a5fa; min-width: 26px; text-align: center; font-weight: bold;">${Number(item.order) || 1}</span>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <button type="button" class="btn-move-interpreter-order btn-move-up" data-id="${safeId}" data-type="freelance" title="위로 이동" style="background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); color: #60a5fa; border-radius: 3px; font-size: 8px; line-height: 1; padding: 2px 4px; cursor: pointer; ${index === 0 ? 'opacity:0.25; cursor:not-allowed;' : ''}">▲</button>
                  <button type="button" class="btn-move-interpreter-order btn-move-down" data-id="${safeId}" data-type="freelance" title="아래로 이동" style="background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); color: #60a5fa; border-radius: 3px; font-size: 8px; line-height: 1; padding: 2px 4px; cursor: pointer; ${index === freelanceList.length - 1 ? 'opacity:0.25; cursor:not-allowed;' : ''}">▼</button>
                </div>
              </div>
            </td>
            <td>
              <button class="btn-action confirm btn-edit-interpreter" data-id="${safeId}" style="margin-right: 6px;">수정</button>
              <button class="btn-action cancel btn-delete-interpreter" data-id="${safeId}">삭제</button>
            </td>
          `;
          adminFreelanceInterpreterList.appendChild(tr);
        });
      }

    } catch (error) {
      console.error("Load admin interpreters failed:", error);
      adminStaffInterpreterList.innerHTML = `<tr><td colspan="6" class="table-empty">통역사 데이터를 불러오지 못했습니다.</td></tr>`;
      adminFreelanceInterpreterList.innerHTML = `<tr><td colspan="6" class="table-empty">통역사 데이터를 불러오지 못했습니다.</td></tr>`;
    }
  }

  /**
   * 등록된 모든 통역사의 순서를 1번부터 중복 없이 연속적으로 일괄 재부여하여 Firestore에 저장하는 함수
   * @param {boolean} showSuccessAlert - 완료 알림 팝업 노출 여부
   */
  async function reorderAllInterpreters(showSuccessAlert = true) {
    try {
      const q = query(collection(db, "interpreters"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      if (snap.empty) {
        if (showSuccessAlert) alert("정리할 통역사 데이터가 없습니다.");
        return;
      }

      const staffDocs = [];
      const freelanceDocs = [];

      snap.forEach((docSnap) => {
        const d = { ...docSnap.data(), id: docSnap.id };
        if (d.type === "staff") {
          staffDocs.push(d);
        } else {
          freelanceDocs.push(d);
        }
      });

      // 기존 순서 및 생성일시 기준 안정 정렬
      staffDocs.sort((a, b) => {
        const orderA = Number(a.order) || 999;
        const orderB = Number(b.order) || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });
      freelanceDocs.sort((a, b) => {
        const orderA = Number(a.order) || 999;
        const orderB = Number(b.order) || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt || "").localeCompare(b.createdAt || "");
      });

      const batch = writeBatch(db);
      let updatedCount = 0;

      // 1) 소속 통역사 1번부터 중복 없이 연속 순차 재부여
      staffDocs.forEach((item, idx) => {
        const properOrder = idx + 1;
        if (item.order !== properOrder) {
          batch.update(doc(db, "interpreters", item.id), { order: properOrder });
          updatedCount++;
        }
      });

      // 2) 프리랜서 통역사 1번부터 중복 없이 연속 순차 재부여
      freelanceDocs.forEach((item, idx) => {
        const properOrder = idx + 1;
        if (item.order !== properOrder) {
          batch.update(doc(db, "interpreters", item.id), { order: properOrder });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
      }

      // 로컬 스토리지 캐시 초기화
      try {
        localStorage.removeItem("igpartners_cached_interpreters");
      } catch (cacheErr) { }

      if (showSuccessAlert) {
        alert(`총 ${staffDocs.length + freelanceDocs.length}명의 통역사 순서가 1번부터 중복 없이 연속되게 재정렬되었습니다.`);
      }
      await loadAdminInterpreters();
    } catch (err) {
      console.error("Reorder interpreters error:", err);
      alert("통역사 순서 일괄 정리 중 오류가 발생했습니다: " + err.message);
    }
  }

  /**
   * 통역사 목록 테이블 내 위로(▲)/아래로(▼) 이동 버튼 클릭 시 인접 행과 위치를 맞바꾸고 순서를 재정렬하는 함수
   */
  async function handleMoveInterpreterOrder(id, type, direction) {
    const list = type === "staff" ? [...currentStaffList] : [...currentFreelanceList];
    const currentIndex = list.findIndex(item => item.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    // 리스트 내 위치 교환
    const temp = list[currentIndex];
    list[currentIndex] = list[targetIndex];
    list[targetIndex] = temp;

    try {
      const batch = writeBatch(db);
      // 1번부터 순차 재부여하여 순서 중복을 원천 차단하고 순서를 확정
      list.forEach((item, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "interpreters", item.id), { order: newOrder });
      });
      await batch.commit();

      try {
        localStorage.removeItem("igpartners_cached_interpreters");
      } catch (cacheErr) { }

      await loadAdminInterpreters();
    } catch (err) {
      console.error("Move interpreter order error:", err);
      alert("순서 이동 처리 중 오류가 발생했습니다: " + err.message);
    }
  }

  // 순서 일괄 자동 정리 버튼 이벤트 바인딩
  if (btnReorderInterpreters) {
    btnReorderInterpreters.addEventListener("click", async () => {
      if (confirm("현재 목록 순서대로 모든 통역사의 순서를 1번부터 차례대로 중복 없이 연속되게 재정렬하시겠습니까?")) {
        btnReorderInterpreters.disabled = true;
        btnReorderInterpreters.textContent = "정리 중...";
        try {
          await reorderAllInterpreters(true);
        } finally {
          btnReorderInterpreters.disabled = false;
          btnReorderInterpreters.textContent = "🔄 순서 일괄 자동 정리";
        }
      }
    });
  }

  // 통역사 신규 등록 폼 제출 이벤트 처리
  if (interpreterRegisterForm) {
    interpreterRegisterForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const type = regInterpreterType ? regInterpreterType.value : "staff";
      const nameKo = regInterpreterNameKo ? regInterpreterNameKo.value.trim() : "";
      const nameEn = regInterpreterNameEn ? regInterpreterNameEn.value.trim() : "";
      const name = nameEn ? `${nameKo}, ${nameEn}` : nameKo;
      const country = regInterpreterCountry ? regInterpreterCountry.value.trim() : "";
      const phone = regInterpreterPhone ? regInterpreterPhone.value.trim() : "";
      const email = regInterpreterEmail ? regInterpreterEmail.value.trim() : "";
      const order = regInterpreterOrder ? parseInt(regInterpreterOrder.value, 10) || 1 : 1;

      if (!nameKo || !country) {
        alert("한글 성명과 국가는 필수 입력 항목입니다.");
        return;
      }

      // 국가 코드 및 국기 URL 추출
      let countryCode = "kr";
      let flag = "https://flagcdn.com/w80/kr.png";
      if (regInterpreterCountrySelect) {
        const selectVal = regInterpreterCountrySelect.value;
        const parts = selectVal.split("|");
        if (parts.length >= 3 && parts[0] !== "custom") {
          countryCode = parts[0];
          flag = parts[2];
        }
      }

      const newInterpreterData = {
        type: type,
        name: name,
        nameKo: nameKo,
        nameEn: nameEn,
        country: country,
        countryCode: countryCode,
        flag: flag,
        phone: phone,
        email: email,
        image: (type === "staff") ? regInterpreterBase64Photo : "",
        order: order,
        createdAt: new Date().toISOString()
      };

      try {
        const submitBtn = interpreterRegisterForm.querySelector("button[type='submit']");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "등록 처리 중...";
        }

        await addDoc(collection(db, "interpreters"), newInterpreterData);

        // 신규 등록 후 순서 중복을 방지하기 위해 1부터 순차 재정렬 자동 실행
        await reorderAllInterpreters(false);

        try {
          localStorage.removeItem("igpartners_cached_interpreters");
        } catch (cacheErr) { }
        alert("전문 통역사가 성공적으로 등록되었습니다!");

        // 폼 초기화 및 다음 순번 자동 세팅
        interpreterRegisterForm.reset();
        regInterpreterBase64Photo = "";
        if (regInterpreterPhotoFilename) regInterpreterPhotoFilename.textContent = "선택된 파일 없음";
        if (regInterpreterPhotoPreviewContainer) regInterpreterPhotoPreviewContainer.style.display = "none";
        if (regInterpreterCountry) regInterpreterCountry.value = "한국 (Korea)";

        // 다음 등록을 위한 순서 번호 자동 세팅
        updateNextInterpreterOrder();

        // 목록 새로고침
        await loadAdminInterpreters();
      } catch (error) {
        console.error("Register interpreter failed:", error);
        alert("통역사 등록 중 오류가 발생했습니다: " + error.message);
      } finally {
        const submitBtn = interpreterRegisterForm.querySelector("button[type='submit']");
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "✨ 전문 통역사 등록하기";
        }
      }
    });
  }

  // 통역사 정보 수정 모달 표시 함수
  function showInterpreterEditModal(data) {
    let editModal = document.getElementById("interpreter-edit-modal");
    if (editModal) editModal.remove();

    editModal = document.createElement("div");
    editModal.id = "interpreter-edit-modal";
    editModal.className = "auth-modal-backdrop";
    editModal.style.cssText = "position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.75); display:flex; align-items:center; justify-content:center;";

    let editBase64Photo = sanitizeUrl(data.image, "");
    const currentNameKo = escapeHtml(data.nameKo || (data.name ? data.name.split(',')[0].trim() : ""));
    const currentNameEn = escapeHtml(data.nameEn || (data.name && data.name.includes(',') ? data.name.split(',').slice(1).join(',').trim() : ""));
    const currentCountryCode = (data.countryCode || 'kr').toLowerCase();

    editModal.innerHTML = `
      <div style="background:#0c1020; border:1px solid #00f3ff; border-radius:16px; padding:2rem; width:min(540px, 94vw); max-height:90vh; overflow-y:auto; box-shadow:0 0 30px rgba(0,243,255,0.25);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(0,243,255,0.2); padding-bottom:0.75rem;">
          <h3 style="margin:0; color:#00f3ff; font-size:1.2rem;">✏️ 통역사 정보 수정</h3>
          <button type="button" id="btn-close-edit-interpreter-modal" style="background:none; border:none; color:#cbd5e1; font-size:1.5rem; cursor:pointer;">&times;</button>
        </div>

        <form id="form-edit-interpreter">
          <div style="margin-bottom:1rem;">
            <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">통역사 구분</label>
            <select id="edit-interpreter-type" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#00f3ff; font-weight:bold;">
              <option value="staff" ${data.type === 'staff' ? 'selected' : ''}>🏥 IGPartners 소속 통역 (사진 포함)</option>
              <option value="freelance" ${data.type === 'freelance' ? 'selected' : ''}>🌐 프리랜서 통역사 (사진 미포함)</option>
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:1rem;">
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">한글 성명 *</label>
              <input type="text" id="edit-interpreter-name-ko" value="${currentNameKo}" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;" required>
            </div>
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">영문 / 현지 성명</label>
              <input type="text" id="edit-interpreter-name-en" value="${currentNameEn}" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;">
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:1rem;">
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">국가 (선택) *</label>
              <select id="edit-interpreter-country-select" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#e2e8f0;">
                <option value="kr|한국 (Korea)|https://flagcdn.com/w80/kr.png" ${currentCountryCode === 'kr' ? 'selected' : ''}>KR 대한민국 (한국어)</option>
                <option value="vn|베트남 (Vietnam)|https://flagcdn.com/w80/vn.png" ${currentCountryCode === 'vn' ? 'selected' : ''}>VN 베트남 (Tiếng Việt)</option>
                <option value="cn|중국 (China)|https://flagcdn.com/w80/cn.png" ${currentCountryCode === 'cn' ? 'selected' : ''}>CN 중국 (中文)</option>
                <option value="ru|러시아 (Russia)|https://flagcdn.com/w80/ru.png" ${currentCountryCode === 'ru' ? 'selected' : ''}>RU 러시아 (Русский)</option>
                <option value="mn|몽골 (Mongolia)|https://flagcdn.com/w80/mn.png" ${currentCountryCode === 'mn' ? 'selected' : ''}>MN 몽골 (Монгол хэл)</option>
                <option value="jp|일본 (Japan)|https://flagcdn.com/w80/jp.png" ${currentCountryCode === 'jp' ? 'selected' : ''}>JP 일본 (日本語)</option>
                <option value="us|미국/영어권 (English)|https://flagcdn.com/w80/gb.png" ${currentCountryCode === 'us' || currentCountryCode === 'gb' ? 'selected' : ''}>US 미국/영어 (English)</option>
                <option value="th|태국 (Thailand)|https://flagcdn.com/w80/th.png" ${currentCountryCode === 'th' ? 'selected' : ''}>TH 태국 (ภาษาไทย)</option>
                <option value="mm|미얀마 (Myanmar)|https://flagcdn.com/w80/mm.png" ${currentCountryCode === 'mm' ? 'selected' : ''}>MM 미얀마 (မြန်မာစာ)</option>
                <option value="kh|캄보디아 (Cambodia)|https://flagcdn.com/w80/kh.png" ${currentCountryCode === 'kh' ? 'selected' : ''}>KH 캄보디아 (ភាសាខ្មែរ)</option>
                <option value="la|라오스 (Laos)|https://flagcdn.com/w80/la.png" ${currentCountryCode === 'la' ? 'selected' : ''}>LA 라오스 (ພາສາລາວ)</option>
                <option value="np|네팔 (Nepal)|https://flagcdn.com/w80/np.png" ${currentCountryCode === 'np' ? 'selected' : ''}>NP 네팔 (नेपाली)</option>
                <option value="id|인도네시아 (Indonesia)|https://flagcdn.com/w80/id.png" ${currentCountryCode === 'id' ? 'selected' : ''}>ID 인도네시아 (Bahasa)</option>
                <option value="lk|스리랑카 (Sri Lanka)|https://flagcdn.com/w80/lk.png" ${currentCountryCode === 'lk' ? 'selected' : ''}>LK 스리랑카 (සිංහල)</option>
                <option value="bd|방글라데시 (Bangladesh)|https://flagcdn.com/w80/bd.png" ${currentCountryCode === 'bd' ? 'selected' : ''}>BD 방글라데시 (বাংলা)</option>
                <option value="custom|직접 입력|">직접 입력 (Custom)</option>
              </select>
            </div>
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">국가 / 국적 표기 *</label>
              <input type="text" id="edit-interpreter-country" value="${escapeHtml(data.country || '')}" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;" required>
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:1rem;">
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">연락처</label>
              <input type="text" id="edit-interpreter-phone" value="${escapeHtml(data.phone || '')}" placeholder="예: 010-1234-5678" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;">
            </div>
            <div>
              <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">노출 순서</label>
              <input type="number" id="edit-interpreter-order" value="${Number(data.order) || 1}" min="1" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;">
            </div>
          </div>

          <div style="margin-bottom:1rem;">
            <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">이메일</label>
            <input type="email" id="edit-interpreter-email" value="${escapeHtml(data.email || '')}" placeholder="예: interpreter@igpartners.com" style="width:100%; padding:0.6rem; border-radius:8px; border:1px solid rgba(0,243,255,0.3); background:#161c30; color:#fff;">
          </div>

          <div id="edit-interpreter-photo-section" style="margin-bottom:1.5rem; display:${data.type === 'staff' ? 'block' : 'none'};">
            <label style="display:block; color:#94a3b8; font-size:0.85rem; margin-bottom:4px;">프로필 사진 수정</label>
            <div style="display:flex; align-items:center; gap:10px;">
              <input type="file" id="edit-interpreter-photo-file" accept="image/*" style="display:none;">
              <button type="button" id="btn-edit-interpreter-photo-trigger" class="btn btn-secondary" style="padding:0.4rem 0.9rem; font-size:0.8rem; border-radius:6px; cursor:pointer;">사진 변경</button>
              <span id="edit-interpreter-photo-filename" style="color:#94a3b8; font-size:0.8rem;">기존 사진 유지</span>
            </div>
            <div id="edit-interpreter-preview-wrap" style="margin-top:0.8rem; display:${editBase64Photo ? 'block' : 'none'};">
              <img id="edit-interpreter-photo-preview" src="${escapeHtml(editBase64Photo)}" style="max-width:120px; max-height:150px; border-radius:8px; border:1px solid #00f3ff; object-fit:cover;">
            </div>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:1.5rem; border-top:1px solid rgba(255,255,255,0.1); padding-top:1rem;">
            <button type="button" id="btn-cancel-edit-interpreter" class="btn btn-secondary" style="padding:0.6rem 1.2rem; cursor:pointer;">취소</button>
            <button type="submit" class="btn btn-primary" style="padding:0.6rem 1.5rem; background:#00f3ff; color:#080c1c; font-weight:bold; cursor:pointer;">저장 완료</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(editModal);

    // 이벤트 바인딩
    const closeBtn = document.getElementById("btn-close-edit-interpreter-modal");
    const cancelBtn = document.getElementById("btn-cancel-edit-interpreter");
    const editTypeSelect = document.getElementById("edit-interpreter-type");
    const editCountrySelect = document.getElementById("edit-interpreter-country-select");
    const editCountryInput = document.getElementById("edit-interpreter-country");
    const editPhotoSection = document.getElementById("edit-interpreter-photo-section");
    const editPhotoTrigger = document.getElementById("btn-edit-interpreter-photo-trigger");
    const editPhotoFile = document.getElementById("edit-interpreter-photo-file");
    const editPhotoFilename = document.getElementById("edit-interpreter-photo-filename");
    const editPhotoPreview = document.getElementById("edit-interpreter-photo-preview");
    const editPhotoPreviewWrap = document.getElementById("edit-interpreter-preview-wrap");
    const editForm = document.getElementById("form-edit-interpreter");

    if (closeBtn) closeBtn.onclick = () => editModal.remove();
    if (cancelBtn) cancelBtn.onclick = () => editModal.remove();

    if (editCountrySelect && editCountryInput) {
      editCountrySelect.onchange = (e) => {
        const val = e.target.value;
        if (val.startsWith("custom|")) {
          editCountryInput.value = "";
          editCountryInput.focus();
        } else {
          const parts = val.split("|");
          if (parts.length >= 2) {
            editCountryInput.value = parts[1];
          }
        }
      };
    }

    if (editTypeSelect && editPhotoSection) {
      editTypeSelect.onchange = (e) => {
        editPhotoSection.style.display = e.target.value === "staff" ? "block" : "none";
      };
    }

    if (editPhotoTrigger && editPhotoFile) {
      editPhotoTrigger.onclick = () => editPhotoFile.click();
      editPhotoFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          editPhotoFilename.textContent = file.name;
          try {
            editBase64Photo = await optimizeInterpreterImage(file);
            if (editPhotoPreview && editPhotoPreviewWrap) {
              editPhotoPreview.src = editBase64Photo;
              editPhotoPreviewWrap.style.display = "block";
            }
          } catch (imgErr) {
            console.error("Optimize edit interpreter image error:", imgErr);
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              editBase64Photo = loadEvt.target.result;
              if (editPhotoPreview && editPhotoPreviewWrap) {
                editPhotoPreview.src = editBase64Photo;
                editPhotoPreviewWrap.style.display = "block";
              }
            };
            reader.readAsDataURL(file);
          }
        }
      };
    }

    if (editForm) {
      editForm.onsubmit = async (e) => {
        e.preventDefault();
        const updatedType = editTypeSelect.value;
        const updatedNameKo = document.getElementById("edit-interpreter-name-ko").value.trim();
        const updatedNameEn = document.getElementById("edit-interpreter-name-en").value.trim();
        const updatedName = updatedNameEn ? `${updatedNameKo}, ${updatedNameEn}` : updatedNameKo;
        const updatedCountry = editCountryInput.value.trim();
        const updatedPhone = document.getElementById("edit-interpreter-phone").value.trim();
        const updatedEmail = document.getElementById("edit-interpreter-email").value.trim();
        const updatedOrder = parseInt(document.getElementById("edit-interpreter-order").value, 10) || 1;

        if (!updatedNameKo || !updatedCountry) {
          alert("한글 성명과 국가는 필수입니다.");
          return;
        }

        let updatedCountryCode = data.countryCode || "kr";
        let updatedFlag = data.flag || "https://flagcdn.com/w80/kr.png";
        if (editCountrySelect) {
          const selectVal = editCountrySelect.value;
          const parts = selectVal.split("|");
          if (parts.length >= 3 && parts[0] !== "custom") {
            updatedCountryCode = parts[0];
            updatedFlag = parts[2];
          }
        }

        try {
          await updateDoc(doc(db, "interpreters", data.id), {
            type: updatedType,
            name: updatedName,
            nameKo: updatedNameKo,
            nameEn: updatedNameEn,
            country: updatedCountry,
            countryCode: updatedCountryCode,
            flag: updatedFlag,
            phone: updatedPhone,
            email: updatedEmail,
            image: (updatedType === "staff") ? editBase64Photo : "",
            order: updatedOrder
          });

          // 수정 후 순서 중복을 정리하기 위해 재정렬 실행
          await reorderAllInterpreters(false);

          try {
            localStorage.removeItem("igpartners_cached_interpreters");
          } catch (cacheErr) { }

          alert("통역사 정보가 성공적으로 수정되었습니다.");
          editModal.remove();
          await loadAdminInterpreters();
        } catch (err) {
          console.error("Update interpreter error:", err);
          alert("수정 중 오류 발생: " + err.message);
        }
      };
    }
  }

  // 관리자 테이블 내 위/아래 이동 및 수정/삭제 버튼 클릭 이벤트 위임 바인딩
  function bindInterpreterTableEvents(container) {
    if (!container) return;
    container.addEventListener("click", async (e) => {
      // 위로 이동 버튼 클릭
      const moveUpBtn = e.target.closest(".btn-move-up");
      if (moveUpBtn) {
        const id = moveUpBtn.getAttribute("data-id");
        const type = moveUpBtn.getAttribute("data-type");
        if (id && type) {
          await handleMoveInterpreterOrder(id, type, "up");
        }
        return;
      }

      // 아래로 이동 버튼 클릭
      const moveDownBtn = e.target.closest(".btn-move-down");
      if (moveDownBtn) {
        const id = moveDownBtn.getAttribute("data-id");
        const type = moveDownBtn.getAttribute("data-type");
        if (id && type) {
          await handleMoveInterpreterOrder(id, type, "down");
        }
        return;
      }

      // 수정 버튼
      if (e.target.classList.contains("btn-edit-interpreter")) {
        const id = e.target.getAttribute("data-id");
        if (id && loadedInterpretersMap[id]) {
          showInterpreterEditModal(loadedInterpretersMap[id]);
        }
      }

      // 삭제 버튼
      if (e.target.classList.contains("btn-delete-interpreter")) {
        const id = e.target.getAttribute("data-id");
        if (id && confirm("해당 통역사 정보를 정말로 삭제하시겠습니까?")) {
          e.target.disabled = true;
          e.target.textContent = "삭제중...";
          try {
            await deleteDoc(doc(db, "interpreters", id));

            // 삭제 후 순번 공백 방지를 위해 남아있는 통역사들의 순서를 1부터 연속되게 자동 재정렬
            await reorderAllInterpreters(false);

            try {
              localStorage.removeItem("igpartners_cached_interpreters");
            } catch (cacheErr) { }

            alert("통역사 데이터가 삭제되었습니다.");
            await loadAdminInterpreters();
          } catch (err) {
            console.error("Delete interpreter error:", err);
            alert("삭제 실패: " + err.message);
            e.target.disabled = false;
            e.target.textContent = "삭제";
          }
        }
      }
    });
  }

  bindInterpreterTableEvents(adminStaffInterpreterList);
  bindInterpreterTableEvents(adminFreelanceInterpreterList);

  if (btnRefreshInterpreters) {
    btnRefreshInterpreters.addEventListener("click", () => {
      loadAdminInterpreters();
    });
  }

  window.loadAdminInterpreters = loadAdminInterpreters;
  window.reorderAllInterpreters = reorderAllInterpreters;


    // ==============================================================================
  // 6. 협력업체 관리 (CRUD) 기능 구현
  // ==============================================================================
  setupPartnerTab();

  function setupPartnerTab() {
    const partnerForm = document.getElementById("partner-manage-form");
    const partnerEditId = document.getElementById("partner-edit-id");
    const partnerTitle = document.getElementById("partner-title");
    const partnerSubtitle = document.getElementById("partner-subtitle");
    const partnerTag = document.getElementById("partner-tag");
    const partnerImageUrl = document.getElementById("partner-image-url");
    const partnerLinkUrl = document.getElementById("partner-link-url");
    const partnerOrder = document.getElementById("partner-order");
    const partnerFileInput = document.getElementById("partner-file-input");
    const partnerFileName = document.getElementById("partner-file-name");
    const partnerImagePreview = document.getElementById("partner-image-preview");
    const partnerPreviewImg = document.getElementById("partner-preview-img");
    const partnerFormTitle = document.getElementById("partner-form-title");
    const btnSavePartner = document.getElementById("btn-save-partner");
    const btnCancelPartnerEdit = document.getElementById("btn-cancel-partner-edit");
    const adminPartnerList = document.getElementById("admin-partner-list");
    const partnerCountBadge = document.getElementById("partner-count-badge");

    let currentPartnerCount = 0; // 현재 등록된 유효 협력업체 총 개수 상태 변수]

    // 이미지 URL 입력 변경 시 실시간 미리보기 갱신
    if (partnerImageUrl && partnerImagePreview && partnerPreviewImg) {
      partnerImageUrl.addEventListener("input", () => {
        const val = partnerImageUrl.value.trim();
        if (val) {
          partnerPreviewImg.src = val;
          partnerImagePreview.style.display = "flex";
        } else {
          partnerImagePreview.style.display = "none";
        }
      });
    }

    // 로컬 사진 파일 첨부 시 공통 이미지 압축 함수로 400px / 0.82 경량 압축 처리
    if (partnerFileInput) {
      partnerFileInput.addEventListener("change", async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (partnerFileName) partnerFileName.textContent = file.name;

        try {
          const compressedBase64 = await compressImageFile(file, { maxDimension: 400, quality: 0.82 });
          if (partnerImageUrl) partnerImageUrl.value = compressedBase64;
          if (partnerPreviewImg) partnerPreviewImg.src = compressedBase64;
          if (partnerImagePreview) partnerImagePreview.style.display = "flex";
        } catch (err) {
          console.error("협력업체 로고 압축 실패:", err);
        }
      });
    }

    // 수정 취소 버튼 클릭 시 폼 초기화 및 신규 등록 모드 복원
    if (btnCancelPartnerEdit) {
      btnCancelPartnerEdit.addEventListener("click", () => {
        resetPartnerForm();
      });
    }

    // 협력업체 입력 폼 초기화 함수 - 신규 등록 기본 순서를 현재 등록 개수 + 1로 자동 부여
    function resetPartnerForm() {
      if (partnerForm) partnerForm.reset();
      if (partnerEditId) partnerEditId.value = "";
      if (partnerFormTitle) partnerFormTitle.textContent = "신규 협력업체 등록";
      if (btnSavePartner) {
        btnSavePartner.textContent = "💾 협력업체 등록하기";
        btnSavePartner.disabled = false;
      }
      if (btnCancelPartnerEdit) btnCancelPartnerEdit.style.display = "none";
      if (partnerImagePreview) partnerImagePreview.style.display = "none";
      if (partnerFileName) partnerFileName.textContent = "선택 안됨";
      if (partnerOrder) partnerOrder.value = currentPartnerCount + 1;
    }

    /**
     * Firestore에서 현재 등록된 모든 협력업체 목록을 order 오름차순으로 조회
     * @returns {Promise<Array>} 협력업체 문서 객체 배열 [{id, title, order, ...}]
     */
    async function fetchAllPartners() {
      const q = query(collection(db, "partners"), orderBy("order", "asc"));
      const snapshot = await getDocs(q);
      const list = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      return list;
    }

    /**
     * 정렬된 협력업체 목록을 전달받아 1번부터 N번까지 연속된 order로 Firestore writeBatch 일괄 업데이트]
     * @param {Array} orderedList 순서대로 정렬된 협력업체 배열
     */
    async function saveBatchOrders(orderedList) {
      if (!orderedList || orderedList.length === 0) return;
      const batch = writeBatch(db);
      let updatedCount = 0;

      orderedList.forEach((item, idx) => {
        const properOrder = idx + 1; // 1번부터 시작하는 연속된 정수 순서
        if (item.order !== properOrder) {
          const docRef = doc(db, "partners", item.id);
          batch.update(docRef, {
            order: properOrder,
            updatedAt: new Date().toISOString()
          });
          item.order = properOrder;
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        console.log(`Firestore Batch] 총 ${updatedCount}개 협력업체의 순서를 연속된 번호로 일괄 갱신합니다.`);
        await batch.commit();
      }
    }

    // 협력업체 데이터 수정/삭제/순서변경 시 클라이언트 로컬 캐시 즉시 무효화 유틸리티
    function clearPartnersCache() {
      try {
        localStorage.removeItem("cached_partners_data");
        console.log("🧹 SWR] 관리자 데이터 변경으로 협력업체 로컬 캐시를 성공적으로 초기화했습니다.");
      } catch (e) {
        console.warn("협력업체 캐시 초기화 예외]", e);
      }
    }

    // 협력업체 등록 및 수정 폼 서밋 핸들러 - 순서 밀림 및 일괄 재정렬 지원
    if (partnerForm) {
      partnerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const title = partnerTitle.value.trim();
        const subtitle = partnerSubtitle.value.trim();
        const tag = partnerTag.value.trim() || "Partner";
        const imageUrl = partnerImageUrl.value.trim();
        const linkUrl = partnerLinkUrl ? partnerLinkUrl.value.trim() : "";
        const order = parseInt(partnerOrder.value, 10) || 1;
        const editId = partnerEditId.value.trim();

        if (!title || !subtitle || !imageUrl) {
          alert("협력업체명, 소개(부제목), 이미지는 필수 입력 항목입니다.");
          return;
        }

        btnSavePartner.disabled = true;
        btnSavePartner.textContent = "저장 및 순서 재배열 중...";

        try {
          const partnerData = {
            title: title,
            subtitle: subtitle,
            tag: tag,
            imageUrl: imageUrl,
            linkUrl: linkUrl,
            order: order,
            updatedAt: new Date().toISOString()
          };

          if (editId) {
            // 수정 모드 - 1) 수정 대상 문서 기본 데이터 업데이트
            await setDoc(doc(db, "partners", editId), partnerData, { merge: true });

            // 2) 전체 협력업체 목록을 가져와서 수정된 업체를 목표 순서 위치로 이동 후 일괄 밀림 처리
            const allPartners = await fetchAllPartners();
            const targetIdx = allPartners.findIndex((p) => p.id === editId);
            let targetItem;
            if (targetIdx !== -1) {
              targetItem = allPartners.splice(targetIdx, 1)[0];
            } else {
              targetItem = { id: editId, ...partnerData };
            }
            Object.assign(targetItem, partnerData);

            // 사용자가 지정한 새 순서 위치(order - 1)에 끼워넣기 (자연스러운 밀림)
            const insertIdx = Math.max(0, Math.min(order - 1, allPartners.length));
            allPartners.splice(insertIdx, 0, targetItem);

            // 전체 목록에 1부터 N까지 연속된 순서 재부여 및 writeBatch 일괄 저장
            await saveBatchOrders(allPartners);

            // 로컬 캐시 즉시 무효화로 수정사항 즉각 반영
            clearPartnersCache();

            alert(`'${title}' 협력업체 정보 및 순서(자동 밀림 포함)가 성공적으로 수정되었습니다.`);
          } else {
            // 신규 등록 모드 - 1) 신규 문서 추가
            partnerData.createdAt = new Date().toISOString();
            const newDocRef = await addDoc(collection(db, "partners"), partnerData);

            // 2) 전체 협력업체 목록을 가져와 신규 등록 업체를 지정한 순서 위치에 끼워넣고 밀림 처리
            const allPartners = await fetchAllPartners();
            const targetIdx = allPartners.findIndex((p) => p.id === newDocRef.id);
            let targetItem;
            if (targetIdx !== -1) {
              targetItem = allPartners.splice(targetIdx, 1)[0];
            } else {
              targetItem = { id: newDocRef.id, ...partnerData };
            }

            const insertIdx = Math.max(0, Math.min(order - 1, allPartners.length));
            allPartners.splice(insertIdx, 0, targetItem);

            await saveBatchOrders(allPartners);

            // 로컬 캐시 즉시 무효화로 신규 등록 즉각 반영
            clearPartnersCache();

            alert(`'${title}' 신규 협력업체가 성공적으로 등록되었습니다.`);
          }

          resetPartnerForm();
          await loadAdminPartners();
        } catch (err) {
          console.error("협력업체 저장 실패]", err);
          alert("협력업체 저장 중 오류가 발생했습니다: " + err.message);
          btnSavePartner.disabled = false;
          btnSavePartner.textContent = editId ? "✏️ 협력업체 수정 완료" : "💾 협력업체 등록하기";
        }
      });
    }

    // 등록된 협력업체 실시간 목록 조회 및 렌더링 함수
    async function loadAdminPartners() {
      if (!adminPartnerList) return;

      adminPartnerList.innerHTML = `
        <tr>
          <td colspan="6" class="table-loading">협력업체 데이터를 불러오는 중입니다...</td>
        </tr>
      `;

      try {
        // 상단에서 이미 임포트된 collection, query, orderBy, getDocs 사용
        const q = query(collection(db, "partners"), orderBy("order", "asc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          adminPartnerList.innerHTML = `
            <tr>
              <td colspan="6" style="text-align: center; padding: 2.5rem; color: rgba(255,255,255,0.6);">
                등록된 협력업체가 없습니다. 상단 폼을 통해 새로운 협력업체를 등록해 보세요.
              </td>
            </tr>
          `;
          currentPartnerCount = 0;
          if (partnerCountBadge) partnerCountBadge.textContent = "총 0개 업체";
          if (partnerOrder && (!partnerEditId || !partnerEditId.value)) partnerOrder.value = 1;
          return;
        }

        let rowsHtml = "";
        let validCount = 0;

        for (const docSnap of snapshot.docs) {
          const p = docSnap.data();
          const pid = escapeHtml(docSnap.id);

          validCount++;
          const pTitle = escapeHtml(p.title || "미지정");
          const pSubtitle = escapeHtml(p.subtitle || "-");
          const pTag = escapeHtml(p.tag || "Partner");
          const pImg = escapeHtml(sanitizeUrl(p.imageUrl, "/img/logo.png"));
          const pLink = escapeHtml(sanitizeUrl(p.linkUrl, ""));
          const pOrder = Number(p.order) || 1;

          rowsHtml += `
            <tr data-id="${pid}" data-order="${pOrder}" class="partner-drag-row" draggable="true">
              <td style="text-align: center; font-weight: 700; color: #00f3ff; white-space: nowrap;">
                <span class="partner-drag-handle" title="마우스로 드래그하여 순서 변경">⋮⋮</span>
                <span class="partner-order-num">${pOrder}</span>
              </td>
              <td style="text-align: center;">
                <div style="width: 48px; height: 48px; border-radius: 8px; background: rgba(0,0,0,0.4); border: 1px solid rgba(0,243,255,0.3); display: inline-flex; align-items: center; justify-content: center; overflow: hidden;">
                  <img src="${pImg}" alt="${pTitle}" style="max-width: 85%; max-height: 85%; object-fit: contain;" onerror="this.src='/img/logo.png';">
                </div>
              </td>
              <td>
                <div style="font-weight: 700; color: #ffffff; margin-bottom: 0.2rem;">${pTitle}</div>
                <span style="font-size: 0.72rem; color: #00f3ff; background: rgba(0,243,255,0.1); padding: 0.15rem 0.45rem; border-radius: 6px;">${pTag}</span>
              </td>
              <td>
                <div class="partner-subtitle-cell">
                  ${pSubtitle}
                </div>
              </td>
              <td>
                ${pLink ? `<a href="${pLink}" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; font-size: 0.82rem; text-decoration: underline;">방문하기 ➔</a>` : '<span style="color: rgba(255,255,255,0.4); font-size: 0.82rem;">-</span>'}
              </td>
              <td style="text-align: center; white-space: nowrap;">
                <button type="button" class="btn-action-edit btn-edit-partner" data-id="${pid}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; margin-right: 0.3rem; border-radius: 6px; background: #0284c7; color: white; border: none; cursor: pointer;">수정</button>
                <button type="button" class="btn-action-delete btn-delete-partner" data-id="${pid}" data-title="${pTitle}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; border-radius: 6px; background: #dc2626; color: white; border: none; cursor: pointer;">삭제</button>
              </td>
            </tr>
          `;
        }

        currentPartnerCount = validCount;
        if (partnerCountBadge) partnerCountBadge.textContent = `총 ${validCount}개 업체`;
        if (partnerOrder && (!partnerEditId || !partnerEditId.value)) {
          partnerOrder.value = validCount + 1;
        }
        adminPartnerList.innerHTML = rowsHtml;
      } catch (err) {
        console.error("협력업체 목록 로딩 실패]", err);
        adminPartnerList.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: #ef4444; padding: 2rem;">
              목록 로딩 중 오류가 발생했습니다: ${err.message}
            </td>
          </tr>
        `;
      }
    }

    // 순서 일괄 자동 정리 버튼 이벤트 바인딩 - 중복되거나 비어있는 순서를 1번부터 차례대로 연속 정렬
    const btnReorderPartners = document.getElementById("btn-reorder-partners");
    if (btnReorderPartners) {
      btnReorderPartners.addEventListener("click", async () => {
        if (!confirm("현재 목록 순서대로 모든 협력업체의 순서를 1번부터 차례대로 중복 없이 연속되게 재정렬하시겠습니까?")) {
          return;
        }

        try {
          btnReorderPartners.disabled = true;
          btnReorderPartners.textContent = "정리 중...";

          const allPartners = await fetchAllPartners();
          if (allPartners.length === 0) {
            alert("재정렬할 협력업체 데이터가 없습니다.");
            return;
          }

          // 현재 순서(order) 오름차순 기준으로 1부터 순차 재부여
          await saveBatchOrders(allPartners);

          // 순서 재정렬 완료 즉시 로컬 캐시 초기화
          clearPartnersCache();

          alert(`총 ${allPartners.length}개 협력업체의 순서가 1번부터 중복 없이 연속되게 재정렬되었습니다.`);
          await loadAdminPartners();
        } catch (err) {
          console.error("순서 일괄 자동 정리 실패]", err);
          alert("순서 재정렬 중 오류가 발생했습니다: " + err.message);
        } finally {
          btnReorderPartners.disabled = false;
          btnReorderPartners.textContent = "🔄 순서 일괄 자동 정리";
        }
      });
    }

    // 협력업체 테이블 내부 수정/삭제 버튼 이벤트 위임 바인딩
    if (adminPartnerList) {
      adminPartnerList.addEventListener("click", async (e) => {
        const editBtn = e.target.closest(".btn-edit-partner");
        const deleteBtn = e.target.closest(".btn-delete-partner");

        if (editBtn) {
          const pid = editBtn.getAttribute("data-id");
          if (!pid) return;

          try {
            editBtn.disabled = true;
            editBtn.textContent = "로딩...";
            const snap = await getDoc(doc(db, "partners", pid));
            if (!snap.exists()) {
              alert("해당 협력업체 데이터가 존재하지 않습니다.");
              loadAdminPartners();
              return;
            }

            const p = snap.data();
            if (partnerEditId) partnerEditId.value = pid;
            if (partnerTitle) partnerTitle.value = p.title || "";
            if (partnerSubtitle) partnerSubtitle.value = p.subtitle || "";
            if (partnerTag) partnerTag.value = p.tag || "Partner";
            if (partnerImageUrl) partnerImageUrl.value = p.imageUrl || "";
            if (partnerLinkUrl) partnerLinkUrl.value = p.linkUrl || "";
            if (partnerOrder) partnerOrder.value = p.order || 1;

            if (p.imageUrl && partnerPreviewImg && partnerImagePreview) {
              partnerPreviewImg.src = p.imageUrl;
              partnerImagePreview.style.display = "flex";
            }

            if (partnerFormTitle) partnerFormTitle.textContent = `'${p.title}' 협력업체 정보 수정`;
            if (btnSavePartner) {
              btnSavePartner.textContent = "✏️ 협력업체 수정 완료";
              btnSavePartner.disabled = false;
            }
            if (btnCancelPartnerEdit) btnCancelPartnerEdit.style.display = "inline-block";

            // 상단 폼 영역으로 부드럽게 스크롤
            if (partnerForm) {
              partnerForm.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } catch (err) {
            console.error("수정 정보 로드 오류]", err);
            alert("협력업체 정보를 가져오는 중 오류가 발생했습니다: " + err.message);
          } finally {
            editBtn.disabled = false;
            editBtn.textContent = "수정";
          }
        }

        if (deleteBtn) {
          const pid = deleteBtn.getAttribute("data-id");
          const pTitle = deleteBtn.getAttribute("data-title") || "협력업체";
          if (!pid) return;

          if (!confirm(`'${pTitle}' 협력업체를 정말 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {
            return;
          }

          try {
            deleteBtn.disabled = true;
            deleteBtn.textContent = "삭제 중...";
            await deleteDoc(doc(db, "partners", pid));

            // 삭제 후 남아있는 협력업체들의 순서를 1부터 빈틈없이 연속되도록 자동 재정렬
            const remainingPartners = await fetchAllPartners();
            await saveBatchOrders(remainingPartners);

            // 삭제 완료 즉시 로컬 캐시 초기화
            clearPartnersCache();

            alert(`'${pTitle}' 협력업체가 성공적으로 삭제되었습니다.`);
            await loadAdminPartners();
          } catch (err) {
            console.error("삭제 오류]", err);
            alert("협력업체 삭제 실패: " + err.message);
            deleteBtn.disabled = false;
            deleteBtn.textContent = "삭제";
          }
        }
      });
    }

    // 등록된 협력업체 목록 마우스 드래그 앤 드롭 순서 변경 및 실시간 Firestore 일괄 저장 바인딩
    initTableDragReorder(adminPartnerList, {
      rowClass: "partner-drag-row",
      orderNumSelector: ".partner-order-num",
      onReorder: async (reorderPayload, rowCount) => {
        try {
          if (partnerCountBadge) {
            partnerCountBadge.textContent = "💾 순서 저장 중...";
            await saveBatchOrders(reorderPayload);
            clearPartnersCache();
            partnerCountBadge.textContent = `총 ${rowCount}개 업체 (순서 자동 저장 완료)`;
            setTimeout(() => {
              if (partnerCountBadge) partnerCountBadge.textContent = `총 ${rowCount}개 업체`;
            }, 2000);
          } else {
            await saveBatchOrders(reorderPayload);
            clearPartnersCache();
          }
        } catch (err) {
          console.error("드래그 앤 드롭 순서 저장 실패:", err);
          alert("순서 자동 저장 중 오류가 발생했습니다: " + err.message);
          await loadAdminPartners();
        }
      }
    });

    window.loadAdminPartners = loadAdminPartners;

    // 관리자 페이지 내 모든 테이블 드래그 가로 스크롤 초기화 실행
    setupAllTableDragToScroll();
  }
}

// 최초 하드 로딩 시점에는 DOMContentLoaded를 대기하고, SPA 뷰 전환 시점에는 즉시 실행되도록 readyState 감지 분기 처리
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}
// Build cache bust: 2026-07-11T02:11:00

