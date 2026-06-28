import { db, auth } from "./firebase-db.js?v=2.0.7";
import { 
  collection, 
  query, 
  where,
  onSnapshot, 
  doc, 
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const reservationList = document.getElementById("my-reservation-list");
  const btnRefresh = document.getElementById("btn-refresh");

  const statTotal = document.getElementById("stat-total");
  const statPending = document.getElementById("stat-pending");
  const statConfirmed = document.getElementById("stat-confirmed");
  const statCancelled = document.getElementById("stat-cancelled");

  let unsubscribe = null;
  let currentUser = null;

  // 통계 업데이트
  function updateStats(total, pending, confirmed, cancelled) {
    if (statTotal) statTotal.textContent = total;
    if (statPending) statPending.textContent = pending;
    if (statConfirmed) statConfirmed.textContent = confirmed;
    if (statCancelled) statCancelled.textContent = cancelled;
  }

  // 예약 렌더링
  function renderReservations(items) {
    reservationList.innerHTML = "";

    let totalCount = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let cancelledCount = 0;

    if (items.length === 0) {
      reservationList.innerHTML = `<tr><td colspan="13" class="table-empty">신청하신 예약 내역이 없습니다.</td></tr>`;
      updateStats(0, 0, 0, 0);
      return;
    }

    items.forEach((data) => {
      const docId = data.id;

      totalCount++;
      if (data.status === "pending") pendingCount++;
      else if (data.status === "confirmed") confirmedCount++;
      else if (data.status === "cancelled") cancelledCount++;

      const tr = document.createElement("tr");
      tr.className = `status-${data.status}`;

      // 접수시간 포맷
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

      // 언어 매핑
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

      // 신원 정보
      const idInfo = [];
      if (data.alienNo) idInfo.push(`<div class="id-badge alien">외국인: ${data.alienNo}</div>`);
      if (data.passportNo) idInfo.push(`<div class="id-badge passport">여권: ${data.passportNo}</div>`);
      const idInfoHTML = idInfo.length > 0 ? idInfo.join("") : "-";

      // 상태 배지
      let statusBadgeText = "대기중";
      let statusBadgeClass = "badge-pending";
      if (data.status === "confirmed") {
        statusBadgeText = "예약 확정";
        statusBadgeClass = "badge-confirmed";
      } else if (data.status === "cancelled") {
        statusBadgeText = "예약 취소";
        statusBadgeClass = "badge-cancelled";
      }

      // 관리 액션 (본인은 대기 중일 때만 직접 취소 가능)
      let actionButtons = "-";
      if (data.status === "pending") {
        actionButtons = `<button class="btn-action cancel" data-id="${docId}">예약 취소</button>`;
      } else if (data.status === "confirmed") {
        actionButtons = `<small style="color:var(--text-secondary);">취소 불가 (확정됨)</small>`;
      } else if (data.status === "cancelled") {
        actionButtons = `<small style="color:#ef4444;">취소됨</small>`;
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

  // 본인 예약 내역 로드 및 실시간 동기화
  function loadMyReservations(user) {
    if (unsubscribe) {
      unsubscribe();
    }

    // 인덱스 생성 오류를 방지하기 위해 query 정렬(orderBy)을 제외하고, where로 본인 데이터만 쿼리합니다.
    const q = query(collection(db, "reservations"), where("uid", "==", user.uid));
    reservationList.innerHTML = `<tr><td colspan="13" class="table-loading">예약 내역을 실시간으로 가져오는 중입니다...</td></tr>`;

    // 1단계: 로컬스토리지 백업 데이터 선제 렌더링
    let initialLocalItems = [];
    try {
      const localData = localStorage.getItem("local_reservations");
      if (localData) {
        initialLocalItems = JSON.parse(localData).filter(item => item.uid === user.uid);
      }
    } catch (e) {
      console.error("Local storage backup load failed:", e);
    }
    if (initialLocalItems.length > 0) {
      const sortedLocal = initialLocalItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderReservations(sortedLocal);
    }

    // 2단계: Firestore 실시간 리스너 연결
    unsubscribe = onSnapshot(q, (querySnapshot) => {
      const firestoreItems = [];
      querySnapshot.forEach((docSnap) => {
        firestoreItems.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      // 로컬 백업과 머지
      let localItems = [];
      try {
        const localData = localStorage.getItem("local_reservations");
        if (localData) {
          localItems = JSON.parse(localData).filter(item => item.uid === user.uid);
        }
      } catch (e) {}

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

      // 정렬 (최신 접수순)
      const finalItems = Array.from(mergedMap.values()).sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      renderReservations(finalItems);

    }, (error) => {
      console.warn("Firestore access failed. Displaying local cache only.", error);
      // 오프라인/오류 시 로컬 캐시 렌더링
      let localItems = [];
      try {
        const localData = localStorage.getItem("local_reservations");
        if (localData) {
          localItems = JSON.parse(localData).filter(item => item.uid === user.uid);
        }
      } catch (e) {}
      const finalItems = localItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      renderReservations(finalItems);
    });
  }

  // 로컬스토리지 백업 데이터 상태 업데이트
  function updateLocalReservation(docId, newStatus) {
    try {
      const existing = localStorage.getItem("local_reservations");
      if (!existing) return;
      let localData = JSON.parse(existing);

      const item = localData.find(i => i.id === docId);
      if (item) {
        item.status = newStatus;
      }

      localStorage.setItem("local_reservations", JSON.stringify(localData));
      if (currentUser) {
        loadMyReservations(currentUser);
      }
    } catch (e) {
      console.error("Local status update failed:", e);
    }
  }

  // 예약 취소 버튼 이벤트 위임 바인딩
  reservationList.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("cancel")) return;

    const button = e.target;
    const docId = button.dataset.id;

    if (!docId) return;

    if (!confirm("정말 이 예약을 취소하시겠습니까?\n(Chắc chắn muốn hủy lịch hẹn này?)")) {
      return;
    }

    button.disabled = true;
    button.textContent = "...";

    // 1. 로컬 가상 데이터인 경우
    if (docId.startsWith("local_")) {
      updateLocalReservation(docId, "cancelled");
      return;
    }

    // 2. Firestore 데이터인 경우
    try {
      const docRef = doc(db, "reservations", docId);
      await updateDoc(docRef, { status: "cancelled" });
      updateLocalReservation(docId, "cancelled");
      alert("예약이 취소되었습니다. (Lịch hẹn đã được hủy.)");
    } catch (err) {
      console.error("Cancel reservation failed:", err);
      alert("예약 취소에 실패했습니다. 관리자에게 문의바랍니다.");
      button.disabled = false;
      button.textContent = "예약 취소";
    }
  });

  // 새로고침 버튼
  btnRefresh.addEventListener("click", () => {
    if (currentUser) {
      loadMyReservations(currentUser);
    }
  });

  // 세션 감지
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      alert("로그인이 필요합니다. 메인 페이지로 이동합니다.");
      location.href = "/index.html";
      return;
    }
    currentUser = user;
    loadMyReservations(user);
  });
});
