/**
 * ==============================================================================
 * 협력업체 페이지 (partners.html) 전용 클라이언트 스크립트
 * - 메인 홈페이지 광고 배너와 동일한 SWR(Stale-While-Revalidate) 초고속 캐싱 엔진 적용
 * - 페이지 새로고침 시 로컬 스토리지 캐시에서 0.01초 만에 카드를 지연 없이 즉시 렌더링합니다.
 * - Firestore 'partners' 컬렉션의 실시간 구독(onSnapshot)을 병행하여, 관리자의 수정/추가/삭제
 *   사항이 발생하는 즉시 화면과 로컬 캐시에 0초 만에 실시간 자동 반영됩니다.
 * - 더미 시딩 완전 제거 및 관리자가 직접 등록한 공식 제휴사 데이터만 순수하게 표시합니다.
 * ==============================================================================
 */

import { db } from "/js/firebase-db.js?v=260910_1";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// 협력업체 로컬 캐시 키 정의 (SWR 캐싱 엔진용)
const CACHE_KEY = "cached_partners_data";

/**
 * 1안 하이엔드 글래스모피즘 와이드 명함 카드 배열 렌더링 함수
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
    // 비활성화된 협력업체는 노출 제외
    if (item.isActive === false) return;

    const title = escapeHtml(item.title || "협력업체");
    const subtitle = escapeHtml(item.subtitle || "");
    const tag = escapeHtml(item.tag || "Partner");
    const imageUrl = item.imageUrl || "/img/logo.png";
    const linkUrl = item.linkUrl ? item.linkUrl.trim() : "";

    const hasLink = linkUrl && (linkUrl.startsWith("http://") || linkUrl.startsWith("https://"));
    const clickAttr = hasLink ? `onclick="window.open('${escapeHtml(linkUrl)}', '_blank', 'noopener,noreferrer')"` : "";
    const cursorStyle = hasLink ? 'cursor: pointer;' : '';

    // 웹사이트 링크 유무에 따라 공식 사이트 방문 칩 또는 공식 제휴사 인증 뱃지를 표시하여 우측 하단 공백 완벽 해소
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
 * 협력업체 데이터베이스 실시간 구독 및 SWR 캐싱 초기화 엔진
 */
function initPartnersList() {
  const gridEl = document.getElementById("partners-grid");
  if (!gridEl) return;

  // ── [1단계: Stale] 로컬 캐시가 존재하면 DB 조회 지연 없이 0.01초 만에 즉시 렌더링 ──
  let cachedData = null;
  try {
    const rawCache = localStorage.getItem(CACHE_KEY);
    if (rawCache) {
      cachedData = JSON.parse(rawCache);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        renderPartnerCards(gridEl, cachedData);
        console.log("⚡ SWR] 협력업체 목록을 로컬 캐시에서 0.01초 만에 지연 없이 즉시 렌더링했습니다.");
      }
    }
  } catch (e) {
    console.warn("협력업체 로컬 캐시 파싱 예외]", e);
  }

  // ── [2단계: Revalidate & Real-time] Firestore 실시간 리스너 구독으로 최신 변경 감지 ──
  try {
    const partnersRef = collection(db, "partners");
    // 관리자가 지정한 노출 순서(order) 기준 오름차순 실시간 정렬
    const q = query(partnersRef, orderBy("order", "asc"));

    onSnapshot(q, (snapshot) => {
      // Firestore에 등록된 데이터가 0건인 경우 로컬 캐시도 비우고 안내 화면 표시
      if (snapshot.empty) {
        localStorage.removeItem(CACHE_KEY);
        cachedData = null;
        renderPartnerCards(gridEl, []);
        return;
      }

      const freshList = [];
      const dummyTitles = ["아이지 글로벌 헬스케어 센터", "서울 프리미엄 메디컬 파트너스", "글로벌 라이프 케어 솔루션"];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // 과거 임시로 생성되었던 샘플 업체는 화면에서 제외
        if (dummyTitles.includes(data.title)) {
          return;
        }
        freshList.push({ id: doc.id, ...data });
      });

      // ── [3단계: Update] 데이터 비교 후 변경 사항이 발생했거나 첫 로드인 경우 화면 즉시 갱신 및 캐시 최신화 ──
      const freshDataStr = JSON.stringify(freshList);
      const cachedDataStr = JSON.stringify(cachedData || []);

      if (freshDataStr !== cachedDataStr) {
        console.log("🔄 SWR] 협력업체 데이터 변경 감지(추가/수정/삭제/순서). UI 및 로컬 캐시를 즉시 갱신합니다.");
        renderPartnerCards(gridEl, freshList);
        localStorage.setItem(CACHE_KEY, freshDataStr);
        cachedData = freshList; // 다음 비교를 위한 메모리 참조 갱신
      } else {
        console.log("✅ SWR] 협력업체 로컬 캐시가 서버의 최신 데이터와 완벽하게 일치합니다.");
        localStorage.setItem(CACHE_KEY, freshDataStr);
      }
    }, (error) => {
      console.error("협력업체 실시간 목록 수신 오류]", error);
      // 이미 로컬 캐시로 화면에 정상 노출 중인 경우 에러 화면으로 덮어쓰지 않고 콘솔만 경고
      if (!cachedData || cachedData.length === 0) {
        gridEl.innerHTML = `
          <div class="partners-empty">
            <p style="color: #ef4444;">협력업체 목록을 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</p>
          </div>
        `;
      }
    });
  } catch (err) {
    console.error("협력업체 초기화 실패]", err);
  }
}

/**
 * XSS 공격 방지를 위한 HTML 특수문자 이스케이프 유틸리티
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

// DOM 로드 상태에 따른 안전한 초기화 실행 (정적 로드 및 SPA 지연 로드 완전 대응)
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initPartnersList();
  });
} else {
  initPartnersList();
}
