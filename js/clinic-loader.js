import { db } from "./firebase-db.js?v=2.0.7";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("clinic-list-container");
  if (!container) return;

  container.innerHTML = `<div class="table-loading" style="grid-column: span 3; text-align: center; padding: 3rem; color: #a5b4fc;">Đang tải danh sách bệnh viện... (병원 목록을 불러오는 중입니다...)</div>`;

  const q = query(collection(db, "clinics"), orderBy("createdAt", "asc"));

  onSnapshot(q, (querySnapshot) => {
    container.innerHTML = "";

    if (querySnapshot.empty) {
      container.innerHTML = `<div class="table-empty" style="grid-column: span 3; text-align: center; padding: 3rem; color: #9ca3af;">Không có bệnh viện nào. (등록된 병원이 없습니다.)</div>`;
      return;
    }

    querySnapshot.forEach((docSnap) => {
      const clinic = docSnap.data();
      
      // 진료과목 배지 HTML 구성
      const deptBadges = (clinic.depts || [])
        .map(dept => `<span class="dept-badge">${dept}</span>`)
        .join("");

      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address || '')}`;

      const card = document.createElement("article");
      card.className = "clinic-card";
      card.innerHTML = `
        <div class="clinic-img-wrapper">
          <img class="clinic-img" src="${clinic.image || '/img/clinic_1_dermatology.png'}" alt="${clinic.name || ''}" onerror="this.src='/img/clinic_1_dermatology.png'">
        </div>
        <div class="clinic-content">
          <h2 class="clinic-title">${clinic.name || ''}</h2>
          <div class="clinic-depts">
            ${deptBadges}
          </div>
          <p class="clinic-desc">${clinic.desc || ''}</p>
          <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="clinic-address-link" style="text-decoration: none; color: inherit; display: block; margin-top: auto;">
            <div class="clinic-address">
              <svg class="address-icon" viewBox="0 0 24 24" width="14" height="14">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <span style="display:inline-block; margin-left: 4px;">${clinic.address || ''}</span>
            </div>
          </a>
          <button class="clinic-select-btn" onclick="selectClinic('${clinic.englishName || clinic.name}')">Đặt lịch ngay</button>
        </div>
      `;
      container.appendChild(card);
    });
  });
});

// 전역 selectClinic 선언 (HTML inline onclick 대응)
window.selectClinic = function(clinicName) {
  console.log("Selected Clinic:", clinicName);
  localStorage.setItem('selected_clinic', clinicName);
  location.href = './reservation.html';
};
