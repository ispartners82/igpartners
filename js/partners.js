/**
 * ==============================================================================
 * [한글 주석: 협력업체 페이지 (partners.html) 전용 클라이언트 스크립트]
 * - Firestore 'partners' 컬렉션 데이터를 실시간으로 구독(onSnapshot)하여
 *   1안 하이엔드 글래스모피즘 와이드 명함 카드로 안전하게 동적 렌더링합니다.
 * - 관리자가 직접 등록한 공식 제휴사 데이터만 순수하게 표시합니다 (더미 시딩 완전 제거).
 * - DOM 로딩 완료 상태를 안전하게 판별하여 무한 로딩 스피너 현상을 원천 방지합니다.
 * ==============================================================================
 */

import { db } from "/js/firebase-db.js?v=260908_7";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/**
 * [한글 주석: 1안 하이엔드 글래스모피즘 와이드 명함 카드 배열 렌더링 함수]
 * @param {HTMLElement} container 그리드 요소
 * @param {Array} list 협력업체 데이터 배열
 */
function renderPartnerCards(container, list) {
  if (!container) return;
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="partners-empty">
        <span style="font-size: 2.2rem; display: block; margin-bottom: 0.8rem;">🤝</span>
        <h3 style="color: #ffffff; margin-bottom: 0.5rem; font-size: 1.15rem;">등록된 협력업체가 없습니다</h3>
        <p style="font-size: 0.9rem; color: rgba(255,255,255,0.6);">IGPartners와 함께할 공식 제휴 파트너 네트워크를 준비 중입니다.</p>
      </div>
    `;
    return;
  }

  let html = "";
  list.forEach((item) => {
    // [한글 주석: 비활성화된 협력업체는 노출 제외]
    if (item.isActive === false) return;

    const title = escapeHtml(item.title || "협력업체");
    const subtitle = escapeHtml(item.subtitle || "");
    const tag = escapeHtml(item.tag || "Partner");
    const imageUrl = item.imageUrl || "/img/logo.png";
    const linkUrl = item.linkUrl ? item.linkUrl.trim() : "";

    const hasLink = linkUrl && (linkUrl.startsWith("http://") || linkUrl.startsWith("https://"));
    const clickAttr = hasLink ? `onclick="window.open('${escapeHtml(linkUrl)}', '_blank', 'noopener,noreferrer')"` : "";
    const cursorStyle = hasLink ? 'cursor: pointer;' : '';

    // [한글 주석: 웹사이트 링크 유무에 따라 공식 사이트 방문 칩 또는 공식 제휴사 인증 뱃지를 표시하여 우측 하단 공백 완벽 해소]
    const bottomInfoHtml = hasLink
      ? `<div class="partner-bottom-row"><span class="partner-link-row">🌐 공식 사이트 방문 ➔</span></div>`
      : `<div class="partner-bottom-row"><span class="partner-verified-badge">🤝 IGPartners 공식 제휴사</span></div>`;

    html += `
      <div class="partner-card" ${clickAttr} style="${cursorStyle}" title="${hasLink ? '클릭 시 공식 웹사이트로 이동합니다' : ''}">
        <div class="partner-logo-box">
          <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='/img/logo.png';">
        </div>
        <div class="partner-content">
          <span class="partner-tag-badge">${tag}</span>
          <h3 class="partner-title">${title}</h3>
          <p class="partner-subtitle">${subtitle}</p>
          ${bottomInfoHtml}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * [한글 주석: 협력업체 데이터베이스 실시간 구독 및 렌더링 초기화 함수]
 */
function initPartnersList() {
  const gridEl = document.getElementById("partners-grid");
  if (!gridEl) return;

  try {
    const partnersRef = collection(db, "partners");
    // [한글 주석: 관리자가 지정한 노출 순서(order) 기준 오름차순 실시간 정렬]
    const q = query(partnersRef, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
      // [한글 주석: Firestore에 등록된 데이터가 0건인 경우 안내 화면 표시]
      if (snapshot.empty) {
        renderPartnerCards(gridEl, []);
        return;
      }

      const list = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // [한글 주석: 과거 임시로 생성되었던 샘플 업체는 화면에서 제외]
        const dummyTitles = ["아이지 글로벌 헬스케어 센터", "서울 프리미엄 메디컬 파트너스", "글로벌 라이프 케어 솔루션"];
        if (dummyTitles.includes(data.title)) {
          return;
        }
        list.push({ id: doc.id, ...data });
      });

      renderPartnerCards(gridEl, list);
    }, (error) => {
      console.error("[한글 주석: 협력업체 목록 수신 오류]", error);
      gridEl.innerHTML = `
        <div class="partners-empty">
          <p style="color: #ef4444;">협력업체 목록을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
        </div>
      `;
    });
  } catch (err) {
    console.error("[한글 주석: 협력업체 초기화 실패]", err);
  }
}

/**
 * [한글 주석: XSS 공격 방지를 위한 HTML 특수문자 이스케이프 유틸리티]
 * @param {string} str 대상 문자열
 * @returns {string} 이스케이프된 안전한 문자열
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// [한글 주석: DOM 로드 상태에 따른 안전한 초기화 실행 (정적 및 지연 로드 완전 대응)]
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initPartnersList();
  });
} else {
  initPartnersList();
}
